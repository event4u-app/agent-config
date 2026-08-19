/**
 * headless_invocation — the resume command, and the fact that nothing runs it.
 *
 * Two properties carry this module, and both are asserted rather than
 * described in a comment:
 *
 *   1. **There is no spawn.** The whole reason Phase 4.0 shipped a guard and
 *      not a spawner is that an unattended money-spending process is the part
 *      nobody validated. A source assertion is the only check that survives a
 *      later edit adding one "just for testing".
 *   2. **The human command and the unattended verdict are separate fields.**
 *      Conflating them is the live defect this seam is written against: an
 *      operator who reads "budget refused" as "I may not run this" has been
 *      told the opposite of the truth — the budget governs an automated lane,
 *      and there is no automated lane.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { HOST_INVENTORY } from '../../src/cli/python/workspace_hosts.js';
import {
    CHECKPOINT_DIR_REL,
    LIVE_SPAWN_REFUSAL,
    PLATFORM_TO_HOST,
    buildResumeArgv,
    planResume,
    promptOnStdin,
    renderResumePlans,
    resumePrompt,
    type ResumeTarget,
} from '../../src/scripts/_lib/headless_invocation.js';
import { BUDGET_REL } from '../../src/scripts/_lib/unattended_guard.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULE_SRC = path.resolve(HERE, '../../src/scripts/_lib/headless_invocation.ts');

const dirs: string[] = [];
afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function root(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'headless-inv-'));
    dirs.push(d);
    return d;
}

/** A real repository with NO remotes — the only shape the guard reads as safe. */
function gitRepo(): string {
    const d = root();
    spawnSync('git', ['init', '-q'], { cwd: d, encoding: 'utf-8' });
    return d;
}

function target(over: Partial<ResumeTarget> = {}): ResumeTarget {
    return {
        roadmapSlug: 'road-to-x',
        worktree: '/tmp/wt',
        platform: 'claude',
        head: 'abc1234',
        ...over,
    };
}

const NOW = new Date('2026-08-19T12:00:00.000Z');

describe('the module cannot start a process', () => {
    it('contains no spawn, exec or fork of any kind', () => {
        const src = fs.readFileSync(MODULE_SRC, 'utf-8');
        // Deliberately matches the IMPORT and the CALL shapes both: a module
        // that cannot reach child_process cannot grow a spawn by accident, and
        // the assertion has to fail on the import that would enable one.
        for (const forbidden of ['child_process', 'spawnSync(', 'spawn(', 'execSync(', 'execFile', 'fork(']) {
            expect(src.includes(forbidden), `forbidden construct: ${forbidden}`).toBe(false);
        }
    });

    it('the refusal names a DECISION and a reopen condition, never a pending build', () => {
        // The wording is the whole point. "not implemented yet" is what makes
        // an operator wait for a release nobody is preparing — D-5's shape.
        expect(LIVE_SPAWN_REFUSAL).toContain('published refusal');
        expect(LIVE_SPAWN_REFUSAL).toContain('--print-relaunch');
        expect(LIVE_SPAWN_REFUSAL).toContain(CHECKPOINT_DIR_REL.replaceAll(path.sep, '/'));
        expect(LIVE_SPAWN_REFUSAL).not.toContain('not implemented');
        expect(LIVE_SPAWN_REFUSAL).not.toContain('not built');
    });
});

