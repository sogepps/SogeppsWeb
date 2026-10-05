/**
 * Adds the Kale Muhafızları card, footer links and translations to the main site (sogepps.tr/).
 * Texts come from the game's own site translations (tools/i18n/KaleMuhafizlari/index.<lang>.json).
 * Idempotent: running it again changes nothing.
 *
 *   node tools/templates/KaleMuhafizlari/add-to-mainsite.cjs
 */
const fs = require('fs');
const path = require('path');

const TOOLS = path.join(__dirname, '..', '..');
const ROOT = path.join(TOOLS, '..');
const tplPath = path.join(TOOLS, 'templates/MainSite/index.html');
let tpl = fs.readFileSync(tplPath, 'utf8');

if (!tpl.includes('/kalemuhafizlari/')) {
  const card = `<a href="/kalemuhafizlari/" class="app-card">
      <div class="app-icon" style="background: linear-gradient(135deg, #1d4d2b, #3f8f3a);">
        <img src="img/kalemuhafizlari-icon.png" alt="Kale Muhafızları uygulama simgesi" onerror="this.style.display='none';this.nextElementSibling.classList.add('show');" />
        <span class="app-icon-fallback" aria-hidden="true">&#127984;</span>
      </div>
      <div class="app-info">
        <h3 data-i18n="app_name_kalemuhafizlari">Castle Guardians</h3>
        <p data-i18n="app_desc_kalemuhafizlari">Arm your castle with towers, stop the enemy waves and defeat the bosses.</p>
        <div class="app-badges">
          <span class="app-badge" data-i18n="badge_km_levels">&#9876;&#65039; 250 levels</span>
          <span class="app-badge" data-i18n="badge_km_towers">&#127984; 5 towers · 4 heroes</span>
          <span class="app-badge" data-i18n="badge_ss_langs">&#127760; 75 Languages</span>
        </div>
        <div class="app-arrow" data-i18n="app_view">View Details &#8594;</div>
      </div>
    </a>
`;
  // Newest first: before Cadıya Sor.
  const anchor = '    <a href="/cadiyasor/" class="app-card">';
  const at = tpl.indexOf(anchor);
  if (at === -1) throw new Error('Cadıya Sor card not found');
  tpl = tpl.slice(0, at) + '    ' + card + tpl.slice(at);
  const nav = '        <a href="/cadiyasor/" data-i18n="app_name_cadiyasor">Cadıya Sor</a>';
  if (!tpl.includes(nav)) throw new Error('footer app link not found');
  tpl = tpl.replace(nav, '        <a href="/kalemuhafizlari/" data-i18n="app_name_kalemuhafizlari">Kale Muhafızları</a>\n' + nav);
  const priv = '        <a href="/cadiyasor/privacy-policy.html" data-i18n="footer_privacy_cadiyasor">Cadıya Sor Privacy</a>';
  if (!tpl.includes(priv)) throw new Error('footer privacy link not found');
  tpl = tpl.replace(priv, '        <a href="/kalemuhafizlari/privacy-policy.html" data-i18n="footer_privacy_kalemuhafizlari">Kale Muhafızları Privacy</a>\n' + priv);
  fs.writeFileSync(tplPath, tpl);
  console.log('template updated');
}

// Icon next to the other apps' icons (build_site.py does not copy images).
const icon = path.join(ROOT, 'MainSite/img/kalemuhafizlari-icon.png');
if (!fs.existsSync(icon)) fs.copyFileSync(path.join(TOOLS, 'templates/KaleMuhafizlari/img/icon.png'), icon);

const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'ar', 'hi', 'id', 'pl'];
for (const lang of LANGS) {
  const main = path.join(TOOLS, `i18n/MainSite/index.${lang}.json`);
  const game = path.join(TOOLS, `i18n/KaleMuhafizlari/index.${lang}.json`);
  if (!fs.existsSync(main) || !fs.existsSync(game)) continue;
  const g = JSON.parse(fs.readFileSync(game, 'utf8'));
  const name = g.hero_title.replace(/<small>.*$/, '').trim();
  const d = JSON.parse(fs.readFileSync(main, 'utf8'));
  Object.assign(d, {
    app_name_kalemuhafizlari: name,
    app_desc_kalemuhafizlari: g._description,
    badge_km_levels: `⚔️ ${g.tag_1}`,
    badge_km_towers: `🏰 ${g.tag_2} · ${g.tag_3}`,
    footer_privacy_kalemuhafizlari: `${name} – ${g.nav_privacy}`,
  });
  fs.writeFileSync(main, JSON.stringify(d, null, 2) + '\n');
}
console.log('translations updated');
