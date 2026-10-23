// ─────────────────────────────────────────────────────────────
// A23 — اسکریپت build چندسکوتی (بدون cp/tee/انتساب env POSIX)
//   node scripts/build.mjs static  → خروجی GitHub Pages در out/
//   node scripts/build.mjs server  → خروجی standalone در .next/standalone
// ─────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'server' ? 'server' : 'static';

function run(args) {
  // باینری محلی next — مستقل از npm/bun و کراس‌پلتفرم
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), ...args], {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (mode === 'static') {
  process.env.BUILD_MODE = 'static';
  process.env.NEXT_PUBLIC_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/free-animation-maker';
  run(['build']);
  // خروجی export در out/ آماده است — .nojekyll برای سرو _next در Pages لازم است
  if (existsSync(path.join(root, 'out'))) {
    writeFileSync(path.join(root, 'out', '.nojekyll'), '');
    console.log('✓ static export ready in out/ (.nojekyll written)');
  } else {
    console.error('static export failed: out/ not found');
    process.exit(1);
  }
} else {
  process.env.BUILD_MODE = 'server';
  run(['build']);
  // کپی static ها به standalone — با fs.cpSync (کراس‌پلتفرم)
  if (existsSync(path.join(root, '.next', 'standalone'))) {
    if (existsSync(path.join(root, '.next', 'static'))) {
      cpSync(path.join(root, '.next', 'static'), path.join(root, '.next', 'standalone', '.next', 'static'), { recursive: true });
    }
    if (existsSync(path.join(root, 'public'))) {
      cpSync(path.join(root, 'public'), path.join(root, '.next', 'standalone', 'public'), { recursive: true });
    }
    console.log('✓ standalone build ready (.next/standalone)');
  }
}
