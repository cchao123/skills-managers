#!/usr/bin/env python3
"""
更细粒度地压缩 Git 提交
目标：压缩到 30 条左右
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

def analyze_commits():
    """分析所有提交"""
    print("📊 分析提交历史...")

    output = run('git log --reverse --format="%H|%ai|%s"')

    commits = []
    for line in output.strip().split('\n'):
        if not line:
            continue
        parts = line.split('|')
        if len(parts) >= 3:
            date_str = parts[1]
            date_time = datetime.strptime(date_str.split()[0] + ' ' + date_str.split()[1][:5], '%Y-%m-%d %H:%M')
            commits.append({
                'hash': parts[0],
                'datetime': date_time,
                'date': date_str.split()[0],
                'time': date_str.split()[1][:5],
                'msg': parts[2]
            })

    print(f"✅ 总共 {len(commits)} 个提交\n")
    return commits

def group_commits_by_time(commits, target_count=30):
    """按时间分组提交，目标是达到目标数量"""

    total_commits = len(commits)
    commits_per_group = max(1, total_commits // target_count)

    groups = []
    current_group = []
    current_date = None

    for commit in commits:
        # 如果是第一组或者同一天且组内还有空间，加入当前组
        if not current_group:
            current_group.append(commit)
            current_date = commit['date']
        elif commit['date'] == current_date and len(current_group) < commits_per_group:
            current_group.append(commit)
        elif commit['date'] != current_date:
            # 新的一天，开始新组
            groups.append(current_group)
            current_group = [commit]
            current_date = commit['date']
        elif len(current_group) >= commits_per_group:
            # 当前组已满，开始新组
            groups.append(current_group)
            current_group = [commit]
        else:
            current_group.append(commit)

    if current_group:
        groups.append(current_group)

    return groups

def generate_commit_message(group):
    """生成中文 commit 信息"""

    first = group[0]
    last = group[-1]

    # 确定时间范围
    if len(group) == 1:
        time_range = f"{first['date']} {first['time']}"
    elif first['date'] == last['date']:
        time_range = f"{first['date']}"
    else:
        time_range = f"{first['date']} ~ {last['date']}"

    # 分析功能
    all_msgs = ' '.join([c['msg'] for c in group])

    features = []
    fixes = []
    others = []

    for c in group:
        msg_lower = c['msg'].lower()

        if 'feat' in msg_lower or 'add' in msg_lower:
            if 'marketplace' in msg_lower:
                if '市场功能' not in features:
                    features.append('市场功能')
            elif 'agent' in msg_lower:
                if 'Agent功能' not in features:
                    features.append('Agent功能')
            elif 'github' in msg_lower and 'backup' in msg_lower:
                if 'GitHub备份' not in features:
                    features.append('GitHub备份')
            elif 'ui' in msg_lower or 'dashboard' in msg_lower:
                if '主面板优化' not in features:
                    features.append('主面板优化')
            elif 'i18n' in msg_lower or 'language' in msg_lower:
                if '国际化' not in features:
                    features.append('国际化')
            elif 'test' in msg_lower:
                if '测试' not in features:
                    features.append('测试')
            elif 'docs' in msg_lower:
                if '文档' not in features:
                    features.append('文档')
            else:
                if '功能开发' not in features:
                    features.append('功能开发')

        if 'fix' in msg_lower:
            fixes.append(c['msg'])

    # 生成标题
    title_parts = []
    if features:
        title_parts.extend(features[:3])
    if fixes:
        title_parts.append(f"修复{len(fixes)}项")

    if not title_parts:
        title_parts.append("代码更新")

    title = f"{time_range}: " + "、".join(title_parts)

    # 生成详细说明
    details = []

    # 添加具体内容
    if len(group) > 5:
        details.append(f"- 合并 {len(group)} 个提交")

    if len(features) > 3:
        details.append(f"- 涉及功能：{', '.join(set(features))}")

    if fixes:
        details.append(f"- 修复问题：{len(fixes)} 项")

    # 提取关键文件变更
    all_files = set()
    for c in group:
        files = get_commit_files(c['hash'])
        all_files.update(files)

    if all_files:
        file_count = len(all_files)
        if file_count > 50:
            details.append(f"- 修改文件：约 {file_count} 个")
        elif file_count > 20:
            details.append(f"- 修改文件：{file_count} 个")

    return title + "\n" + "\n".join(details)

def main():
    print("=" * 80)
    print("Git 提交历史压缩工具（目标：30条左右）")
    print("=" * 80)
    print()

    # 分析提交
    commits = analyze_commits()

    # 分组
    groups = group_commits_by_time(commits, target_count=30)

    # 生成压缩计划
    print("=" * 80)
    print("压缩计划")
    print("=" * 80)
    print()

    plan = []
    for i, group in enumerate(groups, 1):
        commit_msg = generate_commit_message(group)
        plan.append({
            'group': group,
            'msg': commit_msg,
            'count': len(group)
        })

        print(f"[{i}/{len(groups)}] {commit_msg.split(chr(10))[0]}")
        print(f"    ({len(group)} 个提交)")
        print()

    print("=" * 80)
    print(f"✅ 压缩计划：{len(commits)} → {len(groups)} 条提交")
    print(f"   平均每组：{len(commits) // len(groups)} 个提交")
    print("=" * 80)

    # 保存计划
    with open('/tmp/git_compress_plan_30.txt', 'w') as f:
        for i, item in enumerate(plan, 1):
            f.write(f"=== 提交 {i}/{len(plan)} ===\n")
            f.write(f"原始提交数：{item['count']}\n")
            f.write(f"Commit Message:\n{item['msg']}\n")
            f.write("\n")

    print(f"📄 详细计划已保存到：/tmp/git_compress_plan_30.txt")

    return plan

if __name__ == '__main__':
    main()
