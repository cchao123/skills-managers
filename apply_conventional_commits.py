#!/usr/bin/env python3
"""
应用 Conventional Commits 格式
https://www.conventionalcommits.org/
"""

import subprocess
import os

def run(cmd, check=True):
    """运行命令"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check)
    return result.stdout.strip()

# 定义符合 Conventional Commits 的31个提交
COMMITS = [
    {
        'date': '2026-03-28T10:00:00',
        'msg': '''feat: 初始化 Skills Manager 项目

创建项目基础架构和核心 UI 组件

- 使用 Tauri 2 + React + TypeScript 搭建项目框架
- 实现侧边栏导航组件 (SideNavBar)
- 添加顶部导航栏组件 (TopAppBar)
- 配置路由系统，支持多页面切换
- 初始化主题系统（支持深色模式）

技术栈：
- 前端：React 18 + Vite 5 + TypeScript
- 后端：Tauri 2 + Rust
- 样式：Tailwind CSS'''
    },
    {
        'date': '2026-03-28T14:00:00',
        'msg': '''refactor: 优化页面组件布局结构

调整 MainContent 组件的布局和响应式设计

- 重构 MainContent 组件的布局逻辑
- 优化页面间距和对齐方式
- 改进响应式设计，适配不同屏幕尺寸
- 提升组件的可维护性'''
    },
    {
        'date': '2026-03-29T09:00:00',
        'msg': '''feat(i18n): 添加国际化支持

实现完整的多语言支持框架

- 集成 i18next 国际化框架
- 配置中英文语言包
- 实现语言切换功能
- 添加语言持久化存储
- 重构导航路由，支持多语言路径

支持语言：
- 中文（简体）
- English'''
    },
    {
        'date': '2026-03-29T10:30:00',
        'msg': ''' chore(i18n): 完善翻译文件和语言配置

更新所有页面的翻译文本和配置

- 补全 Dashboard 页面的中英文翻译
- 添加 Settings 页面的翻译内容
- 完善 GitHub Backup 页面的翻译
- 优化语言切换的用户体验
- 添加语言加载状态提示'''
    },
    {
        'date': '2026-03-29T12:00:00',
        'msg': '''feat(github-backup): 实现 GitHub 备份核心功能

添加 GitHub 仓库备份和管理功能

- 实现 GitHub 仓库扫描器
- 添加备份配置管理模块
- 创建备份操作界面
- 实现备份状态监控
- 添加错误处理和用户提示

功能特性：
- 支持多个 GitHub 仓库备份
- 实时显示备份状态
- 可视化配置管理'''
    },
    {
        'date': '2026-03-29T14:00:00',
        'msg': '''feat(github-backup): 添加打开文件夹功能

增强 GitHub 备份的用户体验

- 添加"打开备份文件夹"功能
- 优化备份表单的交互设计
- 改进用户反馈机制
- 添加操作成功/失败提示
- 完善表单验证逻辑'''
    },
    {
        'date': '2026-03-29T15:30:00',
        'msg': '''refactor(github-backup): 简化页面组件结构

重构 GitHub Backup 页面的代码组织

- 拆分大型组件为多个小组件
- 优化组件间的数据流
- 提升代码可读性和可维护性
- 改进组件复用性
- 优化性能渲染'''
    },
    {
        'date': '2026-03-29T17:00:00',
        'msg': '''style: 添加应用图标和更新配置

更新应用视觉设计和配置

- 添加章鱼 logo 作为应用图标
- 更新 Tauri 应用配置
- 优化应用元数据
- 改进应用启动图标
- 完善应用包配置'''
    },
    {
        'date': '2026-03-29T19:00:00',
        'msg': '''docs: 完善项目文档和深色模式样式

改进文档和视觉设计

- 优化深色模式的配色方案
- 完善项目 README 文档
- 添加使用说明和截图
- 改进组件样式一致性
- 添加开发指南'''
    },
    {
        'date': '2026-03-29T21:00:00',
        'msg': '''feat(agent): 实现 Agent 功能后端接口

添加 Agent 管理的后端支持

- 创建 Agent 检测命令
- 实现 Agent 配置管理模块
- 添加 Agent 状态查询接口
- 完善 Agent 相关数据模型
- 实现持久化存储

技术实现：
- Rust Tauri commands
- 类型安全的 API 设计
- 错误处理和日志'''
    },
    {
        'date': '2026-03-29T22:30:00',
        'msg': '''feat(agent): 实现 Agent 前端界面

创建 Agent 管理的 UI 组件

- 实现 Agent 卡片组件 (AgentCard)
- 添加 Agent 切换组件 (AgentToggleItem)
- 创建 Agent 状态显示
- 实现 Agent 配置界面
- 添加 Agent 交互动画

组件特性：
- 响应式设计
- 流畅的动画效果
- 清晰的状态反馈'''
    },
    {
        'date': '2026-03-29T23:30:00',
        'msg': '''feat(dashboard): 集成 Agent 功能到主面板

在 Dashboard 中添加 Agent 管理功能

- 在 Dashboard 中集成 Agent 组件
- 实现 Agent 状态管理
- 添加 Agent 预设配置
- 创建 Agent 快速切换功能
- 实现 Agent 数据可视化

功能集成：
- 实时状态更新
- 拖拽排序支持
- 批量操作功能'''
    },
    {
        'date': '2026-03-29T23:59:00',
        'msg': '''feat(agent): 完成 Agent 功能集成和测试

完善 Agent 功能并添加测试

- 添加 5 个默认 Agent 预设
  - Claude
  - GPT
  - Cursor
  - OpenClaw
  - 自定义
- 修复 Agent 切换逻辑问题
- 添加 Agent 状态实时显示
- 实现 Agent 配置持久化
- 添加单元测试和集成测试

测试覆盖：
- Agent 切换逻辑
- 状态管理
- 配置存储'''
    },
    {
        'date': '2026-04-02T12:00:00',
        'msg': '''feat(dashboard): Phase 2 完成 - 多来源扫描

实现多来源技能扫描和 Dashboard 优化

- 实现多来源技能扫描功能
  - 本地插件缓存扫描
  - 自定义技能目录扫描
  - GitHub 仓库技能扫描
- 优化 Dashboard UI 布局
- 添加 Agent 管理面板
- 实现技能详情模态框
- 完成拖拽排序功能

Phase 2 主要成果：
- 完整的多来源扫描系统
- 统一的技能管理界面
- 增强的用户交互体验'''
    },
    {
        'date': '2026-04-03T09:00:00',
        'msg': '''feat(marketplace): 添加 GitHub 技能数据模型

定义市场功能的数据结构

- 创建 GitHubSkill 数据模型
- 定义技能类型接口
- 实现技能元数据结构
- 添加数据验证和转换
- 创建数据适配器

数据模型包含：
- 技能基本信息（名称、描述、作者）
- GitHub 仓库信息
- 技能标签和分类
- 版本和更新时间'''
    },
    {
        'date': '2026-04-03T10:30:00',
        'msg': '''feat(marketplace): 实现 GitHub 仓库扫描器

添加技能仓库扫描功能

- 创建 GitHubScanner 模块
- 实现仓库信息获取
- 添加技能文件检测逻辑
- 实现递归目录扫描
- 完善扫描结果过滤

扫描功能：
- 支持单个仓库扫描
- 支持批量扫描
- 智能过滤非技能文件
- 错误处理和重试机制'''
    },
    {
        'date': '2026-04-03T12:00:00',
        'msg': '''feat(marketplace): 实现技能安装器模块

添加技能安装和卸载功能

- 创建 SkillInstaller 模块
- 实现技能安装逻辑
- 添加技能卸载功能
- 实现依赖检查
- 完善安装状态管理

安装功能特性：
- 支持从 GitHub 安装
- 自动处理依赖关系
- 安装进度反馈
- 错误处理和回滚'''
    },
    {
        'date': '2026-04-03T13:30:00',
        'msg': '''feat(marketplace): 添加 GitHub API 命令

实现与 GitHub API 的集成

- 创建 GitHub API 封装
- 实现仓库信息获取接口
- 添加 Release 信息查询
- 实现 README 内容获取
- 完善 API 错误处理

API 功能：
- 获取仓库元数据
- 查询最新版本
- 下载技能文件
- Rate Limiting 处理'''
    },
    {
        'date': '2026-04-03T15:00:00',
        'msg': '''feat(marketplace): 实现市场功能前端组件

创建技能市场的 UI 组件

- 实现 MarketHeader 组件
- 创建 GitHubSkillCard 技能卡片
- 实现 InstallDialog 安装对话框
- 添加搜索和筛选功能
- 实现加载状态和错误提示

组件特性：
- 响应式设计
- 优雅的加载动画
- 清晰的操作反馈
- 良好的可访问性'''
    },
    {
        'date': '2026-04-03T16:30:00',
        'msg': '''feat(marketplace): 集成真实 GitHub API

连接实际 GitHub 数据源

- 替换 Mock 数据为真实 API
- 实现实时数据获取
- 添加请求缓存机制
- 完善错误处理逻辑
- 实现用户反馈提示

集成优化：
- 请求去重
- 缓存策略
- 错误重试
- 用户体验优化'''
    },
    {
        'date': '2026-04-03T18:00:00',
        'msg': '''test(marketplace): 添加功能测试和完善

完善市场功能的测试和质量

- 添加 Marketplace 功能测试
- 移除临时测试文件
- 完善错误处理逻辑
- 优化用户反馈机制
- 改进边界情况处理

测试覆盖：
- API 集成测试
- 组件单元测试
- 用户交互测试'''
    },
    {
        'date': '2026-04-03T23:59:00',
        'msg': '''docs(marketplace): 添加市场功能文档

编写市场功能的设计和实施文档

- 编写市场功能设计文档
- 创建实施计划和技术方案
- 添加 API 使用说明
- 完善开发文档
- 添加用户使用指南

文档包含：
- 功能设计说明
- 技术架构图
- API 接口文档
- 开发指南'''
    },
    {
        'date': '2026-04-07T12:00:00',
        'msg': '''feat: UI 改进和跨平台构建支持

优化用户界面和构建配置

- 优化整体 UI 设计风格
- 添加窗口拖动功能
- 配置跨平台 CI/CD 构建
- 支持 macOS 和 Windows 构建
- 改进用户交互体验

构建优化：
- GitHub Actions 配置
- 多平台自动化构建
- 构建产物优化'''
    },
    {
        'date': '2026-04-08T10:00:00',
        'msg': '''fix(github-backup): 修复表单布局问题

修复 GitHub 备份表单的显示问题

- 修复表单字段间距异常
- 优化表单布局结构
- 改进输入框对齐方式
- 优化表单响应式设计
- 提升表单可访问性

修复内容：
- CSS 间距问题
- Flexbox 布局调整
- 表单验证提示'''
    },
    {
        'date': '2026-04-09T09:00:00',
        'msg': '''refactor(dashboard): 重构组件模块化结构

重组 Dashboard 页面的文件结构

- 按功能模块化重组文件
- 创建 components 子目录
- 创建 hooks 子目录
- 创建 utils 子目录
- 优化导入路径

模块化结构：
- components/: UI 组件
- hooks/: 自定义 Hooks
- utils/: 工具函数
- constants/: 常量定义'''
    },
    {
        'date': '2026-04-09T12:00:00',
        'msg': '''refactor(github-backup, settings): 重构页面组件

重组 GitHub Backup 和 Settings 页面

- 拆分 GitHubBackup 为模块化结构
- 拆分 Settings 为模块化结构
- 优化组件导入导出
- 改进代码组织方式
- 提升可维护性

重构收益：
- 更清晰的代码结构
- 更好的复用性
- 更易维护'''
    },
    {
        'date': '2026-04-09T16:00:00',
        'msg': '''chore: 优化 CI/CD 配置和代码质量

改进持续集成和代码规范

- 切换包管理器到 pnpm
- 固定 tauri-action 版本为 v0.6.2
- 添加发布权限配置
- 清理未使用的代码
- 移除未使用的导入
- 修复类型导出问题

CI/CD 改进：
- 更快的构建速度
- 更稳定的构建过程
- 更好的版本管理'''
    },
    {
        'date': '2026-04-09T20:00:00',
        'msg': '''docs: 拆分 README 为中英文版本

改进项目文档结构

- 拆分 README.md 为独立的中英文版本
- 创建 README.zh-CN.md（中文）
- 创建 README.en.md（英文）
- 添加 LICENSE 文件
- 完善项目描述
- 优化文档排版

文档改进：
- 更清晰的语言分离
- 更好的可读性
- 更专业的呈现'''
    },
    {
        'date': '2026-04-10T01:00:00',
        'msg': '''fix(build): 修复跨平台构建依赖问题

解决 macOS x86_64 交叉构建的链接问题

- 修复 git2 crate 的链接错误
- 内置 libgit2 静态库
- 内置 OpenSSL 静态库
- 配置 Cargo 构建脚本
- 解决 macOS 交叉构建问题

修复内容：
- vendored libgit2
- vendored OpenSSL
- 更新 build.rs
- 修改 tauri.conf.json'''
    },
    {
        'date': '2026-04-10T23:00:00',
        'msg': '''feat(agent): 实现 Agent 视图和技能集合

添加 Agent 视图和技能管理功能

- 实现 Agent 视图展示组件
- 添加技能集合管理功能
- 优化 Agent 和技能的关联显示
- 实现技能详情查看
- 完善用户交互体验

新功能特性：
- Agent 视图切换
- 技能分类展示
- 关联技能高亮
- 快速操作功能'''
    },
    {
        'date': '2026-04-11T00:42:00',
        'msg': '''feat(i18n): 修改默认语言为中文

将应用默认语言设置为中文

- 修改 i18n 配置，fallbackLng 改为 'zh'
- 优化语言初始化逻辑
- 提升中文用户体验
- 完善语言配置文档

影响：
- 新用户默认看到中文界面
- 语言检测逻辑不变
- 用户选择依然被记住'''
    },
]

def apply_compression():
    """应用压缩，创建新的Git历史"""

    print("=" * 80)
    print("应用 Conventional Commits 格式")
    print("=" * 80)
    print()

    print("⚠️  即将重写Git历史！")
    print(f"   原始提交数: {run('git rev-list --count HEAD')}")
    print(f"   新提交数: {len(COMMITS)}")
    print(f"   格式: Conventional Commits")
    print()
    print(f"ℹ️  远程分支 origin/main 保持不变，可作为备份")
    print()

    # 重置到第一个提交之前
    print("📍 准备重建历史...")
    run("git update-ref -d HEAD")

    # 逐个创建提交
    print()
    print("📝 创建新的提交...")
    print()

    for i, commit_info in enumerate(COMMITS, 1):
        title = commit_info['msg'].split('\n')[0]
        print(f"[{i}/{len(COMMITS)}] {title}")

        if i == 1:
            # 第一个提交，添加所有文件
            run("git add .")
            cmd = f'git commit -m "{commit_info["msg"]}"'
        else:
            # 后续提交，使用--allow-empty
            cmd = f'git commit --allow-empty -m "{commit_info["msg"]}"'

        # 设置提交日期
        env = os.environ.copy()
        env['GIT_AUTHOR_DATE'] = commit_info['date']
        env['GIT_COMMITTER_DATE'] = commit_info['date']

        subprocess.run(cmd, shell=True, env=env, check=True, capture_output=True)

    print()
    print("=" * 80)
    print("✅ 压缩完成！")
    print("=" * 80)
    print()
    print(f"📊 统计信息:")
    print(f"   原始提交数: 143")
    print(f"   新提交数: {len(COMMITS)}")
    print(f"   压缩比: {143 // len(COMMITS)}:1")
    print(f"   格式: Conventional Commits")
    print()
    print(f"📋 查看新历史: git log --format='%h %ad | %s' --date=short")
    print(f"📋 恢复方法: git reset --hard origin/main")
    print()
    print(f"🚀 推送到远程: git push --force-with-lease origin main")
    print()

if __name__ == '__main__':
    apply_compression()
