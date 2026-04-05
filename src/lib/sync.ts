import { existsSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { 
  uploadToCOS, 
  listRemoteBackups, 
  deleteRemoteFile,
  checkRemoteFileExists 
} from "./cos.js";
import { loadConfig } from "./config.js";
import type { BackupRecord } from "../types.js";

// 备份文件保留策略
const RETENTION_CONFIG = {
  daily: 7,    // 每日备份保留 7 份
  weekly: 4,   // 每周备份保留 4 份
  monthly: 12, // 每月备份保留 12 份
};

// 获取本地备份文件列表
async function listLocalBackups(
  outputDir: string,
  targetType: "daily" | "weekly" | "monthly"
): Promise<BackupRecord[]> {
  const records: BackupRecord[] = [];

  if (!existsSync(outputDir)) {
    return records;
  }

  try {
    const files = readdirSync(outputDir);
    
    for (const file of files) {
      // 匹配模式: openclaw-backup-*-daily-*.tar.gz, openclaw-backup-*-weekly-*.tar.gz, openclaw-backup-*-monthly-*.tar.gz
      let pattern: RegExp;
      if (targetType === "daily") {
        pattern = /^openclaw-backup-.+-daily-\d{8}-\d{6}\.tar\.gz$/;
      } else if (targetType === "weekly") {
        pattern = /^openclaw-backup-.+-weekly-\d{8}-\d{6}\.tar\.gz$/;
      } else if (targetType === "monthly") {
        pattern = /^openclaw-backup-.+-monthly-\d{8}-\d{6}\.tar\.gz$/;
      } else {
        pattern = /^openclaw-backup-.+-\d{8}-\d{6}\.tar\.gz$/;
      }

      if (pattern.test(file)) {
        const filePath = join(outputDir, file);
        const stat = statSync(filePath);
        
        // 提取模板名称
        const match = file.match(/^openclaw-backup-(.+)-\d{8}-\d{6}\.tar\.gz$/);
        
        records.push({
          name: file.replace(".tar.gz", ""),
          path: filePath,
          createdAt: stat.mtime,
          sizeBytes: stat.size,
          template: match ? match[1] : "unknown",
        });
      }
    }
  } catch (e) {
    // 忽略错误
  }

  // 按创建时间排序（新的在前）
  return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// 获取远程备份前缀
function getRemotePrefix(targetType: string): string {
  return `backups/${targetType}/`;
}

// 同步备份
export interface SyncResult {
  uploaded: string[];
  removed: string[];
  kept: number;
  localTotal: number;
  remoteTotal: number;
}

export async function syncBackups(
  target: "daily" | "weekly" | "monthly" | "all"
): Promise<SyncResult> {
  const config = loadConfig();
  const outputDir = config.backup.outputDir.replace("~", process.env.HOME || "/root");
  
  const results: SyncResult = {
    uploaded: [],
    removed: [],
    kept: 0,
    localTotal: 0,
    remoteTotal: 0,
  };

  // 确定要同步的类型
  const types = target === "all" 
    ? ["daily", "weekly", "monthly"] as const 
    : [target] as const;

  for (const type of types) {
    console.log(`[SYNC] Processing ${type} backups...`);
    
    // 1. 获取本地备份
    const localBackups = await listLocalBackups(outputDir, type);
    results.localTotal += localBackups.length;
    
    // 2. 获取远程备份
    const remotePrefix = getRemotePrefix(type);
    let remoteBackups;
    try {
      remoteBackups = await listRemoteBackups(remotePrefix);
      results.remoteTotal += remoteBackups.length;
    } catch (e) {
      console.log(`[SYNC] Warning: Failed to list remote backups: ${e}`);
      remoteBackups = [];
    }

    // 3. 上传新的本地备份（远程不存在的）
    for (const local of localBackups) {
      const remoteKey = `${remotePrefix}${basename(local.path)}`;
      const existsRemote = remoteBackups.some(r => r.key === remoteKey);
      
      if (!existsRemote) {
        console.log(`[SYNC] Uploading: ${local.name}`);
        const uploadResult = await uploadToCOS(local.path, remoteKey);
        
        if (uploadResult.success) {
          results.uploaded.push(local.name);
        } else {
          console.log(`[SYNC] Failed to upload ${local.name}: ${uploadResult.error}`);
        }
      }
    }

    // 4. 获取更新后的远程列表（用于删除判断）
    try {
      remoteBackups = await listRemoteBackups(remotePrefix);
      results.remoteTotal = remoteBackups.length;
    } catch (e) {
      remoteBackups = [];
    }

    // 5. 应用保留策略并删除多余的远程备份
    const maxKeep = RETENTION_CONFIG[type];
    const remoteByTime = remoteBackups.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    );

    // 保留最新的 N 个
    const toKeep = remoteByTime.slice(0, maxKeep);
    const toRemove = remoteByTime.slice(maxKeep);

    for (const remote of toRemove) {
      console.log(`[SYNC] Removing (retention): ${remote.key}`);
      const deleteResult = await deleteRemoteFile(remote.key);
      
      if (deleteResult.success) {
        results.removed.push(remote.key);
      } else {
        console.log(`[SYNC] Failed to delete ${remote.key}: ${deleteResult.error}`);
      }
    }

    results.kept += toKeep.length;

    console.log(`[SYNC] ${type.charAt(0).toUpperCase() + type.slice(1)}: ${toKeep.length} kept, ${toRemove.length} removed`);
  }

  return results;
}