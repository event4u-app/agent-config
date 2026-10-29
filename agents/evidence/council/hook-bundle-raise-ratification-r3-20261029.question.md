<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raise (branch worktree-inbox-2026-10-bi) — round 3

`check_kernel_edit_ratified` gates one hook-plumbing file on this branch,
`src/config/hook-bundle-budget.json`: the dispatch bundle's `max_bytes` goes
from 1,556,670 to 1,557,800 with a `raise_log` entry. The growth comes from
`src/scripts/_lib/self_repair.ts` (inlined via the `self-repair` concern on
`user_prompt_submit`): broader recurrence patterns in the user-report detector
and an optional local-only `subject` field.

Round 1 returned confirmed-non-expanding with conditions. In round 2 one seat
confirmed and one refused on evidence: the fingerprint and the complete release
payload were not shown, the privacy claim was broader than the probes, and
measurements were reported rather than shown. This round supplies that
evidence. The raise_log text was narrowed to the probed outputs.

## Evidence

**Measurements** (output of `./scripts-run src/scripts/check_hook_bundle_composition`, same machine, same run conditions):
- base `self_repair.ts` (origin/main) on this branch: `hook bundle: 1556556 B / 1556670 B ceiling`
- first version of the change: `bundle is 1557830 bytes … over by 1160`
- after merging the patterns into one alternation and removing the subsumed
  `how many times (do|must|should) i` pattern: `bundle is 1557684 bytes`
- with the raise: `✅ hook bundle: 1557684 B / 1557800 B ceiling`

**Trigger coverage.** `tests/scripts/recurring_criticism_trigger_drift.test.ts`
parses the trigger list of `src/rules/recurring-criticism.md` (10 phrases) and
asserts each fires `detectUserReport` in a complaint sentence or sits in an
allowlist with a reason. Before the pattern change 6 failed (`zum dritten mal`,
`wie oft noch`, `immer noch nicht`, `told you this`, `how many times`,
`as i mentioned before`); after it all pass, with `schon mehrfach` and
`schon wieder` allowlisted (they need a verb / an addressee).

**Fingerprint.** It takes only the class and the evidence span — `subject` is
not an argument:

