#!/usr/bin/env python3
"""E2E test for the app Settings tab in Quant-UX."""

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Allow running this file directly with `python3 tests/e2e/test_app_settings.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, create_app_api, signup_user


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


def test_app_settings():
    with IsolatedTestEnvironment() as env:
        email = f"settings-{int(time.time())}@quant-ux.e2e"
        password = "e2e-pass-123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "E2E Settings App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        print(f"Created user {user.get('id')} and app {app_id}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

            try:
                # Seed the frontend session via localStorage and reload so the
                # user is available when the Studio component loads.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)

                # Navigate to the app settings tab
                page.goto(f"{env['frontend_url']}/#/apps/{app_id}/settings.html")

                # Wait for the Settings tab to render
                page.wait_for_selector("text=Prototype Name", timeout=15000)
                page.wait_for_selector("text=Sharing", timeout=15000)

                # 2) Change the prototype name
                name_input = page.locator('.MatcSettings input[placeholder="Enter App name"]').first
                name_input.wait_for(state="visible")
                name_input.fill("E2E Renamed Settings App")

                # Wait for the update request to complete
                with page.expect_response(
                    re.compile(rf"/rest/apps/props/{app_id}\.json")
                ) as resp_info:
                    name_input.press("Tab")
                response = resp_info.value
                assert response.status == 200, f"Expected name update to succeed, got {response.status}"

                # Verify the name change via the backend
                saved_app = api_call("GET", f"/rest/apps/{app_id}.json", token=user["token"])
                assert saved_app["name"] == "E2E Renamed Settings App", (
                    f"App name not updated. Got: {saved_app.get('name')}"
                )

                # 3) Verify team and sharing section is visible and links are populated
                team_heading = page.locator('text=Team').first
                team_heading.scroll_into_view_if_needed()
                assert team_heading.is_visible(), "Team section is not visible"

                sharing_heading = page.locator('text=Sharing').first
                sharing_heading.scroll_into_view_if_needed()
                assert sharing_heading.is_visible(), "Sharing section is not visible"

                def get_sharing_input(label_text):
                    return (
                        page.locator(".MatcSettings .form-group")
                        .filter(has_text=label_text)
                        .locator("input")
                        .first
                    )

                test_input = get_sharing_input("Test")
                share_input = get_sharing_input("Share and Comment")
                code_input = get_sharing_input("Code Generation")

                test_url = test_input.input_value()
                share_url = share_input.input_value()
                code_hash = code_input.input_value()

                assert test_url and "#/test.html?h=" in test_url, (
                    f"Test sharing link missing or invalid: {test_url}"
                )
                assert share_url and "#/share.html?h=" in share_url, (
                    f"Share and Comment link missing or invalid: {share_url}"
                )
                assert code_hash and len(code_hash) > 8, (
                    f"Code generation hash missing or too short: {code_hash}"
                )

                # 4) Delete the prototype and verify redirect
                delete_button = page.get_by_text("Delete Prototype").first
                delete_button.scroll_into_view_if_needed()
                delete_button.click()

                dialog = page.locator(".MatcDeleteDialog").first
                dialog.wait_for(state="visible", timeout=5000)
                assert dialog.is_visible(), "Delete confirmation dialog not shown"

                # Click the actual delete button (not the dialog heading)
                confirm_delete = dialog.locator("a.MatcButton:has-text('Delete')").first
                confirm_delete.click()

                # Wait for the app delete request and the redirect
                page.wait_for_url(
                    re.compile(r"#/apps/my-apps\.html"),
                    wait_until="load",
                    timeout=20000,
                )

                # Verify the app is gone via the backend
                apps = api_call("GET", "/rest/apps", token=user["token"])
                assert not any(a.get("id") == app_id for a in apps), (
                    "App was not deleted from backend"
                )

                rest_errors = collect_rest_errors(page)
                # Ignore the known external WebSocket endpoint
                unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

                print(f"User: {email}")
                print(f"App: {app_id}")
                print(f"REST errors: {rest_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: App settings test completed successfully.")
            except Exception:
                page.screenshot(path=str(Path(__file__).resolve().parent / "debug.png"))
                print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                raise
            finally:
                context.close()
                browser.close()


if __name__ == "__main__":
    test_app_settings()
