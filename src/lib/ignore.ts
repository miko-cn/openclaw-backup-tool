import createIgnore from "ignore";
import { readFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import type { BackupTarget } from "../types.js";

// 展开 ~ 为用户家目录
function expandTilde(path: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    return path.replace("~", home);
  }
  return path;
}

export interface FileFilter {
  isIncluded: (filePath: string) => boolean;
}

// 创建文件过滤器
export function createFileFilter(target: BackupTarget): FileFilter {
  const ig = createIgnore();

  // 添加 excludes 规则
  if (target.excludes && target.excludes.length > 0) {
    for (const pattern of target.excludes) {
      ig.add(pattern);
    }
  }

  // 尝试加载目标目录的 .gitignore
  const targetPath = expandTilde(target.path);
  const gitignorePath = resolve(targetPath, ".gitignore");
  if (existsSync(gitignorePath)) {
    try {
      const gitignoreContent = readFileSync(gitignorePath, "utf-8");
      // 解析 .gitignore 内容并添加
      const lines = gitignoreContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      ig.add(lines);
    } catch (e) {
      // 忽略读取错误
    }
  }

  return {
    isIncluded: (filePath: string) => {
      // 相对路径相对于 target.path
      const relativePath = filePath.replace(target.path, "").replace(/^[/\\]/, "");
      return !ig.test(relativePath).ignored;
    },
  };
}

// 从多个目标创建聚合过滤器
export function createMultiTargetFilter(
  targets: BackupTarget[]
): FileFilter {
  const filters = targets.map((t) => createFileFilter(t));

  return {
    isIncluded: (filePath: string) => {
      // 任一目标包含则保留
      return filters.some((f) => f.isIncluded(filePath));
    },
  };
}