describe('platform → host mapping', () => {
    it('maps the register vocabulary onto the inventory vocabulary', () => {
        // The live register writes `"platform": "claude"`; HOST_INVENTORY keys
        // the same host `claude-code`. A reader that assumed one vocabulary
        // would silently build no command for every real session.
        expect(PLATFORM_TO_HOST['claude']).toBe('claude-code');
        expect(HOST_INVENTORY['claude']).toBeUndefined();
    });

    it('every mapped host exists in the inventory and is Tier 1', () => {
        for (const [platform, hostId] of Object.entries(PLATFORM_TO_HOST)) {
            const entry = HOST_INVENTORY[hostId];
            expect(entry, `${platform} → ${hostId} missing from HOST_INVENTORY`).toBeDefined();
            expect(entry?.tier, `${hostId} is not Tier 1`).toBe(1);
            expect(entry?.cli, `${hostId} has no CLI`).not.toBeNull();
        }
    });

    it('an unknown platform yields no command rather than a guessed binary', () => {
        expect(buildResumeArgv('windsurf', 'road-to-x')).toBeNull();
        expect(buildResumeArgv('', 'road-to-x')).toBeNull();
        expect(buildResumeArgv('CLAUDE', 'road-to-x')).toBeNull();
    });

    it('a Tier-3 host in the inventory is refused even though the inventory knows it', () => {
        // augment IS in HOST_INVENTORY — with `cli: null`. Reaching the entry
        // is not the same as being drivable, and the tier is what decides.
        expect(HOST_INVENTORY['augment']).toBeDefined();
        expect(buildResumeArgv('augment', 'road-to-x')).toBeNull();
    });
});

describe('buildResumeArgv', () => {
    it('claude takes the prompt in argv, per the host-agent-protocol contract', () => {
        const argv = buildResumeArgv('claude', 'road-to-x');
        expect(argv).toEqual(['claude', '-p', resumePrompt('road-to-x'), '--output-format', 'json']);
        expect(promptOnStdin('claude')).toBe(false);
    });

    it('codex and gemini take the prompt on stdin, so it is NOT in argv', () => {
        const codex = buildResumeArgv('codex', 'road-to-x');
        expect(codex).toEqual(['codex', 'exec', '--json']);
        expect(codex?.join(' ')).not.toContain('road-to-x');
        expect(promptOnStdin('codex')).toBe(true);
        expect(promptOnStdin('gemini')).toBe(true);
    });

    it('the prompt orders re-verification BEFORE acting on the checkpoint', () => {
        // The one instruction that makes a resume safe: resume by evidence,
        // never by bookkeeping (roadmap-process-loop § 5d).
        const p = resumePrompt('road-to-x');
        expect(p).toContain('verify');
        expect(p).toContain('latestCheckpointFor');
        expect(p).toContain('/roadmap:process-full road-to-x');
    });
});

