# Multiuser Auth — Design

Date: 2026-07-12
Status: Approved, not yet implemented

## Context

CineScope currently has a single, global personal library (favorites, watched
items, ratings, custom lists, watched episodes) with no concept of a user —
every row in `favorites`, `watched`, `ratings`, `lists`, `list_items`, and
`watched_episodes` is shared across anyone who hits the API. The app is not
deployed yet (backend targets Render, frontend targets Vercel per
`render.yaml` / `vercel.json`, but nothing is live).

This spec adds public registration and login so each person gets their own
library, plus a minimal hook for future personalized recommendations.

## Goals

- Public sign-up: anyone can register with email + password.
- Each user's favorites/watched/ratings/lists/episodes are private to them.
- Browsing (home, search, discover, movie/show/person detail) stays public —
  only library actions (favorite, watched, rating, lists) require a session.
- Lay the groundwork for a `for-you` personalized recommendations endpoint,
  without designing the full recommendation algorithm in this spec.

## Non-goals (deferred to later work)

- Email verification.
- Password reset / "forgot password".
- OAuth / social login.
- Refresh tokens or "remember me" configurability — sessions are a flat
  7-day JWT.
- The full personalized-recommendations algorithm (multi-source blending,
  weighting, pagination) — only a minimal single-source version ships here.
- Migrating existing library data — per decision below, we start clean.

## Session strategy: httpOnly cookie

Chosen over a `Authorization: Bearer` header stored in the frontend, because
the JWT never touches frontend JS this way — immune to token theft via XSS,
which matters once registration is public.

Cross-origin cookies need care once backend and frontend are on different
domains (Render vs. Vercel):

- **Local dev**: `http://localhost:5173` and `http://localhost:8000` are
  *same-site* (same host, different port only), so `SameSite=Lax` without
  `Secure` works over plain HTTP.
- **Production**: different domains → cross-site → requires
  `SameSite=None; Secure` (HTTPS only).

This is handled with two new settings, not two code paths:

```python
# config.py
cookie_secure: bool = False     # set True via env in production
cookie_samesite: str = "lax"    # set "none" via env in production
```

CORS must set `allow_credentials=True` and keep `CORS_ORIGINS` a strict
allowlist (no `*`) for the cookie to be sent/accepted at all.

## Data model

New `User` table:

