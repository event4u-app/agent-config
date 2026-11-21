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
 *
 * `<agent-message` added 2026-10-03, by the same under-filtering it warns
 * about: a subagent hand-back reaches this slot as `<agent-message from="…">`,
 * and 12 of the 153 hook-sourced user records in this project's capture open
 * with it. It pinned a German session to `en`, after which the turn-end gate
 * refused each German reply — a reply language derived from a frame nobody
 * typed. Its literal stops before the `>` because the element carries an
 * attribute; the anchor at character zero is unchanged.
 *
 * **The fourth shape has NO envelope tag, and it is the exception this file's
 * own "structural, not linguistic" rule has to name rather than quietly break.**
 * The host resumes a rate-limited session with a plain sentence —
 * `Your claude.ai usage limit has reset. Continue the task you were working
 * on…` — carrying no element, no bracket and no stamp. 5 of the 153
 * hook-sourced user records in this project's capture open with it. Measured
 * 2026-10-03: it pinned a German session to `en` with `prompt_chars: 148`,
 * which is that sentence's exact length, and every German reply for the rest
 * of the run was then refused by the turn-end gate as wrong-language.
 *
 * Matching prose is what the paragraph above warns against, so what makes this
 * one admissible is stated rather than assumed: it is a FIXED host string, not
 * a linguistic pattern, and the character-zero anchor does the same work a tag
 * would — a human asking *why did I get "Your claude.ai usage limit has
 * reset"* does not open with it. A test pins that direction. If the host ever
 * reworded the sentence this guard would silently stop matching, which is the
 * honest failure mode: it under-filters back to today's behaviour rather than
 * misfiring on a real turn.
 *
 * It is deliberately NOT added to `machine_wake.ts`. There the same
 * misclassification retains an authorization instead of mis-pinning a reply,
 * and a prose match is too weak a warrant for that consequence — see the
 * asymmetry note below, which this is the first real test of.
 *
 * **A SECOND VOCABULARY ANSWERS THIS SAME QUESTION AND THE TWO HAVE DRIFTED.**
 * `_lib/machine_wake.ts`'s `humanTypedThisTurn` guards per-turn STATE on this
 * slot (the git-authorization ledger, the suggestion latch) while this one
 * guards the language pin. As of this change both know `<task-notification>`,
 * `<system-reminder>` and `<agent-message`; only this one knows
 * `[SYSTEM NOTIFICATION`, `<local-command-caveat>` and the host's framed
 * agent-message delivery (`AGENT_MESSAGE_FRAME`). That asymmetry is NOT
 * obviously a defect and was deliberately left: mistaking a real turn for a
 * machine one costs a mis-pinned reply here and a RETAINED AUTHORIZATION
 * there, so the two sides do not want the same error budget — and
 * `<local-command-caveat>` in particular precedes a real typed prompt. Unify
 * them only with that asymmetry answered, never as tidying.
 */
export function isSyntheticPrompt(prompt: string): boolean {
  const head = prompt.trimStart().slice(0, 400);
  return (
    head.startsWith("[SYSTEM NOTIFICATION - NOT USER INPUT]") ||
    head.startsWith("<task-notification>") ||
    head.startsWith("<system-reminder>") ||
    head.startsWith("<local-command-caveat>") ||
    head.startsWith("<agent-message") ||
    head.startsWith("Your claude.ai usage limit has reset") ||
    /^\[SYSTEM NOTIFICATION\b/.test(head) ||
    AGENT_MESSAGE_FRAME.test(head)
  );
}

/**
 * How Claude Code actually delivers a subagent hand-back or a cross-session
 * message to `user_prompt_submit`: one fixed host sentence, then the wrapper
 * tag, which the bare `<agent-message` case above never matched. Both halves
 * are required so a human quoting the sentence keeps their turn.
 */
export const AGENT_MESSAGE_FRAME =
  /^Another Claude session sent a message:\s*\n\s*<(?:agent-message|cross-session-message)\b/;

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

/**
 * A line that starts pasted machine OUTPUT — a stack trace, a diff, a `remote:`
 * line, a shell prompt, a table row. Shared by `instructionText` (which drops
 * these lines) and `ownerSpans` (which treats the first one as the end of the
 * owner's lead and the last one as the start of their trailing line).
 */
export const OUTPUT_HEAD =
  /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|npm ERR!|Error:|Traceback|Exception|[A-Za-z]*Error\b|at\s+\S+:\d+|\s{4,}\S|[-+]{3}\s|@@\s|\$\s|>\s|\||\d+\s*\|)/i;

