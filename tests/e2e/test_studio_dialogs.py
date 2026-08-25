#!/usr/bin/env python3
"""E2E test for Studio HomeMenu Settings, Import and Export dialogs."""

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Allow running this file directly with `python3 tests/e2e/test_studio_dialogs.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, create_app_api, signup_user

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


def close_open_dialogs(page):
    """Dismiss any open Vommond dialogs or dropdowns."""
    for _ in range(10):
        bgs = page.locator(".VommondDialogBackground").all()
        visible = [b for b in bgs if b.is_visible()]
        if not visible:
            # Also collapse any open HomeMenu dropdown.
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            break

        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    else:
        # Fallback: try to click a Cancel/Close button inside the first dialog.
        for bg in page.locator(".VommondDialogBackground").all():
            try:
                if not bg.is_visible():
                    continue
                btn = bg.locator("a:has-text('Cancel'), a:has-text('Close')").first
                if btn.is_visible():
                    btn.click()
                    page.wait_for_timeout(500)
                    break
            except Exception:
                pass


def open_home_menu(page):
    """Click the toolbar home menu and wait for its popup."""
    page.click(".MatcToobarHomeSection", timeout=10000)
    page.wait_for_selector(".MatcToolbarPopUpOpen", state="visible", timeout=10000)


def click_menu_item(page, label):
    """Open the home menu and click an item by its visible text."""
    open_home_menu(page)
    page.get_by_text(label, exact=True).first.click()
    page.wait_for_timeout(300)


def wait_for_text(parent, text, timeout=10000):
    """Wait for the first visible element containing `text` within `parent`."""
    loc = parent.get_by_text(text).first
    loc.wait_for(state="visible", timeout=timeout)
    return loc


def test_studio_dialogs():
    """Open each HomeMenu dialog and verify it renders with no REST errors."""
    with IsolatedTestEnvironment() as env:
        email = f"dialogs-{int(time.time())}@quant-ux.e2e"
        password = "password123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "E2E Studio Dialogs App")
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
                # user object is available before the Studio component loads.
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
                page.wait_for_selector(".MatcToobarHomeSection", timeout=10000)

                # Dismiss any auto-opened dialogs (e.g. reminders or help).
                close_open_dialogs(page)

                # 1) HomeMenu > Settings
                click_menu_item(page, "Light & Dark Mode")
                page.locator(".VommondDialogBackground .MatcDialogM").first.wait_for(
                    state="visible", timeout=10000
                )
                settings_dialog = page.locator(".MatcDialogM").first
                wait_for_text(settings_dialog, "Theme")
                wait_for_text(settings_dialog, "Light")
                wait_for_text(settings_dialog, "Dark")
                close_open_dialogs(page)

                # 2) HomeMenu > Import
                click_menu_item(page, "Import")
                page.locator(".VommondDialogBackground .MatchImportDialog").first.wait_for(
                    state="visible", timeout=10000
                )
                import_dialog = page.locator(".MatchImportDialog").first
                wait_for_text(import_dialog, "Images")
                wait_for_text(import_dialog, "Figma")
                wait_for_text(import_dialog, "Zip")
                # Make sure the Export dialog did not open.
                assert page.locator(".MatchExportDialog").count() == 0, (
                    "Export dialog opened instead of Import dialog"
                )
                close_open_dialogs(page)

                # 3) HomeMenu > Export
                click_menu_item(page, "Export")
                page.locator(".VommondDialogBackground .MatchExportDialog").first.wait_for(
                    state="visible", timeout=10000
                )
                export_dialog = page.locator(".MatchExportDialog").first
                wait_for_text(export_dialog, "Images")
                wait_for_text(export_dialog, "Close")
                close_open_dialogs(page)

                # Confirm no unexpected REST errors were produced.
                rest_errors = collect_rest_errors(page)
                unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

                print(f"User: {email}")
                print(f"App: {app_id}")
                print(f"REST errors: {rest_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: Studio dialogs test completed successfully.")

            except Exception:
                screenshot = ROOT / "tests" / "e2e" / "debug_studio_dialogs.png"
                try:
                    page.screenshot(path=str(screenshot))
                    print(f"Screenshot saved to: {screenshot}")
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
    test_studio_dialogs()
