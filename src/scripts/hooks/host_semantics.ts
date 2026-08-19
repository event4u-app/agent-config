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
 */
export const VERIFIED_PLATFORMS: ReadonlySet<string> = new Set(["claude"]);

/** Internal event name -> Claude Code `hookEventName` for JSON output. */
const CLAUDE_HOOK_EVENT_NAME: Record<string, string> = {
    pre_tool_use: "PreToolUse",
    post_tool_use: "PostToolUse",
    user_prompt_submit: "UserPromptSubmit",
    session_start: "SessionStart",
    session_end: "SessionEnd",
    stop: "Stop",
    pre_compact: "PreCompact",
    subagent_start: "SubagentStart",
    subagent_stop: "SubagentStop",
};

/**
 * Events where Claude Code honours exit 2 as a real block. Everywhere else
 * exit 2 either cannot block (PostToolUse: "the tool already ran";
 * SessionStart: "shows stderr to user only") or is far too blunt, so a block
 * degrades to visible advisory context instead of a silent no-op.
 */
const CLAUDE_BLOCK_CAPABLE_EVENTS: ReadonlySet<string> = new Set([
    "pre_tool_use",
    "user_prompt_submit",
    "stop",
]);

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
    const hookEventName = CLAUDE_HOOK_EVENT_NAME[event] ?? event;
    return `${JSON.stringify({
        hookSpecificOutput: { hookEventName, additionalContext: text },
    })}\n`;
}

/**
 * Will `emitFor` actually put the reasons on a stream?
 *
 * Added for the per-turn injection aggregate (road-to-standing-context-40k
 * 4.1): a byte budget must charge only for bytes that leave the process, and
 * two branches of `emitFor` below emit nothing at all — an unverified platform
 * (legacy pass-through) and `severity: allow`. Charging those was a review
 * finding with a sharp instance: a crashed non-`fail_closed` concern is
 * fail-opened to rc 0, its stderr becomes the "deciding" message, and it is
 * usually the largest candidate — so one crash could wedge the whole turn cap
 * on text nobody ever received.
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
        if (CLAUDE_BLOCK_CAPABLE_EVENTS.has(event)) {
            // Exit 2 + stderr: the ONLY documented way to make Claude Code
            // refuse the action and feed the reason back to the model.
            const label = reason || "blocked by agent-config hook policy";
            return { exit: 2, stdout: "", stderr: `${label}\n` };
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
