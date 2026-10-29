<!-- evidence-type: analysis -->

# Test-change review — four assertions that pinned an empty grant ledger

You are an independent reviewer for a change in the `event4u/agent-config` repository.

## Context

`src/config/preamble-payload-exceptions.json` is a ledger of grants that widen the per-spawn preamble ceiling. It shipped empty. The owner has now ordered one grant (`oq-42-image-floor-routes-to`, 43 tokens, OQ-42, directive `agents/evidence/owner-directives/2026-10-29-oq-42-image-floor-grant.md`). The gate honours a grant only for ids a caller verified against the platform (`--approved <id>` / `verifiedApprovals`); an unverified live grant refuses the run.

Four existing assertions assumed the ledger is empty:
- `measured_payload_ceiling.test.ts` "parses, and is empty" — `expect(r.exceptions).toStrictEqual([])`.
- `check_preamble_payload_budget.test.ts`: `main([])` is 0 on an unchanged tree; `decide({ baseRef: null })` is `ok` in advisory mode; `main([])` and `main(['--host', …])` in the host-additivity case.

With a live, unverified grant, the three `main`/`decide` cases go red because the grant is refused — which is the gate working as designed.

## The change under review

```diff
diff --git a/tests/scripts/check_preamble_payload_budget.test.ts b/tests/scripts/check_preamble_payload_budget.test.ts
index 83003232b7..7281c4669e 100644
--- a/tests/scripts/check_preamble_payload_budget.test.ts
+++ b/tests/scripts/check_preamble_payload_budget.test.ts
@@ -295,7 +295,10 @@ describe('the gate reds on growth past whichever ceiling applies', () => {
     // CI invocation are the SAME comparison, and both are green on a tree
     // nobody grew. That is what these two cases assert instead.
     it('is green on an unchanged tree — local and CI now make the same comparison', () => {
-        expect(main([])).toBe(0);
+        expect(main(APPROVED_ARGS)).toBe(0);
+        // A live grant nobody verified buys nothing, so the same run without the
+        // verification is red. With no live grant the two runs are the same.
+        expect(main([])).toBe(LIVE_GRANTS.length > 0 ? 1 : 0);
     });
 
     it('an UNESTABLISHED ceiling does not become an over-budget verdict', () => {
@@ -308,7 +311,7 @@ describe('the gate reds on growth past whichever ceiling applies', () => {
         // prevent, arriving one layer up. Measured in CI: the Node Tests
         // checkout has no reachable base, and two cases here went red for a
         // reason no diff caused.
-        const advisory = decide({ baseRef: null, today: '2026-09-11' });
+        const advisory = decide({ baseRef: null, today: '2026-09-11', verifiedApprovals: LIVE_GRANTS });
         expect(advisory.ceiling.verified).toBe(false);
         expect(advisory.ok, 'an advisory run reports, it does not gate').toBe(true);
 
@@ -401,6 +404,18 @@ function writeFakeBudget(root: string, over: Record<string, unknown>): void {
 // and a test that assumed the tree exists went red in CI while passing on every
 // maintainer machine. Both branches are real, so both are asserted, and which
 // one runs is decided by the tree rather than by a guess about the environment.
+// Live grants in the shipped ledger. A grant is honoured only for ids a caller
+// verified against the platform, so a green run on this tree passes them as
+// verified, and the unverified run is asserted red right beside it.
+const LIVE_GRANTS: readonly string[] = (
+    JSON.parse(fs.readFileSync(path.join(REPO_ROOT_FOR_TESTS, 'src/config/preamble-payload-exceptions.json'), 'utf-8')) as {
+        exceptions: Array<{ id: string; repaid_at: string | null }>;
+    }
+).exceptions
+    .filter((e) => e.repaid_at === null)
+    .map((e) => e.id);
+const APPROVED_ARGS: string[] = LIVE_GRANTS.flatMap((id) => ['--approved', id]);
+
 const hostTreeExists = fs.existsSync(path.join(REPO_ROOT_FOR_TESTS, '.claude', 'rules'));
 
 describe('the host reading is additive and never moves the ratchet', () => {
@@ -408,10 +423,10 @@ describe('the host reading is additive and never moves the ratchet', () => {
         // The load-bearing assertion of option 1A. `evaluate` is the source
         // reading; nothing about a host argument may reach it.
         const before = evaluate();
-        expect(main([])).toBe(0);
+        expect(main(APPROVED_ARGS)).toBe(0);
         // With a host tree: the exit code must be IDENTICAL. Without one: the
         // documented refusal, which is exit 2 and never a silent 0.
-        expect(main(['--host', 'claude-code'])).toBe(hostTreeExists ? 0 : 2);
+        expect(main([...APPROVED_ARGS, '--host', 'claude-code'])).toBe(hostTreeExists ? 0 : 2);
         const after = evaluate();
         expect(after.measured).toBe(before.measured);
         expect(after.ceiling).toBe(before.ceiling);
diff --git a/tests/scripts/measured_payload_ceiling.test.ts b/tests/scripts/measured_payload_ceiling.test.ts
index 8a03b93c55..1af9236144 100644
--- a/tests/scripts/measured_payload_ceiling.test.ts
+++ b/tests/scripts/measured_payload_ceiling.test.ts
@@ -435,10 +435,16 @@ describe('payload outside every measured bucket is refused', () => {
 describe('the shipped exceptions ledger', () => {
     const file = path.join(REPO_ROOT, EXCEPTIONS_CONFIG_PATH);
 
-    it('parses, and is empty — the ordinary path needs no grant', () => {
+    it('parses, and every grant in it is backed by a committed owner directive', () => {
+        // The ordinary path needs no grant; a recorded one is the owner's break-glass
+        // and must name the directive that ordered it, which must exist.
         const r = readExceptions(file);
         expect(r.errors).toStrictEqual([]);
-        expect(r.exceptions).toStrictEqual([]);
+        for (const e of r.exceptions) {
+            const cited = /agents\/evidence\/owner-directives\/[\w.-]+\.md/.exec(e.reason)?.[0];
+            expect(cited, `${e.id} names no owner directive`).toBeDefined();
+            expect(fs.existsSync(path.join(REPO_ROOT, cited!)), `${e.id}: ${cited} is not in the tree`).toBe(true);
+        }
     });
 
     it('an absent ledger is not an error — it is a repository with no grants', () => {
```

## What to answer

1. Does any changed assertion now pass in a case where the original intent says it should fail? Name the case.
2. Is the unverified path still asserted red where a live grant exists? Is the "every grant cites an existing owner directive" assertion able to fail (it was run with the directive moved away and went red)?
3. Is there a better way to keep the original intent?

End with exactly one stance line, in this shape:

`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`
