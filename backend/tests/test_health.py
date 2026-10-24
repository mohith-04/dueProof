import pytest


@pytest.mark.django_db
def test_health_returns_ok_without_login(api_client):
    response = api_client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_rejects_post(api_client):
    response = api_client.post("/api/health/")

    assert response.status_code == 405
