<!-- evidence-type: analysis -->

# Ratification review — the owner-prose language pin and its bundle raise — round 16

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose dispatch-bundle byte ceiling the change raises. The code that grew the bundle is shown below so the raise can be judged against it.

subject: 13e0101a2efb430e3cf80ba8a2339d9934aa52bea95cb7dd2fff62a3295ee715

(The digest covers the gated files at commit `adf8495419` on branch `feat/a-language-pin-from-owner-prose`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

The reply-language pin (a `UserPromptSubmit` hook that records which language the owner writes in) used to score the typed lead of a prompt and, when the lead had fewer than two language markers, the WHOLE prompt body, so a pasted log or document decided the pin. The turn-end gate then refused replies in the owner's real language. The change:

- `ownerSpans` / `ownerProse` (`src/scripts/_lib/prompt_shape.ts`): only the opening paragraph (the lead) and the paragraph after the last output paste (the trailing span) are owner text; fenced code, output-shaped lines, a pasted document and fixed host-turn heads yield nothing. A trailing span glued to the paste (no blank line) is read only when the prompt has no lead and at least two output lines stand above it.
- `classify` (`src/scripts/language_mirror_hook.ts`) takes its candidate verdict from the owner spans (lead + trailing span) and then applies ONE veto: when the RAW prompt — nothing removed at all, not host wrappers, not terminal-pane echoes, not any tag pair, not code, fences, output or documents — carries at least two markers (`MIN_MARKERS`) of the language OPPOSING the candidate, the verdict is `und` and the previous pin stays (checked directly: `opposing >= MIN_MARKERS`, not through the spans being a subset of the raw text). `ownerProse` now returns the prompt itself as `text`; `stripHostRegions` is deleted. **Invariant, checkable from the code in four lines:** a pin in language X is written only when the prompt holds fewer than two markers of the other language anywhere in its raw text. No reader (span, fence, region strip) can change a marker count the veto sees, so owner text that reaches the floor in one language can never be outvoted by pasted text in the other. There is no whole-body fallback: owner spans under the floor give `und`. The old scorer is kept as `classifyText` for replies and injected bodies, so the gate's reply scoring is unchanged.
- The span reader reads fences line by line, close to CommonMark; a list-item closer may sit up to three columns past the item's content column, now measured in display columns (tab to the next multiple of four), for the opener and the closer alike; a tab-indented top-level line is no closer. This only chooses the candidate; it cannot defeat the veto.
- Every pin records `owner_prose_chars` (0 on a locale pin).
- `gatePinLanguage` (`src/scripts/hooks/turn_end_gate_hook.ts`): the gate refuses on language only when the pin's `source` is `prompt` and `owner_prose_chars`, when present, is a positive integer. A pin carrying the count must say `source: prompt`; only a pin missing both fields, or a prompt pin missing the count (written before the field existed), keeps the language-only reading.

**The claim, scoped.** For a GIVEN pin record the gate can only refuse fewer replies: every path added to the gate returns `und` (no obligation) or the language it returned before. Across turns the pin itself is set less often, and that is a trade-off, not a monotone improvement: it is the owner's recorded decision D1 ("an undetermined owner span keeps the previous pin") and the council's D5 (floor) and D7 (whole-text veto). No gate is removed, no exit code is added, no permission or allowlist is touched.

## History

Round 15: anthropic `confirmed-non-expanding` (high, no dealbreaker); openai REQUEST_CHANGES. Both seats accepted the six `de` → `und` expectation changes. Findings and what changed (commit `adf8495419`):

- **The veto relied on an implicit property** (spans a subset of the raw text). Both seats asked for the direct check. The candidate now becomes `und` whenever the raw prompt holds the floor of the opposing language. Counterexample test, red first: an inline `<bash-stdout>` region that glues `un` + `d` into a German marker the raw prompt never carries pinned `de` over an English region at the floor; it is now `und`.
- **A tab-indented closer inside a tab-indented list item** (`-\t~~~` … `\t~~~`) was not accepted by the closer regex (literal spaces only). The closer indent now admits tabs and is measured in columns; a top-level `\t~~~` (four columns) still does not close. Test red first; the top-level guard was green before and after.
- **The cost is now stated as a hook-level sequence test**: an English pin, then a German instruction beside an English terminal-pane wrapper, keeps the English pin. The #2950 test title now says what it asserts.
- Budget: +75 B for the direct check; ceiling 1,598,825 (reading + 197 B).

Round 14 refused (1 of 2 seats present; anthropic hit a usage limit). Findings and what changed (commit `6a5d13b3d5`):

- **Pasted host markup could erase a confident owner instruction.** `<system-reminder>` tags in two fences with `Behebe das bitte.` between them: both stripping paths removed the German sentence, and the English paragraph after them pinned with a positive `owner_prose_chars` (an override). **Terminal-pane tags** (`<bash-stdout>`) took a separate stripping path with the same failure. The seat asked to "require trusted host provenance for every exclusion from the veto input". A prompt carries no provenance channel — a pasted wrapper is byte-identical to the host's own — so the veto now has NO exclusion: it reads the raw prompt. Hook-level regressions for both tag forms assert that an earlier German pin survives; both were run red against the previous commit.
- **Tab-indented list fences** (`-\t~~~`, closer at six spaces) were measured in characters, not columns. Fixed with column arithmetic; test on `ownerSpans`, red first.
- **Budget entry text** claimed exclusions the veto no longer makes; corrected. The bundle shrank with `stripHostRegions` gone, so the ceiling moves DOWN from 1,598,950 to 1,598,750.

**The cost of the round-14 fix, stated for your judgement.** Six existing test rows that put a real host wrapper in the other language beside owner text (an IDE element block with English markup above a German sentence; a terminal-pane echo with an English app advisory beside German text, issue #2950) now classify `und` instead of `de`. Their expectations were changed from `de` to `und` in this commit. These are MISSED UPDATES: the previous pin stays. The #2950 harm itself — an `en` pin written off the host wrapper in a German session — still cannot happen, and the three-turn #2950 hook sequence (German pin, terminal-pane-only prompt, German reply) still keeps `de` unchanged. Both round-15 seats accepted these six changes.

Rounds 1-13 refused, each on a concrete counterexample, each fixed with a test that was red first; their questions are committed beside this file (`language-pin-from-owner-prose-ratification-r1` … `r15-20261121.question.md`).

**Please keep two classes apart.** An OVERRIDE is a pin written in language X while the owner's own typed text reaches the floor in language Y — the invariant says it cannot happen, and a counterexample is a blocker. A MISSED UPDATE leaves the previous pin in place (`und`) although the owner typed enough to set one — the recorded cost of owner decision D1 and of D7; report it, but it is not an authority or safety defect.

## What to answer

1. Does the diff contain a defect — in the span reader, the classifier, the pin field, the gate's reading of it, or the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond the intended narrowing of the language refusal? Is the ceiling raise sized to the measurement?
3. Is there a prompt shape where an owner's own confident typed language would now be overridden by pasted text (not merely left undetermined)? The known residuals stay as documented in `ownerSpans`: a prompt consisting ONLY of a paste that ends in an unmarked prose paragraph can pin from that paragraph, and a typed line that starts like output (`Error: …`) or like a document head (`# …`), or sits inside a fence, is read as paste; none of them leaves owner prose at the floor for the veto to protect. A single line mixing typed and pasted text is one unit.
4. Is the round-15 cost sequence test (a stale English pin beside an English wrapper) an acceptable stated cost, or a defect?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
origin/main 4bb96fb2fb:  ✅  hook bundle: 1595228 B / 1595300 B ceiling, 1 YAML reader(s) [yaml], 343 modules
this branch adf8495419:  ✅  hook bundle: 1598628 B / 1598825 B ceiling, 1 YAML reader(s) [yaml], 343 modules
delta: +3,400 B; ceiling 1,595,300 -> 1,598,825 (final reading + 197 B)
```

## The diff of the bundled sources and the budget file (origin/main...adf8495419)

````diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..a2829a7ec0 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1598825,
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
+            "to": 1598825,
+            "by": "agent, feat/a-language-pin-from-owner-prose (road-to-a-language-pin-from-owner-prose 4.2)",
+            "what_was_added": "The owner-prose language pin: `ownerSpans` and `ownerProse` in `_lib/prompt_shape.ts` (the opening paragraph and the paragraph after the last output paste; host-turn heads yield nothing), `classify` in `language_mirror_hook.ts` scoring only that text — vetoed to `und`, so the previous pin stays, whenever the RAW prompt (nothing removed: code, pastes and every tag-wrapped region, host wrappers included, count) carries the marker floor of the language opposing the candidate (checked directly, not through the spans), which means pasted prose or a host wrapper can prevent a pin update, and pasted prose can make one only where the prompt holds fewer than the floor of the other language anywhere, so owner text at the floor is never overridden — with the old lead-then-body scorer kept as `classifyText` for replies, `owner_prose_chars` on every pin, and `gatePinLanguage` in `turn_end_gate_hook.ts` so the gate refuses on language only behind an owner-prose pin. Measured by this gate: 1,598,628 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +3,400 B, both builds with APFS-cloned node_modules.",
+            "why_it_could_not_be_avoided": "The pin had to stop reading the whole prompt (owner decision D1 of the roadmap), which needs a span reader the bundle did not have; the replaced whole-body fallback was only a branch, so nothing left with it. The new code is already lean in the bundle (comments are stripped, the span reader is one loop pair), and the remaining shrink candidates are other concerns' code, which this change has no business editing. The pin and the gate both run in the dispatch bundle, so the code cannot move to a chunk without making every prompt submit load one.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading after the change. Sized to the final reading after ratification rounds 1-16 plus 197 B, on the same doctrine as the 2026-11-13 entries."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/prompt_shape.ts b/src/scripts/_lib/prompt_shape.ts
index b8b840c427..c162bd1048 100644
--- a/src/scripts/_lib/prompt_shape.ts
+++ b/src/scripts/_lib/prompt_shape.ts
@@ -144,6 +144,197 @@ export function humanAuthoredLead(text: string): string {
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
+  let held: string[] = [];
+  for (const line of text.split(/\r\n?|\n/)) {
+    // An opener may follow a list marker (`- ```, `10. ```), as inside a
+    // Markdown list item; its closer may then be indented up to three spaces
+    // past the item's content column, as CommonMark allows.
+    const open = /^( {0,3})((?:[-*+]|\d{1,9}[.)])[ \t]+)?(`{3,}(?=[^`]*$)|~{3,})/.exec(line);
+    const lead = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/.exec(line);
+    if (fence === "" && open === null) {
+      out.push(line);
+    } else if (fence === "") {
+      fence = open?.[3] ?? "";
+      // Outside a list a closer takes at most three spaces, whatever the
+      // opener's own indent; inside one, three past the item's content column.
+      indent = open?.[2] === undefined ? 3 : columns(`${open[1] ?? ""}${open[2]}`) + 3;
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
+  const lines = fenced(text);
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
+  // and at least two output lines stand above it, so one prose line that
+  // happens to look like output cannot hand the pin to the line below it.
+  const separated = blank(lines[start] ?? "");
+  const glued = lead.length === 0 && before.filter(isOutput).length >= 2;
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
+  return { ...ownerSpans(stripInjectedRegions(prompt)), text: prompt };
+}
+
 /** A line that is nothing but an opening tag, with the tag name captured. */
 const REGION_OPEN = /^\s*<([A-Za-z][\w-]*)>\s*$/;
 
diff --git a/src/scripts/hooks/turn_end_gate_hook.ts b/src/scripts/hooks/turn_end_gate_hook.ts
index cb948cdbcb..67d4fbbb91 100644
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
@@ -650,8 +650,7 @@ export function readLanguagePin(workspaceRoot: string, session_id: string): Verd
         // accepting it is the cross-session read the split closed.
         if (!ownsSessionState(decoded, session_id)) return 'und';
         if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
-            const lang = (decoded as Record<string, unknown>)['language'];
-            if (lang === 'de' || lang === 'en') return lang;
+            return gatePinLanguage(decoded as Record<string, unknown>);
         }
     } catch {
         // no pin, unreadable pin, malformed pin — all mean "no obligation"
@@ -659,14 +658,37 @@ export function readLanguagePin(workspaceRoot: string, session_id: string): Verd
     return 'und';
 }
 
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
+ * Pure, so `measure_turn_end_gate --language-split` replays the same rule.
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
+
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
@@ -682,17 +704,19 @@ export function readLanguagePin(workspaceRoot: string, session_id: string): Verd
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
@@ -702,7 +726,7 @@ export function detectLanguage(reply: string, pinned: Verdict): Finding | null {
             `the pinned reply language is "${pinned}" but the reply classifies as ` +
             `"${verdict.language}" (${verdict.de_markers} de / ${verdict.en_markers} en markers; ` +
             'code, quotes, tables, URLs and paths excluded, then scored lead-first ' +
-            'by the same classifier that sets the pin)',
+            'with the same marker lists that set the pin)',
     };
 }
 
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index 1d053f8fd8..ea9fa1593e 100644
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
@@ -300,19 +305,66 @@ export function instructionText(prompt: string): string {
 
 
 /**
- * Classify a prompt, reading the TYPED LEAD before the whole body.
+ * Classify a PROMPT for the pin: only the text the owner typed decides it.
+ *
+ * Scores `ownerProse(prompt)` — the opening paragraph and the paragraph after
+ * the last output paste, with host turns, injected regions, fenced code, output
+ * lines and pasted documents removed — under the shared `MIN_MARKERS` floor
+ * (council 2026-11-21, D5). There is NO whole-body fallback: an owner span
+ * under the floor is `und`, and the caller keeps the previous pin (owner
+ * decision D1). The fallback this replaced let the paste decide whenever the
+ * typed lead was short, which is the owner's most common prompt shape
+ * (`Behebe das bitte.` over an English paragraph pinned `en`, de=2 / en=9).
+ *
+ * Then a veto that no boundary reading can get around: when the RAW prompt —
+ * nothing removed, not even host wrappers, because a pasted wrapper tag looks
+ * exactly like the host's own (ratification rounds 13-14) — carries
+ * `MIN_MARKERS` markers of the language OPPOSING the candidate, the verdict is
+ * `und`. A real host
+ * wrapper in the other language (an IDE element block, a terminal-pane echo)
+ * therefore keeps the previous pin too: a missed update, never an override. So a pin in one language is written only when the prompt holds fewer
+ * than `MIN_MARKERS` markers of the other anywhere; owner text that reaches the
+ * floor can never be outvoted, however the span reader draws its boundaries.
+ * Ratification rounds 1-9 found a missed shape for every narrower unit (spans,
+ * lines, paragraphs, runs of lines, a fence reader). The cost is recall: an
+ * instruction over a paste in the other language — a document, a log, code
+ * with comments — keeps the previous pin rather than setting one.
+ *
+ * `owner_prose_chars` is the length of the text that was scored, so a pin can
+ * say how much owner prose stood behind it.
+ *
+ * Not for replies or bodies: those are scored with `classifyText`, which has no
+ * notion of an owner and keeps its whole-text fallback.
+ */
+export function classify(prompt: string): PromptClassification {
+  const { lead, trailing, text } = ownerProse(prompt);
+  const owner = [lead, trailing].filter((s) => s.trim() !== "").join("\n\n");
+  const verdict = _score(owner);
+  const all = _score(text);
+  // The invariant checked directly, not through the spans being a subset of
+  // the raw text: a candidate never pins while the raw prompt holds the floor
+  // of the opposing language (ratification round 15).
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
@@ -322,7 +374,7 @@ export function instructionText(prompt: string): string {
  * keeps the block's indented lines from arming that filter's paste state, which
  * was deleting the user's own sentence outright.
  */
-export function classify(prompt: string): Classification {
+export function classifyText(prompt: string): Classification {
   const text = instructionText(stripInjectedRegions(prompt));
   const lead = humanAuthoredLead(text);
   const leadVerdict = _score(lead);
@@ -332,6 +384,15 @@ export function classify(prompt: string): Classification {
   return _score(text);
 }
 
+/**
+ * Score one span with the marker lists and the `MIN_MARKERS` floor, and nothing
+ * else — no stripping, no lead selection. Exported for the instrument that scores
+ * the owner's spans one by one (`measure_turn_end_gate --language-split`).
+ */
+export function scoreText(text: string): Classification {
+  return _score(text);
+}
+
 function _score(text: string): Classification {
   const de = (text.match(DE_MARKERS) ?? []).length;
   const en = (text.match(EN_MARKERS) ?? []).length;
@@ -474,6 +535,12 @@ export interface PinState extends JsonObject {
    * every state written before this field existed is still a valid pin.
    */
   tool_calls_since_pin?: number;
+  /**
+   * Characters of owner prose behind the pin (`classify`'s scored text); 0 on
+   * a locale pin. The turn-end gate refuses on language only when this is
+   * above 0. Optional: a pin written before the field keeps today's reading.
+   */
+  owner_prose_chars?: number;
 }
 
 function _loadState(target: string): Partial<PinState> {
@@ -541,7 +608,7 @@ export const REEMIT_AFTER_TOOL_CALLS = 150;
  */
 export function nextState(
   previous: Partial<PinState>,
-  classification: Classification,
+  classification: PromptClassification,
   prompt_chars: number,
   session_id: string,
   now: string,
@@ -589,6 +656,7 @@ export function nextState(
       en_markers: classification.en_markers,
       session_id,
       tool_calls_since_pin: 0,
+      owner_prose_chars: 0,
     };
   }
   return {
@@ -600,6 +668,7 @@ export function nextState(
     en_markers: classification.en_markers,
     session_id,
     tool_calls_since_pin: 0,
+    owner_prose_chars: classification.owner_prose_chars ?? 0,
   };
 }
 
````

## The test changes of rounds 15-16 (eedd05cf84...adf8495419)

````diff
diff --git a/tests/scripts/language_mirror_hook.test.ts b/tests/scripts/language_mirror_hook.test.ts
index 2dbac8596d..c0169598f1 100644
--- a/tests/scripts/language_mirror_hook.test.ts
+++ b/tests/scripts/language_mirror_hook.test.ts
@@ -1543,13 +1543,16 @@ describe("host-injected wrapper regions", () => {
     // Pre-fix: `en`, at de=0 / en=3. The German count reached ZERO — the
     // block's indented lines armed `instructionText`'s paste state and, with no
     // blank line before it, the user's sentence was discarded with the markup.
+    // Since D7 (ratification round 15) the veto reads the RAW prompt, so the
+    // block's English markers make this `und`: the previous pin stays (a missed
+    // update), and the pre-fix harm — an `en` pin off the block — cannot recur.
     const prompt = ELEMENT_BLOCK + "abstand zu der nächste kachel unter diesen hier fehlt.";
-    expect(classify(prompt).language).toBe("de");
+    expect(classify(prompt).language).toBe("und");
   });
 
   it("a blank line between the block and the sentence changes nothing", () => {
     const prompt = ELEMENT_BLOCK + "\nsteht unter dem kontent wrapper, ich würde es anders machen";
-    expect(classify(prompt).language).toBe("de");
+    expect(classify(prompt).language).toBe("und");
   });
 
   it("the same block does not flip an English sentence away from English", () => {
@@ -1674,12 +1677,14 @@ describe("inline terminal-pane regions (#2950)", () => {
     const kept = stripInjectedRegions(p);
     expect(kept).not.toMatch(/bash-|these are the files|have been listed/);
     expect(kept).toContain("mach bitte weiter mit den tickets und prüfe die regeln");
-    expect(classify(p).language).toBe("de");
+    // The raw-prompt veto (D7, round 15): the stdout's English keeps the previous pin.
+    expect(classify(p).language).toBe("und");
   });
 
-  it("text typed beside the inline regions is kept and decides", () => {
+  it("text typed beside the inline regions decides only where the wrapper does not disagree", () => {
     const p = TERMINAL_PANE_LINE + "\nwarum ist das leer und wo ist die ausgabe?";
-    expect(classify(p).language).toBe("de");
+    // Never `en` (the #2950 harm); `und` under the raw-prompt veto (D7, round 15).
+    expect(classify(p).language).toBe("und");
     const en = TERMINAL_PANE_LINE + "\nwhy is this empty and where is the output?";
     expect(classify(en).language).toBe("en");
   });
@@ -1688,14 +1693,14 @@ describe("inline terminal-pane regions (#2950)", () => {
     const p =
       "bitte prüfe das <bash-stdout>these are the files that were there</bash-stdout> und mach dann weiter mit der liste";
     expect(stripInjectedRegions(p)).not.toMatch(/these are the files/);
-    expect(classify(p).language).toBe("de");
+    expect(classify(p).language).toBe("und");
   });
 
   it("inline terminal regions and a standalone host wrapper are both removed", () => {
     const p = TERMINAL_PANE_LINE + "\n" + ELEMENT_BLOCK + "abstand zu der nächste kachel unter diesen hier fehlt.";
     const kept = stripInjectedRegions(p);
     expect(kept).not.toMatch(/bash-|launch-selected-element|No output was captured/);
-    expect(classify(p).language).toBe("de");
+    expect(classify(p).language).toBe("und");
   });
 
   it("an unclosed inline tag is left in place", () => {
@@ -1703,6 +1708,31 @@ describe("inline terminal-pane regions (#2950)", () => {
     expect(stripInjectedRegions(p)).toBe(p);
   });
 
+  it("the cost, stated: a German instruction beside an English wrapper leaves an English pin in place", () => {
+    // A missed update (D7, ratification round 15): no text-only rule can tell
+    // the host's wrapper from a pasted copy, so the raw-prompt veto keeps the
+    // previous pin and the gate keeps asking for English on this turn.
+    run(envelope("Please check the release notes and tell me what is missing."), {
+      consumer_root: tmp,
+      env: {},
+    });
+    expect(readState().language).toBe("en");
+    run(envelope(TERMINAL_PANE_LINE + "\nwarum ist das leer und wo ist die ausgabe?"), {
+      consumer_root: tmp,
+      env: {},
+    });
+    expect(readState().language).toBe("en");
+  });
+
+  it("an inline region that joins a word is still counted by the veto", () => {
+    // Stripping the region glues `un` + `d` into a German marker the raw prompt
+    // never carries, so the spans reach the German floor while the raw prompt
+    // does not; the region's English is at the floor. The veto checks the
+    // OPPOSING language directly, so the candidate cannot pin.
+    const p = "un<bash-stdout>the output was there</bash-stdout>d die tests laufen";
+    expect(classify(p).language).toBe("und");
+  });
+
   it("the reported three-turn sequence keeps the German pin", () => {
     run(envelope("Die Freigabe ist drin, mach bitte weiter mit den Tickets"), {
       consumer_root: tmp,
@@ -2074,6 +2104,36 @@ describe("owner prose only", () => {
     expect(spans.lead).toBe("");
   });
 
+  for (const tag of ["system-reminder", "bash-stdout"]) {
+    it(`pasted <${tag}> tags across fences cannot delete a typed German sentence from the veto`, () => {
+      run(envelope("Bitte prüfe das und mach dann weiter mit den Tests."), { consumer_root: tmp, env: {} });
+      run(
+        envelope(
+          `\`\`\`\n<${tag}>\n\`\`\`\n\nBehebe das bitte.\n\n\`\`\`\n</${tag}>\n\`\`\`\n\nPlease tell me why this is happening and what we should do.`,
+        ),
+        { consumer_root: tmp, env: {} },
+      );
+      expect(readState().language).toBe("de");
+    });
+  }
+
+  it("a tab-indented closer in a tab-indented list item closes the fence", () => {
+    const spans = ownerSpans("-\t~~~\n\tx\n\t~~~\n\nBehebe das bitte.");
+    expect(spans.lead).toBe("");
+    expect(spans.trailing).toBe("Behebe das bitte.");
+  });
+
+  it("a top-level closer indented by a tab (four columns) does not close the fence", () => {
+    const spans = ownerSpans("~~~\nx\n\t~~~\n~~~\n\nBehebe das bitte.");
+    expect(spans.trailing).toBe("Behebe das bitte.");
+  });
+
+  it("a closer six columns into a tab-indented list item closes the fence", () => {
+    const spans = ownerSpans("-\t~~~\n      x\n      ~~~\n\nBehebe das bitte.");
+    expect(spans.lead).toBe("");
+    expect(spans.trailing).toBe("Behebe das bitte.");
+  });
+
   it("a long whitespace-only line costs linear time", () => {
     const started = Date.now();
     classify(`Bitte prüfe das.\n${" ".repeat(50_000)}\nund mach weiter.`);
````
