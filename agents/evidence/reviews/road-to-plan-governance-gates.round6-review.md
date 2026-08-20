# Findings: road-to-plan-governance-gates
<!-- completion-review: v1 | reviewed: 2026-08-04 | scope: 74c4fc466896d7d8d692bba78abd78bbb4bbab2e8298210dafb99f63a1211eb6 | diff: f2c6971913d19afe14523d460df996aa8d2adf82 | reviewer: r2-fresh-subagent-road-to-plan-governance-gates -->

<!-- context-manifest: v1
inputs:
  diff_sha: f2c6971913d19afe14523d460df996aa8d2adf82
  scope_hash: 74c4fc466896d7d8d692bba78abd78bbb4bbab2e8298210dafb99f63a1211eb6
  roadmap: agents/roadmaps/archive/road-to-plan-governance-gates.md
  roadmap_hash: 7be2dc5ef4ca9bbda0e022e39a2a62c55c5fb9823dbcac734a0bbe2756cd7241
  ac_hash: 1c3cd7678aacae91ea045d13cde1f09e0bd97738d2f5a63857a2da04efc48dca
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-04T11:40:33Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_completion_review.ts:128 | `CODE_EXTENSIONS` omits infrastructure-as-code and build surfaces: `.tf`, `.hcl`, `.tfvars`, `.gradle`, `.cmake`, `.proto`, and every extensionless build file (`Dockerfile`, `Makefile`, `Jenkinsfile` — `isCodePath` returns false when `dot <= 0`). An IaC-only or Dockerfile-only PR in a consumer repo therefore classifies as "no code surface", so a `**Skipped:**` declaration is accepted and R2 never runs on it: a code-bearing diff passing the gate silently. Contract § 2.4 declares that an omitted extension is a real hole and asserts the set "errs broad" — for IaC it does not, while the suite ships terraform / terragrunt / aws-infrastructure skills plus `engineering-safety-floor`, i.e. it already treats exactly these files as production-behaviour surfaces. | fixed | 6c5f0f599 — IaC extensions (.tf/.tfvars/.hcl/.gradle/.cmake/.proto/.bicep) + extensionless build files added, with a narrow generated-tail exclusion so Gemfile.lock stays dependency state |
| 2 | medium | src/scripts/check_completion_review.ts:374 | `parseArtifact` accepts any table-shaped row with `cells.length >= 6` and drops the surplus cells, but contract § 2.2 is normative and says a row that does not parse into **exactly** the six cells is a `malformed-row` block ("a divergence from that file is a validator bug, never a contract reinterpretation"). A row with 7+ columns — an added column, or an unescaped `\|` in the Finding cell shifting content rightwards — is read as a valid finding row with its trailing cells ignored, so Status and Reason/Ref are taken from the wrong columns. Only the short-row case has a fixture (`'5 cell(s), expected 6'`); the over-long case is untested, so neither the code nor the contract text is pinned. | fixed | 6c5f0f599 — rows must parse into exactly six cells per § 2.2; an over-long row (unescaped `|`) is reported instead of having the wrong cell read as its status |
| 3 | low | src/scripts/check_completion_review.ts:269 | `extractFixRef` treats the first `\b[0-9a-f]{7,40}\b` run in `Reason/Ref` as the fix commit-ish, so any 7+ character token from the hex alphabet matches — including plain decimals: `fixed, closes #1234567` yields `1234567`, `fixed 20260804` yields `20260804`. `git rev-parse --verify` then fails and the row reports `unresolvable-fix-ref` (blocking once `--advisory` is dropped) even though a real ref appears later in the same cell. Scanning all candidate tokens and accepting the first that resolves removes the false positive without weakening § 2.5. | deferred | roadmap: agents/roadmaps/road-to-plan-gates-measurement.md — extractFixRef over-matches any 7+ hex-alphabet token (`#1234567`, a date). Only misfires on a `fixed` row whose ref is not a sha; the fix needs a ref-shape decision (require a `commit:`/`sha:` prefix vs. rev-parse probing), which belongs with the Stage-B pass |
| 4 | low | src/scripts/dispatch_r2_reviewer.ts:440 | The `deriveSlug` doc comment states "The CI environment is consulted FIRST because on a `pull_request` checkout `HEAD` is a detached synthetic merge commit", while the implementation ten lines below consults git first and says so in its own inline comment ("GIT FIRST — the env vars are a detached-HEAD fallback, not an override"). Two contradictory statements of the resolution order in one function; a reader who trusts the JSDoc mis-predicts the `--repo`-scoped behaviour that the inline comment exists to protect. | fixed | 0f5d43a17 — deriveSlug JSDoc now matches the git-first implementation and its own inline rationale |
| 5 | low | src/config/gate-coverage.yml:332 | The `check_completion_review` note asserts `scanned` "is >= 1 by construction and `min_scanned: 1` can never trip". That contradicts the validator's own comment (the `+1` "is counted ONLY when the artefact root actually resolves, so a moved/renamed root drops N to 0 instead of hiding behind a floor that cannot fail") and the qualified wording of contract § 6 ("guards nothing **on the happy path**"). A moved reviews root emits `scanned: 0`, so the floor does trip for the one case it exists to catch; understating a working floor invites a future maintainer to drop it as dead weight. | fixed | 0f5d43a17 — the min_scanned "can never trip" claim narrowed to the case where it holds; the moved-root `scanned: 0` path is named |
| 6 | low | src/scripts/lint_plan_risk_register.ts:685 | `riskReviewDisabled` re-implements the settings escape-hatch reader that already exists, generically keyed, as `planningFlagIsFalse` in `src/scripts/_lib/planning_settings.ts:21` — which exports only the `completion_review` wrapper. The same diff states the opposite rule twice (`md_table.ts`: "One definition, imported by both validators: the same defect appearing twice is what made this a shared helper"; `planning_settings.ts`: "A reader that only the gate consulted left the second, blocking layer firing with the gate nominally switched off"). Two copies of fail-open semantics can drift exactly where a drift disables or over-enables a gate; exporting a `riskReviewDisabled` wrapper costs one line. | deferred | roadmap: agents/roadmaps/road-to-plan-gates-measurement.md — riskReviewDisabled duplicates _lib/planning_settings.planningFlagIsFalse. Behaviour-identical duplication, not a defect in output; collapsing it touches both validators, so it rides with the Stage-B pass rather than this PR |
| 7 | low | src/scripts/dispatch_r2_reviewer.ts:145 | Review-scope determinism: `REVIEW_SCOPE_GIT_CONFIG` pins `core.quotePath` and `core.attributesFile`, and § 2.0 names `$GIT_DIR/info/attributes` and `etc/gitattributes` as accepted residuals — but neither the pin nor the residual list covers the process **locale**. Git's `Binary files %s and %s differ` patch line is in git's message catalogue, so with `LANG`/`LC_ALL` set to a translated locale the same content yields different diff bytes whenever the scope includes a binary file, producing exactly the cross-machine `manifest mismatch (stale review)` § 2.0 exists to eliminate. `gitEnv()` strips only the `GIT_*` discovery variables, so the locale is inherited; forcing `LC_ALL=C` (with `GIT_ATTR_NOSYSTEM=1`) in that env closes it, otherwise the residual list should name it. | deferred | roadmap: agents/roadmaps/road-to-plan-gates-measurement.md — the scope-hash pin does not neutralise locale (`LANG`/`LC_ALL`), which localises git's "Binary files … differ" line. Reachable only for a binary-classified path in the scope diff; the residual is named in contract § 2.0 alongside the un-pinnable $GIT_DIR/info/attributes |

