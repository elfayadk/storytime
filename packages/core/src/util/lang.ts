/**
 * Lightweight, dependency-free language/script detection. Enough for the UI to
 * render right-to-left correctly and to offer a language filter. Returns a
 * BCP-47-ish tag plus whether the dominant script is RTL.
 */
export interface LangInfo {
  lang: string; // 'ar', 'he', 'fa', 'zh', 'ja', 'ko', 'ru', 'el', 'en', 'und'
  rtl: boolean;
}

const RANGES: { lang: string; rtl: boolean; re: RegExp }[] = [
  { lang: 'ar', rtl: true, re: /[؀-ۿݐ-ݿࢠ-ࣿ]/g },
  { lang: 'he', rtl: true, re: /[֐-׿]/g },
  { lang: 'fa', rtl: true, re: /[ؠ-يٴ-ە]/g },
  { lang: 'zh', rtl: false, re: /[一-鿿]/g },
  { lang: 'ja', rtl: false, re: /[぀-ヿ]/g },
  { lang: 'ko', rtl: false, re: /[가-힯]/g },
  { lang: 'ru', rtl: false, re: /[Ѐ-ӿ]/g },
  { lang: 'el', rtl: false, re: /[Ͱ-Ͽ]/g },
];

export function detectLang(text: string): LangInfo {
  const clean = (text || '').slice(0, 2000);
  const letters = (clean.match(/\p{L}/gu) ?? []).length || 1;
  let best: { lang: string; rtl: boolean; frac: number } | null = null;
  for (const r of RANGES) {
    const n = (clean.match(r.re) ?? []).length;
    const frac = n / letters;
    if (frac >= 0.2 && (!best || frac > best.frac)) best = { lang: r.lang, rtl: r.rtl, frac };
  }
  if (best) return { lang: best.lang, rtl: best.rtl };
  // Latin script: assume English by default (no per-language ID without a model).
  return { lang: /[a-z]/i.test(clean) ? 'en' : 'und', rtl: false };
}
