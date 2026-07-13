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
