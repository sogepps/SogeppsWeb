/**
 * Adds the Fishing Diary: Ocean Legends card, footer links and translations to the main site (sogepps.tr/).
 * Texts come from the game's own site translations (tools/i18n/FishingDiary/index.<lang>.json).
 * Idempotent: running it again changes nothing.
 *
 *   node tools/templates/FishingDiary/add-to-mainsite.cjs
 */
const fs = require('fs');
const path = require('path');

const TOOLS = path.join(__dirname, '..', '..');
const ROOT = path.join(TOOLS, '..');
const tplPath = path.join(TOOLS, 'templates/MainSite/index.html');
let tpl = fs.readFileSync(tplPath, 'utf8');

if (!tpl.includes('/fishingdiary/')) {
  const card = `<a href="/fishingdiary/" class="app-card">
      <div class="app-icon" style="background: linear-gradient(135deg, #0a4f7a, #29b6f6);">
        <img src="img/fishingdiary-icon.png" alt="Fishing Diary: Ocean Legends uygulama simgesi" onerror="this.style.display='none';this.nextElementSibling.classList.add('show');" />
        <span class="app-icon-fallback" aria-hidden="true">&#127907;</span>
      </div>
      <div class="app-info">
        <h3 data-i18n="app_name_fishingdiary">Fishing Diary: Ocean Legends</h3>
        <p data-i18n="app_desc_fishingdiary">Cast nets from your cannon and catch 150+ species.</p>
        <div class="app-badges">
          <span class="app-badge" data-i18n="badge_fd_species">&#127907; 150+ species</span>
          <span class="app-badge" data-i18n="badge_fd_weapons">&#128305; 40 weapons</span>
          <span class="app-badge" data-i18n="badge_fd_langs">&#127760; 70+ Languages</span>
        </div>
        <div class="app-arrow" data-i18n="app_view">View Details &#8594;</div>
      </div>
    </a>
`;
  // Newest first: before Kale Muhafızları.
  const anchor = '    <a href="/kalemuhafizlari/" class="app-card">';
  const at = tpl.indexOf(anchor);
  if (at === -1) throw new Error('Kale Muhafızları card not found');
  tpl = tpl.slice(0, at) + '    ' + card + tpl.slice(at);
  const nav = '        <a href="/kalemuhafizlari/" data-i18n="app_name_kalemuhafizlari">Kale Muhafızları</a>';
  if (!tpl.includes(nav)) throw new Error('footer app link not found');
  tpl = tpl.replace(nav, '        <a href="/fishingdiary/" data-i18n="app_name_fishingdiary">Fishing Diary: Ocean Legends</a>\n' + nav);
  const priv = '        <a href="/kalemuhafizlari/privacy-policy.html" data-i18n="footer_privacy_kalemuhafizlari">Kale Muhafızları Privacy</a>';
  if (!tpl.includes(priv)) throw new Error('footer privacy link not found');
  tpl = tpl.replace(priv, '        <a href="/fishingdiary/privacy-policy.html" data-i18n="footer_privacy_fishingdiary">Fishing Diary Privacy</a>\n' + priv);
  fs.writeFileSync(tplPath, tpl);
  console.log('template updated');
}

// Icon next to the other apps' icons (build_site.py does not copy images).
// Source: E:\Soge\FishingDiary-GooglePlay\uygulama-ikonu-512.png (512x512, opaque, saved as optimized RGB PNG).
const icon = path.join(ROOT, 'MainSite/img/fishingdiary-icon.png');
if (!fs.existsSync(icon)) console.warn('WARNING: MainSite/img/fishingdiary-icon.png is missing');

const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'ar', 'hi', 'id', 'pl'];
// "70+ languages" badge: same wording as the existing badge_ss_langs ("75 Languages"), number replaced.
const LANG_BADGE_OVERRIDE = { ja: '🌐 70言語以上', ko: '🌐 70개 이상 언어' };
for (const lang of LANGS) {
  const main = path.join(TOOLS, `i18n/MainSite/index.${lang}.json`);
  const game = path.join(TOOLS, `i18n/FishingDiary/index.${lang}.json`);
  if (!fs.existsSync(main) || !fs.existsSync(game)) continue;
  const g = JSON.parse(fs.readFileSync(game, 'utf8'));
  const name = g.hero_title.replace(/<small>(.*)<\/small>/, ': $1').replace(/<[^>]+>/g, '').trim();
  const d = JSON.parse(fs.readFileSync(main, 'utf8'));
  const langsBadge = LANG_BADGE_OVERRIDE[lang] || d.badge_ss_langs.replace('75', '70+');
  Object.assign(d, {
    app_name_fishingdiary: name,
    app_desc_fishingdiary: g._description,
    badge_fd_species: `🎣 ${g.tag_3}`,
    badge_fd_weapons: `🔱 ${g.tag_1}`,
    badge_fd_langs: langsBadge,
    footer_privacy_fishingdiary: `${name} – ${g.nav_privacy}`,
  });
  fs.writeFileSync(main, JSON.stringify(d, null, 2) + '\n');
}
console.log('translations updated');
