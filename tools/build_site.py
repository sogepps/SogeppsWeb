#!/usr/bin/env python3
"""Build the multilingual static site for sogepps.tr.

Sources
  tools/templates/<App>/<page>.html      page templates with data-i18n keys
  tools/i18n/<App>/<pagekey>.<lang>.json  translations (flat key -> text)
  MainSite/makale/*.html                  Turkish source articles
  tools/articles/<slug>.<lang>.json       article translations (see articles_i18n.py)
  tools/runtime/i18n.js                   language switcher served at /js/i18n.js

Outputs
  <App>/<page>.html                       Turkish (default language, site root)
  <App>/<lang>/<page>.html                other languages
  MainSite/makale/<lang>/<slug>.html      translated articles
  MainSite/sitemap.xml                    all URLs with hreflang alternates

Usage:  python tools/build_site.py [--check]
"""
import copy
import datetime
import io
import json
import os
import re
import shutil
import sys

from bs4 import BeautifulSoup, NavigableString

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import articles_i18n  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
SITE = "https://sogepps.tr"
DEFAULT = "tr"
LANGS = ["tr", "en", "de", "fr", "es", "it", "pt", "nl", "ru", "ja", "ko", "ar", "hi", "id", "pl"]
OG_LOCALE = {"tr": "tr_TR", "en": "en_US", "de": "de_DE", "fr": "fr_FR", "es": "es_ES", "it": "it_IT", "pt": "pt_PT",
             "nl": "nl_NL", "ru": "ru_RU", "ja": "ja_JP", "ko": "ko_KR", "ar": "ar_AR", "hi": "hi_IN", "id": "id_ID", "pl": "pl_PL"}
RTL = {"ar"}
TODAY = datetime.date.today().isoformat()

