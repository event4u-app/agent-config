---
model_tier: high
name: review-changes
pack: engineering-base
intent: "Multi-judge review of the current diff — bugs, security, tests, quality, architecture"
routes_to: [code-review, judge-bug-hunter, judge-security-auditor, judge-test-coverage, judge-code-quality, architecture-review-lens]
replaces: []
visibility: internal
sub: changes
cluster: review
skills: [code-review, subagent-orchestration, judge-bug-hunter, judge-security-auditor, judge-test-coverage, judge-code-quality, architecture-review-lens, judge-synthesis, git-workflow]
description: Self-review local changes before creating a PR — dispatches to six specialized judges (bug, security, tests, quality, architecture, spec) and consolidates verdicts
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# review-changes

## Instructions

Review all uncommitted and committed-but-not-pushed changes against
the default branch (`main`) by dispatching to six specialized judge
sub-skills and consolidating their verdicts.

### 1. Update the current branch

Before gathering the diff, run [`/prepare-for-review`](prepare-for-review.md)
to make sure the current branch is up to date with its base chain:

- Detect the current branch with `git rev-parse --abbrev-ref HEAD`.
- If the branch is `main` → skip this step (nothing to prepare).
- Otherwise, search for an open GitHub PR whose head is the current
  branch.
  - If exactly one open PR is found → invoke `/prepare-for-review`
    with that PR number. It will update `main`, fetch and merge the
    full branch chain into the current branch, and leave the current
    branch checked out.
  - If no open PR is found → fall back to a minimal local update:
    `git fetch origin main` and `git merge origin/main --no-edit` on
    the current branch. Abort on conflict and report.
  - If multiple PRs are found → ask the user which PR to use before
    proceeding.
- If `/prepare-for-review` aborts (merge conflict, network error,
  etc.) → stop the review here and surface the error. Do **not**
  continue with stale data.

### 2. Gather the diff

**Verify the base ref before diffing against it.** The commands below assume
`origin/main` exists and is the right base, and nothing checked. This step
already knows how to ask git a question — `git rev-parse --abbrev-ref HEAD`
above — so the shape was present and simply not applied to the base:

- `git rev-parse --verify origin/main` — the base ref resolves.
  - **Does not resolve → stop here and say so.** Do not fall back to a
    different base, and do not diff against `HEAD` alone. A review whose scope
    silently became "the whole branch" or "the last commit" reports findings
    against a diff nobody asked about, and the reader has no way to see that the
    scope moved. Name the ref that failed.

- `git diff origin/main..HEAD --stat` — overview of changed files
- `git diff origin/main..HEAD` — full committed-but-not-pushed diff
- `git diff --stat` + `git diff` — unstaged changes on top

If both diffs are empty, **stop** — nothing to review.

### 3. Resolve the judge model

Read `.agent-settings.yml`:

- `subagents.judge_model` → empty = one tier above the session model

Unknown alias → stop. Never silently fall back.

### 3b. Bind the criteria source before dispatching

The spec judge below is only as good as the criteria it reads, so where they
came from is recorded **before** the dispatch, not reconstructed after it.
Exactly one of three states, and the state is written into the review report:

| `criteria_source` | When | What the report says |
|---|---|---|
| `supplied` | a roadmap, ticket, issue or AC block was explicitly handed in — name it by path or id | the criteria, verbatim, and where they came from |
| `not_provided` | an ad-hoc branch review with no criteria anywhere | "no acceptance criteria supplied — requirement compliance NOT verified" |
| `supplied_unparseable` | criteria were handed over and could not be read in a recognised shape | an **error**: the review skipped a dimension it was asked to check |

```
CRITERIA ARE READ ONLY WHEN SUPPLIED. NEVER DERIVED FROM THE BRANCH,
THE COMMIT MESSAGES, OR THE PR BODY — AND NEVER FROM THE DIFF.
A JUDGE THAT INFERS THE REQUIREMENT FROM THE CHANGE IT IS JUDGING
ALWAYS FINDS THE CHANGE COMPLIANT. SILENCE IS `not_provided`, NEVER A PASS.
```

There is deliberately **no `derived` state**. Deriving criteria from the branch
was the alternative considered and rejected: the `derived` label would have to
be honoured by every consumer of the report to be worth anything, and a label
that is requested rather than enforced degrades to silence exactly when it
matters. Decided by AI council on 2026-08-22 (degraded, 1 of 2 seats — the
second returned an empty response), and the alternative is recorded here rather
than only in the decision so a later reader can see it was weighed.

