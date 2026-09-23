# Storytime v2 - Rebuild Plan (100% free & open-source)

**Goal:** rebuild the Cross-Platform Activity Timeline Builder so it runs entirely on
free / open-source materials - no paid API keys required, self-hostable, zero-cost.

## Decisions (locked 2026-09-23)
1. **Full clean rebuild** into an npm-workspaces monorepo. Keep working logic (data model,
   NLP approach, UI components), drop the rot (duplicate NLP files, double DB stack).
2. **Replace paid Twitter/X** with **Mastodon** (public OSS API) + **Bluesky**
   (`public.api.bsky.app`, no auth for public feeds).
3. **Optional local LLM via Ollama** (off by default) for summaries / entity extraction,
   with graceful fallback to the classic `natural`/`compromise` pipeline.

## Free/OSS source matrix
| Source | Endpoint | Auth | Cost |
|---|---|---|---|
| GitHub | `api.github.com/users/:u/events/public` | token **optional** (raises rate limit) | free |
| Reddit | `reddit.com/user/:u/.json` (public JSON) | **none** | free |
| RSS/blogs | any feed URL via `rss-parser` | none | free |
| Mastodon | `:instance/api/v1/accounts/lookup` + `/statuses` | none (public) | free |
| Bluesky | `public.api.bsky.app/.../getAuthorFeed` | none (public) | free |
| Pastebin | `pastebin.com/raw/:id` (by id/url) | none | free |
| Geocoding | Nominatim (OpenStreetMap) | none (UA + 1 req/s) | free |
| Map tiles | OpenStreetMap via Leaflet | none | free |
| NLP | `natural` + `compromise` (local) | none | free |
| LLM (opt) | Ollama (local) | none | free |
| DB | SQLite via `better-sqlite3` (embedded) | none | free |

## Monorepo layout
```
packages/core   @storytime/core   - ingest + enrich + export engine + CLI (no server deps)
apps/server     @storytime/server - express + better-sqlite3 + REST + SSE, wraps core
apps/web        @storytime/web    - React + Vite + MUI UI (adapted from legacy timeline-ui)
docker-compose.yml + Dockerfiles + .env.example + README
legacy/         archived original code (reference only)
```

## Status
- [x] branch `v2-rebuild`, archive old tree to `legacy/`
- [x] core: types, config, http util, ingesters, processors, exporters, ai, builder, CLI - **tsc clean**
- [x] LIVE-PROBED 2026-09-23: GitHub ✅ Bluesky ✅ Mastodon ✅ (all keyless).
      Reddit → HTTP 403 from cloud egress (known 2024+ block); added FREE optional
      OAuth path (REDDIT_CLIENT_ID/SECRET) + best-effort keyless fallback. Honest, not overclaimed.
- [ ] server: sqlite store + REST + SSE
- [ ] web: adapt timeline-ui to new API + platforms
- [ ] docker compose + env.example + README + root scripts
