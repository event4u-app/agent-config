/**
 * CLI-contract tests for `src/scripts/check_no_external_sources.ts`.
 *
 * The tsx twin is the source of truth (the python original was deleted in the
 * teardown).
 *
 * Layer 1 — real repo: the twin runs deterministically (this suite proves the
 * twin runs, not the tree's content hygiene, which main's diff-scoped gate owns).
 *
 * Layer 2 — synthetic hit fixture: a tmp git repo carrying denied tokens (and a
 * skip_paths-covered file) is scanned; text + JSON output and exit codes are
 * asserted, exercising the hit path, the fnmatch skip, the `line.strip()[:160]`
 * excerpt, and the regex-token field.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_external_sources.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

// --- Layer 1: CLI contract on the real repo --------------------------------

describe('check_no_external_sources — CLI contract (real repo)', () => {
    it('text report runs deterministically', () => {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT], big(REPO_ROOT));
        const b = spawnSync(TSX_BIN, [TS_SCRIPT], big(REPO_ROOT));
        expect(a.status).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });

    it('json report runs deterministically', () => {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], big(REPO_ROOT));
        const b = spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], big(REPO_ROOT));
        expect(a.status).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });
});

// --- Layer 2: synthetic hit fixture ----------------------------------------

describe('check_no_external_sources — synthetic hits', () => {
    let work: string;

    // Assemble the denied tokens from fragments at runtime so the literal
    // tokens never appear in THIS test file's source — otherwise the
    // check-no-external-sources guard, which scans the whole tracked tree,
    // would flag this very file. The assembled strings are written into the
    // throwaway tmp fixture below and exercise the guard exactly as a real hit.
    const TOK1 = 'ruf' + 'lo'; // word-boundary denied token
    const TOK2 = 'obra' + '/' + 'superpowers'; // slug denied token

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnes-')));
        fs.mkdirSync(path.join(work, 'src', 'scripts'), { recursive: true });
        // Minimal denylist with one word-boundary pattern + one slug + a skip glob.
        fs.writeFileSync(
            path.join(work, 'src', 'scripts', 'external_sources_denylist.json'),
            JSON.stringify({
                deny: ['\\b' + TOK1 + '\\b', TOK2],
                skip_paths: [
                    'src/scripts/external_sources_denylist.json',
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
            `inspired by ${TOK1} here  \nand ${TOK2} there\nclean line\n`,
            'utf-8',
        );
        fs.mkdirSync(path.join(work, 'skipme'), { recursive: true });
        fs.writeFileSync(path.join(work, 'skipme', 'b.md'), `${TOK1} should be skipped\n`, 'utf-8');
        // Binary-extension skip: a denied token inside a .lock file must be ignored.
        fs.writeFileSync(path.join(work, 'c.lock'), `${TOK1} in a lockfile\n`, 'utf-8');
        // The script resolves ROOT from parents[2] of its own location, and
        // loads the sibling denylist — so it must live under <work>/src/scripts.
        fs.copyFileSync(TS_SCRIPT, path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'));
        // git ls-files needs a repo with the files tracked.
        spawnSync('git', ['init', '-q'], big(work));
        spawnSync('git', ['add', '-A'], big(work));
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    const TS = (flag?: string): ReturnType<typeof spawnSync> =>
        spawnSync(
            TSX_BIN,
            [path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'), ...(flag ? [flag] : [])],
            big(work),
        );

    it('text hit report → exit 1, flags the two non-skipped hits', () => {
        const ts = TS();
        expect(ts.status).toBe(1);
        expect(ts.stdout as string).toContain('a.md:1');
        expect(ts.stdout as string).toContain('a.md:2');
        expect(ts.stdout as string).not.toContain('skipme');
        expect(ts.stdout as string).not.toContain('c.lock');
    });

    it('json hit report → exit 1, two hits with stripped excerpt + regex token', () => {
        const ts = TS('--json');
        expect(ts.status).toBe(1);
        const parsed = JSON.parse(ts.stdout as string) as {
            ok: boolean;
            hits: Array<Record<string, unknown>>;
        };
        expect(parsed.ok).toBe(false);
        expect(parsed.hits).toHaveLength(2);
        // Trailing whitespace stripped in the excerpt (line.strip()[:160]).
        expect(parsed.hits[0]!.text).toBe(`inspired by ${TOK1} here`);
        // Raw regex pattern preserved in the token field.
        expect(parsed.hits[0]!.token).toBe('\\b' + TOK1 + '\\b');
    });
});
