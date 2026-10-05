/**
 * Sogepps language switcher (v2, static pages).
 * Every page is pre-rendered per language; this script only builds a dropdown
 * from the page's <link rel="alternate" hreflang="..."> tags and navigates to
 * the chosen language's URL. No in-place text swapping, no auto-redirects
 * (search engines must be able to index every language URL as-is).
 */
(function () {
  var STORAGE_KEY = 'sogepps_lang';
  var LANGS = {
    tr: { label: 'Türkçe', flag: '🇹🇷' },
    en: { label: 'English', flag: '🇬🇧' },
    de: { label: 'Deutsch', flag: '🇩🇪' },
    fr: { label: 'Français', flag: '🇫🇷' },
    es: { label: 'Español', flag: '🇪🇸' },
    it: { label: 'Italiano', flag: '🇮🇹' },
    pt: { label: 'Português', flag: '🇵🇹' },
    nl: { label: 'Nederlands', flag: '🇳🇱' },
    ru: { label: 'Русский', flag: '🇷🇺' },
    ja: { label: '日本語', flag: '🇯🇵' },
    ko: { label: '한국어', flag: '🇰🇷' },
    ar: { label: 'العربية', flag: '🇸🇦' },
    hi: { label: 'हिन्दी', flag: '🇮🇳' },
    id: { label: 'Indonesia', flag: '🇮🇩' },
    pl: { label: 'Polski', flag: '🇵🇱' }
  };
  var ORDER = ['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'ar', 'hi', 'id', 'pl'];

  function init() {
    var alts = {};
    var links = document.querySelectorAll('link[rel="alternate"][hreflang]');
    for (var i = 0; i < links.length; i++) {
      var code = (links[i].getAttribute('hreflang') || '').toLowerCase();
      if (LANGS[code]) alts[code] = links[i].getAttribute('href');
    }
    var codes = ORDER.filter(function (c) { return alts[c]; });
    if (codes.length < 2) return;

    var current = (document.documentElement.lang || 'tr').toLowerCase().split('-')[0];
    if (!LANGS[current]) current = 'tr';

    injectStyles();
    var wrapper = document.createElement('div');
    wrapper.className = 'lang-switcher';
    var btn = document.createElement('button');
    btn.id = 'langSwitcherBtn';
    btn.className = 'lang-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Change language');
    btn.setAttribute('aria-haspopup', 'true');
    btn.innerHTML = LANGS[current].flag + ' ' + current.toUpperCase() + ' <span style="font-size:0.7em;opacity:0.6;">&#9662;</span>';
    var dropdown = document.createElement('div');
    dropdown.id = 'langDropdown';
    dropdown.className = 'lang-dropdown';
    codes.forEach(function (c) {
      var a = document.createElement('a');
      a.className = 'lang-item' + (c === current ? ' active' : '');
      a.href = alts[c];
      a.setAttribute('hreflang', c);
      a.setAttribute('lang', c);
      a.innerHTML = LANGS[c].flag + ' ' + LANGS[c].label;
      a.addEventListener('click', function () {
        try { localStorage.setItem(STORAGE_KEY, c); } catch (_) {}
      });
      dropdown.appendChild(a);
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      if (isOpen) {
        var r = btn.getBoundingClientRect();
        dropdown.style.top = (r.bottom + 6) + 'px';
        var isRTL = document.dir === 'rtl' || document.documentElement.dir === 'rtl';
        if (isRTL) {
          dropdown.style.left = r.left + 'px';
          dropdown.style.right = 'auto';
        } else {
          var right = window.innerWidth - r.right;
          if (right < 0) right = 0;
          dropdown.style.right = right + 'px';
          dropdown.style.left = 'auto';
        }
      }
    });
    document.addEventListener('click', function () { dropdown.classList.remove('open'); });
    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);

    var target = document.querySelector('.nav-links') || document.querySelector('.nav-inner') || document.querySelector('.topnav-links') || document.querySelector('.topnav-inner');
    if (!target) return;
    if (target.tagName === 'UL' || target.tagName === 'OL') {
      var li = document.createElement('li');
      li.appendChild(wrapper);
      target.appendChild(li);
    } else {
      target.appendChild(wrapper);
    }
  }

  function injectStyles() {
    var css = document.createElement('style');
    css.textContent =
      '.lang-switcher{position:relative;margin-left:8px;}' +
      '.lang-btn{background:transparent;border:1px solid var(--border,#1f2937);color:var(--text,#f0f4f8);padding:6px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:0.82rem;font-weight:500;display:flex;align-items:center;gap:6px;transition:all 0.2s;white-space:nowrap;}' +
      '.lang-btn:hover{background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3);}' +
      '.lang-dropdown{position:fixed;background:var(--surface,#0f1218);border:1px solid var(--border,#1f2937);border-radius:12px;padding:6px;min-width:180px;max-height:360px;overflow-y:auto;display:none;box-shadow:0 12px 40px rgba(0,0,0,0.5);z-index:9999;}' +
      '.lang-dropdown.open{display:block;}' +
      '.lang-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;background:transparent;border:none;color:var(--text-muted,var(--muted,#9ca3af));cursor:pointer;font-family:inherit;font-size:0.85rem;border-radius:8px;transition:all 0.15s;text-align:left;text-decoration:none;}' +
      '.lang-item:hover,.lang-item.active{background:rgba(99,102,241,0.1);color:var(--text,#f0f4f8);text-decoration:none;}' +
      '[dir="rtl"] .lang-switcher{margin-left:0;margin-right:8px;}' +
      '[dir="rtl"] .lang-dropdown{right:auto;}';
    document.head.appendChild(css);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
