// Tests for src/scripts/knowledge_global_cli.ts — the global knowledge-card
// command surface (list / show / trace / forget / promote / validate /
// lead-check / purge).
//
// Golden-parity (ADR-200): python3 vs tsx on identical inputs in an isolated
// EVENT4U_CONFIG_HOME store + a tmp git repo (pinned slug). Byte-identical
// stdout / stderr / exit, with ISO dates and the resolved store path
// normalized inline. argparse usage-prose is exit-code-only.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'knowledge_global_cli.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'knowledge_global_cli.py');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

let repo: string;
let home: string;
beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'kgc-repo-'));
    home = mkdtempSync(join(tmpdir(), 'kgc-home-'));
    spawnSync('git', ['init', '-q'], { cwd: repo });
    spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/widget.git'], { cwd: repo });
});
afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
});

function env(): NodeJS.ProcessEnv {
    return { ...process.env, EVENT4U_CONFIG_HOME: home };
}

function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: repo, encoding: 'utf8', env: env() });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}
function runPy(args: readonly string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...env(), PYTHONPATH: join(REPO_ROOT, 'src') },
    });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Normalize ISO dates + the resolved store path for deterministic compares. */
function norm(s: string): string {
    return s.split(home).join('<HOME>').replace(/\d{4}-\d{2}-\d{2}/g, '<DATE>');
}

/** Run both impls on a freshly-reset store and assert byte-parity. */
function bothMatch(args: readonly string[]): void {
    if (!HAVE_PYTHON) {
        return;
    }
    rmSync(home, { recursive: true, force: true });
    const py = runPy(args);
    rmSync(home, { recursive: true, force: true });
    const ts = runTs(args);
    expect(norm(ts.stdout), `stdout ${args.join(' ')}`).toBe(norm(py.stdout));
    expect(norm(ts.stderr), `stderr ${args.join(' ')}`).toBe(norm(py.stderr));
    expect(ts.status, `exit ${args.join(' ')}`).toBe(py.status);
}

function writeCard(name: string, body: string): string {
    const p = join(repo, name);
    writeFileSync(p, body, 'utf-8');
    return p;
}

