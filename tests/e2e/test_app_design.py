#!/usr/bin/env python3
"""E2E test for the Quant-UX app Design tab."""

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import (
    IsolatedTestEnvironment,
    api_call,
    create_app_api,
    signup_user,
)

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


def close_any_dialogs(page):
    """Close any open dialog overlay that could block interactions.

    Handles the Vue ZoomDialog (used for notifications) and the Dojo-style
    Dialog (used for Team / Share popups). It first tries to click a visible
    Close or Cancel button, and falls back to removing the overlay nodes from
    the DOM when the dialog content covers the action target.
    """
    try:
        page.wait_for_selector(
            ".ZoomDialogBackground, .VommondDialogBackground", timeout=5000
        )
    except Exception:
        # No overlay present.
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

    # Fallback: remove the overlay nodes so they can no longer intercept clicks.
    page.evaluate(
        """() => {
            document.querySelectorAll(
                '.ZoomDialogBackground, .VommondDialogBackground'
            ).forEach(el => el.remove());
        }"""
    )
    page.wait_for_timeout(300)


def test_app_design():
    """End-to-end test for the Design tab: login, create app, edit metadata,
    open team and share dialogs, and assert no REST errors."""

    with IsolatedTestEnvironment() as env:
        email = f"design-{int(time.time())}@quant-ux.e2e"
        password = "design-pass-123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "E2E Design App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        print(f"Created user {user.get('id')} and app {app_id}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

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

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)
                print("Login confirmed: Studio welcome rendered.")

                # 2. Navigate to the Design tab.
                page.goto(f"{env['frontend_url']}/#/apps/{app_id}/design.html")
                page.wait_for_timeout(1500)

                # Wait for the design tab content to appear.
                page.wait_for_selector("text=Description", timeout=15000)
                page.wait_for_selector("text=Screens", timeout=15000)
                print("Design tab rendered.")

                # 3. Edit the app name.
                new_name = "E2E Design App Renamed"
                name_input = page.locator(".StudioOverviewHeader input")
                name_input.fill(new_name)
                page.keyboard.press("Tab")
                page.wait_for_timeout(1200)

                # Verify the name was persisted via the backend.
                saved_app = api_call(
                    "GET", f"/rest/apps/{app_id}.json", token=user["token"]
                )
                assert saved_app.get("name") == new_name, (
                    f"App name not updated. Expected {new_name!r}, got {saved_app.get('name')!r}"
                )
                print(f"App name updated to: {new_name}")

                # 4. Update description.
                new_description = "This is an E2E test description."
                desc_input = page.locator(".MatcAutoTextArea textarea")
                desc_input.fill(new_description)
                page.keyboard.press("Tab")
                page.wait_for_timeout(1200)

                # Verify the description was persisted via the backend.
                saved_app = api_call(
                    "GET", f"/rest/apps/{app_id}.json", token=user["token"]
                )
                assert saved_app.get("description") == new_description, (
                    f"App description not updated. Expected {new_description!r}, got {saved_app.get('description')!r}"
                )
                print(f"App description updated to: {new_description}")

                # Close the auto-opened notifications/updates dialog if it appears.
                # It is a ZoomDialog that blocks interaction with the rest of the page.
                close_any_dialogs(page)
                print("Closed any auto-opened notification dialog.")

                # 5. Open "Manage team" dialog (plus icon in the team widget).
                page.click(".MatcTeam .MatcUserAdd")
                page.wait_for_selector("text=Add Team Member", timeout=5000)
                print("Manage team dialog opened.")

                # Close the team dialog to keep the page clean.
                page.click("text=Cancel")
                page.wait_for_timeout(300)

                # 6. Open Share dialog.
                page.click(".MatcButtonIcon.MatcRoundButton")
                page.wait_for_selector("text=Share and Comment", timeout=5000)
                print("Share dialog opened.")

                # Close the share dialog.
                page.click("text=Close")
                page.wait_for_timeout(300)

                # 7. Assert no REST errors.
                rest_errors = collect_rest_errors(page)
                unexpected = [
                    e for e in rest_errors if "ws.quant-ux.com" not in e["name"]
                ]

                print(f"REST errors: {rest_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print(f"User: {email}")
                print(f"App: {app_id}")
                print("PASS: App design tab test completed successfully.")

            except Exception as e:
                print("TEST FAILED:", e)
                print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                debug_path = ROOT / "tests" / "e2e" / "debug_app_design.png"
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
    test_app_design()