`supplied_unparseable` is separated from `not_provided` for the same reason:
folded together, a handover the reviewer could not parse would report as "there
was nothing to check", which is the one outcome that hides a real failure
behind a benign one.

### 4. Dispatch to the six judges

Each judge receives **the same diff plus the task context** (ticket,
PR body, commit messages) and runs independently. The judges are:

| Sub-skill | Focus |
|---|---|
| [`judge-bug-hunter`](../../skills/judge-bug-hunter/SKILL.md) | Correctness, null-safety, edge cases, races, error handling |
| [`judge-security-auditor`](../../skills/judge-security-auditor/SKILL.md) | AuthZ/AuthN, injection, secrets, unsafe deserialization, SSRF, XSS |
| [`judge-test-coverage`](../../skills/judge-test-coverage/SKILL.md) | Missing assertions, uncovered branches, over-mocking, regression-test gaps |
| [`judge-code-quality`](../../skills/judge-code-quality/SKILL.md) | Naming, SRP, DRY, dead code, consistency with codebase conventions |
| [`architecture-review-lens`](../../skills/architecture-review-lens/SKILL.md) | Layer violations, dependency direction, leaky abstractions, cross-service contract drift |
| [`judge-spec-compliance`](../../skills/judge-spec-compliance/SKILL.md) | Does the diff satisfy every acceptance criterion **as stated**? Reads the criteria before the diff, and never infers them from it |

The six judges weight equally in the consolidated verdict — none
overrides another.

**Why the sixth exists, and why it is not a severity.** The other five all ask a
craft-or-correctness question, so a change that is correct, clean, well-tested
and architecturally sound — and **does not do what was asked** — used to pass
this path with five green verdicts. Its finding does **not** enter the shared
severity axis: `judge-synthesis` carries it on its own dimension, because "this
does not do what was asked" is not comparable to "this variable is badly named",
and on one scale the second can outrank the first whenever three judges raise
nits and one raises the spec gap.

**When no criteria were supplied** — an ad-hoc branch review — this judge
returns a no-criteria verdict, never `SATISFIED`. That is not an abstention the
consolidated verdict may drop: it changes what "done" is allowed to claim to
*"craft quality verified; requirement compliance NOT verified"*. If that reads as
most reviews, the honest reading is that most reviews were previously reporting a
confidence they had not earned.

Pick dispatch mode based on diff size and environment:

- **Sequential** (default, simplest) — run bug-hunter → security-auditor
  → test-coverage → code-quality → architecture-review-lens →
  spec-compliance, collect each verdict
- **Parallel** — if `subagents.max_parallel` in `.agent-settings.yml` is
  ≥ 5 and subagent dispatch is available, run all six concurrently
  following the `do-in-parallel` pattern in
  [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md);
  the six judges operate on the same diff but produce independent
  reports, so no shared-state risk

Each judge returns its own `Judge / Model / Target / Verdict /
Issues` block in the format defined by that skill.

### 4b. Optional external council (B3 hook, verbosity-gated)

Read `verbosity.offer_council_in_delivery` from `.agent-settings.yml`
(default `false`):

- `false` (default): skip the prompt silently. When `ai_council.enabled:
  true` AND at least one member enabled, emit one line: `→ council
  skipped (set verbosity.offer_council_in_delivery: true to enable, or
  run /council diff:<base>..<head> directly)`. Otherwise emit nothing.
