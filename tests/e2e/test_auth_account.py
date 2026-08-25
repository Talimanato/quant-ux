#!/usr/bin/env python3
"""E2E coverage for auth and account flows.

The test runs against a fully isolated backend + production frontend. It creates
a fresh user with the ``signup_user`` helper, then logs that user in through the
UI, updates the name on ``#/my-account.html``, logs out, and verifies the
redirect. It also asserts that no ``/rest/`` requests return 4xx/5xx.
"""
import re
import sys
import time
import uuid
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_auth_account.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, signup_user
from playwright.sync_api import sync_playwright


def _trim_rest_url(url: str, base: str) -> str:
    """Return the path portion of a URL relative to the backend base."""
    if url.startswith(base):
        return url[len(base):]
    return url


def test_auth_account():
    with IsolatedTestEnvironment() as env:
        frontend_url = env["frontend_url"]
        backend_url = env["backend_url"]

        batch = str(int(time.time()))
        email = f"e2e-auth-{batch}-{uuid.uuid4().hex[:6]}@quant-ux.e2e"
        password = "password123"

        # 1. Sign up a new user via the backend API helper.
        user = signup_user(email, password)
        assert "token" in user, "signup_user did not return a token"
        user_id = user.get("id") or user.get("_id")
        assert user_id, "signup_user did not return a user id"
        print(f"[1] Signed up user {user_id} <{email}>")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()

            rest_errors = []

            def on_response(response):
                if "/rest/" in response.url and response.status >= 400:
                    rest_errors.append(
                        {
                            "url": _trim_rest_url(response.url, backend_url),
                            "status": response.status,
                        }
                    )

            page.on("response", on_response)

            try:
                # 2. Log in with the user through the actual login form.
                page.goto(f"{frontend_url}/#/")
                page.wait_for_selector(".MatcLoginPage", timeout=15000)

                # Make sure the login panel is active.
                page.locator(".MatcToolbarTabs a", has_text="Login").click()

                login_panel = page.locator(".MatcLoginWrapper.login")
                login_panel.locator(".MatcLoginContent:nth-of-type(1) input[type='text']").fill(email)
                login_panel.locator(".MatcLoginContent:nth-of-type(1) input[type='password']").fill(password)
                login_panel.locator(".MatcLoginContent:nth-of-type(1) a.MatcButton:has-text('Login')").click()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=20000)
                print("[2] Logged in through the UI")

                # 3. Open #/my-account.html and update the name.
                page.goto(f"{frontend_url}/#/my-account.html")
                page.wait_for_selector("text=My Account", timeout=15000)

                new_name = f"E2E-{uuid.uuid4().hex[:6]}"
                page.locator("input[placeholder='Enter your name']").fill(new_name)

                def is_save_response(response):
                    return (
                        response.request.method == "POST"
                        and re.search(r"/rest/user/[^/]+\.json$", response.url) is not None
                    )

                with page.expect_response(is_save_response, timeout=15000) as response_info:
                    page.locator(".MatcContent a.MatcButton:has-text('Save')").click()

                save_response = response_info.value
                assert save_response.status == 200, (
                    f"Save request failed: {save_response.status} {save_response.url}"
                )
                saved_user = save_response.json()
                assert saved_user.get("name") == new_name, (
                    f"Unexpected name in save response: {saved_user.get('name')}"
                )

                # Double-check with the backend directly.
                updated = api_call("GET", f"/rest/user/{user_id}.json", token=user["token"])
                assert updated.get("name") == new_name, (
                    f"Backend name did not update: {updated.get('name')}"
                )
                print(f"[3] Updated name to '{new_name}'")

                # 4. Log out and verify the redirect.
                page.locator("a[href='#/logout.html']").click()
                page.wait_for_selector(".MatcLoginPage", timeout=20000)

                current_url = page.url
                print(f"[4] After logout URL: {current_url}")
                assert current_url.startswith(frontend_url), (
                    f"Unexpected host after logout: {current_url}"
                )
                assert "/logout" not in current_url and "/my-account" not in current_url, (
                    f"Still on an auth page after logout: {current_url}"
                )

                # Assert no unexpected REST errors throughout the session.
                print(f"REST errors: {rest_errors}")
                assert not rest_errors, f"Unexpected REST errors: {rest_errors}"

                print("PASS: Auth / account E2E test completed successfully.")
            finally:
                context.close()
                browser.close()


if __name__ == "__main__":
    test_auth_account()
