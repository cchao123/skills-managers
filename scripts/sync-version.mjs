#!/usr/bin/env node
/**
 * 把 package.json 的 version 同步到：
 *   - src-tauri/tauri.conf.json
 *   - src-tauri/Cargo.toml
 *
 * 用法：
 *   node scripts/sync-version.mjs           # 读取 package.json 的 version 并同步
 *   node scripts/sync-version.mjs 1.0.3     # 先改 package.json 再同步
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json');
const cargoPath = resolve(root, 'src-tauri/Cargo.toml');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const arg = process.argv[2];
if (arg) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(arg)) {
    console.error(`Invalid semver: ${arg}`);
    process.exit(1);
  }
  pkg.version = arg;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

const version = pkg.version;

const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf-8'));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

let cargo = readFileSync(cargoPath, 'utf-8');
cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`✓ synced version to ${version}`);
console.log('  - package.json');
console.log('  - src-tauri/tauri.conf.json');
console.log('  - src-tauri/Cargo.toml');
