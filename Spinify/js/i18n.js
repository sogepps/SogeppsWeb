/**
 * Lightweight i18n engine for static HTML pages.
 * - Detects browser language or uses localStorage preference
 * - Applies translations via data-i18n / data-i18n-html attributes
 * - Renders a language switcher dropdown
 * - Handles RTL for Arabic
 */
(function () {
  var STORAGE_KEY = 'sogepps_lang';

  var LANGS = [
    { code: 'en', label: 'English',    flag: '🇬🇧' },
    { code: 'tr', label: 'Türkçe',     flag: '🇹🇷' },
    { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
    { code: 'fr', label: 'Français',   flag: '🇫🇷' },
    { code: 'es', label: 'Español',    flag: '🇪🇸' },
    { code: 'it', label: 'Italiano',   flag: '🇮🇹' },
    { code: 'pt', label: 'Português',  flag: '🇵🇹' },
    { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
    { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
    { code: 'ja', label: '日本語',      flag: '🇯🇵' },
    { code: 'ko', label: '한국어',      flag: '🇰🇷' },
    { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
    { code: 'hi', label: 'हिन्दी',      flag: '🇮🇳' },
    { code: 'id', label: 'Indonesia',  flag: '🇮🇩' },
    { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
  ];

  var currentLang = 'en';
  var currentPage = 'landing';
  var pageTranslations = {};

  function detectLang() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (stored && findLang(stored)) return stored;

    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    var exact = findLang(nav);
    if (exact) return exact;
    var prefix = nav.split('-')[0];
    return findLang(prefix) || 'en';
  }

  function findLang(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code === code) return code;
    }
    return null;
  }

  function getLangInfo(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code === code) return LANGS[i];
    }
    return LANGS[0];
  }

  function apply(lang) {
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}

    var strings = (pageTranslations[lang] || pageTranslations['en'] || {});
    var fallback = pageTranslations['en'] || {};

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = strings[key] || fallback[key];
      if (val != null) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var val = strings[key] || fallback[key];
      if (val != null) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = strings[key] || fallback[key];
      if (val != null) el.placeholder = val;
    });

    if (strings._title) document.title = strings._title;
    if (strings._description) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', strings._description);
    }

    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

    var btn = document.getElementById('langSwitcherBtn');
    if (btn) {
      var info = getLangInfo(lang);
      btn.innerHTML = info.flag + ' ' + info.code.toUpperCase() + ' <span style="font-size:0.7em;opacity:0.6;">&#9662;</span>';
    }
  }

  function createSwitcher() {
    var wrapper = document.createElement('div');
    wrapper.className = 'lang-switcher';
    wrapper.innerHTML =
      '<button id="langSwitcherBtn" class="lang-btn" aria-label="Change language"></button>' +
      '<div id="langDropdown" class="lang-dropdown"></div>';

    var dropdown = wrapper.querySelector('#langDropdown');
    LANGS.forEach(function (l) {
      var item = document.createElement('button');
      item.className = 'lang-item';
      item.setAttribute('data-lang', l.code);
      item.innerHTML = l.flag + ' ' + l.label;
      item.addEventListener('click', function () {
        apply(l.code);
        dropdown.classList.remove('open');
      });
      dropdown.appendChild(item);
    });

    wrapper.querySelector('#langSwitcherBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });

    return wrapper;
  }

  function injectStyles() {
    var css = document.createElement('style');
    css.textContent =
      '.lang-switcher{position:relative;margin-left:8px;}' +
      '.lang-btn{background:transparent;border:1px solid var(--border,#1f2937);color:var(--text,#f0f4f8);padding:6px 12px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:0.82rem;font-weight:500;display:flex;align-items:center;gap:6px;transition:all 0.2s;white-space:nowrap;}' +
      '.lang-btn:hover{background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3);}' +
      '.lang-dropdown{position:absolute;top:calc(100% + 6px);right:0;background:var(--surface,#0f1218);border:1px solid var(--border,#1f2937);border-radius:12px;padding:6px;min-width:180px;max-height:360px;overflow-y:auto;display:none;box-shadow:0 12px 40px rgba(0,0,0,0.5);z-index:999;}' +
      '.lang-dropdown.open{display:block;}' +
      '.lang-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;background:transparent;border:none;color:var(--text-muted,#9ca3af);cursor:pointer;font-family:inherit;font-size:0.85rem;border-radius:8px;transition:all 0.15s;text-align:left;}' +
      '.lang-item:hover{background:rgba(99,102,241,0.1);color:var(--text,#f0f4f8);}' +
      '[dir="rtl"] .lang-switcher{margin-left:0;margin-right:8px;}' +
      '[dir="rtl"] .lang-dropdown{right:auto;left:0;}';
    document.head.appendChild(css);
  }

  window.I18N = {
    init: function (page, translations) {
      currentPage = page;
      pageTranslations = translations || {};
      injectStyles();

      var target = document.querySelector('.nav-links') || document.querySelector('.nav-inner');
      if (target) {
        var sw = createSwitcher();
        if (target.classList.contains('nav-links')) {
          var li = document.createElement('li');
          li.appendChild(sw);
          target.appendChild(li);
        } else {
          target.appendChild(sw);
        }
      }

      currentLang = detectLang();
      apply(currentLang);
    }
  };
})();
