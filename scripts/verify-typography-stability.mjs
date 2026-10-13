#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const walk = directory => readdirSync(path.join(root, directory)).flatMap(name => {
  const relative = path.join(directory, name);
  const full = path.join(root, relative);
  return statSync(full).isDirectory() ? walk(relative) : relative.endsWith('.tsx') ? [relative] : [];
});
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };

const layout = read('app/_layout.tsx');
const theme = read('lib/theme.ts');
const pkg = JSON.parse(read('package.json'));
check(pkg.dependencies['@expo-google-fonts/inter'], 'bundled Inter dependency is declared');
check(/Inter_400Regular[\s\S]*Inter_600SemiBold[\s\S]*Inter_800ExtraBold/.test(layout), 'regular, semibold and extrabold Inter faces are bundled');
check(/IRANSansBusiness:[\s\S]*IRANSansWeb\.ttf/.test(layout), 'Persian IRANSans face remains bundled locally');
check(/latinFontFamily:\s*'Inter-ExtraBold'/.test(theme), 'shared Latin typography points to the bundled deterministic face');
check(/allowFontScaling:\s*false/.test(layout) && /maxFontSizeMultiplier:\s*1/.test(layout), 'OEM/user font scaling cannot destabilize layouts');

const missing = [];
for (const file of [...walk('app'), ...walk('components')]) {
  const lines = read(file).split('\n');
  lines.forEach((line, index) => {
    if (!line.includes("writingDirection: 'ltr'") && !line.includes("writingDirection:'ltr'")) return;
    const nearby = lines.slice(Math.max(0, index - 14), index + 1).join('\n');
    if (!line.includes('fontFamily') && !nearby.includes('fontFamily: Typography.latinFontFamily')) {
      missing.push(`${file}:${index + 1}`);
    }
  });
}
check(missing.length === 0, `every explicit LTR style has a bundled font (${missing.join(', ')})`);

const emma = read('app/conversations/emma.tsx');
const human = read('app/conversations/human/[conversationId].tsx');
const appConfig = read('app.json');
check(/"softwareKeyboardLayoutMode":\s*"resize"/.test(appConfig), 'Android manifest is generated with native keyboard resize');
check(/composer:\s*\{\s*flexShrink:\s*0/.test(emma) && /composer:\s*\{\s*flexShrink:\s*0/.test(human), 'chat composers cannot be clipped during resize');
check(!/Platform\.OS === 'android' \? 'height'/.test(emma) && !/Platform\.OS === 'android' \? 'height'/.test(human), 'Android native adjustResize is not double-applied');
check(/automaticallyAdjustKeyboardInsets=\{Platform\.OS === 'ios'\}/.test(emma)
  && /automaticallyAdjustKeyboardInsets=\{Platform\.OS === 'ios'\}/.test(human), 'iOS scroll insets track the keyboard');

console.log(`${checks} typography and keyboard-stability checks passed.`);