describe('knowledge_global_cli.ts — empty-store subcommands', () => {
    it('list (empty)', () => {
        const ts = runTs(['list']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('No global cards');
        bothMatch(['list']);
    });

    it('list --json (empty)', () => {
        expect(runTs(['list', '--json']).status).toBe(0);
        bothMatch(['list', '--json']);
    });

    it('show missing → exit 1', () => {
        const ts = runTs(['show', 'nope']);
        expect(ts.status).toBe(1);
        bothMatch(['show', 'nope']);
    });

    it('trace missing → exit 0, no record', () => {
        expect(runTs(['trace', 'nope']).status).toBe(0);
        bothMatch(['trace', 'nope']);
        bothMatch(['trace', 'nope', '--json']);
    });

    it('forget missing → exit 1', () => {
        expect(runTs(['forget', 'nope']).status).toBe(1);
        bothMatch(['forget', 'nope']);
    });

    it('forget with no card / no tier → exit 1', () => {
        expect(runTs(['forget']).status).toBe(1);
        bothMatch(['forget']);
    });
});

describe('knowledge_global_cli.ts — promote flow', () => {
    it('clean public card promotes (exit 0) and writes card + sidecar', () => {
        writeCard('card.md', '---\ntier: public\n---\n# Stripe webhook structure\nThe events endpoint.\n');
        const ts = runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
        expect(ts.status, ts.stdout + ts.stderr).toBe(0);
        expect(ts.stdout).toContain("Promoted 'card' (tier=public)");
        bothMatch(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
    });

    it('promoted card then list / trace surfaces it', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
        const list = runTs(['list']);
        expect(list.stdout).toContain('card');
        const trace = runTs(['trace', 'card']);
        expect(trace.stdout).toContain('widget');
        if (HAVE_PYTHON) {
            // Re-run promote on a fresh store for each impl, then compare list.
            rmSync(home, { recursive: true, force: true });
            runPy(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
            const pyList = runPy(['list']);
            rmSync(home, { recursive: true, force: true });
            runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
            const tsList = runTs(['list']);
            expect(norm(tsList.stdout)).toBe(norm(pyList.stdout));
        }
    });

    it('proprietary card without --manual → blocked exit 2', () => {
        writeCard('prop.md', 'in-house schema notes\n');
        const ts = runTs(['promote', 'prop.md', '--tier', 'proprietary']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('proprietary');
        bothMatch(['promote', 'prop.md', '--tier', 'proprietary']);
    });

    it('proprietary clean card WITH --manual → promotes (exit 0)', () => {
        writeCard('prop.md', 'in-house schema notes\n');
        const ts = runTs(['promote', 'prop.md', '--tier', 'proprietary', '--manual']);
        expect(ts.status, ts.stdout + ts.stderr).toBe(0);
        bothMatch(['promote', 'prop.md', '--tier', 'proprietary', '--manual']);
    });

    it('public card with email → redaction halt, exit 2', () => {
        writeCard('leak.md', '---\ntier: public\n---\nContact alice@example.com\n');
        const ts = runTs(['promote', 'leak.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
        expect(ts.status).toBe(2);
        bothMatch(['promote', 'leak.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
    });

    it('missing source file → exit 3', () => {
        const ts = runTs(['promote', 'does-not-exist.md', '--tier', 'public']);
        expect(ts.status).toBe(3);
        if (HAVE_PYTHON) {
            // Exit-code parity; the OSError strerror text is platform-normalized.
            expect(ts.status).toBe(runPy(['promote', 'does-not-exist.md', '--tier', 'public']).status);
        }
    });
});

describe('knowledge_global_cli.ts — purge', () => {
    it('purge without --confirm → refuse exit 1', () => {
        const ts = runTs(['purge']);
        expect(ts.status).toBe(1);
        bothMatch(['purge']);
    });

    it('purge --confirm on empty tree → exit 0', () => {
        const ts = runTs(['purge', '--confirm']);
        expect(ts.status).toBe(0);
        bothMatch(['purge', '--confirm']);
    });
});

describe('knowledge_global_cli.ts — lead-check', () => {
    it('missing report → exit 0', () => {
        const ts = runTs(['lead-check', '--report', 'nope.md']);
        expect(ts.status).toBe(0);
        bothMatch(['lead-check', '--report', 'nope.md']);
    });

    it('report with clean GLOBAL leads (all verified) → exit 0', () => {
        mkdirSync(join(repo, 'rep'), { recursive: true });
        const rp = join('rep', 'evidence.md');
        writeCard(
            rp,
            [
                '## Verified',
                '- field `x` source=https://api/v1 origin=local',
                '## Assumed',
                '- field `y` source=https://api/v1 origin=global',
                '',
            ].join('\n'),
        );
        const ts = runTs(['lead-check', '--report', rp]);
        expect(ts.status).toBe(0);
        bothMatch(['lead-check', '--report', rp]);
    });

    it('report with unconfirmed GLOBAL lead + --strict → exit 1', () => {
        const rp = 'ev.md';
        writeCard(
            rp,
            [
                '## Verified',
                '- nothing here',
                '## Assumed',
                '- field thing `z` source=https://other origin=global',
                '',
            ].join('\n'),
        );
        const ts = runTs(['lead-check', '--report', rp, '--strict']);
        expect(ts.status).toBe(1);
        bothMatch(['lead-check', '--report', rp, '--strict']);
        // Non-strict downgrades to a warning (exit 0).
        bothMatch(['lead-check', '--report', rp]);
    });
});

describe('knowledge_global_cli.ts — usage', () => {
    it('no subcommand → exit 2 (required subparser)', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy([]).status);
        }
    });

    it('unknown subcommand → exit 2', () => {
        const ts = runTs(['bogus']);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy(['bogus']).status);
        }
    });

    it('forget --tier invalid choice → exit 2', () => {
        const ts = runTs(['forget', '--tier', 'bogus']);
        expect(ts.status).toBe(2);
        if (HAVE_PYTHON) {
            expect(ts.status).toBe(runPy(['forget', '--tier', 'bogus']).status);
        }
    });
});

// NOTE — kill-switch (knowledge.global_sharing.enabled: false) parity is NOT
// covered here. It depends on the shared `agent_settings.ts` twin reading
// `.agent-settings.yml` at runtime, whose `_read_yaml` uses a bare
// `require('yaml')` that is undefined under a proper ESM tsx entry point — so
// the TS side silently degrades settings to `{}` (defaults ON) while the
// Python side reads the file. That divergence is owned by `agent_settings.ts`
// (out of scope for this port), not by these four twins. The default-ON path
// (no settings file) is exercised by every subcommand test above.
