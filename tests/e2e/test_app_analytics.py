#!/usr/bin/env python3
"""E2E test for the Quant-UX app Analytics tab.

Creates an app, navigates to the analytics tab, verifies it renders,
optionally clicks the Results chart tab, and checks for REST errors.

Run directly:
    python3 tests/e2e/test_app_analytics.py

Or via pytest:
    python3 -m pytest tests/e2e/test_app_analytics.py
"""

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# Allow running this file directly.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, create_app_api, signup_user


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
    """Close any open dialog overlay that could block interactions.

    Tries Close/Cancel buttons and falls back to removing the overlay nodes.
    """
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

    # Fallback: remove the overlay nodes so they can no longer intercept clicks.
    page.evaluate(
        """() => {
            document.querySelectorAll(
                '.ZoomDialogBackground, .VommondDialogBackground'
            ).forEach(el => el.remove());
        }"""
    )
    page.wait_for_timeout(300)


def test_app_analytics():
    with IsolatedTestEnvironment() as env:
        email = f"analytics-{int(time.time())}@quant-ux.e2e"
        password = "e2e-pass-123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "E2E Analytics App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        print(f"Created user {user.get('id')} and app {app_id}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()

            console_logs = []
            page_errors = []
            page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            rest_errors = []
            all_4xx_5xx = []

            def on_response(response):
                if response.status >= 400:
                    all_4xx_5xx.append({"url": response.url, "status": response.status})
                    if "/rest/" in response.url:
                        rest_errors.append({"url": response.url, "status": response.status})

            page.on("response", on_response)

            try:
                # 1. Login via localStorage and reload so the session is active.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)
                print("Login confirmed: Studio welcome rendered.")

                # 2. Navigate directly to the Analytics tab.
                page.goto(f"{env['frontend_url']}/#/apps/{app_id}/analyze.html")
                page.wait_for_timeout(1500)

                # 3. Wait for the Analytics tab to render.
                # The distribution section title contains "Distribution".
                page.wait_for_selector("text=Data Distribution", timeout=15000)
                page.wait_for_selector("text=Task Results", timeout=15000)
                print("Analytics tab rendered.")

                # Close the auto-opened notification dialog so it does not block
                # interactions with the tab bar.
                close_any_dialogs(page)

                # 4. If possible, click the Results chart tab and verify content.
                results_tab = page.locator(".MatcTabs a[href*='analyze.html']")
                if results_tab.count() > 0 and results_tab.first.is_visible():
                    results_tab.first.click()
                    page.wait_for_timeout(500)
                    # Verify the distribution content is still present.
                    assert page.locator("text=Data Distribution").first.is_visible(), (
                        "Results chart tab did not keep the Analytics content visible"
                    )
                    print("Results chart tab clicked and content verified.")
                else:
                    print("Results chart tab not found; skipping tab click.")

                # 5. Verify there are no 4xx/5xx REST errors.
                rest_errors.extend(collect_rest_errors(page))
                unexpected = [
                    e for e in rest_errors if "ws.quant-ux.com" not in e.get("name", "")
                    and "ws.quant-ux.com" not in e.get("url", "")
                ]

                console_errors = [l for l in console_logs if l.startswith("error:") or l.startswith("warning:")]

                print(f"User: {email}")
                print(f"App: {app_id}")
                print(f"Page errors: {page_errors}")
                print(f"Console errors/warnings: {console_errors}")
                print(f"All 4xx/5xx responses: {all_4xx_5xx}")
                print(f"REST errors: {rest_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: App analytics tab test completed successfully.")

            except Exception as e:
                print("TEST FAILED:", e)
                print("PAGE ERRORS:", "\n".join(page_errors[-20:]))
                print("ALL 4XX/5XX RESPONSES:", all_4xx_5xx)
                print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                try:
                    page.screenshot(path=str(Path(__file__).resolve().parent / "debug_app_analytics.png"))
                except Exception:
                    pass
                raise

            finally:
                context.close()
                browser.close()


if __name__ == "__main__":
    test_app_analytics()