APPS = [
    {"folder": "MainSite", "route": "/", "pages": {"index.html": "index"}},
    {"folder": "HomeParty", "route": "/homeparty/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "Spinify", "route": "/spinify/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "YerseYap", "route": "/yerseyap/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "Shot", "route": "/shot/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "TahminMelegi", "route": "/tahminmelegi/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "Metin2Okey", "route": "/metin2okey/", "pages": {"index.html": "index", "privacy-policy.html": "privacy", "play.html": "play"}},
    {"folder": "SessizKelime", "route": "/sessizkelime/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "SessizSinema", "route": "/sessizsinema/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "CadiyaSor", "route": "/cadiyasor/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "KaleMuhafizlari", "route": "/kalemuhafizlari/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "NeonKaleler", "route": "/neonkaleler/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "FishingDiary", "route": "/fishingdiary/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "SogeGammon", "route": "/sogegammon/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
    {"folder": "Tournament/Portal", "route": "/tournament-portal/", "pages": {"index.html": "index", "privacy-policy.html": "privacy", "delete-account.html": "delete"}},
    {"folder": "QuickRaffle/Portal", "route": "/quickraffle-portal/", "pages": {"index.html": "index", "privacy-policy.html": "privacy"}},
]
ROUTES = {a["route"].lower(): a for a in APPS if a["route"] != "/"}

WARN = []


def warn(msg):
    WARN.append(msg)
    print("  ! " + msg)


def read(p):
    with io.open(p, encoding="utf-8") as f:
        return f.read()


def write_if_changed(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    old = read(p) if os.path.exists(p) else None
    if old == s:
        return False
    with io.open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)
    return True


_JSON_CACHE = {}


def load_json(p):
    """Parse a JSON file; missing or invalid files count as absent (with a warning)."""
    if p in _JSON_CACHE:
        return _JSON_CACHE[p]
    data = None
    if os.path.exists(p):
        try:
            with io.open(p, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            warn(f"invalid JSON ignored: {os.path.relpath(p, ROOT)} ({e})")
            data = None
    _JSON_CACHE[p] = data
    return data


# ---------------------------------------------------------------- URL helpers
def page_url_path(route, page, lang):
    """Site-relative path of an app page in a language."""
    name = "" if page == "index.html" else page
    if lang == DEFAULT:
        return route + name
    return route + lang + "/" + name


def article_url_path(slug, lang):
    name = "" if slug == "index" else slug + ".html"
    if lang == DEFAULT:
        return "/makale/" + name
    return "/makale/" + lang + "/" + name


class Ctx:
    """What exists in which language (filled before rendering)."""
    app_langs = {}      # folder -> set of langs available for the whole app
    article_langs = {}  # slug -> set of langs available ("index" = article index)
    cover_langs = {}    # slug -> set of langs with a localized cover SVG


def rewrite_path(path, lang):
    """Map a Turkish (root) site path to its `lang` equivalent when that exists."""
    if lang == DEFAULT or not path.startswith("/"):
        return path
    frag = ""
    if "#" in path:
        path, frag = path.split("#", 1)
        frag = "#" + frag
    low = path.lower()
    if low in ("", "/"):
        if lang in Ctx.app_langs.get("MainSite", set()):
            return "/" + lang + "/" + frag
        return path + frag
    if low.startswith("/makale/img/"):
        m = re.fullmatch(r"/makale/img/([a-z0-9-]+)\.svg", path)
        if m and lang in Ctx.cover_langs.get(m.group(1), set()):
            return f"/makale/img/{lang}/{m.group(1)}.svg" + frag
        return path + frag
    if low.startswith("/makale/"):
        rest = path[len("/makale/"):]
        if rest == "":
            if lang in Ctx.article_langs.get("index", set()):
                return "/makale/" + lang + "/" + frag
            return path + frag
        m = re.fullmatch(r"([a-z0-9-]+)\.html", rest)
        if m and lang in Ctx.article_langs.get(m.group(1), set()):
            return "/makale/" + lang + "/" + rest + frag
        return path + frag
    for route, app in ROUTES.items():
        if low == route or low == route.rstrip("/"):
            if lang in Ctx.app_langs.get(app["folder"], set()):
                return route + lang + "/" + frag
            return path + frag
        if low.startswith(route):
            rest = path[len(route):]
            if rest in app["pages"] and lang in Ctx.app_langs.get(app["folder"], set()):
                return route + lang + "/" + rest + frag
            return path + frag
    return path + frag


def rewrite_url(url, lang):
    if url.startswith(SITE + "/"):
        return SITE + rewrite_path(url[len(SITE):], lang)
    if url.startswith("/"):
        return rewrite_path(url, lang)
    return url


ASSET_RE = re.compile(r"\.(png|jpe?g|webp|gif|svg|ico|css|js|json|txt|xml|woff2?|ttf|mp4|webm|pdf)(\?.*)?$", re.I)


def relative_to_abs(value, route):
    """Relative asset reference in a page moved into /<route>/<lang>/ -> absolute /<route>/..."""
    if not value or value.startswith(("/", "#", "http://", "https://", "mailto:", "tel:", "data:", "javascript:", "//")):
        return value
    if ASSET_RE.search(value):
        return route + value
    return value  # relative page links (privacy-policy.html) resolve inside the language folder


# ---------------------------------------------------------------- head / common
_RT_VER = None


def runtime_version():
    """Short content hash of the switcher script, used as a cache-busting query string."""
    global _RT_VER
    if _RT_VER is None:
        import hashlib
        with open(os.path.join(TOOLS, "runtime", "i18n.js"), "rb") as f:
            _RT_VER = hashlib.md5(f.read()).hexdigest()[:8]
    return _RT_VER


def set_meta(soup, attr, name, content):
    tag = soup.find("meta", attrs={attr: name})
    if tag is None:
        tag = soup.new_tag("meta")
        tag[attr] = name
        soup.head.append(tag)
    tag["content"] = content
    return tag


def apply_head(soup, lang, url_path, alternates):
    """lang/dir, canonical, hreflang set, og:locale/og:url, runtime script."""
    html = soup.find("html")
    html["lang"] = lang
    if lang in RTL:
        html["dir"] = "rtl"
    elif html.has_attr("dir"):
        del html["dir"]
    head = soup.head
    for l in head.find_all("link", attrs={"rel": "alternate"}):
        if l.has_attr("hreflang"):
            l.decompose()
    canonical = head.find("link", attrs={"rel": "canonical"})
    if canonical is None:
        canonical = soup.new_tag("link", rel="canonical")
        head.append(canonical)
    canonical["href"] = SITE + url_path
    anchor = canonical
    for code in LANGS:
        if code not in alternates:
            continue
        l = soup.new_tag("link", rel="alternate")
        l["hreflang"] = code
        l["href"] = SITE + alternates[code]
        anchor.insert_after(l)
        anchor = l
    l = soup.new_tag("link", rel="alternate")
    l["hreflang"] = "x-default"
    l["href"] = SITE + alternates[DEFAULT]
    anchor.insert_after(l)
    set_meta(soup, "property", "og:locale", OG_LOCALE[lang])
    set_meta(soup, "property", "og:url", SITE + url_path)
    # runtime: drop old per-app i18n scripts, add the shared switcher
    for s in soup.find_all("script"):
        src = s.get("src", "")
        if re.search(r"(^|/)js/(i18n|lang-[\w-]+)\.js(\?.*)?$", src):
            s.decompose()
        elif not src and s.string and "I18N.init" in s.string:
            s.decompose()
    body = soup.body
    if body is not None:
        tag = soup.new_tag("script", src="/js/i18n.js?v=" + runtime_version())
        tag["defer"] = ""
        body.append(tag)
        body.append("\n")


def localize_links(soup, lang, route=None):
    """Absolute internal links -> language versions; relative assets -> absolute (for sub-folder pages)."""
    for tag in soup.find_all(True):
        for attr in ("href", "src", "poster"):
            if not tag.has_attr(attr):
                continue
            v = tag[attr]
            if tag.name == "link" and tag.get("rel") and ("alternate" in tag.get("rel") or "canonical" in tag.get("rel")):
                continue
            if v.startswith("/") or v.startswith(SITE + "/"):
                tag[attr] = rewrite_url(v, lang)
            elif route is not None and lang != DEFAULT:
                tag[attr] = relative_to_abs(v, route)
        if tag.name == "meta" and tag.has_attr("content"):
            c = tag["content"]
            if c.startswith(SITE + "/") and not ASSET_RE.search(c):
                tag["content"] = rewrite_url(c, lang)


def walk_ld(obj, fn):
    if isinstance(obj, dict):
        fn(obj)
        for v in obj.values():
            walk_ld(v, fn)
    elif isinstance(obj, list):
        for v in obj:
            walk_ld(v, fn)


def localize_ld_urls(text, lang):
    def rep(m):
        return '"' + rewrite_url(m.group(1), lang) + '"'
    return re.sub(r'"(' + re.escape(SITE) + r'/[^"]*)"', rep, text)


# ---------------------------------------------------------------- article cards on app pages
_ART_CACHE = {}
_MAIN_CACHE = {}
APP_NAME_ALIASES = {"Lig & Turnuva Oluştur": "app_name", "Lig ve Turnuva Oluşturucu": "app_name", "Tournament Maker": "app_name",
                    "YerseYap": "app_name_yerseyap", "Yerse Yap": "app_name_yerseyap"}


def article_json(slug, lang):
    key = (slug, lang)
    if key not in _ART_CACHE:
        _ART_CACHE[key] = load_json(os.path.join(TOOLS, "articles", f"{slug}.{lang}.json"))
    return _ART_CACHE[key]


def mainsite_json(lang):
    if lang not in _MAIN_CACHE:
        _MAIN_CACHE[lang] = load_json(os.path.join(TOOLS, "i18n", "MainSite", f"index.{lang}.json")) or {}
    return _MAIN_CACHE[lang]


def _norm(s):
    return re.sub(r"\s+", " ", s or "").strip()


def translate_article_text(slug, lang, text):
    src, dst = article_json(slug, DEFAULT), article_json(slug, lang)
    if not src or not dst:
        return None
    n = _norm(text)
    for k, v in src.items():
        if _norm(v) == n and dst.get(k):
            return dst[k]
    return None


def translate_teaser(slug, lang, text):
    src, dst = article_json(slug, DEFAULT), article_json(slug, lang)
    if not src or not dst:
        return None
    n = _norm(text).rstrip("…").rstrip()
    if len(n) < 20:
        return None
    for k, v in src.items():
        if _norm(v).startswith(n) and dst.get(k):
            t = dst[k]
            limit = len(n)
            if len(t) > limit + 4:
                cut = t[:limit].rsplit(" ", 1)[0]
                return cut.rstrip(",;:.") + "…"
            return t
    return None


def app_name_for(tr_name, lang):
    """Turkish app name as written on cards -> the language's app name (MainSite keys)."""
    tr_json = mainsite_json(DEFAULT)
    key = APP_NAME_ALIASES.get(tr_name)
    if key is None:
        for k, v in tr_json.items():
            if k.startswith("app_name") and _norm(v) == tr_name:
                key = k
                break
    if key is None:
        return None
    return mainsite_json(lang).get(key) or mainsite_json("en").get(key)


def localize_article_cards(soup, lang):
    """Article teaser cards embedded in app pages: use the translated article title/teaser."""
    if lang == DEFAULT:
        return
    for a in soup.select('a[href*="/makale/"]'):
        m = re.search(r"/makale/(?:[a-z]{2}/)?([a-z0-9-]+)\.html", a.get("href", ""))
        if not m:
            continue
        slug = m.group(1)
        h3 = a.find("h3")
        if h3 is not None:
            t = translate_article_text(slug, lang, h3.get_text())
            if t:
                h3.string = t
        p = a.find("p")
        if p is not None:
            t = translate_teaser(slug, lang, p.get_text())
            if t:
                p.string = t
        img = a.find("img")
        if img is not None and img.get("alt"):
            t = translate_article_text(slug, lang, img["alt"])
            if t:
                img["alt"] = t
        for sp in a.select(".art-app, .rel-app"):
            v = app_name_for(_norm(sp.get_text()), lang)
            if v:
                sp.string = v


# ---------------------------------------------------------------- app pages
def apply_translations(soup, tr, en, lang):
    def t(key):
        if key in tr:
            return tr[key]
        if key in en:
            warn(f"[{lang}] key missing, English used: {key}")
            return en[key]
        warn(f"[{lang}] key missing everywhere: {key}")
        return None

    for el in soup.select("[data-i18n]"):
        v = t(el["data-i18n"])
        if v is not None:
            el.string = v
    for el in soup.select("[data-i18n-html]"):
        v = t(el["data-i18n-html"])
        if v is not None:
            el.clear()
            el.append(BeautifulSoup(v, "html.parser"))
    for el in soup.select("[data-i18n-placeholder]"):
        v = t(el["data-i18n-placeholder"])
        if v is not None:
            el["placeholder"] = v
    for el in soup.select("[data-i18n-alt]"):
        v = t(el["data-i18n-alt"])
        if v is not None:
            el["alt"] = v
    for el in soup.select("[data-i18n-content]"):
        v = t(el["data-i18n-content"])
        if v is not None:
            el["content"] = v
    title = tr.get("_title") or en.get("_title")
    desc = tr.get("_description") or en.get("_description")
    if title:
        if soup.title is None:
            soup.head.insert(0, soup.new_tag("title"))
        soup.title.string = title
        set_meta(soup, "property", "og:title", tr.get("_og_title") or title)
        if soup.find("meta", attrs={"name": "twitter:title"}) is not None:
            set_meta(soup, "name", "twitter:title", tr.get("_og_title") or title)
    if desc:
        set_meta(soup, "name", "description", desc)
        set_meta(soup, "property", "og:description", tr.get("_og_description") or desc)
        if soup.find("meta", attrs={"name": "twitter:description"}) is not None:
            set_meta(soup, "name", "twitter:description", tr.get("_og_description") or desc)
    kw = tr.get("_keywords")
    if kw:
        set_meta(soup, "name", "keywords", kw)
    elif lang != DEFAULT:
        # untranslated (Turkish) keyword lists must not leak into other languages
        for m in soup.find_all("meta", attrs={"name": "keywords"}):
            m.decompose()
    return title, desc


def localize_jsonld(soup, tr, en, lang, title, desc, template_desc):
    for s in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = s.string or ""
        try:
            data = json.loads(raw)
        except Exception:
            warn(f"[{lang}] JSON-LD parse failed; left untouched")
            continue

        def fix(d):
            typ = d.get("@type")
            if typ in ("SoftwareApplication", "VideoGame", "Article", "CollectionPage", "WebSite", "WebPage") and "description" in d and desc:
                if lang != DEFAULT or d["description"] == template_desc:
                    d["description"] = desc
            if typ in ("SoftwareApplication", "VideoGame") and tr.get("_app_name"):
                d["name"] = tr["_app_name"]
            if typ in ("SoftwareApplication", "VideoGame", "Article", "CollectionPage", "WebSite"):
                d["inLanguage"] = lang
            if typ == "FAQPage" and isinstance(d.get("mainEntity"), list):
                for i, q in enumerate(d["mainEntity"]):
                    qk, ak = f"q_{i + 1}", f"a_{i + 1}"
                    if qk in tr:
                        q["name"] = tr[qk]
                    ans = q.get("acceptedAnswer")
                    if isinstance(ans, dict) and ak in tr:
                        ans["text"] = tr[ak]
            if typ == "BreadcrumbList" and isinstance(d.get("itemListElement"), list) and tr.get("_breadcrumbs"):
                names = tr["_breadcrumbs"]
                for i, it in enumerate(d["itemListElement"]):
                    if i < len(names):
                        it["name"] = names[i]

        walk_ld(data, fix)
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        s.string = localize_ld_urls(text, lang)


def render_app_page(app, page, pagekey, lang, alternates):
    folder, route = app["folder"], app["route"]
    template = read(os.path.join(TOOLS, "templates", folder, page))
    soup = BeautifulSoup(template, "html.parser")
    en = load_json(os.path.join(TOOLS, "i18n", folder, f"{pagekey}.en.json")) or {}
    tr = load_json(os.path.join(TOOLS, "i18n", folder, f"{pagekey}.{lang}.json")) or {}
    template_desc_tag = soup.find("meta", attrs={"name": "description"})
    template_desc = template_desc_tag["content"] if template_desc_tag else None
    title, desc = apply_translations(soup, tr, en, lang)
    # YerseYap store screenshots per language
    for img in soup.select("img[data-shot]"):
        if img.has_attr("data-shot-lang"):  # one screenshot folder per site language (NeonKaleler)
            img["src"] = f"img/{lang}/" + img["data-shot"]
            del img["data-shot-lang"]
        else:
            img["src"] = ("img/tr/" if lang == DEFAULT else "img/en/") + img["data-shot"]
    url_path = page_url_path(route, page, lang)
    localize_article_cards(soup, lang)
    apply_head(soup, lang, url_path, alternates)
    localize_links(soup, lang, route)
    localize_jsonld(soup, tr, en, lang, title, desc, template_desc)
    out = os.path.join(ROOT, folder.replace("/", os.sep), *( [] if lang == DEFAULT else [lang] ), page)
    return out, str(soup)


# ---------------------------------------------------------------- article cover SVGs
_H1_CACHE = {}


def article_h1(slug):
    if slug not in _H1_CACHE:
        p = os.path.join(ROOT, "MainSite", "makale", slug + ".html")
        soup = BeautifulSoup(read(p), "html.parser")
        h1 = soup.find("h1")
        _H1_CACHE[slug] = _norm(h1.get_text()) if h1 else None
    return _H1_CACHE[slug]


def _wrap_words(text, budget):
    lines, cur = [], ""
    for w in text.split():
        if cur and len(cur) + 1 + len(w) > budget:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines.append(cur)
    return lines


def _wrap_chars(text, budget):
    text = text.replace(" ", "")
    return [text[i:i + budget] for i in range(0, len(text), budget)] or [text]


def _esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def localize_cover(svg, title, app_name, lang):
    """Re-typeset the title (and app name) of an article cover SVG. Returns None if the layout is unknown."""
    if not re.search(r'<text[^>]*font-size="54"', svg):
        return None
    wide = lang in ("ja", "ko")  # full-width glyphs: fewer characters per line
    lines, size, lh = [], 54, 66
    for size, lh in ((54, 66), (46, 56), (40, 50)):
        budget = int((15 if wide else 26) * 54 / size)
        lines = _wrap_chars(title, budget) if lang == "ja" else _wrap_words(title, budget)
        if len(lines) <= 3:
            break
    lines = lines[:4]
    svg = re.sub(r'<text[^>]*font-size="54"[^>]*>[^<]*</text>', "", svg)
    y0 = 249
    new = "".join(
        f'<text x="72" y="{y0 + i * lh}" font-family="Segoe UI, Arial, sans-serif" font-size="{size}" font-weight="700" fill="#ffffff">{_esc(l)}</text>'
        for i, l in enumerate(lines))
    app_y = y0 + (len(lines) - 1) * lh + 92
    app_m = re.search(r'<text[^>]*font-size="28"[^>]*>[^<]*</text>', svg)
    if app_m:
        name = app_name or re.sub(r"<[^>]+>", "", app_m.group(0))
        app_text = f'<text x="72" y="{app_y}" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,0.80)">{_esc(name)}</text>'
        svg = svg[:app_m.start()] + new + app_text + svg[app_m.end():]
    else:
        svg = svg.replace("</svg>", new + "</svg>")
    svg = re.sub(r'aria-label="[^"]*"', 'aria-label="' + _esc(title).replace('"', "&quot;") + '"', svg, count=1)
    return svg


def build_covers(slugs, changed):
    src_dir = os.path.join(ROOT, "MainSite", "makale", "img")
    n = 0
    for slug in slugs:
        if slug == "index":
            continue
        src = os.path.join(src_dir, slug + ".svg")
        if not os.path.exists(src):
            continue
        svg = read(src)
        h1 = article_h1(slug)
        app_m = re.search(r'<text[^>]*font-size="28"[^>]*>([^<]*)</text>', svg)
        tr_app = app_m.group(1).replace("&amp;", "&") if app_m else None
        for lang in Ctx.article_langs.get(slug, set()):
            if lang == DEFAULT:
                continue
            title = translate_article_text(slug, lang, h1) if h1 else None
            if not title:
                continue
            app_name = app_name_for(tr_app, lang) if tr_app else None
            out_svg = localize_cover(svg, _norm(re.sub(r"<[^>]+>", "", title)), app_name, lang)
            if out_svg is None:
                continue
            out = os.path.join(src_dir, lang, slug + ".svg")
            changed[f"/makale/img/{lang}/{slug}.svg"] = write_if_changed(out, out_svg)
            Ctx.cover_langs.setdefault(slug, set()).add(lang)
            n += 1
    print(f"== covers: {n} localized")


# ---------------------------------------------------------------- articles
def article_sources():
    d = os.path.join(ROOT, "MainSite", "makale")
    slugs = []
    for f in sorted(os.listdir(d)):
        if f.endswith(".html"):
            slugs.append(f[:-5])
    return slugs  # includes "index"


def render_article(slug, lang, alternates):
    src_path = os.path.join(ROOT, "MainSite", "makale", slug + ".html")
    html = read(src_path)
    trans = None
    if lang != DEFAULT:
        trans = load_json(os.path.join(TOOLS, "articles", f"{slug}.{lang}.json"))
        if trans is None:
            return None, None
    soup = articles_i18n.inject(html, trans)
    url_path = article_url_path(slug, lang)
    apply_head(soup, lang, url_path, alternates)
    localize_links(soup, lang, None)
    # JSON-LD urls + inLanguage
    for s in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = s.string or ""
        try:
            data = json.loads(raw)
        except Exception:
            continue

        def fix(d):
            if d.get("@type") in ("Article", "CollectionPage", "WebPage", "WebSite"):
                d["inLanguage"] = lang

        walk_ld(data, fix)
        s.string = localize_ld_urls(json.dumps(data, ensure_ascii=False, separators=(",", ":")), lang)
    out = os.path.join(ROOT, "MainSite", "makale", *( [] if lang == DEFAULT else [lang] ), slug + ".html")
    return out, str(soup)


# ---------------------------------------------------------------- sitemap
def old_sitemap_dates():
    p = os.path.join(ROOT, "MainSite", "sitemap.xml")
    dates = {}
    if os.path.exists(p):
        for m in re.finditer(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>", read(p)):
            dates[m.group(1)] = m.group(2)
    return dates


def write_sitemap(entries, old_dates, changed):
    """entries: list of (url_path, alternates{lang: path}, priority, changefreq)"""
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for url_path, alternates, prio, freq in entries:
        loc = SITE + url_path
        lastmod = TODAY if (changed.get(url_path) or loc not in old_dates) else old_dates[loc]
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append(f"    <changefreq>{freq}</changefreq>")
        lines.append(f"    <priority>{prio}</priority>")
        for code in LANGS:
            if code in alternates:
                lines.append(f'    <xhtml:link rel="alternate" hreflang="{code}" href="{SITE}{alternates[code]}" />')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{alternates[DEFAULT]}" />')
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- main
def main():
    check = "--check" in sys.argv
    # availability
    for app in APPS:
        langs = set(LANGS)
        for page, key in app["pages"].items():
            have = {l for l in LANGS if load_json(os.path.join(TOOLS, "i18n", app["folder"], f"{key}.{l}.json")) is not None}
            langs &= have
        if DEFAULT not in langs or "en" not in langs:
            print(f"!! {app['folder']}: needs at least tr+en translations for every page (have {sorted(langs)})")
            langs = {l for l in langs if l in (DEFAULT, "en")}
        Ctx.app_langs[app["folder"]] = langs
    slugs = article_sources()
    for slug in slugs:
        have = {DEFAULT} | {l for l in LANGS if l != DEFAULT and load_json(os.path.join(TOOLS, "articles", f"{slug}.{l}.json")) is not None}
        Ctx.article_langs[slug] = have

    changed = {}
    entries = []
    written = 0
    if not check:
        build_covers(slugs, changed)
    # app pages
    for app in APPS:
        langs = Ctx.app_langs[app["folder"]]
        print(f"== {app['folder']} ({', '.join(l for l in LANGS if l in langs)})")
        for page, key in app["pages"].items():
            alternates = {l: page_url_path(app["route"], page, l) for l in LANGS if l in langs}
            for lang in LANGS:
                if lang not in langs:
                    continue
                out, html = render_app_page(app, page, key, lang, alternates)
                url_path = alternates[lang]
                if not check:
                    changed[url_path] = write_if_changed(out, html)
                    written += changed[url_path]
                prio = "1.0" if app["folder"] == "MainSite" else ("0.8" if key == "index" else "0.3")
                freq = "weekly" if key == "index" else "yearly"
                entries.append((url_path, alternates, prio, freq))
    # articles
    print("== articles")
    for slug in slugs:
        langs = Ctx.article_langs[slug]
        alternates = {l: article_url_path(slug, l) for l in LANGS if l in langs}
        for lang in LANGS:
            if lang not in langs:
                continue
            out, html = render_article(slug, lang, alternates)
            if html is None:
                continue
            url_path = alternates[lang]
            if not check:
                changed[url_path] = write_if_changed(out, html)
                written += changed[url_path]
            entries.append((url_path, alternates, "0.7" if slug == "index" else "0.6", "monthly"))
    # runtime
    if not check:
        rt = read(os.path.join(TOOLS, "runtime", "i18n.js"))
        write_if_changed(os.path.join(ROOT, "MainSite", "js", "i18n.js"), rt)
        sm = write_sitemap(entries, old_sitemap_dates(), changed)
        write_if_changed(os.path.join(ROOT, "MainSite", "sitemap.xml"), sm)
    print(f"\npages: {len(entries)}  written/changed: {written}  warnings: {len(WARN)}")
    if WARN:
        uniq = sorted(set(WARN))
        print("warnings (unique):")
        for w in uniq[:60]:
            print("  " + w)
        if len(uniq) > 60:
            print(f"  ... {len(uniq) - 60} more")


if __name__ == "__main__":
    main()
