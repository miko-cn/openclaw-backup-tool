# 备份工具增强设计 - 验证、上传、同步策略

**Goal:** 增强 backup 工具，支持备份验证、COS 上传、同步策略管理，实现每日定时自动备份。

**Architecture:** 
- 扩展 CLI 命令：`verify`、`upload`、`sync`
- 新增 `backup.yaml` 配置文件管理同步策略
- 调度脚本 `cron-backup.sh` 每日 12 点执行完整流程

**Tech Stack:** Bun, TypeScript, 腾讯云 COS SDK

---

## 1. 新增命令设计

### 1.1 backup verify

```bash
# 验证备份文件完整性（解压测试）
backup verify <file.tar.gz>

# 输出示例：
[VERIFY] Extracting test...
[VERIFY] Verified! (10 files, 5.2MB)
[VERIFY] FAILED: checksum mismatch
```

### 1.2 backup sync

```bash
# 同步备份到 COS 并执行策略管理
backup sync --target daily    # 同步日备份
backup sync --target weekly   # 同步周备份
backup sync --target monthly  # 同步月备份
backup sync --all             # 同步全部

# 功能：自动上传本地新备份 + 按策略清理远程多余文件
# 输出示例：
[SYNC] Daily: 7 kept, 2 removed
[SYNC] Weekly: 4 kept, 0 removed  
[SYNC] Monthly: 12 kept, 0 removed
[SYNC] Done! (local: 10 files, remote: 21 files)
```

---

## 2. 配置文件

### 2.1 backup.yaml - 同步策略配置

```yaml
sync:
  daily:
    keep: 7          # 保留最近 7 份
    pattern: "*-daily-*.tar.gz"
  weekly:
    keep: 4          # 保留最近 4 份
    pattern: "*-weekly-*.tar.gz"
  monthly:
    keep: 12         # 保留最近 12 份
    pattern: "*-monthly-*.tar.gz"

cos:
  # 复用 ~/.openclaw/.env 中的配置
  # COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION
  prefix: "openclaw/backups"
```

### 2.2 备份文件名规范

```
# 日备份
openclaw-backup-complete-daily-20260405-120000.tar.gz

# 周备份（周一）
openclaw-backup-complete-weekly-20260405-120000.tar.gz

# 月备份（1号）
openclaw-backup-complete-monthly-20260405-120000.tar.gz
```

---

## 3. 定时任务流程

### 3.1 每日 12:00 执行

```bash
# cron-backup.sh
#!/bin/bash
DATE=$(date +%w)        # 0-6 (周日=0)
DAY=$(date +%d)        # 01-31

# 确定备份类型
if [ "$DAY" = "01" ]; then
    TYPE="monthly"
elif [ "$DATE" = "1" ]; then  
    TYPE="weekly"
else
    TYPE="daily"
fi

# 执行备份
bun run src/index.ts run --template complete --suffix $TYPE

# 验证
bun run src/index.ts verify openclaw-backup-complete-${TYPE}-*.tar.gz

# 上传
bun run src/index.ts upload openclaw-backup-complete-${TYPE}-*.tar.gz

# 同步
bun run src/index.ts sync --all
```

---

## 4. 实现任务

### Phase 1: 验证功能
- [ ] 添加 `backup verify` 命令
- [ ] 解压测试 + 文件数/大小校验

### Phase 2: 同步功能
- [ ] 添加 `backup sync` 命令
- [ ] 集成腾讯云 COS SDK（上传本地新文件）
- [ ] 实现日/周/月远程保留策略
- [ ] 本地和远程双向同步

### Phase 3: 定时任务
- [ ] 用户在 OpenClaw 配置 cron 任务调用命令

---

## 5. 成功标准

- [ ] 备份文件生成后自动验证完整性
- [ ] 验证通过后自动上传到 COS
- [ ] 上传完成后根据策略同步清理
- [ ] 定时任务稳定运行

---

**设计批准后 → 进入 writing-plans 阶段**