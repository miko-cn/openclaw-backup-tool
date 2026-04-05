import { parseArgs } from "util";
import { syncBackups } from "../lib/sync.js";

export async function runSync(args: string[]) {
  const parsed = parseArgs({
    args,
    options: {
      target: {
        type: "string",
        short: "t",
      },
    },
    allowPositionals: false,
  });

  const target = parsed.values.target as "daily" | "weekly" | "monthly" | "all" | undefined;

  if (!target) {
    console.error("Error: --target is required");
    console.log("Usage: backup sync --target <daily|weekly|monthly|all>");
    process.exit(1);
  }

  if (!["daily", "weekly", "monthly", "all"].includes(target)) {
    console.error(`Error: invalid target "${target}". Must be daily, weekly, monthly, or all`);
    process.exit(1);
  }

  console.log(`[SYNC] Starting sync for: ${target}`);
  
  const result = await syncBackups(target);

  console.log(`[SYNC] Done! (local: ${result.localTotal} files, remote: ${result.remoteTotal} files)`);
  console.log(`[SYNC] Uploaded: ${result.uploaded.length}, Removed: ${result.removed.length}, Kept: ${result.kept}`);
}