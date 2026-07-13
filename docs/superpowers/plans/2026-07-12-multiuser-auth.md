# Multiuser Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public email/password registration and login to CineScope so each user gets a private library (favorites, watched, ratings, lists, watched episodes), plus a minimal protected endpoint that hooks future personalized recommendations.

**Architecture:** An httpOnly JWT session cookie issued by a new `/api/auth` router. Every library table gains a `user_id` FK, and every `library` router endpoint filters/writes by the authenticated user. The frontend gains an auth store, login/register pages, and soft-gates library actions behind a session check.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), PyJWT + bcrypt for auth, pytest + FastAPI `TestClient` for backend tests, React 19 + Zustand + React Router (frontend).

## Global Constraints

- Session strategy: httpOnly cookie (`SameSite=Lax` in dev, `SameSite=None; Secure` in prod via `cookie_secure`/`cookie_samesite` settings), never an `Authorization` header. Source: [spec](2026-07-12-multiuser-auth-design.md#session-strategy-httponly-cookie) (`../specs/2026-07-12-multiuser-auth-design.md`).
- No email verification, password reset, or OAuth in this iteration.
- Existing library data is discarded, not migrated — local `cinescope.db` is dropped and recreated with the new schema.
- Browsing (home/search/discover/detail pages) stays public; only library actions (favorite/watched/rating/lists) require a session.
- `CustomListItem` has no `user_id` of its own — ownership is inherited from its parent `CustomList`.
- CSRF is covered by CORS preflight + a strict origin allowlist, not a dedicated token — every mutating endpoint must keep using non-CORS-safelisted methods (`PUT`/`DELETE`/`POST` with a JSON body).
- `GET /api/discover/for-you` ships as a single-source minimum (top-rated, else last-watched, title's TMDB recommendations) — no multi-source blending.

---

## Task 1: Config, dependencies and password/JWT helpers

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/requirements-dev.txt`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`
- Create: `backend/app/security.py`

**Interfaces:**
- Produces: `security.hash_password(password: str) -> str`, `security.verify_password(password: str, password_hash: str) -> bool`, `security.create_access_token(user_id: int) -> str`, `security.decode_access_token(token: str) -> int` (raises `jwt.PyJWTError` on invalid/expired token). `settings.jwt_secret: str`, `settings.jwt_expire_days: int`, `settings.cookie_secure: bool`, `settings.cookie_samesite: str`.

- [ ] **Step 1: Add new dependencies**

Modify `backend/requirements.txt` — append these lines after `python-dotenv>=1.0`:

```
bcrypt>=4.1
PyJWT>=2.9
email-validator>=2.0
```

Create `backend/requirements-dev.txt`:

```
-r requirements.txt
pytest>=8.0
```

- [ ] **Step 2: Install them**

Run: `cd backend && ./venv/bin/pip install -r requirements-dev.txt`
Expected: `Successfully installed bcrypt-... PyJWT-... email-validator-... pytest-...` (plus their sub-dependencies)

- [ ] **Step 3: Add auth settings to config**

Modify `backend/app/config.py` — add these fields to `Settings`, right after `default_language`:

```python
    default_language: str = "es-ES"
    cache_ttl_seconds: int = 600
    cache_max_size: int = 2048
    # Session cookie: signs a JWT stored as an httpOnly cookie. No default —
    # startup fails if it's missing, so a real deployment can't run with a
    # blank/guessable secret.
    jwt_secret: str
    jwt_expire_days: int = 7
    # False/"lax" work over plain HTTP when frontend and backend share a
    # host (e.g. localhost:5173 <-> localhost:8000 — same-site by the
    # "site" definition, which ignores port). Cross-origin production
    # deploys (different domains) need True/"none", set via env.
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
```

- [ ] **Step 4: Document the new env var**

Modify `backend/.env.example` — append:

```
# Secret used to sign session JWTs. Generate one with:
#   python -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=

# Cross-origin cookie flags — leave as-is for local dev. In production
# (backend and frontend on different domains), set both:
# COOKIE_SECURE=true
# COOKIE_SAMESITE=none
```

- [ ] **Step 5: Set a real secret in local `.env`**

Run: `cd backend && python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_hex(32))" >> .env`
Expected: a `JWT_SECRET=<64 hex chars>` line appended to `backend/.env` (verify with `tail -1 .env` — do not print the full `.env` since it also holds the TMDB key).

- [ ] **Step 6: Write the security helpers**

Create `backend/app/security.py`:

```python
"""Password hashing and JWT helpers — no DB or FastAPI imports, so these
stay trivially unit-testable."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    return jwt.encode({"sub": str(user_id), "exp": expires_at}, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> int:
    """Returns the user id encoded in the token. Raises jwt.PyJWTError
    (covers expiry and tampering) if the token is invalid."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    return int(payload["sub"])
```

- [ ] **Step 7: Verify it works**

Run: `cd backend && ./venv/bin/python -c "
from app.security import hash_password, verify_password, create_access_token, decode_access_token
h = hash_password('hunter22')
assert verify_password('hunter22', h)
assert not verify_password('wrong', h)
token = create_access_token(42)
assert decode_access_token(token) == 42
print('OK')
"`
Expected: `OK`

- [ ] **Step 8: Commit**

```bash
cd backend && git add requirements.txt requirements-dev.txt app/config.py .env.example app/security.py
git commit -m "feat: add auth config and password/JWT helpers"
```

---

## Task 2: User model and per-user library schema

**Files:**
- Modify: `backend/app/models.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `models.User` (fields: `id`, `email`, `password_hash`, `created_at`). Every library model (`Favorite`, `WatchedItem`, `Rating`, `CustomList`, `WatchedEpisode`) gains `user_id: int`. `CustomListItem` is unchanged (still keyed by `list_id`, no `user_id`).

- [ ] **Step 1: Rewrite `models.py`**

Replace the full contents of `backend/app/models.py`:

```python
"""Local database models — everything TMDB does not store for us.

All rows reference TMDB content by (tmdb_id, media_type) and denormalize the
few display fields (title, poster, ...) the library pages need, so listing
favorites/watched never requires a TMDB round-trip. Library rows are scoped
to the user who owns them via `user_id`.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MediaFieldsMixin:
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)
    media_type: Mapped[str] = mapped_column(String(10))  # "movie" | "tv"
    title: Mapped[str] = mapped_column(String(300))
    poster_path: Mapped[str] = mapped_column(String(200), nullable=True)
    backdrop_path: Mapped[str] = mapped_column(String(200), nullable=True)
    release_date: Mapped[str] = mapped_column(String(10), nullable=True)
    vote_average: Mapped[float] = mapped_column(Float, nullable=True)


class Favorite(MediaFieldsMixin, Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "tmdb_id", "media_type", name="uq_favorite"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WatchedItem(MediaFieldsMixin, Base):
    __tablename__ = "watched"
    __table_args__ = (UniqueConstraint("user_id", "tmdb_id", "media_type", name="uq_watched"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    watched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Rating(MediaFieldsMixin, Base):
    __tablename__ = "ratings"
    __table_args__ = (UniqueConstraint("user_id", "tmdb_id", "media_type", name="uq_rating"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score: Mapped[float] = mapped_column(Float)  # 0.5 - 10
    note: Mapped[str] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CustomList(Base):
    __tablename__ = "lists"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["CustomListItem"]] = relationship(
        back_populates="list", cascade="all, delete-orphan", order_by="CustomListItem.added_at"
    )


class CustomListItem(MediaFieldsMixin, Base):
    __tablename__ = "list_items"
    __table_args__ = (UniqueConstraint("list_id", "tmdb_id", "media_type", name="uq_list_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("lists.id", ondelete="CASCADE"))
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    list: Mapped[CustomList] = relationship(back_populates="items")


class WatchedEpisode(Base):
    __tablename__ = "watched_episodes"
    __table_args__ = (
        UniqueConstraint("user_id", "tmdb_id", "season_number", "episode_number", name="uq_watched_episode"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, index=True)  # TV show id
    show_title: Mapped[str] = mapped_column(String(300), nullable=True)
    show_poster_path: Mapped[str] = mapped_column(String(200), nullable=True)
    season_number: Mapped[int] = mapped_column(Integer)
    episode_number: Mapped[int] = mapped_column(Integer)
    episode_name: Mapped[str] = mapped_column(String(300), nullable=True)
    watched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 2: Drop the stale local DB (schema is changing, data is being discarded per plan)**

Run: `cd backend && rm -f cinescope.db`
Expected: no output; the file no longer exists (`ls cinescope.db` now errors with "No such file").

- [ ] **Step 3: Verify the new schema builds cleanly**

Run: `cd backend && ./venv/bin/python -c "
from app.database import Base, engine
from app import models  # noqa: F401
Base.metadata.create_all(bind=engine)
import sqlite3
conn = sqlite3.connect('cinescope.db')
tables = {r[0] for r in conn.execute(\"select name from sqlite_master where type='table'\")}
assert {'users', 'favorites', 'watched', 'ratings', 'lists', 'list_items', 'watched_episodes'} <= tables, tables
print('OK', sorted(tables))
"`
Expected: `OK [...]` listing all seven tables.

- [ ] **Step 4: Commit**

```bash
cd backend && git add app/models.py
git commit -m "feat: add User model and scope library tables to a user_id"
```

(`cinescope.db` is already gitignored — confirm with `git status` that no DB file shows up as untracked/modified before moving on.)

---

## Task 3: Auth schemas, `/api/auth` endpoints, `get_current_user`

**Files:**
- Modify: `backend/app/schemas.py`
- Create: `backend/app/routers/auth.py`

**Interfaces:**
- Consumes: `security.hash_password`, `security.verify_password`, `security.create_access_token`, `security.decode_access_token` (Task 1); `models.User` (Task 2).
- Produces: `auth.router` (FastAPI `APIRouter`, mounted at `/api/auth` in Task 4) with `POST /register`, `POST /login`, `POST /logout`, `GET /me`. `auth.get_current_user` — a FastAPI dependency, `(session_token: str | None, db: Session) -> models.User`, raising `HTTPException(401)` on any failure — imported by `library.py` (Task 5) and `discover.py` (Task 6).

- [ ] **Step 1: Add auth schemas**

Modify `backend/app/schemas.py` — add near the top, right after the imports:

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field
```

(replaces the existing `from pydantic import BaseModel, ConfigDict, Field` line)

Then append at the end of the file:

```python
class UserCreate(BaseModel):
    email: EmailStr
    # bcrypt silently ignores/rejects bytes past 72 — cap here so the error
    # surfaces as a normal 422 instead of a confusing 500 from bcrypt.
    password: str = Field(min_length=8, max_length=72)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
```

- [ ] **Step 2: Write the auth router**

Create `backend/app/routers/auth.py`:

```python
"""Registration, login and session endpoints."""
from typing import Optional

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..security import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "cinescope_session"


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_access_token(user_id),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_expire_days * 24 * 60 * 60,
    )


def get_current_user(
    session_token: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
    db: Session = Depends(get_db),
) -> models.User:
    if session_token is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = decode_access_token(session_token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/register", response_model=schemas.UserOut, status_code=201)
def register(body: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    existing = db.scalar(select(models.User).filter_by(email=body.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=schemas.UserOut)
def login(body: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(models.User).filter_by(email=body.email))
    # Same error for "no such email" and "wrong password" — never reveal
    # which one it was, so this can't be used to enumerate registered emails.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_session_cookie(response, user.id)
    return user


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
```

- [ ] **Step 3: Verify it imports cleanly**

Run: `cd backend && ./venv/bin/python -c "from app.routers import auth; print('OK', [r.path for r in auth.router.routes])"`
Expected: `OK ['/auth/register', '/auth/login', '/auth/logout', '/auth/me']`

- [ ] **Step 4: Commit**

```bash
cd backend && git add app/schemas.py app/routers/auth.py
git commit -m "feat: add register/login/logout/me endpoints"
```

---

## Task 4: Wire the auth router into the app

**Files:**
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `auth.router` (Task 3).
- Produces: `/api/auth/*` reachable; `allow_credentials=True` on CORS so the session cookie round-trips cross-origin.

- [ ] **Step 1: Update `main.py`**

Replace the full contents of `backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models, tmdb  # noqa: F401 — models must import before create_all
from .config import settings
from .database import Base, engine
from .routers import auth, discover, library, media


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    await tmdb.open_client()
    yield
    await tmdb.close_client()


app = FastAPI(
    title="CineScope API",
    description="Middle layer over TMDB plus CineScope's own library features.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(discover.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(library.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Start the server and smoke-test the auth flow**

Run this as a single command — background job control (`%1`) doesn't carry over between separate shell invocations, so start, curl, and kill must run in one:

```bash
cd backend && ./venv/bin/uvicorn app.main:app --port 8000 & sleep 2 && \
curl -s -c /tmp/cinescope-cookies.txt -X POST http://127.0.0.1:8000/api/auth/register \
  -H 'Content-Type: application/json' -d '{"email":"smoke@example.com","password":"hunter222"}' && echo && \
curl -s -b /tmp/cinescope-cookies.txt http://127.0.0.1:8000/api/auth/me; \
kill %1; rm -f /tmp/cinescope-cookies.txt cinescope.db
```

Expected: the register call prints `{"id":1,"email":"smoke@example.com"}` (HTTP 201), and the `/me` call — using the saved cookie — prints the same JSON (HTTP 200). The trailing `rm` clears both the cookie jar and the smoke-test DB so Task 5's manual test starts from a clean slate.

- [ ] **Step 3: Commit**

```bash
cd backend && git add app/main.py
git commit -m "feat: mount auth router and enable credentialed CORS"
```

---

## Task 5: Scope `/api/library` to the authenticated user

**Files:**
- Modify: `backend/app/routers/library.py`

**Interfaces:**
- Consumes: `auth.get_current_user` (Task 3).
- Produces: every `/api/library/*` endpoint now requires a session and only reads/writes rows owned by the current user; `404` (not just silently no-op) when a `list_id` in the URL belongs to a different user.

- [ ] **Step 1: Rewrite `library.py`**

Replace the full contents of `backend/app/routers/library.py`:

```python
"""Personal library: favorites, watched, ratings and custom lists (per user)."""
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user

router = APIRouter(prefix="/library", tags=["library"])


def _media_fields(ref: schemas.MediaRef) -> dict:
    return ref.model_dump(include={
        "tmdb_id", "media_type", "title", "poster_path",
        "backdrop_path", "release_date", "vote_average",
    })


def _get_owned_list(list_id: int, user: models.User, db: Session) -> models.CustomList:
    target = db.get(models.CustomList, list_id)
    if not target or target.user_id != user.id:
        raise HTTPException(status_code=404, detail="List not found")
    return target


# ---------- state ----------

@router.get("/state/{media_type}/{tmdb_id}", response_model=schemas.LibraryState)
def state(
    media_type: str, tmdb_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fav = db.scalar(select(models.Favorite).filter_by(tmdb_id=tmdb_id, media_type=media_type, user_id=user.id))
    watched = db.scalar(
        select(models.WatchedItem).filter_by(tmdb_id=tmdb_id, media_type=media_type, user_id=user.id)
    )
    rating = db.scalar(select(models.Rating).filter_by(tmdb_id=tmdb_id, media_type=media_type, user_id=user.id))
    list_ids = db.scalars(
        select(models.CustomListItem.list_id)
        .join(models.CustomList, models.CustomList.id == models.CustomListItem.list_id)
        .filter(
            models.CustomListItem.tmdb_id == tmdb_id,
            models.CustomListItem.media_type == media_type,
            models.CustomList.user_id == user.id,
        )
    ).all()
    return schemas.LibraryState(
        favorite=fav is not None,
        watched=watched is not None,
        rating=rating.score if rating else None,
        list_ids=list(list_ids),
    )


# ---------- favorites ----------

@router.get("/favorites", response_model=List[schemas.FavoriteOut])
def list_favorites(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Favorite).filter_by(user_id=user.id).order_by(models.Favorite.created_at.desc())
    ).all()


@router.put("/favorites", response_model=schemas.FavoriteOut)
def add_favorite(
    ref: schemas.MediaRef,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(models.Favorite).filter_by(tmdb_id=ref.tmdb_id, media_type=ref.media_type, user_id=user.id)
    )
    if existing:
        return existing
    fav = models.Favorite(user_id=user.id, **_media_fields(ref))
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/favorites/{media_type}/{tmdb_id}", status_code=204)
def remove_favorite(
    media_type: str, tmdb_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(models.Favorite).filter_by(tmdb_id=tmdb_id, media_type=media_type, user_id=user.id))
    db.commit()


# ---------- watched ----------

@router.get("/watched", response_model=List[schemas.WatchedOut])
def list_watched(
    sort: str = Query(default="watched_at", pattern="^(watched_at|title|vote_average)$"),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    column = getattr(models.WatchedItem, sort)
    column = column.desc() if order == "desc" else column.asc()
    return db.scalars(select(models.WatchedItem).filter_by(user_id=user.id).order_by(column)).all()


@router.put("/watched", response_model=schemas.WatchedOut)
def mark_watched(
    ref: schemas.MediaRef,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(models.WatchedItem).filter_by(tmdb_id=ref.tmdb_id, media_type=ref.media_type, user_id=user.id)
    )
    if existing:
        return existing
    item = models.WatchedItem(user_id=user.id, **_media_fields(ref))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/watched/{media_type}/{tmdb_id}", status_code=204)
def unmark_watched(
    media_type: str, tmdb_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(models.WatchedItem).filter_by(tmdb_id=tmdb_id, media_type=media_type, user_id=user.id))
    db.commit()


# ---------- watched episodes ----------

@router.get("/watched-episodes", response_model=List[schemas.ShowProgress])
def watched_episodes_summary(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Episode-level watch progress per show — distinct from a show being
    marked watched as a whole, so partially-watched series are trackable."""
    rows = db.scalars(
        select(models.WatchedEpisode).filter_by(user_id=user.id).order_by(models.WatchedEpisode.watched_at.desc())
    ).all()
    by_show: Dict[int, schemas.ShowProgress] = {}
    for row in rows:
        show = by_show.get(row.tmdb_id)
        if show is None:
            show = schemas.ShowProgress(
                tmdb_id=row.tmdb_id, title=row.show_title, poster_path=row.show_poster_path,
                count=0, episodes=[],
            )
            by_show[row.tmdb_id] = show
        show.episodes.append(schemas.EpisodeEntry.model_validate(row))
        show.count += 1
    return list(by_show.values())


@router.get("/watched-episodes/{tv_id}", response_model=List[schemas.WatchedEpisodeOut])
def watched_episodes(
    tv_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(select(models.WatchedEpisode).filter_by(tmdb_id=tv_id, user_id=user.id)).all()


@router.put("/watched-episodes", response_model=schemas.WatchedEpisodeOut)
def mark_episode(
    body: schemas.WatchedEpisodeIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.scalar(select(models.WatchedEpisode).filter_by(
        tmdb_id=body.tmdb_id, season_number=body.season_number, episode_number=body.episode_number, user_id=user.id
    ))
    if existing:
        return existing
    episode = models.WatchedEpisode(user_id=user.id, **body.model_dump())
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return episode


@router.delete("/watched-episodes/{tv_id}/{season_number}/{episode_number}", status_code=204)
def unmark_episode(
    tv_id: int, season_number: int, episode_number: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(models.WatchedEpisode).filter_by(
        tmdb_id=tv_id, season_number=season_number, episode_number=episode_number, user_id=user.id
    ))
    db.commit()


# ---------- ratings ----------

@router.get("/ratings", response_model=List[schemas.RatingOut])
def list_ratings(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Rating).filter_by(user_id=user.id).order_by(models.Rating.updated_at.desc())
    ).all()


@router.put("/ratings", response_model=schemas.RatingOut)
def set_rating(
    body: schemas.RatingIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rating = db.scalar(
        select(models.Rating).filter_by(tmdb_id=body.tmdb_id, media_type=body.media_type, user_id=user.id)
    )
    if rating:
        rating.score = body.score
        rating.note = body.note
    else:
        rating = models.Rating(user_id=user.id, **_media_fields(body), score=body.score, note=body.note)
        db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@router.delete("/ratings/{media_type}/{tmdb_id}", status_code=204)
def delete_rating(
    media_type: str, tmdb_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(models.Rating).filter_by(tmdb_id=tmdb_id, media_type=media_type, user_id=user.id))
    db.commit()


# ---------- custom lists ----------

@router.get("/lists", response_model=List[schemas.ListOut])
def get_lists(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(models.CustomList).filter_by(user_id=user.id).order_by(models.CustomList.created_at)
    ).all()


@router.post("/lists", response_model=schemas.ListOut, status_code=201)
def create_list(
    body: schemas.ListCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_list = models.CustomList(user_id=user.id, name=body.name, description=body.description)
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    return new_list


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(
    list_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = _get_owned_list(list_id, user, db)
    db.delete(target)
    db.commit()


@router.put("/lists/{list_id}/items", response_model=schemas.ListOut)
def add_to_list(
    list_id: int, ref: schemas.MediaRef,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = _get_owned_list(list_id, user, db)
    existing = db.scalar(select(models.CustomListItem).filter_by(
        list_id=list_id, tmdb_id=ref.tmdb_id, media_type=ref.media_type
    ))
    if not existing:
        db.add(models.CustomListItem(list_id=list_id, **_media_fields(ref)))
        db.commit()
    db.refresh(target)
    return target


@router.delete("/lists/{list_id}/items/{media_type}/{tmdb_id}", status_code=204)
def remove_from_list(
    list_id: int, media_type: str, tmdb_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_list(list_id, user, db)
    db.execute(delete(models.CustomListItem).filter_by(
        list_id=list_id, tmdb_id=tmdb_id, media_type=media_type
    ))
    db.commit()
```

Note on `_get_owned_list`: the spec didn't spell this out, but it's a direct consequence of lists becoming private — without it, any logged-in user could delete or modify another user's list by guessing its numeric `list_id`. Task 7's tests cover this.

- [ ] **Step 2: Verify a request without a session is rejected**

Run: `cd backend && ./venv/bin/uvicorn app.main:app --port 8000 & sleep 2 && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/library/favorites; kill %1`
Expected: `401`

- [ ] **Step 3: Commit**

```bash
cd backend && git add app/routers/library.py
git commit -m "feat: scope library endpoints to the authenticated user"
```

---

## Task 6: `GET /api/discover/for-you`

**Files:**
- Modify: `backend/app/routers/discover.py`

**Interfaces:**
- Consumes: `auth.get_current_user` (Task 3), `models.Rating`, `models.WatchedItem` (Task 2).
- Produces: `GET /api/discover/for-you` (protected) → same shape as TMDB's `recommendations` endpoint (`{"results": [...]}`), or `{"results": []}` if the user has no ratings/watched items yet.

- [ ] **Step 1: Add the endpoint**

Replace the full contents of `backend/app/routers/discover.py`. This adds imports, the new `for_you` route, and — importantly — places it **before** `discover(media_type, ...)`: FastAPI matches routes in registration order, and `/discover/{media_type}` would otherwise swallow `/discover/for-you` by treating `for-you` as a `media_type` value.

```python
"""Discovery: home sections, search and filtered browsing."""
import asyncio
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, tmdb
from ..config import settings
from ..database import get_db
from .auth import get_current_user

router = APIRouter(tags=["discover"])

LanguageQuery = Query(default=None, description="TMDB language, e.g. es-ES or en-US")


def _lang(language: Optional[str]) -> str:
    return language or settings.default_language


@router.get("/home")
async def home(language: Optional[str] = LanguageQuery, region: Optional[str] = None):
    """Everything the home page needs in one request."""
    lang = _lang(language)
    reg = region or settings.default_region
    (
        trending_movies,
        trending_tv,
        popular_movies,
        popular_tv,
        top_movies,
        top_tv,
        upcoming,
    ) = await asyncio.gather(
        tmdb.get("/trending/movie/week", language=lang),
        tmdb.get("/trending/tv/week", language=lang),
        tmdb.get("/movie/popular", language=lang, region=reg),
        tmdb.get("/tv/popular", language=lang),
        tmdb.get("/movie/top_rated", language=lang, region=reg),
        tmdb.get("/tv/top_rated", language=lang),
        # /movie/upcoming is empty for many regions (e.g. CO), so use discover
        # with a future release date instead — region-independent and reliable.
        tmdb.get(
            "/discover/movie",
            language=lang,
            sort_by="popularity.desc",
            **{"primary_release_date.gte": date.today().isoformat()},
        ),
    )
    return {
        "trending_movies": trending_movies["results"],
        "trending_tv": trending_tv["results"],
        "popular_movies": popular_movies["results"],
        "popular_tv": popular_tv["results"],
        "top_rated_movies": top_movies["results"],
        "top_rated_tv": top_tv["results"],
        "upcoming_movies": upcoming["results"],
    }


@router.get("/search")
async def search(
    query: str = Query(min_length=1),
    type: str = Query(default="multi", pattern="^(multi|movie|tv|person)$"),
    page: int = Query(default=1, ge=1),
    language: Optional[str] = LanguageQuery,
):
    data = await tmdb.get(f"/search/{type}", query=query, page=page, language=_lang(language), include_adult=False)
    if type != "multi":
        for item in data["results"]:
            item.setdefault("media_type", type)
    return data


@router.get("/genres")
async def genres(language: Optional[str] = LanguageQuery):
    lang = _lang(language)
    movie_genres, tv_genres = await asyncio.gather(
        tmdb.get("/genre/movie/list", language=lang),
        tmdb.get("/genre/tv/list", language=lang),
    )
    return {"movie": movie_genres["genres"], "tv": tv_genres["genres"]}


@router.get("/discover/for-you")
async def for_you(
    language: Optional[str] = LanguageQuery,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Minimal personalized recommendations: TMDB `recommendations` for the
    user's highest-rated title, falling back to their most recently watched
    one. Blending multiple signals is a future iteration, not this one."""
    seed = db.scalar(select(models.Rating).filter_by(user_id=user.id).order_by(models.Rating.score.desc()))
    if seed is None:
        seed = db.scalar(
            select(models.WatchedItem).filter_by(user_id=user.id).order_by(models.WatchedItem.watched_at.desc())
        )
    if seed is None:
        return {"results": []}
    data = await tmdb.get(f"/{seed.media_type}/{seed.tmdb_id}/recommendations", language=_lang(language))
    for item in data["results"]:
        item.setdefault("media_type", seed.media_type)
    return data


@router.get("/discover/{media_type}")
async def discover(
    media_type: str,
    page: int = Query(default=1, ge=1),
    with_genres: Optional[str] = None,
    year: Optional[int] = None,
    min_rating: Optional[float] = Query(default=None, ge=0, le=10),
    sort_by: str = "popularity.desc",
    language: Optional[str] = LanguageQuery,
):
    """Filtered browsing by genre, year and minimum rating."""
    params = {
        "page": page,
        "language": _lang(language),
        "sort_by": sort_by,
        "with_genres": with_genres,
        "vote_average.gte": min_rating,
        # Avoid obscure titles dominating when sorting by rating
        "vote_count.gte": 100 if min_rating else None,
    }
    if year:
        if media_type == "movie":
            params["primary_release_year"] = year
        else:
            params["first_air_date_year"] = year
    data = await tmdb.get(f"/discover/{media_type}", **params)
    for item in data["results"]:
        item.setdefault("media_type", media_type)
    return data
```

- [ ] **Step 2: Verify the route ordering is correct**

Run: `cd backend && ./venv/bin/python -c "
from app.routers import discover
paths = [r.path for r in discover.router.routes]
assert paths.index('/discover/for-you') < paths.index('/discover/{media_type}'), paths
print('OK', paths)
"`
Expected: `OK [...]` with `/discover/for-you` listed before `/discover/{media_type}`.

- [ ] **Step 3: Verify it requires auth**

Run: `cd backend && ./venv/bin/uvicorn app.main:app --port 8000 & sleep 2 && curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/discover/for-you; kill %1`
Expected: `401`

- [ ] **Step 4: Commit**

```bash
cd backend && git add app/routers/discover.py
git commit -m "feat: add protected /discover/for-you recommendations endpoint"
```

---

## Task 7: Backend tests

**Files:**
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py` (empty)
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_auth.py`
- Create: `backend/tests/test_library.py`

**Interfaces:**
- Consumes: `app.main.app`, `app.database.Base`, `app.database.get_db` (existing), everything built in Tasks 1–6.
- Produces: a `client` pytest fixture (`fastapi.testclient.TestClient` wired to an isolated in-memory DB) reusable by any future backend test file.

- [ ] **Step 1: Make `app` importable from `tests/` regardless of cwd**

Create `backend/pytest.ini`:

```ini
[pytest]
pythonpath = .
```

- [ ] **Step 2: Create the tests package and fixture**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/conftest.py`:

```python
# Must run before any `app.*` import: app/config.py builds its Settings()
# singleton at import time, so these need to already be in the environment.
import os

os.environ.setdefault("TMDB_API_KEY", "test-tmdb-key")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models  # noqa: F401 — registers models on Base.metadata
from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    # StaticPool: keeps one shared in-memory DB across the multiple
    # connections FastAPI opens per request — without it, each connection
    # would see its own empty :memory: database.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

- [ ] **Step 3: Write the auth tests**

Create `backend/tests/test_auth.py`:

```python
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


def test_me_without_session(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout_clears_session(client):
    client.post("/api/auth/register", json={"email": "c@example.com", "password": "hunter222"})
    client.post("/api/auth/logout")
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401
```

- [ ] **Step 4: Run the auth tests**

Run: `cd backend && ./venv/bin/pytest tests/test_auth.py -v`
Expected: 5 passed

- [ ] **Step 5: Write the library-scoping tests**

Create `backend/tests/test_library.py`:

```python
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
```

- [ ] **Step 6: Run the full suite**

Run: `cd backend && ./venv/bin/pytest -v`
Expected: 8 passed

- [ ] **Step 7: Commit**

```bash
cd backend && git add pytest.ini tests/
git commit -m "test: cover auth flow and per-user library scoping"
```

---

## Task 8: Frontend — credentialed fetch client and auth store

**Files:**
- Modify: `frontend/src/api/client.js`
- Create: `frontend/src/store/useAuthStore.js`

**Interfaces:**
- Produces: `useAuthStore` (Zustand store) — state `{ user: {id, email} | null, loaded: boolean }`, actions `checkSession()`, `login(email, password)`, `register(email, password)`, `logout()`. Consumed by Tasks 9–11.

- [ ] **Step 1: Send the session cookie on every request**

Modify `frontend/src/api/client.js` — in `apiGet`, change:

```js
  const response = await fetch(url, { signal })
```

to:

```js
  const response = await fetch(url, { signal, credentials: 'include' })
```

And in `apiSend`, change:

```js
  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
```

to:

```js
  const response = await fetch(`${API_BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
```

- [ ] **Step 2: Create the auth store**

Create `frontend/src/store/useAuthStore.js`:

```js
import { create } from 'zustand'
import { apiGet, apiSend } from '../api/client'

// Mirrors the backend session: null user means "not logged in", not "not
// yet checked" — callers gate on `loaded` for that distinction.
export const useAuthStore = create((set) => ({
  user: null,
  loaded: false,

  async checkSession() {
    try {
      const user = await apiGet('/auth/me', {}, { fresh: true })
      set({ user, loaded: true })
    } catch {
      set({ user: null, loaded: true })
    }
  },

  async login(email, password) {
    const user = await apiSend('POST', '/auth/login', { email, password })
    set({ user })
    return user
  },

  async register(email, password) {
    const user = await apiSend('POST', '/auth/register', { email, password })
    set({ user })
    return user
  },

  async logout() {
    await apiSend('POST', '/auth/logout')
    set({ user: null })
  },
}))
```

- [ ] **Step 3: Verify the frontend still builds**

Run: `cd frontend && npm run build`
Expected: build succeeds (`vite build` output ending in `built in ...`), no import errors.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/api/client.js src/store/useAuthStore.js
git commit -m "feat: send credentials on API requests and add auth store"
```

---

## Task 9: Frontend — Login/Register pages and session bootstrap

**Files:**
- Modify: `frontend/src/i18n/translations.js`
- Create: `frontend/src/pages/Login.jsx`
- Create: `frontend/src/pages/Register.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 8), `useLibraryStore.load()` (existing), `PageHeader` (existing, `frontend/src/components/Grid.jsx`).
- Produces: routes `/login`, `/register`; on app boot, `useAuthStore.user` is populated (or confirmed `null`) before the library store attempts to load.

- [ ] **Step 1: Add translation keys**

Modify `frontend/src/i18n/translations.js` — add these keys to the `es` object, right after `home: 'Inicio',`:

```js
    home: 'Inicio',
    nav_login: 'Iniciar sesión',
    nav_logout: 'Cerrar sesión',
    auth_email: 'Correo',
    auth_password: 'Contraseña',
    auth_login_title: 'Inicia sesión',
    auth_register_title: 'Crea tu cuenta',
    auth_login_submit: 'Entrar',
    auth_register_submit: 'Registrarme',
    auth_no_account: '¿No tienes cuenta? Regístrate',
    auth_have_account: '¿Ya tienes cuenta? Inicia sesión',
    auth_error_invalid: 'Correo o contraseña incorrectos.',
    auth_error_email_taken: 'Ese correo ya está registrado.',
    library_login_required: 'Inicia sesión para ver tu biblioteca.',
```

And to the `en` object, right after `home: 'Home',`:

```js
    home: 'Home',
    nav_login: 'Log in',
    nav_logout: 'Log out',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_login_title: 'Log in',
    auth_register_title: 'Create your account',
    auth_login_submit: 'Log in',
    auth_register_submit: 'Sign up',
    auth_no_account: "Don't have an account? Sign up",
    auth_have_account: 'Already have an account? Log in',
    auth_error_invalid: 'Invalid email or password.',
    auth_error_email_taken: 'That email is already registered.',
    library_login_required: 'Log in to see your library.',
```

- [ ] **Step 2: Create the Login page**

Create `frontend/src/pages/Login.jsx`:

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { PageHeader } from '../components/Grid'

export function Login() {
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await useAuthStore.getState().login(email, password)
      await useLibraryStore.getState().load()
      navigate('/library')
    } catch {
      setError(t('auth_error_invalid'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={t('auth_login_title')} />
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email')}
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth_password')}
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
        />
        {error && <p className="text-sm text-marquee">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-marquee px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {t('auth_login_submit')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-dim">
        <Link to="/register" className="text-marquee hover:underline">{t('auth_no_account')}</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create the Register page**

Create `frontend/src/pages/Register.jsx`:

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { PageHeader } from '../components/Grid'

export function Register() {
  const t = useT()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await useAuthStore.getState().register(email, password)
      await useLibraryStore.getState().load()
      navigate('/library')
    } catch {
      setError(t('auth_error_email_taken'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 pb-16 pt-14 sm:px-8">
      <PageHeader title={t('auth_register_title')} />
      <form onSubmit={submit} className="space-y-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth_email')}
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth_password')}
          className="w-full rounded-full bg-surface px-4 py-2.5 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-marquee"
        />
        {error && <p className="text-sm text-marquee">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-marquee px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          {t('auth_register_submit')}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-dim">
        <Link to="/login" className="text-marquee hover:underline">{t('auth_have_account')}</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Wire routes and session bootstrap into `App.jsx`**

Replace the full contents of `frontend/src/App.jsx`:

```jsx
import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { Home } from './pages/Home'
import { useAppStore } from './store/useAppStore'
import { useAuthStore } from './store/useAuthStore'
import { useLibraryStore } from './store/useLibraryStore'
import { useT } from './i18n/translations'

// Route-level code splitting: detail/library pages load on demand.
const Search = lazy(() => import('./pages/Search').then((m) => ({ default: m.Search })))
const Discover = lazy(() => import('./pages/Discover').then((m) => ({ default: m.Discover })))
const MovieDetail = lazy(() => import('./pages/MovieDetail').then((m) => ({ default: m.MovieDetail })))
const TvDetail = lazy(() => import('./pages/TvDetail').then((m) => ({ default: m.TvDetail })))
const PersonDetail = lazy(() => import('./pages/PersonDetail').then((m) => ({ default: m.PersonDetail })))
const Watched = lazy(() => import('./pages/Watched').then((m) => ({ default: m.Watched })))
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0 }), [pathname])
  return null
}

function Fallback() {
  const t = useT()
  return <div className="flex min-h-[50vh] items-center justify-center pt-14 text-ink-dim">{t('loading')}</div>
}

export default function App() {
  const theme = useAppStore((s) => s.theme)
  const language = useAppStore((s) => s.language)
  const checkSession = useAuthStore((s) => s.checkSession)
  const user = useAuthStore((s) => s.user)
  const loadLibrary = useLibraryStore((s) => s.load)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (user) loadLibrary()
  }, [user, loadLibrary])

  return (
    <>
      <ScrollToTop />
      <NavBar />
      <main>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/movies" element={<Discover mediaType="movie" key="movie" />} />
            <Route path="/tv" element={<Discover mediaType="tv" key="tv" />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/tv/:id" element={<TvDetail />} />
            <Route path="/person/:id" element={<PersonDetail />} />
            <Route path="/watched" element={<Watched />} />
            <Route path="/library" element={<Library />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-line px-4 py-8 text-center sm:px-8">
        <p className="credit-label">
          CineScope — data & images from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="text-marquee hover:underline">
            TMDB
          </a>
        </p>
      </footer>
    </>
  )
}
```

- [ ] **Step 5: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no import errors.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/i18n/translations.js src/pages/Login.jsx src/pages/Register.jsx src/App.jsx
git commit -m "feat: add login/register pages and session bootstrap"
```

---

## Task 10: Frontend — NavBar auth UI

**Files:**
- Modify: `frontend/src/components/NavBar.jsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 8).

- [ ] **Step 1: Show login/logout in the NavBar**

Modify `frontend/src/components/NavBar.jsx`:

Change the import block at the top from:

```jsx
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/translations'
import { ApertureLogo, MoonIcon, SearchIcon, SunIcon } from './Icons'
```

to:

```jsx
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { useT } from '../i18n/translations'
import { ApertureLogo, MoonIcon, SearchIcon, SunIcon } from './Icons'
```

Change the top of the `NavBar` function from:

```jsx
export function NavBar() {
  const t = useT()
  const navigate = useNavigate()
  const { language, setLanguage, theme, toggleTheme } = useAppStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
```

to:

```jsx
export function NavBar() {
  const t = useT()
  const navigate = useNavigate()
  const { language, setLanguage, theme, toggleTheme } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
```

Add, right after the `submit` function (before the `return`):

```jsx
  const doLogout = async () => {
    await logout()
    navigate('/')
  }
```

Change the desktop controls block from:

```jsx
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
            title={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-ink-dim transition-colors hover:text-marquee"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <MoonIcon size={17} /> : <SunIcon size={17} />}
          </button>
        </div>
```

to:

```jsx
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-xs text-ink-dim sm:inline">{user.email}</span>
              <button
                onClick={doLogout}
                className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
              >
                {t('nav_logout')}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
            >
              {t('nav_login')}
            </Link>
          )}
          <button
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="credit-label rounded px-2 py-1 !tracking-[0.14em] transition-colors hover:!text-marquee"
            title={language === 'es' ? 'Switch to English' : 'Cambiar a español'}
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-ink-dim transition-colors hover:text-marquee"
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? <MoonIcon size={17} /> : <SunIcon size={17} />}
          </button>
        </div>
```

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no import/reference errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/NavBar.jsx
git commit -m "feat: show login/logout state in the nav bar"
```

---

## Task 11: Frontend — gate library actions and pages behind login

**Files:**
- Modify: `frontend/src/components/LibraryActions.jsx`
- Modify: `frontend/src/pages/Library.jsx`
- Modify: `frontend/src/pages/Watched.jsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 8).
- Produces: logged-out users get redirected to `/login` when they try a library action, and see a "log in to see your library" empty state on `/library` and `/watched` instead of a failed fetch.

- [ ] **Step 1: Gate `LibraryActions`**

Replace the full contents of `frontend/src/components/LibraryActions.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { ChevronIcon, EyeIcon, HeartIcon, PlusIcon, StarIcon } from './Icons'

// Full action bar for detail pages: watched, favorite, my rating, add-to-list.
export function LibraryActions({ mediaRef }) {
  const t = useT()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const key = `${mediaRef.media_type}:${mediaRef.tmdb_id}`
  const watched = useLibraryStore((s) => s.watchedKeys.has(key))
  const favorite = useLibraryStore((s) => s.favoriteKeys.has(key))
  const rating = useLibraryStore((s) => s.ratings.get(key) ?? null)
  const { toggleWatched, toggleFavorite, setRating } = useLibraryStore.getState()

  // Wraps a library action so logged-out users get sent to /login instead
  // of hitting the backend and getting a 401.
  const requireAuth = (action) => (...args) => {
    if (!user) {
      navigate('/login')
      return
    }
    return action(...args)
  }

  const onToggleWatched = requireAuth(() => toggleWatched(mediaRef))
  const onToggleFavorite = requireAuth(() => toggleFavorite(mediaRef))
  const onSetRating = requireAuth((score) => setRating(mediaRef, score))

  const pill = (active) =>
    `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
      active
        ? 'bg-marquee text-white ring-marquee'
        : 'bg-surface text-ink ring-line hover:text-marquee hover:ring-marquee'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={onToggleWatched} aria-pressed={watched} className={pill(watched)}>
        <EyeIcon size={16} filled={watched} />
        {watched ? t('marked_watched') : t('mark_watched')}
      </button>
      <button onClick={onToggleFavorite} aria-pressed={favorite} className={pill(favorite)}>
        <HeartIcon size={16} filled={favorite} />
        {favorite ? t('in_favorites') : t('add_favorite')}
      </button>
      <RatingControl value={rating} onChange={onSetRating} />
      <AddToList mediaRef={mediaRef} requireAuth={requireAuth} />
    </div>
  )
}

// 1–10 star strip. Clicking the current score clears it.
function RatingControl({ value, onChange }) {
  const t = useT()
  const [hover, setHover] = useState(null)
  const shown = hover ?? value ?? 0

  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 ring-1 ring-line"
      onMouseLeave={() => setHover(null)}
      role="radiogroup"
      aria-label={t('my_rating')}
    >
      <span className="credit-label hidden sm:inline">{t('my_rating')}</span>
      <div className="flex">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
          <button
            key={score}
            role="radio"
            aria-checked={value === score}
            aria-label={`${score}/10`}
            onMouseEnter={() => setHover(score)}
            onClick={() => onChange(value === score ? null : score)}
            className={`p-0.5 transition-colors ${score <= shown ? 'text-gold' : 'text-line'}`}
          >
            <StarIcon size={15} filled={score <= shown} />
          </button>
        ))}
      </div>
      {value && <span className="text-sm font-bold text-gold">{value}</span>}
    </div>
  )
}

function AddToList({ mediaRef, requireAuth }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const lists = useLibraryStore((s) => s.lists)
  const { addToList, removeFromList, createList } = useLibraryStore.getState()

  const inList = (list) =>
    list.items.some((i) => i.tmdb_id === mediaRef.tmdb_id && i.media_type === mediaRef.media_type)

  const createAndAdd = requireAuth(async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const created = await createList(name)
    await addToList(created.id, mediaRef)
    setNewName('')
  })

  const onToggleList = requireAuth((list) =>
    inList(list) ? removeFromList(list.id, mediaRef) : addToList(list.id, mediaRef)
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold ring-1 ring-line transition-colors hover:text-marquee hover:ring-marquee"
      >
        <PlusIcon size={16} />
        {t('add_to_list')}
        <ChevronIcon size={14} open={open} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 max-h-64 w-64 overflow-y-auto rounded-xl bg-surface p-2 shadow-xl ring-1 ring-line">
          {lists.length === 0 && (
            <p className="px-3 py-2 text-xs text-ink-dim">{t('lists_empty')}</p>
          )}
          {lists.map((list) => {
            const active = inList(list)
            return (
              <button
                key={list.id}
                onClick={() => onToggleList(list)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-paper"
              >
                <span className="truncate">{list.name}</span>
                {active && <span className="font-bold text-marquee">✓</span>}
              </button>
            )
          })}
          <form onSubmit={createAndAdd} className="mt-1 flex gap-1 border-t border-line pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('list_new_placeholder')}
              className="w-full rounded-lg bg-paper px-3 py-1.5 text-sm outline-none ring-1 ring-line focus:ring-marquee"
            />
            <button type="submit" className="rounded-lg bg-marquee px-2.5 text-white" aria-label={t('list_create')}>
              <PlusIcon size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Gate the `/library` page**

Modify `frontend/src/pages/Library.jsx` — change the import block from:

```jsx
import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { toMediaRef, useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { GridSkeleton, PageHeader } from '../components/Grid'
import { HeartIcon, PlusIcon, StarIcon, XIcon } from '../components/Icons'
import { EmptyState, MediaCardLite } from '../components/LibraryBits'
```

to:

```jsx
import { useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { toMediaRef, useLibraryStore } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { GridSkeleton, PageHeader } from '../components/Grid'
import { HeartIcon, PlusIcon, StarIcon, XIcon } from '../components/Icons'
import { EmptyState, MediaCardLite } from '../components/LibraryBits'
```

Change the `Favorites` function from:

```jsx
function Favorites() {
  const t = useT()
  const [items, setItems] = useState(null)
  const favoriteKeys = useLibraryStore((s) => s.favoriteKeys)
  const ratings = useLibraryStore((s) => s.ratings)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)

  useEffect(() => {
    apiGet('/library/favorites', {}, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [favoriteKeys.size])

  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-2xl">{t('favorites')}</span>
      </h2>
      {!items ? (
        <GridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState message={t('favorites_empty')} />
      ) : (
```

to:

```jsx
function Favorites() {
  const t = useT()
  const [items, setItems] = useState(null)
  const user = useAuthStore((s) => s.user)
  const favoriteKeys = useLibraryStore((s) => s.favoriteKeys)
  const ratings = useLibraryStore((s) => s.ratings)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)

  useEffect(() => {
    if (!user) {
      setItems([])
      return
    }
    apiGet('/library/favorites', {}, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [user, favoriteKeys.size])

  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-baseline gap-3">
        <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
        <span className="display text-2xl">{t('favorites')}</span>
      </h2>
      {!user ? (
        <EmptyState message={t('library_login_required')} />
      ) : !items ? (
        <GridSkeleton count={6} />
      ) : items.length === 0 ? (
        <EmptyState message={t('favorites_empty')} />
      ) : (
```

Change the start of the `Lists` function from:

```jsx
function Lists() {
  const t = useT()
  const lists = useLibraryStore((s) => s.lists)
  const { createList, deleteList, removeFromList } = useLibraryStore.getState()
  const [newName, setNewName] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    await createList(name)
    setNewName('')
  }

  return (
    <section>
```

to:

```jsx
function Lists() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const lists = useLibraryStore((s) => s.lists)
  const { createList, deleteList, removeFromList } = useLibraryStore.getState()
  const [newName, setNewName] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    await createList(name)
    setNewName('')
  }

  if (!user) {
    return (
      <section>
        <h2 className="mb-4 flex items-baseline gap-3">
          <span className="h-[3px] w-6 self-center bg-marquee" aria-hidden="true" />
          <span className="display text-2xl">{t('lists')}</span>
        </h2>
        <EmptyState message={t('library_login_required')} />
      </section>
    )
  }

  return (
    <section>
```

- [ ] **Step 3: Gate the `/watched` page**

Modify `frontend/src/pages/Watched.jsx` — change the import block from:

```jsx
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { useLibraryStore, toMediaRef } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { GridSkeleton, PageHeader } from '../components/Grid'
import { EyeIcon } from '../components/Icons'
import { EmptyState, MediaCardLite } from '../components/LibraryBits'
import { EpisodeProgress } from '../components/EpisodeProgress'
```

to:

```jsx
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api/client'
import { useAuthStore } from '../store/useAuthStore'
import { useLibraryStore, toMediaRef } from '../store/useLibraryStore'
import { useT } from '../i18n/translations'
import { GridSkeleton, PageHeader } from '../components/Grid'
import { EyeIcon } from '../components/Icons'
import { EmptyState, MediaCardLite } from '../components/LibraryBits'
import { EpisodeProgress } from '../components/EpisodeProgress'
```

Change the top of `Watched` (through the `useEffect`) from:

```jsx
export function Watched() {
  const t = useT()
  const [sort, setSort] = useState('watched_at')
  const [order, setOrder] = useState('desc')
  const [items, setItems] = useState(null)
  const toggleWatched = useLibraryStore((s) => s.toggleWatched)

  const fetchItems = useCallback(() => {
    apiGet('/library/watched', { sort, order }, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [sort, order])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])
```

to:

```jsx
export function Watched() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const [sort, setSort] = useState('watched_at')
  const [order, setOrder] = useState('desc')
  const [items, setItems] = useState(null)
  const toggleWatched = useLibraryStore((s) => s.toggleWatched)

  const fetchItems = useCallback(() => {
    if (!user) {
      setItems([])
      return
    }
    apiGet('/library/watched', { sort, order }, { fresh: true })
      .then(setItems)
      .catch(() => setItems([]))
  }, [user, sort, order])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])
```

Change the render block from:

```jsx
      {!items ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState message={t('watched_empty')} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <WatchedCard key={item.id} item={item} onUnmark={() => unmark(item)} />
          ))}
        </div>
      )}

      <EpisodeProgress />
```

to:

```jsx
      {!user ? (
        <EmptyState message={t('library_login_required')} />
      ) : !items ? (
        <GridSkeleton />
      ) : items.length === 0 ? (
        <EmptyState message={t('watched_empty')} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((item) => (
            <WatchedCard key={item.id} item={item} onUnmark={() => unmark(item)} />
          ))}
        </div>
      )}

      {user && <EpisodeProgress />}
```

- [ ] **Step 4: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no import/reference errors.

- [ ] **Step 5: Manual end-to-end verification**

Run the backend (`cd backend && ./venv/bin/uvicorn app.main:app --reload`) and the frontend (`cd frontend && npm run dev`) in separate terminals, then in a browser at the Vite dev URL:

1. Open a movie detail page while logged out, click "Mark as watched" → redirected to `/login`.
2. Go to `/register`, create an account → redirected to `/library`, NavBar shows your email and a logout link.
3. Go back to that movie, mark it watched and favorite it, give it a rating → all three persist (reload the page, they're still set).
4. Visit `/watched` and `/library` → the movie appears in both.
5. Click logout in the NavBar → NavBar shows "Log in"; `/watched` and `/library` now show the "log in to see your library" empty state instead of your data.
6. Log back in with the same account → the movie is still marked watched/favorite/rated (proves it was persisted server-side under your `user_id`, not just client state).

Expected: all six steps behave as described, with no console errors in the browser dev tools.

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/components/LibraryActions.jsx src/pages/Library.jsx src/pages/Watched.jsx
git commit -m "feat: gate library actions and pages behind login"
```
