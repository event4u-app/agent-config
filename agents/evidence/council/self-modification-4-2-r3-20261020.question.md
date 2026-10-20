<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-20 (round 3), committed verbatim
     so the verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not recoverable
     is not evidence, because nobody can check what was asked). -->

# Modification review — the ratification gate gains the high-consequence rule class

You are reviewing a change to this package's own governance mechanism. Answer
the nine questions below, one at a time, then close on a single stance line:

    STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <0-100> | DEALBREAKER: <one sentence, or none>

`ratified` — sound, may pass the gate. `confirmed-non-expanding` — widens no
authority, may pass. `refused` — must not pass as it stands; name the dealbreaker.

## Context

`check_kernel_edit_ratified.ts` refuses a diff that touches a governed surface
(nine kernel rules, governance hooks, hook plumbing, the gate's own mechanism)
unless the diff carries a ratification record under
`agents/evidence/ratifications/`. `_lib/ratification_subject.ts` computes the
`subject` digest over the gated files from Git objects at a revision, binding a
record to the content it reviewed. In CI the BASE revision's copy of the gate
runs against the head checkout. `classify_merge_risk.ts` is the merge-time
classifier; its `governance-surface` trigger routes a pull request to the owner
rather than to a council clearance (ADR-281 § Amendment: a council verdict on
the gated surface is advisory until an owner authorisation is bound to the same
digest).

`src/config/rule-consequence-class.json` lists 28 rules beyond the kernel whose
violation would act irreversibly outside the repository, cross a security
boundary, or bypass a reserved authority. The criterion is stated in
`rule.schema.json#/properties/consequence_class`; the list is also what
`project_thin_rules` and the class library `_lib/rule_consequence_class.ts`
read. This change gates those 28 rules and the list itself.

## History you should weigh rather than take on trust

**2026-10-19, refused 2/2.** Dealbreakers, quoted: (1) "The class list fails
OPEN ... an unreadable list silently removed protection from 28 rules while the
gate kept exiting 0." (2) "Membership was not resolved at the revision the
subject binds to ... adding a member while editing that newly consequential
rule is not [covered]." That version also bundled a second step, refused on
separate grounds and NOT in this diff.

**2026-10-20 round 1, split** (one ratified, one refused). Dealbreaker, quoted:
"Merge-time owner routing uses checkout membership rather than the gate's
base/head union." Response: `classifyChanges` passes one membership — the
base/head union it already computed — to both governance triggers.

**2026-10-20 round 2, split** (one ratified, one refused). Dealbreaker, quoted:
"The design makes a semantically under-validated class file a repository-wide
fail-closed dependency without proving production base/head-union routing or
defining an independently authorized recovery path." The refusing seat named
five conditions to change its mind. The author's response to each, to be
checked against the diff or the facts stated:

1. *End-to-end test through the real merge entry point.* `classifyTarget`, the
   function the merge command runs, is tested over real commits with nothing
   injected (drop-member-while-edited routes to the owner, the rule named; a
   non-member does not).
2. *Projection inventory parity.* A test lists every tracked file named for a
   member and asserts each is classified. Tracked copies today are
   `src/rules/` and `dist/agent-src/rules/`; other host trees are generated at
   install time and untracked, and match the same `rules/<slug>.md` pattern.
3. *Closed set of classes.* A member's `clause` must be one of the criterion's
   three, pinned equal to the class library's set.
4. *Audit of fixture consumers.* Eleven pre-existing suites import the shared fixture (twelve with the new one); none
   references the list path in an assertion; all run green. The seed is an
   opt-out, and absence is tested end to end at the head and at the base.
5. *Recovery path.* Stated in the gate header: ADR-281 § 5's owner-permission
   route (the owner's own recorded forge bypass), with the repair judged by a
   base whose list reads; deliberately no repository flag, since a flag the
   candidate can set is one the candidate controls.

On "repository-wide dependency", the author's position: a head that breaks the
list blocks only the pull request that broke it; a base whose list does not
read can only be reached through a ratified, owner-authorised merge. On "a
static constant would be smaller": the list was edited once since it was
created on 2026-10-02, but a constant in the gate would be a second list beside
the one the class library and the projection read, free to drift from it. On
the schema not being watched: the gate never reads it; a schema edit changes
no membership until the list changes, and the list is gated.

Measured cost: 7 of 457 first-parent commits on `main` in the 30 days to
2026-10-20 touched a class member and would now route to the owner at merge;
none touched a kernel rule.

## What is in this bundle

The whole `src/` diff at one line of context and the whole `tests/` diff at
zero lines. Not included: the round-1 and round-2 prompts and seat texts
committed under `agents/evidence/council/`. Base `origin/main` @ 67928878b,
head 2beedee36; subject over the gated files
`f373e6a20068f88d1b906aca1919b692293ef976100700afb38b897007cd7466`.

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

```
 src/scripts/_lib/ratification_subject.ts           |  49 +++-
 src/scripts/check_kernel_edit_ratified.ts          | 196 +++++++++++--
 src/scripts/classify_merge_risk.ts                 |  24 +-
 ..._kernel_edit_ratified_consequence_class.test.ts | 311 +++++++++++++++++++++
 tests/scripts/classify_merge_risk.test.ts          |  28 +-
 .../classify_merge_risk_base_revision.test.ts      |   2 +-
 .../classify_merge_risk_needs_owner.test.ts        |   8 +-
 tests/scripts/ratification_git_fixture.ts          |  20 +-
 8 files changed, 604 insertions(+), 34 deletions(-)
```

## The src/ diff

```diff
diff --git a/src/scripts/_lib/ratification_subject.ts b/src/scripts/_lib/ratification_subject.ts
index 176f6532c..3df47376c 100644
--- a/src/scripts/_lib/ratification_subject.ts
+++ b/src/scripts/_lib/ratification_subject.ts
@@ -170,2 +170,26 @@ export class GitReadFailed extends GatedSubjectRefusal {
 
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
 /**
@@ -464,6 +488,16 @@ export function gatedFilesOf(
     derived?: readonly string[],
+    consequence?: ReadonlySet<string>,
 ): readonly string[] {
     const normalized = files.map((f) => f.replace(/\\/g, '/').trim()).filter((f) => f !== '');
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
     for (const f of normalized) {
@@ -504,4 +538,5 @@ export interface SubjectReading {
  *
- * `derived` is the plumbing closure the caller already computed, passed through
- * to {@link gatedFilesOf} unchanged: a digest that classified without it would
+ * `derived` is the plumbing closure and `consequence` the high-consequence rule
+ * slugs the caller already computed, both passed through to
+ * {@link gatedFilesOf} unchanged: a digest that classified without them would
  * cover fewer files than the gate gated.
@@ -516,4 +551,5 @@ export function subjectOf(
     revision: string = DEFAULT_REVISION,
+    consequence?: ReadonlySet<string>,
 ): SubjectReading {
-    const gatedFiles = gatedFilesOf(files, derived);
+    const gatedFiles = gatedFilesOf(files, derived, consequence);
     const h = createHash('sha256');
@@ -549,4 +585,5 @@ export function subjectDigest(
     revision: string = DEFAULT_REVISION,
+    consequence?: ReadonlySet<string>,
 ): string {
-    return subjectOf(root, files, derived, revision).digest;
+    return subjectOf(root, files, derived, revision, consequence).digest;
 }
diff --git a/src/scripts/check_kernel_edit_ratified.ts b/src/scripts/check_kernel_edit_ratified.ts
index 47df197dc..0f0e8401c 100644
--- a/src/scripts/check_kernel_edit_ratified.ts
+++ b/src/scripts/check_kernel_edit_ratified.ts
@@ -38,3 +38,5 @@
  * the dispatcher imports that decides an exit code (derived at run time, see
- * `derivedPlumbing`) — or this gate itself, so it cannot
+ * `derivedPlumbing`) — a rule of the high-consequence class beyond the kernel
+ * (the members of `rule-consequence-class.json`, see `CONSEQUENCE_CLASS_PATH`)
+ * — or this gate itself, so it cannot
  * be weakened without its own record. Such a diff must carry a ratification
@@ -103,2 +105,3 @@ import {
 import {
+    ConsequenceClassUnreadable,
     DEFAULT_REVISION,
@@ -158,2 +161,29 @@ export const POLICY_PATH = 'src/config/ratification-policy.json';
 
+/**
+ * The high-consequence rule class: every rule whose violation would leave the
+ * repository irreversibly, cross a security boundary or bypass an authority
+ * (the criterion is stated in `rule.schema.json#/properties/consequence_class`).
+ * Its members beyond the nine kernel rules are gated like kernel rules.
+ *
+ * The list is on the watch list so that a change cannot drop a member in order
+ * to edit the rule it names, nor add one without a record. The schema that
+ * states the criterion is deliberately NOT: this gate never reads it, so a
+ * schema edit changes no membership until the list changes, and the list is
+ * what is gated. Watching the schema would price every unrelated schema edit
+ * as a governance event while gating nothing the list does not already gate.
+ *
+ * Membership is read FROM GIT OBJECTS at both the base and the head commit and
+ * the union is gated (see `gateInputsFor`), so dropping a member is caught by
+ * the base side and adding one by the head side, and the digest covers both.
+ * It FAILS CLOSED: a list that cannot be read at either commit is a refusal.
+ * A head that breaks the list blocks only the change that broke it; a base
+ * whose list does not read can only be reached by a ratified merge. Recovery
+ * from such a base is the route ADR-281 § 5 already names for anything this
+ * gate cannot pass — the owner's own recorded forge bypass — and the repair
+ * itself is judged by a base whose list reads again. No repository flag
+ * switches the class off, because a switch the candidate can set is a switch
+ * the candidate controls.
+ */
+export const CONSEQUENCE_CLASS_PATH = 'src/config/rule-consequence-class.json';
+
 /**
@@ -344,2 +374,7 @@ export interface GatedPaths {
     plumbing: string[];
+    /**
+     * Rules of the high-consequence class that are NOT among the nine kernel
+     * rules, in the source tree or in any projection — the kernel reach.
+     */
+    consequenceRules: string[];
     self: boolean;
@@ -347,2 +382,85 @@ export interface GatedPaths {
 
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
 /**
@@ -358,2 +476,3 @@ export function isMechanismPath(p: string): boolean {
         p === WORKFLOW_PATH ||
+        p === CONSEQUENCE_CLASS_PATH ||
         ANCHOR_PATHS.includes(p) ||
@@ -367,2 +486,3 @@ export function classifyPaths(
     derived: readonly string[] = derivedPlumbing(),
+    consequence: ReadonlySet<string> = consequenceRuleSlugsOfCheckout(),
 ): GatedPaths {
@@ -372,2 +492,3 @@ export function classifyPaths(
     const plumbing: string[] = [];
+    const consequenceRules: string[] = [];
     let self = false;
@@ -387,2 +508,6 @@ export function classifyPaths(
         }
+        if (m !== null && consequence.has(m[1] ?? '')) {
+            consequenceRules.push(p);
+            continue;
+        }
         if (GOVERNANCE_HOOK_RE.test(p)) {
@@ -395,3 +520,3 @@ export function classifyPaths(
     }
-    return { kernelRules, governanceHooks, plumbing, self };
+    return { kernelRules, governanceHooks, plumbing, consequenceRules, self };
 }
@@ -402,2 +527,3 @@ export function requiresRatification(gated: GatedPaths): boolean {
         gated.kernelRules.length > 0 ||
+        gated.consequenceRules.length > 0 ||
         gated.governanceHooks.length > 0 ||
@@ -465,6 +591,17 @@ function resolveBaseRef(explicit: string | null, root: string): string {
  *
- * THROWS a {@link GatedSubjectRefusal} when the base does not resolve or the
- * object store cannot be read.
+ * THE HIGH-CONSEQUENCE CLASS IS READ FROM THE SAME TWO COMMITS, and its union
+ * is gated. The base side alone would miss a member the change ADDS while
+ * editing that rule — the head's list names it, the base's does not, and its
+ * bytes would sit outside the digest the record carries. The head side alone
+ * would let a change drop a member in order to edit it. In the residue case the
+ * base side is this checkout's working-tree list, as the plumbing base is.
+ *
+ * THROWS a {@link GatedSubjectRefusal} when the base does not resolve, the
+ * object store cannot be read, or the class list cannot be read on either side.
  */
-function derivedFor(root: string, baseRef: string | null, headCommit: string): readonly string[] {
+function gateInputsFor(
+    root: string,
+    baseRef: string | null,
+    headCommit: string,
+): { derived: readonly string[]; consequence: ReadonlySet<string> } {
     const verdictsOf = (tree: ClosureTree): string[] =>
@@ -474,7 +611,16 @@ function derivedFor(root: string, baseRef: string | null, headCommit: string): r
     const head = treeAtRevision(root, headCommit);
+    const headClass = consequenceRuleSlugsIn((rel) => head.read(rel), `commit ${headCommit}`);
     if (baseRef === null && path.resolve(root) !== REPO) {
-        return [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])];
+        return {
+            derived: [...new Set([...derivedPlumbing(), ...verdictsOf(head), ...closureArrivals(head)])],
+            consequence: new Set([...consequenceRuleSlugsOfCheckout(), ...headClass]),
+        };
     }
-    const base = treeAtRevision(root, resolveRevision(root, resolveBaseRef(baseRef, root)));
-    return [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])];
+    const baseCommit = resolveRevision(root, resolveBaseRef(baseRef, root));
+    const base = treeAtRevision(root, baseCommit);
+    const baseClass = consequenceRuleSlugsIn((rel) => base.read(rel), `commit ${baseCommit}`);
+    return {
+        derived: [...new Set([...verdictsOf(base), ...verdictsOf(head), ...closureArrivals(head, base)])],
+        consequence: new Set([...baseClass, ...headClass]),
+    };
 }
