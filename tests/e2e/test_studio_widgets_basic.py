#!/usr/bin/env python3
"""E2E coverage for basic widget creation in the Quant-UX Studio editor.

This test runs an isolated backend + production frontend, logs in via
localStorage.quxUser, opens the editor, adds a box and a text widget, deletes
one widget, and verifies the backend widget count and the absence of REST
errors.
"""
import json
import sys
import time
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_studio_widgets_basic.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, signup_user, create_app_api
from playwright.sync_api import sync_playwright

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


def get_widget_count(app_id, token):
    """Fetch the app from the backend and count persisted widgets."""
    saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=token)
    return len(saved_app.get("widgets", {}))


def _run_studio_widgets_basic(env):
    """Core test logic using the supplied isolated environment dict."""
    email = f"e2e-widgets-{int(time.time())}@test.com"
    password = "password123"

    user = signup_user(email, password)
    assert "token" in user, "Signup did not return a token"
    token = user["token"]

    app = create_app_api(user, "E2E Widgets App")
    app_id = app.get("id") or app.get("_id")
    assert app_id, "App creation did not return an app id"

    frontend_url = env["frontend_url"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

        try:
            # 1. Login via localStorage.quxUser and wait for the dashboard.
            page.goto(f"{frontend_url}/#/")
            page.evaluate(
                f"""() => {{
                    localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    localStorage.setItem('quxLanguage', 'en');
                }}"""
            )
            page.reload()
            page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)

            # 2. Open the Studio editor.
            page.goto(f"{frontend_url}/#/apps/{app_id}/create.html")
            page.wait_for_selector(".MatcCanvas", timeout=40000)
            page.wait_for_timeout(2000)

            # Determine a point in the middle of the canvas.
            canvas = page.locator(".MatcCanvas")
            bbox = canvas.bounding_box()
            assert bbox, "Canvas not rendered"
            start_x = bbox["x"] + bbox["width"] / 2
            start_y = bbox["y"] + bbox["height"] / 2

            # 3. Press 'r' to add a box and drag on the canvas to place it.
            page.keyboard.press("r")
            page.wait_for_timeout(500)

            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(start_x + 100, start_y + 100)
            page.mouse.up()
            page.wait_for_timeout(2000)

            count = get_widget_count(app_id, token)
            print(f"Saved widgets count after box add: {count}")
            assert count == 1, f"Expected 1 widget after adding box, got {count}"

            # 4. Press 't' to add text and click on the canvas to place it.
            text_x = start_x
            text_y = start_y + 150
            page.keyboard.press("t")
            page.wait_for_timeout(500)
            page.mouse.click(text_x, text_y)
            page.wait_for_timeout(2000)

            count = get_widget_count(app_id, token)
            print(f"Saved widgets count after text add: {count}")
            assert count == 2, f"Expected 2 widgets after adding text, got {count}"

            # Stop any inline editing that may have started for the text widget.
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)

            # 5. Select the first widget (the box) and delete it.
            page.locator(".MatcWidgetDND").first.click()
            page.wait_for_timeout(500)
            page.keyboard.press("Delete")
            page.wait_for_timeout(2000)

            count = get_widget_count(app_id, token)
            print(f"Saved widgets count after delete: {count}")
            assert count == 1, f"Expected 1 widget after delete, got {count}"

            # 6. Assert no unexpected REST errors.
            rest_errors = collect_rest_errors(page)
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

            print(f"REST errors: {rest_errors}")
            print(f"Unexpected REST errors: {unexpected}")

            assert not unexpected, f"Unexpected REST errors: {unexpected}"
            print("PASS: Studio basic widget test completed successfully.")
        except Exception as e:
            page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug_widgets.png"))
            print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
            raise
        finally:
            context.close()
            browser.close()


def test_studio_widgets_basic(isolated_env):
    """Pytest entry point using the conftest isolated_env fixture."""
    _run_studio_widgets_basic(isolated_env)


if __name__ == "__main__":
    with IsolatedTestEnvironment() as env:
        test_studio_widgets_basic(env)