- `true`: when `ai_council.enabled: true` **and** at least one member
  enabled, ask (in the user's language):

  > 1. Add an external council review alongside the six internal judges? (billable)
  > 2. Skip — internal judges only

  Also suppress when `personal.autonomy: on` (council is billable).

If picked **1**:

- Run `/council diff:<base>..<head>` in parallel with the six
  internal judges (or sequentially after them — whichever the
  dispatch mode picked in step 4 supports).
- Treat each council member as one extra "judge" in the consolidated
  report (step 5), but **mark them clearly as external** so the user
  can weight them differently. Council verdicts are **advisory** —
  they never block on their own; they augment the internal verdicts.
- The council's neutrality preamble already strips host-agent
  identity; do **not** add the internal judges' verdicts to the
  council prompt (would defeat the Iron Law of Neutrality).

If picked **2** → continue with internal judges only.

### 4b-fresh. The fresh reviewer — the one input with no implementation context

The six judges above all read **the same diff plus the task context**, and on the common
path they run in-session: the party that wrote the diff also reads it, with the whole
implementation context in scope. That is a self-review, and calling it a review is the
defect `road-to-review-independence` exists to close.

So a **seventh input** is added, and its distinguishing property is a negative one: it
has **no implementation context**. Not a new mechanism —
[`dispatch_r2_reviewer.ts`](../../../../scripts/dispatch_r2_reviewer.ts) already derives
the scope and persists the prompt it sent:

```bash
./scripts-run src/scripts/dispatch_r2_reviewer --slug <slug> --base origin/main
```

The six in-session judges stay exactly as they are. This is an addition, not a
replacement — a fresh reviewer is worse than a spec judge at spec compliance, and the
point is not to be better at their job but to be uncontaminated by the author's framing.

**When the route is taken.** Whenever the diff is going to a PR — i.e. every
pre-PR review, which is what this command's own opening line describes itself as. It is
skipped only for a diff that will not be proposed to anyone: a scratch branch, a probe,
a measurement re-run.

**When dispatch is unavailable — the honest degraded answer.** If a fresh dispatch cannot
be made (no subagent primitive on this host, a spend ceiling, a dispatcher error), the
review **says so in the report** and records `fresh_review: unavailable` with the reason.
It does **not** fall back to the in-session judges and present the result as a review:

```
A SELF-REVIEW PRESENTED AS A REVIEW IS THE DEFECT, NOT THE DEGRADED MODE.
NO FRESH REVIEWER -> THE REPORT SAYS SO. NEVER SILENTLY.
```

That wording is deliberate. A silent fallback is worse than a missing input, because the
reader cannot tell which one they got — and this command's own `criteria_source` table
already applies the same rule to a different input (`not_provided` is never a pass).

**The implementer envelope does NOT reach this reviewer.** The judge prompts hand it over
on purpose — `prompts/do-and-judge.md:70` carries an `IMPLEMENTER ENVELOPE:` line with the
envelope placeholder — which is correct for a judge validating a claim and wrong for a
reviewer whose entire value is not having the author's framing.

The placeholder is described rather than written out here on purpose: step 1.3's verify is
a grep for its **absence** from this route, and prose that trips a grep-shaped verify is a
trap for the next reader. The asymmetry is stated in
[`prompts/README.md`](../../../../skills/subagent-orchestration/prompts/README.md) so the
next prompt author does not copy the envelope line into a fresh-reviewer template.

### 4c. Optional adversarial verification council (opt-in, high-risk)

Read `subagents.adversarial_council` from `.agent-settings.yml` (default
`off`):

- `off` (default): skip silently.
- `ask`: when the diff is explicitly high-risk (security, tenant, migration,
  public API), offer it — in the shape
  [`settings-ask-protocol`](../../../../rules/settings-ask-protocol.md) fixes,
  which supplies the four slots, the one-question budget, and the storage line
  (not persisted: `subagents.adversarial_council` is class C). What only this
  command knows is *why now*: the diff is high-risk, and the offer is a paid
  distinct-model red-team for finding coverage against the six internal judges.
- `on`: run it automatically on a high-risk diff.

When run, dispatch the
[`adversarial-verification-council`](../../skills/subagent-orchestration/SKILL.md)
mode (Mode 9): distinct-model skeptics red-team the diff for defect FINDING
coverage; the reconciled findings-by-severity envelope is folded into step 5 as
an **advisory** input, clearly marked. Like the external council it **never
auto-gates** — a human decides what is actionable. This is defect coverage, not
a go/no-go verdict.

### 5. Consolidate

Consolidate via [`judge-synthesis`](../../skills/judge-synthesis/SKILL.md) — the
canonical cross-judge aggregation format. It consumes the verdict blocks from
step 4 (plus any external council blocks from 4b) and produces one report:

- A side-by-side verdict table (one row per judge, its own verdict word)
- **Consensus** findings flagged by ≥2 judges — the highest-confidence items
- **Conflicts** where judges disagree on the same target — surfaced, not
  silently resolved
- A **must-fix / should-fix / advisory** split, each entry tagged with the
  judge(s) that raised it

- A **spec-compliance block**, kept apart from that split — the
  `criteria_source` state from step 3b, the per-criterion verdicts, and the
  count of `MISSING` plus `PARTIAL`. See
  [`judge-synthesis` § 4c](../../skills/judge-synthesis/SKILL.md); a spec
  finding never becomes a craft finding.

`judge-synthesis` emits no single quality score and never auto-gates — it
structures the verdicts so the next step's decision is informed.

**The report names its criteria source, always.** A reader six months later
cannot otherwise tell "we checked the requirements and they were met" from
"nobody checked" — and those are the two readings a bare `proceed` collapses.
Where the state is `not_provided`, the overall sentence says *craft quality
verified; requirement compliance NOT verified*, never a plain pass.

**One telemetry line per review** records the structural outcome: which judges
ran, whether the spec axis was reachable, and whether it changed the
recommendation. Built and validated by
`src/scripts/_lib/review_telemetry.ts::buildReviewLine`, which carries no field
able to hold free-form content and **rejects** an input that adds one. Read the
window back with `./scripts-run src/scripts/review_axis_report`; it reports
"nothing observed" and "the axis changed nothing" as two different answers.

### 6. Decide next steps

- If **any** judge returned `reject` → stop; the approach must change
  before proceeding
- If **any** judge returned `revise` → fix 🔴 findings automatically,
  ask before fixing 🟡 findings, report 🟢 as suggestions
- If all six returned `apply` → the diff is ready; report and stop

**Opt-in (never auto-on):** when the `revise` findings are *test-driven*
(failing checks, not subjective craft) and you want bounded auto-repair
before re-review, hand off to
[`verify-repair-loop`](../../skills/verify-repair-loop/SKILL.md) — a
generate→run→revise→re-run loop gated by a numeric threshold, then a judge
confirms. Surface it as a single follow-up line; do not auto-invoke.

### 7. Quality tools (verbosity-gated)

Per `verbosity.routine_confirmations` (default `false`):

- `false` (default) → emit `→ run /quality-fix to format + lint` as a
  single follow-up line; do not auto-invoke. User runs explicitly.
- `true` → ask:
  ```
  > 1. Yes — run quality tools (formatter, static analyzer, linters)
  > 2. No — review done
  ```
  If yes, hand off to the project's quality workflow (e.g.
  `/quality-fix` or the equivalent configured command). The quality and
  test runners are resolved per-stack via the
  [`toolchain-resolver`](../../contexts/execution/toolchain-resolver.md), so
  the hand-off adapts to PHP / JS-TS / Python / Go / Rust rather than
  assuming one stack.

