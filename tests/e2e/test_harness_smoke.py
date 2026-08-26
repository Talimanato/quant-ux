#!/usr/bin/env python3
"""Smoke test for the parallel Playwright E2E harness.

This test can be run either via pytest or directly as a script:

    python3 tests/e2e/test_harness_smoke.py
"""
import json
import sys
import time
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_harness_smoke.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, create_app_api, signup_user


def test_harness_smoke():
    from playwright.sync_api import sync_playwright

    with IsolatedTestEnvironment() as env:
        email = f"smoke-{int(time.time())}@quant-ux.e2e"
        password = "smoke-pass-123"

        user = signup_user(email, password)
        assert "token" in user, "User signup did not return a token"

        app = create_app_api(user, "Harness Smoke App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, "App creation did not return an app id"

        print(f"Created user {user.get('id')} and app {app_id}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 800})

            try:
                # Seed the frontend session via localStorage and reload so the
                # user is available when the Studio component loads.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                        localStorage.setItem('quxLanguage', 'en');
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)
                print("PASS: Welcome message rendered.")
            finally:
                page.close()
                browser.close()


if __name__ == "__main__":
    test_harness_smoke()
