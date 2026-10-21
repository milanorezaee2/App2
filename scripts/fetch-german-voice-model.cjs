#!/usr/bin/env node
/**
 * Download the neural German voices that `scripts/generate-german-audio.py` uses.
 *
 * The models are not committed: ~155 MB of weights that the app never loads (the
 * lessons play pre-rendered MP3s). A fresh checkout needs this one command before
 * it can rebuild a pack.
 *
 * Every file is pinned to a public GitHub mirror because the original
 * distribution (Hugging Face) is not reachable from every build machine, and
 * because a pinned blob makes a voice reproducible: same weights, same narrator.
 *
 *   node scripts/fetch-german-voice-model.cjs              # every narrator
 *   node scripts/fetch-german-voice-model.cjs kerstin      # just one
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const preset = JSON.parse(fs.readFileSync(path.join(root, 'config/german-narrator.json'), 'utf8'));
const wanted = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
const narrators = preset.narrators.filter(narrator => !wanted.length || wanted.includes(narrator.id));
if (!narrators.length) {
  console.error(`unknown narrator; choose one of: ${preset.narrators.map(item => item.id).join(', ')}`);
  process.exit(1);
}

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
for (const narrator of narrators) {
  const target = path.join(root, narrator.model);
  const configTarget = path.join(root, narrator.modelConfig);
  if (!narrator.modelMirror) {
    console.error(`${narrator.id}: config/german-narrator.json has no modelMirror`);
    process.exit(1);
  }
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
