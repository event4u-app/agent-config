<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/self-modification-20261021,
     the modification review of step 6.2's change, round 3, committed verbatim
     so the verdict recorded beside it can be checked against what was actually
     asked. Not edited after the run. -->

# Modification review — one learning as a change to a skill body (step 6.2), round 3

Step 6.2 of `road-to-self-modification-that-a-council-must-pass`: one learning from this repository's own history is captured, proposed, and passed by a modification review as a change to a rule or skill body. Under ADR-281 as amended a favourable verdict is advisory until the owner's authorization is bound to the same digest; this review authorizes nothing and publishes nothing.

**The change** is the diff below to `src/skills/testing-anti-patterns/SKILL.md`, with the proposal that carries it (`agents/proposals/test-through-the-entry-point.md`). The `dist/agent-src/` copy is held byte-equal by CI's "Verify dist == rewrite(src)" step. The binding digest (`proposalSubjectOf` over the skill file at commit `ec866ae5b`) is `32577436593dc42d0300826ad646e7fc1337e988ee493187e086c1acd339e137`.

**Rounds 1 and 2** split (anthropic `ratified` both times; openai `refused` both times). Round 2's findings and this round's answer:

1. "No network, credentials or real hooks *unless those are the contract*" let prose declare a crossing → the exception is gone: "The fixture carries no network, no credentials and no real hooks, without exception: a behaviour that needs them is an integration test, which this law does not authorise."
2. Authorization and merge described, not enforced → the proposal now names which check holds which link: `proposal:check` check 7 (step 6.1, on this branch, tested for a missing authorization, a record or authorization bound to other content, and an edit after the review) refuses `stage: gated` without a passing record and an owner authorization on the same digest; the CI step holds the projection equal; that the merged commit is the authorized one is the owner's merge and is stated as not enforced by any check.
3. Rollback was distribution recovery → the proposal states that this package has no revocation mechanism for instruction text, names the revert trigger as the first test under the law that touches network, credentials or a real hook, and says the corrected text ships in the next release.
4–5. The share-of-findings metric could fall for the wrong reasons, and its baseline did not match its denominator → the signal is now a seeded-fault catch rate: for each entry-point case added under the law, remove the write that delivers the promised observable and count the cases that turn red while the function-level cases stay green. Baseline 1 of 1 (the step 5.2 case on this branch, reachable at `0e262c5c2`, red with the stderr write removed). Falsified if any such case stays green, or if none was added.
6. "Claim about delivery" is a classification → kept as a judgement the test author makes, with the paragraph's definition of narrowest faithful invocation; not changed.
7. A procedure checklist item would be smaller than an Iron Law → not taken in this round: the skill's laws are where its other "NEVER" obligations live; recorded as the seat's alternative.

Answer, for this change: what behaviour changes, including what follows from it; which authority or safety boundary becomes wider or narrower; whether the change weakens anything that judges it — a test, a gate, a threshold, this review; whether another host or projection is left as a way around it; whether it can be undone and how; what observation would show the claimed benefit to be false; whether a smaller change would do; what it adds to standing instruction weight; whether untrusted content could steer the path.

Report any defect with the line, the failure scenario and a severity. Close your reply with EXACTLY this line, and nothing after it:

STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no

where `<label>` is one of `ratified`, `confirmed-non-expanding`, `refused`.