## Provenance

Blind round dispatched by `dispatch_r2_reviewer.ts` and answered by a fresh
subagent with no implementation context (contract § 5), bound to scope
`74c4fc46…` (head `f2c697191`).

Result: **7 findings — 2 medium, 5 low, 0 critical, 0 high.** No gate was found
that a policy violation can pass unintentionally outside the declared Stage-A
`--advisory` window: the three `consistency.yml` wrappers and the two
`ci-fast.yml` / `Taskfile.yml` wrappers re-raise every non-2 exit code, the
`DeadScopeError` → exit 1 carve-out is implemented in both validators, and the
`--verify-current` selector is the one blocking R2 layer during Stage A. Findings
1 and 2 are the two places where shipped behaviour is narrower than the
contract's own normative text; 3 and 7 are false-block paths; 4, 5 and 6 are
documentation/code contradictions inside this diff. Honestly stated residuals
(§ 1 enforced corpus, § 4.1, § 6, § 7.1, the § 2.0 attributes residual) were
read as declarations, not defects.

Cross-checks that came back clean: the review-scope hash is computed by exactly
one exported `computeReviewScope`, imported by the validator; `splitMarkdownRow`
and `completionReviewDisabled` are single definitions shared by both layers;
`agents/roadmaps/road-to-kernel-question-triangle.md` and <!-- ref-ignore -->
`agents/roadmaps/road-to-plan-gates-measurement.md` both carry registers whose
`Anchored under` values resolve in-document (`## Phase 1 — apply through the
kernel process`, `## The amendment (drafted, ready to apply)`, `Phase 1 Step 1`
/ `Step 2` bullets), so Gate R1 — the one blocking new gate — does not red this
PR; `fetch-depth: 0` is present on the only job that runs the three gates;
`planning` appears with the same three keys and defaults in the template, the
Zod schema (`.default({})`) and the rebuilt `dist/install/install.mjs`; and
`docs/proof.md` tracks the new `CLAIMS.md` entry (6→7 unbacked, 48→49 entries).

## Round history

Blind rounds, each dispatched fresh with no implementation context:

- round 1 (pre-scope-hash binding) — 11 findings: 10 fixed, 1 accepted-risk
- round 2 (`2e8caaab…`) — 11 findings: 11 fixed
- round 3 (`57965c9d…`) — 12 findings: 11 fixed, 1 accepted-risk
- round 4 (`8ef78703…`) — 4 findings: 4 fixed
- round 5 (`fa8f4d32…`) — NO-FINDINGS
- round 6 (`c7a76c7e…`) — 1 finding: 1 fixed
- round 7 (`1559f51c…`) — NO-FINDINGS
- round 8 (this artefact, scope `74c4fc46…`) — 7 findings, all `open`

Superseded rounds are retained as `*.roundN-review.md` (§ 2.7) — outside the
`*.findings.md` glob because each is bound to a scope that no longer exists.

Rendered as a list, not a table, on purpose: § 2.2 parses every table-shaped
line in a findings artefact as a findings row, so a prose table here reports as
`malformed-row`.

## Round-6 disposition

4 `fixed`, 3 `deferred` to `agents/roadmaps/road-to-plan-gates-measurement.md`.
0 critical, 0 high — the sixth consecutive round with no blocking finding, and
the point at which the review loop is cut deliberately: the three deferrals are
each reachable only on a narrow input, and each needs a decision that belongs
with the Stage-B pass rather than another round here. Two of the four fixes were
false statements in this change's own documentation, which is the class this
whole PR exists to make expensive.
