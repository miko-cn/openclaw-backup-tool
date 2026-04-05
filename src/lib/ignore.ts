import createIgnore, { Ignore } from "ignore";
import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import type { BackupTarget } from "../types.js";

// 展开 ~ 为用户家目录
function expandTilde(path: string): string {
  if (path.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "/root";
    return path.replace("~", home);
  }
  return path;
}

// 解析 .gitignore 内容为规则数组
function parseGitignore(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export interface FileFilter {
  isIncluded: (filePath: string) => boolean;
}

// 递归扫描目录下所有 .gitignore 文件
// 返回 Map: 目录路径 -> ignore 实例
function scanGitignores(rootDir: string): Map<string, Ignore> {
  const gitignoreMap = new Map<string, Ignore>();

  function walk(currentDir: string) {
    const gitignorePath = resolve(currentDir, ".gitignore");
    if (existsSync(gitignorePath)) {
      try {
        const content = readFileSync(gitignorePath, "utf-8");
        const rules = parseGitignore(content);
        if (rules.length > 0) {
          const ig = createIgnore();
          ig.add(rules);
          gitignoreMap.set(currentDir, ig);
        }
      } catch (e) {
        // 忽略读取错误
      }
    }

    // 遍历子目录
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(resolve(currentDir, entry.name));
        }
      }
    } catch (e) {
      // 忽略遍历错误
    }
  }

  walk(rootDir);
  return gitignoreMap;
}

// 创建文件过滤器
// globalExcludes: 全局排除规则，应用到所有目标
export function createFileFilter(target: BackupTarget, globalExcludes?: string[]): FileFilter {
  const targetPath = expandTilde(target.path);
  
  // 扫描所有 .gitignore 并缓存
  const gitignoreMap = scanGitignores(targetPath);

  // 合并全局 excludes 和目标自己的 excludes
  const allExcludes: string[] = [];
  if (globalExcludes && globalExcludes.length > 0) {
    allExcludes.push(...globalExcludes);
  }
  if (target.excludes && target.excludes.length > 0) {
    allExcludes.push(...target.excludes);
  }

  let excludesIg: Ignore | null = null;
  if (allExcludes.length > 0) {
    excludesIg = createIgnore();
    for (const pattern of allExcludes) {
      excludesIg.add(pattern);
    }
  }

  return {
    isIncluded: (filePath: string) => {
      // 先检查用户配置的 excludes
      if (excludesIg) {
        const relativePath = filePath.replace(targetPath, "").replace(/^\//, "");
        if (excludesIg.test(relativePath).ignored) {
          return false;
        }
      }

      // 从文件的父目录向上查到 target.path 根目录
      let currentDir = dirname(filePath);
      const rootDir = targetPath;

      while (currentDir.startsWith(rootDir)) {
        const ig = gitignoreMap.get(currentDir);
        if (ig) {
          // 相对于当前目录的路径，而不是 root
          const relativePath = filePath.replace(currentDir, "").replace(/^\//, "");
          if (ig.test(relativePath).ignored) {
            return false;
          }
        }

        if (currentDir === rootDir) break;
        currentDir = dirname(currentDir);
      }

      return true;
    },
  };
}

// 从多个目标创建聚合过滤器
// globalExcludes: 全局排除规则，应用到所有目标
export function createMultiTargetFilter(
  targets: BackupTarget[],
  globalExcludes?: string[]
): FileFilter {
  const filters = targets.map((t) => createFileFilter(t, globalExcludes));

  return {
    isIncluded: (filePath: string) => {
      // 任一目标包含则保留
      return filters.some((f) => f.isIncluded(filePath));
    },
  };
}
