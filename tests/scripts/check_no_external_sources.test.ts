/**
 * Golden-parity tests for `src/scripts/check_no_external_sources.ts`.
 *
 * Layer 1 — golden parity on the REAL repo: the TS twin and the Python
 * original (`check_no_external_sources.py`) produce byte-identical text AND
 * JSON reports and the same exit code. The tracked tree is currently clean, so
 * this also asserts the new TS twin introduces no denied tokens.
 *
 * Layer 2 — synthetic hit fixture: a tmp git repo carrying denied tokens (and
 * a skip_paths-covered file) is scanned by both runtimes; text + JSON output
 * and exit codes are asserted byte-identical, exercising the hit path, the
 * fnmatch skip, the `line.strip()[:160]` excerpt, and the regex-token field.
 *
 * Both layers skip when python3 is unavailable.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_external_sources.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_external_sources.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

// --- Layer 1: golden parity on the real repo -------------------------------

describe.skipIf(!py3)('check_no_external_sources — golden parity (real repo)', () => {
    it('text report is byte-identical and exit codes match', () => {
        const py = spawnSync('python3', [PY_SCRIPT], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], big(REPO_ROOT));
        expect(ts.stderr).toBe('');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.status).toBe(py.status);
    });

    it('json report is byte-identical and exit codes match', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--json'], big(REPO_ROOT));
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], big(REPO_ROOT));
        expect(ts.stderr).toBe('');
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.status).toBe(py.status);
    });

    it('tracked tree is clean (new twin introduces no denied tokens)', () => {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], big(REPO_ROOT));
        expect(ts.status).toBe(0);
    });
});

// --- Layer 2: synthetic hit fixture ----------------------------------------

describe.skipIf(!py3)('check_no_external_sources — golden parity (synthetic hits)', () => {
    let work: string;

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnes-')));
        fs.mkdirSync(path.join(work, 'src', 'scripts'), { recursive: true });
        // Minimal denylist with one word-boundary pattern + one slug + a skip glob.
        fs.writeFileSync(
            path.join(work, 'src', 'scripts', 'external_sources_denylist.json'),
            JSON.stringify({
                deny: ['\\bruflo\\b', 'obra/superpowers'],
                skip_paths: [
                    'src/scripts/external_sources_denylist.json',
                    'src/scripts/check_no_external_sources.py',
                    'src/scripts/check_no_external_sources.ts',
                    'skipme/*',
                ],
            }) + '\n',
            'utf-8',
        );
        // Tracked content: two hits (trailing whitespace exercises strip), one
        // clean line, plus a skip_paths-covered file that also carries a token.
        fs.writeFileSync(
            path.join(work, 'a.md'),
            'inspired by ruflo here  \nand obra/superpowers there\nclean line\n',
            'utf-8',
        );
        fs.mkdirSync(path.join(work, 'skipme'), { recursive: true });
        fs.writeFileSync(path.join(work, 'skipme', 'b.md'), 'ruflo should be skipped\n', 'utf-8');
        // Binary-extension skip: a denied token inside a .lock file must be ignored.
        fs.writeFileSync(path.join(work, 'c.lock'), 'ruflo in a lockfile\n', 'utf-8');
        // The scripts resolve ROOT from parents[2] of their own location, and
        // load the sibling denylist — so they must live under <work>/src/scripts.
        fs.copyFileSync(PY_SCRIPT, path.join(work, 'src', 'scripts', 'check_no_external_sources.py'));
        fs.copyFileSync(TS_SCRIPT, path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'));
        // git ls-files needs a repo with the files tracked.
        spawnSync('git', ['init', '-q'], big(work));
        spawnSync('git', ['add', '-A'], big(work));
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    const PY = (): ReturnType<typeof spawnSync> =>
        spawnSync('python3', [path.join(work, 'src', 'scripts', 'check_no_external_sources.py')], big(work));
    const TS = (flag?: string): ReturnType<typeof spawnSync> =>
        spawnSync(
            TSX_BIN,
            [path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'), ...(flag ? [flag] : [])],
            big(work),
        );

    it('text hit report is byte-identical, exit 1', () => {
        const py = PY();
        const ts = TS();
        expect(ts.stdout).toBe(py.stdout);
        expect(py.status).toBe(1);
        expect(ts.status).toBe(1);
        // Sanity: both flagged exactly the two non-skipped hits.
        expect((ts.stdout as string)).toContain('a.md:1');
        expect((ts.stdout as string)).toContain('a.md:2');
        expect((ts.stdout as string)).not.toContain('skipme');
        expect((ts.stdout as string)).not.toContain('c.lock');
    });

    it('json hit report is byte-identical, exit 1', () => {
        const py = spawnSync(
            'python3',
            [path.join(work, 'src', 'scripts', 'check_no_external_sources.py'), '--json'],
            big(work),
        );
        const ts = TS('--json');
        expect(ts.stdout).toBe(py.stdout);
        expect(py.status).toBe(1);
        expect(ts.status).toBe(1);
        const parsed = JSON.parse(ts.stdout as string) as { ok: boolean; hits: Array<Record<string, unknown>> };
        expect(parsed.ok).toBe(false);
        expect(parsed.hits).toHaveLength(2);
        // Trailing whitespace stripped in the excerpt (line.strip()[:160]).
        expect(parsed.hits[0]!.text).toBe('inspired by ruflo here');
        // Raw regex pattern preserved in the token field.
        expect(parsed.hits[0]!.token).toBe('\\bruflo\\b');
    });
});
