import { verifyBackup } from "../lib/verify.js";
import { expandTilde } from "../lib/config.js";

/**
 * Run backup verify command
 */
export async function runVerify(filePath: string): Promise<void> {
  // Expand tilde in path
  const resolvedPath = expandTilde(filePath);

  const result = await verifyBackup(resolvedPath);

  if (result.success) {
    console.log(`[VERIFY] Verified! (${result.files} files, ${result.size} MB)`);
    
    // 显示遗漏检查结果
    if (result.missingFiles && result.missingFiles.length > 0) {
      console.log(`[VERIFY] WARNING: ${result.missingFiles.length} files missing (not backed up):`);
      for (const f of result.missingFiles.slice(0, 10)) {
        console.log(`  - ${f}`);
      }
      if (result.missingFiles.length > 10) {
        console.log(`  ... and ${result.missingFiles.length - 10} more`);
      }
    }
    
    if (result.extraFiles && result.extraFiles.length > 0) {
      console.log(`[VERIFY] WARNING: ${result.extraFiles.length} extra files (unexpected):`);
      for (const f of result.extraFiles.slice(0, 10)) {
        console.log(`  + ${f}`);
      }
      if (result.extraFiles.length > 10) {
        console.log(`  ... and ${result.extraFiles.length - 10} more`);
      }
    }
    
    if (!result.missingFiles && !result.extraFiles) {
      console.log(`[VERIFY] All files match expected list!`);
    }
  } else {
    console.log(`[VERIFY] FAILED: ${result.error}`);
    process.exit(1);
  }
}