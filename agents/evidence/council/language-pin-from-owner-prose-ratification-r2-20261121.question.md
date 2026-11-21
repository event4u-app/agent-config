<!-- evidence-type: analysis -->

# Ratification review — the owner-prose language pin and its bundle raise — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json`, whose dispatch-bundle byte ceiling the change raises. The code that grew the bundle is shown below so the raise can be judged against it.

subject: 444b0b696983f1514096f8d56d2af5aa25f1ae71e1949dec9f1647f097dc6778

(The digest covers the gated files at commit `e995e10f78` on branch `feat/a-language-pin-from-owner-prose`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

The reply-language pin (a `UserPromptSubmit` hook that records which language the owner writes in) used to score the typed lead of a prompt and, when the lead had fewer than two language markers, the WHOLE prompt body, so a pasted log or document decided the pin. The turn-end gate then refused replies in the owner's real language. The change:

- `ownerSpans` / `ownerProse` (`src/scripts/_lib/prompt_shape.ts`): only the opening paragraph (the lead) and the paragraph after the last output paste (the trailing span) are owner text; fenced code, output-shaped lines, a pasted document and fixed host-turn heads yield nothing. A trailing span glued to the paste (no blank line) is read only when the prompt has no lead.
- `classify` (`src/scripts/language_mirror_hook.ts`) scores lead and trailing span apart; two confident spans that disagree give `und`; otherwise both are scored together. There is no whole-body fallback; below the shared two-marker floor the verdict is `und` and the previous pin stays. The old scorer is kept as `classifyText` for replies and injected bodies, so the gate's reply scoring is unchanged. Every other caller of `classify` was audited: `measure_turn_end_gate` (prompts, replay) and `conformance_scan` (one prompt site; its two reply/body sites moved to `classifyText`).
- Every pin records `owner_prose_chars` (0 on a locale pin).
- `gatePinLanguage` (`src/scripts/hooks/turn_end_gate_hook.ts`): the gate refuses on language only when the pin's `source` is `prompt` and `owner_prose_chars`, when present, is a positive integer. A prompt pin without the field (written before it existed) keeps the language-only reading.

**The claim, scoped and corrected after round 1.** For a GIVEN pin record the gate can only refuse fewer replies: every path added to the gate returns `und` (no obligation) or the language it returned before. Across turns the pin itself is set less often, and that is a trade-off, not a monotone improvement: a prompt whose owner text is under the floor (`Fix.` over a paragraph) keeps the previous pin even when that paragraph is the owner's own, because a pasted paragraph has the same shape. That is the owner's recorded decision D1 ("an undetermined owner span keeps the previous pin"), confirmed by the council's D5 on the floor; it is now pinned by a test, and the roadmap's step 5.1 lists every remaining owner-prose refusal individually so a recall loss is visible. No gate is removed, no exit code is added, no permission or allowlist is touched.

## History

Round 1 refused 2/2. Findings and what changed (commit `9d0f2544ae`):

- **A confident owner lead was dropped for a paste's last paragraph** (`Behebe das bitte.` glued above `Error: …`, English explanation after a blank line). `ownerSpans` no longer drops a glued lead; `classify` returns `und` when the lead and the trailing span are both confident and disagree. Tests: that shape with and without a blank line after the lead → `und`; the terminal-header-above-German-question row is now `und` too (the header line may be the terminal's or the owner's).
- **A retained pin can cause a refusal on a later turn.** Not changed in behaviour — it is D1 above — but the claim is corrected and a test pins the behaviour.
- **Malformed `owner_prose_chars`** (`null`, `-1`, `"0"`, `1.5`) imposed an obligation. Now any present value that is not a positive integer obliges nothing. Tests for each, and for a locale pin without the field.
- **Budget.** Re-measured after the fix: +27 B, still under the raised ceiling; the `raise_log` entry states both readings.

## What to answer

1. Does the diff contain a defect — in the span reader, the classifier, the pin field, the gate's reading of it, or the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate beyond the intended narrowing of the language refusal? Is the ceiling raise sized to the measurement?
3. Is there a prompt shape where an owner's own confident typed language would now be overridden by pasted text (not merely left undetermined)?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
origin/main 4bb96fb2fb:  ✅  hook bundle: 1595228 B / 1595300 B ceiling, 1 YAML reader(s) [yaml], 343 modules
this branch e995e10f78:  ✅  hook bundle: 1597501 B / 1597600 B ceiling, 1 YAML reader(s) [yaml], 343 modules
delta: +2,273 B; ceiling 1,595,300 -> 1,597,600 (first measurement 1,597,474 + 126 B; 99 B left after round 1's fixes)
```

## The diff of the bundled sources and the budget file (origin/main...e995e10f78)

````diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..18dc98664e 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1597600,
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
+            "to": 1597600,
+            "by": "agent, feat/a-language-pin-from-owner-prose (road-to-a-language-pin-from-owner-prose 4.2)",
+            "what_was_added": "The owner-prose language pin: `ownerSpans` and `ownerProse` in `_lib/prompt_shape.ts` (the opening paragraph and the paragraph after the last output paste; host-turn heads yield nothing), `classify` in `language_mirror_hook.ts` scoring only that text with the old lead-then-body scorer kept as `classifyText` for replies, `owner_prose_chars` on every pin, and `gatePinLanguage` in `turn_end_gate_hook.ts` so the gate refuses on language only behind an owner-prose pin. Measured by this gate: 1,597,501 B with the change against 1,595,228 B on origin/main 4bb96fb2fb, +2,273 B, both builds with APFS-cloned node_modules.",
+            "why_it_could_not_be_avoided": "The pin had to stop reading the whole prompt (owner decision D1 of the roadmap), which needs a span reader the bundle did not have; the replaced whole-body fallback was only a branch, so nothing left with it. The new code is already lean in the bundle (comments are stripped, the span reader is one loop pair), and the remaining shrink candidates are other concerns' code, which this change has no business editing. The pin and the gate both run in the dispatch bundle, so the code cannot move to a chunk without making every prompt submit load one.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading after the change. Sized to the first measurement (1,597,474 B) plus 126 B, on the same doctrine as the 2026-11-13 entries; ratification round 1's fixes added 27 B, leaving 99 B."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/prompt_shape.ts b/src/scripts/_lib/prompt_shape.ts
index b8b840c427..7efaaefacb 100644
--- a/src/scripts/_lib/prompt_shape.ts
+++ b/src/scripts/_lib/prompt_shape.ts
@@ -144,6 +144,127 @@ export function humanAuthoredLead(text: string): string {
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
+ * Deciding between a lead and a trailing span that disagree is the scorer's job
+ * (`classify` in the language mirror: two confident spans that disagree are
+ * undetermined), because either one may be the paste's own first or last line.
+ *
+ * A trailing span with no blank line between it and the paste is weaker
+ * evidence than a lead: it is read only when the prompt has no lead. A wrapped
+ * error message (`mach das:` over `Error: …` continued on unmarked lines) would
+ * otherwise drop the owner's lead and pin the paste's continuation.
+ *
+ * KNOWN RESIDUAL, stated rather than hidden: a prompt that OPENS with a paste
+ * ending in an unmarked prose line, with no typed text after it, yields that
+ * line as the trailing span. It carries markers only when the line is a
+ * sentence.
+ */
+export function ownerSpans(text: string): OwnerSpans {
+  const lines = text.replace(/```[\s\S]*?```/g, `\n${FENCE_LINE}\n`).split("\n");
+  const isOutput = (l: string): boolean => l === FENCE_LINE || OUTPUT_HEAD.test(l);
+  const isPaste = (l: string): boolean => isOutput(l) || DOCUMENT_HEAD.test(l);
+  const blank = (l: string): boolean => l.trim() === "";
+
+  const lead: string[] = [];
+  for (const line of lines) {
+    if (isPaste(line) || (blank(line) && lead.length > 0)) break;
+    if (!blank(line)) lead.push(line);
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
+  // continuation as a typed line; it counts only when there is no lead to read.
+  const separated = blank(lines[start] ?? "");
+  const trailing = separated || lead.length === 0 ? candidate : [];
+
+  return {
+    lead: lead.join("\n"),
+    trailing: trailing.join("\n"),
+  };
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
+export function ownerProse(prompt: string): OwnerSpans {
+  if (isSyntheticPrompt(prompt) || HOST_TURN_HEAD.test(prompt.trimStart())) {
+    return { lead: "", trailing: "" };
+  }
+  return ownerSpans(stripInjectedRegions(prompt));
+}
+
 /** A line that is nothing but an opening tag, with the tag name captured. */
 const REGION_OPEN = /^\s*<([A-Za-z][\w-]*)>\s*$/;
 
diff --git a/src/scripts/hooks/turn_end_gate_hook.ts b/src/scripts/hooks/turn_end_gate_hook.ts
index cb948cdbcb..0790ba9542 100644
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
+ * positive integer is malformed and obliges nothing either. A prompt pin
+ * missing `owner_prose_chars`, or a pin missing `source`, was written before
+ * that field existed and keeps the language-only reading; a locale pin is
+ * exempt whether or not it carries the count.
+ *
+ * Pure, so `measure_turn_end_gate --language-split` replays the same rule.
+ */
+export function gatePinLanguage(pin: Record<string, unknown>): Verdict {
+    const lang = pin['language'];
+    if (lang !== 'de' && lang !== 'en') return 'und';
+    const source = pin['source'];
+    if (source !== undefined && source !== 'prompt') return 'und';
+    const chars = pin['owner_prose_chars'];
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
index 1d053f8fd8..aa0173a818 100644
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
@@ -255,6 +257,8 @@ export interface Classification {
   language: Verdict;
   de_markers: number;
   en_markers: number;
+  /** Characters of owner prose scored — set by `classify`, absent from `classifyText`. */
+  owner_prose_chars?: number;
 }
 
 /**
@@ -273,8 +277,6 @@ export interface Classification {
  * target. The maintainer's most common prompt shape is exactly that.
  */
 export function instructionText(prompt: string): string {
-  const OUTPUT_HEAD =
-    /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|npm ERR!|Error:|Traceback|Exception|[A-Za-z]*Error\b|at\s+\S+:\d+|\s{4,}\S|[-+]{3}\s|@@\s|\$\s|>\s|\||\d+\s*\|)/i;
   const kept: string[] = [];
   let inPaste = false;
   for (const line of prompt.replace(/```[\s\S]*?```/g, "\n\n").split("\n")) {
@@ -300,19 +302,54 @@ export function instructionText(prompt: string): string {
 
 
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
+ * The lead and the trailing span are scored apart first. When both are
+ * confident and disagree, the verdict is `und`: either may be the paste's own
+ * edge line (`Behebe das bitte.` glued above an error whose explanation follows
+ * a blank line, or a terminal header line above a typed question), and no
+ * position rule tells them apart. Otherwise the two spans are scored together.
+ *
+ * `owner_prose_chars` is the length of the text that was scored, so a pin can
+ * say how much owner prose stood behind it.
+ *
+ * Not for replies or bodies: those are scored with `classifyText`, which has no
+ * notion of an owner and keeps its whole-text fallback.
+ */
+export function classify(prompt: string): Classification {
+  const { lead, trailing } = ownerProse(prompt);
+  const owner = [lead, trailing].filter((s) => s.trim() !== "").join("\n\n");
+  const verdict = _score(owner);
+  const a = _score(lead).language;
+  const b = _score(trailing).language;
+  if (a !== "und" && b !== "und" && a !== b) return { ...verdict, language: "und", owner_prose_chars: owner.length };
+  return { ...verdict, owner_prose_chars: owner.length };
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
@@ -322,7 +359,7 @@ export function instructionText(prompt: string): string {
  * keeps the block's indented lines from arming that filter's paste state, which
  * was deleting the user's own sentence outright.
  */
-export function classify(prompt: string): Classification {
+export function classifyText(prompt: string): Classification {
   const text = instructionText(stripInjectedRegions(prompt));
   const lead = humanAuthoredLead(text);
   const leadVerdict = _score(lead);
@@ -332,6 +369,15 @@ export function classify(prompt: string): Classification {
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
@@ -474,6 +520,12 @@ export interface PinState extends JsonObject {
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
@@ -589,6 +641,7 @@ export function nextState(
       en_markers: classification.en_markers,
       session_id,
       tool_calls_since_pin: 0,
+      owner_prose_chars: 0,
     };
   }
   return {
@@ -600,6 +653,7 @@ export function nextState(
     en_markers: classification.en_markers,
     session_id,
     tool_calls_since_pin: 0,
+    owner_prose_chars: classification.owner_prose_chars ?? 0,
   };
 }
 
````
