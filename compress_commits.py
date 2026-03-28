#!/usr/bin/env python3
"""
分析并压缩 Git 提交历史
按天压缩提交，生成中文 commit 信息
"""

import subprocess
import os
from collections import defaultdict
from datetime import datetime

def run(cmd):
    """运行命令"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
    return result.stdout.strip()

def get_commit_files(commit_hash):
    """获取提交修改的文件列表"""
    try:
        output = run(f"git show --name-only --pretty=format: {commit_hash}")
        files = [f for f in output.split('\n') if f and not f.startswith('commit')]
        return files
    except:
        return []

def get_commit_stats(commit_hash):
    """获取提交的统计信息"""
    try:
        output = run(f"git show --stat --pretty=format: {commit_hash}")
        return output
    except:
        return ""

def analyze_commits():
    """分析所有提交"""
    print("📊 分析提交历史...")

    output = run('git log --reverse --format="%H|%ai|%s|%an"')
    commits_by_day = defaultdict(list)

    for line in output.strip().split('\n'):
        if not line:
            continue
        parts = line.split('|')
        if len(parts) >= 3:
            date_key = parts[1].split()[0]
            commits_by_day[date_key].append({
                'hash': parts[0],
                'date': parts[1],
                'msg': parts[2],
                'author': parts[3] if len(parts) > 3 else ''
            })

    print(f"✅ 总共 {len(commits_by_day)} 天，{sum(len(v) for v in commits_by_day.values())} 个提交\n")
    return commits_by_day

def generate_commit_message(date, commits):
    """生成详细的中文 commit 信息"""

    # 获取文件变更
    all_files = set()
    for commit in commits:
        files = get_commit_files(commit['hash'])
        all_files.update(files)

    # 分析变更类型
    frontend_files = [f for f in all_files if f.startswith('app/src/')]
    backend_files = [f for f in all_files if f.startswith('src-tauri/src/')]
    docs_files = [f for f in all_files if f.startswith('docs/') or 'README' in f or 'LICENSE' in f]
    config_files = [f for f in all_files if any(x in f for x in ['package.json', 'tsconfig', 'vite.config', 'tailwind', 'Cargo.toml', 'tauri.conf'])]

    # 分析功能模块
    modules = defaultdict(set)
    for f in frontend_files:
        if '/Dashboard' in f:
            modules['Dashboard'].add(f)
        elif '/GitHubBackup' in f:
            modules['GitHub备份'].add(f)
        elif '/Settings' in f:
            modules['设置页面'].add(f)
        elif '/components/' in f:
            modules['组件库'].add(f)

    # 生成标题
    title_parts = []
    if any('marketplace' in c['msg'].lower() for c in commits):
        title_parts.append("市场功能")
    if any('agent' in c['msg'].lower() for c in commits):
        title_parts.append("Agent功能")
    if any('github' in c['msg'].lower() and 'backup' in c['msg'].lower() for c in commits):
        title_parts.append("GitHub备份")
    if any('i18n' in c['msg'].lower() or 'language' in c['msg'].lower() for c in commits):
        title_parts.append("国际化")
    if 'Dashboard' in modules:
        title_parts.append("主面板优化")
    if len(frontend_files) > 20:
        title_parts.append("前端重构")

    if not title_parts:
        title_parts.append("功能更新")

    title = f"{date}: " + "、".join(title_parts[:3])

    # 生成详细说明
    details = []

    # 前端变更
    if frontend_files:
        if len(frontend_files) > 30:
            details.append(f"- 前端：大规模重构，涉及 {len(frontend_files)} 个文件")
        elif len(frontend_files) > 10:
            details.append(f"- 前端：重构 {len(frontend_files)} 个文件")
        else:
            details.append(f"- 前端：修改 {len(frontend_files)} 个文件")

        if modules:
            module_list = "、".join([f"{k}({len(v)}个文件)" for k, v in modules.items()])
            details.append(f"  主要模块：{module_list}")

    # 后端变更
    if backend_files:
        if len(backend_files) > 10:
            details.append(f"- 后端：重构 {len(backend_files)} 个文件")
        else:
            details.append(f"- 后端：修改 {len(backend_files)} 个文件")

    # 文档变更
    if docs_files:
        details.append(f"- 文档：更新 {len(docs_files)} 个文档文件")

    # 配置变更
    if config_files:
        details.append(f"- 配置：更新 {len(config_files)} 个配置文件")

    # 统计修复和功能
    fix_count = sum(1 for c in commits if 'fix:' in c['msg'].lower() or 'fix(' in c['msg'].lower())
    feat_count = sum(1 for c in commits if 'feat:' in c['msg'].lower() or 'feat(' in c['msg'].lower())
    refactor_count = sum(1 for c in commits if 'refactor:' in c['msg'].lower() or 'refactor(' in c['msg'].lower())

    if fix_count > 0:
        details.append(f"- 修复 {fix_count} 个问题")
    if feat_count > 5:
        details.append(f"- 新增 {feat_count} 项功能")
    if refactor_count > 3:
        details.append(f"- 执行 {refactor_count} 次重构")

    return title + "\n" + "\n".join(details)

def main():
    print("=" * 80)
    print("Git 提交历史压缩工具")
    print("=" * 80)
    print()

    # 分析提交
    commits_by_day = analyze_commits()

    # 生成压缩计划
    print("=" * 80)
    print("压缩计划")
    print("=" * 80)
    print()

    plan = []
    for date in sorted(commits_by_day.keys()):
        commits = commits_by_day[date]
        commit_msg = generate_commit_message(date, commits)
        plan.append({
            'date': date,
            'count': len(commits),
            'msg': commit_msg,
            'commits': commits
        })

        print(f"📅 {date} ({len(commits)} 个提交)")
        print(commit_msg.split('\n')[0])
        print()

    # 保存计划到文件
    with open('/tmp/git_compress_plan.txt', 'w') as f:
        for item in plan:
            f.write(f"DATE: {item['date']}\n")
            f.write(f"COUNT: {item['count']}\n")
            f.write(f"MESSAGE:\n{item['msg']}\n")
            f.write("=" * 80 + "\n")

    print(f"✅ 压缩计划已保存到 /tmp/git_compress_plan.txt")
    print()
    print(f"📊 统计：")
    print(f"   原始提交数：{sum(len(v) for v in commits_by_day.values())}")
    print(f"   压缩后提交数：{len(plan)}")
    print(f"   压缩比：{sum(len(v) for v in commits_by_day.values()) // len(plan)}:1")
    print()

    return plan

if __name__ == '__main__':
    main()
