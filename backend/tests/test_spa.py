"""The React app is served for page URLs; API and admin URLs are never swallowed by it."""

import pytest


@pytest.fixture
def built_frontend(tmp_path, settings):
    (tmp_path / "index.html").write_text("<!doctype html><title>DueProof</title>")
    settings.FRONTEND_DIST = tmp_path
    return tmp_path


def test_page_urls_return_react_index(client, built_frontend):
    for url in ["/", "/dashboard", "/obligations/12/edit"]:
        response = client.get(url)
        assert response.status_code == 200
        assert b"<title>DueProof</title>" in b"".join(response.streaming_content)


def test_unknown_api_url_is_404_not_react(client, built_frontend):
    response = client.get("/api/does-not-exist/")
    assert response.status_code == 404


def test_missing_build_gives_clear_message(client, tmp_path, settings):
    settings.FRONTEND_DIST = tmp_path / "missing"
    response = client.get("/dashboard")
    assert response.status_code == 404
    assert b"Frontend build not found" in response.content
