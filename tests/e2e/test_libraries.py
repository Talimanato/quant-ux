#!/usr/bin/env python3
"""E2E test for Quant-UX Libraries.

Creates a library through the REST API, lists libraries, retrieves a library,
adds and removes a team member via API, and verifies that the Studio frontend
loads without unexpected REST errors.

Run directly:
    python3 tests/e2e/test_libraries.py

Or via pytest:
    python3 -m pytest tests/e2e/test_libraries.py -s
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

from conftest import IsolatedTestEnvironment, api_call, signup_user

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


def is_unexpected_error(error):
    """Ignore known external WebSocket endpoint errors."""
    url = error.get("url") or error.get("name", "")
    return "ws.quant-ux.com" not in url


def test_libraries():
    """End-to-end test for library API and minimal library UI coverage."""
    with IsolatedTestEnvironment() as env:
        owner_email = f"lib-{int(time.time())}@quant-ux.e2e"
        member_email = f"lib-member-{int(time.time())}@quant-ux.e2e"
        password = "e2e-pass-123"

        # 1. Sign up an owner and a team member.
        owner = signup_user(owner_email, password)
        assert "token" in owner, "Owner signup did not return a token"

        member = signup_user(member_email, password)
        assert "token" in member, "Member signup did not return a token"
        assert "id" in member, "Member signup did not return an id"

        print(f"Created owner {owner.get('id')} and member {member.get('id')}")

        # 2. Create a library via the API with a name and data payload.
        lib_name = "E2E Library"
        lib_data = {"widgets": [{"name": "E2E Button", "type": "Button"}]}
        lib = api_call(
            "POST",
            "/rest/libs",
            {"name": lib_name, "data": lib_data, "description": "E2E test library", "isPublic": False},
            token=owner["token"],
        )

        lib_id = lib.get("id") or lib.get("_id")
        assert lib_id, "Library creation did not return a library id"
        assert lib["name"] == lib_name, f"Library name mismatch: {lib.get('name')}"
        assert lib.get("widgets") == lib_data["widgets"], (
            f"Library data not persisted: {lib.get('widgets')}"
        )
        print(f"Created library {lib_id}")

        # 3. List libraries and ensure the new one is present.
        libs = api_call("GET", "/rest/libs", token=owner["token"])
        assert isinstance(libs, list), "Library list was not a list"
        assert any(l.get("id") == lib_id for l in libs), (
            f"Created library {lib_id} not found in list"
        )
        print(f"Library list contains {len(libs)} library/libraries")

        # 4. Retrieve the library detail and verify it matches.
        saved = api_call("GET", f"/rest/libs/{lib_id}.json", token=owner["token"])
        assert saved.get("id") == lib_id, "Library detail id mismatch"
        assert saved["name"] == lib_name, "Library detail name mismatch"
        assert saved.get("widgets") == lib_data["widgets"], (
            f"Library detail data mismatch: {saved.get('widgets')}"
        )
        print("Library detail retrieved successfully")

        # 5. Add the member to the library team via API.
        add_result = api_call(
            "POST",
            f"/rest/libs/{lib_id}/team",
            {"email": member_email, "permission": 1},
            token=owner["token"],
        )
        assert add_result.get("message") == "lib.team.add.success", (
            f"Add team member failed: {add_result}"
        )

        team = api_call("GET", f"/rest/libs/{lib_id}/team.json", token=owner["token"])
        assert any(
            t.get("email") == member_email and t.get("permission") == 1 for t in team
        ), f"Team member not found after add: {team}"
        print(f"Added team member {member_email} to library {lib_id}")

        # 6. Remove the member from the library team via API.
        remove_result = api_call(
            "DELETE",
            f"/rest/libs/{lib_id}/team/{member['id']}",
            token=owner["token"],
        )
        assert remove_result.get("message") == "lib.team.remove.success", (
            f"Remove team member failed: {remove_result}"
        )

        team_after = api_call(
            "GET", f"/rest/libs/{lib_id}/team.json", token=owner["token"]
        )
        assert not any(
            t.get("email") == member_email for t in team_after
        ), f"Team member still present after remove: {team_after}"
        print(f"Removed team member {member_email} from library {lib_id}")

        # 7. Minimal UI coverage: open the Studio and confirm it renders.
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 900})
            page = context.new_page()

            console_logs = []
            page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

            rest_errors = []

            def on_response(response):
                if "/rest/" in response.url and response.status >= 400:
                    rest_errors.append({"url": response.url, "status": response.status})

            page.on("response", on_response)

            try:
                # Seed the frontend session and wait for the Studio to render.
                page.goto(f"{env['frontend_url']}/#/")
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('quxUser', JSON.stringify({json.dumps(owner)}));
                    }}"""
                )
                page.reload()

                page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)
                print("Login confirmed: Studio welcome rendered.")

                # Give the page a moment to finish any background REST calls.
                page.wait_for_timeout(2000)

                # 8. Assert no unexpected REST errors.
                perf_errors = collect_rest_errors(page)
                all_errors = rest_errors + perf_errors
                unexpected = [e for e in all_errors if is_unexpected_error(e)]

                print(f"Owner: {owner_email}")
                print(f"Library: {lib_id}")
                print(f"REST errors: {all_errors}")
                print(f"Unexpected REST errors: {unexpected}")

                assert not unexpected, f"Unexpected REST errors: {unexpected}"

                print("PASS: Library E2E test completed successfully.")

            except Exception as e:
                print("TEST FAILED:", e)
                print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
                debug_path = ROOT / "tests" / "e2e" / "debug_libraries.png"
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
    test_libraries()
