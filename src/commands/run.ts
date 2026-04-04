import { loadConfig } from "../lib/config.js";
import { runBackup as doBackup, cleanOldBackups } from "../lib/backup.js";
import type { CliOptions } from "../types.js";

export async function runBackup(options: CliOptions) {
  const config = loadConfig(options.config);
  const template = options.template || "workspace";

  // Dry run 模式
  if (options.dryRun) {
    console.log("[DRY RUN] Would execute backup with:");
    console.log(`  - Template: ${template}`);
    console.log(`  - Output: ${config.backup.outputDir}`);
    console.log(`  - Retention: ${config.retention.type} (maxCount: ${config.retention.maxCount}, maxDays: ${config.retention.maxDays})`);
    return;
  }

  // 执行备份
  const result = await doBackup(config, template);

  if (!result.success) {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }

  // 清理旧备份
  const cleanResult = await cleanOldBackups(config);
  if (cleanResult.removed.length > 0) {
    for (const name of cleanResult.removed) {
      console.log(`[CLEAN] Removed: ${name}.tar.gz`);
    }
    console.log(`[CLEAN] Remaining: ${cleanResult.remaining} backups`);
  }

  console.log("Done!");
}