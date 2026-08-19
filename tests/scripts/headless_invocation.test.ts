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

import { HOST_CONFIGS } from '../../src/cli/python/workspace_drive.js';
import { HOST_INVENTORY } from '../../src/cli/python/workspace_hosts.js';
import {
    CHECKPOINT_DIR_REL,
    LIVE_SPAWN_REFUSAL,
    PLATFORM_TO_HOST,
    buildResumeArgv,
    planResume,
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

describe('the module starts no AGENT — and that is narrower than "starts no process"', () => {
    // R2 round 2, finding 5. This block was called "the module cannot start a
    // process" and its note claimed "a module that cannot reach child_process
    // cannot grow a spawn by accident". Both over-read the assertion, in the
    // file whose thesis is that things are asserted rather than promised:
    // `planResume` → `preflight` → `checkRemotes` runs `spawnSync('git',
    // ['remote','-v'])`, one subprocess per plan. `--print-relaunch` therefore
    // starts N git processes.
    //
    // What is actually pinned — and what the refusal is about — is that no
    // AGENT is started from here: the file holds no spawn token of its own, so
    // a live arm cannot appear without the diff that adds one being visible.
    // Reading a git remote is not the capability under refusal.
    it('holds no spawn token of its own, so a live arm cannot appear silently', () => {
        const src = fs.readFileSync(MODULE_SRC, 'utf-8');
        // Matches the IMPORT and the CALL shapes both — the assertion has to
        // fail on the import that would enable one, not only on the call.
        for (const forbidden of ['child_process', 'spawnSync(', 'spawn(', 'execSync(', 'execFile', 'fork(']) {
            expect(src.includes(forbidden), `forbidden construct: ${forbidden}`).toBe(false);
        }
    });

    it('and the transitive git probe is real, so the narrower claim is the true one', () => {
        // Pinned so the honest scope cannot drift back to the wider claim: the
        // guard this module calls DOES shell out, and a future reader must not
        // re-read the test above as "nothing here runs a process".
        const guard = fs.readFileSync(
            path.resolve(HERE, '../../src/scripts/_lib/unattended_guard.ts'),
            'utf-8',
        );
        expect(guard).toContain("spawnSync('git'");
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

    it('an unmapped host is refused at the MAP, before the tier is consulted', () => {
        // augment IS in HOST_INVENTORY, with `cli: null` — but it is not in
        // PLATFORM_TO_HOST, so this case short-circuits at the mapping. Named
        // for what it actually exercises: R2 round 2, finding 6 caught this
        // same case claiming "the tier is what decides" while never reaching
        // the tier check. A fixture that agrees with the code instead of with
        // reality reads as coverage and is worse than no test.
        expect(HOST_INVENTORY['augment']).toBeDefined();
        expect(PLATFORM_TO_HOST['augment']).toBeUndefined();
        expect(buildResumeArgv('augment', 'road-to-x')).toBeNull();
    });

    it('a MAPPED host demoted to Tier 3 is refused at the tier guard', () => {
        // The guard the previous case did not reach. It looks dead today
        // because the map holds only Tier-1 hosts; it is the branch that has
        // to hold the day an entry goes `tier: 1 -> 3` in HOST_INVENTORY while
        // its row here stays — a one-line edit in another file with no reason
        // to look at this one.
        const demoted = { ...HOST_INVENTORY, 'claude-code': { tier: 3, cli: 'claude' } };
        expect(buildResumeArgv('claude', 'road-to-x', demoted)).toBeNull();
        // Same host, same map, Tier 1 restored — so the null above is the tier
        // and not something else in the fixture.
        expect(buildResumeArgv('claude', 'road-to-x', HOST_INVENTORY)).not.toBeNull();
    });

    it('a mapped host whose CLI is null is refused even at Tier 1', () => {
        const noCli = { ...HOST_INVENTORY, 'claude-code': { tier: 1, cli: null } };
        expect(buildResumeArgv('claude', 'road-to-x', noCli)).toBeNull();
    });

    it('a mapped host missing from the inventory is refused, not crashed', () => {
        const gone: Record<string, { tier: number; cli: string | null }> = { ...HOST_INVENTORY };
        delete gone['claude-code'];
        expect(buildResumeArgv('claude', 'road-to-x', gone)).toBeNull();
    });

    it('every mapped platform reaches a switch arm — the map and the switch agree', () => {
        // The `default:` arm is unreachable while these two lists agree, and
        // this is the assertion that keeps them agreeing. Adding a row to
        // PLATFORM_TO_HOST without a case would return null here, which is the
        // fail-closed behaviour — and this test turns a silent null into a
        // failure at the moment the rows diverge.
        for (const platform of Object.keys(PLATFORM_TO_HOST)) {
            expect(buildResumeArgv(platform, 'road-to-x'), `no argv for ${platform}`).not.toBeNull();
        }
    });
});

describe('buildResumeArgv', () => {
    it('delegates to HOST_CONFIGS rather than re-deriving the argv', () => {
        // R2 round 2, finding 12. The first version hand-built each host's
        // argv off a prose contract that contradicts itself, and got BOTH
        // codex and gemini wrong — it modelled them as stdin consumers while
        // the tree's own drive configs pass the prompt as an argv member. The
        // pasted command would have piped a prompt into a CLI not reading one.
        // Delegating removes the second derivation instead of choosing between
        // two prose rows.
        for (const [platform, hostId] of Object.entries(PLATFORM_TO_HOST)) {
            const cfg = HOST_CONFIGS[hostId];
            expect(cfg, `no drive config for ${hostId}`).toBeDefined();
            expect(buildResumeArgv(platform, 'road-to-x')).toEqual(
                cfg?.build_args(resumePrompt('road-to-x'), null),
            );
        }
    });

    it('every host carries the prompt IN argv — no host reads it from stdin', () => {
        // The property the removed stdin branch got wrong. Asserted over the
        // whole map so a future host added as a stdin consumer fails here
        // rather than shipping a command that hangs.
        for (const platform of Object.keys(PLATFORM_TO_HOST)) {
            expect(buildResumeArgv(platform, 'road-to-x')?.join(' ')).toContain('road-to-x');
        }
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
