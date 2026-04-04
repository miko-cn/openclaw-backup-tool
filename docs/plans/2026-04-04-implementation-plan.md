# OpenClaw Backup Tool - 实施计划

**项目**: openclaw-backup-tool  
**技术栈**: Bun + TypeScript  
**配置文件**: `backup.config.json`

---

## 任务列表

### Phase 1: 项目初始化 ✅

- [x] **T1.1** 创建 `package.json`，配置 `bun` 项目
- [x] **T1.2** 创建目录结构 (`src/commands`, `src/lib`, `templates`)
- [x] **T1.3** 初始化 git 仓库

### Phase 2: 配置系统 ✅

- [x] **T2.1** 定义 `Config` 类型，写 `src/types.ts`
- [x] **T2.2** 实现 `src/lib/config.ts` - 加载/解析 JSON 配置
- [x] **T2.3** 实现预设模板加载 (`templates/*.json`)
- [x] **T2.4** 写 `backup init` 命令 - 生成默认配置

### Phase 3: 备份核心 ✅

- [x] **T3.1** 实现 gitignore 规则解析 (`src/lib/ignore.ts`) - 使用 ignore 包
- [x] **T3.2** 实现文件筛选逻辑 - 匹配 includes/excludes
- [x] **T3.3** 实现 `src/lib/backup.ts` - 打包成 tar.gz
- [x] **T3.4** 写 `backup run` 命令 - 执行备份

### Phase 4: 保留策略 ✅

- [x] **T4.1** 实现 `src/lib/retention.ts` - 扫描现有备份
- [x] **T4.2** 实现按数量/按时间/混合策略清理
- [x] **T4.3** 写 `backup clean` 命令 - 清理过期备份

### Phase 5: 辅助功能 ✅

- [x] **T5.1** 写 `backup list` 命令 - 列出所有备份
- [x] **T5.2** 实现日志输出美化
- [x] **T5.3** 添加 `--dry-run` 模拟运行支持

### Phase 6: 收尾 🔄

- [x] **T6.1** 写 README 文档
- [x] **T6.2** 测试完整流程
- [ ] **T6.3** 初始化第一个备份验证

---

## 验证结果

```bash
# 初始化配置
bun run src/index.ts init
# ✅ Config created: /root/.openclaw/backups/backup.config.json

# 执行备份
bun run src/index.ts run --template workspace
# ✅ [20260404-234125] INFO: Backup created: openclaw-backup-workspace-20260404-234125.tar.gz

# 列出备份
bun run src/index.ts list
# ✅ Found 1 backup(s): openclaw-backup-workspace-20260404-234125 (11.40 MB)

# 清理（dry-run）
bun run src/index.ts clean --dry-run
# ✅ [DRY RUN] Would clean backups with...
```

---

## 待优化

- [ ] 支持多目标备份（当前只支持单个目标）
- [ ] 支持自定义排除规则在配置中指定
- [ ] 完善错误处理和边界情况
- [ ] 添加恢复/解压功能