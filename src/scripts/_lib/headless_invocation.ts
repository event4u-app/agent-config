/**
 * headless_invocation — the resume command a dead run would be restarted with,
 * constructed and PRINTED, never executed.
 *
 * road-to-long-horizon-execution Phase 4.0, second half. The first half is
 * `unattended_guard.ts` (the preconditions). This is the seam between the
 * watcher and a process that does not exist.
 *
 * ## The live spawn is a published refusal, not a pending item
 *
 * Phase 4.0 shipped the guard and deferred the spawn, and a deferral with no
 * end condition is the exact defect the roadmap opens with (D-5: "pending,
 * indefinitely"). The AI council (2026-08-19, anthropic/claude-sonnet-4-5 +
 * openai/codex-default, blind peer review) split on what to do — build a
 * dry-run seam, or cancel the capability — and named the SAME defect from both
 * sides: `run:supervise --relaunch` advertised a capability that did not
 * exist. The resolution taken is recorded in the run's decision memo:
 *
 *   The invocation seam SHIPS, print-only. Executing it is refused, and the
 *   refusal has a falsifiable reopen condition rather than a date.
 *
 * ## Why print-only is not a half-measure
 *
 * A printed command is the human-in-the-loop shape this suite already commits
 * to everywhere else — merge stays human, the supervisor may open a PR and
 * never merges one. An operator reading a digest can paste the line and watch
 * the run; nothing about that needs a daemon. What a daemon would add is
 * exactly the part nobody has validated: an auth path, a sandbox posture, and
 * a process that spends money with nobody watching.
 *
 * **There is no `spawn`, `exec` or `fork` in this file, and that is asserted
 * by a test rather than promised by this comment.**
 *
 * ## Reopen condition — falsifiable, not a date
 *
 * The live arm is reconsidered when the watcher has actually had an input:
 * **the first time `agents/runtime/state/checkpoints/` holds a checkpoint
 * written by a real dying run.** Measured 2026-08-19 on the main checkout,
 * that directory does not exist — no session has ever both crossed the
 * recycle threshold and held a roadmap claim, so the resume path has never
 * had a single input to resume from. Building an unattended spawn on top of
 * that is the fourth floor of an untenanted building.
 *
 * Stated the other way round so it cannot be over-read: the empty directory
 * is a CONJUNCTION of two rare conditions, not evidence that sessions never
 * die with work left. It licenses "do not build the spawn yet". It does not
 * license "the need does not exist".
 */

import { HOST_INVENTORY } from '../../cli/python/workspace_hosts.js';
import { CHECKPOINT_DIR_REL } from './run_checkpoint.js';
import { preflight, type PreflightVerdict } from './unattended_guard.js';

/**
 * Session-register `platform` → `HOST_INVENTORY` key.
 *
 * The two vocabularies genuinely differ — a live record carries
 * `"platform": "claude"` while the inventory keys the same host as
 * `"claude-code"` — and an unlisted platform resolves to `undefined` rather
 * than to a guessed binary. Fail-closed, matching `unattended_guard`'s posture
 * on an unreadable git config: "I do not recognise this host" and "this host
 * can be driven" must never resolve the same way.
 */
export const PLATFORM_TO_HOST: Readonly<Record<string, string>> = Object.freeze({
    claude: 'claude-code',
    codex: 'codex',
    gemini: 'gemini',
});

/** The prompt a resumed run is started with. */
export function resumePrompt(roadmapSlug: string): string {
    return (
        `Resume the claimed roadmap \`${roadmapSlug}\`. ` +
        `First act: look the checkpoint up by slug (latestCheckpointFor) and verify it ` +
        `against the worktree before acting on any of it — resume by evidence, never by ` +
        `bookkeeping. Then run /roadmap:process-full ${roadmapSlug}.`
    );
}

/**
 * The argv a resume would be launched with, or `null` when the host cannot be
 * driven headlessly.
 *
 * Only Tier-1 hosts from `HOST_INVENTORY` have a documented non-interactive
 * surface (`docs/contracts/host-agent-protocol.md`); every Tier-3 host is
 * observe-only and there is nothing to construct. The shape is read off that
 * contract rather than invented here.
 */
export function buildResumeArgv(platform: string, roadmapSlug: string): readonly string[] | null {
    const hostId = PLATFORM_TO_HOST[platform];
    if (hostId === undefined) return null;
    const entry = HOST_INVENTORY[hostId];
    if (entry === undefined || entry.tier !== 1 || entry.cli === null) return null;

    const prompt = resumePrompt(roadmapSlug);
    switch (hostId) {
        case 'claude-code':
            return [entry.cli, '-p', prompt, '--output-format', 'json'];
        case 'codex':
            // `codex exec --json` consumes the prompt on stdin, so the prompt is
            // not an argv member. The caller renders it as a pipe.
            return [entry.cli, 'exec', '--json'];
        case 'gemini':
            return [entry.cli, '--output-format', 'json'];
        default:
            return null;
    }
}

/**
 * The smallest REAL unit of each budget axis, used to probe whether the
 * unattended lane is open at all.
 *
 * One cent and one token — the smallest amounts either axis can actually be
 * charged. Not a forecast of what a resume costs, which is unknowable before
 * it runs.
 *
 * The first version used `Number.EPSILON`, and a test caught it: EPSILON is
 * the representable gap at 1.0, so `10 + Number.EPSILON === 10` and an
 * EXHAUSTED $10/$10 budget read as open. A "smallest positive number" that
 * disappears under addition at the magnitudes budgets actually use is not a
 * probe, it is a zero wearing a careful name. A real minimum unit is exact at
 * those magnitudes and is the smaller claim besides.
 */
