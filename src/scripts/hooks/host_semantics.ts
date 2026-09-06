/**
 * host_semantics — translate the dispatcher's internal severity ladder into
 * each host's NATIVE hook contract.
 *
 * WHY THIS EXISTS (road-to-rule-coherence P0.1). The dispatcher speaks one
 * internal language: `0 allow · 1 block · 2 warn` (`dispatch_hook.EXIT_*`).
 * Claude Code's hook contract does NOT share that language, and the mismatch
 * inverted every verdict on that host:
 *
 *   - Claude Code treats exit **1** as a NON-blocking error and proceeds with
 *     the action. So `EXIT_BLOCK = 1` did not block: `block-no-verify` and
 *     `block-kernel-rule-writes` — both `fail_closed: true` guards — were
 *     inert on Claude Code.
 *   - Claude Code treats exit **2** on PreToolUse as a BLOCKING error. So a
 *     purely advisory `EXIT_WARN = 2` hard-denied the tool call, even though
 *     `design_slop_hook` documents "FLAGS, NEVER A BLOCK" three times.
 *   - JSON on stdout is parsed ONLY on exit 0. The old code wrote
 *     `{"decision":"warn","reason":…}` to stdout AND exited 2, so the reason
 *     was discarded — the observed symptom was a bare
 *     `PreToolUse:Edit hook error: … No stderr output`.
 *
 * Source: Claude Code hooks documentation — "For most hook events, only exit
 * code 2 blocks the action. Claude Code treats exit code 1 as a non-blocking
 * error and proceeds with the action, even though 1 is the conventional Unix
 * failure code. If your hook is meant to enforce a policy, use `exit 2`." and
 * "Claude Code only processes JSON on exit 0."
 *
 * DESIGN. The pure reducer in `dispatch_hook._reduce` is unchanged — concerns
 * keep emitting the internal ladder and need no rewrite. Only the final
 * emission is translated, here, per (platform, event). Hosts whose native
 * contract has NOT been verified against documentation keep the legacy
 * pass-through, so this fix cannot silently change behaviour on a host nobody
 * measured. That is deliberate: a speculative mapping is the same class of bug
 * this module exists to remove.
 */

import { blockExitFor, DEFAULT_SURFACE, loadHostLowering, surfaceRow, verifiedPlatforms } from "./host_lowering.js";

/** Internal severity, mirroring dispatch_hook's EXIT_ALLOW / BLOCK / WARN. */
export type Severity = "allow" | "warn" | "block";

/** What the dispatcher should actually do on the way out. */
export interface Emission {
    /** Process exit code to hand the host. */
    exit: number;
    /** Text for stdout (already serialized). Empty = write nothing. */
    stdout: string;
    /** Text for stderr. Empty = write nothing. */
    stderr: string;
}

/**
 * Hosts with a documented, verified native hook contract. Anything absent
 * from this set falls through to the legacy pass-through.
 *
 * Read from `host_lowering.yaml`: a host is here when it carries a `verified`
 * block whose `expires` has not passed. An expired row is therefore
 * indistinguishable from `verified: null` at this boundary, which is what
 * makes the expiry a real control rather than a comment.
 */
export const VERIFIED_PLATFORMS: ReadonlySet<string> = verifiedPlatforms();

/** Internal event name -> host-native event name, for structured output. */
function nativeEventName(platform: string, event: string): string {
    return surfaceRow(platform, DEFAULT_SURFACE, loadHostLowering())?.slots.get(event)?.native[0] ?? event;
}

/**
 * Does this (platform, event) pair let a hook actually REFUSE the action?
 *
 * Exported because a second consumer now needs the same fact and must not
 * re-derive it: `dispatch_hook`'s stdin-read-failure policy denies only where a
 * deny is honoured (`b-stdin-read-failure-policy`, option (c)). A second copy
 * of the block-capable slot set would be a copy that drifts, and the drift
 * direction here is the dangerous one: a stale copy would deny on a slot where
 * the deny is discarded, refusing nothing while looking like enforcement. Both
 * consumers now read `host_lowering.yaml`, so there is one set to drift from.
 *
 * An unverified platform is NOT block-capable by this predicate, and that is
 * deliberate rather than incidental: `emitFor` hands such a platform its legacy
 * exit code verbatim, so this tree has no evidence its host honours a deny at
 * all. A row whose `verified` block has expired reads as unverified here. Claiming capability without evidence is the over-claim the hook-coverage
 * corrections in this estate exist to remove.
 */
