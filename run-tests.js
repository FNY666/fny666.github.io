// 仓库自带测试跑手：依次执行所有 *.test.js（node）和 *.test.py（python3）。
// 用法：node run-tests.js   或   npm test
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = fs.readdirSync(root).filter((f) => /\.test\.(js|py)$/.test(f)).sort();
let failed = 0;

for (const file of files) {
  const isPython = file.endsWith('.py');
  const cmd = isPython ? (process.env.PYTHON || 'python3') : process.execPath;
  const started = Date.now();
  const result = spawnSync(cmd, [path.join(root, file)], {encoding: 'utf8'});
  const ms = Date.now() - started;
  if (result.status === 0) {
    const last = (result.stdout || '').trim().split('\n').pop();
    console.log(`PASS  ${file.padEnd(50)} ${ms}ms  ${last}`);
  } else {
    failed++;
    console.log(`FAIL  ${file.padEnd(50)} ${ms}ms  exit=${result.status}`);
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
  }
}

console.log(`\n${files.length - failed}/${files.length} passed`);
process.exit(failed ? 1 : 0);
