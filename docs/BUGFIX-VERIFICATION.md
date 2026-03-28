# 🐛 Bug修复验证指南

## 修复内容总结

### 问题1：符号链接没有创建 ✅ 已修复
**原因**：linker 使用错误的路径拼接逻辑
**修复**：
- 在 `SkillMetadata` 中添加 `path` 字段保存完整路径
- 扫描器在解析时保存技能的完整文件系统路径
- linker 使用 `skill.path` 而不是 `skills_base.join(&skill.id)`

### 问题2：点击Cursor开关关闭了Claude开关 ✅ 已修复
**原因**：`disable_skill` 函数中的状态保存逻辑有缺陷
**修复**：统一使用 `.entry().or_insert_with()` 确保状态正确保存

### 问题3：来源标签颜色没有显示 ❓ 待验证
**原因**：可能是浏览器缓存问题
**解决方案**：硬刷新浏览器（Cmd+Shift+R）

---

## 验证步骤

### 1️⃣ 验证符号链接创建（最重要）

**测试步骤**：
1. 打开应用 http://localhost:5173/
2. 找到任意一个技能（建议用 `brainstorming`）
3. 展开卡片，找到 **Cursor** 开关
4. 点击 **打开** Cursor开关
5. 打开终端，运行以下命令检查：

```bash
# 检查 Cursor 的 skills 目录
ls -la ~/.cursor/skills/ | grep brainstorming
```

**预期结果**：
- ✅ 应该看到符号链接：`brainstorming -> [完整路径]`
- ✅ 链接指向：`/Users/cchao/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.6/skills/brainstorming`

**如果失败**：
```bash
# 查看应用日志中的错误信息
tail -100 /tmp/tauri-final.log | grep -A 10 "CREATE_SYMLINK"
```

---

### 2️⃣ 验证开关独立性（互不影响）

**测试步骤**：
1. 找到 `brainstorming` 技能
2. 展开卡片
3. **打开** Cursor开关
4. 观察 **Claude开关** 的状态

**预期结果**：
- ✅ Claude开关应该**保持不变**（之前是打开的，现在还是打开的）
- ✅ Cursor开关从**关闭**变成**打开**

**如果失败**：
- 检查浏览器控制台是否有错误
- 检查应用日志中的状态保存信息

---

### 3️⃣ 验证来源标签颜色

**测试步骤**：
1. 硬刷新浏览器（**Cmd+Shift+R** 或 Ctrl+Shift+R）
2. 查看技能卡片右上角的标签

**预期结果**：
- 🔵 **蓝色标签** = 中央存储技能（`test-repo`, `demo-skill`, `another-test`）
- 🟢 **绿色标签** = Claude插件技能（`brainstorming`, `systematic-debugging` 等14个）

**如果颜色没有显示**：
1. 清除浏览器缓存：Cmd+Option+E（Mac）或 Ctrl+Shift+Delete（Windows）
2. 或者尝试隐私模式打开
3. 检查 Tailwind CSS 是否正确加载

---

## 完整测试流程

### 场景1：启用 Claude 技能的 Cursor 支持

```
1. 找到 `brainstorming` 技能（绿色标签）
2. 当前状态：
   - Claude开关：✅ 打开
   - Cursor开关：❌ 关闭
3. 点击 Cursor开关 → 打开
4. 验证：
   ✓ Claude开关仍然打开
   ✓ Cursor开关变成打开
   ✓ ~/.cursor/skills/brainstorming 符号链接已创建
```

### 场景2：禁用已启用的开关

```
1. 找到 `test-repo` 技能（蓝色标签）
2. 当前状态：
   - Claude开关：✅ 打开
   - Cursor开关：✅ 打开
3. 点击 Claude开关 → 关闭
4. 验证：
   ✓ Cursor开关仍然打开
   ✓ Claude开关变成关闭
   ✓ 符号链接已删除
```

### 场景3：多次切换测试

```
1. 找到任意技能
2. 快速点击 Cursor 开关 3次：关→开→关→开
3. 验证：
   ✓ 每次点击立即响应
   ✓ Claude 开关不受影响
   ✓ 没有页面刷新
```

---

## 调试命令

### 查看实时日志
```bash
tail -f /tmp/tauri-final.log | grep -E "Linking|CREATE_SYMLINK|Setting skill_states"
```

### 检查所有符号链接
```bash
# Claude 技能
ls -la ~/.claude/skills/plugins/ 2>/dev/null | grep "^l"

# Cursor 技能
ls -la ~/.cursor/skills/ 2>/dev/null | grep "^l"
```

### 查看配置文件
```bash
cat ~/.skills-manager/config.json | jq '.skill_states'
```

---

## 预期结果总结

| 问题 | 状态 | 验证方法 |
|------|------|---------|
| 符号链接创建 | ✅ 已修复 | `ls -la ~/.cursor/skills/` |
| 开关独立性 | ✅ 已修复 | 点击一个开关，观察另一个 |
| 标签颜色 | ❓ 待验证 | 硬刷新浏览器（Cmd+Shift+R） |

---

## 如果还有问题

### 符号链接仍然没有创建
1. 检查日志中的 "CREATE_SYMLINK DEBUG" 输出
2. 确认源路径是否存在
3. 检查目标目录的权限

### 开关仍然互相影响
1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签页的错误
3. 检查 Network 标签页的 API 请求

### 颜色仍然不显示
1. 完全清除浏览器缓存
2. 重启应用
3. 尝试其他浏览器

---

**应用地址**：http://localhost:5173/

**开始验证！** 🚀
