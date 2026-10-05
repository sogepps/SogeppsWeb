/**
 * Lists local MainSite files whose MD5 differs from the live server (hash list fetched over SSH),
 * so a deploy uploads only what actually changed.
 *
 *   node tools/templates/SessizSinema/diff-live.cjs <live-hashes.txt> <folder>
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [listFile, folder] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..', '..', '..');
const live = new Map();
for (const line of fs.readFileSync(listFile, 'utf8').split(/\r?\n/)) {
  const [hash, rel] = line.split('|');
  if (!hash || !rel) continue;
  live.set(rel.replace(/^e\\/, '').replace(/\\/g, '/').toLowerCase(), hash.toLowerCase());
}

const out = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      const rel = path.relative(path.join(ROOT, folder), p).replace(/\\/g, '/');
      const md5 = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
      if (live.get(rel.toLowerCase()) !== md5) out.push(`${folder}/${rel}`);
    }
  }
};
walk(path.join(ROOT, folder));
console.log(out.join('\n'));
