#!/usr/bin/env python3
"""E2E test for the Quant-UX Test page and Studio simulator."""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Allow running this file directly with `python3 tests/e2e/test_simulator.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, create_app_api, signup_user

ROOT = Path(__file__).resolve().parents[2]


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


def wait_for_update(page, app_id, min_count=0, timeout=10000):
    """Wait until the applyChanges call for app_id returns 200."""
    responses = []

    def track(response):
        if f"/rest/apps/{app_id}/update" in response.url:
            responses.append({"url": response.url, "status": response.status})

    page.on("response", track)
    start = time.time()
    while time.time() - start < timeout / 1000:
        if len(responses) > min_count:
            latest = responses[-1]
            if latest["status"] == 200:
                page.remove_listener("response", track)
                return latest
        page.wait_for_timeout(50)
    page.remove_listener("response", track)
    raise AssertionError(f"applyChanges did not return 200 in time: {responses}")


def wait_for_screen_count(app_id, token, expected, timeout=10000):
    """Poll the backend until the saved app has the expected number of screens."""
    start = time.time()
    while time.time() - start < timeout / 1000:
        saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=token)
        screens = saved_app.get("screens", {}) or {}
        if len(screens) == expected:
            return len(screens)
        time.sleep(0.1)
    saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=token)
    screens = saved_app.get("screens", {}) or {}
    raise AssertionError(
        f"Screen count did not reach {expected} within {timeout}ms (got {len(screens)})"
    )


def get_test_invitation_hash(app_id, token):
    """Fetch invitations for an app and return the TEST (permission 1) hash."""
    invitations = api_call("GET", f"/rest/invitation/{app_id}.json", token=token)
    assert invitations, f"No invitations found for app {app_id}"
    test_hash = next(
        (h for h, permission in invitations.items() if permission == 1), None
    )
    assert test_hash, f"No test (permission 1) invitation in {invitations}"
    return test_hash


def test_simulator():
    """End-to-end test for the test page and simulator:

    1. Sign up, create an app and add a screen in the Studio editor.
    2. Open the simulator from the Studio play button.
    3. Retrieve the test invitation hash and open the public test page.
    4. Click through the splash and verify the prototype renders.
    5. Assert no unexpected REST errors.
    """
    with IsolatedTestEnvironment() as env:
        email = f"sim-{int(time.time())}@quant-ux.e2e"
        password = "password123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "E2E Simulator App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

            try:
                # 1. Login via localStorage and land in the Studio.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)
                print("Login confirmed: Studio welcome rendered.")

                # 2. Open the Studio editor and add a screen.
                page.goto(f"{env['frontend_url']}/#/apps/{app_id}/create.html")
                page.wait_for_selector(".MatcCanvas", timeout=20000)
                page.wait_for_selector(
                    '[data-dojo-attach-point="addScreenBtn"]', timeout=10000
                )

                # Remove the webpack dev-server overlay if present.
                page.evaluate(
                    """() => {
                        const overlay = document.getElementById('webpack-dev-server-client-overlay');
                        if (overlay) overlay.remove();
                    }"""
                )

                page.click('[data-dojo-attach-point="addScreenBtn"]', timeout=10000)
                page.wait_for_timeout(300)
                page.click(".MatcCanvas", timeout=10000)

                wait_for_update(page, app_id, min_count=0)
                screen_count = wait_for_screen_count(app_id, user["token"], expected=1)
                assert screen_count == 1, f"Expected 1 saved screen, got {screen_count}"
                print("Screen added and persisted.")

                # Wait for Design.vue's delayed loadAll() to fire so it does not
                # make REST calls with an undefined id after we leave the editor.
                page.wait_for_timeout(4000)

                # 3. Optionally open the simulator from the Studio play button.
                page.wait_for_selector(
                    '[data-dojo-attach-point="simulatorButton"]', state="visible", timeout=10000
                )
                page.click(
                    '[data-dojo-attach-point="simulatorButton"] .MatcToolbarPrimaryItem',
                    timeout=10000,
                )
                page.wait_for_selector(
                    ".VommondDialogBackground .MatchSimulatorContainer",
                    timeout=15000,
                )
                page.wait_for_selector(
                    ".VommondDialogBackground .MatcScreen",
                    timeout=15000,
                )
                print("Studio simulator opened from play button and rendered a screen.")

                # 4. Get the test invitation hash from the backend.
                test_hash = get_test_invitation_hash(app_id, user["token"])
                print(f"Test invitation hash: {test_hash}")

                # 5. Open the public test page.
                page.goto(f"{env['frontend_url']}/#/test.html?h={test_hash}")

                # Wait for the splash and start button to prove the page loaded.
                page.wait_for_selector(".MatcTestSplash", timeout=20000)
                page.wait_for_selector(".MatcTestStartButton", state="visible", timeout=20000)
                print("Test page splash loaded and start button is visible.")

                # Click through the splash start buttons.
                for attempt in range(5):
                    try:
                        page.wait_for_selector(
                            ".MatcTestStartButton", state="visible", timeout=3000
                        )
                        page.click(".MatcTestStartButton", timeout=3000)
                    except Exception:
                        pass
                    page.wait_for_timeout(500)
                    if page.locator(".MatcScreen").count() > 0:
                        break

                assert page.locator(".MatcScreen").count() > 0, (
                    "Simulator did not render a screen on the test page"
                )
                print("Test page rendered the prototype screen.")

                # 6. Assert no unexpected REST errors.
                rest_errors = collect_rest_errors(page)
                unexpected = [
                    e for e in rest_errors if "ws.quant-ux.com" not in e["name"]
                ]

                print(f"User: {email}")
                print(f"App: {app_id}")
                print(f"REST errors: {rest_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: Simulator and Test page test completed successfully.")

            except Exception as exc:
                print("TEST FAILED:", exc)
                debug_path = ROOT / "tests" / "e2e" / "debug_test_simulator.png"
                try:
                    page.screenshot(path=str(debug_path))
                    print(f"Screenshot saved to: {debug_path}")
                except Exception:
                    pass
                try:
                    body_text = page.locator("body").inner_text()
                    print("PAGE BODY:")
                    print(body_text[:2000])
                except Exception:
                    pass
                try:
                    rest_errors = collect_rest_errors(page)
                    unexpected = [
                        e for e in rest_errors if "ws.quant-ux.com" not in e["name"]
                    ]
                    print(f"REST errors: {rest_errors}")
                    print(f"Unexpected REST errors: {unexpected}")
                except Exception:
                    pass
                print("CONSOLE LOGS:")
                for log in console_logs[-50:]:
                    print(log)
                raise

            finally:
                context.close()
                browser.close()


if __name__ == "__main__":
    test_simulator()
