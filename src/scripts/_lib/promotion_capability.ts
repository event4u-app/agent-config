/**
 * The ONE guarded capability every promotion-capable write must pass through.
 *
 * `road-to-harness-promotion-bridge` — discharge route 1 of the carried
 * blocking condition.
 *
 * ## Why this module exists
 *
 * The carried condition covers *"a verb, a state transition into `promoted`, or
 * any write into `src/` derived from a candidate"*. Two of those three were
 * gated before this change: `verbPromote` refuses unconditionally
 * (`src/scripts/evolution_lab.ts`), and `assertTransition(_, 'promoted')`
 * refuses without a named approver (`_lib/candidate_record.ts`). The AI council
 * of 2026-08-31 ruled the condition NOT DISCHARGED because nothing proved
 * repository-wide that a THIRD path could not exist — a direct approval
 * synthesis, a record written with `lifecycle: 'promoted'` outside the verb, or
 * a candidate-derived write into the source tree.
 *
 * The route the same verdict named is a structural invariant with **one guarded
 * capability** that is **unobtainable while `blocker: merge-authority` is open**.
 * This module is that capability; `src/scripts/lint_promotion_paths.ts` is the
 * invariant that proves nothing bypasses it.
 *
 * ## This module creates no promotion path
 *
 * It performs no filesystem write, no transition, and no promotion. It mints an
 * opaque token and refuses to mint one while the blocker is open. The carried
 * condition requires the enforcement to land *before or in* the first commit
 * that creates a promotion path; this is the enforcement, and it arrives with no
 * path attached.
 *
 * ## Fail-closed in every direction
 *
 * An absent roadmap, an unreadable file, a missing blocker heading and a Status
 * field this module cannot parse all resolve to {@link BlockerStatus} values
 * that REFUSE. There is deliberately no environment variable, no flag and no
 * override argument: a capability that can be unlocked by configuration is not a
 * capability, it is a default.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { HumanApproval } from './candidate_record.js';

const _HERE = fileURLToPath(import.meta.url);
/** `src/scripts/_lib/` → repo root. */
export const CAPABILITY_REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

/** The blocker whose open state makes this capability unobtainable. */
export const MERGE_AUTHORITY_BLOCKER_ID = 'merge-authority';

/** The roadmap that owns the blocker entry, repo-relative. */
export const MERGE_AUTHORITY_ROADMAP = 'agents/roadmaps/road-to-harness-promotion-bridge.md';

/**
 * The source tree a candidate may never be written into.
 *
 * Promotion means a candidate's bytes reaching canonical `agent-config`, and
 * `src/` is where canonical lives (ADR-051 flat-`src/`). A candidate-derived
 * write anywhere under it IS the promotion the condition names, whatever the
 * lifecycle field says.
 */
export const REPO_SOURCE_ROOT = 'src';

/**
 * Blocker states, as the roadmap gate reads them.
 *
 * `resolved` is the ONLY value that is not a refusal, and it is matched with the
 * same literal `lint_roadmap_blockers.ts:193` uses, so a blocker this repository
 * calls open and a blocker this module calls open cannot diverge.
 */
export type BlockerStatus = 'resolved' | 'open' | 'blocker-absent' | 'roadmap-unreadable';

/** Every status except `resolved`. Named so callers do not re-derive the polarity. */
export function isRefusingStatus(s: BlockerStatus): boolean {
    return s !== 'resolved';
}

/** Extract the `### blocker: <id>` section body from a roadmap's text. */
export function blockerSection(markdown: string, id: string): string | null {
    const lines = markdown.split('\n');
    const head = new RegExp(`^#{2,4}\\s+blocker:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    let start = -1;
    for (let i = 0; i < lines.length; i += 1) {
        if (head.test(lines[i] as string)) {
            start = i + 1;
            break;
        }
    }
    if (start < 0) {
        return null;
    }
    const out: string[] = [];
    for (let i = start; i < lines.length; i += 1) {
        if (/^#{1,4}\s/.test(lines[i] as string)) {
            break;
        }
        out.push(lines[i] as string);
    }
    return out.join('\n');
}

/**
 * Read the live status of `blocker: merge-authority`.
 *
 * Fail-closed: anything this function cannot read positively as `resolved`
 * comes back as a refusing status. It never throws — the caller decides, and
 * every caller in this module refuses.
 */
export function readMergeAuthorityStatus(repoRoot: string = CAPABILITY_REPO_ROOT): BlockerStatus {
    let text: string;
    try {
        text = fs.readFileSync(path.join(repoRoot, MERGE_AUTHORITY_ROADMAP), 'utf-8');
    } catch {
        return 'roadmap-unreadable';
    }
    const body = blockerSection(text, MERGE_AUTHORITY_BLOCKER_ID);
    if (body === null) {
        return 'blocker-absent';
    }
    // The same literal `lint_roadmap_blockers.ts:193` matches. `resolved` is the
    // only closed token this repository recognises.
    return /^-[ \t]*\*\*Status:\*\*[ \t]*resolved/im.test(body) ? 'resolved' : 'open';
}

/** Raised when the capability cannot be minted. There is no way around it. */
export class PromotionCapabilityUnobtainableError extends Error {
    readonly status: BlockerStatus;
    constructor(status: BlockerStatus, why: string) {
        super(
            `promotion capability unobtainable (blocker '${MERGE_AUTHORITY_BLOCKER_ID}' status: ${status}): ${why}`,
        );
        this.name = 'PromotionCapabilityUnobtainableError';
        this.status = status;
    }
}

/**
 * The token. Holding one means the blocker was resolved AND a human was named.
 *
 * Deliberately opaque: `blockerStatusAtGrant` is a LITERAL type, so a caller
 * cannot construct a value of this shape with any other status, and there is no
 * exported constructor other than {@link acquirePromotionCapability}.
 */
export interface PromotionCapability {
    readonly approval: HumanApproval;
    readonly blockerStatusAtGrant: 'resolved';
    readonly roadmap: string;
}

/**
 * Mint the capability, or refuse.
 *
 * Two conjuncts, both required, checked in this order so the message names the
 * governance reason first:
 *
 *   1. `blocker: merge-authority` reads `resolved` in the live roadmap. While it
 *      reads anything else — including "the roadmap is missing" — the capability
 *      is unobtainable, which is the property the council's route 1 specified.
 *   2. A NAMED human approver. Empty, whitespace-only and absent are refused, so
 *      the cheapest way to satisfy the gate stays "name someone".
 *
 * @throws {PromotionCapabilityUnobtainableError} on either.
 */
export function acquirePromotionCapability(
    approval: HumanApproval,
    repoRoot: string = CAPABILITY_REPO_ROOT,
): PromotionCapability {
    const status = readMergeAuthorityStatus(repoRoot);
    if (isRefusingStatus(status)) {
        throw new PromotionCapabilityUnobtainableError(
            status,
            'promotion into canonical agent-config is gated on an OPEN, owner-reserved blocker ' +
                '(ADR-239 Decision 3). No flag, environment variable or argument lifts it.',
        );
    }
    if (approval.approver.trim() === '' || approval.approvedAt.trim() === '') {
        throw new PromotionCapabilityUnobtainableError(
            status,
            'the blocker is resolved, and promotion still requires a NAMED human approver with a ' +
                'date. A blank name is refused rather than defaulted.',
        );
    }
    return { approval, blockerStatusAtGrant: 'resolved', roadmap: MERGE_AUTHORITY_ROADMAP };
}
