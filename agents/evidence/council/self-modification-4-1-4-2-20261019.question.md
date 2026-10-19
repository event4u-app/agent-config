# Modification review — a diff that edits the ratification gate and its subject calculator

You are reviewing a change to this package's own governance mechanism. Answer
the nine questions below, one at a time, then close on a single stance line.

Close with exactly one line, in this form:

    STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <0-100> | DEALBREAKER: <one sentence, or none>

`ratified` — the change is sound and may pass the gate.
`confirmed-non-expanding` — the change does not widen any authority; it may pass.
`refused` — it must not pass as it stands; name the dealbreaker.

## Context you need

`check_kernel_edit_ratified.ts` refuses a diff that touches a governed surface
unless the diff also carries a ratification record under
`agents/evidence/ratifications/`. `_lib/ratification_subject.ts` computes the
`subject` digest over the gated files at a Git revision, which binds a record to
the content it reviewed. `isMechanismPath()` is the single predicate both the
refusal and the digest read.

This change does two things, which the author presents as one concern —
expanding which surfaces are governed:

1. The two modules that decide what this review ASKS
   (`modification_review_questions.ts`) and what the seats' answers ADD UP TO
   (`modification_review.ts`) are added to the gated surface. The gate does not
   import them, so the import-closure criterion that gated its other modules on
   2026-10-15 never reached them.
2. The 28 members of `src/config/rule-consequence-class.json` — the
   high-consequence rule class outside the nine kernel rules — become gated, as
   do that list and the `rule.schema.json` criterion that selects it.

## Prior history you should weigh rather than take on trust

This work was refused by a modification review on 2026-10-12, 2/2, on
`smaller-change`: it was bundled with three other concerns in a 177 KB diff that
exceeded the 51 KB bundle ceiling, so neither seat saw the whole of it. Both
seats said the concerns could be staged. This diff is one of those concerns,
staged. No seat in eleven recorded rounds disputed the design or the scope — the
refusals were about shape and about defects, not about whether to do it.

## What the author states about scope, which you should test rather than accept

The author claims this change NARROWS agent latitude and widens no authority:
more paths require a record than before, none fewer. Test that claim.

The author also records a deliberate omission: step 4.1 as drafted named
`docs/contracts/ratification-artifact.md` for the watch list, and this change
leaves it OUT, citing an owner decision of 2026-10-15 recorded in the gate's own
`MECHANISM_IMPORT_PATHS` header. Judge whether leaving it out is right.

## What is in this bundle and what is not

Included in full at one line of context: the `src/` diff, the `tests/` diff and
the `docs/contracts/` diff. NOT included: the roadmap prose diff
(`agents/roadmaps/road-to-self-modification-that-a-council-must-pass.md`, +59
lines of record-keeping, no executable content), listed below as a stat only.
Nothing executable is omitted from this bundle.

## The nine questions

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

## Changed-file stat

 ...o-self-modification-that-a-council-must-pass.md |  59 ++++++++-
 docs/contracts/ratification-artifact.md            |  34 ++++++
 src/scripts/_lib/ratification_subject.ts           |  11 +-
 src/scripts/check_kernel_edit_ratified.ts          | 115 +++++++++++++++++-
 src/scripts/classify_merge_risk.ts                 |  13 +-
 ..._kernel_edit_ratified_consequence_class.test.ts | 133 +++++++++++++++++++++
 ...eck_kernel_edit_ratified_reviewer_paths.test.ts |  92 ++++++++++++++
 .../classify_merge_risk_base_revision.test.ts      |   2 +-
 8 files changed, 449 insertions(+), 10 deletions(-)