export function isBlockCapable(platform: string, event: string): boolean {
    return blockExitFor(platform, event) !== null;
}

function _joinReasons(reasons: readonly string[]): string {
    return reasons.map((r) => r.trim()).filter((r) => r.length > 0).join(" · ");
}

/**
 * Build the Claude Code `hookSpecificOutput.additionalContext` envelope.
 *
 * Exit 0 + this JSON is the documented way to surface advisory feedback
 * WITHOUT blocking — the mapping the four advisory PreToolUse concerns
 * (design-slop, code-graph-nudge, rtk-wrap, block-config-weakening's
 * advisory path) always intended.
 */
export function claudeAdditionalContext(event: string, text: string): string {
    const hookEventName = nativeEventName("claude", event);
    return `${JSON.stringify({
        hookSpecificOutput: { hookEventName, additionalContext: text },
    })}\n`;
}

/**
 * Will `emitFor` actually put the reasons on a stream?
 *
 * The per-turn injection ceiling (`injection_budget.ts`) may only charge bytes
 * the host receives. Two branches of `emitFor` below emit nothing REGARDLESS of
 * the reasons, and those are the two this predicate answers for: an unverified
 * platform (legacy pass-through) and `severity: allow`. The budget module
 * originally covered only the first, which let an `allow` dispatch spend the turn
 * on output nobody got — and a crashed non-`fail_closed` concern is fail-opened
 * to exactly that verdict with its stack trace as the largest candidate.
 *
 * A THIRD non-emitting case exists and this predicate deliberately does not claim
 * it: a `warn` whose joined reason comes out empty, because `_joinReasons` trims
 * and drops blanks, so a whitespace-only advisory text emits nothing either. It
 * is content-dependent rather than a property of `(platform, severity)`, so a
 * predicate with this signature cannot decide it — stated here rather than left
 * to be discovered, since an R2 review found the earlier "TWO branches" wording
 * asserting a completeness it did not have.
 *
 * Kept beside `emitFor` deliberately rather than re-derived at the call site:
 * the predicate is only correct while it mirrors the function below it, and a
 * copy one module away is a copy that drifts.
 */
export function emissionCarriesReasons(platform: string, severity: Severity): boolean {
    if (!VERIFIED_PLATFORMS.has(platform)) return false;
    return severity !== "allow";
}

/**
 * Translate (platform, event, severity, reasons) into a native emission.
 *
 * `legacyExit` is the internal reduced code; unverified platforms get it back
 * verbatim so their behaviour is byte-identical to before this module landed.
 */
export function emitFor(
    platform: string,
    event: string,
    severity: Severity,
    reasons: readonly string[],
    legacyExit: number,
): Emission {
    if (!VERIFIED_PLATFORMS.has(platform)) {
        return { exit: legacyExit, stdout: "", stderr: "" };
    }
    const reason = _joinReasons(reasons);

    if (severity === "allow") {
        return { exit: 0, stdout: "", stderr: "" };
    }

    if (severity === "block") {
        const blockExit = blockExitFor(platform, event);
        if (blockExit !== null) {
            // The host's own refusal code + stderr: the ONLY documented way to
            // make it refuse the action and feed the reason back to the model.
            const label = reason || "blocked by agent-config hook policy";
            return { exit: blockExit, stdout: "", stderr: `${label}\n` };
        }
        // Not block-capable (post_tool_use, session_start, …). Exit 2 here
        // would discard stdout and still not block, so surface the reason as
        // context rather than losing it.
        const label = reason || "agent-config hook reported a blocking finding";
        return { exit: 0, stdout: claudeAdditionalContext(event, label), stderr: "" };
    }

    // severity === "warn" — advisory. NEVER exit 2 on a block-capable event:
    // that is precisely the inversion this module removes.
    if (!reason) {
        return { exit: 0, stdout: "", stderr: "" };
    }
    return { exit: 0, stdout: claudeAdditionalContext(event, reason), stderr: "" };
}