```ts

/**
 * Fingerprint = class + shape of the evidence, never its incidentals. Digits,
 * quoted spans and punctuation are normalized away so the same defect seen
 * with a different name or count folds into one record instead of flooding
 * the queue with near-duplicates.
 */
export function fingerprint(defect_class: DefectClass, evidence: string): string {
    const shape = evidence
        .toLowerCase()
        .replace(/\d+/g, '#')
        .replace(/[`"'‚'„"»«]/g, '')
        .replace(/[^a-zà-ÿ#\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return createHash('sha256').update(`${defect_class}|${shape}`).digest('hex').slice(0, 16);

```

Probe: changing the caller to `fingerprint(finding.defect_class, finding.evidence + (finding.subject ?? ""))`
turned `is not part of the fingerprint` red
(`expected 'c5de69ec009aed83' to be '744455792abfddb1'`); restored, 93/93 pass.

**Release payload.** The test below seeds `subject: 'SUBJECT-LINE'` and asserts
it is absent from `renderOutgoing(collectOutgoing(...))` — the whole outgoing
set the release step sends (pull-request body and the fallback issue) — and
from the issue-route body. Probe: adding a `- **Subject:**` line to
`renderUpstreamBody` turned both tests red
(`expected '=== destination ===…' not to contain 'SUBJECT-LINE'`); restored, they pass.

```ts
    // Every field that is free text stays on the machine, whatever its name:
    // the evidence span, the suggested surface, the mechanism and the
    // falsifier. Only the class, the targets, the principle slug and the
    // counters leave — in the pull request body and in the issue it degrades to.
    const LOCAL = ['EVIDENCE-SPAN', 'SURFACE-LINE', 'MECHANISM-LINE', 'FALSIFIER-LINE', 'SUBJECT-LINE'];
    function claimRecord(): DefectRecord {
        return {
            ...record(),
            evidence: 'EVIDENCE-SPAN quoted from a transcript',
            suggested_surface: 'SURFACE-LINE in a company term',
            target: ['rule:verify-before-complete'],
            principle: 'drain/baseline-drift',
            mechanism: 'MECHANISM-LINE in a company term',
            falsifier: 'FALSIFIER-LINE in a company term',
            subject: 'SUBJECT-LINE',
        };
    }

    it('payload-has-only-closed-fields — pull request body and fallback issue carry the closed fields and nothing else', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const rec = claimRecord();
        const p = planRelease(rec, probe(r), r.checkout);
        expect(p.route).toBe('pull-request');
        const text = renderOutgoing(collectOutgoing(rec, p, probe(r), f.runner, 'o/r').outgoing);

        expect(text).toMatch(/=== pull request ===/);
        expect(text).toMatch(/=== issue, if the pull request fails ===/);
        for (const v of ['user-reported', 'rule:verify-before-complete', 'drain/baseline-drift', rec.fingerprint]) {
            expect(text).toContain(v);
        }
        for (const v of LOCAL) expect(text).not.toContain(v);
    });

    it('payload-has-only-closed-fields — the issue route sends the same closed body', () => {
        const rec = claimRecord();
        const p = planRelease(rec, { agentConfigCheckout: null, ghAuthenticated: true, canPushUpstream: false, canFork: false }, os.tmpdir());
        expect(p.route).toBe('issue');
        expect(p.body).toContain('drain/baseline-drift');
        for (const v of LOCAL) expect(p.body).not.toContain(v);
    });

    it('payload-has-only-closed-fields — a record with no principle says so instead of falling back to free text', () => {
        const { principle: _p, target: _t, ...rec } = claimRecord();
        const p = planRelease(rec, { agentConfigCheckout: null, ghAuthenticated: true, canPushUpstream: false, canFork: false }, os.tmpdir());
        expect(p.body).toMatch(/Principle:.*not stated/);
        expect(p.body).toMatch(/Targets:.*none/);
        for (const v of LOCAL) expect(p.body).not.toContain(v);
    });


```

**Why the subject ships now.** The roadmap's acceptance criterion AC-2 requires
the record of "Zum dritten Mal: Tabs!" to name `tabs` locally, so differently
worded repeats can be told apart; the counter over subjects is a later roadmap.

## Questions

1. Does this change expand any agent's authority, permissions or the reach of a
   safety floor, or is it a size-budget adjustment plus a protective widening
   of the privacy check's input?
2. Is the raise_log entry accurate against the diff and the evidence above?
3. On this evidence, does `subject` have a path off the machine?

Answer each with findings, then a verdict: `ratified`,
`confirmed-non-expanding`, or `refused` with reasons.

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f93d681efa..4501e70a56 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1556670,
+    "max_bytes": 1557800,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -100,6 +100,14 @@
             "what_was_added": "The owner's 2026-10-22 quota directive on the dispatch path: one LAZY_CONCERNS row shared by `quota-notice` and `metered-spawn-ask` (both bodies live in their own chunk), `permission_gate` emitting a concern's `ask` vote as the host's native ask with its reason, and `_lib/pressure_state` — a ten-line reader of the plan-window verdict the status-line tap leaves behind — used by `delegation-nudge` (no fan-out push into a hot window) and `spawn-guard-shadow` (`plan_window: would_wait`). Measured 1,556,562 B with the change on a base of 1,554,827 B, after ratification rounds 1 and 2 restricted the host ask to `effect: confirmation` concerns, passed that effect from the dispatcher and bounded the reasons. The ceiling, 1,556,670 B, was set at the round-1 reading (1,556,520 B) plus the 150 B of headroom the base had; 108 B remain.",
             "why_it_could_not_be_avoided": "Room was made first and measured: compacting the LAZY_CONCERNS table and dropping `path.join` from its rows freed 202 B, which carried the shared row and the ask passthrough with 16 B to spare. The two dispatch-path consumers could not follow: reading the ledger and the pressure model there cost 4,984 B, so the model moved to the tap (a CLI process, outside this bundle) and the consumers read its verdict file instead. What remains is the verdict reader and two call sites, which no chunk can carry because both concerns are in-bundle.",
             "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
+        },
+        {
+            "date": "2026-10-29",
+            "from": 1556670,
+            "to": 1557800,
+            "by": "agent, worktree-inbox-2026-10-bi (road-to-a-correction-that-is-heard 1.1, 1.3)",
+            "what_was_added": "The self-repair user-report detector on the dispatch path: one combined recurrence pattern (ordinal + punctuation, `wie oft noch`, `how many times`, `as I mentioned before`, `told you this`, `immer noch nicht`, an addressed `schon wieder`) that makes 8 of the 10 trigger phrases `recurring-criticism` names fire, plus a local-only `subject` capture (`tabs`) that makes counting repeats by subject possible; the counter itself is not built here (later/road-to-a-noted-that-is-a-write 1.2). Measured 1,557,684 B on a base of 1,556,556 B (self_repair.ts at the base, same gate run); the ceiling is that reading plus 116 B, close to the 114 B the base had. Where the subject goes was probed, not asserted: rendering it into the upstream body turned both `payload-has-only-closed-fields` tests (tests/scripts/self_repair_release.test.ts, which check the whole outgoing release payload and the fallback issue body) red, and feeding it into `fingerprint()` turned `is not part of the fingerprint` (tests/scripts/self_repair.test.ts) red; both passed once restored. AI council 2026-10-29: round 1 confirmed-non-expanding with conditions, round 2 split on the evidence, round 3 on the probes.",
+            "why_it_could_not_be_avoided": "Room was made first and measured: the six new patterns were merged into one alternation and the narrower `how many times (do|must|should) i` pattern, now subsumed, was removed, which cut the growth from 1,274 B to 1,128 B. The detector runs in the `self-repair` concern on `user_prompt_submit`, which is inlined, not a lazy chunk; moving it into a chunk is a dispatcher change larger than this raise. The subject ships now because road-to-a-correction-that-is-heard AC-2 requires the record to name what a repeated correction was about; without it differently worded repeats cannot be told apart."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/self_repair.ts b/src/scripts/_lib/self_repair.ts
index c3ab1a1d10..2a1943b105 100644
--- a/src/scripts/_lib/self_repair.ts
+++ b/src/scripts/_lib/self_repair.ts
@@ -130,6 +130,12 @@ export interface DefectFinding {
     principle?: string;
     /** One bounded line naming how the defect happens. No producer field yet. Free text, so it never leaves. */
     mechanism?: string;
+    /**
+     * What a user report is about (`tabs`), so repeats phrased differently can be
+     * read side by side. Local-only like `mechanism`: outside the fingerprint and
+     * never rendered upstream.
+     */
+    subject?: string;
     /** One bounded line naming what would refute the claim; a retro's `Candidate.falsifier`. Never leaves. */
     falsifier?: string;
     /**
@@ -267,7 +273,7 @@ export function egressBlockedReason(record: DefectRecord, repoRoot?: string | nu
     // Every free value the record carries, not only the two a report renders
     // today — a field the floor never saw must not become sendable later by a
     // renderer change alone.
-    const text = [record.suggested_surface, record.evidence, record.principle, record.mechanism, record.falsifier]
+    const text = [record.suggested_surface, record.evidence, record.principle, record.mechanism, record.falsifier, record.subject]
         .filter((v): v is string => typeof v === 'string' && v.length > 0)
         .join('\n');
     const result = redact_low_impact_entry(text, {
@@ -507,7 +513,9 @@ const COMPLAINT_PATTERNS: readonly RegExp[] = [
     // carries, and matching only the ASCII one is a dead branch on live input.
     /\bi ?(have|['’]ve)? ?already (told|said)\b/i,
     /\b(told|said) (you )?(this|that|it)? ?(\w+|\d+) times?\b/i,
-    /\bhow many times (do|must|should) i\b/i,
+    // An ordinal restates only when punctuation follows it ("Zum dritten Mal: Tabs!",
+    // not "zum dritten Mal gewonnen"); "schon wieder" needs an addressee nearby.
+    /\b(zum (zweiten|dritten|vierten|fünften) mal|for the (second|third|fourth|fifth) time)\s*[:!,—–-]|\bwie oft noch\b|\bhow many times\b|\bas i (mentioned|said) (before|earlier)\b|\btold you (this|that)\b|\bimmer noch nicht\b|\bschon wieder\b[^.!?]{0,40}\b(du|you|ihr)\b|\b(du|you|ihr)\b[^.!?]{0,40}\bschon wieder\b/i,
 ];
 
 // Phrasings that MATCH a complaint pattern but are not complaints — a curious
@@ -552,11 +560,35 @@ function spanExonerated(prompt: string, start: number, end: number): boolean {
     return false;
 }
 
+export const MAX_SUBJECT = 40;
+
+/**
+ * A backticked token anywhere in the prompt, else the clause after a colon that
+ * closes the matched marker. Undefined when neither names anything.
+ */
+function reportSubject(prompt: string, matchEnd: number): string | undefined {
+    let raw = /`([^`\n]+)`/.exec(prompt)?.[1];
+    if (raw === undefined) {
+        const colon = /^[^.!?\n:]{0,3}:\s*([^.!?\n]+)/.exec(prompt.slice(matchEnd - 1));
+        raw = colon?.[1];
+    }
+    if (raw === undefined) {
+        return undefined;
+    }
+    const subject = sanitizeEvidence(raw)
+        .toLowerCase()
+        .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
+        .slice(0, MAX_SUBJECT)
+        .trim();
+    return subject === '' ? undefined : subject;
+}
+
 /** Intake path 1 — the user says the agent worked wrongly. */
 export function detectUserReport(prompt: string): DefectFinding | null {
     for (const re of COMPLAINT_PATTERNS) {
         const m = re.exec(prompt);
         if (m !== null && !spanExonerated(prompt, m.index, m.index + m[0].length)) {
+            const subject = reportSubject(prompt, m.index + m[0].length);
             return {
                 defect_class: 'user-reported',
                 source: 'user-reported',
@@ -564,6 +596,7 @@ export function detectUserReport(prompt: string): DefectFinding | null {
                 suggested_surface:
                     'Analyse the turn the user is objecting to and name the rule, skill, or ' +
                     'gate whose absence allowed it.',
+                ...(subject !== undefined ? { subject } : {}),
             };
         }
     }
@@ -844,6 +877,7 @@ export function mergeRecord(
             ...(target.length > 0 ? { target } : {}),
             ...(proposes.length > 0 ? { proposes } : {}),
             ...(unitKeys.length > 0 ? { unit_keys: unitKeys } : {}),
+            ...(existing.subject ?? finding.subject ? { subject: existing.subject ?? finding.subject } : {}),
             // A detector-opened record that a retro later names keeps the name.
             ...claimFields(existing, finding),
         };
```
