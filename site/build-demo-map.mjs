// Hosted demo map: draw `code-graph map --demo` (sample data, never a real
// repository — the page carries its "sample data" chip) and publish the map page
// plus the files it links to under public/demo-map/. Runs at prebuild.
//
// Needs the ROOT package's dependencies (tsx + the code-graph readers): run
// `npm ci` at the repository root before `npm --prefix site run build`.
//
// The hub (hub/, ~17 MB of per-project pages) is not published; the map page is
// self-contained apart from the data/*.md notes it links to. The published
// directory must stay under BUDGET_BYTES, or the build fails.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
export const OUT = path.join(HERE, 'public', 'demo-map');
export const BUDGET_BYTES = 6 * 1024 * 1024;

/** Relative file references in the page that exist in the map output directory. */
export function referencedFiles(html, dir) {
  const refs = new Set();
  for (const m of html.matchAll(/["'](?!https?:|\/\/|\/|#|data:|mailto:)([A-Za-z0-9_][A-Za-z0-9_./-]*\.[A-Za-z0-9]{1,8})["']/g)) {
    const rel = path.posix.normalize(m[1]);
    if (rel.startsWith('..')) continue;
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) refs.add(rel);
  }
  return [...refs].sort();
}

export function dirBytes(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirBytes(p) : fs.statSync(p).size;
  }
  return total;
}

function main() {
  if (process.env.SITE_SKIP_DEMO_MAP === '1') {
    console.log('demo-map: skipped (SITE_SKIP_DEMO_MAP=1)');
    return;
  }
  const tsx = path.join(REPO, 'node_modules', '.bin', 'tsx');
  if (!fs.existsSync(tsx)) {
    console.error('demo-map: root dependencies missing (no node_modules/.bin/tsx) — run `npm ci` at the repository root first');
    process.exitCode = 1;
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-demo-map-'));
  try {
    const draw = spawnSync(
      tsx,
      [path.join(REPO, 'src', 'scripts', 'code_graph', 'cli.ts'), 'map', '--demo', '--out', tmp, '--no-verify'],
      { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] },
    );
    if (draw.status !== 0) {
      console.error(`demo-map: code-graph map --demo exited ${draw.status}`);
      process.exitCode = 1;
      return;
    }
    const page = path.join(tmp, 'index.html');
    const html = fs.readFileSync(page, 'utf8');
    if (!html.includes('id="pin-demo"')) {
      console.error('demo-map: the drawn page lacks its "sample data" chip (#pin-demo) — refusing to publish it');
      process.exitCode = 1;
      return;
    }
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    const files = ['index.html', ...referencedFiles(html, tmp).filter((f) => f !== 'index.html')];
    for (const rel of files) {
      const to = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(tmp, rel), to);
    }
    const bytes = dirBytes(OUT);
    const mb = (b) => (b / 1024 / 1024).toFixed(2);
    if (bytes > BUDGET_BYTES) {
      console.error(`demo-map: ${mb(bytes)} MB exceeds the ${mb(BUDGET_BYTES)} MB budget`);
      fs.rmSync(OUT, { recursive: true, force: true });
      process.exitCode = 1;
      return;
    }
    console.log(`demo-map: wrote ${files.length} file(s) to public/demo-map/ — ${mb(bytes)} MB of ${mb(BUDGET_BYTES)} MB budget`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
