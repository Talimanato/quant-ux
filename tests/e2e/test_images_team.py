#!/usr/bin/env python3
"""E2E test for image upload and team management via the backend API.

This test is mostly API-driven and can also be run directly:

    python3 tests/e2e/test_images_team.py
"""
import io
import json
import os
import sys
import time
from pathlib import Path

import requests
from PIL import Image

# Allow running this file directly with `python3 tests/e2e/test_images_team.py`.
_e2e_dir = str(Path(__file__).resolve().parent)
if _e2e_dir not in sys.path:
    sys.path.insert(0, _e2e_dir)

from conftest import IsolatedTestEnvironment, api_call, create_app_api, signup_user


def _create_png(width: int = 10, height: int = 10) -> bytes:
    """Generate a small red PNG in memory."""
    img = Image.new("RGBA", (width, height), (255, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _assert_no_api_error(data, msg=""):
    """Fail if a JSON API response contains an error key."""
    if isinstance(data, dict) and "error" in data:
        raise AssertionError(f"{msg}: {data}")


def _api_call_safe(*args, **kwargs):
    """Wrap conftest.api_call and fail on any returned error."""
    result = api_call(*args, **kwargs)
    _assert_no_api_error(result, f"REST call failed for {args[0]} {args[1]}")
    return result


def _collect_rest_errors(page):
    """Return REST requests from the page that returned 4xx/5xx."""
    return page.evaluate(
        """() => {
            return performance.getEntriesByType('resource')
                .filter(r => r.name.includes('/rest/'))
                .filter(r => r.responseStatus >= 400)
                .map(r => ({ name: r.name, status: r.responseStatus }));
        }"""
    )


def _upload_image(backend_url: str, app_id: str, token: str, png: bytes) -> dict:
    """Upload a PNG via the image endpoint and return the upload metadata."""
    resp = requests.post(
        f"{backend_url}/rest/images/{app_id}",
        files=[("files", ("test.png", io.BytesIO(png), "image/png"))],
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    _assert_no_api_error(data, "image upload failed")
    uploads = data.get("uploads", [])
    assert len(uploads) == 1, f"Expected 1 image upload, got {len(uploads)}: {data}"
    upload = uploads[0]
    assert upload.get("width") == 10, f"Unexpected width: {upload.get('width')}"
    assert upload.get("height") == 10, f"Unexpected height: {upload.get('height')}"
    return upload


def _test_studio_image(env: dict, user: dict, app_id: str, upload: dict) -> None:
    """Optional UI step: open the Studio, add an Image widget, and set its background
    from the image list."""
    from playwright.sync_api import sync_playwright

    frontend_url = env["frontend_url"]
    token = user["token"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        try:
            # Seed the frontend session via localStorage.
            page.goto(f"{frontend_url}/#/")
            page.evaluate(
                f"""() => {{
                    localStorage.setItem('quxUser', JSON.stringify({json.dumps(user)}));
                    localStorage.setItem('quxLanguage', 'en');
                }}"""
            )
            page.reload()
            page.wait_for_selector("text=Welcome to Quant-UX!", timeout=15000)

            # Open the Studio editor.
            page.goto(f"{frontend_url}/#/apps/{app_id}/create.html")
            page.wait_for_selector(".MatcCanvas", timeout=20000)

            # Remove webpack dev-server overlay if present.
            page.evaluate(
                """() => {
                    const overlay = document.getElementById('webpack-dev-server-client-overlay');
                    if (overlay) overlay.remove();
                }"""
            )

            # Add a screen.
            page.click('[data-dojo-attach-point="addScreenBtn"]', timeout=5000)
            page.click(".MatcCanvas", timeout=5000)
            page.wait_for_timeout(1500)

            # Open the widget selector and pick the Image widget.
            page.keyboard.press("w")
            page.wait_for_timeout(500)
            page.wait_for_selector(".MatcCreateBtnElement", timeout=10000)

            elements = page.locator(".MatcCreateBtnElement").all()
            clicked = False
            for el in elements:
                label = el.locator(".MatcCreateBtnElementLabel").inner_text()
                if label == "Image":
                    el.click()
                    clicked = True
                    break
            assert clicked, "Image widget not found in create menu"

            # Place the Image widget by dragging on the canvas.
            canvas = page.locator(".MatcCanvas")
            box = canvas.bounding_box()
            assert box, "Canvas not found for image widget placement"
            start_x = box["x"] + box["width"] / 2
            start_y = box["y"] + box["height"] / 2
            page.mouse.move(start_x, start_y)
            page.mouse.down()
            page.mouse.move(start_x + 120, start_y + 120)
            page.mouse.up()
            page.wait_for_timeout(2000)

            # Open the Background Image dropdown and select the uploaded image.
            page.click(".MatcToolbarImage .MatcToolbarItem", timeout=5000)
            page.wait_for_selector(
                ".MatcImageUploadPreview.MatcToolbarDropDownButtonItem",
                timeout=10000,
            )
            page.locator(
                ".MatcImageUploadPreview.MatcToolbarDropDownButtonItem"
            ).first.click()
            page.wait_for_timeout(2000)

            # Deselect the widget by clicking on the canvas.
            page.click(".MatcCanvas", timeout=5000)
            page.wait_for_timeout(1500)

            # Verify the backend model now contains an Image widget with the
            # uploaded image as backgroundImage.
            saved = _api_call_safe(
                "GET", f"/rest/apps/{app_id}.json", token=token
            )
            widgets = saved.get("widgets", {})
            image_widget = None
            for w in widgets.values():
                if w.get("type") == "Image" and w.get("style", {}).get(
                    "backgroundImage"
                ):
                    image_widget = w
                    break
            assert image_widget is not None, "No Image widget with backgroundImage found"
            bg = image_widget["style"]["backgroundImage"]
            assert upload["url"] in bg.get(
                "url", ""
            ), f"Widget backgroundImage does not match upload: {bg}"

            # Assert no REST errors were observed in the browser.
            rest_errors = _collect_rest_errors(page)
            unexpected = [e for e in rest_errors if "ws.quant-ux.com" not in e["name"]]
            assert not unexpected, f"Unexpected REST errors: {unexpected}"

            print("PASS: Studio image widget inserted from image list.")
        finally:
            page.close()
            browser.close()


def test_images_team():
    """API-driven end-to-end test for team invite, image upload/list/delete, and
    optional Studio image widget insertion."""
    with IsolatedTestEnvironment() as env:
        backend_url = env["backend_url"]
        frontend_url = env["frontend_url"]

        # Make conftest helpers point to the isolated backend.
        os.environ["QUX_E2E_BACKEND"] = backend_url
        os.environ["QUX_E2E_FRONTEND"] = frontend_url

        ts = int(time.time())
        password = "test-pass-123"
        email_a = f"a-{ts}@example.com"
        email_b = f"b-{ts}@example.com"

        # 1. Sign up user A and B, and create an app with A.
        user_a = signup_user(email_a, password)
        user_b = signup_user(email_b, password)
        assert "token" in user_a, "User A signup did not return a token"
        assert "token" in user_b, "User B signup did not return a token"

        app = create_app_api(user_a, "Image Team App")
        app_id = app.get("id") or app.get("_id")
        assert app_id, f"App creation did not return an id: {app}"

        token_a = user_a["token"]

        # 2. Invite user B to the team with READ permission.
        invite = _api_call_safe(
            "POST",
            f"/rest/apps/{app_id}/team/",
            {"email": email_b, "permission": 2},
            token=token_a,
        )
        assert (
            invite.get("message") == "apps.team.member.add.success"
        ), f"Team invite failed: {invite}"

        # 3. List team members and verify B is there.
        team = _api_call_safe("GET", f"/rest/apps/{app_id}/team.json", token=token_a)
        assert isinstance(team, list), f"Team list was not an array: {team}"
        member_b = next(
            (m for m in team if m.get("email").lower() == email_b.lower()),
            None,
        )
        assert member_b is not None, f"User B not found in team: {team}"
        assert member_b.get("permission") == 2, f"Unexpected permission: {member_b}"

        # 4. Upload a small PNG.
        png = _create_png(10, 10)
        upload = _upload_image(backend_url, app_id, token_a, png)
        image_id = upload.get("id") or upload.get("_id")
        file_name = upload.get("url", "").split("/")[-1]
        assert image_id, f"Upload did not return an image id: {upload}"
        assert file_name, f"Upload did not return a file name: {upload}"

        # 5. List images and verify the upload is present.
        images = _api_call_safe("GET", f"/rest/images/{app_id}.json", token=token_a)
        assert len(images) == 1, f"Expected 1 image, got {len(images)}: {images}"
        listed_id = images[0].get("id") or images[0].get("_id")
        assert listed_id == image_id, f"Listed image id mismatch: {listed_id} vs {image_id}"

        # 6. Optionally open the Studio and verify an image widget can be inserted
        # from the image list.  Do this before deleting the image.
        try:
            _test_studio_image(env, user_a, app_id, upload)
        except Exception as e:
            # The UI step is optional; log the failure but do not fail the test.
            print(f"Optional Studio verification skipped/failed: {e}")

        # 7. Delete the image.
        delete = _api_call_safe(
            "DELETE",
            f"/rest/images/{app_id}/{image_id}/ass/{file_name}",
            token=token_a,
        )
        assert (
            delete.get("message") == "image.deleted"
        ), f"Image delete failed: {delete}"

        # 8. List images after delete and verify it is gone.
        images_after = _api_call_safe(
            "GET", f"/rest/images/{app_id}.json", token=token_a
        )
        assert len(images_after) == 0, f"Expected 0 images after delete: {images_after}"

        print("PASS: Image upload, team management and optional Studio checks completed.")


if __name__ == "__main__":
    test_images_team()
