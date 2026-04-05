# OpenClaw Backup Tool

轻量化、高度可配置的备份工具，支持本地备份、验证、云端同步。

## 功能特性

- 🗂️ **多模板支持** - 内置 minimal/workspace/full/complete 模板，可自定义
- 🔍 **智能过滤** - 支持 gitignore 规则和全局排除配置
- ✅ **备份验证** - 解压测试 + 遗漏文件检查
- ☁️ **云端同步** - 支持腾讯云 COS 备份同步
- 📅 **保留策略** - 日/周/月备份策略管理
- ⚙️ **定时任务** - 支持 OpenClaw cron 定时执行

## 安装

```bash
# 克隆项目
git clone https://github.com/miko-cn/openclaw-backup-tool.git
cd openclaw-backup-tool

# 安装依赖
bun install
```

## 快速开始

```bash
# 1. 初始化配置（生成默认配置）
bun run src/index.ts init

# 2. 执行备份
bun run src/index.ts run --template complete

# 3. 验证备份
bun run src/index.ts verify ~/.openclaw/backups/openclaw-backup-complete-*.tar.gz

# 4. 同步到 COS（需配置）
bun run src/index.ts sync --target daily
```

## 命令详解

### backup run - 执行备份

```bash
bun run src/index.ts run [options]

Options:
  -t, --template <name>  模板名称 (default: workspace)
  --suffix <suffix>       后缀 (daily/weekly/monthly)
  --dry-run              模拟运行
  -c, --config <path>   配置文件路径
```

**示例：**
```bash
# 使用 complete 模板
bun run src/index.ts run --template complete

# 带后缀（用于同步策略管理）
bun run src/index.ts run --template complete --suffix daily

# 模拟运行
bun run src/index.ts run --template complete --dry-run
```

### backup verify - 验证备份

```bash
bun run src/index.ts verify <file.tar.gz>
```

验证备份文件：
1. 解压测试 - 确保文件可正常解压
2. 遗漏检查 - 对比源目录与备份文件列表

**示例：**
```bash
bun run src/index.ts verify ~/.openclaw/backups/openclaw-backup-complete-daily-20260405-120000.tar.gz
```

**输出：**
```
[VERIFY] Verified! (286 files, 8.57 MB)
[VERIFY] All files match expected list!
```

### backup sync - 同步到 COS

```bash
bun run src/index.ts sync --target <daily|weekly|monthly|all>
```

功能：
1. 上传本地新备份到 COS
2. 按策略清理远程多余备份

**保留策略：**
| 类型 | 保留数量 |
|------|----------|
| daily   | 7 份 |
| weekly  | 4 份 |
| monthly | 12 份 |

**示例：**
```bash
# 同步日备份
bun run src/index.ts sync --target daily

# 同步全部
bun run src/index.ts sync --target all
```

### backup list - 列出备份

```bash
bun run src/index.ts list
```

### backup clean - 清理本地旧备份

```bash
bun run src/index.ts clean
```

## 配置详解

### 配置文件位置

`~/.openclaw/backups/backup.config.json`

### 完整配置示例

```json
{
  "version": "1.0.0",
  "backup": {
    "targets": [],
    "outputDir": "~/.openclaw/backups",
    "compression": true,
    "globalExcludes": [
      "**/node_modules/**/*",
      "**/.git/**/*",
      "**/*.log",
      "**/dist/**/*",
      "**/build/**/*",
      "**/.cache/**/*"
    ]
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
    },
    "complete": {
      "description": "Complete backup - all data except runtime temp",
      "targets": [
        "~/.openclaw/workspace/**/*",
        "~/.openclaw/memory/**/*",
        "~/.openclaw/memory-tdai/**/*",
        "~/.openclaw/agents/**/*",
        "~/.openclaw/canvas/**/*",
        "~/.openclaw/credentials/**/*",
        "~/.openclaw/devices/**/*",
        "~/.openclaw/openclaw-weixin/**/*",
        "~/.openclaw/qqbot/**/*",
        "~/.openclaw/identity/**/*",
        "~/.openclaw/openclaw.json"
      ]
    }
  }
}
```

### 配置说明

| 字段 | 说明 |
|------|------|
| `backup.outputDir` | 备份文件输出目录 |
| `backup.globalExcludes` | 全局排除规则（应用到所有模板） |
| `backup.compression` | 是否压缩 |
| `retention.type` | 保留策略类型 (count/days/both) |
| `retention.maxCount` | 保留最近 N 份 |
| `retention.maxDays` | 保留最近 N 天 |
| `templates.*.targets` | 备份目标路径列表 |

### 全局排除规则

支持 glob 写法：
- `**/node_modules/**/*` - 排除所有 node_modules
- `**/.git/**/*` - 排除所有 .git 目录
- `**/*.log` - 排除所有 .log 文件

### gitignore 兼容

备份时会自动读取目标目录下的 `.gitignore` 文件，应用其排除规则。

## 定时任务

### 使用 OpenClaw cron

在 OpenClaw 中配置定时任务：

```bash
# 每天 12:00 执行备份
openclaw cron add --schedule "0 12 * * *" --payload "systemEvent" --text "bun run /root/.openclaw/workspace/projects/openclaw-backup-tool/src/index.ts run --template complete --suffix daily"
```

### 完整备份流程

```bash
# 1. 备份
bun run src/index.ts run --template complete --suffix daily

# 2. 验证
bun run src/index.ts verify ~/.openclaw/backups/openclaw-backup-complete-daily-*.tar.gz

# 3. 同步
bun run src/index.ts sync --target daily
```

## 备份文件名规范

```
openclaw-backup-{模板}-{后缀}-{时间戳}.tar.gz

示例：
openclaw-backup-complete-daily-20260405-120000.tar.gz
openclaw-backup-complete-weekly-20260405-120000.tar.gz
openclaw-backup-complete-monthly-20260405-120000.tar.gz
```

## COS 配置

sync 命令需要配置 COS 凭证：

1. 在 `~/.openclaw/.env` 中添加：
```
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=your_bucket
COS_REGION=ap-hongkong
```

2. sync 命令会自动读取该配置

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **压缩**: tar + gzip
- **过滤**: ignore (gitignore 兼容)
- **云存储**: Tencent Cloud COS SDK

## License

MIT
