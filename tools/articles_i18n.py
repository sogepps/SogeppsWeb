#!/usr/bin/env python3
"""Extract translatable segments from a Turkish article and inject translations back.

    python tools/articles_i18n.py extract      -> tools/articles/<slug>.tr.json for every MainSite/makale/*.html
    python tools/articles_i18n.py todo          -> lists slugs missing per language
    python tools/articles_i18n.py check         -> validates every <slug>.<lang>.json has the same ids as <slug>.tr.json

Segment ids are positional ("t0", "t1", ...) so extraction and injection must run on the same source HTML.
"""
import io
import json
import os
import re
import sys

from bs4 import BeautifulSoup, NavigableString, Comment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "MainSite", "makale")
OUT = os.path.join(ROOT, "tools", "articles")
LANGS = ["en", "de", "fr", "es", "it", "pt", "nl", "ru", "ja", "ko", "ar", "hi", "id", "pl"]

SKIP_TAGS = {"script", "style", "noscript", "svg", "code", "pre"}
META_NAMES = ["description", "keywords", "twitter:title", "twitter:description"]
META_PROPS = ["og:title", "og:description"]
LD_KEYS = {"headline", "description", "name", "text", "alternativeHeadline", "caption"}
LETTER = re.compile(r"[^\W\d_]", re.U)


def _walk_ld(obj, fn, path=()):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and k in LD_KEYS and LETTER.search(v):
                fn(path + (k,), obj, k)
            else:
                _walk_ld(v, fn, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _walk_ld(v, fn, path + (i,))


def _segments(soup):
    """Yield (setter, text) pairs in a deterministic order."""
    out = []
    if soup.title and soup.title.string:
        out.append((("title",), soup.title.string.strip()))
    for name in META_NAMES:
        for m in soup.find_all("meta", attrs={"name": name}):
            if m.get("content"):
                out.append((("meta", m), m["content"]))
    for prop in META_PROPS:
        for m in soup.find_all("meta", attrs={"property": prop}):
            if m.get("content"):
                out.append((("meta", m), m["content"]))
    body = soup.body
    if body is not None:
        for node in body.descendants:
            if isinstance(node, NavigableString) and not isinstance(node, Comment):
                if node.parent and node.parent.name in SKIP_TAGS:
                    continue
                txt = str(node)
                if txt.strip() and LETTER.search(txt):
                    out.append((("text", node), txt.strip()))
        for img in body.find_all("img"):
            if img.get("alt") and LETTER.search(img["alt"]):
                out.append((("alt", img), img["alt"]))
    for s in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(s.string or "")
        except Exception:
            continue
        items = []
        _walk_ld(data, lambda path, obj, k: items.append((path, obj, k)))
        for path, obj, k in items:
            out.append((("ld", s, data, obj, k), obj[k]))
    return out


def extract(html):
    soup = BeautifulSoup(html, "html.parser")
    segs = _segments(soup)
    return {f"t{i}": text for i, (setter, text) in enumerate(segs)}


def inject(html, trans):
    """Return a soup with translations applied (trans may be None -> untouched soup)."""
    soup = BeautifulSoup(html, "html.parser")
    if not trans:
        return soup
    segs = _segments(soup)
    ld_scripts = {}
    for i, (setter, text) in enumerate(segs):
        key = f"t{i}"
        if key not in trans:
            continue
        new = trans[key]
        kind = setter[0]
        if kind == "title":
            soup.title.string = new
        elif kind == "meta":
            setter[1]["content"] = new
        elif kind == "text":
            node = setter[1]
            raw = str(node)
            lead = raw[: len(raw) - len(raw.lstrip())]
            trail = raw[len(raw.rstrip()):]
            node.replace_with(NavigableString(lead + new + trail))
        elif kind == "alt":
            setter[1]["alt"] = new
        elif kind == "ld":
            _, script, data, obj, k = setter
            obj[k] = new
            ld_scripts[id(script)] = (script, data)
    for script, data in ld_scripts.values():
        script.string = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return soup


def slugs():
    return sorted(f[:-5] for f in os.listdir(SRC) if f.endswith(".html"))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "extract"
    os.makedirs(OUT, exist_ok=True)
    if cmd == "extract":
        for slug in slugs():
            html = io.open(os.path.join(SRC, slug + ".html"), encoding="utf-8").read()
            segs = extract(html)
            with io.open(os.path.join(OUT, f"{slug}.tr.json"), "w", encoding="utf-8") as f:
                json.dump(segs, f, ensure_ascii=False, indent=1)
            print(f"{slug}: {len(segs)} segments")
    elif cmd == "todo":
        for lang in LANGS:
            missing = [s for s in slugs() if not os.path.exists(os.path.join(OUT, f"{s}.{lang}.json"))]
            print(f"{lang}: {len(missing)} missing" + (": " + ", ".join(missing) if missing and len(missing) < 8 else ""))
    elif cmd == "check":
        bad = 0
        for slug in slugs():
            src = json.load(io.open(os.path.join(OUT, f"{slug}.tr.json"), encoding="utf-8"))
            for lang in LANGS:
                p = os.path.join(OUT, f"{slug}.{lang}.json")
                if not os.path.exists(p):
                    continue
                try:
                    t = json.load(io.open(p, encoding="utf-8"))
                except Exception as e:
                    print(f"BAD JSON {slug}.{lang}: {e}"); bad += 1; continue
                missing = [k for k in src if k not in t or not isinstance(t[k], str) or not t[k].strip()]
                extra = [k for k in t if k not in src]
                if missing or extra:
                    print(f"{slug}.{lang}: missing={len(missing)} extra={len(extra)} {missing[:5]}"); bad += 1
        print("problems:", bad)
        sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
