// 类型定义
export interface BackupTarget {
  name: string;
  path: string;
  includes?: string[];
  excludes?: string[];
}

export interface BackupConfig {
  version: string;
  backup: {
    targets: BackupTarget[];
    outputDir: string;
    compression: boolean;
    globalExcludes?: string[];
  };
  retention: {
    type: "count" | "days" | "both";
    maxCount?: number;
    maxDays?: number;
  };
  templates: Record<string, TemplateDefinition>;
}

export interface TemplateDefinition {
  description: string;
  targets: string[];
}

// CLI 选项
export interface CliOptions {
  config?: string;
  template?: string;
  suffix?: string;
  dryRun?: boolean;
}

// 备份结果
export interface BackupResult {
  success: boolean;
  backupPath?: string;
  filesCount?: number;
  sizeBytes?: number;
  error?: string;
}

// 备份记录
export interface BackupRecord {
  name: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
  template: string;
}

// 验证结果
export interface VerifyResult {
  success: boolean;
  files?: number;
  size?: number;
  error?: string;
  missingFiles?: string[];  // 遗漏的文件（应该备份但没有的）
  extraFiles?: string[];   // 额外的文件（不该有但有的）
}