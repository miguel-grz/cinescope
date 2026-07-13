def test_register_then_me(client):
    register_resp = client.post("/api/auth/register", json={"email": "a@example.com", "password": "hunter222"})
    assert register_resp.status_code == 201
    assert register_resp.json()["email"] == "a@example.com"

    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "a@example.com"


def test_duplicate_email_rejected(client):
    client.post("/api/auth/register", json={"email": "dupe@example.com", "password": "hunter222"})
    resp = client.post("/api/auth/register", json={"email": "dupe@example.com", "password": "somethingelse"})
    assert resp.status_code == 400


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"email": "b@example.com", "password": "correcthorse"})
    client.post("/api/auth/logout")
    resp = client.post("/api/auth/login", json={"email": "b@example.com", "password": "wrongpassword"})
    assert resp.status_code == 401


def test_login_success(client):
    client.post("/api/auth/register", json={"email": "d@example.com", "password": "hunter222"})
    client.post("/api/auth/logout")

    login_resp = client.post("/api/auth/login", json={"email": "d@example.com", "password": "hunter222"})
    assert login_resp.status_code == 200
    assert login_resp.json()["email"] == "d@example.com"

    me_resp = client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "d@example.com"


def test_me_without_session(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout_clears_session(client):
    client.post("/api/auth/register", json={"email": "c@example.com", "password": "hunter222"})
    client.post("/api/auth/logout")
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
