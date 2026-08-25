#!/usr/bin/env python3
"""E2E coverage for public sharing and comments.

This test creates an app with one screen and one label widget, fetches the
auto-generated share invitations, opens the public share page
(#/share.html?h=<hash>) WITHOUT being logged in and verifies:

* the prototype renders the screen and widget,
* a screen comment can be posted through the hash based comment endpoint,
* the comment shows up when queried again,
* the share page reports no unexpected REST errors.

Run directly:

    python3 tests/e2e/test_share_comments.py

or via pytest:

    python3 -m pytest tests/e2e/test_share_comments.py
"""
import json
import sys
import time
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_share_comments.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, signup_user, create_app_api
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

SCREEN_ID = "s1"
WIDGET_ID = "w1"


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


def build_model_changes():
    """applyChanges payload: one start screen with one label widget."""
    screen = {
        "id": SCREEN_ID,
        "name": "Landing",
        "x": 0,
        "y": 0,
        "w": 375,
        "h": 812,
        "z": 0,
        "min": {"h": 812, "w": 375},
        "props": {"start": True},
        "style": {},
        "has": {"image": True},
        "children": [WIDGET_ID],
        "type": "screen",
    }
    widget = {
        "id": WIDGET_ID,
        "name": "Headline",
        "type": "Label",
        "x": 40,
        "y": 100,
        "w": 280,
        "h": 40,
        "z": 1,
        "props": {"label": "Shared Prototype"},
        "style": {"fontSize": 20, "textAlign": "center"},
        "hints": {},
    }
    return [
        {"type": "update", "parent": "screens", "name": SCREEN_ID, "object": screen},
        {"type": "update", "parent": "widgets", "name": WIDGET_ID, "object": widget},
    ]


def _run_share_comments(env):
    email = f"e2e-share-{int(time.time())}@test.com"
    password = "password123"

    user = signup_user(email, password)
    assert "token" in user, "Signup did not return a token"
    token = user["token"]

    app = create_app_api(user, "E2E Share App")
    app_id = app.get("id") or app.get("_id")
    assert app_id, "App creation did not return an app id"

    # 1. Seed the model (screen + label).
    api_call("POST", f"/rest/apps/{app_id}/update", build_model_changes(), token=token)
    saved = api_call("GET", f"/rest/apps/{app_id}.json", token=token)
    assert SCREEN_ID in saved.get("screens", {}), "Screen not persisted"

    # 2. Every app gets test/read/write invitations on creation.
    invitations = api_call("GET", f"/rest/invitation/{app_id}.json", token=token)
    assert invitations, "No invitations returned"
    # Response format: {hash: permission}
    test_hashes = [h for h, perm in invitations.items() if perm == 1]
    share_hash = test_hashes[0] if test_hashes else next(iter(invitations.keys()))
    assert share_hash, "Could not determine a share hash"

    frontend_url = env["frontend_url"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

        try:
            # 3. Open the public share page with the invitation hash.
            #    No quxUser in localStorage: the page must work anonymously.
            page.goto(f"{frontend_url}/#/share.html?h={share_hash}")
            page.wait_for_selector(".MatcCanvas", timeout=20000)
            page.wait_for_timeout(1500)

            screens = page.locator(".MatcScreen")
            assert screens.count() > 0, "Screen not rendered on share page"
            assert page.get_by_text("Shared Prototype").first.is_visible(), (
                "Widget not rendered on share page"
            )
            print("Share page rendered screen and widget.")

            # 4. Post a screen comment through the hash based endpoint
            #    (this is what the share page comment mode uses).
            comment = {
                "session": f"e2e_{int(time.time())}",
                "type": "ScreenComment",
                "reference": SCREEN_ID,
                "screen": SCREEN_ID,
                "text": "E2E feedback comment",
                "user": {"name": "e2e", "id": "e2e"},
            }
            created = api_call(
                "POST",
                f"/rest/comments/hash/{share_hash}/{app_id}",
                comment,
            )
            assert created.get("id"), f"Comment was not created: {created}"

            # 5. Read the comments back through the hash based endpoint.
            fetched = api_call(
                "GET",
                f"/rest/comments/hash/{share_hash}/{app_id}/ScreenComment.json",
            )
            texts = [c.get("text") for c in fetched]
            assert "E2E feedback comment" in texts, f"Comment not found in {texts}"

            # Also verify the authenticated endpoint sees it.
            authed = api_call(
                "GET", f"/rest/comments/apps/{app_id}.json", token=token
            )
            assert any(c.get("text") == "E2E feedback comment" for c in authed)

            # 6. Assert no unexpected REST errors on the share page.
            rest_errors = collect_rest_errors(page)
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]
            print(f"REST errors: {rest_errors}")
            assert not unexpected, f"Unexpected REST errors: {unexpected}"

            print("PASS: Share + comments test completed successfully.")
        except Exception as e:
            page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug_share_comments.png"))
            print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
            raise
        finally:
            context.close()
            browser.close()


def test_share_comments(isolated_env):
    """Pytest entry point using the conftest isolated_env fixture."""
    _run_share_comments(isolated_env)


if __name__ == "__main__":
    with IsolatedTestEnvironment() as env:
        test_share_comments(env)
