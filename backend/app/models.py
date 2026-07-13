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
