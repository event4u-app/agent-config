/**
 * Did a human type this turn?
 *
 * ```
 * UNKNOWN ANSWERS YES. AN UNRECOGNISED PAYLOAD FALLS BACK TO TREATING THE TURN
 * AS HUMAN — NEVER TO TREATING IT AS MACHINE. EVERY CONSUMER OF THIS PREDICATE
 * GUARDS A PER-TURN RECORD, AND A RECORD WRONGLY RETAINED OUTLIVES THE TURN
 * THAT AUTHORISED IT.
 * ```
 *
 * **Why this lives in `_lib` rather than in one hook.** The misclassification is
 * a property of the `user_prompt_submit` SLOT, not of any one concern: the host
 * delivers a background task notification on the same slot as a typed prompt,
 * so every concern that consumes or replaces per-turn state has the same defect.
 * Three are known — the git-authorization ledger with its pending-refusal
 * record, the suggestion-capture latch, and `language_mirror_hook`'s reply
 * pin, which does not consult this predicate at all and so pins a language
 * from a frame nobody typed. A predicate private to one of them would have
 * repaired one and left the others, which is risk 4 of
 * `road-to-turn-bound-authorization-integrity`.
 *
 * **The discriminator, quoted from a captured payload rather than from
 * documentation.** `agents/runtime/.agent-chat-history` records prompts tagged
 * `"source": "hook:claude:UserPromptSubmit"` — what the hook RECEIVED, not what
 * the host stored in its transcript, and those are not guaranteed to be the same
 * text. Measured 2026-08-27 in this project's capture: **9 of 16** hook-sourced
 * user records begin with the literal `<task-notification>`, carrying
 * `<task-id>`, `<tool-use-id>`, `<status>` and `<summary>` children. A typed
 * turn carries none of them.
 *
 * **The third shape, added 2026-10-03, found the same way.** A subagent
 * hand-back arrives on this slot as `<agent-message from="…">`, and 12 of the
 * 153 hook-sourced user records in the capture open with it — every one on
 * `hook:claude:UserPromptSubmit`. It was found because one landed 13 seconds
 * after a merge and rewrote the git-authorization ledger to
 * `prompt_chars: 5599`, the length of the injected frame rather than of any
 * sentence a human sent. Its prefix stops before the `>` because the element
 * carries an attribute; that is a shorter literal than the other two, not a
 * substring match — it is still anchored at position zero.
 *
 * **Prefix, not substring, and that is the whole care in this file.** A
 * notification is a synthetic turn the host constructs, so the element opens it.
 * Matching anywhere in the text would make the question "why did this
 * `<task-notification>` clear my authorization?" clear it again — the user would
 * lose the very turn they were asking about.
 */

/** Wake shapes the host delivers on `user_prompt_submit` that no human typed. */
export const MACHINE_WAKE_PREFIXES: readonly string[] = [
    '<task-notification>',
    '<system-reminder>',
    '<agent-message',
];

/** @see MACHINE_WAKE_PREFIXES — unknown shapes answer `true`, deliberately. */
export function humanTypedThisTurn(prompt: string): boolean {
    const head = prompt.trimStart();
    for (const prefix of MACHINE_WAKE_PREFIXES) {
        if (head.startsWith(prefix)) {
            return false;
        }
    }
    return true;
}
