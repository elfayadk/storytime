# Storytime v2.5 - the "from the future" layer

All of this is **free, local, and graceful-degrading**. Nothing here requires a
paid API or breaks the zero-setup base. Every capability probes for the best
available engine and silently falls back.

## The 3-tier embedding provider chain (invented for zero-setup semantics)
Every semantic feature runs on vectors from the best *available* provider:

1. **Ollama** `nomic-embed-text` - if the user already enabled local AI. Best quality.
2. **Transformers.js** `all-MiniLM-L6-v2` (ONNX, in-process) - no server, downloads
   the model once (~25 MB), then fully offline. Great quality.
3. **Hashed lexical embedding** - a dependency-free, deterministic bag-of-words
   hashing vector. Instant, always available, needs nothing installed. Lower
   quality but keeps semantic search/clustering working with ZERO setup.

Downstream code is provider-agnostic: it just gets normalized `Float32` vectors.

## Flagship capabilities
- **Semantic search** - `?q=` is embedded and matched by meaning, not keywords.
  Vectors persist as BLOBs in the same SQLite file; KNN is in-process cosine
  (correct + fast at timeline scale). The schema is **sqlite-vec-ready** for a
  future million-vector ANN swap without touching the API.
- **Semantic topic clustering** - cluster event embeddings (online cosine
  clustering) → coherent themes that beat TF-IDF keyword salad.
- **Ask-your-timeline (local RAG)** - embed the question, retrieve top-k events,
  ground a local Ollama answer with inline citations. No cloud, no key.
- **Semantic timeline compression** - collapse hundreds of events into a few
  narrated theme-clusters (an LLM one-liner per cluster) so a 500-event dump
  becomes a readable story.

## Invented differentiators (deterministic, no ML needed - always on)
- **Cross-post fusion (SimHash)** - same content posted to Mastodon + Bluesky is
  detected by 64-bit SimHash + timestamp proximity and merged into one event
  with multiple source links. Cleaner, dedup'd timeline.
- **Temporal burst / change-point detection** - z-score on daily volume +
  rolling sentiment flags "something happened here" moments.
- **Stylometry fingerprint** - cheap per-identity style vector (function-word
  rate, emoji rate, sentence length, punctuation, lexical diversity) used to
  gauge whether two handles are plausibly the same author.

## Engineering stance
- Pure/deterministic parts (SimHash, burst, stylometry, cosine, clustering) are
  unit-tested and need no model/network.
- Neural parts are lazy-loaded and optional; failure never breaks a build.
