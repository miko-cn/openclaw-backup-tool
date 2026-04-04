// 测试子目录 .gitignore 支持
import { createFileFilter, createMultiTargetFilter } from "./src/lib/ignore.js";
import type { BackupTarget } from "./src/types.js";

const targetPath = "/tmp/gitignore-test";

const target: BackupTarget = {
  name: "test",
  path: targetPath,
};

const filter = createFileFilter(target);

// 测试用例
const tests = [
  // 根目录 .gitignore: node_modules/
  { path: `${targetPath}/node_modules/test.js`, expected: false, desc: "根目录 .gitignore: node_modules/" },
  
  // project/.gitignore: *.log
  { path: `${targetPath}/project/debug.log`, expected: false, desc: "project/.gitignore: *.log" },
  
  // project/src/.gitignore: debug/
  { path: `${targetPath}/project/src/debughelper.js`, expected: false, desc: "project/src/.gitignore: debug/" },
  
  // 应该包含的
  { path: `${targetPath}/project/src/main.js`, expected: true, desc: "main.js 应该包含" },
  { path: `${targetPath}/project/src/app.log`, expected: false, desc: "app.log 匹配 *.log" },
];

console.log("=== 子目录 .gitignore 支持测试 ===\n");

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = filter.isIncluded(test.path);
  const ok = result === test.expected;
  
  console.log(`${ok ? "✅" : "❌"} ${test.desc}`);
  console.log(`   Path: ${test.path}`);
  console.log(`   Expected: ${test.expected}, Got: ${result}`);
  console.log("");
  
  if (ok) {
    passed++;
  } else {
    failed++;
  }
}

console.log(`\n结果: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
