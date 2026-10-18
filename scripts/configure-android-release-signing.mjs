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
const runId = process.env.GITHUB_RUN_ID || `local-${process.pid}`;
const temporaryDirectory = path.join(process.env.RUNNER_TEMP || os.tmpdir(), `milo-android-signing-${runId}`);
const temporaryKeystore = path.join(temporaryDirectory, 'release-key.p12');
const metadataPath = path.join(temporaryDirectory, 'signing.json');
mkdirSync(temporaryDirectory, { recursive: true, mode: 0o700 });

let storePassword;
let keyPassword;
let alias;
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

const keystore = readFileSync(temporaryKeystore);
writeFileSync(keystorePath, keystore, { mode: 0o600 });
chmodSync(keystorePath, 0o600);

let properties = readFileSync(propertiesPath, 'utf8');
const names = ['ANDROID_EPHEMERAL_STORE_PASSWORD', 'ANDROID_EPHEMERAL_KEY_ALIAS', 'ANDROID_EPHEMERAL_KEY_PASSWORD'];
properties = properties.split(/\r?\n/).filter(line => !names.some(name => line.startsWith(`${name}=`))).join('\n');
properties += `\n${names[0]}=${storePassword}\n${names[1]}=${alias}\n${names[2]}=${keyPassword}\n`;
writeFileSync(propertiesPath, properties, { mode: 0o600 });
chmodSync(propertiesPath, 0o600);

console.log('One-run Android signing configured; the temporary private key is not stored in the repository or release.');
