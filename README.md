# OpenClaw Backup Tool

轻量化、高度可配置的本地备份工具。

## 安装

```bash
cd openclaw-backup-tool
bun install
```

## 使用

```bash
# 初始化配置（生成默认配置到 ~/.openclaw/backups/）
bun run src/index.ts init

# 执行备份（使用 workspace 模板）
bun run src/index.ts run

# 列出所有备份
bun run src/index.ts list

# 清理旧备份
bun run src/index.ts clean

# 使用指定模板
bun run src/index.ts run --template full

# 模拟运行（不实际执行）
bun run src/index.ts run --dry-run
```

## 配置

配置文件位于 `~/.openclaw/backups/backup.config.json`:

```json
{
  "version": "1.0.0",
  "backup": {
    "targets": [],
    "outputDir": "~/.openclaw/backups",
    "compression": true
  },
  "retention": {
    "type": "count",
    "maxCount": 10
  },
  "templates": {
    "minimal": {
      "description": "Minimal backup - OpenClaw core config only",
      "targets": ["~/.openclaw/config/**/*"]
    },
    "workspace": {
      "description": "Workspace backup - all project files",
      "targets": ["~/.openclaw/workspace/**/*"]
    },
    "full": {
      "description": "Full backup - workspace + config + memory",
      "targets": [
        "~/.openclaw/workspace/**/*",
        "~/.openclaw/config/**/*",
        "~/.openclaw/memory/**/*"
      ]
    }
  }
}
```

## 模板

| 模板 | 描述 |
|------|------|
| minimal | 最小备份 - 仅核心配置 |
| workspace | 工作区备份 - 所有项目文件 |
| full | 完整备份 - workspace + 配置 + 记忆 |

## 保留策略

- `count`: 保留最近 N 份
- `days`: 保留最近 N 天
- `both`: 两者同时生效