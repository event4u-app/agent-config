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

/** A line that is nothing but an opening tag, with the tag name captured. */
const REGION_OPEN = /^\s*<([A-Za-z][\w-]*)>\s*$/;

/**
 * The host's own framing of an injected region — the sentence it writes ABOUT
 * the block, not a sentence the user typed.
 *
 * Named literally, for the same reason `isSyntheticPrompt` names wrapper tags:
 * this is host furniture, and furniture is identified by what it says about
 * itself. It is deliberately NOT a language rule — the clauses describe the
 * region's provenance and its data status, and a user who types one is quoting
 * the host, which is exactly the case that should be dropped too.
 */
const REGION_NOTE =
  /\b(content (above|below) is from|treat (it|this|that|the (content|text|above|following)) as data)\b/i;

/**
 * Remove host-injected wrapper regions — `<launch-selected-element>` and
 * friends — leaving the text the human actually typed around them.
 *
 * MEASURED, from a 14.13.0 field report (2026-09-01) reproduced against this
 * source. `DOCUMENT_HEAD` matches a bare `<tag>` line, and Claude Code PREPENDS
 * exactly that when the user picks a DOM element in the browser pane. So
 * `humanAuthoredLead` broke at line zero and returned `""` for every such
 * prompt — the lead-first isolation was not degraded, it was OFF — and the
 * whole-text fallback then scored ~4 KB of class-heavy markup plus the host's
 * own advisory line. Four consecutive German turns pinned English, and the
 * turn-end gate refused each one.
 *
 * Two things had to move, and both are visible in the reproduction:
 *
 *   1. A bare `<tag>` line that HAS a matching close is the START of a region
 *      to skip, never the end of the human lead. That is this function.
 *   2. It runs BEFORE `instructionText`. The block's indented lines arm that
 *      filter's paste-state machine, and where no blank line separates the
 *      block from the user's sentence, the sentence itself was deleted — the
 *      German markers did not merely lose the count, they reached zero.
 *
 * Conservative by construction, in three ways. An UNBALANCED bare tag is left
 * in place, so a pasted document opening with one still terminates the lead
 * exactly as before. A prompt with no balanced region is returned untouched,
 * so nothing outside this shape reclassifies. And the framing sentence is
 * dropped LINE BY LINE against `REGION_NOTE` rather than as a paragraph: in the
 * reported shape the advisory and the user's sentence share one unbroken run,
 * so dropping the run would have taken the sentence with it.
 *
 * Not `isSyntheticPrompt`: that answers "is this whole turn machine-written",
 * and these turns are not — a human sentence follows the block. The wrapper is
 * removed; the turn is kept.
 *
 * Nested same-name regions resolve to the FIRST matching close tag. Host
 * wrappers do not nest by name, and stopping early keeps more human text than
 * scanning past the wrong close would.
 */
export function stripInjectedRegions(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const open = REGION_OPEN.exec(line);
    if (open === null) {
      kept.push(line);
      continue;
    }
    // The tag name comes from `[A-Za-z][\w-]*`, so it carries no regex
    // metacharacter and needs no escaping.
    const close = new RegExp(`^\\s*</${open[1] ?? ""}>\\s*$`);
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (close.test(lines[j] ?? "")) {
        end = j;
        break;
      }
    }
    if (end === -1) {
      kept.push(line);
      continue;
    }
    if (kept.length > 0 && REGION_NOTE.test(kept[kept.length - 1] ?? "")) {
      kept.pop();
    }
    i = end;
    while (i + 1 < lines.length && (lines[i + 1] ?? "").trim() !== "") {
      if (!REGION_NOTE.test(lines[i + 1] ?? "")) {
        break;
      }
      i++;
    }
  }
  return kept.join("\n");
}
