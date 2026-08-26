#!/usr/bin/env python3
"""E2E test for the Quant-UX app dashboard.

Creates an app through the dashboard UI, verifies it appears in the app
list, and checks that opening it navigates to the app overview.

Run directly:
    python3 tests/e2e/test_app_dashboard.py

Or via pytest:
    python3 -m pytest tests/e2e/test_app_dashboard.py
"""

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Allow running this file directly.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, signup_user


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


def test_app_dashboard():
    with IsolatedTestEnvironment() as env:
        frontend_url = env["frontend_url"]

        # Sign up a fresh user via the REST API.
        email = f"dashboard-{int(time.time())}@quant-ux.e2e"
        password = "e2e-test-pass-123"
        user = signup_user(email, password)
        assert "token" in user, "Signup did not return a token"

        app_name = f"E2E Dashboard App {int(time.time())}"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 800})

            rest_errors = []

            def on_response(response):
                if "/rest/" in response.url and response.status >= 400:
                    rest_errors.append(
                        {"url": response.url, "status": response.status}
                    )

            page.on("response", on_response)

            try:
                # 1. Login and go to #/.
                page.goto(f"{frontend_url}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                        localStorage.setItem('quxLanguage', 'en');
                    }}"""
                )
                page.reload()

                # Wait for the dashboard to render.
                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=20000)

                # 2. Click "Create" to open the create-app dialog.
                page.click(".MatcStudioNav .MatcButtonPrimary:has-text('Create')")

                # Wait for the dialog to be fully visible.
                page.wait_for_selector("text=Create a new prototype", timeout=10000)
                page.wait_for_selector(
                    ".ZoomDialogBackground.ZoomDialogAnimation", timeout=10000
                )
                page.wait_for_timeout(300)

                # Enter the app name.
                page.fill(
                    ".MatcDialog:has-text('Create a new prototype') input.form-control",
                    app_name,
                )

                # Optionally ensure a default screen size is selected.
                page.wait_for_selector(
                    ".MatcScreenSizeItem.MatcScreenSizeItemSelected",
                    timeout=10000,
                )

                # Create the app: target the "Create" button specifically and make
                # sure it is visible before clicking so a background overlay does
                # not intercept the click.
                create_button = ".MatcDialog .MatcButtonPrimary:has-text('Create')"
                page.wait_for_selector(create_button, timeout=10000)
                page.click(create_button)

                # Wait for navigation to the editor and capture the new app id.
                page.wait_for_url("**/#/apps/*/create.html", timeout=20000)
                page.wait_for_selector(".MatcCanvas", timeout=40000)

                created_url = page.url
                match = re.search(r"/apps/([^/]+)/create\.html", created_url)
                assert match, f"Could not parse app id from editor URL: {created_url}"
                app_id = match.group(1)

                # 3. Verify the app appears in the dashboard list.
                page.goto(f"{frontend_url}/#/")

                # The dashboard may auto-redirect to the most recent app; the
                # left-side app list is visible in both the dashboard and overview.
                list_link = page.locator(
                    f".MatcStudioAppList a[href*='{app_id}']"
                )
                list_link.wait_for(timeout=15000)
                assert list_link.is_visible(), (
                    f"App '{app_name}' ({app_id}) not visible in dashboard list"
                )
                assert app_name in list_link.inner_text(), (
                    f"Dashboard list link does not show app name: {list_link.inner_text()}"
                )

                # 4. Open the app and verify it navigates to the overview.
                list_link.click()
                page.wait_for_url(f"**/#/apps/{app_id}.html", timeout=15000)

                # The overview view should be rendered.
                page.wait_for_selector(".StudioOverview", timeout=15000)

                # Verify the URL hash contains the overview route.
                current_hash = page.evaluate("() => location.hash")
                expected_route = f"/apps/{app_id}.html"
                assert expected_route in current_hash, (
                    f"Expected route {expected_route} in hash, got {current_hash}"
                )

                # Make sure the app name is shown in the overview header.
                overview_name = page.locator(".StudioOverviewHeader input")
                overview_name.wait_for(timeout=10000)
                assert app_name in overview_name.input_value(), (
                    f"Overview did not show app name: {overview_name.input_value()}"
                )

                # Assert no REST errors.
                rest_errors.extend(collect_rest_errors(page))
                unexpected = [
                    e for e in rest_errors if "ws.quant-ux.com" not in e["url"]
                ]
                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: App dashboard test completed successfully.")
            finally:
                page.close()
                browser.close()


if __name__ == "__main__":
    test_app_dashboard()
