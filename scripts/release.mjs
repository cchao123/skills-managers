#!/usr/bin/env node
/**
 * 智能发布脚本
 *
 * 用法：
 *   node scripts/release.mjs           # 自动递增版本号（1.0.4 → 1.0.5）
 *   node scripts/release.mjs 1.2.0     # 手动指定版本号
 *   node scripts/release.mjs minor     # 递增次版本号（1.0.4 → 1.1.0）
 *   node scripts/release.mjs major     # 递增主版本号（1.0.4 → 2.0.0）
 *
 * 功能：
 *   1. 自动/手动更新版本号（同步到 package.json / tauri.conf.json / Cargo.toml）
 *   2. 提交版本号更改到 git
 *   3. 创建 git tag
 *   4. 推送代码和 tag 到远程
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');

// 读取当前版本号
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const currentVersion = pkg.version;

// 解析版本号
const parseVersion = (version) => {
  const [core, pre] = version.split('-');
  const [major, minor, patch] = core.split('.').map(n => parseInt(n, 10));
  return { major, minor, patch, pre };
};

// 格式化版本号
const formatVersion = ({ major, minor, patch, pre }) => {
  const core = `${major}.${minor}.${patch}`;
  return pre ? `${core}-${pre}` : core;
};

// 递增版本号
const bumpVersion = (version, type = 'patch') => {
  const v = parseVersion(version);

  switch (type) {
    case 'major':
      return { major: v.major + 1, minor: 0, patch: 0, pre: null };
    case 'minor':
      return { major: v.major, minor: v.minor + 1, patch: 0, pre: null };
    case 'patch':
    default:
      return { major: v.major, minor: v.minor, patch: v.patch + 1, pre: null };
  }
};

// 获取新版本号
const getNewVersion = (arg) => {
  if (!arg) {
    // 默认递增 patch 版本
    return formatVersion(bumpVersion(currentVersion, 'patch'));
  }

  if (['major', 'minor', 'patch'].includes(arg)) {
    return formatVersion(bumpVersion(currentVersion, arg));
  }

  // 验证手动输入的版本号
  if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(arg)) {
    console.error(`❌ Invalid semver: ${arg}`);
    process.exit(1);
  }

  return arg;
};

// 执行 git 命令
const git = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: root }).trim();
  } catch (error) {
    console.error(`❌ Git command failed: ${cmd}`);
    console.error(error.message);
    process.exit(1);
  }
};

// 检查 git 状态
const checkGitStatus = () => {
  const status = git('git status --porcelain');
  if (status) {
    console.error('❌ Working directory is not clean. Please commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }
};

// 检查当前分支
const checkCurrentBranch = () => {
  const branch = git('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    console.warn(`⚠️  You are on '${branch}' branch. Recommend using 'main' branch for release.`);
    const answer = process.stdin.isTTY ? require('readline-sync').question('Continue? (y/N) ') : 'n';
    if (answer.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }
};

// 主流程
const main = () => {
  const arg = process.argv[2];
  const newVersion = getNewVersion(arg);

  console.log(`\n📦 Release ${currentVersion} → ${newVersion}\n`);

  // 检查 git 状态
  checkGitStatus();
  checkCurrentBranch();

  // 1. 更新版本号（调用 sync-version.mjs）
  console.log('📝 Updating version numbers...');
  const syncScript = resolve(root, 'scripts/sync-version.mjs');
  execSync(`node "${syncScript}" ${newVersion}`, { cwd: root, stdio: 'inherit' });

  // 2. 提交版本号更改
  console.log('\n✅ Committing version changes...');
  git('git add -u');
  git(`git commit -m "chore: bump version to ${newVersion}"`);

  // 3. 创建 tag
  console.log(`✅ Creating tag v${newVersion}...`);
  git(`git tag v${newVersion}`);

  // 4. 推送到远程
  console.log('🚀 Pushing to remote...');
  try {
    git('git push');
    git(`git push origin v${newVersion}`);
  } catch (error) {
    console.error('\n❌ Push failed. You may need to push manually:');
    console.error(`   git push`);
    console.error(`   git push origin v${newVersion}`);
    process.exit(1);
  }

  console.log(`\n✨ Release v${newVersion} created successfully!`);
  console.log(`\n🔗 View GitHub Actions: https://github.com/cchao123/skills-managers/actions\n`);
};

main();
