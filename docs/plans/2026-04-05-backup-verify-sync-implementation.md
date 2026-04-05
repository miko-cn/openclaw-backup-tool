# Backup Verify & Sync Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Add backup verify and sync commands to openclaw-backup-tool

**Architecture:** 
- `verify`: Extract to temp dir, check file count/size matches expected
- `sync`: List local backups → upload new ones → list remote → apply retention policy → delete remote excess

**Tech Stack:** Bun, TypeScript, Tencent Cloud COS SDK

---

### Task 1: Add backup verify command

**Files:**
- Create: `src/commands/verify.ts`
- Modify: `src/index.ts` (add verify command)

**Step 1: Write the failing test**
```typescript
// test/verify.test.ts
import { verifyBackup } from "../src/lib/verify.js";

const result = await verifyBackup("/tmp/test.tar.gz");
console.log(result.success); // Expected: true, currently false (command not implemented)
```

**Step 2: Run test — confirm it fails**
`bun run test/verify.test.ts`
Expected: FAIL — verifyBackup not found

**Step 3: Implement verify command**
- Create `src/lib/verify.ts`:
  ```typescript
  export async function verifyBackup(filePath: string): Promise<{success: boolean, files?: number, size?: number, error?: string}> {
    // 1. Create temp dir
    // 2. Extract tar.gz to temp
    // 3. Count files & calculate size
    // 4. Cleanup temp
    // 5. Return result
  }
  ```
- Create `src/commands/verify.ts`:
  ```typescript
  import { verifyBackup } from "../lib/verify.js";
  
  export async function runVerify(filePath: string) {
    const result = await verifyBackup(filePath);
    if (result.success) {
      console.log(`[VERIFY] Verified! (${result.files} files, ${result.size}MB)`);
    } else {
      console.error(`[VERIFY] FAILED: ${result.error}`);
      process.exit(1);
    }
  }
  ```
- Add to `src/index.ts`:
  ```typescript
  case "verify":
    await runVerify(parsed.positionals[1]);
    break;
  ```

**Step 4: Run test — confirm it passes**
`bun run test/verify.test.ts`
Expected: PASS

**Step 5: Commit**
`git add src/lib/verify.ts src/commands/verify.ts src/index.ts && git commit -m "feat: add backup verify command"`

---

### Task 2: Add COS sync command - upload new backups

**Files:**
- Create: `src/lib/cos.ts` (COS client)
- Modify: `src/lib/sync.ts` (add upload logic)

**Step 1: Write failing test**
```typescript
// test/cos-upload.test.ts
import { uploadToCOS } from "../src/lib/cos.js";

// This will fail - COS client not implemented yet
const result = await uploadToCOS("/tmp/backup.tar.gz", "openclaw/backups/");
```

**Step 2: Run test — confirm it fails**
Expected: FAIL — uploadToCOS not defined

**Step 3: Implement COS client**
- Install COS SDK: `bun add cos-nodejs-sdk-v5`
- Create `src/lib/cos.ts`:
  ```typescript
  import COS from 'cos-nodejs-sdk-v5';
  import { readFileSync } from 'fs';
  
  // Load config from ~/.openclaw/.env
  function getCOSClient() {
    const envContent = readFileSync(process.env.HOME + '/.openclaw/.env', 'utf-8');
    const secretId = envContent.match(/COS_SECRET_ID=(.*)/)?.[1];
    const secretKey = envContent.match(/COS_SECRET_KEY=(.*)/)?.[1];
    const bucket = envContent.match(/COS_BUCKET=(.*)/)?.[1];
    const region = envContent.match(/COS_REGION=(.*)/)?.[1];
    
    return new COS({ SecretId: secretId, SecretKey: secretKey, Bucket: bucket, Region: region });
  }
  
  export async function uploadToCOS(localFile: string, remotePath: string) {
    const cos = getCOSClient();
    const filename = localFile.split('/').pop();
    return new Promise((resolve, reject) => {
      cos.putFile({
        Bucket: process.env.COS_BUCKET,
        Region: process.env.COS_REGION,
        Key: remotePath + filename,
        FilePath: localFile,
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }
  ```

**Step 4: Run test — confirm it passes**

**Step 5: Commit**
`git add src/lib/cos.ts && git commit -m "feat: add COS client"`

---

### Task 3: Add sync command - retention policy

**Files:**
- Create: `src/commands/sync.ts`
- Modify: `src/lib/sync.ts`, `src/index.ts`

**Step 1: Write failing test**
```typescript
// test/sync.test.ts
import { syncBackups } from "../src/lib/sync.js";

// This will fail - sync not implemented
const result = await syncBackups("daily");
```

**Step 2: Run test — confirm it fails**
Expected: FAIL — syncBackups not defined

**Step 3: Implement sync logic**
- Create `src/lib/sync.ts`:
  ```typescript
  import { uploadToCOS } from "./cos.js";
  import { readdirSync, statSync, unlinkSync } from "fs";
  import { join } from "path";
  
  interface SyncResult {
    uploaded: string[];
    removed: string[];
    kept: number;
  }
  
  export async function syncBackups(target: "daily" | "weekly" | "monthly" | "all"): Promise<SyncResult> {
    const backupDir = process.env.HOME + '/.openclaw/backups';
    const pattern = `*-${target}-*.tar.gz`;
    const keep = { daily: 7, weekly: 4, monthly: 12 }[target];
    
    // 1. Find local backups matching pattern
    // 2. Upload new ones to COS
    // 3. List remote backups
    // 4. Apply retention (keep N most recent)
    // 5. Delete excess from remote
    
    // Implementation...
  }
  ```
- Create `src/commands/sync.ts`:
  ```typescript
  import { syncBackups } from "../lib/sync.js";
  
  export async function runSync(target: string) {
    const result = await syncBackups(target as any);
    console.log(`[SYNC] Uploaded: ${result.uploaded.length}`);
    console.log(`[SYNC] Removed: ${result.removed.length}`);
    console.log(`[SYNC] Kept: ${result.kept}`);
  }
  ```

**Step 4: Run test — confirm it passes**

**Step 5: Commit**
`git add src/lib/sync.ts src/commands/sync.ts && git commit -m "feat: add backup sync command"`

---

### Task 4: Integration test

**Files:**
- Test: Manual verification

**Step 1: Run verify on existing backup**
```bash
bun run src/index.ts verify ~/.openclaw/backups/openclaw-backup-complete-20260405-004157.tar.gz
```

**Step 2: Run sync**
```bash
bun run src/index.ts sync daily
```

**Step 3: Verify COS upload**
Check COS console for new files

**Step 4: Commit**
`git add . && git commit -m "test: verify and sync integration"`

---

## Execution

Plan saved to `docs/plans/2026-04-05-backup-verify-sync-implementation.md`.

Two execution options:
1. **Subagent-Driven** — I dispatch a fresh sub-agent per task
2. **Manual** — You run the tasks yourself

Which approach?