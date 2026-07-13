MOVIE_REF = {
    "tmdb_id": 550,
    "media_type": "movie",
    "title": "Fight Club",
    "poster_path": None,
    "backdrop_path": None,
    "release_date": "1999-10-15",
    "vote_average": 8.4,
}


def _register(client, email):
    resp = client.post("/api/auth/register", json={"email": email, "password": "hunter222"})
    assert resp.status_code == 201
    return resp.json()


def test_favorites_require_auth(client):
    resp = client.get("/api/library/favorites")
    assert resp.status_code == 401


def test_favorites_are_scoped_per_user(client):
    _register(client, "owner@example.com")
    put_resp = client.put("/api/library/favorites", json=MOVIE_REF)
    assert put_resp.status_code == 200

    own_favorites = client.get("/api/library/favorites").json()
    assert len(own_favorites) == 1

    client.post("/api/auth/logout")
    _register(client, "other@example.com")
    other_favorites = client.get("/api/library/favorites").json()
    assert other_favorites == []


def test_cannot_modify_another_users_list(client):
    _register(client, "owner2@example.com")
    created = client.post("/api/library/lists", json={"name": "Want to watch"}).json()

    client.post("/api/auth/logout")
    _register(client, "intruder@example.com")
    resp = client.put(f"/api/library/lists/{created['id']}/items", json=MOVIE_REF)
    assert resp.status_code == 404