```diff
diff --git a/agents/proposals/test-through-the-entry-point.md b/agents/proposals/test-through-the-entry-point.md
new file mode 100644
index 000000000..70febe804
--- /dev/null
+++ b/agents/proposals/test-through-the-entry-point.md
@@ -0,0 +1,144 @@
+---
+proposal_id: test-through-the-entry-point
+type: skill
+scope: package
+stage: proposed
+author: claude-opus-5.5/drain-self-modification-20261021
+created: 2026-10-21
+last_updated: 2026-10-21
+changed_files:
+  - src/skills/testing-anti-patterns/SKILL.md
+ratification_record: agents/evidence/ratifications/drain-self-modification-6-2-20261021.md
+---
+
+# Proposal: behaviour promised at an entry point is tested through it
+
+The worked example step 6.2 of
+`road-to-self-modification-that-a-council-must-pass` asks for, and the
+criterion the archived `road-to-curated-self-improvement` left open: one real
+learning from this repository's own history, walked through the pipeline.
+
+## 1. Learning
+
+A suite can cover a function completely and still leave the behaviour it
+promises untested, because the promise is made at an entry point — a CLI flag,
+a CI step, a hook binding — and the entry point decides whether the function's
+result reaches anyone. Testing the function proves construction; only a test
+that drives the entry point proves delivery.
+
+## 2. Classification
+
+- **Type:** skill — an 8th Iron Law, one paragraph and one dated Gotcha in
+  `testing-anti-patterns`.
+- **Scope:** package. It came from this suite's own gates and generalises to
+  any consumer who ships a CLI or a CI step around a pure function.
+- **Why not a rule:** it applies while writing tests, which is the surface
+  `testing-anti-patterns` already owns; a rule would be always loaded for an
+  obligation that binds on one kind of edit.
+- **Nearest existing law:** law 1, *never test mock behaviour*. Law 8 differs:
+  nothing is mocked, the function is real, and the gap is the caller.
+
+## 3. Evidence
+
+```yaml
+evidence:
+  - kind: review
+    ref: agents/evidence/council/escalation-shape-review-r3-20261021.question.md
+    summary: >
+      Round 3 of the step 5.2 modification review, 2026-10-21. Both seats
+      refused on one finding: 21 cases called evaluate() and proved the gate
+      built the owner's question, while main() under --quiet printed none of
+      it on a passing change to the mechanism. The later rounds' tests drove
+      main(argv) once per flag combination and read stdout and stderr; that
+      code is not on the trunk (the step's review did not pass), and the
+      prompts of every round are committed beside this one.
+  - kind: roadmap
+    ref: agents/roadmaps/archive/road-to-what-was-built-and-never-ran.md
+    summary: >
+      Two lints were built with passing suites and invoked by no workflow,
+      task or hook, so CI never ran them; the roadmap existed to wire them.
+      Same shape: the function was tested, the entry point that delivers it
+      was not.
+```
+
+## 4. Proposed artefact
+
+In `src/skills/testing-anti-patterns/SKILL.md`, Iron Law 8 — "NEVER stop at
+the function when the claim is about delivery — behaviour promised at an entry
+point (a CLI flag, an output stream, a hook) is tested by driving the narrowest
+faithful invocation of it in an isolated fixture and asserting the promised
+observable." — a paragraph defining "narrowest faithful" (in-process
+`main(argv)` unless parsing, packaging or process exit status is the claim),
+the fixture's isolation (no network, credentials or real hooks, without
+exception — a behaviour that needs them is an integration test the law does not
+authorise) and "the promised observable"; and one Gotcha stating the failure
+shape without a dated anecdote.
+
+## 5. Quality gate expectations
+
+`skill_linter` zero errors on the changed skill; `check_portability` clean (the
+Gotcha names this repository's own gate, not a consumer's); `check_references`
+resolves; the skill stays inside its size budget.
+
+## 6. Replacement justification
+
+Nothing is replaced or weakened. Laws 1 to 7 are untouched; law 8 is added
+after them.
+
+## 7. Success signal
+
+- Metric: seeded-fault catch rate. For every entry-point case added under
+  Law 8 by the evaluation date, remove the write that delivers the promised
+  observable (the print, the stream write, the exit-code propagation) and run
+  the suite; count the cases that turn red while the function-level cases for
+  the same behaviour stay green
+- Baseline: 1 of 1 — the step 5.2 case on this branch (reachable at
+  `0e262c5c2`) turned red when the stderr write was removed, with the
+  function-level cases green
+- Target: every such case turns red under its seeded fault
+- Evaluation date: 2027-01-21
+- Falsified if any entry-point case added under the law stays green under its
+  seeded fault, or if no such case was added (the law then changed nothing)
+
+## 8. Risks and alternatives rejected
+
+- **Risk:** every pure function gains a slow end-to-end twin. The law binds
+  only where a claim is made AT an entry point; a function with no delivery
+  promise needs none.
+- **Risk:** a literal reading drives real hooks or hosted CI with ambient
+  credentials. The law's own text confines it to an isolated fixture and the
+  narrowest faithful invocation.
+- **Rejected:** a lint that flags suites calling only an exported function.
+  It cannot tell which functions carry a delivery promise, so it would be
+  noise.
+- **Rollback:** revert the skill edit. The `dist/agent-src/` copy is a
+  byte-exact projection that CI's "Verify dist == rewrite(src)" step rejects if
+  it differs, so a revert regenerates with `task sync`. This package has no
+  revocation mechanism for instruction text: an installed copy keeps the law
+  until its next update, and the corrected text ships in the next release.
+  Revert on the first test written under the law that touches network,
+  credentials or a real hook, or if the evaluation above falsifies it.
+- **Sequence:** source reviewed at a digest → owner authorization bound to the
+  same digest moves the proposal to `gated` → merge, after which the projection
+  ships. What enforces which link: `proposal:check` check 7 (step 6.1, this
+  branch) refuses `stage: gated` without a passing record and an
+  `owner_authorization:` bound to the digest of the declared files read at one
+  commit, so a source edited after either is refused — its suite pins the
+  missing authorization, a record or authorization bound to other content, and
+  an edit after the review; the projection is held equal by the CI step above;
+  that the merged commit is the authorized one is the owner's merge (ADR-281
+  § 5), which no check here enforces.
+
+## 9. Gate verdict
+
+`proposal:check` returns PASS at `stage: proposed`. The change was reviewed by
+the council's modification review named in `ratification_record:`. The
+proposal stays at `stage: proposed`: under ADR-281 as amended a package
+proposal reaches `stage: gated` only with an `owner_authorization:` bound to
+the same digest, and that approval is the owner's act, not an agent's. Writing
+`gated` here would be an agent asserting it.
+
+## 10. Upstream PR
+
+Not opened: the proposal is not `stage: gated`. The change ships in this
+repository's own pull request, whose merge is the owner's.
diff --git a/src/skills/testing-anti-patterns/SKILL.md b/src/skills/testing-anti-patterns/SKILL.md
index 774dc10ec..b9c005f0a 100644
--- a/src/skills/testing-anti-patterns/SKILL.md
+++ b/src/skills/testing-anti-patterns/SKILL.md
@@ -45,8 +45,21 @@ Do NOT use when:
 5. NEVER treat tests as an afterthought — write the failing test first.
 6. NEVER overfit an assertion — assert the general rule, derive expected values from inputs/seeded data, cover boundary + error cases.
 7. NEVER game the green — a failing test is a finding, not an obstacle; fix the code, never skip/weaken/delete the test or rewrite `expected` to the buggy output.
+8. NEVER stop at the function when the claim is about delivery — behaviour promised at an entry point (a CLI flag, an output stream, a hook) is tested by driving the narrowest faithful invocation of it in an isolated fixture and asserting the promised observable.
 ```
 
+Law 8 exists because a suite can be complete and still miss it: every case
+calls the pure function, every case is green, and the flag or the caller that
+decides whether the result reaches anyone is in no test at all. "Narrowest
+faithful" means in-process `main(argv)` when argument handling and output are
+the claim, and the executable as a subprocess only when parsing, packaging or
+the exit status of the process is. The fixture carries no network, no
+credentials and no real hooks, without exception: a behaviour that needs them
+is an integration test, which this law does not authorise. "The promised observable" means
+what was promised — the stdout or stderr line, the exit code, the written
+artefact — never only that the call returned. Whether a workflow actually calls
+the entry point is a separate claim, checked against the workflow file.
+
 ## Procedure: Run the gate before each anti-pattern
 
 ### 1. Inspect the diff before any new mock
@@ -262,6 +275,7 @@ return **0** occurrences, and `hardcoded` returns **6**.
 - Long mock setups (> 50% of the test) are a signal that integration tests would be simpler — consider it before piling on more mocks.
 - **Diagnose, do not brute-force.** If a test fails after a mock change, **never guess** at another mock tweak — drop a debugger / Xdebug breakpoint at the seam, observe the real call shape, then mock minimally. Two retries without a root-cause hypothesis = STOP and rethink.
 - An assertion that derives from seeded data but only checks the happy path is still overfit — a code mutation survives it. Require ≥1 boundary/error/abuse case per behavior, not just line coverage.
+- **A green suite over a builder function says nothing about what `main` prints.** The failure shape: every case asserts on the value a function returns, and a flag in `main` decides that the value is never written. The cases that close it call `main(argv)` once per flag combination the callers use, capture stdout and stderr, and assert on the line that was promised.
 
 ## Do NOT
 
```
