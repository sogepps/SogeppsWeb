#!/usr/bin/env python3
"""Helpers around tools/i18n/<App>/<page>.<lang>.json.

    python tools/i18n_tasks.py todo    -> tools/i18n/_todo/<lang>/<App__page>.json  (keys missing in that language, English source)
    python tools/i18n_tasks.py merge   -> folds tools/i18n/_done/<lang>/<App__page>.json into the page files
    python tools/i18n_tasks.py check   -> every language file has exactly the English key set
    python tools/i18n_tasks.py keys    -> keys used in templates vs. English json (missing either way)
"""
import glob
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, "tools", "i18n")
TPL = os.path.join(ROOT, "tools", "templates")
LANGS = ["tr", "en", "de", "fr", "es", "it", "pt", "nl", "ru", "ja", "ko", "ar", "hi", "id", "pl"]
PAGES = {  # folder -> {page file: key}
    "MainSite": {"index.html": "index"},
    "HomeParty": {"index.html": "index", "privacy-policy.html": "privacy"},
    "Spinify": {"index.html": "index", "privacy-policy.html": "privacy"},
    "YerseYap": {"index.html": "index", "privacy-policy.html": "privacy"},
    "Shot": {"index.html": "index", "privacy-policy.html": "privacy"},
    "TahminMelegi": {"index.html": "index", "privacy-policy.html": "privacy"},
    "Metin2Okey": {"index.html": "index", "privacy-policy.html": "privacy", "play.html": "play"},
    "SessizKelime": {"index.html": "index", "privacy-policy.html": "privacy"},
    "SogeGammon": {"index.html": "index", "privacy-policy.html": "privacy"},
    "NeonKaleler": {"index.html": "index", "privacy-policy.html": "privacy"},
    "Tournament/Portal": {"index.html": "index", "privacy-policy.html": "privacy", "delete-account.html": "delete"},
    "QuickRaffle/Portal": {"index.html": "index", "privacy-policy.html": "privacy"},
}


def jload(p):
    with io.open(p, encoding="utf-8") as f:
        return json.load(f)


def jsave(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with io.open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")


def page_path(folder, key, lang):
    return os.path.join(I18N, folder, f"{key}.{lang}.json")


def template_keys(folder, page):
    p = os.path.join(TPL, folder, page)
    if not os.path.exists(p):
        return set()
    s = io.open(p, encoding="utf-8").read()
    return set(re.findall(r'data-i18n(?:-html|-placeholder|-alt|-content)?="([^"]+)"', s))


def cmd_keys():
    bad = 0
    for folder, pages in PAGES.items():
        for page, key in pages.items():
            en_p = page_path(folder, key, "en")
            if not os.path.exists(en_p):
                print(f"{folder}/{page}: NO en json"); bad += 1; continue
            en = jload(en_p)
            used = template_keys(folder, page)
            missing = sorted(k for k in used if k not in en)
            unused = sorted(k for k in en if k not in used and not k.startswith("_") and not re.fullmatch(r"[qa]_\d+", k))
            print(f"{folder}/{page}: template keys={len(used)} en keys={len(en)} missing-in-en={missing} unused={len(unused)}")
            bad += bool(missing)
    sys.exit(1 if bad else 0)


def cmd_todo():
    total = {}
    for folder, pages in PAGES.items():
        for page, key in pages.items():
            en_p = page_path(folder, key, "en")
            if not os.path.exists(en_p):
                print(f"skip {folder}/{key}: no en json"); continue
            en = jload(en_p)
            for lang in LANGS:
                if lang == "en":
                    continue
                cur = jload(page_path(folder, key, lang)) if os.path.exists(page_path(folder, key, lang)) else {}
                missing = {k: v for k, v in en.items() if k not in cur}
                p = os.path.join(I18N, "_todo", lang, f"{folder.replace('/', '__')}__{key}.json")
                if missing:
                    jsave(p, missing)
                    total[lang] = total.get(lang, 0) + len(missing)
                elif os.path.exists(p):
                    os.remove(p)
    for lang in LANGS:
        if lang in total:
            print(f"{lang}: {total[lang]} strings to translate")
    print("todo files under", os.path.join(I18N, "_todo"))


def cmd_merge():
    n = 0
    for p in sorted(glob.glob(os.path.join(I18N, "_done", "*", "*.json"))):
        lang = os.path.basename(os.path.dirname(p))
        name = os.path.basename(p)[:-5]
        folder, key = name.rsplit("__", 1)
        folder = folder.replace("__", "/")
        try:
            done = jload(p)
        except Exception as e:
            print(f"BAD JSON {p}: {e}"); continue
        en = jload(page_path(folder, key, "en"))
        dst = page_path(folder, key, lang)
        cur = jload(dst) if os.path.exists(dst) else {}
        added = 0
        for k, v in done.items():
            if k in en and isinstance(v, str) and v.strip():
                if k not in cur:
                    added += 1
                cur[k] = v
        ordered = {k: cur[k] for k in en if k in cur}
        for k in cur:
            if k not in ordered:
                ordered[k] = cur[k]
        jsave(dst, ordered)
        n += 1
        missing = [k for k in en if k not in ordered]
        print(f"{lang} {folder}/{key}: +{added} (still missing {len(missing)})")
    print("merged files:", n)


def cmd_check():
    bad = 0
    for folder, pages in PAGES.items():
        for page, key in pages.items():
            en_p = page_path(folder, key, "en")
            if not os.path.exists(en_p):
                print(f"{folder}/{key}: no en"); bad += 1; continue
            en = jload(en_p)
            row = []
            for lang in LANGS:
                p = page_path(folder, key, lang)
                if not os.path.exists(p):
                    row.append(f"{lang}:--"); bad += 1; continue
                t = jload(p)
                missing = [k for k in en if k not in t or not str(t[k]).strip()]
                extra = [k for k in t if k not in en]
                if missing or extra:
                    row.append(f"{lang}:-{len(missing)}/+{len(extra)}"); bad += 1
                else:
                    row.append(f"{lang}:ok")
            print(f"{folder}/{key}: " + " ".join(row))
    print("problems:", bad)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    {"todo": cmd_todo, "merge": cmd_merge, "check": cmd_check, "keys": cmd_keys}[sys.argv[1] if len(sys.argv) > 1 else "check"]()
