import { loadConfig } from "../lib/config.js";
import { cleanOldBackups } from "../lib/backup.js";
import type { CliOptions } from "../types.js";

export async function runClean(options: CliOptions) {
  const config = loadConfig(options.config);

  // Dry run 模式
  if (options.dryRun) {
    console.log("[DRY RUN] Would clean backups with:");
    console.log(`  - Output: ${config.backup.outputDir}`);
    console.log(`  - Retention: ${config.retention.type} (maxCount: ${config.retention.maxCount}, maxDays: ${config.retention.maxDays})`);
    return;
  }

  const result = await cleanOldBackups(config);

  if (result.removed.length === 0) {
    console.log("No old backups to clean.");
    return;
  }

  console.log(`Cleaned ${result.removed.length} backup(s):`);
  for (const name of result.removed) {
    console.log(`  - ${name}.tar.gz`);
  }
  console.log(`Remaining: ${result.remaining} backups`);
}