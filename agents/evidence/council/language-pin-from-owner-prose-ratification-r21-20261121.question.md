<!-- evidence-type: analysis -->

# Ratification review — the owner-prose language pin and its bundle raise — round 21

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose dispatch-bundle byte ceiling the change raises. The code that grew the bundle is shown below so the raise can be judged against it.

subject: 9b8c75e9dcc03086e101fa17e3045f2d269a9a64db23f630ec642b20431357bb

(The digest covers the gated files at commit `4bc92e4dfa` on branch `feat/a-language-pin-from-owner-prose`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

The reply-language pin (a `UserPromptSubmit` hook that records which language the owner writes in) used to score the typed lead of a prompt and, when the lead had fewer than two language markers, the WHOLE prompt body, so a pasted log or document decided the pin. The turn-end gate then refused replies in the owner's real language. The change:

- `ownerSpans` / `ownerProse` (`src/scripts/_lib/prompt_shape.ts`): only the opening paragraph (the lead) and the paragraph after the last output paste (the trailing span) are owner text; fenced code, output-shaped lines, a pasted document and fixed host-turn heads yield nothing. A trailing span glued to the paste (no blank line) is read only when the prompt has no lead and at least two output lines stand DIRECTLY above it (one consecutive run; output lines in earlier blocks do not count).
- `classify` (`src/scripts/language_mirror_hook.ts`) takes its candidate verdict from the owner spans (lead + trailing span) and then applies ONE veto: when the RAW prompt — nothing removed at all, not host wrappers, not terminal-pane echoes, not any tag pair, not code, fences, output or documents — carries at least two markers (`MIN_MARKERS`) of the language OPPOSING the candidate, the verdict is `und` and the previous pin stays (checked directly: `opposing >= MIN_MARKERS`, not through the spans being a subset of the raw text). `ownerProse` now returns the prompt itself as `text`; `stripHostRegions` is deleted. **Invariant, checkable from the code in four lines:** a pin in language X is written only when the prompt holds fewer than two markers of the other language anywhere in its raw text. No reader (span, fence, region strip) can change a marker count the veto sees, so owner text that reaches the floor in one language can never be outvoted by pasted text in the other. There is no whole-body fallback: owner spans under the floor give `und`. The old scorer is kept as `classifyText` for replies and injected bodies, so the gate's reply scoring is unchanged.
- The span reader reads fences line by line, close to CommonMark; a list-item closer may sit up to three columns past the item's content column, now measured in display columns (tab to the next multiple of four), for the opener and the closer alike; a tab-indented top-level line is no closer. This only chooses the candidate; it cannot defeat the veto.
- Every pin records `owner_prose_chars` (0 on a locale pin).
- `gatePinLanguage` (`src/scripts/hooks/language_pin_gate.ts`, called from `readLanguagePin` in `turn_end_gate_hook.ts`): the gate refuses on language only when the pin's `source` is `prompt` and `owner_prose_chars`, when present, is a positive integer. A pin carrying the count must say `source: prompt`; only a pin missing both fields, or a prompt pin missing the count (written before the field existed), keeps the language-only reading.

**The claim, scoped.** For a GIVEN pin record the gate can only refuse fewer replies: every path added to the gate returns `und` (no obligation) or the language it returned before. Across turns the pin itself is set less often, and that is a trade-off, not a monotone improvement: it is the owner's recorded decision D1 ("an undetermined owner span keeps the previous pin") and the council's D5 (floor) and D7 (whole-text veto). No gate is removed, no exit code is added, no permission or allowlist is touched.

## History

Round 20 refused 2/2. Findings and what changed (commit `4bc92e4dfa`):

- **A space-only context row reset the hunk scan** (both seats), and **context rows ` ```text` / ` ```` were collapsed by the fence reader before the hunk scan** (openai), so the `-` / `+` rows became the trailing span again. `collapseHunks` now runs on the raw lines BEFORE `fenced` and follows the declared `@@ -a,b +c,d @@` lengths: `-` and `+` rows consume their side, a context row (leading space, or an empty row whose space was trimmed) consumes both, a `\` row belongs to the row above, and the hunk ends when both counts reach zero. Regression tests through the production `readLanguagePin` for both patch shapes (an earlier German pin survives each), red first. A typed bullet after a completed hunk stays owner prose (guard test; the declared length stops the scan).
- On the deferred items: (a) five-space list opener and (b) EOF fallback stay as documented trade-offs (both seats said they can be deferred or stand); (c) no smaller implementation was measured.

Round 19: a pasted unified diff pinned from its hunk lines; hunk bodies are now patch content. Round 18: the word-boundary separator is owner-prose only; an unindented line ends a list item and its fence. Rounds 1-17 are in the committed `r1` … `r20` questions beside this file; the six `de` → `und` host-wrapper rows (a missed update, never an override) were accepted by both round-15 seats.

**Please keep two classes apart.** An OVERRIDE is a pin written in language X while the owner's own typed text reaches the floor in language Y — the invariant says it cannot happen, and a counterexample is a blocker. A MISSED UPDATE leaves the previous pin in place (`und`) although the owner typed enough to set one — the recorded cost of owner decision D1 and of D7; report it, but it is not an authority or safety defect.

## What to answer

1. Does the diff contain a defect — in the span reader, the classifier, the pin field, the gate's reading of it, or the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond the intended narrowing of the language refusal? Is the ceiling raise sized to the measurement?
3. Is there a prompt shape where an owner's own confident typed language would now be overridden by pasted text (not merely left undetermined)? The known residuals stay as documented in `ownerSpans`: a prompt consisting ONLY of a paste that ends in an unmarked prose paragraph can pin from that paragraph, and a typed line that starts like output (`Error: …`) or like a document head (`# …`), or sits inside a fence, is read as paste; none of them leaves owner prose at the floor for the veto to protect. A single line mixing typed and pasted text is one unit.
4. Does `collapseHunks` (declared lengths, run before the fence reader) close the round-19/20 class?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
origin/main 4bb96fb2fb:  ✅  hook bundle: 1595228 B / 1595300 B ceiling, 1 YAML reader(s) [yaml], 343 modules
this branch 4bc92e4dfa:  ✅  hook bundle: 1599799 B / 1599996 B ceiling, 1 YAML reader(s) [yaml], 344 modules
delta: +4,571 B; ceiling 1,595,300 -> 1,599,996 (final reading + 197 B)
```

## The diff of the bundled sources and the budget file (origin/main...4bc92e4dfa)

````diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..4a5f01ee4c 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1599996,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -287,6 +287,15 @@
             "what_was_added": "The generation lock (`_lib/generation_lock.ts`) behind `state_io`, the language-mirror tool lock and the egress session table, replacing their stat-then-remove reclaim, which let two callers hold after a stale break or a release. Measured by this gate: 1,595,152 B with the change against 1,595,013 B on origin/main 24f323151a, +139 B; the old lock code that left `state_io` and the language mirror pays for most of the helper.",
             "why_it_could_not_be_avoided": "The change fitted under the old ceiling until its last two review rounds: a completion review measured `state_io`'s 5 s wait at 7.2-11.9 s, which needed a wall-clock deadline, and ratification round 16 asked that no attempt start after it, which needs a capped sleep and a check after it. Room was made first: the release wrapper and the try blocks around a release that cannot throw were removed, the pruner's lock cleanup became one acquire-and-release, and the wait loop was written in its shortest form. Sized to the measurement plus 148 B.",
             "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading."
+        },
+        {
+            "date": "2026-11-21",
+            "from": 1595300,
+            "to": 1599996,
+            "by": "agent, feat/a-language-pin-from-owner-prose (road-to-a-language-pin-from-owner-prose 4.2)",
+            "what_was_added": "The owner-prose language pin: `ownerSpans` and `ownerProse` in `_lib/prompt_shape.ts` (the opening paragraph and the paragraph after the last output paste; host-turn heads yield nothing), `classify` in `language_mirror_hook.ts` scoring only that text — vetoed to `und`, so the previous pin stays, whenever the RAW prompt (nothing removed: code, pastes and every tag-wrapped region, host wrappers included, count) carries the marker floor of the language opposing the candidate (checked directly, not through the spans), which means pasted prose or a host wrapper can prevent a pin update, and pasted prose can make one only where the prompt holds fewer than the floor of the other language anywhere, so owner text at the floor is never overridden — with the old lead-then-body scorer kept as `classifyText` for replies, `owner_prose_chars` on every pin, and `gatePinLanguage` (`hooks/language_pin_gate.ts`, its own module so the gate stays under the source-size cap; 344 modules against 343) so the gate refuses on language only behind an owner-prose pin. Measured by this gate: 1,599,799 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +4,571 B, both builds with APFS-cloned node_modules.",
+            "why_it_could_not_be_avoided": "The pin had to stop reading the whole prompt (owner decision D1 of the roadmap), which needs a span reader the bundle did not have; the replaced whole-body fallback was only a branch, so nothing left with it. The new code is already lean in the bundle (comments are stripped, the span reader is one loop pair), and the remaining shrink candidates are other concerns' code, which this change has no business editing. The pin and the gate both run in the dispatch bundle, so the code cannot move to a chunk without making every prompt submit load one.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading after the change. Sized to the final reading after ratification rounds 1-21 plus 197 B, on the same doctrine as the 2026-11-13 entries."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/prompt_shape.ts b/src/scripts/_lib/prompt_shape.ts
index b8b840c427..02d7bea22d 100644
--- a/src/scripts/_lib/prompt_shape.ts
+++ b/src/scripts/_lib/prompt_shape.ts
@@ -144,6 +144,238 @@ export function humanAuthoredLead(text: string): string {
   return kept.join("\n");
 }
 
+/**
+ * A line that starts pasted machine OUTPUT — a stack trace, a diff, a `remote:`
+ * line, a shell prompt, a table row. Shared by `instructionText` (which drops
+ * these lines) and `ownerSpans` (which treats the first one as the end of the
+ * owner's lead and the last one as the start of their trailing line).
+ */
+export const OUTPUT_HEAD =
+  /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|npm ERR!|Error:|Traceback|Exception|[A-Za-z]*Error\b|at\s+\S+:\d+|\s{4,}\S|[-+]{3}\s|@@\s|\$\s|>\s|\||\d+\s*\|)/i;
+
+/** One line standing in for a removed fenced block, so its position survives. */
+const FENCE_LINE = "\u0000";
+
+/**
+ * The prompt's lines with every fenced block collapsed to one `FENCE_LINE`.
+ * Line-aware, as CommonMark reads fences: a fence opens only on a line that
+ * starts, after at most three spaces and an optional list marker, with three or more backticks (no
+ * backtick after them, so inline ` ``` ` in a sentence opens nothing) or
+ * tildes (whose info string may hold tildes), and closes on a line of the same
+ * character at least as long, indented at most three columns past the opener's
+ * content column (column 0 outside a list; a tab advances to the next multiple
+ * of four, so a tab-indented top-level line is no closer) and followed only by spaces or tabs
+ * (not a no-break space); an unclosed
+ * fence is no fence — its lines stay, so a misread opener can never hide what
+ * follows it. CR, CRLF and LF all end a line.
+ */
+function fenced(text: string): string[] {
+  const out: string[] = [];
+  let fence = "";
+  let indent = 3;
+  let content = 0;
+  let held: string[] = [];
+  for (const line of text.split(/\r\n?|\n/)) {
+    // An opener may follow a list marker (`- ```, `10. ```), as inside a
+    // Markdown list item; its closer may then be indented up to three spaces
+    // past the item's content column, as CommonMark allows.
+    const open = /^( {0,3})((?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}(?=[^`]*$)|~{3,})/.exec(line);
+    const lead = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/.exec(line);
+    // A non-blank line left of a list item's content column ends the item and
+    // the fence inside it; the line is then read afresh (round 18).
+    if (fence !== "" && content > 0 && line.trim() !== "" && columns(/^[ \t]*/.exec(line)?.[0] ?? "") < content) {
+      out.push(FENCE_LINE);
+      fence = "";
+    }
+    if (fence === "" && open === null) {
+      out.push(line);
+    } else if (fence === "") {
+      fence = open?.[3] ?? "";
+      // Outside a list a closer takes at most three spaces, whatever the
+      // opener's own indent; inside one, three past the item's content column.
+      content = open?.[2] === undefined ? 0 : columns(`${open[1] ?? ""}${open[2]}`);
+      indent = content === 0 ? 3 : content + 3;
+      held = [line];
+    } else if (lead !== null && columns(lead[1] ?? "") <= indent && (lead[2] ?? "").startsWith(fence)) {
+      out.push(FENCE_LINE);
+      fence = "";
+    } else {
+      held.push(line);
+    }
+  }
+  // A fence that never closes hides nothing: a misread opener must not swallow
+  // the owner's text below it.
+  if (fence !== "") for (const line of held) out.push(line);
+  return out;
+}
+
+/**
+ * A unified-diff hunk body is patch content, never prose: the rows under an
+ * `@@ -a,b +c,d @@` head are collapsed to `FENCE_LINE` by the row prefixes and
+ * the declared lengths — before the fence reader can read a context row as a
+ * fence, and without running past the hunk's end (rounds 19-20). An empty row
+ * is a context row whose leading space was trimmed.
+ */
+function collapseHunks(lines: string[]): string[] {
+  const out = [...lines];
+  for (let i = 0; i < out.length; i++) {
+    const head = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(out[i] ?? "");
+    if (head === null) continue;
+    let old = head[1] === undefined ? 1 : Number(head[1]);
+    let neu = head[2] === undefined ? 1 : Number(head[2]);
+    for (let j = i + 1; j < out.length; j++) {
+      const row = out[j] ?? "";
+      if (row.startsWith("\\")) {
+        // `\ No newline at end of file` belongs to the row above it.
+      } else if (old === 0 && neu === 0) break;
+      else if (row.startsWith("-") && old > 0) old--;
+      else if (row.startsWith("+") && neu > 0) neu--;
+      else if ((row === "" || row.startsWith(" ")) && old > 0 && neu > 0) (old--, neu--);
+      else break;
+      out[j] = FENCE_LINE;
+      i = j;
+    }
+  }
+  return out;
+}
+
+/** The display width of a line prefix, tabs to the next multiple of four. */
+function columns(prefix: string): number {
+  let width = 0;
+  for (const ch of prefix) width = ch === "\t" ? width + 4 - (width % 4) : width + 1;
+  return width;
+}
+
+/** The two spans of a prompt the owner typed, as `ownerSpans` finds them. */
+export interface OwnerSpans {
+  /** The first paragraph, up to the first blank line or paste line. */
+  lead: string;
+  /** The paragraph after the last output paste, when one follows it. */
+  trailing: string;
+}
+
+/**
+ * The spans of a prompt the owner typed: the opening paragraph, and the
+ * paragraph after the last pasted output block. Nothing in between.
+ *
+ * Callers pass text with injected regions already removed
+ * (`stripInjectedRegions`). Fenced code, output-shaped lines and document heads
+ * are paste furniture; the owner's words sit around them, not inside them.
+ *
+ * The lead is ONE paragraph, not everything before the first document head as
+ * `humanAuthoredLead` reads it. A German sentence over an English paragraph
+ * pasted without a heading was scored as one lead, and the paste outvoted the
+ * sentence (`Behebe das bitte.` over an English paragraph pinned `en`, de=2 /
+ * en=9). A blank line is the one boundary a paste reliably carries.
+ *
+ * The trailing span answers the shape the lead cannot: a terminal block pasted
+ * first and the owner's question typed below it. It is taken only after an
+ * OUTPUT paste or a fence — never after a document head, because every
+ * paragraph below a pasted heading is that document's body, and reading its
+ * last paragraph as typed would hand the pin back to the paste.
+ *
+ * Both spans are returned as found; neither is dropped in favour of the other.
+ * Deciding whether they can be trusted is the scorer's job: `classify` in the
+ * language mirror vetoes the spans' verdict when the raw prompt (nothing
+ * removed, tag-wrapped regions included) carries the marker floor of both
+ * languages, so a misread boundary here can cost a pin but never hand one to a
+ * paste.
+ *
+ * A trailing span with no blank line between it and the paste is weaker
+ * evidence than a lead: it is read only when the prompt has no lead. A wrapped
+ * error message (`mach das:` over `Error: …` continued on unmarked lines) would
+ * otherwise drop the owner's lead and pin the paste's continuation.
+ *
+ * KNOWN RESIDUALS, stated rather than hidden: a prompt that OPENS with a paste
+ * ending in an unmarked prose line, with no typed text after it, yields that
+ * line as the trailing span; and a typed line that itself starts like output
+ * (`Error: …`) or like a document head (`# …`), or sits inside a fence, is read
+ * as paste. None of them leaves owner prose the reader can see, so none has
+ * anything for the veto to protect. And a single line that mixes typed and
+ * pasted text (`mach das: <long English error>`) is one unit; its markers
+ * decide it as a whole. More generally, pasted prose can set a pin
+ * only where the owner's own text is under the floor in the other language
+ * (`Fix.` over `Error: x` and an English explanation pins English): the veto
+ * protects owner text that reaches the floor, not owner text that does not.
+ */
+export function ownerSpans(text: string): OwnerSpans {
+  const lines = fenced(collapseHunks(text.split(/\r\n?|\n/)).join("\n"));
+  // `OUTPUT_HEAD`'s `To <x>` arm is git's push line, one token after `To`; a
+  // sentence such as `To fix this, …` is the owner's, not output.
+  const blank = (l: string): boolean => l.trim() === "";
+  // Blank lines never reach `OUTPUT_HEAD`: its leading `\s*` and `\s{4,}\S`
+  // backtrack against each other on a whitespace-only line.
+  const isOutput = (l: string): boolean =>
+    l === FENCE_LINE || (!blank(l) && OUTPUT_HEAD.test(l) && !/^\s*To\s+\S+\s+\S/i.test(l));
+  const isPaste = (l: string): boolean => isOutput(l) || (!blank(l) && DOCUMENT_HEAD.test(l));
+
+  const lead: string[] = [];
+  for (const line of lines) {
+    if (blank(line)) {
+      if (lead.length > 0) break;
+      continue;
+    }
+    if (isPaste(line)) break;
+    lead.push(line);
+  }
+
+  let end = lines.length - 1;
+  while (end >= 0 && blank(lines[end] ?? "")) end--;
+  let start = end;
+  while (start >= 0 && !blank(lines[start] ?? "") && !isPaste(lines[start] ?? "")) start--;
+  const before = lines.slice(0, start + 1);
+  const candidate =
+    start >= 0 && start < end && before.some(isOutput) && !before.some((l) => DOCUMENT_HEAD.test(l))
+      ? lines.slice(start + 1, end + 1)
+      : [];
+  // A span glued to the paste's last line is as likely the paste's own wrapped
+  // continuation as a typed line; it counts only when there is no lead to read
+  // and at least two output lines stand DIRECTLY above it, so one prose line
+  // that happens to look like output cannot hand the pin to the line below it,
+  // and an output line in an earlier block does not count toward the two.
+  const separated = blank(lines[start] ?? "");
+  let run = 0;
+  while (run <= start && isOutput(lines[start - run] ?? "")) run++;
+  const glued = lead.length === 0 && run >= 2;
+  const trailing = separated || glued ? candidate : [];
+
+  return { lead: lead.join("\n"), trailing: trailing.join("\n") };
+}
+
+/**
+ * Host turns that carry no envelope tag and that `isSyntheticPrompt`
+ * deliberately does not know, because that predicate also draws turn
+ * boundaries for the gate's other detectors. Each is a FIXED host string
+ * anchored at character zero — the same admissibility argument as the
+ * usage-limit resume sentence above — and each was found pinning in the
+ * language-split baseline (`synthetic-turn`, 2026-11-21): stop-hook feedback,
+ * the compaction continuation summary, the usage-limit notes.
+ *
+ * Scoped to the PIN: `ownerProse` returns nothing for them, so they never set
+ * a language, while turn boundaries stay exactly where they were.
+ */
+const HOST_TURN_HEAD =
+  /^(Stop hook feedback:|This session is being continued from a previous conversation|\[Usage limit reached|\[Earlier usage-limit notes)/;
+
+/**
+ * The text of a prompt the owner typed, and nothing else — the only input the
+ * language pin is allowed to read (road-to-a-language-pin-from-owner-prose,
+ * owner decision D1).
+ *
+ * Order: a host-generated turn yields nothing; injected regions are removed;
+ * then `ownerSpans` keeps the opening paragraph and the paragraph after the
+ * last output paste. Fenced code, output-shaped lines, a pasted document and
+ * every paragraph between two pastes are dropped. There is no whole-body
+ * fallback: a prompt whose owner spans are undetermined is undetermined, and
+ * the caller keeps the previous pin.
+ */
+export function ownerProse(prompt: string): OwnerSpans & { text: string } {
+  if (isSyntheticPrompt(prompt) || HOST_TURN_HEAD.test(prompt.trimStart())) {
+    return { lead: "", trailing: "", text: "" };
+  }
+  return { ...ownerSpans(stripInjectedRegions(prompt, " ")), text: prompt };
+}
+
 /** A line that is nothing but an opening tag, with the tag name captured. */
 const REGION_OPEN = /^\s*<([A-Za-z][\w-]*)>\s*$/;
 
@@ -213,8 +445,10 @@ const TERMINAL_PANE_REGION = /<(bash-input|bash-stdout|bash-stderr)>[\s\S]*?<\/\
  * wrappers do not nest by name, and stopping early keeps more human text than
  * scanning past the wrong close would.
  */
-export function stripInjectedRegions(text: string): string {
-  const lines = text.replace(TERMINAL_PANE_REGION, "").split("\n");
+export function stripInjectedRegions(text: string, separator = ""): string {
+  // `ownerProse` passes a space so `un<bash-stdout>…</bash-stdout>d` cannot
+  // become `und` (round 17); the reply scorer keeps deletion (round 18).
+  const lines = text.replace(TERMINAL_PANE_REGION, separator).split("\n");
   const kept: string[] = [];
   for (let i = 0; i < lines.length; i++) {
     const line = lines[i] ?? "";
diff --git a/src/scripts/hooks/language_pin_gate.ts b/src/scripts/hooks/language_pin_gate.ts
new file mode 100644
index 0000000000..9897dd9584
--- /dev/null
+++ b/src/scripts/hooks/language_pin_gate.ts
@@ -0,0 +1,25 @@
+import type { Verdict } from '../language_mirror_hook.js';
+
+/**
+ * The language a pin obliges the reply to, or `und` when the pin was not set
+ * by owner prose (road-to-a-language-pin-from-owner-prose, D1). A locale pin
+ * reflects the machine, and a prompt pin with `owner_prose_chars: 0` has no
+ * typed text behind it; refusing a reply on either refuses the owner for
+ * something they never wrote. A present `owner_prose_chars` that is not a
+ * positive integer is malformed and obliges nothing either. Only a pin missing
+ * BOTH fields, or a prompt pin missing the count, was written before they
+ * existed and keeps the language-only reading; a pin that carries a count must
+ * also say `source: prompt`, and a locale pin is exempt either way.
+ *
+ * Pure and in its own module, so the turn-end gate and
+ * `measure_turn_end_gate --language-split` apply the same rule.
+ */
+export function gatePinLanguage(pin: Record<string, unknown>): Verdict {
+    const lang = pin['language'];
+    if (lang !== 'de' && lang !== 'en') return 'und';
+    const source = pin['source'];
+    const chars = pin['owner_prose_chars'];
+    if (source !== 'prompt' && (source !== undefined || chars !== undefined)) return 'und';
+    if (chars !== undefined && !(typeof chars === 'number' && Number.isInteger(chars) && chars > 0)) return 'und';
+    return lang;
+}
diff --git a/src/scripts/hooks/turn_end_gate_hook.ts b/src/scripts/hooks/turn_end_gate_hook.ts
index cb948cdbcb..781db70c28 100644
--- a/src/scripts/hooks/turn_end_gate_hook.ts
+++ b/src/scripts/hooks/turn_end_gate_hook.ts
@@ -162,7 +162,7 @@ import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import {
-    classify,
+    classifyText,
     hasStableSessionId,
     statePathFor as languageStatePathFor,
     type Verdict,
@@ -223,6 +223,7 @@ import {
 export { detectDroppedDecision };
 import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
+import { gatePinLanguage } from './language_pin_gate.js';
 import {
     atomic_write_json,
     is_replay_mode,
@@ -650,8 +651,7 @@ export function readLanguagePin(workspaceRoot: string, session_id: string): Verd
         // accepting it is the cross-session read the split closed.
         if (!ownsSessionState(decoded, session_id)) return 'und';
         if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
-            const lang = (decoded as Record<string, unknown>)['language'];
-            if (lang === 'de' || lang === 'en') return lang;
+            return gatePinLanguage(decoded as Record<string, unknown>);
         }
     } catch {
         // no pin, unreadable pin, malformed pin — all mean "no obligation"
@@ -661,12 +661,12 @@ export function readLanguagePin(workspaceRoot: string, session_id: string): Verd
 
 /**
  * Fires only when the classifier is CONFIDENT the prose is the other
- * language. `classify` returns `und` below its marker floor, and `und`
+ * language. `classifyText` returns `und` below its marker floor, and `und`
  * never fires — a short reply is not evidence of drift.
  *
  * WHAT IS ACTUALLY CLASSIFIED, stated accurately because R2 finding 9 caught
  * this file claiming otherwise in three places. `visibleProse` strips code,
- * quotes, tables, URLs and paths from the whole reply — but `classify` then
+ * quotes, tables, URLs and paths from the whole reply — but `classifyText` then
  * applies `stripInjectedRegions` (which removes balanced host wrapper regions
  * such as `<launch-selected-element>`, plus the host's advisory sentence beside
  * them), then `instructionText` (which drops output-shaped lines and their
@@ -682,17 +682,19 @@ export function readLanguagePin(workspaceRoot: string, session_id: string): Verd
  * scoring surface accurately is this comment's entire job.
  *
  * That is deliberately left as-is rather than swapped for a full-text scorer:
- * sharing one classifier with `language_mirror_hook` is what stops the pin and
- * the detector disagreeing about what language a turn is in, and changing the
- * scoring surface would change the measured rate, which needs its own
- * measurement rather than a quiet edit. What is fixed here is the CLAIM —
+ * the reply shares the pin's marker lists and floor, so the two cannot disagree
+ * about what a marker is, and changing the scoring surface would change the
+ * measured rate, which needs its own measurement rather than a quiet edit. The
+ * PIN no longer goes through `classifyText` — it is scored from owner prose only
+ * (`classify`, road-to-a-language-pin-from-owner-prose) — while the reply keeps
+ * this surface unchanged. What is fixed here is the CLAIM —
  * including the one this function used to put in its own refusal text, where an
  * inflated description of the evidence is worst.
  */
 export function detectLanguage(reply: string, pinned: Verdict): Finding | null {
     if (pinned !== 'de' && pinned !== 'en') return null;
     const prose = visibleProse(reply);
-    const verdict = classify(prose);
+    const verdict = classifyText(prose);
     if (verdict.language === 'und') return null;
     if (verdict.language === pinned) return null;
     return {
@@ -702,7 +704,7 @@ export function detectLanguage(reply: string, pinned: Verdict): Finding | null {
             `the pinned reply language is "${pinned}" but the reply classifies as ` +
             `"${verdict.language}" (${verdict.de_markers} de / ${verdict.en_markers} en markers; ` +
             'code, quotes, tables, URLs and paths excluded, then scored lead-first ' +
-            'by the same classifier that sets the pin)',
+            'with the same marker lists that set the pin)',
     };
 }
 
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index 1d053f8fd8..1a84ef720b 100644
--- a/src/scripts/language_mirror_hook.ts
+++ b/src/scripts/language_mirror_hook.ts
@@ -90,8 +90,10 @@ import {
 } from "./hooks/state_io.js";
 import { readHookStdin } from "./hooks/hook_stdin.js";
 import {
+  OUTPUT_HEAD,
   humanAuthoredLead,
   isSyntheticPrompt,
+  ownerProse,
   stripInjectedRegions,
 } from "./_lib/prompt_shape.js";
 import { loadSessionPins } from "./hooks/session_pins_loader.js";
@@ -251,10 +253,15 @@ export const MIN_MARKERS = 2;
 
 export type Verdict = "de" | "en" | "und";
 
+/** A prompt's classification: it always says how much owner prose stood behind it. */
+export type PromptClassification = Classification & { owner_prose_chars: number };
+
 export interface Classification {
   language: Verdict;
   de_markers: number;
   en_markers: number;
+  /** Characters of owner prose scored — set by `classify`, absent from `classifyText`. */
+  owner_prose_chars?: number;
 }
 
 /**
@@ -273,8 +280,6 @@ export interface Classification {
  * target. The maintainer's most common prompt shape is exactly that.
  */
 export function instructionText(prompt: string): string {
-  const OUTPUT_HEAD =
-    /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|npm ERR!|Error:|Traceback|Exception|[A-Za-z]*Error\b|at\s+\S+:\d+|\s{4,}\S|[-+]{3}\s|@@\s|\$\s|>\s|\||\d+\s*\|)/i;
   const kept: string[] = [];
   let inPaste = false;
   for (const line of prompt.replace(/```[\s\S]*?```/g, "\n\n").split("\n")) {
@@ -300,19 +305,42 @@ export function instructionText(prompt: string): string {
 
 
 /**
- * Classify a prompt, reading the TYPED LEAD before the whole body.
+ * Classify a PROMPT for the pin: only text the owner typed decides it (D1).
+ * Candidate: `ownerProse(prompt)` — the lead and the paragraph after the last
+ * paste — under `MIN_MARKERS` (D5), with NO whole-body fallback; `und` keeps the
+ * previous pin. Veto: the candidate becomes `und` whenever the RAW prompt, with
+ * nothing removed (a pasted wrapper tag is byte-identical to the host's own),
+ * holds `MIN_MARKERS` of the opposing language — so owner text at the floor is
+ * never outvoted. Cost (D7): an instruction beside a paste or host wrapper in
+ * the other language keeps the previous pin. Replies use `classifyText`.
+ */
+export function classify(prompt: string): PromptClassification {
+  const { lead, trailing, text } = ownerProse(prompt);
+  const owner = [lead, trailing].filter((s) => s.trim() !== "").join("\n\n");
+  const verdict = _score(owner);
+  const all = _score(text);
+  // Checked directly, not via the spans being a subset of the raw text (round 15).
+  const opposing =
+    verdict.language === "de" ? all.en_markers : verdict.language === "en" ? all.de_markers : 0;
+  const language = opposing >= MIN_MARKERS ? "und" : verdict.language;
+  return { ...verdict, language, owner_prose_chars: owner.length };
+}
+
+/**
+ * Classify a TEXT the owner did not necessarily type — a reply, an injected
+ * body — reading its lead before the whole body.
  *
  * `instructionText` removes output-shaped pastes — traces, diffs, `remote:`
  * lines. It does not remove the other paste shape, which looks like prose: a
- * document pasted whole under its own headings below one typed sentence. That
- * gap is not hypothetical; it fired on the session that received the round-6
- * review, pinning English because an English draft sat under German prose.
+ * document pasted whole under its own headings below one typed sentence.
  *
  * So the lead is classified first, and only if it is undetermined does the full
- * text decide. This is bidirectional by construction — it names no language, and
- * an English instruction over a German paste resolves to English by the same
- * step. The fallback is what keeps it conservative: a prompt with no document
- * marker classifies exactly as it did before.
+ * text decide. That is bidirectional only for leads carrying `MIN_MARKERS` or
+ * more: below the floor the whole text decides, and a short lead over a long
+ * body in the other language resolves to the body's language in either
+ * direction. Prompts no longer go through here for exactly that reason (see
+ * `classify`); the turn-end gate and the conformance scanner score replies with
+ * it, and their measured rates rest on this surface staying as it is.
  *
  * `stripInjectedRegions` runs FIRST, and the order is load-bearing rather than
  * tidy. A host wrapper the user never typed — `<launch-selected-element>` — is
@@ -322,7 +350,7 @@ export function instructionText(prompt: string): string {
  * keeps the block's indented lines from arming that filter's paste state, which
  * was deleting the user's own sentence outright.
  */
-export function classify(prompt: string): Classification {
+export function classifyText(prompt: string): Classification {
   const text = instructionText(stripInjectedRegions(prompt));
   const lead = humanAuthoredLead(text);
   const leadVerdict = _score(lead);
@@ -332,6 +360,11 @@ export function classify(prompt: string): Classification {
   return _score(text);
 }
 
+/** Score one span with the marker lists and floor only (for `--language-split`). */
+export function scoreText(text: string): Classification {
+  return _score(text);
+}
+
 function _score(text: string): Classification {
   const de = (text.match(DE_MARKERS) ?? []).length;
   const en = (text.match(EN_MARKERS) ?? []).length;
@@ -474,6 +507,8 @@ export interface PinState extends JsonObject {
    * every state written before this field existed is still a valid pin.
    */
   tool_calls_since_pin?: number;
+  /** Owner-prose characters behind the pin; 0 on a locale pin. The gate refuses only above 0. */
+  owner_prose_chars?: number;
 }
 
 function _loadState(target: string): Partial<PinState> {
@@ -541,7 +576,7 @@ export const REEMIT_AFTER_TOOL_CALLS = 150;
  */
 export function nextState(
   previous: Partial<PinState>,
-  classification: Classification,
+  classification: PromptClassification,
   prompt_chars: number,
   session_id: string,
   now: string,
@@ -589,6 +624,7 @@ export function nextState(
       en_markers: classification.en_markers,
       session_id,
       tool_calls_since_pin: 0,
+      owner_prose_chars: 0,
     };
   }
   return {
@@ -600,6 +636,7 @@ export function nextState(
     en_markers: classification.en_markers,
     session_id,
     tool_calls_since_pin: 0,
+    owner_prose_chars: classification.owner_prose_chars,
   };
 }
 
````

## The test changes of round 21 (5a40adb48f...4bc92e4dfa; earlier rounds are in the committed questions)

````diff
diff --git a/tests/scripts/language_mirror_hook.test.ts b/tests/scripts/language_mirror_hook.test.ts
index 83982ffa4b..7578c73372 100644
--- a/tests/scripts/language_mirror_hook.test.ts
+++ b/tests/scripts/language_mirror_hook.test.ts
@@ -2179,6 +2179,28 @@ describe("owner prose only", () => {
     expect(readLanguagePin(tmp, sid)).toBe("de");
   });
 
+  it("a hunk with an empty context row or fenced context rows still never pins", () => {
+    // Ratification round 20: a space-only context row reset the hunk scan, and
+    // context rows ` ```text` / ` ```` were collapsed by the fence reader first.
+    const patches = [
+      ["--- a/x", "+++ b/x", "@@ -1,3 +1,3 @@", " ", "-the output was there and it is gone", "+the padding is missing here and that should be fixed"],
+      ["--- a/x", "+++ b/x", "@@ -1,3 +1,3 @@", " ```text", "-the output was there and it is gone", "+the padding is missing here and that should be fixed", " ```"],
+    ];
+    patches.forEach((rows, n) => {
+      const sid = `5d2e8f10-6a4b-4c3d-9e8f-00000000000${n}`;
+      const patch = rows.join("\n");
+      expect(ownerSpans(patch).trailing).toBe("");
+      run(envelope("Bitte prüfe das und mach dann weiter mit den Tests.", sid), { consumer_root: tmp, env: {} });
+      run(envelope(patch, sid), { consumer_root: tmp, env: {} });
+      expect(readLanguagePin(tmp, sid)).toBe("de");
+    });
+  });
+
+  it("a hunk ends at its declared length, so a typed bullet after it stays owner prose", () => {
+    const p = ["--- a/x", "+++ b/x", "@@ -1 +1 @@", "-alt", "+neu", "", "- bitte prüfe das und mach dann weiter"].join("\n");
+    expect(ownerSpans(p).trailing).toBe("- bitte prüfe das und mach dann weiter");
+  });
+
   it("malformed counts and a count without a source oblige nothing", () => {
     expect(gatePinLanguage({ language: "de", source: "prompt", owner_prose_chars: -1 })).toBe("und");
     expect(gatePinLanguage({ language: "de", source: "prompt", owner_prose_chars: 0.5 })).toBe("und");
````
