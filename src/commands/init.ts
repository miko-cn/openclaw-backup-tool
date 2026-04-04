import { writeFileSync, existsSync, mkdirSync } from "fs";
import { generateDefaultConfig } from "../lib/config.js";

// 展开 ~ 为用户家目录
function expandTilde(path: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    return path.replace("~", home);
  }
  return path;
}

export async function runInit() {
  const outputDir = expandTilde("~/.openclaw/backups");

  // 确保目录存在
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const configPath = `${outputDir}/backup.config.json`;
  const config = generateDefaultConfig();

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Config created: ${configPath}`);
  console.log(`Backup output directory: ${outputDir}`);
}