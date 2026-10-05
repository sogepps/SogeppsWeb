/**
 * Adds the Cadıya Sor card, footer links and translations to the main site (sogepps.tr/).
 * Idempotent: running it again changes nothing.
 *
 *   node tools/templates/CadiyaSor/add-to-mainsite.cjs
 */
const fs = require('fs');
const path = require('path');

const TOOLS = path.join(__dirname, '..', '..');
const tplPath = path.join(TOOLS, 'templates/MainSite/index.html');
let tpl = fs.readFileSync(tplPath, 'utf8');

if (!tpl.includes('/cadiyasor/')) {
  const card = `<a href="/cadiyasor/" class="app-card">
      <div class="app-icon" style="background: linear-gradient(135deg, #241250, #5a2fa0);">
        <img src="img/cadiyasor-icon.png" alt="Cadıya Sor uygulama simgesi" onerror="this.style.display='none';this.nextElementSibling.classList.add('show');" />
        <span class="app-icon-fallback" aria-hidden="true">&#128302;</span>
      </div>
      <div class="app-info">
        <h3 data-i18n="app_name_cadiyasor">Cadıya Sor</h3>
        <p data-i18n="app_desc_cadiyasor">Ask a question, rub the witch's cauldron and read your fate. A book of answers with a crystal ball, a daily omen and 75 languages.</p>
        <div class="app-badges">
          <span class="app-badge" data-i18n="badge_cs_answers">&#128302; 200 Answers</span>
          <span class="app-badge" data-i18n="badge_cs_omen">&#127769; Daily Omen</span>
          <span class="app-badge" data-i18n="badge_ss_langs">&#127760; 75 Languages</span>
        </div>
        <div class="app-arrow" data-i18n="app_view">View Details &#8594;</div>
      </div>
    </a>
`;
  const anchor = '    <a href="/sessizsinema/" class="app-card">';
  const at = tpl.indexOf(anchor);
  if (at === -1) throw new Error('Sessiz Sinema card not found');
  tpl = tpl.slice(0, at) + '    ' + card + tpl.slice(at);
  tpl = tpl.replace(
    '        <a href="/sessizsinema/" data-i18n="app_name_sessizsinema">Sessiz Sinema</a>',
    '        <a href="/cadiyasor/" data-i18n="app_name_cadiyasor">Cadıya Sor</a>\n        <a href="/sessizsinema/" data-i18n="app_name_sessizsinema">Sessiz Sinema</a>',
  );
  tpl = tpl.replace(
    '        <a href="/sessizsinema/privacy-policy.html" data-i18n="footer_privacy_sessizsinema">Sessiz Sinema Privacy</a>',
    '        <a href="/cadiyasor/privacy-policy.html" data-i18n="footer_privacy_cadiyasor">Cadıya Sor Privacy</a>\n        <a href="/sessizsinema/privacy-policy.html" data-i18n="footer_privacy_sessizsinema">Sessiz Sinema Privacy</a>',
  );
  fs.writeFileSync(tplPath, tpl);
  console.log('template updated');
}

