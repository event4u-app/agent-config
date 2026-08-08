/**
 * What a "prompt" actually is — shared by the language hook and the conformance
 * scanner so the two cannot classify the same entry differently.
 *
 * They did. Round 6 measured it: `isSyntheticPrompt` lived in
 * `language_mirror_hook` and was never referenced from `conformance_scan`, whose
 * only general net was `length > 2500 && english`. So the hook skipped
 * harness-generated turns and the scanner counted them, and every era split
 * argued about two different populations without knowing it.
 *
 * The asymmetry ran the other way too, and that half had no net on either side:
 * a prompt whose bulk is pasted content in another language pinned to the paste.
 * That fired on the very session that received the round-6 review — the pin read
 * English because an English draft was pasted below German prose.
 *
 * Nothing here is language-specific. A rule that names a language cannot answer
 * a bidirectional question.
 */

/**
 * Is this "prompt" a harness-generated turn rather than something a human typed?
 *
 * MEASURED, IN THE LANGUAGE HOOK'S OWN AUDIT (round 5, 2026-08-07). The state
 * file read mid-session:
 *
 *   { "language": "en", "source": "prompt", "prompt_chars": 6627,
 *     "de_markers": 0, "en_markers": 63 }
 *
 * No human wrote those 6,627 characters. They were a background-task completion
 * notification, injected as a user turn, which `user_prompt_submit` sees and the
 * hook classified as the trigger — flipping a German session to `en` for every
 * later turn, and recording `source: "prompt"`, a false provenance claim.
 *
 * The markers are structural, not linguistic: the harness stamps these turns
 * with fixed envelope tags. Matching prose would misfire on a human quoting a
 * notification; matching the tags cannot, because a human typing
 * `<task-notification>` is quoting, and a quote does not open at character zero.
 *
 * Deliberately conservative: an unrecognised synthetic shape falls through and
 * is treated as a chat message. Under-filtering keeps prior behaviour;
 * over-filtering would silently stop pinning real prompts, which is worse.
 * Measured across 1 540 user-role entries: 509 open at character zero with a
 * marker, and in 0 of them does human text survive wrapper removal.
 */
export function isSyntheticPrompt(prompt: string): boolean {
  const head = prompt.trimStart().slice(0, 400);
  return (
    head.startsWith("[SYSTEM NOTIFICATION - NOT USER INPUT]") ||
    head.startsWith("<task-notification>") ||
    head.startsWith("<system-reminder>") ||
    head.startsWith("<local-command-caveat>") ||
    /^\[SYSTEM NOTIFICATION\b/.test(head)
  );
}

/**
 * A line that starts pasted DOCUMENT content rather than typed instruction.
 *
 * Distinct from the output-shaped heads `instructionText` already removes (stack
 * traces, diffs, `remote:` lines). Those look like machine output. This catches
 * the other paste shape, which looks like prose: a roadmap, a review, a spec —
 * pasted whole, under its own headings, below one typed sentence.
 *
 * The markers are structural for the same reason as above: a heading, a
 * frontmatter fence, or a bare tag line is document furniture. A typed chat turn
 * rarely carries one; a pasted document essentially always does.
 */
const DOCUMENT_HEAD = /^\s*(#{1,6}\s|-{3,}\s*$|={3,}\s*$|<[A-Za-z][\w-]*>\s*$)/;

/**
 * The part of a prompt a human plausibly typed: everything before the first
 * pasted document begins.
 *
 * Callers pass text that has already had output-shaped pastes removed. Returning
 * the LEAD rather than a filtered whole is deliberate — a paste can be
 * interleaved, and reassembling the human fragments would invent a text nobody
 * wrote. The lead is the one span whose authorship is not in question.
 */
export function humanAuthoredLead(text: string): string {
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (DOCUMENT_HEAD.test(line)) {
      break;
    }
    kept.push(line);
  }
  return kept.join("\n");
}