```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

Every library table gains a `user_id` FK:

```python
user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
```

Applies to: `Favorite`, `WatchedItem`, `Rating`, `CustomList`,
`WatchedEpisode`. `CustomListItem` does **not** get its own `user_id` — it
inherits ownership from its parent `CustomList` (a list is owned by a user;
items in it are not separately owned).

Existing per-media `UniqueConstraint`s (e.g. `uq_favorite` on
`tmdb_id, media_type`) are extended to include `user_id`, since uniqueness
is now per-user, not global (e.g. `UniqueConstraint("user_id", "tmdb_id", "media_type", name="uq_favorite")`).

### Existing data

Decision: **start clean, no migration.** The app isn't deployed and the
local library has no data worth preserving. Rollout is: delete
`backend/cinescope.db` locally; `Base.metadata.create_all` recreates all
tables (including the new/changed ones) on next backend start. No Alembic
migration is needed for this change.

## Auth endpoints

New router `app/routers/auth.py`, mounted at `/api/auth`:

| Endpoint | Behavior |
|---|---|
| `POST /auth/register` | Body `{email, password}`. 400 if email already registered. Hashes password with bcrypt, creates `User`, then behaves like login (sets cookie, returns profile). |
| `POST /auth/login` | Body `{email, password}`. Verifies hash; on success signs a JWT (`sub=user.id`, `exp` = now + `jwt_expire_days`), sets it as an httpOnly cookie per the flags above, returns `{id, email}`. On failure, `401` with a generic "invalid credentials" message — same message whether the email doesn't exist or the password is wrong, so the endpoint never confirms which emails are registered. |
| `POST /auth/logout` | Clears the cookie (`Max-Age=0`). |
| `GET /auth/me` | Reads the cookie, verifies the JWT, returns `{id, email}` for the current user, or `401` if there's no valid session. Used by the frontend on boot to detect an existing session. |

New settings: `jwt_secret: str` (required, no default — fails startup if
unset), `jwt_expire_days: int = 7`. New dependencies: `pyjwt`, `bcrypt`.

## Protecting library routes

A `get_current_user` dependency (in `auth.py` or a new `deps.py`) reads the
cookie, verifies/decodes the JWT, and loads the `User` row; any failure
raises `401`. Applied at the router level:

```python
router = APIRouter(prefix="/library", tags=["library"], dependencies=[Depends(get_current_user)])
```

Every query in `library.py` that currently does
`filter_by(tmdb_id=..., media_type=...)` adds `user_id=user.id` — this
touches all ~20 endpoints in that file mechanically (favorites, watched,
ratings, lists, list items, watched episodes).

`discover.py` and `media.py` (TMDB proxy/browse) remain public — they don't
read or write personal library data.

### Minimal personalized-recommendations hook

One new protected endpoint: `GET /api/discover/for-you`.

v1 behavior only: take the user's highest-rated item (or, if they have no
ratings, their most recently watched item); call TMDB's `recommendations`
endpoint for that single item; return the result as-is. No blending of
multiple sources, no weighting, no pagination tuning. If the user has
neither ratings nor watched items, return an empty list — the frontend
shows a placeholder ("mark something as watched to see recommendations").

The full recommendation algorithm (combining multiple signals, etc.) is
explicitly out of scope here and will get its own design.

## Frontend changes

- **`api/client.js`**: both `apiGet` and `apiSend` add `credentials: 'include'`
  to their `fetch` calls, so the session cookie is sent/received.
- **New `store/useAuthStore.js`** (same shape as `useLibraryStore`):
  `{ user, loaded, checkSession(), login(email, password), register(email, password), logout() }`.
- **`App.jsx`**: calls `checkSession()` on boot (alongside/before
  `useLibraryStore.load()`). If there's no session, the library store simply
  doesn't load (stays empty, `loaded: false`) — no visible error.
- **New pages** `Login.jsx` and `Register.jsx` at `/login` and `/register`,
  simple email/password forms.
- **`NavBar.jsx`**: shows the user's email + a logout button when
  authenticated, otherwise a "Log in" link.
- **Soft gate on library actions**: `LibraryActions.jsx` checks
  `useAuthStore().user` before calling the library store — if null, redirect
  to `/login` instead of making the API call. `Library.jsx` and
  `Watched.jsx` show an empty state ("log in to see your library") instead
  of attempting a fetch that the backend would reject with `401`.
- Browsing pages (`Home`, `Discover`, `Search`, `MovieDetail`, `TvDetail`,
  `PersonDetail`) are unaffected — no auth required to view them.

## Security notes

- Passwords hashed with `bcrypt` (default cost factor); never logged or
  stored in plaintext.
- JWT: `HS256`, minimal payload (`sub`, `exp`), 7-day expiry, no refresh
  token — expired sessions require a fresh login.
- CSRF: no dedicated token in v1. Rationale: every mutating library endpoint
  uses `PUT`/`DELETE`, which are not CORS-"simple" methods, so browsers
  always preflight them; since `CORS_ORIGINS` is a strict allowlist (no
  `*`) and `allow_credentials=True`, a third-party page cannot complete
  such a request even though the cookie would otherwise be attached. This
  protection breaks if a future mutating endpoint is added that accepts a
  CORS-safelisted method/content-type (e.g. a plain `GET` or
  `POST` with `Content-Type: text/plain`) — any such endpoint would need
  its own CSRF protection.

## Testing

No test suite exists in the repo today. This change adds a minimal one
using FastAPI's `TestClient`:

- Register → login → `GET /auth/me` returns the right user.
- A library endpoint returns `401` with no session cookie.
- Two distinct users each get their own favorites/watched/ratings — one
  user's writes are invisible to the other (validates `user_id` scoping).

## Rollout

Local only for now (nothing is deployed): delete `backend/cinescope.db`,
start the backend, `Base.metadata.create_all` builds the new schema fresh.
When this does get deployed later, the only production-specific change is
flipping `cookie_secure` / `cookie_samesite` via env vars — no code change.