## Backward compatibility

- Invocation is unchanged: `/review-changes` with no arguments still
  reviews the full uncommitted-plus-committed-not-pushed diff
- A user who invokes `/review-changes` on a diff that has no test
  files still gets coverage feedback — `judge-test-coverage` treats
  "production changed, no test changed" as its primary finding
- Project-specific syntax checks (e.g. `php -l`, linter pre-pass) are
  out of scope for the judges and belong in the optional step 7
  quality tools hand-off
- The new step 1 (`/prepare-for-review`) is **best-effort**: if no
  open PR exists for the current branch, it falls back to a plain
  `git fetch && git merge origin/main`. Existing invocations that
  ran on a fully detached or pre-PR branch keep working

## Use this command when

- Preparing a self-review before opening a PR
- Stress-testing a local branch with the same six lenses a reviewer
  would apply
- Sanity-checking a diff before handing it to `/create-pr`

## Do NOT

- NEVER apply fixes without showing the consolidated report first
- NEVER skip a judge because the diff "looks fine" — each judge must
  produce its own verdict
- NEVER merge two judges' outputs into a single block — the user
  needs to see which lens raised each finding
- NEVER commit or push from this command — review only
- NEVER run on an empty diff; fail fast

## See also

- [`/prepare-for-review`](prepare-for-review.md) — updates `main` and merges the full base-branch chain into the target branch (used by step 1)
- [`judge-synthesis`](../../skills/judge-synthesis/SKILL.md) — the cross-judge consolidation format used in step 5 (consensus / conflicts / must-fix, no opaque score)
- [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md) — dispatch and model-pairing rules
- [`/do-and-judge`](do-and-judge.md) — implementer + judge loop for a single change
- [`verify-repair-loop`](../../skills/verify-repair-loop/SKILL.md) — opt-in test-verdict-gated iterate-to-green loop (step 6 hand-off); judge confirms after the numeric gate
- [`/judge`](judge.md) — standalone judge, no review-changes dispatch
- [`code-review`](../../skills/code-review/SKILL.md) — human-oriented review patterns (tone, feedback handling)
- [`role-contracts`](../../../docs/guidelines/agent-infra/role-contracts.md#reviewer) — Reviewer mode output contract (Summary / Risks / Findings / Required actions / Verdict)

## References

- **LLM-as-a-Judge** — [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685)
  MT-Bench and Chatbot Arena — judging LLM outputs with LLM judges.
  This command adapts the pattern by dispatching to six specialized
  judges (bug, security, tests, quality) instead of a single generic
  judge, and consolidating their verdicts.
