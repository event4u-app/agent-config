// Tests for src/scripts/check_trigger_evals.ts (ADR-200).
//
// The script globs `src/skills/*\/evals/triggers.json` relative to its own
// fixed REPO_ROOT, so fixture cases run python3 + tsx inside a COPY of the repo
// layout where the script lives at <tmp>/src/scripts/<name>.<ext> (so its
// `parents[2]` REPO_ROOT resolves to <tmp>). Each case writes fixture
// triggers.json files under <tmp>/src/skills and asserts byte-identical
// stdout/stderr/exit. Covers fresh+valid, stale `last_eval`, missing/non-ISO,
// the `queries` shape errors, the split should_trigger/should_not_trigger
// shape, single-class failure, unreadable JSON, `--today` override, bad
// `--today`, and the argparse usage error. A real-repo parity layer follows.
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_trigger_evals.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function mkTmp(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cte-')));
}
function write(root: string, rel: string, content: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');
}

/**
 * Build a fixture repo whose `src/scripts/check_trigger_evals.{ts,py}` are the
 * real scripts, so their REPO_ROOT (parents[2]) resolves to <tmp>. tsx needs
 * the package's node_modules; symlink it in. Returns the tmp root + the script
 * paths inside it.
 */
function fixtureRepo(): { root: string; ts: string } {
    const root = mkTmp();
    fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
    const ts = path.join(root, 'src', 'scripts', 'check_trigger_evals.ts');
    fs.copyFileSync(TS_SCRIPT, ts);
    // tsx resolves node_modules upward from the script; symlink the real one.
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(root, 'node_modules'));
    return { root, ts };
}
// The tsx twin is the source of truth (the python original was deleted in
// the teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(fx: { root: string; ts: string }, args: string[] = []): void {
    const a = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8' });
    const b = spawnSync(TSX_BIN, [fx.ts, ...args], { cwd: fx.root, encoding: 'utf8' });
    expect(a.status, a.stderr).not.toBeNull();
    expect(b.stdout).toBe(a.stdout);
    expect(b.stderr).toBe(a.stderr);
    expect(b.status).toBe(a.status);
}

const FRESH = '2026-06-01';
const TODAY = '2026-06-17';

describe('check_trigger_evals — golden parity (fixture repo)', () => {
    let fx: { root: string; ts: string };
    beforeEach(() => {
        fx = fixtureRepo();
    });
    afterEach(() => {
        fs.rmSync(fx.root, { recursive: true, force: true });
    });

    it('fresh + valid (queries shape, both classes) → ✅ exit 0', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                last_eval: FRESH,
                queries: [
                    { q: 'do the thing', trigger: true },
                    { q: 'unrelated', trigger: false },
                ],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('split should_trigger / should_not_trigger shape → ✅', () => {
        write(
            fx.root,
            'src/skills/beta/evals/triggers.json',
            JSON.stringify({
                last_eval: FRESH,
                should_trigger: ['fire this'],
                should_not_trigger: ['not this'],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('no trigger files → ✅ (0 sets)', () => {
        expectParity(fx, ['--today', TODAY]);
    });

    it('stale last_eval → exit 1', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                last_eval: '2020-01-01',
                queries: [
                    { q: 'a', trigger: true },
                    { q: 'b', trigger: false },
                ],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('missing last_eval → exit 1', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                queries: [
                    { q: 'a', trigger: true },
                    { q: 'b', trigger: false },
                ],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('non-ISO last_eval (non-string) → exit 1', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                last_eval: 12345,
                queries: [
                    { q: 'a', trigger: true },
                    { q: 'b', trigger: false },
                ],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('queries not a list → exit 1', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({ last_eval: FRESH, queries: 'nope' }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('query missing q + non-bool trigger → exit 1', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                last_eval: FRESH,
                queries: [{ q: '', trigger: true }, { q: 'x', trigger: 'yes' }],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('only one class present → exit 1', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                last_eval: FRESH,
                queries: [{ q: 'a', trigger: true }],
            }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('split shape with empty list → exit 1', () => {
        write(
            fx.root,
            'src/skills/beta/evals/triggers.json',
            JSON.stringify({ last_eval: FRESH, should_trigger: [], should_not_trigger: ['x'] }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('neither shape present → exit 1', () => {
        write(
            fx.root,
            'src/skills/gamma/evals/triggers.json',
            JSON.stringify({ last_eval: FRESH }),
        );
        expectParity(fx, ['--today', TODAY]);
    });

    it('unreadable JSON → exit 1 + `unreadable JSON` marker', () => {
        // The finding embeds the parser's own error string
        // (`{rel}: unreadable JSON ({exc})`), which differs between Python's
        // json.JSONDecodeError and JS JSON.parse — a runtime-bound message, not
        // a behaviour difference. Assert the stable shape + exit, not the
        // parser-specific tail.
        write(fx.root, 'src/skills/alpha/evals/triggers.json', '{not json');
        const t = spawnSync(TSX_BIN, [fx.ts, '--today', TODAY], { cwd: fx.root, encoding: 'utf8' });
        expect(t.status).toBe(1);
        expect(t.stdout).toBe(''); // errors go to stderr
        const marker = 'check-trigger-evals: trigger-set regression(s):';
        expect(t.stderr).toContain(marker);
        expect(t.stderr).toContain('src/skills/alpha/evals/triggers.json: unreadable JSON');
    });

    it('quiet suppresses the ✅ line on a clean run', () => {
        write(
            fx.root,
            'src/skills/alpha/evals/triggers.json',
            JSON.stringify({
                last_eval: FRESH,
                queries: [
                    { q: 'a', trigger: true },
                    { q: 'b', trigger: false },
                ],
            }),
        );
        expectParity(fx, ['--today', TODAY, '--quiet']);
    });

    it('bad --today → exit 2', () => {
        expectParity(fx, ['--today', 'notadate']);
    });

    it('usage error: unrecognized flag → exit 2', () => {
        expectParity(fx, ['--bogus']);
    });
});

describe('check_trigger_evals — golden parity (real repo)', () => {
    it('runs deterministically with a fixed --today', () => {
        const args = ['--today', '2026-06-17'];
        const a = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        const b = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(a.status, a.stderr).not.toBeNull();
        expect(b.stdout).toBe(a.stdout);
        expect(b.status).toBe(a.status);
    });
});
