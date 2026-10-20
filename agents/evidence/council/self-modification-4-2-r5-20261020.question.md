<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-20 (round 5), committed verbatim
     so the verdict beside it can be checked against what was actually asked
     (evaluator-independence). -->

# Modification review — the ratification gate gains the high-consequence rule class

You are reviewing a change to this package's own governance mechanism. Answer
the nine questions below, one at a time, then close on a single stance line:

    STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <0-100> | DEALBREAKER: <one sentence, or none>

`ratified` — sound, may pass the gate. `confirmed-non-expanding` — widens no
authority, may pass. `refused` — must not pass as it stands; name the dealbreaker.

## Context

`check_kernel_edit_ratified.ts` refuses a diff touching a governed surface
(nine kernel rules, governance hooks, hook plumbing, the gate's own mechanism)
unless it carries a ratification record under `agents/evidence/ratifications/`.
`_lib/ratification_subject.ts` digests the gated files from Git objects at a
revision, binding a record to what it reviewed. In CI the BASE revision's gate
runs against the head. `classify_merge_risk.ts` is the merge-time classifier;
its `governance-surface` trigger routes a pull request to the owner, not to a
council clearance (ADR-281 § Amendment: a council verdict on the gated surface
is advisory until an owner authorisation is bound to the same digest).

`src/config/rule-consequence-class.json` lists 28 rules beyond the kernel whose
violation would act irreversibly outside the repository, cross a security
boundary, or bypass a reserved authority; the criterion is stated in
`rule.schema.json#/properties/consequence_class`. This change gates those 28
rules (source and projection), the list, and the schema.

## History you should weigh rather than take on trust

- **2026-10-19, refused 2/2**: the list failed OPEN; membership was not read at
  the revision the subject binds to.
- **2026-10-20 round 1, split**: owner routing at merge read checkout
  membership. Now both merge triggers read the base/head union.
- **Round 2, split**: under-validated list as a repository-wide dependency; no
  proven production routing; no recovery path. Now: closed clause set;
  `classifyTarget` tested over real commits; inventory test.
- **Round 3, split**: recovery only through an external bypass; fixture
  silently altered. Now: the class is read (and fails closed) only for a diff
  holding a non-kernel rule path (`classDecidesAny`), so a broken list blocks
  only rule edits and is repaired THROUGH the gate (a recovery-drill test); each
  fixture suite seeds its list explicitly.
- **Round 4, split**. Dealbreaker, quoted: "The proposal gates
  consequence-class membership but deliberately leaves the schema that
  normatively defines that class outside the same authority boundary, allowing
  the protected criterion to be weakened without owner-ratified governance."
  Response: `rule.schema.json` joins the watch list as
  `CONSEQUENCE_CRITERION_PATH`; a test pins the gate's clause set equal to the
  schema's enum; a neighbouring schema stays ungated. Measured: 1 schema edit
  in the 30 days to 2026-10-20.

Also from round 4, stated rather than changed: the fixture suites seed an EMPTY
class and use kernel-rule paths or invented slugs; the 28 production members
are exercised only through the real checkout's list in the new suite. Host
trees such as `.claude/rules/` are untracked here and cannot appear in a diff.
Record authenticity and the owner's digest-bound authorisation are ADR-281's
existing mechanism, unchanged by this diff.

Measured cost: 7 of 457 first-parent commits on `main` in the 30 days to
2026-10-20 touched a class member and would now route to the owner at merge.

## What is in this bundle

The whole `src/` diff at zero lines of context. The `tests/` diff at zero lines
for the new suite, the fixture helper, and four changed merge and gate suites.
OMITTED for size, and mechanical: ten further suites
(`check_kernel_edit_ratified_{ci_path,import_closure,local_base,mechanism_closure,subject}`,
`ci_changed_files_rename_compat`, `ratification_subject{,_binding,_cli,_revision}`),
each only adding `writeEmptyConsequenceClass` to its fixture import and one call
after the line creating its temporary tree; and earlier rounds' prompts and
seat texts. Base `origin/main` @ 67928878b, head 5ecf60b10; subject
`3f44d05d2ec329cb45333ff4b73f35736b0c3ece05065a653ceb598dbb0d8ae8`.

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

## The src/ diff

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 176f6532c..3df47376c 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -170,0 +171,24 @@ export class GitReadFailed extends GatedSubjectRefusal {
+/**
+ * Raised when the high-consequence rule list cannot be read as a list at a
+ * revision: absent, unparseable, the wrong shape, a member that is not a rule
+ * slug, or a member naming no rule file in that same tree.
+ *
+ * FAILS CLOSED. The list decides which rules beyond the kernel need a record,
+ * so an unreadable list does not cost only a widening — it removes the
+ * protection from every member at once, and a gate that exits 0 over that is a
+ * control that passes when it cannot measure. Declared here rather than beside
+ * the reader in the gate because the two modules import each other: a subclass
+ * defined at the gate's module scope would be evaluated before this base class
+ * when this module is the entry point.
+ */
+export class ConsequenceClassUnreadable extends GatedSubjectRefusal {
+    constructor(rel: string, where: string, detail: string) {
+        super(
+            rel,
+            `the high-consequence rule list \`${rel}\` cannot be read at ${where} (${detail}) — ` +
+                'the gate refuses rather than judging those rules as if the class were empty',
+        );
+        this.name = 'ConsequenceClassUnreadable';
+    }
+}
+
@@ -464,0 +489 @@ export function gatedFilesOf(
+    consequence?: ReadonlySet<string>,
@@ -467,2 +492,11 @@ export function gatedFilesOf(
-    const g = derived === undefined ? classifyPaths(normalized) : classifyPaths(normalized, derived);
-    const out = new Set<string>([...g.kernelRules, ...g.governanceHooks, ...g.plumbing]);
+    // An `undefined` argument takes the gate's own default, so a caller that
+    // passes neither classifies exactly as `classifyPaths(normalized)` would.
+    const g = classifyPaths(normalized, derived, consequence);
+    // Both limbs or neither: a high-consequence rule the gate refuses and the
+    // digest did not cover would be gated by the refusal and bound by no record.
+    const out = new Set<string>([
+        ...g.kernelRules,
+        ...g.consequenceRules,
+        ...g.governanceHooks,
+        ...g.plumbing,
+    ]);
@@ -505,2 +539,3 @@ export interface SubjectReading {
- * `derived` is the plumbing closure the caller already computed, passed through
- * to {@link gatedFilesOf} unchanged: a digest that classified without it would
+ * `derived` is the plumbing closure and `consequence` the high-consequence rule
+ * slugs the caller already computed, both passed through to
+ * {@link gatedFilesOf} unchanged: a digest that classified without them would
@@ -516,0 +552 @@ export function subjectOf(
+    consequence?: ReadonlySet<string>,
@@ -518 +554 @@ export function subjectOf(
-    const gatedFiles = gatedFilesOf(files, derived);
+    const gatedFiles = gatedFilesOf(files, derived, consequence);
@@ -549,0 +586 @@ export function subjectDigest(
+    consequence?: ReadonlySet<string>,
@@ -551 +588 @@ export function subjectDigest(
-    return subjectOf(root, files, derived, revision).digest;
+    return subjectOf(root, files, derived, revision, consequence).digest;
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..acd8e23cd 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -39 +39,3 @@
- * `derivedPlumbing`) — or this gate itself, so it cannot
+ * `derivedPlumbing`) — a rule of the high-consequence class beyond the kernel
+ * (the members of `rule-consequence-class.json`, see `CONSEQUENCE_CLASS_PATH`)
+ * — or this gate itself, so it cannot
@@ -103,0 +106 @@ import {
+    ConsequenceClassUnreadable,
@@ -158,0 +162,38 @@ export const POLICY_PATH = 'src/config/ratification-policy.json';
+/**
+ * The high-consequence rule class: every rule whose violation would leave the
+ * repository irreversibly, cross a security boundary or bypass an authority
+ * (the criterion is stated in `rule.schema.json#/properties/consequence_class`).
+ * Its members beyond the nine kernel rules are gated like kernel rules.
+ *
+ * The list is on the watch list so that a change cannot drop a member in order
+ * to edit the rule it names, nor add one without a record. The schema that
+ * states the criterion (`CONSEQUENCE_CRITERION_PATH`) is watched too, although
+ * this gate never reads it: the criterion is what a person or an agent applies
+ * when deciding membership, so an unratified edit to it would weaken the class
+ * at its definition while every list edit stayed recorded. The schema is shared
+ * by every rule, so any edit to it needs a record — measured at 1 edit in the
+ * 30 days to 2026-10-20.
+ *
+ * Membership is read FROM GIT OBJECTS at both the base and the head commit and
+ * the union is gated (see `gateInputsFor`), so dropping a member is caught by
+ * the base side and adding one by the head side, and the digest covers both.
+ * It FAILS CLOSED WHERE IT DECIDES: a diff holding a rule path outside the
+ * kernel is refused when the list cannot be read at either commit. A diff
+ * holding no such path is classified identically under every membership, so
+ * the list is not read for it (`classDecidesAny`). That bounds what a broken
+ * list can block, and it is what makes a broken base repairable through this
+ * gate: the repair touches the list, which is a mechanism path and needs a
+ * ratified record whatever the list says, and no rule file, so it is judged
+ * like any other mechanism edit. A repair that must also edit a rule ships in
+ * two changes, list first. No repository flag switches the class off, because
+ * a switch the candidate can set is a switch the candidate controls.
+ *
+ * Rollout: the merge that introduces this class is judged by the base's copy
+ * of the gate, which does not know the class. That merge edits no member, so
+ * nothing passes ungated by it; members are gated from the next merge on.
+ */
+export const CONSEQUENCE_CLASS_PATH = 'src/config/rule-consequence-class.json';
+
+/** The schema whose `consequence_class` property states the class criterion. */
+export const CONSEQUENCE_CRITERION_PATH = 'src/scripts/schemas/rule.schema.json';
+
@@ -344,0 +386,5 @@ export interface GatedPaths {
+    /**
+     * Rules of the high-consequence class that are NOT among the nine kernel
+     * rules, in the source tree or in any projection — the kernel reach.
+     */
+    consequenceRules: string[];
@@ -347,0 +394,83 @@ export interface GatedPaths {
+/** A rule slug as a rule filename spells it, and nothing else. */
+const RULE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
+
+/**
+ * The three clauses of the criterion, as `rule.schema.json` enumerates them.
+ * Restated rather than imported so that the gate's import closure does not
+ * grow; a test pins it equal to `_lib/rule_consequence_class.ts`'s `CLAUSES`.
+ */
+export const CONSEQUENCE_CLAUSES: readonly string[] = [
+    'irreversible-external',
+    'security-boundary',
+    'authority-bypass',
+];
+
+/**
+ * The high-consequence rule slugs a list states, validated against the tree
+ * it was read from.
+ *
+ * `read` answers a repo-relative path with that tree's text or `null`; `where`
+ * names the tree in a refusal. Every way the list fails to be a list THROWS
+ * {@link ConsequenceClassUnreadable} — absent, unparseable, `members` not a
+ * plain object, a key that is not a rule slug (which also rules out
+ * `__proto__`), an entry without a string `clause`, or a member with no
+ * `src/rules/<slug>.md` in the same tree. An empty `members` is legal: it is
+ * a statement the list makes, reachable only by an edit of the gated list.
+ */
+export function consequenceRuleSlugsIn(
+    read: (rel: string) => string | null,
+    where: string,
+): ReadonlySet<string> {
+    const refuse = (detail: string): never => {
+        throw new ConsequenceClassUnreadable(CONSEQUENCE_CLASS_PATH, where, detail);
+    };
+    const raw = read(CONSEQUENCE_CLASS_PATH);
+    if (raw === null) {
+        refuse('the file is absent');
+    }
+    let parsed: unknown;
+    try {
+        parsed = JSON.parse(raw as string);
+    } catch (err) {
+        refuse(`not JSON: ${(err as Error).message}`);
+    }
+    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
+        refuse('the top level is not an object');
+    }
+    const members = (parsed as { members?: unknown }).members;
+    if (members === null || typeof members !== 'object' || Array.isArray(members)) {
+        refuse('`members` is not an object');
+    }
+    const slugs = new Set<string>();
+    for (const [slug, entry] of Object.entries(members as Record<string, unknown>)) {
+        if (!RULE_SLUG_RE.test(slug)) {
+            refuse(`member \`${slug}\` is not a rule slug`);
+        }
+        const clause =
+            entry !== null && typeof entry === 'object' ? (entry as { clause?: unknown }).clause : undefined;
+        if (typeof clause !== 'string' || !CONSEQUENCE_CLAUSES.includes(clause)) {
+            refuse(`member \`${slug}\` carries no \`clause\` of the criterion (${CONSEQUENCE_CLAUSES.join(', ')})`);
+        }
+        if (read(`src/rules/${slug}.md`) === null) {
+            refuse(`member \`${slug}\` names no rule file \`src/rules/${slug}.md\``);
+        }
+        slugs.add(slug);
+    }
+    return slugs;
+}
+
+/**
+ * The class as this checkout's working tree states it. The default for a
+ * caller that classifies without naming commits; read on every call and never
+ * cached, so a list changed during a run is never answered from a stale copy.
+ */
+export function consequenceRuleSlugsOfCheckout(root: string = REPO): ReadonlySet<string> {
+    return consequenceRuleSlugsIn((rel) => {
+        try {
+            return fs.readFileSync(path.join(root, rel), 'utf8');
+        } catch {
+            return null;
+        }
+    }, `the checkout \`${root}\``);
+}
+
@@ -358,0 +488,2 @@ export function isMechanismPath(p: string): boolean {
+        p === CONSEQUENCE_CLASS_PATH ||
+        p === CONSEQUENCE_CRITERION_PATH ||
@@ -364 +495,21 @@ export function isMechanismPath(p: string): boolean {
-/** Partition a changed-file list into the surfaces this gate watches. */
+/**
+ * True when classifying `files` depends on the high-consequence class at all:
+ * some path is a rule file (source or projection) outside the kernel. For any
+ * other diff every membership yields the same classification, so the class is
+ * not read — and a list that does not read cannot block a diff it cannot
+ * affect, the list's own repair included (the list is a mechanism path and is
+ * gated by that, whatever it says).
+ */
+export function classDecidesAny(files: readonly string[]): boolean {
+    return files.some((raw) => {
+        const m = KERNEL_RULE_PATH_RE.exec(raw.replace(/\\/g, '/').trim());
+        return m !== null && !is_kernel_rule(m[1] ?? '');
+    });
+}
+
+/**
+ * Partition a changed-file list into the surfaces this gate watches.
+ *
+ * `consequence` omitted reads this checkout's class, and only when a path
+ * needs it ({@link classDecidesAny}); that read fails closed.
+ */
@@ -367,0 +519 @@ export function classifyPaths(
+    consequence?: ReadonlySet<string>,
@@ -368,0 +521,3 @@ export function classifyPaths(
+    if (consequence === undefined) {
+        consequence = classDecidesAny(files) ? consequenceRuleSlugsOfCheckout() : new Set<string>();
+    }
@@ -372,0 +528 @@ export function classifyPaths(
+    const consequenceRules: string[] = [];
@@ -387,0 +544,4 @@ export function classifyPaths(
+        if (m !== null && consequence.has(m[1] ?? '')) {
+            consequenceRules.push(p);
+            continue;
+        }
@@ -396 +556 @@ export function classifyPaths(
-    return { kernelRules, governanceHooks, plumbing, self };
+    return { kernelRules, governanceHooks, plumbing, consequenceRules, self };
@@ -402,0 +563 @@ export function requiresRatification(gated: GatedPaths): boolean {
+        gated.consequenceRules.length > 0 ||
@@ -466,2 +627,13 @@ function resolveBaseRef(explicit: string | null, root: string): string {
- * THROWS a {@link GatedSubjectRefusal} when the base does not resolve or the
- * object store cannot be read.
+ * THE HIGH-CONSEQUENCE CLASS IS READ FROM THE SAME TWO COMMITS, and its union
+ * is gated. The base side alone would miss a member the change ADDS while
+ * editing that rule — the head's list names it, the base's does not, and its
+ * bytes would sit outside the digest the record carries. The head side alone
+ * would let a change drop a member in order to edit it. In the residue case the
+ * base side is this checkout's working-tree list, as the plumbing base is.
+ * Both sides are read only when `files` holds a rule path the class could
+ * decide ({@link classDecidesAny}); otherwise the class is empty, which for
+ * such a diff is exact rather than permissive.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when the base does not resolve, the
+ * object store cannot be read, or a needed class list cannot be read on
+ * either side.
@@ -469 +641,6 @@ function resolveBaseRef(explicit: string | null, root: string): string {
-function derivedFor(root: string, baseRef: string | null, headCommit: string): readonly string[] {
+function gateInputsFor(
+    root: string,
+    baseRef: string | null,
+    headCommit: string,
+    files: readonly string[],
+): { derived: readonly string[]; consequence: ReadonlySet<string> } {
@@ -473,0 +651,3 @@ function derivedFor(root: string, baseRef: string | null, headCommit: string): r
+    const needed = classDecidesAny(files);
+    const classAt = (tree: { read(rel: string): string | null }, commit: string): ReadonlySet<string> =>
+        needed ? consequenceRuleSlugsIn((rel) => tree.read(rel), `commit ${commit}`) : new Set<string>();
@@ -474,0 +655 @@ function derivedFor(root: string, baseRef: string | null, headCommit: string): r
+    const headClass = classAt(head, headCommit);
@@ -476 +657,4 @@ function derivedFor(root: string, baseRef: string | null, headCommit: string): r
-        return [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])];
+        return {
+            derived: [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])],
+            consequence: new Set([...(needed ? consequenceRuleSlugsOfCheckout() : []), ...headClass]),
+        };
@@ -478,2 +662,7 @@ function derivedFor(root: string, baseRef: string | null, headCommit: string): r
-    const base = treeAtRevision(root, resolveRevision(root, resolveBaseRef(baseRef, root)));
-    return [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])];
+    const baseCommit = resolveRevision(root, resolveBaseRef(baseRef, root));
+    const base = treeAtRevision(root, baseCommit);
+    const baseClass = classAt(base, baseCommit);
+    return {
+        derived: [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])],
+        consequence: new Set([...baseClass, ...headClass]),
+    };
@@ -513 +702,2 @@ export function expectedSubjectFor(
-    return subjectOf(root, files, derivedFor(root, baseRef, commit), commit);
+    const { derived, consequence } = gateInputsFor(root, baseRef, commit, files);
+    return subjectOf(root, files, derived, commit, consequence);
@@ -542,0 +733 @@ export function evaluate(
+    let consequence: ReadonlySet<string>;
@@ -546 +737 @@ export function evaluate(
-        derived = derivedFor(root, baseRef, headCommit);
+        ({ derived, consequence } = gateInputsFor(root, baseRef, headCommit, files));
@@ -553 +744,4 @@ export function evaluate(
-            ledger.fail(target, 'the dispatcher closure could not be read at the named commits');
+            ledger.fail(
+                target,
+                'the dispatcher closure or the high-consequence class could not be read at the named commits',
+            );
@@ -559 +753 @@ export function evaluate(
-    const gated = classifyPaths(files, derived);
+    const gated = classifyPaths(files, derived, consequence);
@@ -561,0 +756 @@ export function evaluate(
+        ...gated.consequenceRules,
@@ -610 +805,7 @@ export function evaluate(
-        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, headCommit));
+        ({ digest: expectedSubject, revision: commit } = subjectOf(
+            root,
+            files,
+            derived,
+            headCommit,
+            consequence,
+        ));
@@ -635,2 +836,2 @@ export function evaluate(
-            '✅  no kernel rule, governance hook, hook-plumbing source or self edit in the ' +
-                'diff — nothing to ratify',
+            '✅  no kernel rule, high-consequence rule, governance hook, hook-plumbing source ' +
+                'or self edit in the diff — nothing to ratify',
@@ -643,0 +845 @@ export function evaluate(
+        ...gated.consequenceRules.map((p) => `high-consequence rule ${p}`),
@@ -646 +848,6 @@ export function evaluate(
-        ...(gated.self ? ['the ratification mechanism itself (gate, its imports, policy or workflow)'] : []),
+        ...(gated.self
+            ? [
+                  'the ratification mechanism itself (gate, its imports, policy, workflow, or ' +
+                      'the high-consequence rule list or its criterion)',
+              ]
+            : []),
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index f3c94ebd4..986af2ff6 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -395 +395,9 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
-    const gated = classifyPaths(all);
+    // ONE membership for both governance triggers: the class this classifier
+    // already reads across base and head (`unionMembers`), never the
+    // ratification gate's checkout default, which would let a head that drops
+    // a member while editing it fall out of owner routing. An unreadable class
+    // counts every rule file in the diff, as the consequence trigger does.
+    const members = opts.consequenceMembers === undefined ? localConsequenceMembers() : opts.consequenceMembers;
+    const gateClass: ReadonlySet<string> =
+        members ?? new Set(all.flatMap((p) => RULE_FILE_RE.exec(p)?.[1] ?? []));
+    const gated = classifyPaths(all, undefined, gateClass);
@@ -397 +405,8 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
-        const gatedPaths = [...gated.kernelRules, ...gated.governanceHooks, ...gated.plumbing];
+        // The high-consequence class is listed: without it a PR touching only
+        // such a rule would carry this reason with no path named under it.
+        const gatedPaths = [
+            ...gated.kernelRules,
+            ...gated.consequenceRules,
+            ...gated.governanceHooks,
+            ...gated.plumbing,
+        ];
@@ -400,2 +415,2 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
-            'check_kernel_edit_ratified — kernel rule, governance hook, hook plumbing or the ratification mechanism',
-            gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p]).self),
+            'check_kernel_edit_ratified — kernel rule, high-consequence rule, governance hook, hook plumbing or the ratification mechanism',
+            gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p], undefined, gateClass).self),
@@ -423 +437,0 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
-    const members = opts.consequenceMembers === undefined ? localConsequenceMembers() : opts.consequenceMembers;
```

## The tests/ diff (as scoped above)

```diff
diff --git a/tests/scripts/check_kernel_edit_ratified.test.ts b/tests/scripts/check_kernel_edit_ratified.test.ts
index 6bd5f357c..c302c05b5 100644
--- a/tests/scripts/check_kernel_edit_ratified.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified.test.ts
@@ -19 +19 @@ import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.j
-import { commitAll } from './ratification_git_fixture.js';
+import { commitAll, writeEmptyConsequenceClass } from './ratification_git_fixture.js';
@@ -91,0 +92 @@ beforeEach(() => {
+    writeEmptyConsequenceClass(root); // the gate refuses a commit without the class list
diff --git a/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
new file mode 100644
index 000000000..3f6408b85
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
@@ -0,0 +1,353 @@
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+
+import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
+import { classifyTarget } from '../../src/scripts/classify_merge_risk.js';
+import { CLASS_CONFIG_REL, CLAUSES } from '../../src/scripts/_lib/rule_consequence_class.js';
+import { ConsequenceClassUnreadable } from '../../src/scripts/_lib/ratification_subject.js';
+import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
+import { commitAll } from './ratification_git_fixture.js';
+
+/**
+ * Step 4.2 — rule law beyond the nine kernel rules.
+ *
+ * The 2026-10-19 attempt was refused 2/2 on two dealbreakers, and each has its
+ * own describe block here: the list failed OPEN (an unreadable list became an
+ * empty class and the gate exited 0), and membership was read from one side
+ * only, so a change that ADDED a member while editing that rule left the
+ * rule's bytes outside the digest its record carried.
+ */
+
+const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+const LIST = gate.CONSEQUENCE_CLASS_PATH;
+const ALPHA = 'src/rules/alpha.md';
+const BETA = 'src/rules/beta.md';
+
+let root: string;
+
+function write(rel: string, body: string): void {
+    const abs = path.join(root, rel);
+    fs.mkdirSync(path.dirname(abs), { recursive: true });
+    fs.writeFileSync(abs, body);
+}
+
+function listOf(...slugs: string[]): string {
+    const members: Record<string, { clause: string }> = {};
+    for (const s of slugs) members[s] = { clause: 'authority-bypass' };
+    return `${JSON.stringify({ members }, null, 2)}\n`;
+}
+
+function reader(files: Record<string, string>): (rel: string) => string | null {
+    return (rel) => (Object.prototype.hasOwnProperty.call(files, rel) ? (files[rel] as string) : null);
+}
+
+function unreadable(files: Record<string, string>): string {
+    try {
+        gate.consequenceRuleSlugsIn(reader(files), 'the fixture');
+    } catch (err) {
+        expect(err).toBeInstanceOf(ConsequenceClassUnreadable);
+        return (err as Error).message;
+    }
+    throw new Error('expected a refusal');
+}
+
+function record(name: string, subject: string): string {
+    const rel = path.join(RATIFICATION_DIR, name);
+    write(
+        rel,
+        [
+            '---',
+            'proposed_by: claude/session-a',
+            'implemented_by: claude/session-a',
+            'reviewed_by: council/anthropic+openai',
+            `subject: ${subject}`,
+            'verdict: ratified',
+            'effective_after: merge',
+            'providers:',
+            '  - anthropic',
+            '  - openai',
+            'seats:',
+            '  anthropic: ratified',
+            '  openai: ratified',
+            '---',
+            '',
+            '<!-- evidence-type: ratification -->',
+            '',
+            'Review body.',
+            '',
+        ].join('\n'),
+    );
+    return rel;
+}
+
+beforeEach(() => {
+    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kercc-'));
+    write(LIST, listOf('alpha'));
+    write(ALPHA, 'alpha law\n');
+    write(BETA, 'beta law\n');
+});
+
+afterEach(() => {
+    fs.rmSync(root, { recursive: true, force: true });
+});
+
+describe('the list path and the watch list', () => {
+    it('names the same file and the same three clauses the class library reads', () => {
+        expect(LIST).toBe(CLASS_CONFIG_REL);
+        expect([...gate.CONSEQUENCE_CLAUSES].sort()).toEqual([...CLAUSES].sort());
+    });
+
+    it('every tracked copy of a member rule in this repository is classified as one', () => {
+        // Inventory-backed: the class read from this checkout, against every
+        // tracked file named for a member. A projection that placed a member
+        // outside a `rules/` directory would show up here as unclassified.
+        const members = gate.consequenceRuleSlugsOfCheckout();
+        const env = { ...process.env };
+        for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
+        const tracked = spawnSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf8', env })
+            .stdout.split('\u0000')
+            .filter((p) => p.endsWith('.md') && members.has(path.posix.basename(p, '.md')))
+            .filter((p) => !/^(?:agents|docs|tests)\//u.test(p));
+        // Each member has its source and its packaged projection tracked here.
+        for (const slug of members) {
+            expect(tracked, slug).toContain(`src/rules/${slug}.md`);
+            expect(tracked, slug).toContain(`dist/agent-src/rules/${slug}.md`);
+        }
+        const kernel = new Set(gate.classifyPaths(tracked, []).kernelRules);
+        const unclassified = tracked.filter(
+            (p) => !kernel.has(p) && !gate.classifyPaths([p], []).consequenceRules.includes(p),
+        );
+        expect(unclassified).toEqual([]);
+    });
+
+    it('the list and the schema that states its criterion are mechanism paths; a neighbouring schema is not', () => {
+        expect(gate.isMechanismPath(LIST)).toBe(true);
+        expect(gate.classifyPaths([LIST], [], new Set()).self).toBe(true);
+        expect(gate.CONSEQUENCE_CRITERION_PATH).toBe('src/scripts/schemas/rule.schema.json');
+        expect(gate.isMechanismPath(gate.CONSEQUENCE_CRITERION_PATH)).toBe(true);
+        expect(gate.classifyPaths([gate.CONSEQUENCE_CRITERION_PATH], [], new Set()).self).toBe(true);
+        expect(gate.isMechanismPath('src/scripts/schemas/skill.schema.json')).toBe(false);
+    });
+
+    it('the criterion the gate pins is the one the schema states', () => {
+        const schema = JSON.parse(fs.readFileSync(path.join(REPO, gate.CONSEQUENCE_CRITERION_PATH), 'utf8')) as {
+            properties: { consequence_class: { enum: string[] } };
+        };
+        expect([...schema.properties.consequence_class.enum].sort()).toEqual([...gate.CONSEQUENCE_CLAUSES].sort());
+    });
+});
+
+describe('classification', () => {
+    const cls = new Set(['alpha', 'commit-policy']);
+
+    it('a member outside the kernel is a high-consequence rule, as source and as projection', () => {
+        expect(gate.classifyPaths([ALPHA], [], cls).consequenceRules).toEqual([ALPHA]);
+        for (const projection of [
+            '.claude/rules/alpha.md',
+            '.augment/rules/alpha.md',
+            'dist/agent-src/rules/alpha.md',
+            '.cursor/rules/alpha.md',
+        ]) {
+            expect(gate.classifyPaths([projection], [], cls).consequenceRules, projection).toEqual([projection]);
+        }
+        expect(gate.requiresRatification(gate.classifyPaths([ALPHA], [], cls))).toBe(true);
+    });
+
+    it('the class decides a diff exactly when it holds a non-kernel rule path', () => {
+        expect(gate.classDecidesAny(['docs/note.md', LIST, 'src/scripts/x.ts'])).toBe(false);
+        expect(gate.classDecidesAny(['src/rules/commit-policy.md'])).toBe(false);
+        expect(gate.classDecidesAny([BETA])).toBe(true);
+        expect(gate.classDecidesAny(['dist/agent-src/rules/beta.md'])).toBe(true);
+    });
+
+    it('a rule outside the class is not gated', () => {
+        const g = gate.classifyPaths([BETA], [], cls);
+        expect(g.consequenceRules).toEqual([]);
+        expect(gate.requiresRatification(g)).toBe(false);
+    });
+
+    it('a kernel rule in the class is still reported as a kernel rule', () => {
+        const g = gate.classifyPaths(['src/rules/commit-policy.md'], [], cls);
+        expect(g.kernelRules).toEqual(['src/rules/commit-policy.md']);
+        expect(g.consequenceRules).toEqual([]);
+    });
+
+    it('the real class of this checkout reaches a member beyond the kernel', () => {
+        expect(gate.classifyPaths(['src/rules/tool-safety.md'], []).consequenceRules).toEqual([
+            'src/rules/tool-safety.md',
+        ]);
+    });
+});
+
+describe('dealbreaker 1 — the list fails CLOSED', () => {
+    const rules = { [ALPHA]: 'x', [BETA]: 'y' };
+
+    it('a valid list reads as its members, and an empty one as empty', () => {
+        expect([...gate.consequenceRuleSlugsIn(reader({ ...rules, [LIST]: listOf('alpha', 'beta') }), 'f')]).toEqual([
+            'alpha',
+            'beta',
+        ]);
+        expect(gate.consequenceRuleSlugsIn(reader({ [LIST]: listOf() }), 'f').size).toBe(0);
+    });
+
+    it.each([
+        ['absent', {}, 'absent'],
+        ['not JSON', { [LIST]: '{ members: ' }, 'not JSON'],
+        ['a top level that is an array', { [LIST]: '[]' }, 'top level'],
+        ['members missing', { [LIST]: '{}' }, '`members`'],
+        ['members an array', { [LIST]: '{"members": ["alpha"]}' }, '`members`'],
+        ['a key that is not a slug', { ...rules, [LIST]: '{"members": {"Alpha_1": {"clause": "x"}}}' }, 'not a rule slug'],
+        ['a __proto__ key', { ...rules, [LIST]: '{"members": {"__proto__": {"clause": "x"}}}' }, 'not a rule slug'],
+        ['an entry with no clause', { ...rules, [LIST]: '{"members": {"alpha": {}}}' }, 'no `clause` of the criterion'],
+        [
+            'a clause outside the criterion',
+            { ...rules, [LIST]: '{"members": {"alpha": {"clause": "important"}}}' },
+            'no `clause` of the criterion',
+        ],
+        ['a member with no rule file', { [LIST]: listOf('ghost') }, 'names no rule file'],
+    ])('%s is a refusal, never an empty class', (_name, files, detail) => {
+        expect(unreadable(files as Record<string, string>)).toContain(detail);
+    });
+
+    it('a rule edit over an unreadable HEAD list is refused, even for a rule outside the class', () => {
+        const base = commitAll(root);
+        write(LIST, '{ broken');
+        write(BETA, 'beta law, edited\n');
+        commitAll(root);
+        const r = gate.evaluate([LIST, BETA], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('cannot be read');
+    });
+
+    it('a rule edit over a head with NO list at all is refused', () => {
+        const base = commitAll(root);
+        fs.rmSync(path.join(root, LIST));
+        write(BETA, 'beta law, edited\n');
+        commitAll(root);
+        const r = gate.evaluate([LIST, BETA], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('the file is absent');
+    });
+
+    it('a rule edit over a base with NO list at all is refused, naming the base', () => {
+        fs.rmSync(path.join(root, LIST));
+        const base = commitAll(root, 'base without a list');
+        write(LIST, listOf('alpha'));
+        write(BETA, 'beta law, edited\n');
+        commitAll(root);
+        const r = gate.evaluate([LIST, BETA], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain(`commit ${base}`);
+        expect(r.lines.join('\n')).toContain('the file is absent');
+    });
+
+    it('a broken BASE list blocks no diff it cannot affect', () => {
+        // No rule path in the diff: every membership classifies it the same,
+        // so the list is not read and a docs change is not held hostage.
+        write(LIST, 'not json');
+        const base = commitAll(root);
+        write('docs/note.md', 'prose\n');
+        commitAll(root);
+        const r = gate.evaluate(['docs/note.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode, r.lines.join('\n')).toBe(0);
+        expect(r.lines.join('\n')).toContain('nothing to ratify');
+    });
+
+    it('recovery drill: a broken base is repaired through this gate, with a record and no bypass', () => {
+        write(LIST, 'not json');
+        const base = commitAll(root);
+        write(LIST, listOf('alpha'));
+        commitAll(root);
+        // The repair touches only the list: a mechanism path, so a record is
+        // owed — and the class is not needed to judge it, so the broken base
+        // does not stand in the way.
+        const unrecorded = gate.evaluate([LIST], root, 2, 'HEAD', base);
+        expect(unrecorded.exitCode).toBe(1);
+        expect(unrecorded.lines.join('\n')).toContain('no ratification artifact');
+        expect(unrecorded.lines.join('\n')).not.toContain('cannot be read');
+
+        const rel = record('repair.md', gate.expectedSubjectFor([LIST], root, 'HEAD', base).digest);
+        commitAll(root);
+        const repaired = gate.evaluate([LIST, rel], root, 2, 'HEAD', base);
+        expect(repaired.exitCode, repaired.lines.join('\n')).toBe(0);
+    });
+
+    it('polarity: a readable list and an ungated diff pass with nothing to ratify', () => {
+        const base = commitAll(root);
+        write('docs/note.md', 'prose\n');
+        commitAll(root);
+        const r = gate.evaluate(['docs/note.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode, r.lines.join('\n')).toBe(0);
+        expect(r.lines.join('\n')).toContain('nothing to ratify');
+    });
+});
+
+describe('dealbreaker 2 — membership is read at both commits the subject binds to', () => {
+    it('an edit of a member with no record is refused and names the rule', () => {
+        const base = commitAll(root);
+        write(ALPHA, 'alpha law, weakened\n');
+        commitAll(root);
+        const r = gate.evaluate([ALPHA], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain(`high-consequence rule ${ALPHA}`);
+    });
+
+    it('ADDING a member while editing that rule puts the rule inside the digest', () => {
+        const base = commitAll(root);
+        write(LIST, listOf('alpha', 'beta'));
+        write(BETA, 'beta law, edited in the same change\n');
+        commitAll(root);
+        const s = gate.expectedSubjectFor([LIST, BETA], root, 'HEAD', base);
+        expect(s.gatedFiles).toEqual([LIST, BETA]);
+    });
+
+    it('DROPPING a member while editing that rule keeps the rule inside the digest', () => {
+        const base = commitAll(root);
+        write(LIST, listOf());
+        write(ALPHA, 'alpha law, edited once it left the class\n');
+        commitAll(root);
+        const s = gate.expectedSubjectFor([LIST, ALPHA], root, 'HEAD', base);
+        expect(s.gatedFiles).toEqual([LIST, ALPHA]);
+    });
+
+    it('the merge classifier entry point routes a member dropped while edited to the owner', () => {
+        // Through `classifyTarget`, the function the merge command runs, over
+        // real commits: nothing is injected, so this proves the entry point
+        // itself computes the base-and-head union and hands it to owner routing.
+        const base = commitAll(root);
+        write(LIST, listOf());
+        write(ALPHA, 'alpha law, edited once it left the class\n');
+        const head = commitAll(root);
+        const r = classifyTarget(root, { range: `${base}..${head}` });
+        expect(r.verdict).toBe('needs-owner');
+        const governance = r.triggers.find((t) => t.id === 'governance-surface');
+        expect(governance?.paths).toContain(ALPHA);
+
+        // Polarity: a rule in neither side's list is not routed for governance.
+        write(BETA, 'beta law, edited, never a member\n');
+        const later = commitAll(root);
+        const quiet = classifyTarget(root, { range: `${head}..${later}` });
+        expect(quiet.triggers.map((t) => t.id)).not.toContain('governance-surface');
+    });
+
+    it('a record bound to that digest passes, and one edit after it turns red', () => {
+        const base = commitAll(root);
+        write(LIST, listOf('alpha', 'beta'));
+        write(BETA, 'beta law, edited in the same change\n');
+        commitAll(root);
+        const rel = record('add-beta.md', gate.expectedSubjectFor([LIST, BETA], root, 'HEAD', base).digest);
+        commitAll(root);
+        const green = gate.evaluate([LIST, BETA, rel], root, 2, 'HEAD', base);
+        expect(green.exitCode, green.lines.join('\n')).toBe(0);
+
+        write(BETA, 'beta law, changed after the review\n');
+        commitAll(root);
+        const red = gate.evaluate([LIST, BETA, rel], root, 2, 'HEAD', base);
+        expect(red.exitCode).toBe(1);
+    });
+});
diff --git a/tests/scripts/classify_merge_risk.test.ts b/tests/scripts/classify_merge_risk.test.ts
index 8bffa3d21..965654f22 100644
--- a/tests/scripts/classify_merge_risk.test.ts
+++ b/tests/scripts/classify_merge_risk.test.ts
@@ -180,2 +180,6 @@ describe('the gate sees what governs — one case per trigger, each with its nea
-        expect(governs([mod('src/rules/tool-safety.md')])).toEqual(['consequence-class-rule']);
-        expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual(['consequence-class-rule']);
+        // Also `governance-surface`: the ratification gate gates the class.
+        expect(governs([mod('src/rules/tool-safety.md')])).toEqual(['governance-surface', 'consequence-class-rule']);
+        expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual([
+            'governance-surface',
+            'consequence-class-rule',
+        ]);
@@ -185 +189 @@ describe('the gate sees what governs — one case per trigger, each with its nea
-    it('an unreadable consequence-class list counts every rule file', () => {
+    it('an unreadable consequence-class list counts every rule file, for owner routing too', () => {
@@ -186,0 +191 @@ describe('the gate sees what governs — one case per trigger, each with its nea
+            'governance-surface',
@@ -190,0 +196,17 @@ describe('the gate sees what governs — one case per trigger, each with its nea
+    it('owner routing reads the base-and-head union, so a member dropped while edited stays governance', () => {
+        // The base names the rule, the head's list no longer does: the union
+        // keeps it, and `governance-surface` is decided from that union rather
+        // than from whatever list the checkout running the classifier carries.
+        const base = JSON.stringify({ members: { 'markdown-safe-codeblocks': { clause: 'authority-bypass' } } });
+        const head = JSON.stringify({ members: {} });
+        const union = unionMembers([base, head]);
+        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')], { consequenceMembers: union })).toEqual([
+            'governance-surface',
+            'consequence-class-rule',
+        ]);
+        // Polarity: a rule in neither side's list is not governance.
+        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')], { consequenceMembers: unionMembers([head]) })).toEqual(
+            [],
+        );
+    });
+
diff --git a/tests/scripts/classify_merge_risk_base_revision.test.ts b/tests/scripts/classify_merge_risk_base_revision.test.ts
index 7162e1051..60c21c486 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -148,2 +148,2 @@ describe('the code that classes a change is not the change’s own', () => {
-                '): GatedPaths {\n    const derivedSet',
-                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], self: false };\n    const derivedSet',
+                '): GatedPaths {\n    if (consequence === undefined) {',
+                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], consequenceRules: [], self: false };\n    if (consequence === undefined) {',
diff --git a/tests/scripts/classify_merge_risk_needs_owner.test.ts b/tests/scripts/classify_merge_risk_needs_owner.test.ts
index 3b5faba0e..1a9f38456 100644
--- a/tests/scripts/classify_merge_risk_needs_owner.test.ts
+++ b/tests/scripts/classify_merge_risk_needs_owner.test.ts
@@ -83,2 +83,6 @@ describe('the near-misses stay where they were', () => {
-    it('a consequence-class rule alone is needs-council, not needs-owner', () => {
-        expect(verdict('src/rules/tool-safety.md')).toBe('needs-council');
+    it('a consequence-class rule alone is needs-owner, a rule outside the class is not', () => {
+        // Step 4.2 of the self-modification roadmap puts the class on the
+        // ratification gate's surface, and ADR-281 § Amendment makes a council
+        // verdict on that surface advisory until the owner binds to its digest.
+        expect(verdict('src/rules/tool-safety.md')).toBe('needs-owner');
+        expect(verdict('src/rules/markdown-safe-codeblocks.md')).not.toBe('needs-owner');
diff --git a/tests/scripts/ratification_git_fixture.ts b/tests/scripts/ratification_git_fixture.ts
index dee8e964b..2aa109995 100644
--- a/tests/scripts/ratification_git_fixture.ts
+++ b/tests/scripts/ratification_git_fixture.ts
@@ -52,0 +53,14 @@ function git(root: string, args: readonly string[]): string {
+/**
+ * Write an EMPTY high-consequence rule list into a fixture tree.
+ *
+ * The gate reads that list at every commit it judges and refuses a commit
+ * without one. A suite whose cases are about something else calls this
+ * EXPLICITLY when it builds its tree, so the fixture states the input rather
+ * than having it appear behind the suite's back; `commitAll` never adds it.
+ */
+export function writeEmptyConsequenceClass(root: string): void {
+    const list = path.join(root, 'src/config/rule-consequence-class.json');
+    fs.mkdirSync(path.dirname(list), { recursive: true });
+    fs.writeFileSync(list, '{"members": {}}\n');
+}
+
```