const T = {
  tr: ['Cadıya Sor', 'Sorunu sor, cadının kazanını ovala, kaderini oku. Kristal küre, günün kehaneti ve 75 dil ile büyülü bir cevaplar kitabı.', '🔮 200 Cevap', '🌙 Günün Kehaneti', 'Cadıya Sor Gizlilik'],
  en: ['Ask the Witch', "Ask a question, rub the witch's cauldron and read your fate. A magical book of answers with a crystal ball, a daily omen and 75 languages.", '🔮 200 Answers', '🌙 Daily Omen', 'Ask the Witch Privacy'],
  de: ['Frag die Hexe (Cadıya Sor)', 'Stell eine Frage, reibe den Kessel der Hexe und lies dein Schicksal. Ein magisches Buch der Antworten mit Kristallkugel, Tagesomen und 75 Sprachen.', '🔮 200 Antworten', '🌙 Tagesomen', 'Frag die Hexe Datenschutz'],
  fr: ['Demande à la sorcière (Cadıya Sor)', 'Pose une question, frotte le chaudron de la sorcière et lis ton destin. Un livre des réponses magique avec boule de cristal, présage du jour et 75 langues.', '🔮 200 réponses', '🌙 Présage du jour', 'Demande à la sorcière Confidentialité'],
  es: ['Pregúntale a la bruja (Cadıya Sor)', 'Haz una pregunta, frota el caldero de la bruja y lee tu destino. Un libro de respuestas mágico con bola de cristal, presagio del día y 75 idiomas.', '🔮 200 respuestas', '🌙 Presagio del día', 'Pregúntale a la bruja Privacidad'],
  it: ['Chiedi alla strega (Cadıya Sor)', 'Fai una domanda, strofina il calderone della strega e leggi il tuo destino. Un libro delle risposte magico con sfera di cristallo, presagio del giorno e 75 lingue.', '🔮 200 risposte', '🌙 Presagio del giorno', 'Chiedi alla strega Privacy'],
  pt: ['Pergunta à Bruxa (Cadıya Sor)', 'Faz uma pergunta, esfrega o caldeirão da bruxa e lê o teu destino. Um livro das respostas mágico com bola de cristal, presságio do dia e 75 idiomas.', '🔮 200 respostas', '🌙 Presságio do dia', 'Pergunta à Bruxa Privacidade'],
  nl: ['Vraag het de heks (Cadıya Sor)', 'Stel een vraag, wrijf over de ketel van de heks en lees je lot. Een magisch antwoordenboek met kristallen bol, voorteken van de dag en 75 talen.', '🔮 200 antwoorden', '🌙 Voorteken van de dag', 'Vraag het de heks Privacy'],
  ru: ['Спроси ведьму (Cadıya Sor)', 'Задай вопрос, потри котёл ведьмы и узнай свою судьбу. Волшебная книга ответов с хрустальным шаром, знамением дня и 75 языками.', '🔮 200 ответов', '🌙 Знамение дня', 'Спроси ведьму: конфиденциальность'],
  ja: ['魔女に聞く (Cadıya Sor)', '質問して魔女の大鍋をこすれば、運命が現れる。水晶玉、今日のお告げ、75言語に対応した魔法の答えの書。', '🔮 200の答え', '🌙 今日のお告げ', '魔女に聞く プライバシー'],
  ko: ['마녀에게 물어봐 (Cadıya Sor)', '질문하고 마녀의 가마솥을 문지르면 운명이 드러나요. 수정 구슬, 오늘의 징조, 75개 언어의 마법 해답의 책.', '🔮 답변 200개', '🌙 오늘의 징조', '마녀에게 물어봐 개인정보'],
  ar: ['اسأل الساحرة (Cadıya Sor)', 'اطرح سؤالك، وافرك مرجل الساحرة، واقرأ قدرك. كتاب أجوبة سحري مع كرة بلورية وفأل اليوم و75 لغة.', '🔮 200 إجابة', '🌙 فأل اليوم', 'خصوصية اسأل الساحرة'],
  hi: ['चुड़ैल से पूछो (Cadıya Sor)', 'सवाल पूछो, चुड़ैल की कड़ाही रगड़ो और अपनी किस्मत पढ़ो। क्रिस्टल बॉल, आज के शगुन और 75 भाषाओं वाली जादुई जवाबों की किताब।', '🔮 200 जवाब', '🌙 आज का शगुन', 'चुड़ैल से पूछो गोपनीयता'],
  id: ['Tanya Penyihir (Cadıya Sor)', 'Ajukan pertanyaan, gosok kuali penyihir, dan baca takdirmu. Buku jawaban ajaib dengan bola kristal, pertanda hari ini, dan 75 bahasa.', '🔮 200 Jawaban', '🌙 Pertanda Hari Ini', 'Privasi Tanya Penyihir'],
  pl: ['Zapytaj wiedźmę (Cadıya Sor)', 'Zadaj pytanie, potrzyj kocioł wiedźmy i odczytaj swój los. Magiczna księga odpowiedzi z kryształową kulą, wróżbą dnia i 75 językami.', '🔮 200 odpowiedzi', '🌙 Wróżba dnia', 'Zapytaj wiedźmę – prywatność'],
};

for (const [lang, [name, desc, answers, omen, privacy]] of Object.entries(T)) {
  const p = path.join(TOOLS, `i18n/MainSite/index.${lang}.json`);
  if (!fs.existsSync(p)) continue;
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(d, {
    app_name_cadiyasor: name,
    app_desc_cadiyasor: desc,
    badge_cs_answers: answers,
    badge_cs_omen: omen,
    footer_privacy_cadiyasor: privacy,
  });
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
}
console.log('translations updated');
