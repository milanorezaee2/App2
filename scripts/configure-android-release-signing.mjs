#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const androidDir = path.join(root, 'android');
const keystorePath = path.join(androidDir, 'app', 'release-key.p12');
const propertiesPath = path.join(androidDir, 'gradle.properties');
const temporarySigning = process.env.ANDROID_TEMPORARY_SIGNING === 'true';
let base64 = (process.env.ANDROID_RELEASE_KEYSTORE_BASE64 || '').replace(/\s+/g, '');
let storePassword = process.env.ANDROID_RELEASE_STORE_PASSWORD || '';
let alias = process.env.ANDROID_RELEASE_KEY_ALIAS || '';
let keyPassword = process.env.ANDROID_RELEASE_KEY_PASSWORD || '';
let keystore;

if (temporarySigning) {
  const runId = process.env.GITHUB_RUN_ID || 'local';
  const temporaryDirectory = path.join(process.env.RUNNER_TEMP || os.tmpdir(), `milo-android-signing-${runId}`);
  const temporaryKeystore = path.join(temporaryDirectory, 'release-key.p12');
  const metadataPath = path.join(temporaryDirectory, 'signing.json');
  mkdirSync(temporaryDirectory, { recursive: true, mode: 0o700 });

  if (!existsSync(temporaryKeystore) || !existsSync(metadataPath)) {
    storePassword = randomBytes(32).toString('hex');
    keyPassword = storePassword;
    alias = `milo_temp_${runId}`;
    execFileSync('keytool', [
      '-genkeypair', '-noprompt', '-storetype', 'PKCS12',
      '-keystore', temporaryKeystore, '-alias', alias,
      '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
      '-dname', 'CN=MiloMultiLanguage Temporary Android Release',
      '-storepass', storePassword, '-keypass', keyPassword,
    ], { stdio: 'ignore' });
    writeFileSync(metadataPath, JSON.stringify({ storePassword, keyPassword, alias }), { mode: 0o600 });
    chmodSync(temporaryKeystore, 0o600);
  } else {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    storePassword = metadata.storePassword;
    keyPassword = metadata.keyPassword;
    alias = metadata.alias;
  }

  keystore = readFileSync(temporaryKeystore);
  base64 = keystore.toString('base64');
} else {
  if (!base64 || !storePassword || !alias || !keyPassword) {
    throw new Error('Stable Android release-signing GitHub Actions secrets are required when temporary signing is off.');
  }
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(alias)) throw new Error('Android release key alias is invalid.');
  keystore = Buffer.from(base64, 'base64');
  if (keystore.length < 1000) throw new Error('Android release keystore data is invalid or incomplete.');
}

writeFileSync(keystorePath, keystore, { mode: 0o600 });
chmodSync(keystorePath, 0o600);

let properties = readFileSync(propertiesPath, 'utf8');
const names = ['ANDROID_RELEASE_STORE_PASSWORD', 'ANDROID_RELEASE_KEY_ALIAS', 'ANDROID_RELEASE_KEY_PASSWORD'];
properties = properties.split(/\r?\n/).filter(line => !names.some(name => line.startsWith(`${name}=`))).join('\n');
properties += `\n${names[0]}=${storePassword}\n${names[1]}=${alias}\n${names[2]}=${keyPassword}\n`;
writeFileSync(propertiesPath, properties, { mode: 0o600 });
chmodSync(propertiesPath, 0o600);

console.log(temporarySigning
  ? 'Temporary Android signing configured for this workflow run; future runs require uninstall and reinstall.'
  : 'Stable Android signing configured; secret values were not printed.');
