// Structural check for every Russian sentence (all content files).
// Run: node scripts/check-russian-sentences.cjs
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'lib', 'languages');
const files = [
  'russian.ts',
  'russianLevel1Extension.ts',
  'russianSurvivalExtension.ts',
  'russianEverydayPartA.ts',
  'russianEverydayPartB.ts',
];
const source = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

const re = /\b(?:sentence|s|everydaySentence)\('([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'/g;
let m;
let count = 0;
const problems = [];
const seen = new Set();
while ((m = re.exec(source))) {
  count++;
  const [, id, text, fa, pron] = m;
  const issues = [];
  if (seen.has(id)) issues.push('duplicate-id');
  seen.add(id);
  if (!/[А-Яа-яЁё]/.test(text)) issues.push('text-not-cyrillic');
  if (!fa.trim()) issues.push('no-persian-meaning');
  if (!pron.trim()) issues.push('no-pronunciation');
  if (/[А-Яа-яЁё]/.test(pron)) issues.push('pronunciation-has-cyrillic');
  if (/[A-Za-z]/.test(pron)) issues.push('pronunciation-has-latin');
  if (issues.length) problems.push(`${id}: ${issues.join(', ')} | ${text}`);
}

console.log(`checked ${count} Russian sentences`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('no structural issues');
