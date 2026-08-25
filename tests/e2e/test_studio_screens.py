#!/usr/bin/env python3
"""E2E test for Studio screen management using an isolated backend + frontend."""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Allow running this file directly with `python3 tests/e2e/test_studio_screens.py`.
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


def test_studio_screens():
    """Test adding, undoing and redoing screens in the Studio editor."""
    with IsolatedTestEnvironment() as env:
        email = f"studio-screens-{int(time.time())}@quant-ux.e2e"
        password = "password123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "Studio Screens App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        def get_screen_count():
            saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=user["token"])
            screens = saved_app.get("screens", {}) or {}
            return len(screens)

        def wait_for_count(expected, timeout=10000):
            start = time.time()
            while time.time() - start < timeout / 1000:
                count = get_screen_count()
                if count == expected:
                    return count
                time.sleep(0.1)
            actual = get_screen_count()
            raise AssertionError(
                f"Screen count did not reach {expected} within {timeout}ms (got {actual})"
            )

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

            # Track applyChanges (/rest/apps/:id/update) responses.
            update_responses = []

            def track_update(response):
                if f"/rest/apps/{app_id}/update" in response.url:
                    update_responses.append(
                        {"url": response.url, "status": response.status}
                    )

            page.on("response", track_update)

            def wait_for_update(min_count=0, timeout=10000):
                start = time.time()
                while time.time() - start < timeout / 1000:
                    if len(update_responses) > min_count:
                        latest = update_responses[-1]
                        if latest["status"] == 200:
                            return latest
                    page.wait_for_timeout(50)
                raise AssertionError(
                    f"applyChanges did not return 200 in time (responses: {update_responses})"
                )

            try:
                # Seed the frontend session by storing the user object in localStorage,
                # then reload so UserService reads it before other components need it.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)

                # Open the Studio editor for the test app.
                page.goto(f"{env['frontend_url']}/#/apps/{app_id}/create.html")
                page.wait_for_selector(".MatcCanvas", timeout=20000)
                page.wait_for_selector(
                    '[data-dojo-attach-point="addScreenBtn"]', timeout=10000
                )

                # Remove the webpack dev-server overlay if it is present so it cannot
                # intercept clicks in a dev build.
                page.evaluate(
                    """() => {
                        const overlay = document.getElementById('webpack-dev-server-client-overlay');
                        if (overlay) overlay.remove();
                    }"""
                )

                # Add the first screen: click the toolbar button, then the canvas.
                page.click('[data-dojo-attach-point="addScreenBtn"]', timeout=10000)
                page.wait_for_timeout(200)
                page.click(".MatcCanvas", timeout=10000)

                first_update = wait_for_update(min_count=0)
                assert first_update["status"] == 200, (
                    f"applyChanges did not return 200: {first_update}"
                )

                screen_count = wait_for_count(1)
                assert screen_count == 1, f"Expected 1 saved screen, got {screen_count}"

                # Add the second screen.
                page.click('[data-dojo-attach-point="addScreenBtn"]', timeout=10000)
                page.wait_for_timeout(200)
                page.click(".MatcCanvas", timeout=10000)

                second_update = wait_for_update(min_count=1)
                assert second_update["status"] == 200, (
                    f"applyChanges did not return 200: {second_update}"
                )

                screen_count = wait_for_count(2)
                assert screen_count == 2, f"Expected 2 saved screens, got {screen_count}"

                # Undo the last screen addition.
                page.keyboard.press("Control+z")
                screen_count = wait_for_count(1)
                assert screen_count == 1, (
                    f"Expected 1 screen after undo, got {screen_count}"
                )

                # Redo the undone screen addition.
                page.keyboard.press("Control+Shift+z")
                screen_count = wait_for_count(2)
                assert screen_count == 2, (
                    f"Expected 2 screens after redo, got {screen_count}"
                )

                rest_errors = collect_rest_errors(page)
                unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

                print(f"User: {email}")
                print(f"App: {app_id}")
                print(f"REST errors: {rest_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: Studio screens test completed successfully.")

            except Exception as exc:
                screenshot_path = ROOT / "tests" / "e2e" / "debug_studio_screens.png"
                try:
                    page.screenshot(path=str(screenshot_path))
                    print(f"Screenshot saved to: {screenshot_path}")
                except Exception:
                    pass
                try:
                    body_text = page.locator("body").inner_text()
                    print("PAGE BODY:")
                    print(body_text[:2000])
                except Exception:
                    pass
                try:
                    html = page.content()
                    print("PAGE HTML (first 2000 chars):")
                    print(html[:2000])
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
    test_studio_screens()
