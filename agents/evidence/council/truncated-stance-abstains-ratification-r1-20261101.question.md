<!-- evidence-type: analysis -->

# Ratification review — a truncated stance abstains in the stance tally — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/scripts/ai_council/stance_tally.ts`, is the council's verdict rule and is on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: e3d4fa8bf4731d476774fa9de430230a9ca4b195b5feee5867b6cfa1d3d6a4f2

(The digest covers `src/scripts/ai_council/stance_tally.ts` at commit `468d565daa`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

PR #2785 (merged) gave every council response an optional `stop_class` (`complete | truncated | context_exceeded | unknown`), read from the provider's own stop reason (Anthropic `stop_reason`, OpenAI-compatible `finish_reason`, Gemini `finishReason`); CLI seats report `unknown`. A response the provider cut short now parses as `truncated` in findings, is recorded without extraction or re-ask in the consensus round, and counts as absent for quorum. The stance tally was left unchanged because it is owner-reserved. The repository owner then decided (2026-11-01) that a truncated stance should abstain in the tally as well.

## What the change does

- `tally_stances` takes members with an optional `incomplete` flag. An incomplete member is listed in a new optional `incomplete` field, counts in `w_total` (it responded), and backs no option, whatever its stance line parses to. This is the same treatment the tally already gives an unparseable stance (`needs_repair`). The field is omitted when empty, so a tally with no cut-off member keeps its exact previous shape.
- `stanceMembersFrom(responses)` builds the member list from responses (dropping errored ones, as before) and sets `incomplete` from `stop_class` (`truncated` or `context_exceeded` only; `unknown` and absent are not incomplete). `tallyFromResponses` and the orchestrator's render path both use it.
- `render_vote_tally` prints one extra line naming the cut-off members when there are any.
- Tests: a truncated member backs nothing but keeps the denominator, so two `ship` stances of which one is truncated no longer reach consensus; no `incomplete` key when nothing is cut off. These were seen red before the change.

No retry, continuation or re-ask is added. The consensus fraction, threshold and every other tally rule are unchanged.

## The diff

```diff
diff --git a/src/scripts/ai_council/orchestrator.ts b/src/scripts/ai_council/orchestrator.ts
index 929db9410d..442028222f 100644
--- a/src/scripts/ai_council/orchestrator.ts
+++ b/src/scripts/ai_council/orchestrator.ts
@@ -67,7 +67,7 @@ import {
     VERDICT_LINE_CONTRACT,
 } from './prompts.js';
 import { count_dissenters, dissent_quota_met, is_near_duplicate } from './debate_gates.js';
-import { parse_stance_line, render_vote_tally, tally_stances } from './stance_tally.js';
+import { parse_stance_line, render_vote_tally, stanceMembersFrom, tally_stances } from './stance_tally.js';
 import { MidFlightFallback } from './transport_resolver.js';
 import {
     emitOutcome,
@@ -1795,11 +1795,7 @@ export function render(responses: CouncilResponse[], opts: RenderOptions = {}):
         // Phase 1: deterministic option-level tally from the final-round
         // response texts (the STANCE closing lines live IN the texts, so the
         // render is a pure projection — no config or transport needed here).
-        const tally = tally_stances(
-            responses
-                .filter((r) => !r.error)
-                .map((r) => ({ member: `${r.provider}:${r.model}`, text: r.text })),
-        );
+        const tally = tally_stances(stanceMembersFrom(responses));
         blocks.push(render_vote_tally(tally));
         // Phase 2.1: the verdict half of the same projection. A synthesis that
         // states a `VERDICT:` line the tally did not clear is contradicting its
diff --git a/src/scripts/ai_council/stance_tally.ts b/src/scripts/ai_council/stance_tally.ts
index 1a8f3ba6f9..1e1d75643a 100644
--- a/src/scripts/ai_council/stance_tally.ts
+++ b/src/scripts/ai_council/stance_tally.ts
@@ -10,6 +10,8 @@
 // Default-off behind `ai_council.stance_tally.enabled`; additive — with the key
 // false the council path is byte-identical to today.
 
+import { isIncompleteStop, type StopClass } from './stop_class.js';
+
 /** Confidence tier from a stance line. */
 export type Confidence = 'high' | 'med' | 'low';
 
@@ -59,6 +61,21 @@ export interface StanceTallyResult {
      * merely computed.
      */
     needs_repair: string[];
+    /**
+     * Members whose answer the provider cut short (`stop_class` truncated /
+     * context_exceeded). Counted in `w_total` like an abstention — they
+     * responded — and back no option however well their stance line parsed: a
+     * fragment is not a vote. OPTIONAL and omitted when empty, so a tally with
+     * no cut-off member keeps its exact pre-D5 shape.
+     */
+    incomplete?: string[];
+}
+
+/** One member's input to the tally. `incomplete` marks a provider-truncated answer. */
+export interface StanceMember {
+    member: string;
+    text: string;
+    incomplete?: boolean;
 }
 
 // Tolerant of whitespace and case; requires the three explicit fields in order.
@@ -143,12 +160,15 @@ export function parse_stance_line(text: string): Omit<StanceLine, 'member'> | nu
  * the leading option's weight ≥ ⅔ × W_total; otherwise a structured split is
  * returned — never a forced winner, never an auto-added round.
  */
-export function tally_stances(
-    members: ReadonlyArray<{ member: string; text: string }>,
-): StanceTallyResult {
+export function tally_stances(members: ReadonlyArray<StanceMember>): StanceTallyResult {
     const parsed: StanceLine[] = [];
     const needs_repair: string[] = [];
-    for (const { member, text } of members) {
+    const incomplete: string[] = [];
+    for (const { member, text, incomplete: cut } of members) {
+        if (cut === true) {
+            incomplete.push(member);
+            continue;
+        }
         const p = parse_stance_line(text);
         if (p === null) {
             needs_repair.push(member);
@@ -173,7 +193,9 @@ export function tally_stances(
     // no option either way, so an unparseable response now behaves exactly like
     // an abstention — the fail-safe direction. Members who never responded are
     // dropped upstream (`!r.error`) and are correctly absent from `members`.
-    const w_total = parsed.length + needs_repair.length; // responded, abstain + unparseable included
+    // A provider-truncated answer is held to the same fail-safe: it responded, so it
+    // raises the bar, and it backs nothing (D5).
+    const w_total = parsed.length + needs_repair.length + incomplete.length;
     const threshold = CONSENSUS_FRACTION * w_total;
     let abstain_count = 0;
 
@@ -211,6 +233,7 @@ export function tally_stances(
         split: consensus === null,
         abstain_count,
         needs_repair,
+        ...(incomplete.length > 0 ? { incomplete } : {}),
     };
 }
 
@@ -228,16 +251,27 @@ export function tally_stances(
  * responses are two chances to disagree, and the attendance event and the
  * handoff envelope both consume this one.
  */
+type TallyResponse = { provider: string; model: string; text: string; error?: string | null; stop_class?: StopClass | undefined };
+
+/** Map a round's responses to tally members: errored ones dropped, cut-off ones marked. */
+export function stanceMembersFrom(responses: ReadonlyArray<TallyResponse>): StanceMember[] {
+    return responses
+        .filter((r) => !r.error)
+        .map((r) => ({
+            member: `${r.provider}:${r.model}`,
+            text: r.text,
+            ...(isIncompleteStop(r.stop_class) ? { incomplete: true } : {}),
+        }));
+}
+
 export function tallyFromResponses(
-    responses: ReadonlyArray<{ provider: string; model: string; text: string; error?: string | null }>,
+    responses: ReadonlyArray<TallyResponse>,
     enabled: boolean,
 ): StanceTallyResult | null {
     if (!enabled) {
         return null;
     }
-    return tally_stances(
-        responses.filter((r) => !r.error).map((r) => ({ member: `${r.provider}:${r.model}`, text: r.text })),
-    );
+    return tally_stances(stanceMembersFrom(responses));
 }
 
 export function render_vote_tally(result: StanceTallyResult): string {
@@ -265,6 +299,12 @@ export function render_vote_tally(result: StanceTallyResult): string {
                 'quorum, backing nothing',
         );
     }
+    if (result.incomplete !== undefined && result.incomplete.length > 0) {
+        lines.push(
+            `- truncated — ${result.incomplete.length} member(s) were cut off by the provider ` +
+                `(${result.incomplete.join(', ')}); counted in the quorum, backing nothing`,
+        );
+    }
     lines.push(`Threshold: ⅔ × ${result.w_total} = ${result.threshold.toFixed(2)}`);
     lines.push(
         result.consensus !== null
diff --git a/tests/scripts/ai_council/stop_class.test.ts b/tests/scripts/ai_council/stop_class.test.ts
index e58e105f88..875291ba48 100644
--- a/tests/scripts/ai_council/stop_class.test.ts
+++ b/tests/scripts/ai_council/stop_class.test.ts
@@ -3,8 +3,7 @@
 //
 // Three layers: the per-provider mapping (pure), the clients that attach it to
 // `CouncilResponse.stop_class`, and every reader that turns a response into a
-// vote — findings parse, consensus round, post-run quorum. The stance tally is
-// owner-reserved under ADR-268 and is not changed here.
+// vote — stance tally, findings parse, consensus round, post-run quorum.
 
 import { describe, expect, it } from 'vitest';
 
@@ -22,6 +21,7 @@ import { run_consensus_scoring } from '../../../src/scripts/ai_council/consensus
 import { harvest_inline_findings } from '../../../src/scripts/ai_council/inline_findings.js';
 import { _postRunQuorum } from '../../../src/scripts/ai_council/quorum_wiring.js';
 import { serializeResponses } from '../../../src/scripts/ai_council/response_record.js';
+import { render_vote_tally, tallyFromResponses } from '../../../src/scripts/ai_council/stance_tally.js';
 import {
     anthropicStopClass,
     geminiStopClass,
@@ -130,6 +130,25 @@ function resp(provider: string, text: string, stop_class?: 'complete' | 'truncat
 }
 
 describe('stop_class — a truncated parseable answer is not a full vote', () => {
+    it('stance tally: the truncated member backs nothing but still counts in the denominator', () => {
+        const full = tallyFromResponses([resp('a', STANCE, 'complete'), resp('b', STANCE, 'complete')], true)!;
+        expect(full.consensus?.label).toBe('ship');
+        expect(full.options[0]!.backers).toHaveLength(2);
+
+        const cut = tallyFromResponses([resp('a', STANCE, 'complete'), resp('b', STANCE, 'truncated')], true)!;
+        expect(cut.options[0]!.backers.map((b) => b.member)).toEqual(['a:m']);
+        expect(cut.incomplete).toEqual(['b:m']);
+        // Fail-safe direction: the cut-off member raises the bar, it does not vanish.
+        expect(cut.w_total).toBe(2);
+        expect(cut.consensus).toBeNull();
+        expect(render_vote_tally(cut)).toContain('- truncated — 1 member(s) were cut off by the provider (b:m)');
+    });
+
+    it('stance tally: no incomplete key when nothing was cut off (shape unchanged)', () => {
+        const r = tallyFromResponses([resp('a', STANCE), resp('b', STANCE, 'complete')], true)!;
+        expect(Object.keys(r)).not.toContain('incomplete');
+    });
+
     it('findings parse: a valid array from a truncated answer is `truncated`, with no findings', () => {
         const text = '[{"id": "f1", "text": "a finding"}]';
         expect(parse_findings_outcome(text, { source: 's' }).outcome).toBe('parsed');
```

## What to answer

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one stance line of the form `STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`.