describe('planResume — the human command and the unattended verdict are separate', () => {
    it('builds a pasteable command while the unattended lane refuses the same run', () => {
        const r = root();
        const plan = planResume(r, target(), NOW);

        expect(plan.command).toContain('cd /tmp/wt');
        expect(plan.command).toContain('claude -p');
        expect(plan.hostRefusal).toBeNull();

        // No budget file → both ceilings 0 → the lane is DISABLED. The command
        // is still printed, because a human is not the lane.
        expect(plan.unattended.ok).toBe(false);
        expect(plan.unattended.refusals.join(' ')).toContain('no unattended budget configured');
    });

    it('an unreadable worktree refuses on the REMOTE precondition, not silently', () => {
        // `/tmp/wt` is not a git repository, so `git remote -v` fails and the
        // guard fails CLOSED — "I could not tell" must never resolve the same
        // way as "no production remote".
        const plan = planResume(root(), target(), NOW);
        expect(plan.unattended.refusals.join(' ')).toContain('could not read remotes');
    });

    it('a configured budget in a clean worktree flips the verdict, command unchanged', () => {
        const r = root();
        const wt = gitRepo();
        fs.mkdirSync(path.dirname(path.join(r, BUDGET_REL)), { recursive: true });
        fs.writeFileSync(
            path.join(r, BUDGET_REL),
            JSON.stringify({
                day: NOW.toISOString().slice(0, 10),
                max_usd: 10,
                max_tokens: 1_000_000,
                spent_usd: 0,
                spent_tokens: 0,
            }),
            'utf-8',
        );
        const disabled = planResume(root(), target({ worktree: wt }), NOW);
        const enabled = planResume(r, target({ worktree: wt }), NOW);

        expect(enabled.command).toBe(disabled.command);
        expect(enabled.unattended.ok).toBe(true);
        expect(disabled.unattended.refusals.join(' ')).toContain('no unattended budget configured');
    });

    it('an undrivable host reports the refusal and still reports the unattended verdict', () => {
        const plan = planResume(root(), target({ platform: 'windsurf' }), NOW);
        expect(plan.command).toBeNull();
        expect(plan.hostRefusal).toContain('windsurf');
        expect(plan.hostRefusal).toContain('host-agent-protocol');
        expect(plan.unattended.refusals.length).toBeGreaterThan(0);
    });

    it('shell-quotes a worktree path that would otherwise split', () => {
        const plan = planResume(root(), target({ worktree: '/tmp/two words/wt' }), NOW);
        expect(plan.command).toContain(`cd '/tmp/two words/wt'`);
    });

    it('a nearly-exhausted budget still reads as OPEN, because the probe is not a forecast', () => {
        // The verdict answers "is the lane open at all". A plausible-looking
        // projection of 1 USD would refuse a budget with $0.50 of headroom and
        // report a closed lane that is open — a made-up cost presented as an
        // estimate. This pair of cases is what pins the probe: the first
        // implementation used Number.EPSILON, which passed HERE and failed the
        // exhausted case below, because `10 + Number.EPSILON === 10`. A
        // smallest-positive constant that vanishes under addition at real
        // budget magnitudes is a zero with a careful name.
        const r = root();
        const wt = gitRepo();
        fs.mkdirSync(path.dirname(path.join(r, BUDGET_REL)), { recursive: true });
        fs.writeFileSync(
            path.join(r, BUDGET_REL),
            JSON.stringify({
                day: NOW.toISOString().slice(0, 10),
                max_usd: 10,
                max_tokens: 1_000,
                spent_usd: 9.5,
                spent_tokens: 999,
            }),
            'utf-8',
        );
        expect(planResume(r, target({ worktree: wt }), NOW).unattended.ok).toBe(true);
    });

    it('an EXHAUSTED budget reads as refused', () => {
        const r = root();
        const wt = gitRepo();
        fs.mkdirSync(path.dirname(path.join(r, BUDGET_REL)), { recursive: true });
        fs.writeFileSync(
            path.join(r, BUDGET_REL),
            JSON.stringify({
                day: NOW.toISOString().slice(0, 10),
                max_usd: 10,
                max_tokens: 1_000,
                spent_usd: 10,
                spent_tokens: 1_000,
            }),
            'utf-8',
        );
        expect(planResume(r, target({ worktree: wt }), NOW).unattended.ok).toBe(false);
    });

    it('the dedup key carries the head, so two heads are two jobs', () => {
        const r = root();
        const a = planResume(r, target({ head: 'aaa' }), NOW);
        const b = planResume(r, target({ head: 'bbb' }), NOW);
        expect(a.unattended.jobKey).not.toBe(b.unattended.jobKey);
    });
});

describe('renderResumePlans', () => {
    it('says so plainly when there is nothing to resume', () => {
        expect(renderResumePlans([])).toContain('nothing to resume');
    });

    it('prints the command, the unattended verdict, and which is which', () => {
        const out = renderResumePlans([planResume(root(), target(), NOW)]);
        expect(out).toContain('road-to-x');
        expect(out).toContain('claude -p');
        expect(out).toContain('unattended: would be REFUSED');
        // The disclaimer is not decoration: without it the refusal line reads
        // as a prohibition on the operator.
        expect(out).toContain('The command above is for YOU');
    });

    it('renders an undrivable host as REFUSED rather than omitting the row', () => {
        const out = renderResumePlans([planResume(root(), target({ platform: 'cursor' }), NOW)]);
        expect(out).toContain('REFUSED');
        expect(out).toContain('cursor');
    });
});
