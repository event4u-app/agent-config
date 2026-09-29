#!/usr/bin/env tsx
/**
 * obligation-settle — the reader the delivered-obligation record never had.
 *
 * The injector has always known which rules it delivered into a session. Until
 * this concern, nothing asked whether the turn that received them discharged
 * any. This is that question, asked at turn-end, and — for now — asked out
 * loud and answered with nothing.
 *
 * SHADOW ONLY. IT REFUSES NOTHING, AND THAT IS NOT A PLACEHOLDER.
 * It computes the verdict a future armed detector would reach, records it, and
 * returns allow on every path. Arming is gated on a bar pre-registered in
 * `docs/CLAIMS.md` BEFORE any code able to refuse exists, so that the bar
 * cannot be chosen to fit the numbers the shadow window happened to produce.
 * The estate already has one blocking turn-end concern and the first-ranked
 * risk against this work is that a second one refuses a clean turn and an
 * operator disables the carrier for good.
 *
 * THE TOUCHED SET COMES FROM THE DIFF, NOT FROM TOOL EVENTS.
 * A tool event carries the path the tool was given. A shell heredoc writing
 * three files reports one Bash call and no paths at all, so a detector reading
 * tool events is blind to exactly the turns that wrote the most. `git diff
 * --numstat HEAD` plus `git ls-files --others` sees the tree as it actually
 * is, which is the only description that cannot be evaded by how the write was
 * spelled. The helpers are the end-review concern's own, imported rather than
 * re-derived.
 *
 * IT REFUSES ONLY ON CLASSES THAT COULD HAVE A DISCHARGE.
 * `hook`, `validator` and `test` name carriers that run and leave traces.
 * `observer`, `instruction-only` and `none` do not, so demanding a discharge
 * for one would demand evidence nobody can produce — and 69 of 97 delivered
 * rules on the frozen corpus are class `none`.
 *
 * IT IS SILENT WHILE A SUBAGENT DISPATCH IS OPEN.
 * Three of the turn-end gate's six detectors are gated this way and three are
 * not; the difference is whether the finding could be about work a dispatch is
 * still doing. This one could — a subagent writing UI files is the canonical
 * case — so it takes the gated side.
 */

import path from 'node:path';
import process from 'node:process';

import { readHookStdin } from './hook_stdin.js';
// The WRITER's own root resolver, imported rather than re-derived. A second
// spelling of "which tree is this" is how a reader comes to address a ledger
// the writer never wrote — which is the defect this whole file is repairing,
// one field over.
import { workspaceRoot as writerWorkspaceRoot } from './rule_inject_hook.js';

import { may_refuse_on } from '../_lib/obligation_frequency.js';
import { appendShadow, readDelivered, readDischarged, stamp } from '../_lib/obligations.js';
import { loadRouter, matchTierRules } from '../_lib/rule_injection.js';
import { gitNumstatRows, isDocPath, untrackedNonDocFiles } from './end_review_nudge_hook.js';
import { openRecordStats } from './subagent_ledger_hook.js';

const EXIT_ALLOW = 0;

/**
 * Every non-doc path this turn wrote, tracked or not.
 *
 * Doc paths are excluded on the same grounds the end-review concern excludes
 * them: a markdown edit is not the kind of change whose obligations this
 * detector can speak to, and including them would make almost every turn a
 * candidate.
 */
export function touchedPaths(cwd: string): string[] {
    const tracked = gitNumstatRows(cwd)
        .map((r) => r.path)
        .filter((p) => p !== '' && !isDocPath(p));
    const untracked = untrackedNonDocFiles(cwd);
    return [...new Set([...tracked, ...untracked])];
}

export interface SettleVerdict {
    /** Non-doc paths this turn wrote. */
    readonly touched: string[];
    /** Delivered rules whose path triggers match something touched. */
    readonly candidates: string[];
    /** Candidates with no recorded discharge, and a class that could have one. */
    readonly missing: string[];
    /** True when a subagent dispatch is open — every other field is then advisory only. */
    readonly dispatchOpen: boolean;
}

/**
 * What an armed detector would conclude, computed without refusing anything.
 *
 * Exported whole rather than as a boolean so the shadow row, the tests and any
 * later armed path all read the SAME computation. A detector whose shadow
 * measurement and live behaviour come from different code measures nothing.
 */
