#!/usr/bin/env python3
"""Detects misaligned or stale article translations (tools/articles/<slug>.<lang>.json vs <slug>.tr.json).

Segment ids are positional, so when a Turkish article changes and the translations are not redone, texts end up
under the wrong id (e.g. an e-mail address as an article title, or "coming soon" in the middle of a paragraph).
Checks per language file:
  * length ratio far from the file's median ratio (long segments only)
  * digit sequences of the Turkish text missing from the translation (years, counts, 8+, 30 ...)
  * the same translation used for two different Turkish texts
  * "Google Play" in the translation although the Turkish text has none (stray CTA text)
  * value identical to Turkish although it contains Turkish-only letters

    python tools/articles_align_check.py            -> report, exit 1 if any suspect
    python tools/articles_align_check.py --ids      -> list suspect ids per slug (union over languages)
"""
import glob
import io
import json
import os
import re
import statistics
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "tools", "articles")


def jl(p):
    with io.open(p, encoding="utf-8") as f:
        return json.load(f)


LANGS = ["en", "de", "fr", "es", "it", "pt", "nl", "ru", "ja", "ko", "ar", "hi", "id", "pl"]
BRAND = {"HomeParty", "Sogepps", "ANDROID", "sogepps@gmail.com", "S"}
try:  # Turkish app names (cards / related links) legitimately stay as the brand name
    BRAND |= {v for k, v in jl(os.path.join(ROOT, "tools", "i18n", "MainSite", "index.tr.json")).items() if k.startswith("app_name")}
except Exception:
    pass
KNOWN_UNTRANSLATED = {"sessiz-sinema-kelimeleri-listesi"}  # Turkish film titles stay as they are
TR_ONLY = re.compile(r"[ğışĞİŞ]")
NUM = re.compile(r"\d+")
# these languages routinely rewrite or drop numerals/units, so digit checks are limited to ASCII digits only
ARABIC_INDIC = str.maketrans("٠١٢٣٤٥٦٧٨٩०१२३४५६७८९", "01234567890123456789")


def suspects(slug, lang, tr, d):
    out = {}
    longs = [len(d[k]) / len(v) for k, v in tr.items() if len(v) > 40 and k in d and d[k] != v]
    med = statistics.median(longs) if longs else 1.0
    seen = {}
    for k, v in tr.items():
        t = d.get(k)
        if t is None:
            out[k] = "missing"
            continue
        if v in BRAND or not re.search(r"[^\W\d_]{2,}", v):
            continue
        if t == v and TR_ONLY.search(v) and slug not in KNOWN_UNTRANSLATED:
            out[k] = "untranslated"
            continue
        if len(v) > 60 and not (0.2 * med < len(t) / len(v) < 3.0 * med):
            out[k] = "length"
        want = set(NUM.findall(v))
        got = set(NUM.findall(t.translate(ARABIC_INDIC)))
        # numerals may legitimately be spelled out ("zu zweit"), so only flag when other numbers appear instead
        if len(want) and got and not (want & got) and k not in out and len(v) > 25:
            out[k] = "digits"
        if "Google Play" in t and "Google Play" not in v:
            out[k] = "stray-play"
        if len(v) > 60:
            seen.setdefault(t, set()).add(v)
    for t, srcs in seen.items():
        if len(srcs) > 1:
            lens = [len(x) for x in srcs]
            if max(lens) < 1.6 * min(lens):  # near-identical Turkish texts may share one translation
                continue
            for k, v in tr.items():
                if d.get(k) == t and v in srcs:
                    out.setdefault(k, "duplicate")
    return out


def cross(lang, slugs, trs):
    """Same translation used under unrelated Turkish texts in different articles = text landed under the wrong id."""
    seen, where = {}, {}
    for slug in slugs:
        p = os.path.join(ART, f"{slug}.{lang}.json")
        if not os.path.exists(p):
            continue
        for k, t in jl(p).items():
            v = trs[slug][k]
            if len(t) > 25 and t != v:
                seen.setdefault(t, set()).add(v)
                where.setdefault(t, []).append((slug, k, v))
    out = {}
    for t, srcs in seen.items():
        lens = [len(x) for x in srcs]
        if len(srcs) > 1 and max(lens) >= 1.6 * min(lens) and not all(x in BRAND_ALIASES or x in BRAND for x in srcs):
            for slug, k, v in where[t]:
                out.setdefault(slug, {})[k] = "cross-article"
    return out


# Turkish app names that legitimately appear in several variants ("Yerse Yap", "Yerse Yap: Parti Oyunu"...)
BRAND_ALIASES = {"Yerse Yap", "Yerse Yap: Parti Oyunu", "Shot Çarkı", "Tahmin Meleği - İddaa", "SogeGammon uygulama simgesi"}


def main():
    ids = "--ids" in sys.argv
    total = 0
    union = {}
    slugs = [os.path.basename(f)[:-8] for f in sorted(glob.glob(os.path.join(ART, "*.tr.json")))]
    trs = {sl: jl(os.path.join(ART, f"{sl}.tr.json")) for sl in slugs}
    crossed = {lang: cross(lang, slugs, trs) for lang in LANGS}
    for f in sorted(glob.glob(os.path.join(ART, "*.tr.json"))):
        slug = os.path.basename(f)[:-8]
        tr = jl(f)
        n = {}
        for lang in LANGS:
            p = os.path.join(ART, f"{slug}.{lang}.json")
            if not os.path.exists(p):
                continue
            found = suspects(slug, lang, tr, jl(p))
            for k, why in crossed.get(lang, {}).get(slug, {}).items():
                found.setdefault(k, why)
            for k, why in found.items():
                n.setdefault(lang, []).append(k)
                union.setdefault(slug, {}).setdefault(k, set()).add(lang)
        if n:
            total += sum(len(v) for v in n.values())
            print(f"{slug}: " + " ".join(f"{l}:{len(v)}" for l, v in n.items()))
    if ids:
        for slug, m in union.items():
            print(slug, sorted(m, key=lambda x: int(x[1:])))
    print("suspect segments:", total)
    sys.exit(1 if total else 0)


if __name__ == "__main__":
    main()
