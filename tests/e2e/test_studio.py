#!/usr/bin/env python3
"""E2E smoke test for the Quant-UX Studio page against the local Node backend."""

import json
import os
import subprocess
import time
from pathlib import Path

import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND_URL = os.environ.get("QUX_E2E_FRONTEND", "http://localhost:8081")
BACKEND_URL = os.environ.get("QUX_E2E_BACKEND", "http://localhost:8080")


def api_call(method, path, payload=None, token=None):
    """Make a JSON HTTP request to the local backend."""
    req = urllib.request.Request(
        f"{BACKEND_URL}{path}",
        method=method,
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        req.data = json.dumps(payload).encode("utf-8")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def cleanup_backend_db():
    """Remove the test database and WAL files."""
    db = BACKEND / "data" / "qux.db"
    if db.exists():
        db.unlink()
    for wal in [BACKEND / "data" / "qux.db-shm", BACKEND / "data" / "qux.db-wal"]:
        if wal.exists():
            wal.unlink()


def start_backend():
    """Start the Node backend in the background and return the process."""
    env = os.environ.copy()
    env["QUX_SQLITE_PATH"] = str(BACKEND / "data" / "qux.db")
    env["QUX_JWT_PASSWORD"] = "e2e-test-secret"
    proc = subprocess.Popen(
        ["npx", "ts-node", "src/server.ts"],
        cwd=BACKEND,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    for _ in range(50):
        try:
            with urllib.request.urlopen(f"{BACKEND_URL}/rest/user", timeout=1):
                break
        except Exception:
            time.sleep(0.2)
    else:
        proc.kill()
        raise RuntimeError("Backend failed to start")
    return proc


def stop_backend(proc):
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


def collect_rest_errors(page):
    """Return REST requests that returned 4xx/5xx."""
    return page.evaluate(
        """() => {
            return performance.getEntriesByType('resource')
                .filter(r => r.name.includes('/rest/'))
                .filter(r => r.responseStatus >= 400)
                .map(r => ({ name: r.name, status: r.responseStatus }));
        }"""
    )


def signup_user(email, password):
    """Register a user via the REST API and return the full user object with token."""
    user = api_call("POST", "/rest/user", {"email": email, "password": password, "tos": True})
    # The login endpoint returns the same shape and is needed to confirm token validity
    login = api_call("POST", "/rest/login/", {"email": email, "password": password})
    # Merge token from signup into the logged-in user object
    if "token" in user:
        login["token"] = user["token"]
    return login


def create_app_api(user, name):
    """Create an app via the REST API and return the app JSON."""
    return api_call(
        "POST",
        "/rest/apps/",
        {"name": name, "screenSize": {"w": 375, "h": 812}},
        token=user["token"],
    )


def test_studio_smoke():
    """End-to-end smoke test: register, create app, open editor, verify no REST 404s."""
    backend_proc = None
    try:
        with urllib.request.urlopen(f"{BACKEND_URL}/rest/user", timeout=1):
            pass
    except Exception:
        cleanup_backend_db()
        backend_proc = start_backend()

    email = f"e2e-{int(time.time())}@test.com"
    password = "password123"
    user = signup_user(email, password)
    app = create_app_api(user, "E2E Studio App")
    app_id = app.get("id") or app.get("_id")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

        try:
            # Seed the frontend session by storing the user object in localStorage,
            # then reload so UserService re-reads it before any other component calls it.
            page.goto(f"{FRONTEND_URL}/#/")
            page.evaluate(
                f"""() => {{
                    localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    localStorage.setItem('quxLanguage', 'en');
                }}"""
            )
            page.reload()

            # Wait until the studio overview renders as proof of login
            page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)

            # Navigate to the editor
            page.goto(f"{FRONTEND_URL}/#/apps/{app_id}/create.html")

            try:
                page.wait_for_selector(".MatcCanvas", timeout=40000)
            except Exception:
                print("PAGE BODY:", page.locator("body").inner_text()[:500])
                print("CONSOLE ERRORS:", collect_rest_errors(page))
                page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug.png"))
                raise

            # Remove the webpack dev-server overlay so it does not intercept clicks
            page.evaluate("""() => {
                const overlay = document.getElementById('webpack-dev-server-client-overlay');
                if (overlay) overlay.remove();
            }""")

            page.wait_for_selector("text=E2E Studio App", timeout=10000)
            page.wait_for_timeout(2000)

            def get_screen_count():
                saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=user["token"])
                return len(saved_app.get("screens", {}))

            def get_widget_count():
                saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=user["token"])
                return len(saved_app.get("widgets", {}))

            # Try to add a screen to verify the editor can save via applyChanges
            try:
                # Click the "Add Screen" toolbar button
                page.click('[data-dojo-attach-point="addScreenBtn"]', timeout=5000)
                # Click on the canvas to place the new screen
                page.click('.MatcCanvas', timeout=5000)
                # Wait for auto-save (debounced 300ms + network)
                page.wait_for_timeout(2000)

                # Check that the applyChanges call succeeded
                updates = [
                    e
                    for e in page.evaluate("() => performance.getEntriesByType('resource')")
                    if f"/rest/apps/{app_id}/update" in e.get("name", "")
                ]
                if updates:
                    last = updates[-1]
                    print(f"applyChanges status: {last.get('responseStatus')}")
                    assert last.get('responseStatus') in (200, 0), f"applyChanges failed: {last}"

                # Verify via the backend that a screen was actually saved
                screen_count = get_screen_count()
                print(f"Saved screens count: {screen_count}")
                assert screen_count > 0, "No screen was saved after add"

                # Add a second screen using the keyboard shortcut, then click canvas
                page.keyboard.press('s')
                page.wait_for_timeout(500)
                page.click('.MatcCanvas', timeout=5000)
                page.wait_for_timeout(2000)

                screen_count = get_screen_count()
                print(f"Saved screens count after 2nd add: {screen_count}")
                assert screen_count == 2, f"Expected 2 screens, got {screen_count}"

                # Undo the last screen addition
                page.keyboard.press('Control+z')
                page.wait_for_timeout(2000)

                screen_count = get_screen_count()
                print(f"Saved screens count after undo: {screen_count}")
                assert screen_count == 1, f"Expected 1 screen after undo, got {screen_count}"

                # Redo
                page.keyboard.press('Control+Shift+z')
                page.wait_for_timeout(2000)

                screen_count = get_screen_count()
                print(f"Saved screens count after redo: {screen_count}")
                assert screen_count == 2, f"Expected 2 screens after redo, got {screen_count}"

                # Add a box widget using the 'r' shortcut and dragging on the canvas
                page.keyboard.press('r')
                page.wait_for_timeout(500)

                canvas = page.locator('.MatcCanvas')
                box = canvas.bounding_box()
                assert box, "Canvas not found for widget add"
                start_x = box['x'] + box['width'] / 2
                start_y = box['y'] + box['height'] / 2

                page.mouse.move(start_x, start_y)
                page.mouse.down()
                page.mouse.move(start_x + 100, start_y + 100)
                page.mouse.up()
                page.wait_for_timeout(2000)

                widget_count = get_widget_count()
                print(f"Saved widgets count after box add: {widget_count}")
                assert widget_count > 0, "No widget was saved after box add"

                # Copy and paste the selected widget
                page.keyboard.press('Control+c')
                page.wait_for_timeout(500)
                page.keyboard.press('Control+v')
                page.wait_for_timeout(2000)

                widget_count = get_widget_count()
                print(f"Saved widgets count after paste: {widget_count}")
                assert widget_count == 2, f"Expected 2 widgets after paste, got {widget_count}"

                # Delete the pasted widget (still selected)
                page.keyboard.press('Delete')
                page.wait_for_timeout(2000)

                widget_count = get_widget_count()
                print(f"Saved widgets count after first delete: {widget_count}")
                assert widget_count == 1, f"Expected 1 widget after first delete, got {widget_count}"

                # Select the original widget and delete it
                page.mouse.click(start_x + 50, start_y + 50)
                page.wait_for_timeout(500)
                page.keyboard.press('Delete')
                page.wait_for_timeout(2000)

                widget_count = get_widget_count()
                print(f"Saved widgets count after second delete: {widget_count}")
                assert widget_count == 0, f"Expected 0 widgets after second delete, got {widget_count}"

            except Exception as e:
                print("Could not interact with editor to add screen:", e)
                print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug.png"))
                raise

            rest_errors = collect_rest_errors(page)
            # Ignore external WebSocket; the local Node backend does not provide a WebSocket yet.
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

            print(f"User: {email}")
            print(f"App: {app_id}")
            print(f"REST errors: {rest_errors}")
            print(f"Unexpected REST errors: {unexpected}")

            assert page.locator(".MatcCanvas").is_visible(), "Canvas not rendered"
            assert not unexpected, f"Unexpected REST errors: {unexpected}"

            print("PASS: Studio smoke test completed successfully.")
        finally:
            context.close()
            browser.close()

    if backend_proc:
        stop_backend(backend_proc)


if __name__ == "__main__":
    test_studio_smoke()
