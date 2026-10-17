#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');
const keystorePath = path.join(androidDir, 'app', 'release-key.p12');
const propertiesPath = path.join(androidDir, 'gradle.properties');
const base64 = (process.env.ANDROID_RELEASE_KEYSTORE_BASE64 || '').replace(/\s+/g, '');
const storePassword = process.env.ANDROID_RELEASE_STORE_PASSWORD || '';
const alias = process.env.ANDROID_RELEASE_KEY_ALIAS || '';
const keyPassword = process.env.ANDROID_RELEASE_KEY_PASSWORD || '';

if (!base64 || !storePassword || !alias || !keyPassword) {
  throw new Error('Stable Android release-signing GitHub Actions secrets are required; refusing to use a temporary debug key.');
}
if (!/^[A-Za-z0-9_.-]{1,80}$/.test(alias)) throw new Error('Android release key alias is invalid.');
const keystore = Buffer.from(base64, 'base64');
if (keystore.length < 1000) throw new Error('Android release keystore data is invalid or incomplete.');
writeFileSync(keystorePath, keystore, { mode: 0o600 });
chmodSync(keystorePath, 0o600);

let properties = readFileSync(propertiesPath, 'utf8');
const names = ['ANDROID_RELEASE_STORE_PASSWORD', 'ANDROID_RELEASE_KEY_ALIAS', 'ANDROID_RELEASE_KEY_PASSWORD'];
properties = properties.split(/\r?\n/).filter(line => !names.some(name => line.startsWith(`${name}=`))).join('\n');
properties += `\n${names[0]}=${storePassword}\n${names[1]}=${alias}\n${names[2]}=${keyPassword}\n`;
writeFileSync(propertiesPath, properties, { mode: 0o600 });
chmodSync(propertiesPath, 0o600);
console.log('Stable Android signing configured; secret values were not printed.');
