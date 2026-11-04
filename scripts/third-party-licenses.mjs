#!/usr/bin/env node
// Writes the notices for the third-party software MITI ships: every package in package-lock.json
// that is not dev-only (the server's node_modules, and what the browser bundle is built from), with
// its version, license and the license files it carries. The .deb and the Docker image include it.
//   node scripts/third-party-licenses.mjs <output file>     (after npm ci)
// Fails when a package has neither a license field nor a license file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/third-party-licenses.mjs <output file>');
  process.exit(2);
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i;
// next.config.js leaves sharp and its native binaries out of the standalone build.
const NOT_SHIPPED = /^(sharp|@img\/.+)$/;
const RULE = '='.repeat(80);
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const own = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const seen = new Set();
const sections = [];
const missing = [];
for (const [where, entry] of Object.entries(lock.packages)) {
  // The root package, dev-only packages, and links to folders in this repository are not shipped.
  if (!where || entry.dev || entry.devOptional || entry.link) continue;
  const dir = path.join(root, where);
  // Optional packages for other platforms are not installed here (sharp's binaries, for example).
  if (!fs.existsSync(dir)) {
    if (entry.optional) continue;
    missing.push(`${where} is not installed: run npm ci first`);
    continue;
  }
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const name = meta.name ?? where.slice(where.lastIndexOf('node_modules/') + 13);
  if (NOT_SHIPPED.test(name)) continue;
  const key = `${name}@${meta.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const license =
    typeof meta.license === 'string'
      ? meta.license
      : (meta.license?.type ?? meta.licenses?.map((l) => l.type ?? l).join(' OR '));
  const files = fs
    .readdirSync(dir)
    .filter((file) => LICENSE_FILE.test(file) && fs.statSync(path.join(dir, file)).isFile())
    .sort();
  if (!license && !files.length) missing.push(`${key} has no license field and no license file`);
  const repository = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
  const texts = files.map((file) => fs.readFileSync(path.join(dir, file), 'utf8').trim());
  sections.push(
    [
      RULE,
      `${key}`,
      `License: ${license ?? 'see the text below'}`,
      ...(repository ? [`Source: ${repository.replace(/^git\+/, '')}`] : []),
      '',
      ...(texts.length ? texts : ['(The package carries no license file.)']),
    ].join('\n')
  );
}

if (missing.length) {
  console.error(`third-party-licenses: ${missing.join('\n  ')}`);
  process.exit(1);
}

sections.sort((a, b) => a.split('\n')[1].localeCompare(b.split('\n')[1]));
const header = [
  `Third-party software in MITI ${own.version}`,
  '',
  `MITI itself is under the ${own.license} license (LICENSE). It ships the ${sections.length} packages`,
  'below, each under its own license.',
  '',
].join('\n');
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, `${header}\n${sections.join('\n\n')}\n`);
console.log(`Wrote ${out}: ${sections.length} packages`);
