/**
 * Writes tools/i18n/SessizSinema/<page>.tr.json from the Turkish text in a template, so the
 * template stays the single place the Turkish copy is written.
 *
 *   node tools/templates/SessizSinema/extract-tr.cjs privacy-policy.html privacy
 */
const fs = require('fs');
const path = require('path');

const [file, pagekey] = process.argv.slice(2);
const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
const out = {};
const title = html.match(/<title>([\s\S]*?)<\/title>/);
const desc = html.match(/<meta name="description" content="([^"]*)"/);
if (title) out._title = title[1].trim();
if (desc) out._description = desc[1].trim();

const re = /<(\w+)([^>]*?)\sdata-i18n(-html)?="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
for (const m of html.matchAll(re)) {
  const [, , , isHtml, key, , inner] = m;
  const text = inner.replace(/\s+/g, ' ').trim();
  out[key] = isHtml ? text : text.replace(/&#8592;/g, '←').replace(/&amp;/g, '&');
}
const dest = path.join(__dirname, '..', '..', 'i18n', 'SessizSinema', `${pagekey}.tr.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log(`${Object.keys(out).length} keys → ${dest}`);
