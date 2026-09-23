import type { TimelineResult } from '../types.js';
import { serializeResult } from '../util/serialize.js';

const PLATFORM_ICON: Record<string, string> = {
  github: '💻',
  reddit: '👽',
  rss: '📰',
  mastodon: '🐘',
  bluesky: '🦋',
  pastebin: '📋',
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** A single-file, dependency-free HTML timeline. Opens directly in a browser. */
export function toHTML(result: TimelineResult): string {
  const data = serializeResult(result);
  const rows = data.events
    .map((e) => {
      const icon = PLATFORM_ICON[e.platform] ?? '•';
      const mood = e.sentiment?.label ?? 'neutral';
      const time = new Date(e.timestamp).toLocaleString();
      return `<article class="ev ${mood}" data-platform="${e.platform}">
        <div class="meta"><span class="ic">${icon}</span><span class="pl">${e.platform}</span>
        <time>${esc(time)}</time><span class="mood ${mood}">${mood}</span></div>
        <h3><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a></h3>
        ${e.summary ? `<p class="sum">${esc(e.summary)}</p>` : ''}
        <p class="body">${esc(e.content.slice(0, 400))}</p>
        ${(e.topics ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
      </article>`;
    })
    .join('\n');

  const platforms = Object.entries(data.stats.byPlatform)
    .map(([p, n]) => `${PLATFORM_ICON[p] ?? ''} ${p}: ${n}`)
    .join(' · ');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storytime - ${esc(data.target)}</title>
<style>
:root{--bg:#0f1220;--card:#191d33;--fg:#e8eaf6;--muted:#9aa0c3;--pos:#31c48d;--neg:#f05252;--neu:#6b7280;--accent:#7c8cff}
@media(prefers-color-scheme:light){:root{--bg:#f6f7fb;--card:#fff;--fg:#1a1c2b;--muted:#5a607d;--accent:#4f5bd5}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{padding:24px 16px;border-bottom:1px solid rgba(128,128,128,.2)}
h1{margin:0 0 6px;font-size:22px}.sub{color:var(--muted);font-size:14px}
main{max-width:820px;margin:0 auto;padding:16px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.filters button{background:var(--card);color:var(--fg);border:1px solid rgba(128,128,128,.25);border-radius:20px;padding:6px 12px;cursor:pointer}
.filters button.active{background:var(--accent);border-color:var(--accent);color:#fff}
.ev{background:var(--card);border-radius:12px;padding:14px 16px;margin:10px 0;border-left:3px solid var(--neu)}
.ev.positive{border-left-color:var(--pos)}.ev.negative{border-left-color:var(--neg)}
.meta{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:12px;margin-bottom:4px}
.pl{text-transform:capitalize;font-weight:600}.mood{margin-left:auto;text-transform:uppercase;font-size:10px}
.mood.positive{color:var(--pos)}.mood.negative{color:var(--neg)}
h3{margin:2px 0 6px;font-size:16px}h3 a{color:var(--fg);text-decoration:none}h3 a:hover{color:var(--accent)}
.sum{font-style:italic;color:var(--muted);margin:4px 0}.body{margin:4px 0;white-space:pre-wrap;word-break:break-word}
.tag{display:inline-block;background:rgba(124,140,255,.15);color:var(--accent);border-radius:6px;padding:1px 7px;font-size:11px;margin:2px 4px 0 0}
</style></head>
<body>
<header><h1>${PLATFORM_ICON.mastodon}📅 Storytime - ${esc(data.target)}</h1>
<div class="sub">${data.stats.totalEvents} events · ${esc(platforms)} · generated ${esc(data.generatedAt)}</div>
${data.narrative ? `<p class="sub" style="margin-top:8px">${esc(data.narrative)}</p>` : ''}</header>
<main>
<div class="filters" id="filters"><button class="active" data-f="all">All</button>
${Object.keys(data.stats.byPlatform).map((p) => `<button data-f="${p}">${PLATFORM_ICON[p] ?? ''} ${p}</button>`).join('')}</div>
<div id="list">${rows}</div>
</main>
<script>
const btns=[...document.querySelectorAll('#filters button')];
btns.forEach(b=>b.onclick=()=>{btns.forEach(x=>x.classList.remove('active'));b.classList.add('active');
const f=b.dataset.f;document.querySelectorAll('.ev').forEach(e=>{e.style.display=(f==='all'||e.dataset.platform===f)?'':'none'})});
</script>
</body></html>`;
}
