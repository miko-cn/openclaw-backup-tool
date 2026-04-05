import COS from "cos-nodejs-sdk-v5";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

// 读取环境变量配置
function loadCosConfig() {
  const envPath = resolve(process.env.HOME || "/root", ".openclaw/.env");
  
  const config = {
    secretId: process.env.COS_SECRET_ID,
    secretKey: process.env.COS_SECRET_KEY,
    bucket: process.env.COS_BUCKET,
    region: process.env.COS_REGION,
  };

  // 如果 .env 文件存在，也从其中读取
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
      
      if (envVars.COS_SECRET_ID) config.secretId = envVars.COS_SECRET_ID;
      if (envVars.COS_SECRET_KEY) config.secretKey = envVars.COS_SECRET_KEY;
      if (envVars.COS_BUCKET) config.bucket = envVars.COS_BUCKET;
      if (envVars.COS_REGION) config.region = envVars.COS_REGION;
    } catch (e) {
      // 忽略读取错误
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