export function computeVerdict(root: string, session: string): SettleVerdict {
    const dispatchOpen = (() => {
        try {
            return openRecordStats(root).open_count > 0;
        } catch {
            // An unreadable ledger is not a reason to change the verdict.
            return false;
        }
    })();

    const touched = touchedPaths(root);
    if (touched.length === 0) {
        return { touched, candidates: [], missing: [], dispatchOpen };
    }

    const delivered = readDelivered(root, session);
    if (delivered.length === 0) {
        return { touched, candidates: [], missing: [], dispatchOpen };
    }

    let pathMatched = new Set<string>();
    try {
        const router = loadRouter(root);
        // Empty prompt, so only PATH triggers can fire. A turn's file writes
        // are not a restatement of the user's request and must not re-fire
        // keyword rules — the same reasoning the injector applies on its own
        // tool slot.
        pathMatched = new Set(matchTierRules(router, '', touched, null).map((m) => m.id));
    } catch {
        return { touched, candidates: [], missing: [], dispatchOpen };
    }

    const candidates = delivered
        .filter((r) => pathMatched.has(r.rule) && may_refuse_on(r.cls))
        .map((r) => r.rule);

    const discharged = new Set(readDischarged(root, session).map((r) => r.rule));
    const missing = candidates.filter((id) => !discharged.has(id));
    return { touched, candidates: [...new Set(candidates)], missing: [...new Set(missing)] , dispatchOpen };
}

/**
 * Whether this reading should force a continuation, were anything armed.
 *
 * An UNCHANGED missing set on a second reading means the previous nudge moved
 * nothing, so nudging again would loop rather than progress. The obligations
 * stay OPEN — that is the whole point, and it is the side of the source set's
 * self-contradiction this ships. A budget running out is a fact about the
 * budget; letting it write a policy verdict is how an unmet obligation becomes
 * a satisfied one with nobody deciding, and an exhausted budget is exactly the
 * moment the obligation is least likely to have been met.
 *
 * There is therefore no `waived` state anywhere in this file, and no code path
 * that writes one.
 */
export function shouldContinue(attempt: number): boolean {
    return attempt <= 1;
}

/**
 * The session and root this reading is about, resolved the way the WRITER does.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. This hook used to read
 * `CLAUDE_CODE_SESSION_ID` out of the process environment and return allow when
 * it was empty. The dispatcher sets no such variable — it hands each concern
 * the envelope on stdin and `AGENT_CONFIG_PACKAGE_ROOT` in the environment,
 * nothing else — so on every dispatched stop event the reader looked for a
 * ledger under a key the writer never used. Measured 2026-09-29 on this
 * machine's own ledgers: 187 delivered rows, 0 shadow rows, across 8 sessions.
 *
 * WHY THE ORDER IS ENVELOPE-THEN-ENVIRONMENT AND NOT THE REVERSE. The envelope
 * id is the key `rule_inject_hook.ts` wrote the delivered rows under, so it is
 * not merely the better source — it is the ONLY one that can find them. The
 * environment fallback survives for a raw invocation that carries no envelope
 * at all (a maintainer piping nothing, a host shim that skips the dispatcher),
 * which is a case where guessing wrong costs a missing reading rather than a
 * wrong one.
 *
 * THE ROOT IS PART OF THE SAME JOIN, not a second change riding along. A ledger
 * is addressed by root AND session; reading the session from the envelope while
 * taking the root from `process.cwd()` would leave the pair half-joined, and the
 * two disagree exactly on the hosts whose shim does not chdir. `cwd` stays the
 * fallback because that is what the dispatcher sets it to.
 *
 * Both spellings of each key are accepted because the injector accepts both.
 */
export function resolveSettleContext(
    envelope: Record<string, unknown>,
    payload: Record<string, unknown>,
    env: Record<string, string | undefined>,
): { root: string; session: string } {
    const str = (...values: unknown[]): string => {
        for (const v of values) {
            if (typeof v === 'string' && v.trim() !== '') return v.trim();
        }
        return '';
    };
    return {
        // `workspaceRoot` is the INJECTOR's function, not a copy of it. It reads
        // `workspace` / `cwd` / `project_dir`; this file used to read
        // `workspace_root` / `workspace` / `cwd`, so the two key sets overlapped
        // without matching and the pair was joined on the session only. It
        // happened to agree on both real envelope shapes — the dispatcher sets
        // `workspace_root` and chdirs concerns to it, a native wiring passes
        // `cwd` — which made the asymmetry a property of today's envelopes
        // rather than of the code. `workspace_root` is appended ahead of the
        // shared resolver because the dispatcher is the only producer that sets
        // it and nothing else reads it.
        root:
            str(envelope['workspace_root'])
            || writerWorkspaceRoot(envelope as Parameters<typeof writerWorkspaceRoot>[0]),
        session: str(
            envelope['session_id'],
            envelope['sessionId'],
            payload['session_id'],
            payload['sessionId'],
            // The one pre-existing source, kept as the last resort and NOT
            // joined by siblings: adding a name the writer never keys on
            // would address a ledger that cannot exist.
            env['CLAUDE_CODE_SESSION_ID'],
        ),
    };
}

