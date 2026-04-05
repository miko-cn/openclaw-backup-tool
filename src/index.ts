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

// 命令详细帮助
const commandHelp: Record<string, string> = {
  init: `Initialize backup configuration

  Usage: backup init
  
  Creates default config at ~/.openclaw/backups/backup.config.json`,
  
  run: `Run backup

  Usage: backup run [options]
  
  Options:
    -t, --template <name>  Template name (default: workspace)
    --suffix <suffix>       Suffix for backup file (daily/weekly/monthly)
    --dry-run             Dry run mode (no actual backup)
    -c, --config <path>   Config file path
  
  Examples:
    backup run --template complete
    backup run --template complete --suffix daily
    backup run --template complete --dry-run`,
  
  list: `List all backups

  Usage: backup list [options]
  
  Options:
    -c, --config <path>   Config file path`,
  
  clean: `Clean old backups

  Usage: backup clean [options]
  
  Options:
    -c, --config <path>   Config file path`,
  
  verify: `Verify a backup file

  Usage: backup verify <file.tar.gz>
  
  Examples:
    backup verify ~/.openclaw/backups/openclaw-backup-complete-20260405.tar.gz`,
  
  sync: `Sync backups to COS

  Usage: backup sync --target <daily|weekly|monthly|all>
  
  Options:
    --target <type>  Sync target: daily, weekly, monthly, or all
  
  Retention policy:
    daily   - keep 7
    weekly  - keep 4
    monthly - keep 12
  
  Examples:
    backup sync --target daily
    backup sync --target all`,
};

async function main() {
  const args = process.argv.slice(2);

  // 无参数时显示帮助
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("OpenClaw Backup Tool");
    console.log("\nUsage: backup <command> [options]");
    console.log("\nCommands:");
    for (const [cmd, desc] of Object.entries(commands)) {
      console.log(`  ${cmd.padEnd(10)} ${desc}`);
    }
    console.log("\nOptions:");
    console.log(`  -h, --help           Show help`);
    console.log(`  -c, --config <path> Config file path`);
    console.log("\nExamples:");
    console.log(`  backup run --template complete`);
    console.log(`  backup run --template complete --suffix daily`);
    console.log(`  backup verify <file.tar.gz>`);
    console.log(`  backup sync --target daily`);
    process.exit(0);
  }

  // 显示特定命令帮助
  if (args[0] === "--help" || args[0] === "-h") {
    const cmd = args[1];
    if (cmd && commandHelp[cmd]) {
      console.log(commandHelp[cmd]);
      process.exit(0);
    }
  }

  const command = args[0];

  if (!Object.keys(commands).includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.log(`Run 'backup' to see available commands`);
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
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  // 显示单命令帮助
  if (parsed.values.help && command) {
    console.log(commandHelp[command] || commands[command]);
    process.exit(0);
  }

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