export const SPEND_PROBE_USD = 0.01;
export const SPEND_PROBE_TOKENS = 1;

/** True when this host takes its prompt on stdin rather than in argv. */
export function promptOnStdin(platform: string): boolean {
    return PLATFORM_TO_HOST[platform] === 'codex' || PLATFORM_TO_HOST[platform] === 'gemini';
}

export interface ResumeTarget {
    readonly roadmapSlug: string;
    readonly worktree: string;
    readonly platform: string;
    /** Commit the resume would start from — the dedup key's second half. */
    readonly head: string;
}

export interface ResumePlan {
    readonly target: ResumeTarget;
    /** The command a HUMAN can paste, or `null` when the host has no headless surface. */
    readonly command: string | null;
    /** Why no command could be built. Empty when `command` is non-null. */
    readonly hostRefusal: string | null;
    /**
     * What an UNATTENDED lane would decide about this same run.
     *
     * Reported next to the command and never conflated with it: a human
     * pasting the command is not the unattended lane, so a budget refusal here
     * does not mean the operator may not run it. It means nothing may run it
     * *without* the operator.
     */
    readonly unattended: PreflightVerdict;
}

/** Quote one argv member for a copy-pasteable POSIX shell line. */
function shQuote(arg: string): string {
    return /^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`;
}

export function planResume(repoRoot: string, target: ResumeTarget, now?: Date): ResumePlan {
    const argv = buildResumeArgv(target.platform, target.roadmapSlug);
    const unattended = preflight({
        repoRoot,
        worktree: target.worktree,
        roadmapSlug: target.roadmapSlug,
        head: target.head,
        // A resume's cost is NOT knowable before it runs, so this projection
        // is a probe, not an estimate, and the question it asks is "is the
        // lane open at all" rather than "would it afford this run".
        //
        // The probe is each axis's smallest REAL unit: zero would let a
        // disabled-by-zero ceiling read as allowed (`checkBudget` refuses a 0
        // ceiling only against a positive projection), while a
        // plausible-looking `1` USD would refuse a budget with $0.50 of
        // headroom and report a closed lane that is open. A made-up cost is
        // worse than an admittedly minimal one, because only the second is
        // obviously not a forecast.
        projectedUsd: SPEND_PROBE_USD,
        projectedTokens: SPEND_PROBE_TOKENS,
        ...(now === undefined ? {} : { now }),
    });

    if (argv === null) {
        return {
            target,
            command: null,
            hostRefusal:
                `host: platform '${target.platform}' has no documented headless surface ` +
                `(docs/contracts/host-agent-protocol.md) — a resume must be started by hand`,
            unattended,
        };
    }

    const cd = `cd ${shQuote(target.worktree)}`;
    const call = argv.map(shQuote).join(' ');
    const command = promptOnStdin(target.platform)
        ? `${cd} && printf %s ${shQuote(resumePrompt(target.roadmapSlug))} | ${call}`
        : `${cd} && ${call}`;

    return { target, command, hostRefusal: null, unattended };
}

/**
 * The refusal `run:supervise --relaunch` emits.
 *
 * Names a DECISION, never a pending implementation. The wording matters: the
 * flag used to say "not implemented yet", which is the sentence that makes an
 * operator wait for a release that is not coming.
 */
export const LIVE_SPAWN_REFUSAL =
    'run:supervise: starting a session unattended is a published refusal, not an unbuilt ' +
    'feature — road-to-long-horizon-execution 4.0, resolved by AI council 2026-08-19. ' +
    'Use --print-relaunch for the exact command to run by hand. The refusal is reopened ' +
    'when a real dying run first writes agents/runtime/state/checkpoints/ — until then the ' +
    'resume path has never had an input.';

export function renderResumePlans(plans: readonly ResumePlan[]): string {
    if (plans.length === 0) {
        return 'run:supervise --print-relaunch: nothing to resume.\n';
    }
    const out: string[] = ['run:supervise --print-relaunch · run these by hand:', ''];
    for (const p of plans) {
        out.push(`  ${p.target.roadmapSlug}  (${p.target.platform}, head ${p.target.head})`);
        out.push(p.command === null ? `    REFUSED  ${p.hostRefusal ?? 'no command'}` : `    ${p.command}`);
        out.push(
            p.unattended.ok
                ? '    unattended: an unattended lane would also be permitted to run this'
                : `    unattended: would be REFUSED — ${p.unattended.refusals.join('; ')}`,
        );
        out.push('');
    }
    out.push(
        'The command above is for YOU. The unattended line describes what an automated',
        'lane would decide about the same run; it never gates what you may run by hand.',
        '',
    );
    return out.join('\n');
}

/**
 * Where the reopen condition is measured — re-exported, never re-declared.
 *
 * The path already has one owner (`run_checkpoint.ts`). A second literal here
 * would be a second source of truth for the one directory this module's reopen
 * condition is written against, which is the way a reopen condition quietly
 * starts watching a directory nothing writes.
 */
export { CHECKPOINT_DIR_REL };
