// Intent tests for work_engine/cli.ts (ADR-096 py2ts Phase 1 — work_engine
// TOP/integration layer).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. `cli.ts::main` is the work-engine
// entry point (argparse). It is driven via a tiny runner `.ts` written into a
// per-test temp CWD (so trailing argv is forwarded verbatim) and the
// (exit code, stdout, persisted-state-file bytes) are asserted. Hooks are
// disabled (`--no-hooks`) so the transport surface stays stable independent of
// any settings file. COLUMNS=200 forces single-line usage so argparse stderr
// does not re-wrap to terminal width. norm() masks the volatile tmp CWD so the
// argparse `prog` token (derived from argv[1]/the runner path) is deterministic.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const CLI_TS = path.join(SCRIPTS_ROOT, 'work_engine', 'cli.ts');
const TSX_BIN = process.env['TSX_BIN'] ?? path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface Run {
    status: number;
    stdout: string;
    stderr: string;
}

/**
 * Run the TS CLI (via tsx) in `cwd` with `argv`.
 *
 * A tiny runner `.ts` file is written into `cwd` and invoked with the argv
 * directly — which forwards `--help` and friends verbatim into
 * `process.argv.slice(2)`. The runner is `_`-prefixed and lives only inside the
 * per-test temp dir, so it never pollutes the state-file comparison.
 */
function runTs(cwd: string, argv: string[]): Run {
    const runner = path.join(cwd, '_cli_runner.ts');
    const code = [
        `import { main } from ${JSON.stringify(CLI_TS)};`,
        'const rc = main(process.argv.slice(2));',
        'process.exitCode = rc;',
        '',
    ].join('\n');
    fs.writeFileSync(runner, code, 'utf-8');
    try {
        const r = spawnSync('node', [TSX_BIN, runner, ...argv], {
            encoding: 'utf8',
            cwd,
            env: { ...process.env, COLUMNS: '200' },
        });
        return { status: r.status ?? 0, stdout: r.stdout, stderr: r.stderr };
    } finally {
        fs.rmSync(runner, { force: true });
    }
}

let tmpTs: string;
beforeEach(() => {
    tmpTs = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-ts-'));
});
afterEach(() => {
    fs.rmSync(tmpTs, { recursive: true, force: true });
});

/** Mask the volatile per-test tmp CWD so snapshots stay deterministic. */
function norm(r: Run): Run {
    const mask = (s: string): string => s.split(tmpTs).join('<CWD>').replace(/_cli_runner\.ts/g, '<runner>');
    return { status: r.status, stdout: mask(r.stdout), stderr: mask(r.stderr) };
}

function seedTicket(filename: string, payload: unknown): void {
    fs.writeFileSync(path.join(tmpTs, filename), JSON.stringify(payload), 'utf-8');
}

function readStateMaybe(dir: string, name = '.work-state.json'): string | null {
    const p = path.join(dir, name);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

describe('cli main — transport contract', () => {
    it('fresh ticket run halts BLOCKED at refine (exit 1) — stable stdout + state', () => {
        // A ticket with a trivial title trips the refine deficiency gate →
        // BLOCKED at the first step. Deterministic, no agent directive needed.
        seedTicket('ticket.json', { id: 'T-1', title: 'x' });
        const r = norm(runTs(tmpTs, ['--no-hooks', '--ticket-file', 'ticket.json']));
        expect(r.status).toBe(1);
        expect(r.stdout).toMatchInlineSnapshot(`
          "[halt] outcome=blocked step=refine
          > Ticket T-1 is missing: missing or trivial title; no acceptance criteria.
          > 1. Run \`/refine-ticket T-1\` and re-invoke \`/implement-ticket\`
          > 2. Provide the missing details in chat — I'll merge them into the ticket
          > 3. Abandon this ticket — too vague to implement
          "
        `);
        // A state file is persisted on the BLOCKED path (v0 wire format).
        expect(readStateMaybe(tmpTs)).not.toBeNull();
    });

    it('missing input (no state file, no flags) → exit 2 + error on stderr', () => {
        const r = norm(runTs(tmpTs, ['--no-hooks']));
        expect(r.status).toBe(2);
        expect(r.stderr).toMatchInlineSnapshot(`
          "error: No state file at .work-state.json and no --ticket-file, --prompt-file, --diff-file, or --file-file given; cannot build an initial state.
          "
        `);
        // No state file written on the error path.
        expect(readStateMaybe(tmpTs)).toBeNull();
    });

    it('non-object ticket file → exit 2 + error text', () => {
        seedTicket('bad.json', [1, 2, 3]);
        const r = norm(runTs(tmpTs, ['--no-hooks', '--ticket-file', 'bad.json']));
        expect(r.status).toBe(2);
        expect(r.stderr).toMatchInlineSnapshot(`
          "error: --ticket-file must carry a JSON object; got list.
          "
        `);
    });

    it('resumes a v1 state file to SUCCESS (exit 0) — stored report + state', () => {
        // Pre-seed a v1 state file with every step already marked success so the
        // dispatcher walks straight to SUCCESS and prints the stored report.
        const v1 = {
            version: 1,
            input: { kind: 'ticket', data: { id: 'T-9', title: 'Resume me' } },
            intent: 'backend-coding',
            directive_set: 'backend',
            stack: null,
            ui_audit: null,
            ui_design: null,
            ui_review: null,
            ui_polish: null,
            contract: null,
            stitch: null,
            halts: [],
            persona: 'senior-engineer',
            memory: [],
            plan: null,
            changes: [],
            tests: null,
            verify: null,
            outcomes: {
                refine: 'success',
                memory: 'success',
                analyze: 'success',
                plan: 'success',
                implement: 'success',
                test: 'success',
                verify: 'success',
                report: 'success',
            },
            questions: [],
            report: 'DELIVERY REPORT BODY',
        };
        fs.writeFileSync(path.join(tmpTs, '.work-state.json'), JSON.stringify(v1, null, 2) + '\n', 'utf-8');
        const r = norm(runTs(tmpTs, ['--no-hooks']));
        expect(r.status).toBe(0);
        expect(r.stdout).toMatchInlineSnapshot(`
          "DELIVERY REPORT BODY
          "
        `);
        expect(readStateMaybe(tmpTs)).not.toBeNull();
    });
});

describe('cli main — argparse exit codes', () => {
    it('--help exits 0 with a usage banner', () => {
        const r = norm(runTs(tmpTs, ['--help']));
        expect(r.status).toBe(0);
        expect(r.stdout.startsWith('usage:')).toBe(true);
    });

    it('unrecognized flag exits 2', () => {
        const r = norm(runTs(tmpTs, ['--no-such-flag']));
        expect(r.status).toBe(2);
    });
});
