#!/usr/bin/env python3
"""Find article translation values that were left identical to the Turkish source.

A value counts as untranslated when it equals the Turkish text while the German
translation of the same key differs (so it is real prose, not a brand name/email).
Writes tools/articles/_untranslated.json as {lang: {slug: [keys]}} and prints a summary.
"""
import glob
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "tools", "articles")
LET = re.compile(r"[^\W\d_]")
LANGS = ["en", "fr", "es", "it", "pt", "nl", "ru", "ja", "ko", "ar", "hi", "id", "pl", "de"]


def main():
    out = {}
    for p in sorted(glob.glob(os.path.join(ART, "*.tr.json"))):
        slug = os.path.basename(p)[:-8]
        tr = json.load(io.open(p, encoding="utf-8"))
        ref_p = os.path.join(ART, f"{slug}.de.json")
        ref = json.load(io.open(ref_p, encoding="utf-8")) if os.path.exists(ref_p) else {}
        for lang in LANGS:
            q = os.path.join(ART, f"{slug}.{lang}.json")
            if not os.path.exists(q):
                continue
            t = json.load(io.open(q, encoding="utf-8"))
            if lang == "de":
                # compare German against English instead
                en_p = os.path.join(ART, f"{slug}.en.json")
                cmp = json.load(io.open(en_p, encoding="utf-8")) if os.path.exists(en_p) else {}
            else:
                cmp = ref
            bad = [k for k, v in tr.items() if t.get(k) == v and cmp.get(k) != v and LET.search(v) and len(v) > 12]
            if bad:
                out.setdefault(lang, {})[slug] = bad
    with io.open(os.path.join(ART, "_untranslated.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    total = 0
    for lang, d in sorted(out.items()):
        n = sum(len(v) for v in d.values())
        total += n
        print(f"{lang}: {n} untranslated values in {len(d)} files: " + ", ".join(f"{s}({len(k)})" for s, k in d.items()))
    print("total:", total)


if __name__ == "__main__":
    main()
