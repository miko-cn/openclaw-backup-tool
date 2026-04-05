# Subdirectory .gitignore Support Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Add support for traversing and applying .gitignore rules from subdirectories during backup.

**Architecture:** Recursively scan each target directory for .gitignore files at every level. When checking if a file should be included, apply all relevant .gitignore rules from parent directories.

**Tech Stack:** Bun, TypeScript, ignore package

---

### Task 1: Update createFileFilter to support subdirectory scanning

**Files:**
- Modify: `src/lib/ignore.ts`

**Step 1: Write failing test**
```typescript
// Test: should load .gitignore from subdirectory
// (已创建 test-gitignore.ts)
```

**Step 2: Run test — confirm it fails**
Expected: ✅ FAIL — subdirectory .gitignore not loaded

**Step 3: Modify createFileFilter**
- Add recursive function to find all .gitignore files in target directory
- Return map of directory path -> ignore rules
- Update isIncluded to check parent directories' .gitignore

**Step 4: Run test — confirm it passes**
✅ **PASS** - 5/5 tests passed

**Step 5: Commit**
`git add src/lib/ignore.ts test-gitignore.ts && git commit -m "feat: support subdirectory .gitignore"`

---

### Task 2: Update isIncluded to check parent directories

**Files:**
- Modify: `src/lib/ignore.ts`

**Step 1: Write failing test**
```typescript
// Test: file in subdirectory should respect parent .gitignore
function test() {
  const target: BackupTarget = {
    name: "test",
    path: "/tmp/test-backup"
  };
  
  // /tmp/test-backup/.gitignore: "logs/"
  // /tmp/test-backup/subdir/file.txt should be ignored
  
  const filter = createFileFilter(target);
  expect(filter.isIncluded("/tmp/test-backup/subdir/file.txt")).toBe(false);
}
```

**Step 2: Run test — confirm it fails**
Expected: FAIL — parent .gitignore not applied

**Step 3: Update isIncluded logic**
- For each file, traverse from root to file's parent directory
- Collect all .gitignore rules along the path
- Apply rules in order (parent first, then child)

**Step 4: Run test — confirm it passes**
Expected: PASS

**Step 5: Commit**
`git add src/lib/ignore.ts && git commit -m "feat: apply parent .gitignore rules"`

---

### Task 3: Test with real .gitignore files

**Files:**
- Test: Manual verification

**Step 1: Create test directory structure**
```bash
mkdir -p /tmp/gitignore-test/project/src
echo "node_modules/" > /tmp/gitignore-test/.gitignore
echo "*.log" > /tmp/gitignore-test/project/.gitignore
touch /tmp/gitignore-test/project/src/main.js
touch /tmp/gitignore-test/node_modules/test.js
touch /tmp/gitignore-test/project/debug.log
```

**Step 2: Run backup with new template**
```bash
bun run src/index.ts run --template test
```

**Step 3: Verify excluded files**
Expected:
- node_modules/test.js — excluded (by root .gitignore)
- project/debug.log — excluded (by project/.gitignore)
- project/src/main.js — included

**Step 4: Commit**
`git add . && git commit -m "test: verify subdirectory gitignore support"`

---

## Execution

Plan saved to `docs/plans/2026-04-05-subdirectory-gitignore-support.md`.

Two execution options:

1. **Subagent-Driven** — I dispatch a fresh sub-agent per task, review between tasks
2. **Manual** — You run the tasks yourself

Which approach?
