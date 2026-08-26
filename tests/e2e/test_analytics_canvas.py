#!/usr/bin/env python3
"""E2E coverage for the analytics canvas (workspace).

This test creates an app with one screen and one button, seeds recorded
sessions (SessionStart / ScreenLoaded / WidgetClick events) through the
REST API and opens the analytic workspace
(#/apps/<id>/analyze/workspace.html). It verifies that the analytic
canvas renders, the session list shows the recorded sessions, heatmap
overlays are drawn and no unexpected REST errors occur.

Run directly:

    python3 tests/e2e/test_analytics_canvas.py

or via pytest:

    python3 -m pytest tests/e2e/test_analytics_canvas.py
"""
import json
import sys
import time
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_analytics_canvas.py`.
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
    """applyChanges payload: one start screen with one button widget."""
    screen = {
        "id": SCREEN_ID,
        "name": "Home",
        "x": 0,
        "y": 0,
        "w": 375,
        "h": 812,
        "z": 0,
        "min": {"h": 812, "w": 375},
        "props": {"start": True, "background": {"h": 255, "s": 0, "l": 1}},
        "style": {},
        "has": {"image": True},
        "children": [WIDGET_ID],
        "type": "screen",
    }
    widget = {
        "id": WIDGET_ID,
        "name": "Button",
        "type": "Button",
        "x": 100,
        "y": 200,
        "w": 120,
        "h": 40,
        "z": 1,
        "props": {"label": "ClickMe", "padding": 4},
        "style": {
            "background": {"h": 210, "s": 0.7, "l": 0.5},
            "color": {"r": 255, "g": 255, "b": 255},
            "fontSize": 14,
        },
        "hints": {},
    }
    return [
        {"type": "update", "parent": "screens", "name": SCREEN_ID, "object": screen},
        {"type": "update", "parent": "widgets", "name": WIDGET_ID, "object": widget},
    ]


def seed_events(app_id, token, sessions=2):
    """Insert fake but realistically shaped test events via the REST API."""
    now = int(time.time() * 1000)
    events = []
    for i in range(sessions):
        session = f"S_e2e_{int(time.time())}_{i}"
        events.append({
            "session": session,
            "user": {"id": f"U_e2e_{i}", "name": f"tester{i}"},
            "screen": SCREEN_ID,
            "widget": None,
            "type": "SessionStart",
            "time": now + i * 1000,
            "x": 0,
            "y": 0,
        })
        events.append({
            "session": session,
            "user": {"id": f"U_e2e_{i}", "name": f"tester{i}"},
            "screen": SCREEN_ID,
            "widget": None,
            "type": "ScreenLoaded",
            "time": now + i * 1000 + 200,
            "x": 0,
            "y": 0,
        })
        for j in range(5):
            events.append({
                "session": session,
                "user": {"id": f"U_e2e_{i}", "name": f"tester{i}"},
                "screen": SCREEN_ID,
                "widget": WIDGET_ID,
                "type": "WidgetClick",
                "time": now + i * 1000 + 500 + j * 100,
                "x": 0.5,
                "y": 0.3 + j * 0.02,
            })
    return api_call("POST", f"/rest/events/{app_id}.json", events, token=token)


def _run_analytics_canvas(env):
    email = f"e2e-analytics-canvas-{int(time.time())}@test.com"
    password = "password123"

    user = signup_user(email, password)
    assert "token" in user, "Signup did not return a token"
    token = user["token"]

    app = create_app_api(user, "E2E Analytics Canvas App")
    app_id = app.get("id") or app.get("_id")
    assert app_id, "App creation did not return an app id"

    # 1. Seed the model (screen + button) and the recorded sessions.
    api_call("POST", f"/rest/apps/{app_id}/update", build_model_changes(), token=token)
    seed_events(app_id, token, sessions=2)

    saved = api_call("GET", f"/rest/apps/{app_id}.json", token=token)
    assert SCREEN_ID in saved.get("screens", {}), "Screen not persisted"
    events = api_call("GET", f"/rest/events/{app_id}.json", token=token)
    assert len(events) >= 12, f"Expected seeded events, got {len(events)}"

    frontend_url = env["frontend_url"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

        try:
            # 2. Login and open the analytic workspace.
            page.goto(f"{frontend_url}/#/")
            page.evaluate(
                f"""() => {{
                    localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    localStorage.setItem('quxLanguage', 'en');
                }}"""
            )
            page.goto(f"{frontend_url}/#/apps/{app_id}/analyze/workspace.html")
            page.reload()
            page.wait_for_selector(".MatcCanvas", timeout=20000)
            page.wait_for_timeout(2000)

            # 3. The analytic toolbar with the session list must render.
            page.wait_for_selector(".MatcAnalyticsToolbar", timeout=10000)
            session_list = page.locator(".MatcToolbarAnalyticList")
            expect_count = session_list.count()
            print(f"Analytic session list count: {expect_count}")
            assert expect_count > 0, "Analytic session list not rendered"

            # 4. The screen must be rendered on the analytic canvas and a
            #    heatmap overlay canvas must be drawn on top of it.
            screens = page.locator(".MatcScreen")
            assert screens.count() > 0, "Screen not rendered in analytic canvas"
            overlay = page.locator(".MatcCanvasLayer canvas")
            print(f"Heatmap overlay canvases: {overlay.count()}")
            assert overlay.count() > 0, "No heatmap overlay canvas rendered"

            # 5. Switch through the heatmap view modes via the toolbar.
            heatmap_btn = page.locator(
                ".MatcAnalyticsToolbar .MatcToolbarItem"
            ).first
            if heatmap_btn.is_visible():
                heatmap_btn.click()
                page.wait_for_timeout(800)
            page.wait_for_timeout(500)

            # 6. Assert no unexpected REST errors.
            rest_errors = collect_rest_errors(page)
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]
            print(f"REST errors: {rest_errors}")
            assert not unexpected, f"Unexpected REST errors: {unexpected}"

            print("PASS: Analytics canvas test completed successfully.")
        except Exception as e:
            page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug_analytics_canvas.png"))
            print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
            raise
        finally:
            context.close()
            browser.close()


def test_analytics_canvas(isolated_env):
    """Pytest entry point using the conftest isolated_env fixture."""
    _run_analytics_canvas(isolated_env)


if __name__ == "__main__":
    with IsolatedTestEnvironment() as env:
        test_analytics_canvas(env)
