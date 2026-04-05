import COS from "cos-nodejs-sdk-v5";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// 读取环境变量配置
// 优先级：1. 进程环境变量 2. ~/.bashrc 3. ~/.zshrc 4. ~/.openclaw/.env
function loadCosConfig() {
  // 1. 先尝试进程环境变量
  let config = {
    secretId: process.env.TENCENT_COS_SECRET_ID || process.env.COS_SECRET_ID,
    secretKey: process.env.TENCENT_COS_SECRET_KEY || process.env.COS_SECRET_KEY,
    bucket: process.env.TENCENT_COS_BUCKET || process.env.COS_BUCKET,
    region: process.env.TENCENT_COS_REGION || process.env.COS_REGION,
  };

  // 如果进程环境变量没有，尝试从 shell 配置文件读取
  if (!config.secretId) {
    const shellFiles = [
      resolve(process.env.HOME || "/root", ".bashrc"),
      resolve(process.env.HOME || "/root", ".zshrc"),
    ];

    for (const file of shellFiles) {
      if (existsSync(file)) {
        try {
          const content = readFileSync(file, "utf-8");
          // 解析 export TENCENT_COS_*=xxx
          const lines = content.split("\n");
          for (const line of lines) {
            const match = line.match(/^export\s+TENCENT_COS_(\w+)=["']?([^"'\n]+)["']?/);
            if (match) {
              const [, key, value] = match;
              if (key === "SECRET_ID") config.secretId = value;
              if (key === "SECRET_KEY") config.secretKey = value;
              if (key === "REGION") config.region = value;
              if (key === "BUCKET") config.bucket = value;
            }
          }
          if (config.secretId) break; // 找到就退出
        } catch (e) {
          // 忽略
        }
      }
    }
  }

  // 2. 如果还没有，从 .env 读取作为备选
  if (!config.secretId) {
    const envPath = resolve(process.env.HOME || "/root", ".openclaw/.env");
    if (existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, "utf-8");
        const envVars: Record<string, string> = {};
        
        for (const line of envContent.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const [key, ...valueParts] = trimmed.split("=");
            if (key && valueParts.length > 0) {
              envVars[key.trim()] = valueParts.join("=").trim();
            }
          }
        }
        
        if (envVars.TENCENT_COS_SECRET_ID) config.secretId = envVars.TENCENT_COS_SECRET_ID;
        if (envVars.TENCENT_COS_SECRET_KEY) config.secretKey = envVars.TENCENT_COS_SECRET_KEY;
        if (envVars.TENCENT_COS_BUCKET) config.bucket = envVars.TENCENT_COS_BUCKET;
        if (envVars.TENCENT_COS_REGION) config.region = envVars.TENCENT_COS_REGION;
      } catch (e) {
        // 忽略
      }
    }
  }

  return config;
}

let cosInstance: COS | null = null;

function getCosClient(): COS {
  if (!cosInstance) {
    const config = loadCosConfig();
    
    if (!config.secretId || !config.secretKey || !config.bucket || !config.region) {
      throw new Error(
        "COS config not found. Please set COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION in ~/.openclaw/.env"
      );
    }

    cosInstance = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });
  }
  
  return cosInstance;
}

function getBucketConfig() {
  const config = loadCosConfig();
  
  if (!config.bucket || !config.region) {
    throw new Error(
      "COS bucket and region not configured. Please set COS_BUCKET and COS_REGION in ~/.openclaw/.env"
    );
  }
  
  return {
    Bucket: config.bucket,
    Region: config.region,
  };
}

// 上传文件到 COS
export async function uploadToCOS(
  localFile: string,
  remotePath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const cos = getCosClient();
  const bucketConfig = getBucketConfig();

  return new Promise((resolve) => {
    cos.putObject(
      {
        ...bucketConfig,
        Key: remotePath,
        FilePath: localFile,
      },
      (err, data) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          // 构造访问 URL
          const url = `https://${bucketConfig.Bucket}.cos.${bucketConfig.Region}.myqcloud.com/${remotePath}`;
          resolve({ success: true, url });
        }
      }
    );
  });
}

// 列出远程备份文件
export interface RemoteBackupFile {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

export async function listRemoteBackups(
  prefix: string
): Promise<RemoteBackupFile[]> {
  const cos = getCosClient();
  const bucketConfig = getBucketConfig();

  return new Promise((resolve, reject) => {
    cos.getBucket(
      {
        ...bucketConfig,
        Prefix: prefix,
      },
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const files: RemoteBackupFile[] = (data.Contents || []).map((item: any) => ({
          key: item.Key,
          size: parseInt(item.Size, 10),
          lastModified: new Date(item.LastModified),
          url: `https://${bucketConfig.Bucket}.cos.${bucketConfig.Region}.myqcloud.com/${item.Key}`,
        }));

        resolve(files);
      }
    );
  });
}

// 删除远程文件
export async function deleteRemoteFile(key: string): Promise<{ success: boolean; error?: string }> {
  const cos = getCosClient();
  const bucketConfig = getBucketConfig();

  return new Promise((resolve) => {
    cos.deleteObject(
      {
        ...bucketConfig,
        Key: key,
      },
      (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true });
        }
      }
    );
  });
}

// 检查远程文件是否存在
export async function checkRemoteFileExists(key: string): Promise<boolean> {
  const cos = getCosClient();
  const bucketConfig = getBucketConfig();

  return new Promise((resolve) => {
    cos.headObject(
      {
        ...bucketConfig,
        Key: key,
      },
      (err) => {
        resolve(!err);
      }
    );
  });
}
