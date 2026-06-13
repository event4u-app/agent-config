// Tests for src/scripts/propose_modules_config.ts (py2ts Phase 8 / Wave 8g).
//
// No pytest suite existed — focused differential (python3 vs tsx, byte-exact)
// over the JSON envelope and the interactive TTY block, on a no-modules root,
// a crafted root with a real `app/Modules/<Module>` dir (exercises the
// candidate-detection path + suggested-block render), and the argparse error
// paths. Pure read-only scan; never writes. Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'propose_modules_config.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'propose_modules_config.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py = hasPython3();
const runPy = (args: string[]) =>
    spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
const runTs = (args: string[]) =>
    spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
});

function assertSame(args: string[]): void {
    const p = runPy(args);
    const t = runTs(args);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

describe.skipIf(!py)('propose_modules_config — golden parity (python3 vs tsx)', () => {
    it('json on the package root matches', () => {
        assertSame(['--project', REPO_ROOT, '--json']);
    });
    it('interactive on the package root matches', () => {
        assertSame(['--project', REPO_ROOT]);
    });
    it('json on a no-modules temp root matches', () => {
        assertSame(['--project', mkTmp(), '--json']);
    });
    it('interactive on a no-modules temp root matches', () => {
        assertSame(['--project', mkTmp()]);
    });

    it('json on a root with a laravel module dir matches', () => {
        const d = mkTmp();
        fs.mkdirSync(path.join(d, 'app', 'Modules', 'Billing'), { recursive: true });
        assertSame(['--project', d, '--json']);
    });
    it('interactive on a root with a laravel module dir matches', () => {
        const d = mkTmp();
        fs.mkdirSync(path.join(d, 'app', 'Modules', 'Billing'), { recursive: true });
        assertSame(['--project', d]);
    });

    it('bad flag exits 2 identically', () => {
        assertSame(['--bogus']);
    });
    it('unreachable project root exits 2 identically', () => {
        const missing = path.join(mkTmp(), 'does-not-exist');
        assertSame(['--project', missing]);
    });
});
