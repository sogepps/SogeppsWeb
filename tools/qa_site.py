#!/usr/bin/env python3
"""Quality checks over the generated pages.

    python tools/qa_site.py            -> report
    python tools/qa_site.py --strict   -> exit 1 on any problem

Checks every generated .html under the app folders and MainSite:
  * <html lang> matches the folder language, dir=rtl for Arabic
  * exactly one canonical, hreflang set includes the page itself and x-default
  * no leftover Turkish text on non-Turkish pages (heuristic: Turkish-only letters in visible text,
    ignoring brand names) — reports the first few offenders per page
  * no relative asset paths on sub-folder pages, every local asset referenced exists on disk
  * the switcher script is referenced once
"""
import io
import os
import re
import sys
from urllib.parse import urlsplit

from bs4 import BeautifulSoup, NavigableString, Comment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from build_site import APPS, LANGS, DEFAULT, SITE, ROUTES  # noqa: E402

TRC = re.compile(r"[ğışĞİŞ]")  # letters that are (almost) unique to Turkish; ç/ö/ü also occur in de/fr/pt
BRANDS = ("Shot Çarkı", "Tahmin Meleği", "Hızlı Çekiliş", "Sessiz Kelime", "İddaa", "Yerse Yap", "YerseYap", "Metin2", "Çark",
          "Cadıya Sor", "Sogepps", "İstanbul", "Beşiktaş", "Fenerbahçe", "Galatasaray", "Trabzonspor", "Türk", "Turkish", "Şehir")
FOLDER_FOR_ROUTE = {r: a["folder"] for r, a in ROUTES.items()}


def site_path_to_file(path):
    """/homeparty/en/img/x.png -> local file (mimics IIS routing)."""
    path = urlsplit(path).path
    low = path.lower()
    for route, folder in FOLDER_FOR_ROUTE.items():
        if low.startswith(route):
            rest = path[len(route):]
            return os.path.join(ROOT, folder.replace("/", os.sep), *rest.split("/"))
    return os.path.join(ROOT, "MainSite", *path.lstrip("/").split("/"))


def page_lang(rel):
    parts = rel.replace("\\", "/").split("/")
    for p in parts:
        if p in LANGS and p != DEFAULT:
            return p
    return DEFAULT


def check_page(path, rel):
    problems = []
    html = io.open(path, encoding="utf-8").read()
    soup = BeautifulSoup(html, "html.parser")
    lang = page_lang(rel)
    tag = soup.find("html")
    if (tag.get("lang") or "").lower() != lang:
        problems.append(f"html lang={tag.get('lang')} expected {lang}")
    if lang == "ar" and tag.get("dir") != "rtl":
        problems.append("missing dir=rtl")
    canon = soup.find_all("link", attrs={"rel": "canonical"})
    if len(canon) != 1:
        problems.append(f"{len(canon)} canonical links")
    alts = {l.get("hreflang"): l.get("href") for l in soup.find_all("link", attrs={"rel": "alternate"}) if l.get("hreflang")}
    if "x-default" not in alts:
        problems.append("no x-default hreflang")
    if canon and canon[0].get("href") not in alts.values():
        problems.append("canonical not in hreflang set")
    scripts = [s for s in soup.find_all("script") if "i18n.js" in (s.get("src") or "")]
    if len(scripts) != 1:
        problems.append(f"{len(scripts)} switcher scripts")
    # Turkish leftovers
    if lang != DEFAULT:
        leftovers = []
        body = soup.body
        for node in body.descendants if body else []:
            if isinstance(node, NavigableString) and not isinstance(node, Comment):
                if node.parent.name in ("script", "style"):
                    continue
                t = str(node).strip()
                if t and TRC.search(t) and not any(b in t for b in BRANDS):
                    leftovers.append(t[:60])
        for m in soup.find_all("meta"):
            c = m.get("content") or ""
            if TRC.search(c) and not any(b in c for b in BRANDS) and (m.get("name") in ("description", "keywords") or (m.get("property") or "").startswith("og:")):
                leftovers.append("meta:" + c[:60])
        if soup.title and soup.title.string and TRC.search(soup.title.string) and not any(b in soup.title.string for b in BRANDS):
            leftovers.append("title:" + soup.title.string[:60])
        if leftovers:
            problems.append(f"turkish leftovers ({len(leftovers)}): " + " | ".join(leftovers[:3]))
    # assets
    in_sub = lang != DEFAULT
    for t in soup.find_all(["img", "script", "link", "source"]):
        v = t.get("src") or t.get("href") or ""
        if not v or v.startswith(("http", "//", "data:", "mailto:", "#")):
            continue
        if t.name == "link" and t.get("rel") and not ("stylesheet" in t.get("rel") or "icon" in t.get("rel")):
            continue
        if not v.startswith("/"):
            if in_sub and re.search(r"\.(png|jpe?g|webp|svg|js|css|ico)(\?|$)", v, re.I):
                problems.append(f"relative asset on sub-folder page: {v}")
            continue
        f = site_path_to_file(v)
        if not os.path.exists(f):
            problems.append(f"missing asset: {v}")
    return problems


def main():
    strict = "--strict" in sys.argv
    folders = [a["folder"] for a in APPS]
    total, bad = 0, 0
    for folder in folders:
        base = os.path.join(ROOT, folder.replace("/", os.sep))
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in (".git", "img", "js")]
            for fn in files:
                if not fn.endswith(".html"):
                    continue
                p = os.path.join(root, fn)
                rel = os.path.relpath(p, ROOT)
                total += 1
                probs = check_page(p, rel)
                if probs:
                    bad += 1
                    print(f"!! {rel}")
                    for pr in probs:
                        print("     - " + pr)
    print(f"\npages checked: {total}  with problems: {bad}")
    sys.exit(1 if (strict and bad) else 0)


if __name__ == "__main__":
    main()
