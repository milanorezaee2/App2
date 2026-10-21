#!/usr/bin/env node
/**
 * Download the neural Russian narrator that `scripts/generate-russian-audio.py`
 * uses.
 *
 * The model is not committed: ~63 MB of weights the app never loads (the lessons
 * play pre-rendered MP3s). A fresh checkout needs this one command before it can
 * rebuild the pack.
 *
 * The file is pinned to a public GitHub mirror because the original distribution
 * (Hugging Face / rhasspy/piper-voices) is not reachable from every build machine,
 * and because a pinned blob makes the narrator reproducible: same weights, same
 * voice.
 *
 *   node scripts/fetch-russian-voice-model.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const preset = JSON.parse(fs.readFileSync(path.join(root, 'config/russian-narrator.json'), 'utf8'));
const wanted = process.argv.slice(2).filter(arg => !arg.startsWith('-'));

function gh(args) {
  return execFileSync('gh', args, { maxBuffer: 512 * 1024 * 1024 });
}

const trees = new Map();
function treeOf(repo) {
  if (!trees.has(repo)) {
    const branch = JSON.parse(gh(['api', `repos/${repo}`]).toString()).default_branch;
    trees.set(repo, JSON.parse(gh(['api', `repos/${repo}/git/trees/${branch}?recursive=1`]).toString()).tree);
  }
  return trees.get(repo);
}

let downloaded = 0;
for (const narrator of preset.narrators) {
  if (wanted.length && !wanted.includes(narrator.id)) continue;
  const target = path.join(root, narrator.model);
  const configTarget = path.join(root, narrator.modelConfig);
  if (fs.existsSync(target) && fs.existsSync(configTarget)) {
    console.log(`${narrator.id}: already present`);
    continue;
  }
  const [repo, folder] = narrator.modelMirror.split(':');
  const tree = treeOf(repo);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  for (const [name, dest] of [
    [`${narrator.voice}.onnx`, target],
    [`${narrator.voice}.onnx.json`, configTarget],
  ]) {
    const entry = tree.find(item => item.path === `${folder}/${name}`);
    if (!entry) {
      console.error(`${repo}: ${folder}/${name} not found`);
      process.exit(1);
    }
    const bytes = gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/git/blobs/${entry.sha}`]);
    fs.writeFileSync(dest, bytes);
    downloaded += 1;
    console.log(`${path.relative(root, dest)}  ${(bytes.length / 1e6).toFixed(1)} MB`);
  }
}
console.log(downloaded ? `${downloaded} files downloaded` : 'nothing to do');
