import type { TimelineResult } from '../types.js';
import { serializeResult } from '../util/serialize.js';

const PLATFORM: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  reddit: 'Reddit',
  rss: 'RSS',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  pastebin: 'Pastebin',
  hackernews: 'Hacker News',
  devto: 'Dev.to',
  wikipedia: 'Wikipedia',
  stackexchange: 'Stack Overflow',
  medium: 'Medium',
  lemmy: 'Lemmy',
  npm: 'npm',
  youtube: 'YouTube',
};

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A self-contained "dossier" report: profile, brief, signals, rhythm, themes,
 * notable moments, interactions, and the full timeline with a source link on
 * every entry. One HTML file, no external assets beyond fonts.
 */
export function toDossier(result: TimelineResult): string {
  const r = serializeResult(result);
  const p = r.profile;
  const rhythm = r.rhythm;

  const sourceBadges = Object.entries(r.stats.byPlatform)
    .map(([k, n]) => `<span class="badge">${esc(PLATFORM[k] ?? k)} <b>${n}</b></span>`)
    .join('');

  const profileBlock = p
    ? `<section class="card profile">
        ${p.avatarUrl ? `<img class="avatar" src="${esc(p.avatarUrl)}" alt="" />` : ''}
        <div>
          <div class="pname">${esc(p.displayName ?? p.handle)}</div>
          <a class="phandle" href="${esc(p.url)}">${esc(p.url.replace(/^https?:\/\//, ''))}</a>
          ${p.bio ? `<p class="pbio">${esc(p.bio)}</p>` : ''}
          <div class="pmeta">
            ${p.location ? `<span>${esc(p.location)}</span>` : ''}
            ${p.company ? `<span>${esc(p.company)}</span>` : ''}
            ${p.followers != null ? `<span>${p.followers} followers</span>` : ''}
            ${p.repos != null ? `<span>${p.repos} repos</span>` : ''}
            ${p.joined ? `<span>joined ${fmtDate(p.joined)}</span>` : ''}
          </div>
          ${p.topLanguages?.length ? `<div class="tags">${p.topLanguages.map((l) => `<span class="tag">${esc(l.name)}</span>`).join('')}</div>` : ''}
          ${p.topRepos?.length ? `<div class="repos">${p.topRepos.map((rp) => `<a class="repo" href="${esc(rp.url)}"><b>${esc(rp.name)}</b> <span>&#9733; ${rp.stars}</span>${rp.description ? `<em>${esc(rp.description)}</em>` : ''}</a>`).join('')}</div>` : ''}
        </div>
      </section>`
    : '';

  const briefBlock = r.brief ? `<section class="card"><h2>Brief</h2><p class="brief">${esc(r.brief).replace(/\n/g, '<br>')}</p></section>` : '';

  const signals = `<section class="signals">
      <div><div class="num">${r.stats.totalEvents}</div><div class="lbl">events, ${Object.keys(r.stats.byPlatform).length} platforms</div></div>
      <div><div class="num sm">${rhythm ? `${String(rhythm.activeWindow.startHour).padStart(2, '0')}:00 to ${String(rhythm.activeWindow.endHour).padStart(2, '0')}:00` : 'n/a'}</div><div class="lbl">most active hours</div></div>
      <div><div class="num sm">${esc(r.clusters?.[0]?.label ?? r.stats.topTopics[0]?.topic ?? 'n/a')}</div><div class="lbl">leading theme</div></div>
      <div><div class="num sm">${r.stats.sentiment.positive}/${r.stats.sentiment.neutral}/${r.stats.sentiment.negative}</div><div class="lbl">tone (pos/neu/neg)</div></div>
    </section>`;

  const heatMax = rhythm ? Math.max(1, ...rhythm.grid.flat()) : 1;
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const heatmap = rhythm
    ? `<section class="card"><h2>Activity rhythm</h2><div class="heat">
        ${rhythm.grid.map((row, d) => `<div class="hrow"><span class="hlbl">${DOW[d]}</span>${row.map((c) => `<i style="opacity:${c === 0 ? 0.06 : 0.18 + (c / heatMax) * 0.82}"></i>`).join('')}</div>`).join('')}
      </div><div class="hcap">${esc(rhythm.summary)}</div></section>`
    : '';

  const themes = r.clusters?.length
    ? `<section class="card half"><h2>Themes</h2>${r.clusters.slice(0, 7).map((c) => `<div class="row"><b class="c">${c.size}</b><span>${esc(c.label)}</span></div>`).join('')}</section>`
    : '';
  const moments = r.insights?.length
    ? `<section class="card half"><h2>Notable moments</h2>${r.insights.slice(0, 7).map((i) => `<div class="row"><b class="c">${i.type === 'burst' ? '&#9650;' : '&#9670;'}</b><span><b>${esc(i.date)}</b> ${esc(i.detail)}</span></div>`).join('')}</section>`
    : '';

  const topEdges = (r.graph?.edges ?? []).slice(0, 12);
  const interactions = topEdges.length
    ? `<section class="card"><h2>Top interactions</h2>${topEdges.map((e) => `<div class="row"><b class="c">${e.weight}</b><span>${esc(e.source)} &rarr; ${esc(e.target)}</span></div>`).join('')}</section>`
    : '';

  let lastDay = '';
  const timeline = r.events
    .map((e) => {
      const day = e.timestamp.slice(0, 10);
      const head = day !== lastDay ? `<div class="day">${fmtDate(e.timestamp)}</div>` : '';
      lastDay = day;
      const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${head}<article class="ev ${esc(e.sentiment?.label ?? 'neutral')}">
        <div class="evm"><span class="t">${esc(time)}</span> <span class="pl">${esc(PLATFORM[e.platform] ?? e.platform)}</span></div>
        <a class="evt" href="${esc(e.url)}">${esc(e.title)}</a>
        ${e.summary ? `<p class="evs">${esc(e.summary)}</p>` : e.content ? `<p class="evb">${esc(e.content.slice(0, 280))}</p>` : ''}
      </article>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dossier - ${esc(r.target)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
<style>
:root{--ink:#0d131c;--panel:#131d2a;--raised:#1b2735;--line:rgba(226,232,240,.09);--text:#e8edf4;--muted:#93a0b4;--faint:#61708a;--signal:#f0b24a;--pos:#6ac492;--neg:#e58173;--serif:"Fraunces",Georgia,serif;--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",monospace}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.55}
.wrap{max-width:860px;margin:0 auto;padding:32px 20px 80px}
h1{font-family:var(--serif);font-weight:600;font-size:38px;letter-spacing:-.02em;margin:0 0 10px}
h2{font-family:var(--serif);font-weight:600;font-size:16px;color:var(--muted);margin:0 0 12px}
.sub{color:var(--muted);font-family:var(--mono);font-size:12.5px;margin-bottom:10px}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px}
.badge{border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-size:12px}.badge b{color:var(--muted);font-family:var(--mono)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:640px){.grid2{grid-template-columns:1fr}}
.profile{display:flex;gap:18px}.avatar{width:76px;height:76px;border-radius:14px;flex:none}
.pname{font-family:var(--serif);font-size:22px;font-weight:600}.phandle{color:var(--signal);text-decoration:none;font-family:var(--mono);font-size:12.5px}
.pbio{margin:8px 0;color:var(--text)}.pmeta{display:flex;flex-wrap:wrap;gap:12px;color:var(--muted);font-size:12.5px;font-family:var(--mono)}
.tags{margin-top:10px;display:flex;flex-wrap:wrap;gap:5px}.tag{background:rgba(240,178,74,.13);color:var(--signal);border-radius:6px;padding:1px 8px;font-size:11.5px}
.repos{margin-top:12px;display:flex;flex-direction:column;gap:6px}.repo{color:var(--text);text-decoration:none;font-size:13px}.repo span{color:var(--signal);font-family:var(--mono);font-size:11.5px}.repo em{color:var(--muted);font-style:normal;display:block;font-size:12px}
.brief{white-space:pre-wrap;line-height:1.65}
.signals{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:16px}
.signals>div{padding:16px 18px;border-right:1px solid var(--line)}.signals .num{font-family:var(--serif);font-size:28px;font-weight:600}.signals .num.sm{font-size:18px}.signals .lbl{color:var(--muted);font-size:12px;margin-top:6px}
.heat{display:flex;flex-direction:column;gap:3px}.hrow{display:flex;gap:3px;align-items:center}.hlbl{width:34px;font-size:10.5px;color:var(--faint);font-family:var(--mono)}.hrow i{flex:1;height:14px;border-radius:3px;background:var(--signal)}
.hcap{margin-top:10px;color:var(--muted);font-family:var(--mono);font-size:12px}
.row{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}.row .c{font-family:var(--serif);color:var(--signal);min-width:26px}
.day{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin:22px 0 10px}
.ev{border-left:2px solid var(--faint);padding:2px 0 2px 14px;margin-bottom:12px}.ev.positive{border-color:var(--pos)}.ev.negative{border-color:var(--neg)}
.evm{font-family:var(--mono);font-size:11px;color:var(--faint)}.evm .pl{color:var(--muted)}
.evt{display:block;color:var(--text);text-decoration:none;font-weight:600;margin:2px 0}.evt:hover{color:var(--signal)}
.evs{color:var(--text);font-style:italic;margin:3px 0}.evb{color:var(--muted);font-size:13px;margin:3px 0}
.foot{color:var(--faint);font-size:12px;font-family:var(--mono);margin-top:30px;border-top:1px solid var(--line);padding-top:14px}
a{color:var(--signal)}
</style></head><body><div class="wrap">
<h1>${esc(r.target)}</h1>
<div class="sub">Dossier compiled ${fmtDate(r.generatedAt)} from public sources${r.embeddingProvider ? `, semantic index ${esc(r.embeddingProvider)}` : ''}</div>
<div class="badges">${sourceBadges}</div>
${profileBlock}
${briefBlock}
${signals}
${heatmap}
<div class="grid2">${themes}${moments}</div>
${interactions}
<section class="card"><h2>Timeline</h2>${timeline}</section>
<div class="foot">Every entry links to its original public source. Generated by Storytime, an open-source tool. No private data.</div>
</div></body></html>`;
}