## src/ diff

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 176f6532c..df2c6a803 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -467,3 +467,12 @@ export function gatedFilesOf(
     const g = derived === undefined ? classifyPaths(normalized) : classifyPaths(normalized, derived);
-    const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
+    const out = new Set<string>([
+        ...g.kernelRules,
+        ...g.governanceHooks,
+        ...g.plumbing,
+        // Step 4.2. Omitting this class would leave a surface the gate REFUSES
+        // and the digest does not cover: the refusal names the rule and the
+        // `subject` says nothing about its bytes, so no record answers for them.
+        // Both limbs or neither.
+        ...g.consequenceRules,
+    ]);
     for (const f of normalized) {
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..5b9b4c158 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -186,2 +186,44 @@ export const ANCHOR_PATHS: readonly string[] = [
 
+/**
+ * The two modules that decide what the review ASKS and what its answers add up
+ * to: the question list and the verdict rule.
+ *
+ * Step 4.1 of `road-to-self-modification-that-a-council-must-pass`. The
+ * import-closure criterion of 2026-10-15 gates every module this gate loads,
+ * and the gate does not load these two — it recomputes the digest and reads
+ * only the record. So the reviewer's deciding modules sat outside what the
+ * reviewer reviews, and a change to the question set or the verdict rule could
+ * be made with no record at all.
+ *
+ * They are modules of their OWN for exactly this reason, and the rest of
+ * `src/scripts/ai_council/` stays ungated on purpose: gating prompts,
+ * transports, the tally or the chairman would price every routine council edit
+ * at the rate of a governance change, which is the pressure that eventually
+ * weakens a gate.
+ *
+ * DELIBERATELY ABSENT, and recorded here rather than left to be inferred: the
+ * contract `docs/contracts/ratification-artifact.md` and the writer CLIs, which
+ * step 4.1 as drafted named. The gate's `MECHANISM_IMPORT_PATHS` header carries
+ * an owner decision of 2026-10-15 keeping them outside; widening to them is a
+ * reopening of that decision and is not an agent's to take.
+ */
+export const REVIEWER_PATHS: readonly string[] = [
+    'src/scripts/ai_council/modification_review_questions.ts',
+    'src/scripts/ai_council/modification_review.ts',
+];
+
+/**
+ * The high-consequence rule class and the criterion that selects it.
+ *
+ * Step 4.2. The list is watched so that a change cannot DROP a member in order
+ * to edit the rule it names; the schema is watched because the criterion that
+ * produced the list lives in its `consequence_class` property, and a criterion
+ * nobody ratified selects a class nobody ratified. The schema is shared by
+ * every rule, so any edit to it needs a record.
+ */
+export const CONSEQUENCE_CLASS_PATHS: readonly string[] = [
+    'src/config/rule-consequence-class.json',
+    'src/scripts/schemas/rule.schema.json',
+];
+
 /** Governance hooks: the blocking PreToolUse guards. */
@@ -344,2 +386,7 @@ export interface GatedPaths {
     plumbing: string[];
+    /**
+     * Rules in the high-consequence class of `rule-consequence-class.json` that
+     * are NOT among the nine kernel rules. Step 4.2: rule law beyond the kernel.
+     */
+    consequenceRules: string[];
     self: boolean;
@@ -359,3 +406,5 @@ export function isMechanismPath(p: string): boolean {
         ANCHOR_PATHS.includes(p) ||
-        MECHANISM_IMPORT_PATHS.includes(p)
+        MECHANISM_IMPORT_PATHS.includes(p) ||
+        REVIEWER_PATHS.includes(p) ||
+        CONSEQUENCE_CLASS_PATHS.includes(p)
     );
@@ -363,2 +412,44 @@ export function isMechanismPath(p: string): boolean {
 
+/**
+ * The high-consequence rule slugs, read from the gate's OWN tree.
+ *
+ * From the script's tree and never from `--root`, for the reason the quorum
+ * policy is read that way: in CI this code is the base revision's, so a
+ * candidate that removed a member from the list would still be judged against
+ * the list the base carries. Reading it from the head would let a change drop a
+ * member in order to edit the rule that member names — the exact move the list
+ * is on the watch list to make visible.
+ *
+ * A missing or unparseable file yields an EMPTY set, not a refusal, and the
+ * asymmetry with the quorum policy is deliberate: the policy decides whether a
+ * control can measure at all, while this list only WIDENS the gated set. An
+ * empty list falls back to the kernel-and-hooks reach the gate had before step
+ * 4.2, which is the pre-existing floor rather than an open door.
+ */
+let consequenceSlugCache: ReadonlySet<string> | null = null;
+
+export function consequenceRuleSlugs(repoRoot: string = REPO): ReadonlySet<string> {
+    if (repoRoot === REPO && consequenceSlugCache !== null) {
+        return consequenceSlugCache;
+    }
+    let slugs: ReadonlySet<string> = new Set<string>();
+    try {
+        const raw = fs.readFileSync(
+            path.join(repoRoot, CONSEQUENCE_CLASS_PATHS[0] as string),
+            'utf8',
+        );
+        const parsed = JSON.parse(raw) as { members?: unknown };
+        const members = parsed.members;
+        if (members !== null && typeof members === 'object' && !Array.isArray(members)) {
+            slugs = new Set(Object.keys(members as Record<string, unknown>));
+        }
+    } catch {
+        slugs = new Set<string>();
+    }
+    if (repoRoot === REPO) {
+        consequenceSlugCache = slugs;
+    }
+    return slugs;
+}
+
 /** Partition a changed-file list into the surfaces this gate watches. */
@@ -367,2 +458,3 @@ export function classifyPaths(
     derived: readonly string[] = derivedPlumbing(),
+    consequence: ReadonlySet<string> = consequenceRuleSlugs(),
 ): GatedPaths {
@@ -372,2 +464,3 @@ export function classifyPaths(
     const plumbing: string[] = [];
+    const consequenceRules: string[] = [];
     let self = false;
@@ -387,2 +480,6 @@ export function classifyPaths(
         }
+        if (m !== null && consequence.has(m[1] ?? '')) {
+            consequenceRules.push(p);
+            continue;
+        }
         if (GOVERNANCE_HOOK_RE.test(p)) {
@@ -395,3 +492,3 @@ export function classifyPaths(
     }
-    return { kernelRules, governanceHooks, plumbing, self };
+    return { kernelRules, governanceHooks, plumbing, consequenceRules, self };
 }
@@ -404,2 +501,3 @@ export function requiresRatification(gated: GatedPaths): boolean {
         gated.plumbing.length > 0 ||
+        gated.consequenceRules.length > 0 ||
         gated.self
@@ -563,2 +661,3 @@ export function evaluate(
         ...gated.plumbing,
+        ...gated.consequenceRules,
         ...files.map((f) => f.replace(/\\/g, '/').trim()).filter(isMechanismPath),
@@ -634,3 +733,4 @@ export function evaluate(
         lines.push(
-            '✅  no kernel rule, governance hook, hook-plumbing source or self edit in the ' +
+            '✅  no kernel rule, high-consequence rule, governance hook, hook-plumbing ' +
+                'source or self edit in the ' +
                 'diff — nothing to ratify',
@@ -643,5 +743,12 @@ export function evaluate(
         ...gated.kernelRules.map((p) => `kernel rule ${p}`),
+        ...gated.consequenceRules.map((p) => `high-consequence rule ${p}`),
         ...gated.governanceHooks.map((p) => `governance hook ${p}`),
         ...gated.plumbing.map((p) => `hook-plumbing source ${p}`),
-        ...(gated.self ? ['the ratification mechanism itself (gate, its imports, policy or workflow)'] : []),
+        ...(gated.self
+            ? [
+                  'the ratification mechanism itself (gate, its imports, policy, workflow, ' +
+                      'the review\u2019s question list and verdict rule, or the ' +
+                      'high-consequence rule class and its criterion)',
+              ]
+            : []),
     ];
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index f3c94ebd4..2650d55e8 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -396,6 +396,15 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
     if (requiresRatification(gated)) {
-        const gatedPaths = [...gated.kernelRules, ...gated.governanceHooks, ...gated.plumbing];
+        const gatedPaths = [
+            ...gated.kernelRules,
+            // The high-consequence rule class. Omitting it would let
+            // `requiresRatification` report the surface as gated while the
+            // NAMED path list stayed empty, so a PR touching only such a rule
+            // would carry the governance reason with nothing under it.
+            ...gated.consequenceRules,
+            ...gated.governanceHooks,
+            ...gated.plumbing,
+        ];
         add(
             'governance-surface',
-            'check_kernel_edit_ratified — kernel rule, governance hook, hook plumbing or the ratification mechanism',
+            'check_kernel_edit_ratified — kernel rule, high-consequence rule, governance hook, hook plumbing or the ratification mechanism',
             gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p]).self),
```

## docs/contracts/ diff

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index d8d27c92d..94ca0045c 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -24,2 +24,36 @@ PROVIDER DIVERSITY IS REQUIRED WHERE TWO PROVIDERS ARE CONFIGURED.
 
+### Which surfaces are gated
+
+The gate partitions a diff into five, and the list is here because a reader who
+knows only the Iron Law above cannot tell which files it reaches:
+
+1. **the nine kernel rules** — by name, from `_lib/kernel_rules.ts`;
+2. **the high-consequence rule class** — the members of
+   `src/config/rule-consequence-class.json`, selected by the `consequence_class`
+   criterion in `rule.schema.json` rather than by a list the gate keeps. 28 at
+   the time of writing. The list and the schema are themselves watched, so a
+   change cannot drop a member in order to edit the rule that member names, and
+   the list is read from the **gate's own tree** — never from `--root` — because
+   in CI the gate is the base revision's and a candidate that shortened the list
+   would otherwise be judged against its own shortened copy;
+3. **governance hooks** — the blocking `block_*` PreToolUse guards;
+4. **hook-plumbing sources** — the files that decide which concern runs, on
+   which host, under which budget;
+5. **the review mechanism itself** — this gate, its reader, its policy, its
+   workflow, the platform anchor, the modules of its own import closure, and the
+   question list and verdict rule named in § The modification review asks a
+   fixed set. Condition 4 of § When the user decides already reserved "the
+   modules that … ask the questions and derive the verdict" to the owner; the
+   gate did not watch them until step 4.1 of
+   `road-to-self-modification-that-a-council-must-pass`, so the reservation was
+   a claim this contract made and the gate did not keep.
+
+**A missing or unparseable class list widens nothing and refuses nothing**, and
+that asymmetry with the quorum policy is deliberate rather than an oversight:
+the policy fails closed because it decides whether a control can measure at all,
+while this list only WIDENS the gated set, so failing closed on it would red
+every kernel change over a file whose absence costs only the widening. The
+fallback is the kernel-and-hooks reach the gate had before the class existed —
+a pre-existing floor, not an open door.
+
 ## Where it lives
```

## tests/ diff

```diff
diff --git a/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
new file mode 100644
index 000000000..1638dff20
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
@@ -0,0 +1,133 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import {
+    CONSEQUENCE_CLASS_PATHS,
+    classifyPaths,
+    consequenceRuleSlugs,
+    isMechanismPath,
+    requiresRatification,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
+import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
+
+/**
+ * Step 4.2 of `road-to-self-modification-that-a-council-must-pass`.
+ *
+ * Nine kernel rules were gated and the 28 rules of the high-consequence class
+ * were not, so the rules that carry the most authority outside the kernel could
+ * be edited with no record at all. The class is selected by the criterion in
+ * `rule.schema.json`, not by a name list this gate keeps, and both the list and
+ * the schema join the watch list so that a change cannot DROP a member in order
+ * to edit the rule that member names.
+ */
+
+describe('rule law beyond the nine kernel rules', () => {
+    it('reads the class members from the list', () => {
+        const slugs = consequenceRuleSlugs();
+        expect(slugs.size).toBeGreaterThan(0);
+        const declared = JSON.parse(
+            fs.readFileSync(CONSEQUENCE_CLASS_PATHS[0] as string, 'utf8'),
+        ) as { members: Record<string, unknown> };
+        expect([...slugs].sort()).toEqual(Object.keys(declared.members).sort());
+    });
+
+    it('gates a class member that is not a kernel rule', () => {
+        const slug = [...consequenceRuleSlugs()][0] as string;
+        const p = `src/rules/${slug}.md`;
+        const gated = classifyPaths([p], []);
+        expect(gated.consequenceRules).toEqual([p]);
+        expect(gated.kernelRules).toEqual([]);
+        expect(requiresRatification(gated)).toBe(true);
+        expect(gatedFilesOf([p], [])).toContain(p);
+    });
+
+    // Polarity: a rule outside the class is still an ordinary rule.
+    it('leaves a rule outside the class ungated', () => {
+        const slugs = consequenceRuleSlugs();
+        const outside = 'definitely-not-a-governed-rule-slug';
+        expect(slugs.has(outside)).toBe(false);
+        const gated = classifyPaths([`src/rules/${outside}.md`], []);
+        expect(gated.consequenceRules).toEqual([]);
+        expect(requiresRatification(gated)).toBe(false);
+    });
+
+    it('still reports a kernel rule as a kernel rule, not as a class member', () => {
+        const gated = classifyPaths(['src/rules/non-destructive-by-default.md'], []);
+        expect(gated.kernelRules).toEqual(['src/rules/non-destructive-by-default.md']);
+        expect(gated.consequenceRules).toEqual([]);
+    });
+
+    it('watches the list and the criterion schema', () => {
+        for (const p of CONSEQUENCE_CLASS_PATHS) {
+            expect(isMechanismPath(p)).toBe(true);
+            expect(classifyPaths([p], []).self).toBe(true);
+        }
+    });
+
+    /**
+     * The drop-then-edit move, which is the reason the list is watched: a diff
+     * that removes a member AND edits the rule it named still carries a record,
+     * because removing the member edits the watched list.
+     */
+    it('refuses the drop-then-edit diff either way', () => {
+        const slug = [...consequenceRuleSlugs()][0] as string;
+        const gated = classifyPaths(
+            [CONSEQUENCE_CLASS_PATHS[0] as string, `src/rules/${slug}.md`],
+            [],
+        );
+        expect(gated.self).toBe(true);
+        expect(requiresRatification(gated)).toBe(true);
+    });
+});
+
+/**
+ * The list is read from the gate's OWN tree, never from `--root`, for the reason
+ * the quorum policy is: in CI this code is the base revision's, so a candidate
+ * that shortened the list would otherwise be judged against its own shortened
+ * copy.
+ */
+describe('the class list is read from the gate tree', () => {
+    let dir = '';
+    beforeEach(() => {
+        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consequence-'));
+    });
+    afterEach(() => {
+        fs.rmSync(dir, { recursive: true, force: true });
+    });
+
+    it('ignores a shortened list in a candidate root', () => {
+        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
+        fs.writeFileSync(
+            path.join(dir, CONSEQUENCE_CLASS_PATHS[0] as string),
+            JSON.stringify({ members: {} }),
+        );
+        // The default read is the gate's own tree and is unchanged by the above.
+        expect(consequenceRuleSlugs().size).toBeGreaterThan(0);
+        // Asked for the candidate root explicitly, it reads the short list —
+        // which is exactly why `classifyPaths` never passes one.
+        expect(consequenceRuleSlugs(dir).size).toBe(0);
+    });
+
+    /**
+     * One deliberate asymmetry with the quorum policy, recorded rather than
+     * silently chosen: a missing or unparseable list yields an EMPTY set rather
+     * than a refusal. The policy fails closed because it decides whether a
+     * control can measure at all; this list only WIDENS, so failing closed on it
+     * would red every kernel PR over a file whose absence costs only the
+     * widening.
+     */
+    it('falls back to an empty set on a missing or unparseable list', () => {
+        expect(consequenceRuleSlugs(dir).size).toBe(0);
+        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
+        fs.writeFileSync(path.join(dir, CONSEQUENCE_CLASS_PATHS[0] as string), '{ not json');
+        expect(consequenceRuleSlugs(dir).size).toBe(0);
+        fs.writeFileSync(
+            path.join(dir, CONSEQUENCE_CLASS_PATHS[0] as string),
+            JSON.stringify({ members: [] }),
+        );
+        expect(consequenceRuleSlugs(dir).size).toBe(0);
+    });
+});
diff --git a/tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts b/tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts
new file mode 100644
index 000000000..b7f5e4556
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts
@@ -0,0 +1,92 @@
+import { describe, expect, it } from 'vitest';
+
+import {
+    classifyPaths,
+    isMechanismPath,
+    REVIEWER_PATHS,
+    requiresRatification,
+} from '../../src/scripts/check_kernel_edit_ratified.js';
+import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
+
+/**
+ * Step 4.1 residue of `road-to-self-modification-that-a-council-must-pass`.
+ *
+ * The gate watches itself, its reader, its policy, its workflow, the anchor and
+ * the modules of its own import closure. It did NOT watch the two modules that
+ * decide what the council is asked and what its answers add up to — the
+ * question list and the verdict rule — because the gate does not import them
+ * and the import-closure criterion of 2026-10-15 therefore never reached them.
+ * A change to either is a change to the reviewer.
+ *
+ * The polarity half is the part that earns its place: the rest of
+ * `src/scripts/ai_council/` stays ungated on purpose. Gating prompts and
+ * transports would price every routine council edit at the rate of a governance
+ * change, which is the pressure that eventually weakens a gate. If the
+ * rejecting block below ever goes green, that boundary has been undone.
+ */
+
+describe('the review mechanism is inside the gated surface', () => {
+    it('watches the question list and the verdict rule', () => {
+        expect([...REVIEWER_PATHS].sort()).toEqual([
+            'src/scripts/ai_council/modification_review.ts',
+            'src/scripts/ai_council/modification_review_questions.ts',
+        ]);
+    });
+
+    for (const p of [
+        'src/scripts/ai_council/modification_review_questions.ts',
+        'src/scripts/ai_council/modification_review.ts',
+    ]) {
+        it(`classifies ${p} as the mechanism itself`, () => {
+            expect(isMechanismPath(p)).toBe(true);
+            const gated = classifyPaths([p], []);
+            expect(gated.self).toBe(true);
+            expect(requiresRatification(gated)).toBe(true);
+        });
+
+        it(`covers ${p} with the subject digest, not only with the refusal`, () => {
+            // A path the gate refuses but the digest does not cover is bound by
+            // no record: the refusal names it and the `subject` says nothing
+            // about its bytes. Both limbs or neither.
+            expect(gatedFilesOf([p], [])).toContain(p);
+        });
+    }
+
+    // Polarity. Each of these is an ordinary council edit and must stay free.
+    for (const p of [
+        'src/scripts/ai_council/prompts.ts',
+        'src/scripts/ai_council/stance_tally.ts',
+        'src/scripts/ai_council/quorum.ts',
+        'src/scripts/ai_council/council_cli.ts',
+        'src/scripts/ai_council/chairman.ts',
+        'tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts',
+    ]) {
+        it(`leaves ${p} ungated`, () => {
+            expect(isMechanismPath(p)).toBe(false);
+            const gated = classifyPaths([p], []);
+            expect(gated.self).toBe(false);
+            expect(requiresRatification(gated)).toBe(false);
+        });
+    }
+
+    it('leaves an ordinary council change with nothing to ratify at all', () => {
+        const gated = classifyPaths(
+            ['src/scripts/ai_council/prompts.ts', 'src/scripts/ai_council/clients.ts'],
+            [],
+        );
+        expect(requiresRatification(gated)).toBe(false);
+    });
+
+    /**
+     * The contract and the writer CLIs are deliberately NOT here. Step 4.1 as
+     * drafted named `docs/contracts/ratification-artifact.md`; the gate's own
+     * header records an owner decision of 2026-10-15 keeping the contract and
+     * the writer CLIs outside, and an agent is not the one who reopens that.
+     * Pinned so the omission reads as a decision rather than as an oversight.
+     */
+    it('keeps the contract outside, per the owner decision of 2026-10-15', () => {
+        expect(isMechanismPath('docs/contracts/ratification-artifact.md')).toBe(false);
+        expect(isMechanismPath('src/scripts/ratification_subject.ts')).toBe(false);
+        expect(isMechanismPath('src/scripts/ratification_header.ts')).toBe(false);
+    });
+});
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 7162e1051..13b3acc74 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -148,3 +148,3 @@ describe('the code that classes a change is not the change’s own', () => {
                 '): GatedPaths {\n    const derivedSet',
-                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], self: false };\n    const derivedSet',
+                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], consequenceRules: [], self: false };\n    const derivedSet',
             ),
```
