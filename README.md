# CineScope

CineScope is a movie and TV discovery web application. It gives you a single, beautifully designed place to explore what to watch next: browse trending, popular and upcoming titles, search across movies, shows and people in real time, and dive into immersive detail pages with full cast and crew, trailers, ratings, recommendations and — crucially — where each title is actually available to stream, rent or buy in your country.

## Purpose

Finding *what* to watch is easy; keeping track of *your* relationship with what you watch is not. Catalog sites show you data, but your watchlist, your ratings and your viewing history usually end up scattered across streaming platforms (or in your head). CineScope solves that by pairing a rich catalog experience with a personal layer that belongs to you:

- **Watched tracking** — mark any movie or show as watched from anywhere in the app, and review your full viewing history in a dedicated section, sortable by date watched, title or rating.
- **Favorites and custom lists** — save titles you love and organize anything into personal lists ("Want to watch", "Watched", or your own).
- **Personal ratings** — score titles on your own scale, independent of public ratings.
- **Where to watch** — streaming availability by country (subscription, rent, buy), so discovery ends in actually watching.

What makes it different from just browsing a catalog site: the catalog is public data, but the experience is personal. Your history and lists live in CineScope's own database, not in a third-party account, and the interface is designed as a cinematic, dark-first experience rather than a generic data grid. The app is fully bilingual, with an instant English/Spanish language switch that covers both the interface and the catalog content itself.

## Tech Stack

- **Frontend:** React (Vite), React Router, Zustand, Tailwind CSS
- **Backend:** Python + FastAPI (async), acting as a middle layer over the TMDB API — hiding the API key, caching responses and merging multiple TMDB endpoints into single, frontend-friendly responses
- **Database:** SQLite with SQLAlchemy (development) / PostgreSQL (production)
- **Data source:** [The Movie Database (TMDB)](https://www.themoviedb.org/)

This product uses the TMDB API but is not endorsed or certified by TMDB.

## Deployment

The frontend and backend deploy separately.

**Backend (Render)** — a `render.yaml` blueprint at the repo root defines both the API web service and a free PostgreSQL database:

1. On [Render](https://render.com), New → Blueprint, connect this repo.
2. Render provisions `cinescope-api` (web service) and `cinescope-db` (Postgres), wiring `DATABASE_URL` automatically.
3. Set the `TMDB_API_KEY` secret in the `cinescope-api` service's environment settings.
4. Once deployed, note the service URL (e.g. `https://cinescope-api.onrender.com`).

**Frontend (Vercel):**

1. On [Vercel](https://vercel.com), New Project, import this repo, set the root directory to `frontend`.
2. Add an environment variable `VITE_API_BASE_URL` set to the Render backend URL from above.
3. Deploy. Vercel auto-detects Vite and applies the SPA rewrite rules in `frontend/vercel.json`.

**Finally**, go back to the Render `cinescope-api` service and set `CORS_ORIGINS` to your Vercel URL (e.g. `https://cinescope.vercel.app`), then redeploy the backend so it accepts requests from the live frontend.