/** One line standing in for a removed fenced block, so its position survives. */
const FENCE_LINE = "\u0000";

/**
 * The prompt's lines with every fenced block collapsed to one `FENCE_LINE`.
 * Line-aware, as CommonMark reads fences: a fence opens only on a line that
 * starts, after at most three spaces and an optional list marker, with three or more backticks (no
 * backtick after them, so inline ` ``` ` in a sentence opens nothing) or
 * tildes (whose info string may hold tildes), and closes on a line of the same
 * character at least as long, indented at most three columns past the opener's
 * content column (column 0 outside a list; a tab advances to the next multiple
 * of four, so a tab-indented top-level line is no closer) and followed only by spaces or tabs
 * (not a no-break space); an unclosed
 * fence is no fence — its lines stay, so a misread opener can never hide what
 * follows it. CR, CRLF and LF all end a line.
 */
function fenced(text: string): string[] {
  const out: string[] = [];
  let fence = "";
  let indent = 3;
  let content = 0;
  let held: string[] = [];
  for (const line of text.split(/\r\n?|\n/)) {
    // An opener may follow a list marker (`- ```, `10. ```), as inside a
    // Markdown list item; its closer may then be indented up to three spaces
    // past the item's content column, as CommonMark allows.
    const open = /^( {0,3})((?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}(?=[^`]*$)|~{3,})/.exec(line);
    const lead = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/.exec(line);
    // A non-blank line left of a list item's content column ends the item and
    // the fence inside it; the line is then read afresh (round 18).
    if (fence !== "" && content > 0 && line.trim() !== "" && columns(/^[ \t]*/.exec(line)?.[0] ?? "") < content) {
      out.push(FENCE_LINE);
      fence = "";
    }
    if (fence === "" && open === null) {
      out.push(line);
    } else if (fence === "") {
      fence = open?.[3] ?? "";
      // Outside a list a closer takes at most three spaces, whatever the
      // opener's own indent; inside one, three past the item's content column.
      content = open?.[2] === undefined ? 0 : columns(`${open[1] ?? ""}${open[2]}`);
      indent = content === 0 ? 3 : content + 3;
      held = [line];
    } else if (lead !== null && columns(lead[1] ?? "") <= indent && (lead[2] ?? "").startsWith(fence)) {
      out.push(FENCE_LINE);
      fence = "";
    } else {
      held.push(line);
    }
  }
  // A fence that never closes hides nothing: a misread opener must not swallow
  // the owner's text below it.
  if (fence !== "") for (const line of held) out.push(line);
  return out;
}

/**
 * A unified-diff hunk body is patch content, never prose: the rows under an
 * `@@ -a,b +c,d @@` head are collapsed to `FENCE_LINE` by the row prefixes and
 * the declared lengths — before the fence reader can read a context row as a
 * fence, and without running past the hunk's end (rounds 19-20). An empty row
 * is a context row whose leading space was trimmed.
 */
function collapseHunks(lines: string[]): string[] {
  const out = [...lines];
  for (let i = 0; i < out.length; i++) {
    const head = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(out[i] ?? "");
    if (head === null) continue;
    let old = head[1] === undefined ? 1 : Number(head[1]);
    let neu = head[2] === undefined ? 1 : Number(head[2]);
    for (let j = i + 1; j < out.length; j++) {
      const row = out[j] ?? "";
      if (row.startsWith("\\")) {
        // `\ No newline at end of file` belongs to the row above it.
      } else if (old === 0 && neu === 0) break;
      else if (row.startsWith("-") && old > 0) old--;
      else if (row.startsWith("+") && neu > 0) neu--;
      else if ((row === "" || row.startsWith(" ")) && old > 0 && neu > 0) (old--, neu--);
      else break;
      out[j] = FENCE_LINE;
      i = j;
    }
  }
  return out;
}

/** The display width of a line prefix, tabs to the next multiple of four. */
function columns(prefix: string): number {
  let width = 0;
  for (const ch of prefix) width = ch === "\t" ? width + 4 - (width % 4) : width + 1;
  return width;
}

/** The two spans of a prompt the owner typed, as `ownerSpans` finds them. */
export interface OwnerSpans {
  /** The first paragraph, up to the first blank line or paste line. */
  lead: string;
  /** The paragraph after the last output paste, when one follows it. */
  trailing: string;
}

/**
 * The spans of a prompt the owner typed: the opening paragraph, and the
 * paragraph after the last pasted output block. Nothing in between.
 *
 * Callers pass text with injected regions already removed
 * (`stripInjectedRegions`). Fenced code, output-shaped lines and document heads
 * are paste furniture; the owner's words sit around them, not inside them.
 *
 * The lead is ONE paragraph, not everything before the first document head as
 * `humanAuthoredLead` reads it. A German sentence over an English paragraph
 * pasted without a heading was scored as one lead, and the paste outvoted the
 * sentence (`Behebe das bitte.` over an English paragraph pinned `en`, de=2 /
 * en=9). A blank line is the one boundary a paste reliably carries.
 *
 * The trailing span answers the shape the lead cannot: a terminal block pasted
 * first and the owner's question typed below it. It is taken only after an
 * OUTPUT paste or a fence — never after a document head, because every
 * paragraph below a pasted heading is that document's body, and reading its
 * last paragraph as typed would hand the pin back to the paste.
 *
 * Both spans are returned as found; neither is dropped in favour of the other.
 * Deciding whether they can be trusted is the scorer's job: `classify` in the
 * language mirror vetoes the spans' verdict when the raw prompt (nothing
 * removed, tag-wrapped regions included) carries the marker floor of both
 * languages, so a misread boundary here can cost a pin but never hand one to a
 * paste.
 *
 * A trailing span with no blank line between it and the paste is weaker
 * evidence than a lead: it is read only when the prompt has no lead. A wrapped
 * error message (`mach das:` over `Error: …` continued on unmarked lines) would
 * otherwise drop the owner's lead and pin the paste's continuation.
 *
 * KNOWN RESIDUALS, stated rather than hidden: a prompt that OPENS with a paste
 * ending in an unmarked prose line, with no typed text after it, yields that
 * line as the trailing span; and a typed line that itself starts like output
 * (`Error: …`) or like a document head (`# …`), or sits inside a fence, is read
 * as paste. None of them leaves owner prose the reader can see, so none has
 * anything for the veto to protect. And a single line that mixes typed and
 * pasted text (`mach das: <long English error>`) is one unit; its markers
 * decide it as a whole. More generally, pasted prose can set a pin
 * only where the owner's own text is under the floor in the other language
 * (`Fix.` over `Error: x` and an English explanation pins English): the veto
 * protects owner text that reaches the floor, not owner text that does not.
 */
export function ownerSpans(text: string): OwnerSpans {
  const lines = fenced(collapseHunks(text.split(/\r\n?|\n/)).join("\n"));
  // `OUTPUT_HEAD`'s `To <x>` arm is git's push line, one token after `To`; a
  // sentence such as `To fix this, …` is the owner's, not output.
  const blank = (l: string): boolean => l.trim() === "";
  // Blank lines never reach `OUTPUT_HEAD`: its leading `\s*` and `\s{4,}\S`
  // backtrack against each other on a whitespace-only line.
  const isOutput = (l: string): boolean =>
    l === FENCE_LINE || (!blank(l) && OUTPUT_HEAD.test(l) && !/^\s*To\s+\S+\s+\S/i.test(l));
  const isPaste = (l: string): boolean => isOutput(l) || (!blank(l) && DOCUMENT_HEAD.test(l));

  const lead: string[] = [];
  for (const line of lines) {
    if (blank(line)) {
      if (lead.length > 0) break;
      continue;
    }
    if (isPaste(line)) break;
    lead.push(line);
  }

  let end = lines.length - 1;
  while (end >= 0 && blank(lines[end] ?? "")) end--;
  let start = end;
  while (start >= 0 && !blank(lines[start] ?? "") && !isPaste(lines[start] ?? "")) start--;
  const before = lines.slice(0, start + 1);
  const candidate =
    start >= 0 && start < end && before.some(isOutput) && !before.some((l) => DOCUMENT_HEAD.test(l))
      ? lines.slice(start + 1, end + 1)
      : [];
  // A span glued to the paste's last line is as likely the paste's own wrapped
  // continuation as a typed line; it counts only when there is no lead to read
  // and at least two output lines stand DIRECTLY above it, so one prose line
  // that happens to look like output cannot hand the pin to the line below it,
  // and an output line in an earlier block does not count toward the two.
  const separated = blank(lines[start] ?? "");
  let run = 0;
  while (run <= start && isOutput(lines[start - run] ?? "")) run++;
  const glued = lead.length === 0 && run >= 2;
  const trailing = separated || glued ? candidate : [];

  return { lead: lead.join("\n"), trailing: trailing.join("\n") };
}

/**
 * Host turns that carry no envelope tag and that `isSyntheticPrompt`
 * deliberately does not know, because that predicate also draws turn
 * boundaries for the gate's other detectors. Each is a FIXED host string
 * anchored at character zero — the same admissibility argument as the
 * usage-limit resume sentence above — and each was found pinning in the
 * language-split baseline (`synthetic-turn`, 2026-11-21): stop-hook feedback,
 * the compaction continuation summary, the usage-limit notes.
 *
 * Scoped to the PIN: `ownerProse` returns nothing for them, so they never set
 * a language, while turn boundaries stay exactly where they were.
 */
const HOST_TURN_HEAD =
  /^(Stop hook feedback:|This session is being continued from a previous conversation|\[Usage limit reached|\[Earlier usage-limit notes)/;

/**
 * The text of a prompt the owner typed, and nothing else — the only input the
 * language pin is allowed to read (road-to-a-language-pin-from-owner-prose,
 * owner decision D1).
 *
 * Order: a host-generated turn yields nothing; injected regions are removed;
 * then `ownerSpans` keeps the opening paragraph and the paragraph after the
 * last output paste. Fenced code, output-shaped lines, a pasted document and
 * every paragraph between two pastes are dropped. There is no whole-body
 * fallback: a prompt whose owner spans are undetermined is undetermined, and
 * the caller keeps the previous pin.
 */
export function ownerProse(prompt: string): OwnerSpans & { text: string } {
  if (isSyntheticPrompt(prompt) || HOST_TURN_HEAD.test(prompt.trimStart())) {
    return { lead: "", trailing: "", text: "" };
  }
  return { ...ownerSpans(stripInjectedRegions(prompt, " ")), text: prompt };
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
 * The terminal-pane echo Claude Desktop's Code tab writes into the prompt when
 * the user runs a command there — issue #2950. The tags arrive INLINE on one
 * line (`<bash-input>…</bash-input><bash-stdout>…</bash-stdout>`), which the
 * line-anchored `REGION_OPEN` below never matches, and the app's own bracketed
 * advisory inside `<bash-stdout>` carried enough English markers to pin English
 * in a German session.
 *
 * Named literally rather than generalised to every inline `<tag>…</tag>`: a user
 * typing markup in a sentence is plausible, and furniture is identified by its
 * own name (the same reasoning as `REGION_NOTE`). Only a CLOSED region goes; an
 * unclosed tag stays, as with the bare-tag arm below.
 */
const TERMINAL_PANE_REGION = /<(bash-input|bash-stdout|bash-stderr)>[\s\S]*?<\/\1>/g;

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
export function stripInjectedRegions(text: string, separator = ""): string {
  // `ownerProse` passes a space so `un<bash-stdout>…</bash-stdout>d` cannot
  // become `und` (round 17); the reply scorer keeps deletion (round 18).
  const lines = text.replace(TERMINAL_PANE_REGION, separator).split("\n");
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
