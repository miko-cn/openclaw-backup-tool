# OpenClaw Backup Tool - 设计文档

## 1. 项目概述

**项目名称**: openclaw-backup-tool  
**项目类型**: CLI 备份工具  
**核心功能**: 轻量化、高度可配置的本地备份工具，支持自定义目录/文件备份、预设模板、灵活保留策略  
**目标用户**: OpenClaw 用户，需要自定义备份场景

---

## 2. 功能需求

### 2.1 核心功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 自定义备份源 | 支持指定任意目录/文件进行备份 | P0 |
| 预设模板 | 内置常用备份模板（如 workspace、配置、记忆） | P0 |
| 备份压缩 | 打包成 `tar.gz` 格式 | P0 |
| 保留策略 | 支持按数量保留、按时间保留 | P0 |
| 备份记录 | 生成备份日志，记录每次备份详情 | P1 |

### 2.2 CLI 命令

```bash
# 备份命令
backup run                    # 根据配置执行一次备份
backup init                   # 生成默认配置文件
backup list                   # 列出所有备份
backup clean                  # 清理过期备份

# 选项
--config, -c <path>          # 指定配置文件路径
--template, -t <name>        # 使用预设模板
--dry-run                    # 模拟运行，不实际执行
```

---

## 3. 配置设计

### 3.1 配置文件格式

`backup.config.json`:

```json
{
  "version": "1.0.0",
  "backup": {
    "targets": [
      {
        "name": "workspace",
        "path": "/root/.openclaw/workspace",
        "includes": ["**/*"],
        "excludes": [".git/**/*", "node_modules/**/*", "*.log"]
      }
    ],
    "outputDir": "/mnt/backup/openclaw",
    "compression": true
  },
  "retention": {
    "type": "count",  // "count" | "days" | "both"
    "maxCount": 10,
    "maxDays": 30
  },
  "templates": {
    "minimal": {
      "description": "最小备份 - 仅核心配置",
      "targets": ["~/.openclaw/config/**/*"]
    },
    "workspace": {
      "description": "工作区备份 - 包含所有项目文件",
      "targets": ["~/.openclaw/workspace/**/*"]
    },
    "full": {
      "description": "完整备份 - 包含所有数据",
      "targets": [
        "~/.openclaw/workspace/**/*",
        "~/.openclaw/config/**/*",
        "~/.openclaw/memory/**/*"
      ]
    }
  }
}
```

### 3.2 预设模板

| 模板名 | 描述 | 备份内容 |
|--------|------|----------|
| `minimal` | 最小备份 | 仅 OpenClaw 核心配置 |
| `workspace` | 工作区备份 | workspace 目录全部内容 |
| `full` | 完整备份 | workspace + 配置 + 记忆 |
| `custom` | 自定义模板 | 用户自定义配置 |

---

## 4. 保留策略

### 4.1 策略类型

| 类型 | 说明 | 配置 |
|------|------|------|
| `count` | 保留最近 N 份 | `maxCount: 10` |
| `days` | 保留最近 N 天 | `maxDays: 30` |
| `both` | 两者同时生效（满足任一即保留） | `maxCount: 10, maxDays: 30` |

### 4.2 清理逻辑

```
备份前:
  1. 扫描 outputDir 下所有备份
  2. 按时间排序
  3. 删除超过 maxCount 的旧备份
  4. 删除超过 maxDays 的旧备份
  5. 执行新备份
```

---

## 5. 输出设计

### 5.1 备份文件名格式

```
openclaw-backup-{template}-{YYYYMMDD}-{HHMMSS}.tar.gz
```

示例: `openclaw-backup-workspace-20260404-231500.tar.gz`

### 5.2 日志输出

```
[2026-04-04 23:15:00] INFO: Starting backup...
[2026-04-04 23:15:01] INFO: Target: workspace (/root/.openclaw/workspace)
[2026-04-04 23:15:02] INFO: Compressing... (123 files, 4.5MB)
[2026-04-04 23:15:05] INFO: Backup created: openclaw-backup-workspace-20260404-231500.tar.gz
[2026-04-04 23:15:05] INFO: Cleaning old backups...
[2026-04-04 23:15:06] INFO: Removed: openclaw-backup-workspace-20260403-091200.tar.gz
[2026-04-04 23:15:06] INFO: Done! (6 backups remaining)
```

---

## 6. 技术实现

### 6.1 技术栈

- **运行时**: Bun
- **打包**: `@actions/toolkit` 或直接用 `tar` 命令
- **配置解析**: Bun 内置 JSON 解析
- **文件操作**: Bun `fs` 模块

### 6.2 目录结构

```
openclaw-backup-tool/
├── src/
│   ├── index.ts          # CLI 入口
│   ├── commands/
│   │   ├── run.ts        # backup run
│   │   ├── init.ts       # backup init
│   │   ├── list.ts       # backup list
│   │   └── clean.ts      # backup clean
│   ├── lib/
│   │   ├── backup.ts     # 备份核心逻辑
│   │   ├── config.ts     # 配置加载
│   │   ├── retention.ts  # 保留策略
│   │   └── logger.ts     # 日志输出
│   └── types.ts          # 类型定义
├── templates/            # 预设模板配置
├── package.json
└── README.md
```

---

## 7. 待确认

- [ ] 默认 outputDir 路径？建议 `~/.openclaw/backups`
- [ ] 是否需要支持排除规则 glob？
- [ ] 备份文件是否需要校验和（MD5/SHA256）？

---

**设计批准**: [待老大确认]
