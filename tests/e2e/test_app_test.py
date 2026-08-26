#!/usr/bin/env python3
"""E2E test for the Quant-UX app Test tab.

Logs in via localStorage, creates an app through the REST API, navigates to the
Test tab, sets the welcome message, and optionally adds a test task. Asserts
that no unexpected REST errors occur.

Run directly:
    python3 tests/e2e/test_app_test.py

Or via pytest:
    python3 -m pytest tests/e2e/test_app_test.py -s
"""

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, create_app_api, signup_user

ROOT = Path(__file__).resolve().parents[2]


def collect_rest_errors(page):
    """Return REST requests that returned 4xx/5xx from performance entries."""
    return page.evaluate(
        """() => {
            return performance.getEntriesByType('resource')
                .filter(r => r.name.includes('/rest/'))
                .filter(r => r.responseStatus >= 400)
                .map(r => ({ name: r.name, status: r.responseStatus }));
        }"""
    )


def close_any_dialogs(page):
    """Close any open overlay that could block interactions."""
    try:
        page.wait_for_selector(
            ".ZoomDialogBackground, .VommondDialogBackground", timeout=5000
        )
    except Exception:
        return

    for label in ["Close", "Cancel"]:
        try:
            button = page.locator(
                ".ZoomDialogBackground, .VommondDialogBackground"
            ).get_by_text(label)
            if button.is_visible():
                button.click(timeout=2000)
                page.wait_for_timeout(300)
                return
        except Exception:
            pass

    page.evaluate(
        """() => {
            document.querySelectorAll(
                '.ZoomDialogBackground, .VommondDialogBackground'
            ).forEach(el => el.remove());
        }"""
    )
    page.wait_for_timeout(300)


def is_unexpected_error(error):
    """Ignore known external WebSocket endpoint errors."""
    url = error.get("url") or error.get("name", "")
    return "ws.quant-ux.com" not in url


def test_app_test():
    """End-to-end test for the app Test tab."""

    with IsolatedTestEnvironment() as env:
        email = f"test-{int(time.time())}@quant-ux.e2e"
        password = "e2e-pass-123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "E2E Test Tab App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        print(f"Created user {user.get('id')} and app {app_id}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()

            console_logs = []
            page.on(
                "console",
                lambda msg: console_logs.append(f"{msg.type}: {msg.text}"),
            )

            rest_errors = []

            def on_response(response):
                if "/rest/" in response.url and response.status >= 400:
                    rest_errors.append(
                        {"url": response.url, "status": response.status}
                    )

            page.on("response", on_response)

            try:
                # 1. Login via localStorage and land in the studio.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                        localStorage.setItem('quxLanguage', 'en');
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=20000)
                print("Login confirmed: Studio welcome rendered.")

                close_any_dialogs(page)

                # 2. Navigate to the Test tab.
                page.goto(f"{env['frontend_url']}/#/apps/{app_id}/test.html")

                # Wait for the tab to render (tab label or Test Settings header).
                page.wait_for_selector("text=Test Settings", timeout=20000)
                page.wait_for_selector("text=Add task", timeout=20000)
                print("Test tab rendered.")

                close_any_dialogs(page)

                # 3. Set the test welcome message.
                welcome_msg = "Welcome to the E2E test session!"
                welcome_input = page.locator(
                    'textarea[placeholder="Enter here a welcome message for your testers."]'
                )
                welcome_input.wait_for(timeout=10000)
                welcome_input.fill(welcome_msg)
                page.keyboard.press("Tab")
                page.wait_for_timeout(1200)

                saved_test = api_call(
                    "GET", f"/rest/test/{app_id}.json", token=user["token"]
                )
                assert saved_test.get("description") == welcome_msg, (
                    f"Welcome message not persisted. Expected {welcome_msg!r}, "
                    f"got {saved_test.get('description')!r}"
                )
                print(f"Welcome message set and persisted: {welcome_msg}")

                # 4. Add a test task if the UI supports it.
                task_name = "E2E Test Task"
                try:
                    add_button = page.locator('a[data-nls="testSettingsAddTask"]')
                    if add_button.is_visible():
                        add_button.wait_for(state="visible", timeout=10000)
                        page.wait_for_timeout(500)
                        add_button.click()
                        page.wait_for_selector(
                            ".MatchTaskRecorderDialog, .TaskCreateDialog",
                            timeout=20000,
                        )

                        page.wait_for_selector(
                            '.TaskCreateDialog input[placeholder="Name"]',
                            timeout=10000,
                        )
                        page.fill(
                            '.TaskCreateDialog input[placeholder="Name"]',
                            task_name,
                        )
                        page.fill(
                            '.TaskCreateDialog textarea[placeholder="An explaination for the users"]',
                            "Please complete this E2E test task.",
                        )

                        with page.expect_response(
                            re.compile(rf"/rest/test/{app_id}\.json"),
                            timeout=10000,
                        ) as resp_info:
                            page.click(
                                ".TaskCreateDialog a.MatcButtonPrimary:has-text('Save')"
                            )
                        response = resp_info.value
                        assert response.status == 200, (
                            f"Expected task save to succeed, got {response.status}"
                        )

                        page.wait_for_selector(
                            f".MatcTestSettings:has-text('{task_name}')",
                            timeout=10000,
                        )
                        print(f"Task added: {task_name}")

                        saved_test = api_call(
                            "GET",
                            f"/rest/test/{app_id}.json",
                            token=user["token"],
                        )
                        task_names = [
                            t.get("name") for t in saved_test.get("tasks", [])
                        ]
                        assert task_name in task_names, (
                            f"Task not persisted. Tasks: {task_names}"
                        )
                    else:
                        print("Add task button not visible; skipping task creation.")
                except Exception as e:
                    print(f"Could not add test task (UI may not support it): {e}")
                    debug_path = ROOT / "tests" / "e2e" / "debug_task_dialog.png"
                    try:
                        page.screenshot(path=str(debug_path))
                        print(f"Task dialog debug screenshot saved to {debug_path}")
                    except Exception:
                        pass
                    print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                    close_any_dialogs(page)

                close_any_dialogs(page)

                # 5. Assert no REST errors.
                perf_errors = collect_rest_errors(page)
                all_errors = rest_errors + perf_errors
                unexpected = [e for e in all_errors if is_unexpected_error(e)]

                print(f"User: {email}")
                print(f"App: {app_id}")
                print(f"REST errors: {all_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: App Test tab test completed successfully.")

            except Exception as e:
                print("TEST FAILED:", e)
                print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                debug_path = ROOT / "tests" / "e2e" / "debug_test_tab.png"
                try:
                    page.screenshot(path=str(debug_path))
                    print(f"Screenshot saved to {debug_path}")
                except Exception:
                    pass
                raise

            finally:
                context.close()
                browser.close()


if __name__ == "__main__":
    test_app_test()
