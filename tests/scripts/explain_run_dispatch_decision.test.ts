// Tests for the dispatch-decision trace of src/scripts/explain_run.ts
// (road-to-feedback-9-29.md, Phase 4.1 — orchestration explain trace).
//
// Council requirement: all three branches are invoked THROUGH the CLI
// dispatcher path (`./scripts-run src/scripts/explain_run …` → parseArgs →
// buildReport), never by calling `explainLadder` / `buildReport` directly —
// so the flag parsing, the ladder wiring, and the telemetry join are all on
// the exercised path. Every fixture path is injected, so no test touches the
// real repo's dist/router.json, engagement log, audit dir, or hygiene state,
// and nothing tracked is written.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explain-run-decision-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function p(...segments: string[]): string {
    return path.join(tmp, ...segments);
}

/** Run explain_run through the CLI dispatcher path; capture exit + stdout. */
function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('./scripts-run', ['src/scripts/explain_run', ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { code: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { code: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

/** Every fixture path injected so the report never reads repo state. */
function isolationArgs(): string[] {
    return [
        '--router', p('router.json'),
        '--audit-dir', p('audit'),
        '--engagement', p('engagement.jsonl'),
        '--hygiene', p('hygiene.json'),
    ];
}

function writeTelemetryLine(): void {
    fs.mkdirSync(p('audit'), { recursive: true });
    fs.writeFileSync(
        p('audit', '2026-08.jsonl'),
        `${JSON.stringify({
            ts: '2026-08-01T00:05:00Z',
            work_id: 'TASK-9-run',
            orchestration: {
                spawn_count: 2,
                dispatch_mode: 'do-in-parallel',
                tiers: ['lite', 'lite'],
                token_delta: -3400,
                token_delta_provenance: 'measured',
            },
        })}\n`,
        'utf8',
    );
}

describe('explain_run --decision — through the CLI dispatcher path', () => {
    it('(a) successful dispatch decision → rung taken + rejected-rungs trail rendered', () => {
        writeTelemetryLine();
        const r = runCli([
            '--decision', 'review these five modules for dead code',
            '--size-estimate', '3',
            '--slices', '2',
            ...isolationArgs(),
        ]);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('## Dispatch decision (judgment ladder)');
        expect(r.stdout).toContain('Resolved: rung 2 — verdict `subagent` (mode do-in-parallel) — independent slices (2)');
        // Rejected rungs carry the detectors' own reasons (why-not-council /
        // why-not-team / why-not-script), in the resolver's priority order.
        expect(r.stdout).toContain('| 4 | council | rejected | no contested-judgment signal |');
        expect(r.stdout).toContain('| 3 | team | rejected | no communication-need signal |');
        expect(r.stdout).toMatch(/\| 0 \| script \| rejected \| not lookup-shaped[^|]*no mechanical-transform signal \|/);
        expect(r.stdout).toContain('| 2 | subagent | taken | independent slices (2) |');
        // A rung the short-circuit never consulted is not given a fabricated rejection.
        expect(r.stdout).toContain('| 1 | subagent | not-reached | not evaluated — resolved at rung 2 |');
        // Telemetry record exists → the estimate comes from it, honestly attributed.
        expect(r.stdout).toContain('token_delta -3400 (measured), mode do-in-parallel, tiers lite,lite');
        expect(r.stdout).not.toContain('no telemetry record');
    });

    it('(b) all-rungs-rejected / in-session verdict → explain shows why-no-spawn', () => {
        const r = runCli(['--decision', 'polish the introduction wording', ...isolationArgs()]);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Resolved: rung ∅ (never spawns) — verdict `in-session`');
        expect(r.stdout).toContain('Why no spawn: task below size floor (0 <= 1)');
        // Every rung was genuinely evaluated and rejected — none taken, none
        // skipped. 0.5 is included: below the floor the resolver DOES consult it,
        // so a `not-reached` row for it here would be the same fabrication in
        // reverse.
        for (const rung of ['0', '4', '3', '2', '0\\.5', '1']) {
            expect(r.stdout).toMatch(new RegExp(`\\| ${rung} \\| \\S+ \\| rejected \\|`));
        }
        expect(r.stdout).not.toContain('| taken |');
    });

    it('(d) a rung the communication branch skipped is not-reached, never rejected with its detector\'s match', () => {
        // `detectCommunicationNeed` matches and the host has no agent_teams, so
        // `classifyLadder` returns from inside rung 3's handling — rung 1's
        // detector is never called. It DOES match this text ("review the diff"),
        // so a `rejected` row here would quote a match as a rejection and hide
        // the real blocker (the missing capability).
        const r = runCli([
            '--decision', 'This is cross-layer work; please review the diff carefully.',
            '--size-estimate', '5',
            ...isolationArgs(),
        ]);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('| 1 | subagent | not-reached |');
        expect(r.stdout).toContain('the rung-3 communication branch resolved before it was consulted');
        // The regression this pins: the old trail said `rejected` and quoted the
        // matching detector's own words.
        expect(r.stdout).not.toMatch(/\| 1 \| subagent \| rejected \|.*one lite-tier subagent/);
    });

    it('(e) the telemetry line never claims to match this decision, and --decision needs a value', () => {
        const r = runCli([
            '--decision', 'review these five modules for dead code',
            '--size-estimate', '3',
            '--slices', '2',
            ...isolationArgs(),
        ]);
        expect(r.code).toBe(0);
        // The record shape has no decision key, so correspondence may not be claimed.
        expect(r.stdout).not.toContain('most recent matching telemetry record');

        const missing = runCli(['--decision']);
        expect(missing.code).toBe(2);
        expect(missing.stderr).toContain('--decision requires a value');
    });

    it('(f) rung 0.5 appears where the resolver checks it — taken below the floor, not-reached above', () => {
        // The bounded-question rung landed on main while this trail was being
        // built (road-to-token-economy-dispatch Phase 4). It lives INSIDE the
        // size-floor branch, so the trail must show it between rung 2 and rung 1
        // rather than where its number would sort — and above the floor the
        // resolver never enters that branch, so it is not-reached, not declined.
        const below = runCli([
            '--decision', 'What is the difference between a rule and a skill?',
            ...isolationArgs(),
        ]);
        expect(below.code).toBe(0);
        expect(below.stdout).toContain('| 0.5 | ask | taken |');

        // Above the floor with no multi-slice shape: rung 2 declines on signals,
        // so the walk reaches the branch rung 0.5 does NOT live in.
        const above = runCli(['--decision', 'summarize this module', '--size-estimate', '3', ...isolationArgs()]);
        expect(above.code).toBe(0);
        expect(above.stdout).toContain('| 0.5 | ask | not-reached |');
        expect(above.stdout).toContain('rung 0.5 is reachable only below it');
    });

    it('(c) missing telemetry record → honest no-record line, never a fabricated estimate', () => {
        // Same dispatch decision as (a), but the audit dir does not exist.
        const r = runCli([
            '--decision', 'review these five modules for dead code',
            '--size-estimate', '3',
            '--slices', '2',
            ...isolationArgs(),
        ]);
        expect(r.code).toBe(0);
        expect(r.stdout).toContain('Resolved: rung 2 — verdict `subagent`');
        expect(r.stdout).toMatch(/no telemetry record — .* absent; no token\/cost estimate/);
        expect(r.stdout).not.toContain('from the most recent matching telemetry record');
    });
});
