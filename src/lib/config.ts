import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { BackupConfig, TemplateDefinition } from "./types.js";

// 展开 ~ 为用户家目录
export function expandTilde(path: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    return path.replace("~", home);
  }
  return path;
}

const DEFAULT_OUTPUT_DIR = expandTilde("~/.openclaw/backups");
const DEFAULT_CONFIG_PATH = expandTilde("~/.openclaw/backups/backup.config.json");

const DEFAULT_CONFIG: BackupConfig = {
  version: "1.0.0",
  backup: {
    targets: [],
    outputDir: DEFAULT_OUTPUT_DIR,
    compression: true,
    globalExcludes: [
      "**/node_modules/**/*",
      "**/.git/**/*",
      "**/*.log",
      "**/dist/**/*",
      "**/build/**/*",
      "**/.cache/**/*",
    ],
  },
  retention: {
    type: "count",
    maxCount: 10,
  },
  templates: {
    minimal: {
      description: "Minimal backup - OpenClaw core config only",
      targets: ["~/.openclaw/config/**/*"],
    },
    workspace: {
      description: "Workspace backup - all project files",
      targets: ["~/.openclaw/workspace/**/*"],
    },
    full: {
      description: "Full backup - workspace + config + memory",
      targets: [
        "~/.openclaw/workspace/**/*",
        "~/.openclaw/config/**/*",
        "~/.openclaw/memory/**/*",
      ],
    },
  },
};

export function loadConfig(configPath?: string): BackupConfig {
  // 如果没有指定配置，优先使用默认配置文件
  const configFilePath = configPath || (existsSync(DEFAULT_CONFIG_PATH) ? DEFAULT_CONFIG_PATH : undefined);

  // 如果没有配置文件，返回默认配置
  if (!configFilePath) {
    return DEFAULT_CONFIG;
  }

  const resolvedPath = resolve(configFilePath);

  if (!existsSync(resolvedPath)) {
    console.warn(`Config file not found: ${resolvedPath}, using default.`);
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const userConfig = JSON.parse(content);
    // 合并默认配置
    return { ...DEFAULT_CONFIG, ...userConfig };
  } catch (error) {
    console.error(`Failed to parse config: ${error}`);
    return DEFAULT_CONFIG;
  }
}

export function getTemplate(
  config: BackupConfig,
  templateName: string
): TemplateDefinition | undefined {
  return config.templates[templateName];
}

export function listTemplates(config: BackupConfig): string[] {
  return Object.keys(config.templates);
}

export function generateDefaultConfig(): BackupConfig {
  return DEFAULT_CONFIG;
}