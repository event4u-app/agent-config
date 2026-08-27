<!-- evidence-type: analysis -->
<!-- evidence-artifact-type: analysis -->

# Review prompt — drain/consumer-repo-reality

Recorded per [`evaluator-independence`](../../../src/rules/evaluator-independence.md):
a self-commissioned review is admissible as gate evidence **only when the prompt
is recorded alongside the verdict**. The author of the change wrote this prompt,
so it is published rather than summarised — a recorded verdict whose prompt is
not recoverable is not evidence, because nobody can check what was asked.

Three properties the rule requires, and where they are:

- **Neutral.** No expected outcome is stated, in either direction. The prompt
  does not say the change is clean, does not say findings are expected, and does
  not reassure the reviewer that no particular verdict is wanted — that last one
  is an expectation stated in the negative and is forbidden by the same clause.
- **Scope not chosen to flatter.** The scope is the whole delta
  (`git diff origin/main...HEAD`), stated as such in the first line of the Scope
  section. The file list that follows is an index into that delta, not a filter
  on it.
- **One evaluation.** This review was run once. No second pass with a different
  prompt or scope was commissioned.

The reviewer was also told to run the suites and the typechecker itself rather
than trust the author's report, and to say which areas it could not examine
rather than imply coverage.

## The prompt, verbatim

~~~
Review the changes on the branch `drain/consumer-repo-reality` in the repository at `/private/tmp/dr10`.

## Environment

**Every Bash call must start with `cd /private/tmp/dr10 && `** — the shell cwd resets between calls. The branch is already checked out there. `npx vitest run <path>` runs tests; `npm run typecheck` typechecks; `./scripts-run src/scripts/<name>` runs a repo script.

**Do not modify, commit, stage, or push anything.** This is a read-and-report task.

## Scope

The full delta: `git diff origin/main...HEAD`. Start with `git diff --stat origin/main...HEAD` and `git log --oneline origin/main..HEAD` to see the shape, then read what matters.

The substantive new code is:
- `src/scripts/_lib/install_reach_checks.ts` + `tests/scripts/install_reach_checks.test.ts`
- `src/scripts/_lib/config_chain.ts` + `tests/scripts/config_chain.test.ts`
- `src/install/detect_php_shape.ts` + `tests/install/detect_php_shape.test.ts`
- `src/scripts/_lib/legacy_boundary_map.ts` + `tests/scripts/legacy_boundary_map.test.ts`
- `src/scripts/_lib/generated_by.ts` + `tests/scripts/generated_by.test.ts`
- `src/scripts/_lib/doctor_runtime_checks.ts` (an extraction out of `src/scripts/_cli/cmd_doctor.ts`)
- edits to `src/scripts/_cli/cmd_doctor.ts`, and ~18 generator files whose attribution strings changed
- prose edits to several `src/rules/*.md` and `src/skills/*/SKILL.md`

The changes implement `agents/roadmaps/archive/road-to-consumer-repo-reality.md` — read it for what each step was supposed to do, including each step's `verify:` line and the Risk Register.

## What to report

Find defects. For each finding give: the file and line, what is wrong, and a concrete case (inputs or a tree shape) where it produces a wrong result. Rank by severity.

Look in particular at:

1. **Correctness of the classifiers.** `install_reach_checks.ts` decides present/dangling/unresolvable; `config_chain.ts` decides project/workspace-package/external/unresolved; `detect_php_shape.ts` decides five verdicts; `legacy_boundary_map.ts` decides modern/legacy/mixed/unknown per line region. For each: is there an input where the verdict is wrong, or where the code throws, or where a caller gets a misleading answer? Off-by-one errors in line ranges, regex that over- or under-matches, path handling on inputs with `..`, symlinks, empty strings, or unusual encodings.

2. **Whether the tests actually constrain the code.** Do any assertions pass regardless of the implementation? Are there branches with no test? Does any test assert an implementation detail rather than a behaviour? The author claims sensitivity was proven by sabotaging each mechanism — check whether the tests would in fact catch a plausible *different* sabotage than the one tried.

3. **The `cmd_doctor.ts` extraction.** `_check_python_runtime` and `_check_humanizer_runtime` moved to `_lib/doctor_runtime_checks.ts` behind wrappers. Is behaviour identical? Are the check ids, statuses and message strings unchanged? Does `RuntimeCheck`'s index signature (`[k: string]: string`) weaken any type guarantee?

4. **The generator-attribution rewrite.** ~18 emitted strings changed. Did any change alter output in a way a golden test or a consumer would notice beyond the intended path removal? Does `generatedBy` throwing on a path separator create a crash path in a generator that previously worked?

5. **Anything the roadmap's `verify:` lines asked for that is not actually satisfied**, and anything claimed in a commit message that the code does not do.

Run the test suites and the typechecker yourself rather than trusting the author's report.

Report what you find, including "no defect found in X" where that is the honest result for an area you examined. If an area is too large to examine properly, say which and why rather than implying coverage.
~~~

## Verdict

Recorded in the sibling file once the review returns. If it is not there, the
review did not complete and this prompt is not evidence of anything.
