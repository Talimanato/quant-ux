"""E2E test harness with isolated backend + production server for parallel tests."""
import atexit
import json
import os
import shutil
import signal
import socket
import subprocess
import threading
import time
import uuid
from pathlib import Path
import urllib.request

try:
    import pytest
except ImportError:  # conftest can be imported as a plain module from a script
    pytest = None  # type: ignore

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
SERVER_DIR = ROOT / "server"

# Ports outside this range are never touched by the cleanup helpers.
E2E_PORT_RANGE = (9000, 9999)

# All live isolated environments, so that leaked children can be killed even
# when the test process is interrupted (SIGINT/SIGKILL skips __exit__).
_ACTIVE_ENVS = set()
_ACTIVE_ENVS_LOCK = threading.Lock()


def _kill_port_owner(port: int):
    """Best effort kill of whatever process still listens on port (if any)."""
    if not (E2E_PORT_RANGE[0] <= port <= E2E_PORT_RANGE[1]):
        return
    try:
        import subprocess as sp

        out = sp.run(
            ["lsof", "-ti", f":{port}"], capture_output=True, text=True, timeout=5
        ).stdout
        for pid in out.split():
            if pid.isdigit() and int(pid) != os.getpid():
                try:
                    os.kill(int(pid), signal.SIGKILL)
                except OSError:
                    pass
    except Exception:
        pass


def _emergency_cleanup():
    with _ACTIVE_ENVS_LOCK:
        envs = list(_ACTIVE_ENVS)
        _ACTIVE_ENVS.clear()
    for env in envs:
        env.force_stop()


atexit.register(_emergency_cleanup)
for _sig in (signal.SIGINT, signal.SIGTERM):
    try:
        signal.signal(_sig, lambda *_: (_emergency_cleanup(), os._exit(1)))
    except (ValueError, OSError):
        pass  # not main thread or unsupported platform


def get_free_port(start_port: int, max_attempts: int = 100) -> int:
    """Find a free port starting from start_port.

    Binds to all interfaces (0.0.0.0) with SO_REUSEADDR so that occupied
    ports are skipped. This matches the Node servers' default bind and makes
    parallel test runners far less likely to collide.
    """
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind(("", port))
                return port
        except OSError:
            continue
    raise RuntimeError(
        f"No free port found in range {start_port}-{start_port + max_attempts - 1}"
    )


def cleanup_batch_data(batch_id: str):
    """Remove database, WAL files, images and logs for a batch."""
    data_dir = BACKEND / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    db_path = data_dir / f"e2e-{batch_id}.db"
    for wal in [data_dir / f"e2e-{batch_id}.db-shm", data_dir / f"e2e-{batch_id}.db-wal"]:
        if wal.exists():
            wal.unlink(missing_ok=True)
    if db_path.exists():
        db_path.unlink(missing_ok=True)

    for folder in [
        data_dir / f"e2e-{batch_id}-user-images",
        data_dir / f"e2e-{batch_id}-app-images",
    ]:
        if folder.exists():
            shutil.rmtree(folder, ignore_errors=True)

    for log in data_dir.glob(f"e2e-{batch_id}-*.log"):
        if log.exists():
            log.unlink(missing_ok=True)


def _drain_output(proc: subprocess.Popen, log_path: Path):
    """Background thread that writes a process's stdout to a log file.

    Without a reader the Popen pipe buffer can fill and deadlock the child
    process once it writes more than ~64 KiB. This is a no-op for a quiet
    process but cheap insurance for longer E2E runs.
    """
    try:
        with open(log_path, "wb") as log_file:
            while True:
                try:
                    chunk = proc.stdout.read(4096)
                except Exception:
                    break
                if not chunk:
                    break
                log_file.write(chunk)
    except Exception:
        pass


