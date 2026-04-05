import { extract } from "tar";
import { existsSync, mkdirSync, rmSync, statSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { VerifyResult } from "../types.js";
import { loadConfig } from "./config.js";
import { createMultiTargetFilter } from "./ignore.js";
import { expandTilde } from "./config.js";

interface VerifyDetail {
  success: boolean;
  files?: number;
  size?: number;
  error?: string;
  missingFiles?: string[];
  extraFiles?: string[];
}

/**
 * 从文件名解析模板名
 * 例如: openclaw-backup-complete-daily-20260405-122740.tar.gz -> complete
 */
function parseTemplateFromFilename(filename: string): string | null {
  const match = filename.match(/^openclaw-backup-(\w+)-(?:daily|weekly|monthly-)?\d{8}-\d{6}\.tar\.gz$/);
  return match ? match[1] : null;
}

/**
 * 扫描源目录，获取应该备份的文件列表
 */
async function getExpectedFiles(templateName: string): Promise<string[]> {
  const config = loadConfig();
  const template = config.templates[templateName];
  
  if (!template) {
    return [];
  }

  // 构建目标列表
  const targets = template.targets.map((path: string) => {
    const basePath = expandTilde(path).replace(/\/\*\*.*$/, "");
    return {
      name: templateName,
      path: basePath,
      includes: ["**/*"],
    };
  });

  // 创建过滤器
  const filter = createMultiTargetFilter(targets, config.backup.globalExcludes);

  // 收集应该备份的文件
  const expectedFiles: string[] = [];

  function walkDir(dir: string, basePath: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, basePath);
        } else if (entry.isFile()) {
          if (filter.isIncluded(fullPath)) {
            // 存储相对路径
            expectedFiles.push(fullPath.replace(basePath, "").replace(/^\//, ""));
          }
        }
      }
    } catch (e) {
      // 忽略权限错误
    }
  }

  for (const target of targets) {
    const targetPath = expandTilde(target.path);
    if (existsSync(targetPath)) {
      walkDir(targetPath, targetPath);
    }
  }

  return expectedFiles;
}

/**
 * 获取解压后的文件列表
 */
function getExtractedFiles(tempDir: string, baseDir: string): string[] {
  const files: string[] = [];
  
  function walkDir(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        // 存储相对路径
        files.push(fullPath.replace(baseDir, "").replace(/^\//, ""));
      }
    }
  }
  
  walkDir(tempDir);
  return files;
}

/**
 * 增强版 verify：解压测试 + 遗漏检查
 */
export async function verifyBackup(filePath: string): Promise<VerifyResult> {
  if (!existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const filename = filePath.split("/").pop() || "";
  const templateName = parseTemplateFromFilename(filename);
  
  // 并行：解压 + 扫描源目录
  const tempDir = join(tmpdir(), `backup-verify-${Date.now()}`);
  
  try {
    // 1. 解压测试
    mkdirSync(tempDir, { recursive: true });
    await extract({ file: filePath, cwd: tempDir });
    
    // 2. 统计解压后的文件
    let fileCount = 0;
    let totalSize = 0;
    
    function countFiles(dir: string): void {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isFile()) {
          fileCount++;
          totalSize += statSync(fullPath).size;
        } else if (entry.isDirectory()) {
          countFiles(fullPath);
        }
      }
    }
    countFiles(tempDir);
    
    // 3. 如果能解析出模板名，进行遗漏检查
    let missingFiles: string[] = [];
    let extraFiles: string[] = [];
    
    if (templateName) {
      const expectedFiles = await getExpectedFiles(templateName);
      const actualFiles = getExtractedFiles(tempDir, tempDir);
      
      // 比较
      const expectedSet = new Set(expectedFiles);
      const actualSet = new Set(actualFiles);
      
      // 遗漏：应该有的但实际没有
      for (const f of expectedFiles) {
        if (!actualSet.has(f)) {
          missingFiles.push(f);
        }
      }
      
      // 额外：实际有但不应该有（可能是过滤失效）
      for (const f of actualFiles) {
        if (!expectedSet.has(f)) {
          extraFiles.push(f);
        }
      }
    }
    
    const sizeInMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100;
    
    return {
      success: true,
      files: fileCount,
      size: sizeInMB,
      missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
      extraFiles: extraFiles.length > 0 ? extraFiles : undefined,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // 忽略清理错误
    }
  }
}