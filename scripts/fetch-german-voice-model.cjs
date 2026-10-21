#!/usr/bin/env node
/**
 * Download the neural German voice that `scripts/generate-german-audio.py` uses.
 *
 * The model is not committed: it is 63 MB of weights and the app never loads it
 * (the lessons play pre-rendered MP3s). A fresh checkout therefore needs this
 * one command before it can rebuild the pack.
 *
 * The file is pinned to a public GitHub mirror because the original distribution
 * (Hugging Face) is not reachable from every build machine, and because a pinned
 * commit makes the voice reproducible: the same weights, the same narrator.
 *
 *   node scripts/fetch-german-voice-model.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const preset = JSON.parse(fs.readFileSync(path.join(root, 'config/german-narrator.json'), 'utf8'));
const [repo, folder] = preset.modelMirror.split(':');
const target = path.join(root, preset.model);
const configTarget = path.join(root, preset.modelConfig);

function gh(args) {
  return execFileSync('gh', args, { maxBuffer: 256 * 1024 * 1024 });
}

if (!preset.modelMirror || !repo || !folder) {
  console.error('config/german-narrator.json has no modelMirror to download from');
  process.exit(1);
}

if (fs.existsSync(target) && fs.existsSync(configTarget)) {
  console.log(`already present: ${preset.model}`);
  process.exit(0);
}

const branch = JSON.parse(gh(['api', `repos/${repo}`]).toString()).default_branch;
const tree = JSON.parse(gh(['api', `repos/${repo}/git/trees/${branch}?recursive=1`]).toString()).tree;
const find = name => {
  const entry = tree.find(item => item.path === `${folder}/${name}`);
  if (!entry) throw new Error(`${repo}: ${folder}/${name} not found`);
  return entry.sha;
};

fs.mkdirSync(path.dirname(target), { recursive: true });
for (const [name, dest] of [[preset.voice + '.onnx', target], [preset.voice + '.onnx.json', configTarget]]) {
  const sha = find(name);
  const bytes = gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/git/blobs/${sha}`]);
  fs.writeFileSync(dest, bytes);
  console.log(`${path.relative(root, dest)}  ${(bytes.length / 1e6).toFixed(1)} MB`);
}
