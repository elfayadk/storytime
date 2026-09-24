# Responsible Use

Storytime aggregates and analyzes **public** information. Like any OSINT tool it
is dual-use: the same capability that helps a journalist, researcher, or security
team can be misused to harass or surveil a private person. These rules are built
into the system, not just written here.

## Hard rules (enforced in code)

1. **Public data only.** The system never bypasses authentication, CAPTCHAs,
   paywalls, or access controls, and never touches a target system directly
   (no port scanning third parties, no credential use). Passive collection of
   public sources only.
2. **Provenance on everything.** Every event, record, and connector result stores
   its source URL, fetch timestamp, and content hash. No unattributed intelligence.
3. **Rate limits are respected** as hard constraints (for example Nominatim's
   1 request/second and crt.sh politeness).
4. **Sensitive capabilities are off by default.** Face recognition, session-based
   social scrapers (X/Instagram), and any direct-Tor dark-web fetching are
   opt-in, isolated, and clearly labeled. Dark-web monitoring uses clearweb
   mirrors, never an unfiltered onion crawler.
5. **Analyst-in-the-loop.** Automated analysis proposes; a human approves.
   High-stakes conclusions (identifying a person, attributing coordination) are
   marked and require review before they appear in an exported report.

## Not for

- Employment, tenant, or credit screening (FCRA-style decisions).
- Profiling, locating, or unmasking private individuals against their will.
- Stalking, harassment, or any unlawful surveillance.

## Your responsibility

You are responsible for the lawfulness of your use in your jurisdiction, including
GDPR and equivalent regimes where "publicly available" is not, by itself, a lawful
basis. Minimize what you collect, verify before you publish, and weigh public
interest and proportionality.
