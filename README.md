# 📅 Storytime v2

**Cross-platform activity timeline builder - 100% free & open-source.**

Give it a username, handle, or `#hashtag` and Storytime pulls that identity's
public activity across the web, normalizes it into one chronological timeline,
enriches every event with local NLP (sentiment, entities, topics, geolocation),
and visualizes it - with **no paid API keys and no cloud services required**.

Everything runs on free, public endpoints and open-source libraries. You can run
the whole thing offline-capable on your own machine.

---

## ✨ What's new in v2

- **No paid APIs.** The old build needed a paid Twitter/X API key, a paid
  Pastebin PRO key, and a MongoDB **and** Postgres server. All gone.
- **Free social sources:** **Mastodon** and **Bluesky** replace Twitter/X - both
  have open, public, keyless APIs.
- **Embedded storage:** a single **SQLite** file replaces the dual DB stack. No
  database server to run.
- **Free maps & geocoding:** OpenStreetMap tiles + Nominatim geocoding.
- **Optional local AI:** plug in **[Ollama](https://ollama.com)** for AI
  summaries/narratives - runs on your machine, no API key, gracefully off by default.
- **Clean monorepo:** shared `core` engine, `server`, and `web` UI. One
  `docker compose up` to run it all.

## 🧠 Intelligence layer (all free & local, graceful-degrading)

Storytime doesn't just aggregate - it *understands*. Every feature below runs
locally and falls back cleanly, so it works with **zero setup** and gets sharper
as you opt in. See [`docs/ADVANCED.md`](docs/ADVANCED.md).

- **Infrastructure recon** (Recon mode) - point it at a domain or IP and it runs a
  connector sweep on public data: subdomains from Certificate Transparency logs
  (crt.sh), DNS-over-HTTPS records, Shodan InternetDB (open ports, CVEs, tags),
  and Wayback Machine history. Every result carries a provenance envelope (source
  URL, fetch time, sha256, license, source tier), values attested by multiple
  sources are **corroborated**, and the whole sweep can be exported as a
  **sealed evidence bundle** whose integrity anyone can re-verify:
  `node scripts/verify-bundle.mjs <file>` (Merkle-rooted, tamper-evident).
  See [RESPONSIBLE-USE.md](RESPONSIBLE-USE.md).
- **Live streaming** - tail the Bluesky Jetstream firehose or public Nostr relays in real time for a handle or #hashtag; new matching posts append as they publish.
- **Knowledge graph** - a local model (or rule-based signals) extracts bi-temporal facts (`who did what, when`) with valid-from/valid-to and evidence, so you can "time travel" and see what was true on any past date.
- **Story arcs** - events cluster into themes over time, each arc dated and linked to its key moments.
- **Hybrid search** - BM25 keyword (FTS5) + vector + reciprocal rank fusion for sharper retrieval; plus change-point detection (BOCPD) and coordination detection, and multilingual embeddings (Arabic and mixed-language, RTL-aware).
- **Semantic search** - query events by *meaning*, not keywords (`?q=performance`
  finds "made it 3x faster" even without the word).
- **Ask-your-timeline (local RAG)** - ask a question; get an answer grounded in
  the retrieved events with citations, synthesized by a local Ollama model.
- **Semantic themes** - events are embedded and clustered into coherent topics.
- **Notable moments** - activity bursts and sentiment change-points are detected
  and surfaced ("📈 2026-01-06 - activity burst, 3.1σ above baseline").
- **Cross-post fusion** - the same post on Mastodon + Bluesky is detected via
  SimHash and merged into one event with all source links.
- **3-tier embedding chain** (auto-selected): **Ollama** `nomic-embed-text` →
  **Transformers.js** `all-MiniLM-L6-v2` (in-process, no server) → a dependency-free
  **hashed** fallback that always works. Enable tier 2 with
  `npm i @huggingface/transformers`; tier 1 by running Ollama.

## 🌐 Data sources (all free, no paid keys)

| Source | How | Auth |
|---|---|---|
| **GitHub** | public events API | token optional (raises rate limit) |
| **Mastodon** | public account statuses | none |
| **Bluesky** | public AppView (`public.api.bsky.app`) | none |
| **Hacker News** | public Algolia search API | none |
| **Dev.to** | public articles API | none |
| **GitLab** | public REST API v4 | none |
| **Wikipedia** | MediaWiki usercontribs API | none |
| **Stack Overflow** | public Stack Exchange API | none |
| **Blog (auto)** | RSS/Atom auto-discovered from the profile's site | none |
| **Reddit** | public JSON / free OAuth app | none, or free app for reliability¹ |
| **RSS/Atom** | any feed URL | none |
| **Pastebin** | public raw pastes by ID | none |
| **Geocoding** | OpenStreetMap Nominatim | none |
| **NLP** | `natural` + `compromise` (local) | none |
| **AI (optional)** | Ollama (local) | none |

¹ Reddit blocks unauthenticated `.json` from many datacenter/cloud IPs. It works
from most home networks; for guaranteed access, register a **free** "script" app
at <https://www.reddit.com/prefs/apps> and set `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`.

---

## 🚀 Quick start

### Option A - Docker (one command)
```bash
cp .env.example .env          # optional: everything works with all values blank
docker compose up --build     # → http://localhost:3000
# with local AI:
docker compose --profile ai up --build
```

### Option B - Local dev
```bash
npm install
npm run build --workspace @storytime/core   # build the shared engine once
npm run dev:server    # API on :3000
npm run dev:web       # UI on :5173 (proxies /api to :3000)
```

### Option C - CLI only (no server/UI)
```bash
npm run build --workspace @storytime/core
npm run cli -- torvalds -p github,mastodon,bluesky -f md
# write an interactive HTML timeline:
npm run cli -- Gargron@mastodon.social -p mastodon -f html -o timeline.html
```

CLI options: `-p/--platforms`, `-l/--limit`, `-f/--format (json|csv|md|xml|html)`,
`-o/--output`, `--since`, `--until`, `--rss`, `--pastebin`, `--ai`, `--no-geo`.

---

## 🏗️ Architecture

```
packages/core   @storytime/core   ingest → enrich → export engine + CLI (zero server deps)
apps/server     @storytime/server Express REST + SSE, SQLite persistence
apps/web        @storytime/web    React + Vite + MUI UI (charts, OSM map, filters, export)
legacy/         the original v1 code, kept for reference
```

**Pipeline:** `ingest` (parallel per platform) → `enrich` (dedupe, sort,
sentiment, entities, topics, geocode, optional AI) → `analyze` (stats + interaction
graph) → optional AI narrative → export.

### API
- `GET  /api/health` - status + AI availability
- `GET  /api/timeline/stream?target=…` - build with live SSE progress (used by the UI)
- `POST /api/timeline` - build synchronously `{ target, platforms, limit, rss, pastebin, ai }`
- `GET  /api/timelines` · `GET /api/timelines/:id` · `DELETE /api/timelines/:id`
- `GET  /api/timelines/:id/export.{json|csv|md|xml|html}`
- `GET  /api/timelines/:id/search?q=…` - hybrid (BM25 + vector) search over the timeline
- `POST /api/timelines/:id/ask` - `{ question }` → grounded local-RAG answer + sources
- `GET  /api/v2/sources` - connector capability matrix (which sources are reachable now)
- `POST /api/v2/collect/:connectorId` - `{ target }` → run one connector. Infrastructure: crtsh, dns, internetdb, wayback. Records/media (name or org): opensanctions, gleif, sec, courtlistener, gdelt, openalex.
- `POST /api/v2/recon` - `{ target }` → run every applicable connector (domain/IP → infra; name/org → records + media) with cross-source corroboration
- `POST /api/v2/recon/bundle` - `{ target }` → download a sealed, re-verifiable evidence bundle

---

## 🔒 Notes & etiquette

- Storytime only reads **public** data and respects each source's rate limits
  (e.g. Nominatim's 1 req/s policy). Use it responsibly and within each
  platform's terms.
- No analytics, no telemetry, no external calls beyond the sources you choose.

## 📄 License
MIT.
