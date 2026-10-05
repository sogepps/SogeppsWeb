/**
 * Adds the Sessiz Sinema card, footer links and translations to the main site (sogepps.tr/).
 * Idempotent: running it again changes nothing.
 *
 *   node tools/templates/SessizSinema/add-to-mainsite.cjs
 */
const fs = require('fs');
const path = require('path');

const TOOLS = path.join(__dirname, '..', '..');
const tplPath = path.join(TOOLS, 'templates/MainSite/index.html');
let tpl = fs.readFileSync(tplPath, 'utf8');

if (!tpl.includes('/sessizsinema/')) {
  const card = `
    <a href="/sessizsinema/" class="app-card">
      <div class="app-icon" style="background: linear-gradient(135deg, #C8102E, #F5C518);">
        <img src="img/sessizsinema-icon.png" alt="Sessiz Sinema uygulama simgesi" onerror="this.style.display='none';this.nextElementSibling.classList.add('show');" />
        <span class="app-icon-fallback" aria-hidden="true">&#127916;</span>
      </div>
      <div class="app-info">
        <h3 data-i18n="app_name_sessizsinema">Sessiz Sinema</h3>
        <p data-i18n="app_desc_sessizsinema">Act out films without a word while your team guesses. 600 films in 11 genres, titles as released in your country, 75 languages.</p>
        <div class="app-badges">
          <span class="app-badge" data-i18n="badge_ss_films">&#127916; 600 Films</span>
          <span class="app-badge" data-i18n="badge_ss_langs">&#127760; 75 Languages</span>
          <span class="app-badge" data-i18n="badge_sk_teams">&#128101; 2 Teams</span>
          <span class="app-badge" data-i18n="badge_sk_party">&#127881; Party</span>
        </div>
        <div class="app-arrow" data-i18n="app_view">View Details &#8594;</div>
      </div>
    </a>
`;
  const anchor = '    <a href="/sessizkelime/" class="app-card">';
  const at = tpl.indexOf(anchor);
  if (at === -1) throw new Error('Sessiz Kelime card not found');
  tpl = tpl.slice(0, at) + card.trimStart().replace(/^/, '    ').replace(/^    {4}/, '    ') + '\n' + tpl.slice(at);
  tpl = tpl.replace(
    '        <a href="/sessizkelime/" data-i18n="app_name_sessizkelime">Sessiz Kelime</a>',
    '        <a href="/sessizsinema/" data-i18n="app_name_sessizsinema">Sessiz Sinema</a>\n        <a href="/sessizkelime/" data-i18n="app_name_sessizkelime">Sessiz Kelime</a>',
  );
  tpl = tpl.replace(
    '        <a href="/sessizkelime/privacy-policy.html" data-i18n="footer_privacy_sessizkelime">Sessiz Kelime Privacy</a>',
    '        <a href="/sessizsinema/privacy-policy.html" data-i18n="footer_privacy_sessizsinema">Sessiz Sinema Privacy</a>\n        <a href="/sessizkelime/privacy-policy.html" data-i18n="footer_privacy_sessizkelime">Sessiz Kelime Privacy</a>',
  );
  fs.writeFileSync(tplPath, tpl);
  console.log('template updated');
}

