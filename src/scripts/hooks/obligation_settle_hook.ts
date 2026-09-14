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

export function main(): number {
    const root = process.cwd();
    const session = (process.env['CLAUDE_CODE_SESSION_ID'] ?? '').trim();
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

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
if (process.argv[1] !== undefined && path.basename(process.argv[1]).startsWith('obligation_settle')) {
    process.exit(main());
}