@@ -512,3 +658,4 @@ export function expectedSubjectFor(
     const commit = resolveRevision(root, revision);
-    return subjectOf(root, files, derivedFor(root, baseRef, commit), commit);
+    const { derived, consequence } = gateInputsFor(root, baseRef, commit);
+    return subjectOf(root, files, derived, commit, consequence);
 }
@@ -542,2 +689,3 @@ export function evaluate(
     let derived: readonly string[];
+    let consequence: ReadonlySet<string>;
     let headCommit: string;
@@ -545,3 +693,3 @@ export function evaluate(
         headCommit = resolveRevision(root, revision);
-        derived = derivedFor(root, baseRef, headCommit);
+        ({ derived, consequence } = gateInputsFor(root, baseRef, headCommit));
     } catch (err) {
@@ -552,3 +700,6 @@ export function evaluate(
         for (const target of ledger.unaccountedTargets()) {
-            ledger.fail(target, 'the dispatcher closure could not be read at the named commits');
+            ledger.fail(
+                target,
+                'the dispatcher closure or the high-consequence class could not be read at the named commits',
+            );
         }
@@ -558,5 +709,6 @@ export function evaluate(
     }
-    const gated = classifyPaths(files, derived);
+    const gated = classifyPaths(files, derived, consequence);
     const gatedSet = new Set<string>([
         ...gated.kernelRules,
+        ...gated.consequenceRules,
         ...gated.governanceHooks,
@@ -609,3 +761,9 @@ export function evaluate(
     try {
-        ({ digest: expectedSubject, revision: commit } = subjectOf(root, files, derived, headCommit));
+        ({ digest: expectedSubject, revision: commit } = subjectOf(
+            root,
+            files,
+            derived,
+            headCommit,
+            consequence,
+        ));
     } catch (err) {
@@ -634,4 +792,4 @@ export function evaluate(
         lines.push(
-            '✅  no kernel rule, governance hook, hook-plumbing source or self edit in the ' +
-                'diff — nothing to ratify',
+            '✅  no kernel rule, high-consequence rule, governance hook, hook-plumbing source ' +
+                'or self edit in the diff — nothing to ratify',
         );
@@ -643,5 +801,11 @@ export function evaluate(
         ...gated.kernelRules.map((p) => `kernel rule ${p}`),
+        ...gated.consequenceRules.map((p) => `high-consequence rule ${p}`),
         ...gated.governanceHooks.map((p) => `governance hook ${p}`),
         ...gated.plumbing.map((p) => `hook-plumbing source ${p}`),
-        ...(gated.self ? ['the ratification mechanism itself (gate, its imports, policy or workflow)'] : []),
+        ...(gated.self
+            ? [
+                  'the ratification mechanism itself (gate, its imports, policy, workflow or ' +
+                      'the high-consequence rule list)',
+              ]
+            : []),
     ];
diff --git a/src/scripts/classify_merge_risk.ts b/src/scripts/classify_merge_risk.ts
index f3c94ebd4..986af2ff6 100644
--- a/src/scripts/classify_merge_risk.ts
+++ b/src/scripts/classify_merge_risk.ts
@@ -394,9 +394,24 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
 
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
     if (requiresRatification(gated)) {
-        const gatedPaths = [...gated.kernelRules, ...gated.governanceHooks, ...gated.plumbing];
+        // The high-consequence class is listed: without it a PR touching only
+        // such a rule would carry this reason with no path named under it.
+        const gatedPaths = [
+            ...gated.kernelRules,
+            ...gated.consequenceRules,
+            ...gated.governanceHooks,
+            ...gated.plumbing,
+        ];
         add(
             'governance-surface',
-            'check_kernel_edit_ratified — kernel rule, governance hook, hook plumbing or the ratification mechanism',
-            gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p]).self),
+            'check_kernel_edit_ratified — kernel rule, high-consequence rule, governance hook, hook plumbing or the ratification mechanism',
+            gatedPaths.length > 0 ? gatedPaths : all.filter((p) => classifyPaths([p], undefined, gateClass).self),
         );
@@ -422,3 +437,2 @@ export function classifyChanges(entries: readonly ChangeEntry[], opts: ClassifyO
     );
-    const members = opts.consequenceMembers === undefined ? localConsequenceMembers() : opts.consequenceMembers;
     add(
```

## The tests/ diff

```diff
diff --git a/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
new file mode 100644
index 000000000..d9cd47615
--- /dev/null
+++ b/tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts
@@ -0,0 +1,311 @@
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
+        expect(tracked.length).toBeGreaterThanOrEqual(members.size);
+        const kernel = new Set(gate.classifyPaths(tracked, []).kernelRules);
+        const unclassified = tracked.filter(
+            (p) => !kernel.has(p) && !gate.classifyPaths([p], []).consequenceRules.includes(p),
+        );
+        expect(unclassified).toEqual([]);
+    });
+
+    it('the list is a mechanism path; the schema that states the criterion is not', () => {
+        expect(gate.isMechanismPath(LIST)).toBe(true);
+        expect(gate.classifyPaths([LIST], [], new Set()).self).toBe(true);
+        // The gate never reads the schema, so it changes no membership.
+        expect(gate.isMechanismPath('src/scripts/schemas/rule.schema.json')).toBe(false);
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
+    it('the gate refuses a diff whose head list is unreadable, even one gating nothing else', () => {
+        const base = commitAll(root);
+        write(LIST, '{ broken');
+        write('docs/note.md', 'prose\n');
+        commitAll(root);
+        const r = gate.evaluate([LIST, 'docs/note.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('cannot be read');
+    });
+
+    it('the gate refuses a head commit that has NO list at all', () => {
+        const base = commitAll(root);
+        fs.rmSync(path.join(root, LIST));
+        write('docs/note.md', 'prose\n');
+        commitAll(root);
+        const r = gate.evaluate([LIST, 'docs/note.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain('the file is absent');
+    });
+
+    it('the gate refuses a base commit that has NO list at all', () => {
+        fs.rmSync(path.join(root, LIST));
+        const base = commitAll(root, 'base without a list', { seedConsequenceClass: false });
+        write(LIST, listOf('alpha'));
+        commitAll(root);
+        const r = gate.evaluate([LIST], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain(`commit ${base}`);
+        expect(r.lines.join('\n')).toContain('the file is absent');
+    });
+
+    it('the gate refuses when the BASE list is unreadable', () => {
+        write(LIST, 'not json');
+        const base = commitAll(root);
+        write(LIST, listOf('alpha'));
+        commitAll(root);
+        const r = gate.evaluate(['docs/none.md'], root, 2, 'HEAD', base);
+        expect(r.exitCode).toBe(1);
+        expect(r.lines.join('\n')).toContain(`commit ${base}`);
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
index 7162e1051..13b3acc74 100644
--- a/tests/scripts/classify_merge_risk_base_revision.test.ts
+++ b/tests/scripts/classify_merge_risk_base_revision.test.ts
@@ -149 +149 @@ describe('the code that classes a change is not the change’s own', () => {
-                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], self: false };\n    const derivedSet',
+                '): GatedPaths {\n    if (files.length >= 0) return { kernelRules: [], governanceHooks: [], plumbing: [], consequenceRules: [], self: false };\n    const derivedSet',
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
index dee8e964b..f8641b1d7 100644
--- a/tests/scripts/ratification_git_fixture.ts
+++ b/tests/scripts/ratification_git_fixture.ts
@@ -52,0 +53,9 @@ function git(root: string, args: readonly string[]): string {
+/**
+ * The high-consequence rule list the gate reads at every commit it judges and
+ * refuses without. A fixture that does not write its own gets an EMPTY class
+ * at its first commit, so the gate it exercises judges the fixture's diff
+ * rather than refusing the fixture for lacking a list. A suite that tests the
+ * refusal itself opts out with `seedConsequenceClass: false`.
+ */
+const CONSEQUENCE_LIST_REL = 'src/config/rule-consequence-class.json';
+
@@ -54 +63,5 @@ function git(root: string, args: readonly string[]): string {
-export function commitAll(root: string, message = 'fixture'): string {
+export function commitAll(
+    root: string,
+    message = 'fixture',
+    opts: { seedConsequenceClass?: boolean } = {},
+): string {
@@ -56,0 +70,5 @@ export function commitAll(root: string, message = 'fixture'): string {
+        const list = path.join(root, CONSEQUENCE_LIST_REL);
+        if (opts.seedConsequenceClass !== false && !fs.existsSync(list)) {
+            fs.mkdirSync(path.dirname(list), { recursive: true });
+            fs.writeFileSync(list, '{"members": {}}\n');
+        }
```