const T = {
  tr: ['Sessiz Sinema', 'Filmi konuşmadan anlat, takımın bilsin. 11 türde 600 film, ülkende gösterildiği adlarıyla, 75 dilde.', '🎬 600 Film', '🌐 75 Dil', 'Sessiz Sinema Gizlilik'],
  en: ['Silent Cinema', 'Act out films without a word while your team guesses. 600 films in 11 genres, titles as released in your country, 75 languages.', '🎬 600 Films', '🌐 75 Languages', 'Silent Cinema Privacy'],
  de: ['Stummfilm (Sessiz Sinema)', 'Stelle Filme ohne ein Wort dar, dein Team rät. 600 Filme in 11 Genres, mit den Titeln aus deinem Land, in 75 Sprachen.', '🎬 600 Filme', '🌐 75 Sprachen', 'Stummfilm Datenschutz'],
  fr: ['Ciné Muet (Sessiz Sinema)', 'Mime des films sans un mot, ton équipe devine. 600 films dans 11 genres, avec les titres de ton pays, en 75 langues.', '🎬 600 films', '🌐 75 langues', 'Ciné Muet Confidentialité'],
  es: ['Cine Mudo (Sessiz Sinema)', 'Representa películas sin decir una palabra y que tu equipo adivine. 600 películas en 11 géneros, con los títulos de tu país, en 75 idiomas.', '🎬 600 películas', '🌐 75 idiomas', 'Cine Mudo Privacidad'],
  it: ['Cinema Muto (Sessiz Sinema)', 'Mima i film senza parlare e fai indovinare la tua squadra. 600 film in 11 generi, con i titoli del tuo Paese, in 75 lingue.', '🎬 600 film', '🌐 75 lingue', 'Cinema Muto Privacy'],
  pt: ['Cinema Mudo (Sessiz Sinema)', 'Faça mímica de filmes sem dizer nada e deixe a sua equipa adivinhar. 600 filmes em 11 géneros, com os títulos do seu país, em 75 idiomas.', '🎬 600 filmes', '🌐 75 idiomas', 'Cinema Mudo Privacidade'],
  nl: ['Stomme Film (Sessiz Sinema)', 'Beeld films uit zonder een woord te zeggen, je team raadt. 600 films in 11 genres, met de titels uit jouw land, in 75 talen.', '🎬 600 films', '🌐 75 talen', 'Stomme Film Privacy'],
  ru: ['Немое кино (Sessiz Sinema)', 'Показывайте фильмы без слов, команда угадывает. 600 фильмов в 11 жанрах, с названиями вашего проката, на 75 языках.', '🎬 600 фильмов', '🌐 75 языков', 'Немое кино: конфиденциальность'],
  ja: ['サイレントシネマ (Sessiz Sinema)', '言葉を使わずに映画をジェスチャーで伝え、チームが当てるパーティーゲーム。11ジャンル600本、あなたの国の邦題で、75言語対応。', '🎬 映画600本', '🌐 75言語', 'サイレントシネマ プライバシー'],
  ko: ['사일런트 시네마 (Sessiz Sinema)', '말 없이 영화를 몸짓으로 표현하고 팀이 맞히는 파티 게임. 11개 장르 600편, 우리나라 개봉 제목으로, 75개 언어 지원.', '🎬 영화 600편', '🌐 75개 언어', '사일런트 시네마 개인정보'],
  ar: ['السينما الصامتة (Sessiz Sinema)', 'مثّل الأفلام دون أن تنطق بكلمة ودع فريقك يخمّن. 600 فيلم في 11 نوعًا، بأسماء عرضها في بلدك، وبـ75 لغة.', '🎬 600 فيلم', '🌐 75 لغة', 'خصوصية السينما الصامتة'],
  hi: ['मूक सिनेमा (Sessiz Sinema)', 'बिना बोले फ़िल्मों का अभिनय करें, आपकी टीम अंदाज़ा लगाए। 11 शैलियों में 600 फ़िल्में, आपके देश के नामों के साथ, 75 भाषाओं में।', '🎬 600 फ़िल्में', '🌐 75 भाषाएँ', 'मूक सिनेमा गोपनीयता'],
  id: ['Sinema Bisu (Sessiz Sinema)', 'Peragakan film tanpa bicara, timmu yang menebak. 600 film dalam 11 genre, dengan judul yang tayang di negaramu, dalam 75 bahasa.', '🎬 600 Film', '🌐 75 Bahasa', 'Privasi Sinema Bisu'],
  pl: ['Ciche Kino (Sessiz Sinema)', 'Pokazuj filmy bez słów, a twoja drużyna zgaduje. 600 filmów w 11 gatunkach, z tytułami z twojego kraju, w 75 językach.', '🎬 600 filmów', '🌐 75 języków', 'Ciche Kino – prywatność'],
};

for (const [lang, [name, desc, films, langs, privacy]] of Object.entries(T)) {
  const p = path.join(TOOLS, `i18n/MainSite/index.${lang}.json`);
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(d, {
    app_name_sessizsinema: name,
    app_desc_sessizsinema: desc,
    badge_ss_films: films,
    badge_ss_langs: langs,
    footer_privacy_sessizsinema: privacy,
  });
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
}
console.log('translations written');
