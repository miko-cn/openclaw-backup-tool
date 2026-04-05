import { existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { spawn } from "child_process";
import type { BackupConfig, BackupResult, BackupRecord } from "../types.js";
import { createMultiTargetFilter } from "./ignore.js";

// 展开 ~ 为用户家目录
function expandTilde(path: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    return path.replace("~", home);
  }
  return path;
}

function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${h}${min}${s}`;
}

function getBackupFilename(template: string, timestamp: string, suffix?: string): string {
  if (suffix) {
    return `openclaw-backup-${template}-${suffix}-${timestamp}.tar.gz`;
  }
  return `openclaw-backup-${template}-${timestamp}.tar.gz`;
}

async function listBackupRecords(outputDir: string): Promise<BackupRecord[]> {
  const { readdirSync, statSync } = await import("fs");
  const records: BackupRecord[] = [];

  if (!existsSync(outputDir)) {
    return records;
  }

  try {
    const files = readdirSync(outputDir);
    for (const file of files) {
      // 直接查找 tar.gz 文件
      if (file.endsWith(".tar.gz") && file.startsWith("openclaw-backup-")) {
        const filePath = join(outputDir, file);
        const stat = statSync(filePath);
        const match = file.match(
          /^openclaw-backup-(.+)-(\d{8}-\d{6})\.tar\.gz$/
        );
        if (match) {
          records.push({
            name: file.replace(".tar.gz", ""),
            path: filePath,
            createdAt: stat.mtime,
            sizeBytes: stat.size,
            template: match[1],
          });
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }

  return records.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

// 遍历目录
function walkDir(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  
  const { readdirSync } = require("fs");
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch (e) {
    // 忽略遍历错误
  }
  return results;
}

export async function runBackup(
  config: BackupConfig,
  templateName?: string,
  suffix?: string
): Promise<BackupResult> {
  const outputDir = expandTilde(config.backup.outputDir);

  // 确保输出目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 确定要备份的目标
  let targets = config.backup.targets;

  // 如果指定了模板，使用模板中的目标
  if (templateName && config.templates[templateName]) {
    const template = config.templates[templateName];
    targets = template.targets.map((path) => {
      // 去除 glob 部分获取基础路径
      const basePath = expandTilde(path).replace(/\/\*\*.*$/, "");
      return {
        name: templateName,
        path: basePath,
        includes: ["**/*"],
      };
    });
  }

  if (targets.length === 0) {
    return {
      success: false,
      error: "No backup targets configured",
    };
  }

  // 创建文件过滤器
  const filter = createMultiTargetFilter(targets, config.backup.globalExcludes);

  // 收集要备份的文件
  const filesToBackup: string[] = [];

  for (const target of targets) {
    const targetPath = expandTilde(target.path);
    if (!existsSync(targetPath)) {
      console.warn(`Target path not found: ${targetPath}`);
      continue;
    }

    // 遍历目录
    const files = walkDir(targetPath);
    for (const file of files) {
      const relativePath = file.replace(targetPath, "").replace(/^[/\\]/, "");
      if (filter.isIncluded(join(targetPath, relativePath))) {
        filesToBackup.push(file);
      }
    }
  }

  if (filesToBackup.length === 0) {
    return {
      success: false,
      error: "No files to backup",
    };
  }

  // 生成备份文件名
  const timestamp = formatTimestamp(new Date());
  const template = templateName || targets[0].name || "custom";
  const backupFilename = getBackupFilename(template, timestamp, suffix);
  const backupPath = join(outputDir, backupFilename);

  console.log(`[${timestamp}] INFO: Starting backup...`);
  console.log(`[${timestamp}] INFO: Target: ${template}`);
  console.log(
    `[${timestamp}] INFO: Compressing... (${filesToBackup.length} files)`
  );

  // 使用 tar 打包多个目录
  // tar -czf backup.tar.gz -C /parent1 dir1 -C /parent2 dir2 ...
  const tarArgs: string[] = ["-czf", backupPath];
  
  // 添加全局排除（tar 原生支持）
  if (config.backup.globalExcludes) {
    for (const pattern of config.backup.globalExcludes) {
      tarArgs.push("--exclude", pattern);
    }
  }
  
  for (const target of targets) {
    const targetPath = expandTilde(target.path);
    if (existsSync(targetPath)) {
      const parentDir = targetPath.replace(basename(targetPath), "");
      const dirName = basename(targetPath);
      tarArgs.push("-C", parentDir, dirName);
    }
  }

  const tarProcess = spawn("tar", tarArgs);

  return new Promise((resolve) => {
    tarProcess.on("close", (code) => {
      if (code === 0) {
        console.log(
          `[${timestamp}] INFO: Backup created: ${backupFilename}`
        );
        resolve({
          success: true,
          backupPath,
          filesCount: filesToBackup.length,
        });
      } else {
        resolve({
          success: false,
          error: `tar failed with code ${code}`,
        });
      }
    });
  });
}

export async function listBackups(
  config: BackupConfig
): Promise<BackupRecord[]> {
  const outputDir = expandTilde(config.backup.outputDir);
  return listBackupRecords(outputDir);
}

export async function cleanOldBackups(
  config: BackupConfig
): Promise<{ removed: string[]; remaining: number }> {
  const outputDir = expandTilde(config.backup.outputDir);
  const records = await listBackupRecords(outputDir);

  const { unlinkSync } = await import("fs");
  const removed: string[] = [];

  const { type, maxCount, maxDays } = config.retention;
  const now = new Date();

  for (const record of records) {
    let shouldRemove = false;

    if (type === "count" && maxCount) {
      const index = records.indexOf(record);
      if (index >= maxCount) {
        shouldRemove = true;
      }
    } else if (type === "days" && maxDays) {
      const age = (now.getTime() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (age > maxDays) {
        shouldRemove = true;
      }
    } else if (type === "both") {
      const index = records.indexOf(record);
      const age = (now.getTime() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (index >= (maxCount || 10) || age > (maxDays || 30)) {
        shouldRemove = true;
      }
    }

    if (shouldRemove) {
      try {
        unlinkSync(record.path);
        removed.push(record.name);
      } catch (e) {
        // 忽略删除错误
      }
    }
  }

  return {
    removed,
    remaining: records.length - removed.length,
  };
}