def start_backend(batch_id: str, backend_port: int) -> subprocess.Popen:
    """Start the Node backend on backend_port with an isolated DB."""
    env = os.environ.copy()
    env["QUX_HTTP_PORT"] = str(backend_port)
    env["QUX_SQLITE_PATH"] = str(BACKEND / "data" / f"e2e-{batch_id}.db")
    env["QUX_JWT_PASSWORD"] = "e2e-test-secret"
    env["QUX_IMAGE_FOLDER_USER"] = str(BACKEND / "data" / f"e2e-{batch_id}-user-images")
    env["QUX_IMAGE_FOLDER_APPS"] = str(BACKEND / "data" / f"e2e-{batch_id}-app-images")

    log_path = BACKEND / "data" / f"e2e-{batch_id}-backend.log"
    (BACKEND / "data").mkdir(parents=True, exist_ok=True)

    proc = subprocess.Popen(
        ["npx", "ts-node", "src/server.ts"],
        cwd=BACKEND,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    threading.Thread(
        target=_drain_output, args=(proc, log_path), daemon=True
    ).start()

    backend_url = f"http://localhost:{backend_port}"
    for _ in range(50):
        if proc.poll() is not None:
            stop_process(proc)
            raise RuntimeError(f"Backend exited before readiness on port {backend_port}")
        try:
            with urllib.request.urlopen(f"{backend_url}/rest/user", timeout=1):
                break
        except Exception:
            time.sleep(0.2)
    else:
        stop_process(proc)
        raise RuntimeError(f"Backend failed to start on port {backend_port}")

    # Guard against a stale server from an earlier run answering the readiness
    # probe while our process is still dying from EADDRINUSE.
    time.sleep(0.3)
    if proc.poll() is not None:
        stop_process(proc)
        raise RuntimeError(
            f"Backend died right after readiness on port {backend_port} "
            "(port probably owned by a stale server)"
        )
    return proc


def start_frontend(
    backend_port: int, frontend_port: int, batch_id: str = None
) -> subprocess.Popen:
    """Start the production server on frontend_port, proxying to backend_port."""
    env = os.environ.copy()
    env["QUX_HTTP_PORT"] = str(frontend_port)
    env["QUX_PROXY_URL"] = f"http://localhost:{backend_port}"

    batch_id = batch_id or str(uuid.uuid4())[:8]
    log_path = BACKEND / "data" / f"e2e-{batch_id}-frontend.log"
    (BACKEND / "data").mkdir(parents=True, exist_ok=True)

    proc = subprocess.Popen(
        ["node", "start.js"],
        cwd=SERVER_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    threading.Thread(
        target=_drain_output, args=(proc, log_path), daemon=True
    ).start()

    frontend_url = f"http://localhost:{frontend_port}"
    for _ in range(50):
        if proc.poll() is not None:
            stop_process(proc)
            raise RuntimeError(f"Frontend exited before readiness on port {frontend_port}")
        try:
            with urllib.request.urlopen(frontend_url, timeout=1):
                break
        except Exception:
            time.sleep(0.2)
    else:
        stop_process(proc)
        raise RuntimeError(f"Frontend failed to start on port {frontend_port}")

    # Guard against a stale server from an earlier run answering the readiness
    # probe while our process is still dying from EADDRINUSE.
    time.sleep(0.3)
    if proc.poll() is not None:
        stop_process(proc)
        raise RuntimeError(
            f"Frontend died right after readiness on port {frontend_port} "
            "(port probably owned by a stale server)"
        )
    return proc


def stop_process(proc: subprocess.Popen, timeout: int = 5):
    """Terminate a process, escalating to SIGKILL if needed."""
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass


class IsolatedTestEnvironment:
    """Context manager for an isolated backend + frontend pair."""

    def __init__(self, batch_id: str = None):
        self.batch_id = batch_id or str(uuid.uuid4())[:8]
        self.backend_port = get_free_port(9000)
        self.frontend_port = get_free_port(9100)
        self.backend_proc = None
        self.frontend_proc = None
        self._old_env = {}

    def __enter__(self):
        self._old_env = {
            "QUX_E2E_FRONTEND": os.environ.get("QUX_E2E_FRONTEND"),
            "QUX_E2E_BACKEND": os.environ.get("QUX_E2E_BACKEND"),
        }
        with _ACTIVE_ENVS_LOCK:
            _ACTIVE_ENVS.add(self)

        for attempt in range(5):
            try:
                cleanup_batch_data(self.batch_id)
                self.backend_proc = start_backend(self.batch_id, self.backend_port)
                self.frontend_proc = start_frontend(
                    self.backend_port, self.frontend_port, self.batch_id
                )
                break
            except RuntimeError:
                self.force_stop(keep_registered=True)
                # Pick fresh ports for the next attempt.
                self.backend_port = get_free_port(9000)
                self.frontend_port = get_free_port(9100)
                time.sleep(0.1)
        else:
            with _ACTIVE_ENVS_LOCK:
                _ACTIVE_ENVS.discard(self)
            raise RuntimeError(
                f"Failed to start isolated environment after 5 attempts (batch {self.batch_id})"
            )

        os.environ["QUX_E2E_FRONTEND"] = f"http://localhost:{self.frontend_port}"
        os.environ["QUX_E2E_BACKEND"] = f"http://localhost:{self.backend_port}"
        return {
            "batch_id": self.batch_id,
            "backend_url": f"http://localhost:{self.backend_port}",
            "frontend_url": f"http://localhost:{self.frontend_port}",
            "backend_port": self.backend_port,
            "frontend_port": self.frontend_port,
        }

    def force_stop(self, keep_registered: bool = False):
        """Stop children and free the ports, even if called more than once."""
        if self.frontend_proc:
            stop_process(self.frontend_proc)
            self.frontend_proc = None
            _kill_port_owner(self.frontend_port)
        if self.backend_proc:
            stop_process(self.backend_proc)
            self.backend_proc = None
            _kill_port_owner(self.backend_port)
        if not keep_registered:
            with _ACTIVE_ENVS_LOCK:
                _ACTIVE_ENVS.discard(self)

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.force_stop()
        cleanup_batch_data(self.batch_id)

        for key, value in self._old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        return False


def api_call(method, path, payload=None, token=None):
    backend_url = os.environ.get("QUX_E2E_BACKEND", "http://localhost:8080")
    req = urllib.request.Request(
        f"{backend_url}{path}",
        method=method,
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        req.data = json.dumps(payload).encode("utf-8")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def signup_user(email, password):
    user = api_call("POST", "/rest/user", {"email": email, "password": password, "tos": True})
    login = api_call("POST", "/rest/login/", {"email": email, "password": password})
    if "token" in user:
        login["token"] = user["token"]
    return login


def create_app_api(user, name):
    return api_call(
        "POST",
        "/rest/apps/",
        {"name": name, "screenSize": {"w": 375, "h": 812}},
        token=user["token"],
    )


if pytest is not None:

    @pytest.fixture
    def isolated_env():
        """Pytest fixture that yields an isolated backend + frontend environment."""
        with IsolatedTestEnvironment() as env:
            yield env