/**
 * The session id the WRITER would have used, for the ledger nobody reads.
 *
 * `rule_inject_hook.ts` defaults an unnamed session to the literal `unknown`
 * and writes delivered rows there; this reader used to return `''` and allow, so
 * that population was invisible to every reading of the bar. Reported rather
 * than silently joined: a shared `unknown` bucket aggregates unrelated sessions,
 * so reading it as one session's turn would be worse than not reading it. The
 * constant is exported so a future census can count what is sitting there.
 */
export const WRITER_UNNAMED_SESSION = 'unknown';

/** The envelope on stdin, or an empty object when there is none to read. */
function readEnvelope(): { envelope: Record<string, unknown>; payload: Record<string, unknown> } {
    let envelope: Record<string, unknown> = {};
    try {
        const raw = readHookStdin();
        const parsed: unknown = raw.trim() === '' ? {} : JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            envelope = parsed as Record<string, unknown>;
        }
    } catch {
        // A malformed envelope is not a reason to refuse, and this concern
        // refuses nothing anyway. It is a reason to read nothing from it.
    }
    const nested = envelope['payload'];
    const payload =
        typeof nested === 'object' && nested !== null && !Array.isArray(nested)
            ? (nested as Record<string, unknown>)
            : envelope;
    return { envelope, payload };
}

/**
 * The resolver as it stood BEFORE the join fix, kept reachable for one test.
 *
 * A reproduction that cannot run the old code is not a reproduction — it is an
 * assertion about the new function's behavior on inputs nobody sends, and
 * `tests/hooks/obligation_settle.test.ts` carried exactly that until an
 * independent review named it. This function is dead on every production path
 * (nothing but the fixture calls it) and exists so the defect stays executable:
 * environment-only resolution, allow when empty, root from the cwd.
 */
export function resolveSettleContextPreFix(
    _envelope: Record<string, unknown>,
    _payload: Record<string, unknown>,
    env: Record<string, string | undefined>,
): { root: string; session: string } {
    // Same arity as the live resolver ON PURPOSE. A narrower signature would let
    // the fixture pass the envelope in as `env`, where the lookup misses for the
    // wrong reason and the test goes green without exercising the defect.
    return { root: process.cwd(), session: (env['CLAUDE_CODE_SESSION_ID'] ?? '').trim() };
}

/**
 * Which context resolver this reading uses — the seam the pre-fix fixture needs.
 *
 * It is NOT a parameter of `main()`, and that is a contract rather than a
 * preference: `concern_main_signature` requires every concern's `main()` to take
 * argv first or nothing, because the dispatcher calls `main(argv)` — so a
 * resolver in first position would receive an argv array at runtime and resolve
 * a session from it. Caught by that test, which is the reason this indirection
 * exists instead of the obvious default parameter.
 */
export type SettleResolver = (
    envelope: Record<string, unknown>,
    payload: Record<string, unknown>,
    env: Record<string, string | undefined>,
) => { root: string; session: string };

export function runSettle(resolve: SettleResolver = resolveSettleContext): number {
    const { envelope, payload } = readEnvelope();
    const { root, session } = resolve(envelope, payload, process.env);
    if (session === '') return EXIT_ALLOW;

    let verdict: SettleVerdict;
    try {
        verdict = computeVerdict(root, session);
    } catch {
        // A detector that cannot compute has nothing to say. It never has a
        // refusal to withhold, so there is no safe-vs-unsafe choice here.
        return EXIT_ALLOW;
    }

    // Silent while a dispatch is open: the files may be a subagent's, still
    // being written, and a shadow row claiming otherwise would poison the very
    // corpus the arming decision is measured against.
    if (verdict.dispatchOpen) return EXIT_ALLOW;
    if (verdict.missing.length === 0) return EXIT_ALLOW;

    const attempt = appendShadow(root, session, verdict.missing, stamp());
    if (attempt === 0) return EXIT_ALLOW;

    // ONE line for the whole missing set, never one per obligation — the same
    // aggregation the row itself uses, for the same reason.
    process.stderr.write(
        `obligation-settle (shadow, refusing nothing): ${verdict.missing.length} `
            + `obligation(s) with no recorded discharge after writing `
            + `${verdict.touched.length} file(s): ${verdict.missing.join(', ')}`
            + `${shouldContinue(attempt) ? '' : ' — unchanged since the last reading; still open'}\n`,
    );
    return EXIT_ALLOW;
}

/** The dispatcher entry point. Argv-shaped, per `concern_main_signature`. */
export function main(_argv: readonly string[] = process.argv.slice(2)): number {
    return runSettle();
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
if (process.argv[1] !== undefined && path.basename(process.argv[1]).startsWith('obligation_settle')) {
    process.exit(main());
}
