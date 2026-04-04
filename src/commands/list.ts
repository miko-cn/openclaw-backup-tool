import { loadConfig } from "../lib/config.js";
import { listBackups } from "../lib/backup.js";
import type { CliOptions } from "../types.js";

export async function runList(options: CliOptions) {
  const config = loadConfig(options.config);
  const backups = await listBackups(config);

  if (backups.length === 0) {
    console.log("No backups found.");
    return;
  }

  console.log(`Found ${backups.length} backup(s):\n`);
  for (const backup of backups) {
    const sizeMB = (backup.sizeBytes / (1024 * 1024)).toFixed(2);
    const date = backup.createdAt.toLocaleString();
    console.log(`  ${backup.name}`);
    console.log(`    Created: ${date}`);
    console.log(`    Size: ${sizeMB} MB`);
    console.log("");
  }
}