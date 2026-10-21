<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch drain/self-modification-20261021,
     the modification review of step 6.2's change, committed verbatim so the
     verdict recorded beside it can be checked against what was actually asked.
     Not edited after the run. -->

# Modification review — one learning as a change to a skill body (step 6.2)

Step 6.2 of `road-to-self-modification-that-a-council-must-pass`: one learning from this repository's own history is captured, proposed, and passed by a modification review as a change to a rule or skill body. Under ADR-281 as amended, a learning-originated package self-modification needs a digest-bound council review, and a favourable verdict is advisory until the owner's authorization is bound to the same digest. This is that review. It does not authorize anything.

**The change under review** is the diff below to `src/skills/testing-anti-patterns/SKILL.md` (its `dist/agent-src/` copy is a byte-exact projection and is not reviewed separately). It adds Iron Law 8 — "NEVER stop at the function when the claim is about delivery — behaviour promised at an entry point (a CLI flag, a CI step, a hook) is tested THROUGH that entry point, or it is untested." — a three-line paragraph, and one dated Gotcha. The binding digest, `proposalSubjectOf` over that one file at commit `179b8bd19`, is `1fad927882e6159ff773e442e466daee9b3f9bb4746df84cd67840e0328b1309`.

**The proposal that carries it** is `agents/proposals/test-through-the-entry-point.md` (stage `proposed`). Its evidence, in short: (1) earlier today, round 3 of this branch's step 5.2 review refused 2/2 because 21 green tests called `evaluate()` and proved the ratification gate BUILT the owner's question, while `main()` under `--quiet` printed none of it on a passing change to the mechanism; it was settled by tests that drive `main()` as each caller runs it (without `--quiet` as the GitHub workflow does, with it as the local `task` pipeline does) and read stdout. (2) The archived `road-to-what-was-built-and-never-ran`: two lints were built with passing suites and invoked by no workflow, task or hook, so CI never ran them. Its success signal is a count of "function tested, entry point not" findings on pull requests, baseline 2 in October 2026, target 0 by 2027-01-21. Its rejected alternative is a lint that flags suites calling only an exported function — it cannot tell which functions carry a delivery promise.

The skill's existing Iron Laws 1–7 are unchanged. Law 1 is "NEVER test mock behavior"; law 7 is "NEVER game the green". Law 8 is meant to cover a case neither does: nothing is mocked and nothing is weakened — the suite is real and green, and the caller that decides delivery is untested.

Answer, for this change: what behaviour changes, including what follows from it; which authority or safety boundary becomes wider or narrower; whether the change weakens anything that judges it — a test, a gate, a threshold, this review; whether another host or projection is left as a way around it; whether it can be undone and how; what observation would show the claimed benefit to be false; whether a smaller change would do; what it adds to standing instruction weight; whether untrusted content could steer the path.

Report any defect with the line, the failure scenario and a severity. Close your reply with EXACTLY this line, and nothing after it:

STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no

where `<label>` is one of `ratified`, `confirmed-non-expanding`, `refused`.

```diff
diff --git a/src/skills/testing-anti-patterns/SKILL.md b/src/skills/testing-anti-patterns/SKILL.md
index 774dc10ec..2d85b3deb 100644
--- a/src/skills/testing-anti-patterns/SKILL.md
+++ b/src/skills/testing-anti-patterns/SKILL.md
@@ -45,8 +45,13 @@ Do NOT use when:
 5. NEVER treat tests as an afterthought — write the failing test first.
 6. NEVER overfit an assertion — assert the general rule, derive expected values from inputs/seeded data, cover boundary + error cases.
 7. NEVER game the green — a failing test is a finding, not an obstacle; fix the code, never skip/weaken/delete the test or rewrite `expected` to the buggy output.
+8. NEVER stop at the function when the claim is about delivery — behaviour promised at an entry point (a CLI flag, a CI step, a hook) is tested THROUGH that entry point, or it is untested.
 ```
 
+Law 8 exists because a suite can be complete and still miss it: every case
+calls the pure function, every case is green, and the flag, the step or the
+caller that decides whether the result reaches anyone is in no test at all.
+
 ## Procedure: Run the gate before each anti-pattern
 
 ### 1. Inspect the diff before any new mock
@@ -262,6 +267,7 @@ return **0** occurrences, and `hardcoded` returns **6**.
 - Long mock setups (> 50% of the test) are a signal that integration tests would be simpler — consider it before piling on more mocks.
 - **Diagnose, do not brute-force.** If a test fails after a mock change, **never guess** at another mock tweak — drop a debugger / Xdebug breakpoint at the seam, observe the real call shape, then mock minimally. Two retries without a root-cause hypothesis = STOP and rethink.
 - An assertion that derives from seeded data but only checks the happy path is still overfit — a code mutation survives it. Require ≥1 boundary/error/abuse case per behavior, not just line coverage.
+- **A green suite over `evaluate()` said nothing about what `main` printed.** Measured in this repository on 2026-10-21: 21 cases proved a gate built the owner's question, and its `--quiet` mode printed none of it on the one passing path the question existed for. A council review found it, and the cases that settled it drive `main` as each caller runs it and read stdout.
 
 ## Do NOT
 
```
