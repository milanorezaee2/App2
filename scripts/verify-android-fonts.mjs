import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const config = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const plugin = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-font');
const families = plugin[1].android.fonts;
for (const name of ['Vazir', 'Vazir-Medium', 'Vazir-Bold', 'Vazir-Black', 'Inter', 'Inter-SemiBold', 'Inter-ExtraBold', 'Lalezar', 'Vazirmatn', 'Vazirmatn-Medium', 'Vazirmatn-Bold']) {
  const family = families.find(f => f.fontFamily === name);
  assert.ok(family, `Missing native alias: ${name}`);
  for (const face of family.fontDefinitions) {
    assert.ok(existsSync(face.path), face.path);
    const data = readFileSync(face.path);
    assert.equal(data.readUInt32BE(0), 0x00010000, `Not a TrueType font: ${face.path}`);
    const tables = data.readUInt16BE(4);
    for (let n = 0; n < tables; n++) {
      const pos = 12 + 16 * n;
      assert.ok(data.readUInt32BE(pos + 8) + data.readUInt32BE(pos + 12) <= data.length, `Truncated font: ${face.path}`);
    }
  }
}
const layout = readFileSync('app/_layout.tsx', 'utf8');
assert.match(layout, /Platform.OS === 'android' && Constants.appOwnership !== 'expo'/);
assert.match(layout, /useFonts\(nativeFontsEmbedded \? \{\} : \{/);
console.log('All 11 native font aliases have complete embedded TrueType resources; standalone Android skips runtime cache loading.');
