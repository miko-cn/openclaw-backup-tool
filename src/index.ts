#!/usr/bin/env bun
import { parseArgs } from "util";
import { runInit } from "./commands/init.js";
import { runList } from "./commands/list.js";
import { runClean } from "./commands/clean.js";
import { runBackup } from "./commands/run.js";
import { runVerify } from "./commands/verify.js";
import { runSync } from "./commands/sync.js";

const commands = {
  init: "Initialize backup configuration",
  run: "Run backup",
  list: "List all backups",
  clean: "Clean old backups",
  verify: "Verify a backup file",
  sync: "Sync backups to COS with retention",
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("OpenClaw Backup Tool");
    console.log("\nUsage: backup <command> [options]");
    console.log("\nCommands:");
    for (const [cmd, desc] of Object.entries(commands)) {
      console.log(`  ${cmd.padEnd(10)} ${desc}`);
    }
    console.log("\nOptions:");
    console.log(`  -c, --config <path>   Config file path`);
    console.log(`  -t, --template <name> Template name`);
    console.log(`  --dry-run            Dry run mode`);
    process.exit(0);
  }

  const command = args[0];

  if (!Object.keys(commands).includes(command)) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  // 解析全局选项
  const parsed = parseArgs({
    args: args.slice(1),
    options: {
      config: { type: "string", short: "c" },
      template: { type: "string", short: "t" },
      suffix: { type: "string" },
      target: { type: "string" },
      "dry-run": { type: "boolean" },
    },
    allowPositionals: true,
  });

  const options = {
    config: parsed.values.config,
    template: parsed.values.template,
    suffix: parsed.values.suffix,
    dryRun: parsed.values["dry-run"],
  };

  // 执行命令
  switch (command) {
    case "init":
      await runInit();
      break;
    case "run":
      await runBackup(options);
      break;
    case "list":
      await runList(options);
      break;
    case "clean":
      await runClean(options);
      break;
    case "verify":
      if (!parsed.positionals || !parsed.positionals[0]) {
        console.error("Error: backup file path required");
        console.log("Usage: backup verify <file.tar.gz>");
        process.exit(1);
      }
      await runVerify(parsed.positionals[0]);
      break;
    case "sync":
      await runSync(args.slice(1));
      break;
  }
}

main();