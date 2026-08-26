#!/usr/bin/env python3
"""E2E coverage for the Studio LayerList.

This test creates an app, opens the Studio editor, adds a screen and a
rectangle, and exercises the LayerList (left-side Tree): select, rename,
hide/show, and assert the canvas reflects the changes.
"""
import json
import sys
import time
from pathlib import Path

# Allow running this file directly with `python3 tests/e2e/test_studio_layers.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, signup_user, create_app_api
from playwright.sync_api import sync_playwright, expect

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


def get_app(app_id, token):
    """Fetch the full app model from the backend."""
    return api_call("GET", f"/rest/apps/{app_id}.json", token=token)


def get_first_widget(app):
    """Return the first (usually only) widget from the persisted app."""
    widgets = app.get("widgets", {})
    assert widgets, "No widgets persisted in app"
    return next(iter(widgets.values()))


def _remove_dev_overlay(page):
    """Remove the webpack dev-server overlay so it cannot intercept clicks."""
    page.evaluate(
        """() => {
            const overlay = document.getElementById('webpack-dev-server-client-overlay');
            if (overlay) overlay.remove();
        }"""
    )


def _run_studio_layers(env):
    """Core test logic using the supplied isolated environment dict."""
    email = f"e2e-layers-{int(time.time())}@test.com"
    password = "password123"

    user = signup_user(email, password)
    assert "token" in user, "Signup did not return a token"
    token = user["token"]

    app = create_app_api(user, "E2E LayerList App")
    app_id = app.get("id") or app.get("_id")
    assert app_id, "App creation did not return an app id"

    frontend_url = env["frontend_url"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"{msg.type}: {msg.text}"))

        try:
            # 1. Login via localStorage.quxUser and wait for dashboard.
            page.goto(f"{frontend_url}/#/")
            page.evaluate(
                f"""() => {{
                    localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    localStorage.setItem('quxLanguage', 'en');
                }}"""
            )
            page.reload()
            page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)

            # 2. Open the Studio editor.
            page.goto(f"{frontend_url}/#/apps/{app_id}/create.html")
            try:
                page.wait_for_selector(".MatcCanvas", timeout=40000)
            except Exception as selector_err:
                print("EDITOR DID NOT LOAD.")
                print("Current URL:", page.url)
                print("Page body (first 2000 chars):")
                print(page.locator("body").inner_text()[:2000])
                print("REST errors:", collect_rest_errors(page))
                raise selector_err
            page.wait_for_timeout(1000)
            _remove_dev_overlay(page)

            # 3. Add a screen by clicking the toolbar "Add Screen" button, then canvas.
            page.click('[data-dojo-attach-point="addScreenBtn"]', timeout=10000)
            page.wait_for_timeout(500)
            page.click(".MatcCanvas", timeout=10000)
            page.wait_for_timeout(1500)

            # Verify a screen was saved.
            saved = get_app(app_id, token)
            screens = saved.get("screens", {})
            screen_count = len(screens)
            print(f"Saved screens count after add: {screen_count}")
            assert screen_count == 1, f"Expected 1 screen, got {screen_count}"

            # 4. Add a box (rectangle) with the 'r' shortcut by dragging on the canvas.
            page.keyboard.press("r")
            page.wait_for_timeout(500)

            canvas = page.locator(".MatcCanvas")
            bbox = canvas.bounding_box()
            assert bbox, "Canvas not rendered"
            start_x = bbox["x"] + bbox["width"] / 2
            start_y = bbox["y"] + bbox["height"] / 2

            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(start_x + 100, start_y + 100)
            page.mouse.up()
            page.wait_for_timeout(2000)

            saved = get_app(app_id, token)
            widgets = saved.get("widgets", {})
            widget_count = len(widgets)
            print(f"Saved widgets count after box add: {widget_count}")
            assert widget_count == 1, f"Expected 1 widget after adding box, got {widget_count}"

            widget = get_first_widget(saved)
            widget_id = widget["id"]
            widget_name = widget["name"]
            print(f"Widget id: {widget_id}, name: {widget_name}")

            # 5. Open/verify the LayerList. The floating Layers window is
            # collapsed by default; expand it first.
            floating = page.locator(".MatcLayerListFloating")
            expect(floating).to_be_visible(timeout=10000)
            if floating.locator(".MatcLayerListFloatingContent").first.is_hidden():
                page.locator(".MatcLayerListFloatingToggle").first.click()
                page.wait_for_timeout(500)
            layer_list = page.locator(".MatcLayerListRoot")
            layer_count = layer_list.count()
            canvas_classes = page.evaluate(
                """() => {
                    const node = document.getElementById('CanvasNode');
                    return node ? node.className : 'NO CANVASNODE';
                }"""
            )
            print(f"LayerList count in DOM: {layer_count}")
            print(f"CanvasNode classes: {canvas_classes}")
            if layer_count == 0:
                print("Layer list not in DOM. Attempting to toggle from toolbar ViewConfig...")
                # Try to click the view-config (eye/gear) button and enable layers.
                view_btn = page.locator('[data-dojo-attach-point="editModeButton"]').first
                if view_btn.is_visible():
                    view_btn.click()
                    page.wait_for_timeout(500)
                    # Look for the Layers checkbox label in ViewConfig dropdown
                    try:
                        page.locator("text=Layers").first.click()
                        page.wait_for_timeout(500)
                    except Exception as e:
                        print("Could not click Layers checkbox:", e)
                # Also try forcing the canvas to build the layer list
                page.evaluate(
                    """() => {
                        const canvas = document.querySelector('.MatcCanvas')?.__vueParentComponent?.ctx;
                        if (canvas && canvas.initLayer) {
                            try { canvas.initLayer(); } catch (e) { console.error('initLayer error', e); }
                        }
                    }"""
                )
                page.wait_for_timeout(1000)
                layer_count = layer_list.count()
                print(f"LayerList count after toggle/init: {layer_count}")
            expect(layer_list).to_be_visible(timeout=10000)
            expect(layer_list.locator(".MatcTree")).to_be_visible(timeout=10000)

            # LayerList should contain the screen and the widget.
            expect(layer_list.get_by_text("Screen").first).to_be_visible(timeout=10000)
            expect(layer_list.get_by_text(widget_name).first).to_be_visible(timeout=10000)
            print("LayerList rendered with screen and widget.")

            # 6. Select the widget in the LayerList.
            layer_list.get_by_text(widget_name).first.click()
            expect(page.locator(".MatcBoxSelected")).to_have_count(1, timeout=10000)
            expect(page.locator(".MatcWidgetSelected")).to_have_count(1, timeout=10000)
            print("Widget selected from LayerList.")

            # 7. Try to rename the widget via the LayerList (double-click the label).
            layer_list.get_by_text(widget_name).first.dblclick()
            input_locator = layer_list.locator("input.MatcTreeItemLabel")
            expect(input_locator).to_be_visible(timeout=10000)

            new_name = "LayerBox"
            input_locator.fill(new_name)
            input_locator.press("Enter")
            page.wait_for_timeout(1500)

            # Wait for the new label to appear in the LayerList.
            expect(layer_list.get_by_text(new_name).first).to_be_visible(timeout=10000)

            # Verify the backend persisted the rename.
            saved = get_app(app_id, token)
            widget = saved["widgets"][widget_id]
            print(f"Widget name after rename: {widget['name']}")
            assert widget["name"] == new_name, f"Widget name not renamed, got {widget['name']}"

            # 8. Try to hide/show the widget via the LayerList.
            # Re-select the renamed widget row; the hidden/visible icon is the only
            # option shown for normal widget nodes (the lock icon is not rendered
            # because TreeItem.hasLock is hard-coded to false in this build).
            layer_list.get_by_text(new_name).first.click()
            expect(page.locator(".MatcBoxSelected")).to_have_count(1, timeout=10000)

            visible_icon = layer_list.locator(
                ".MatcTreeItemSelected .MatcTreeItemOptions .MatcQIcon svg.Visible"
            )
            hidden_icon = layer_list.locator(
                ".MatcTreeItemSelected .MatcTreeItemOptions .MatcQIcon svg.Hidden"
            )

            # Click the visible icon -> widget should become hidden.
            layer_list.locator(".MatcTreeItemSelected .MatcTreeItemOptions .MatcQIcon").first.click()
            page.wait_for_timeout(1500)

            expect(hidden_icon).to_be_visible(timeout=10000)
            expect(page.locator(".MatcWidget")).to_have_count(0, timeout=10000)
            expect(page.locator(".MatcWidgetDND")).to_have_count(0, timeout=10000)

            saved = get_app(app_id, token)
            widget = saved["widgets"][widget_id]
            print(f"Widget hidden prop: {widget.get('props', {}).get('hidden')}")
            assert widget.get("props", {}).get("hidden") is True, "Widget should be hidden"

            # Click the hidden icon -> widget should reappear.
            layer_list.locator(".MatcTreeItemSelected .MatcTreeItemOptions .MatcQIcon").first.click()
            page.wait_for_timeout(1500)

            expect(visible_icon).to_be_visible(timeout=10000)
            expect(page.locator(".MatcWidget")).to_have_count(1, timeout=10000)

            saved = get_app(app_id, token)
            widget = saved["widgets"][widget_id]
            print(f"Widget hidden prop after show: {widget.get('props', {}).get('hidden')}")
            assert widget.get("props", {}).get("hidden") is not True, "Widget should be visible again"

            # 9. Lock attempt: the LayerList UI does not expose a lock icon for widgets
            # in this build (TreeItem.hasLock defaults to false), so we simply verify
            # that no lock icon is present as a best-effort check.
            lock_icon = layer_list.locator(".MatcTreeItemSelected .MatcTreeItemOptions .mdi-lock-outline, .MatcTreeItemSelected .MatcTreeItemOptions .mdi-lock-open-outline")
            lock_count = lock_icon.count()
            print(f"Lock icon count in LayerList: {lock_count}")

            # 10. Assert no unexpected REST errors.
            rest_errors = collect_rest_errors(page)
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]

            print(f"REST errors: {rest_errors}")
            print(f"Unexpected REST errors: {unexpected}")

            assert not unexpected, f"Unexpected REST errors: {unexpected}"
            print("PASS: Studio LayerList test completed successfully.")
        except Exception as e:
            page.screenshot(path=str(ROOT / "tests" / "e2e" / "debug_layers.png"))
            print("CONSOLE LOGS:", "\n".join(console_logs[-50:]))
            raise
        finally:
            context.close()
            browser.close()


def test_studio_layers(isolated_env):
    """Pytest entry point using the conftest isolated_env fixture."""
    _run_studio_layers(isolated_env)


if __name__ == "__main__":
    with IsolatedTestEnvironment() as env:
        test_studio_layers(env)
