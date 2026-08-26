#!/usr/bin/env python3
"""E2E coverage for advanced Studio widget operations (group/ungroup).

This test runs an isolated backend + production frontend, logs in via
localStorage.quxUser, opens the editor, adds two boxes, groups them with
Ctrl+G, verifies the persisted group via the REST API, optionally ungroups
with Ctrl+G again, and asserts no REST errors.
"""
import json
import sys
import time
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_studio_widgets_advanced.py`.
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


def get_counts(app_id, token):
    """Fetch the app from the backend and count persisted widgets/groups."""
    saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=token)
    return {
        "widgets": len(saved_app.get("widgets", {})),
        "groups": len(saved_app.get("groups", {})),
    }


def _run_studio_widgets_advanced(env):
    """Core test logic using the supplied isolated environment dict."""
    email = f"e2e-adv-{int(time.time())}@test.com"
    password = "password123"

    user = signup_user(email, password)
    assert "token" in user, "Signup did not return a token"
    token = user["token"]

    app = create_app_api(user, "E2E Advanced Widgets")
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
            cx = bbox["x"] + bbox["width"] / 2
            cy = bbox["y"] + bbox["height"] / 2

            # 3. Add the first box with the 'r' shortcut and drag.
            page.keyboard.press("r")
            page.wait_for_timeout(500)

            page.mouse.move(cx - 250, cy - 50)
            page.mouse.down()
            page.mouse.move(cx - 150, cy + 50)
            page.mouse.up()
            page.wait_for_timeout(2000)

            counts = get_counts(app_id, token)
            print(f"After 1st box: {counts}")
            assert counts["widgets"] == 1, f"Expected 1 widget, got {counts}"
            assert counts["groups"] == 0, f"Expected 0 groups, got {counts}"

            # 4. Add a second box with the 'r' shortcut and drag.
            page.keyboard.press("r")
            page.wait_for_timeout(500)

            page.mouse.move(cx + 50, cy - 50)
            page.mouse.down()
            page.mouse.move(cx + 150, cy + 50)
            page.mouse.up()
            page.wait_for_timeout(2000)

            counts = get_counts(app_id, token)
            print(f"After 2nd box: {counts}")
            assert counts["widgets"] == 2, f"Expected 2 widgets, got {counts}"
            assert counts["groups"] == 0, f"Expected 0 groups, got {counts}"

            # The second widget is currently selected. Shift-click the first
            # widget to multi-select both.
            first_widget = page.locator(".MatcWidgetDND").nth(0)
            first_widget.click(modifiers=["Shift"])
            page.wait_for_timeout(500)

            # 5. Group the selected widgets with Ctrl+G.
            page.keyboard.press("Control+g")
            page.wait_for_timeout(2500)

            counts = get_counts(app_id, token)
            print(f"After group: {counts}")
            assert counts["widgets"] == 2, f"Expected 2 widgets after group, got {counts}"
            assert counts["groups"] == 1, f"Expected 1 group, got {counts}"

            # 6. Optionally ungroup with Ctrl+G and verify.
            page.keyboard.press("Control+g")
            page.wait_for_timeout(2500)

            counts = get_counts(app_id, token)
            print(f"After ungroup: {counts}")
            assert counts["widgets"] == 2, f"Expected 2 widgets after ungroup, got {counts}"
            assert counts["groups"] == 0, f"Expected 0 groups after ungroup, got {counts}"

            # 7. Assert no unexpected REST errors.
            rest_errors = collect_rest_errors(page)
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

            print(f"REST errors: {rest_errors}")
            print(f"Unexpected REST errors: {unexpected}")

            assert not unexpected, f"Unexpected REST errors: {unexpected}"
            print("PASS: Studio advanced widget test completed successfully.")
        except Exception as e:
            page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug_widgets_advanced.png"))
            print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
            raise
        finally:
            context.close()
            browser.close()


def test_studio_widgets_advanced(isolated_env):
    """Pytest entry point using the conftest isolated_env fixture."""
    _run_studio_widgets_advanced(isolated_env)


if __name__ == "__main__":
    with IsolatedTestEnvironment() as env:
        test_studio_widgets_advanced(env)
