# Self-review gate (dogfooded PR review)

The package reviews its own PRs with the exact machinery it ships —
[`adversarial-review`](../src/skills/adversarial-review/SKILL.md) +
[`agent-security-review`](../src/skills/agent-security-review/SKILL.md) — via
[`.github/workflows/self-review-gate.yml`](../.github/workflows/self-review-gate.yml)
and [`src/scripts/self_review_gate.ts`](../src/scripts/self_review_gate.ts).

`road-to-maintainer-bus-factor` Phase 1.

## Current status — ADVISORY, inert without a secret

This is an **honest floor, not independent human review**, and today it is
**advisory + inert-without-secret**. Do not read it as "every PR is
AI-reviewed" — that is only true once the maintainer arms it (below).

| Job | Runs | Spend | Blocks merge |
|---|---|---|---|
| `gate-dry-run` | every PR | none (no API) | never — prints the review plan only |
| `live-advisory` | every PR **iff** `ANTHROPIC_API_KEY` is set | up to `MAX_REVIEW_CHUNKS` review calls (see § Prompt budget) | never — posts findings, records what *would* block |

Without the `ANTHROPIC_API_KEY` repo secret, `live-advisory` is a **logged
no-op** (never a failing check) — exactly the `cross-model-canary.yml` pattern.


## Prompt budget and coverage

The release path analyses the whole span since the previous tag, and that span
does not fit one request. Measured on four consecutive releases, all four of
which returned `HTTP 400 prompt is too long` and reviewed nothing:

| release | input tokens reported | cap |
|---|---:|---:|
| 14.17.0 | 235,472 | 200,000 |
| 14.18.0 | 413,191 | 200,000 |
| 14.19.0 | 450,336 | 200,000 |
| 14.20.0 | 260,998 | 200,000 |

The smallest exceeds the cap by 17.7 %, so no observed span fits and waiting for
smaller releases is not a remedy.

**What the gate does now.** The diff is split per file and packed into requests
under `PROMPT_BUDGET_CHARS`; each is reviewed and the findings merged and
deduplicated on the finding id. `--dry-run` prints the request count before
anything is spent, and warns when a span sits at `MAX_REVIEW_CHUNKS`.

**Nothing is truncated.** A silently shortened diff yields findings about a
fragment while reading as a review of the whole change. So a single file larger
than one request is reported unreviewed rather than cut mid-hunk, a chunk whose
call fails does not discard the chunks that succeeded, and the posted comment
carries a **Coverage** block naming every file that was not read — with the
statement that absence of a finding for an unreviewed path is not evidence
about that path.

**The budget is a character proxy.** The cap is enforced by the provider's
tokenizer, which this repository cannot run. `BUDGET_CHARS_PER_TOKEN` is
derived from the failures above (measured diff chars ÷ reported tokens ≈ 3.13
and 3.18) and set BELOW them, because the ratio is content-dependent: cl100k
over this repo's own diffs reads ~3.9 for `src/`, ~4.1 for `agents/` prose and
~2.75 for a lockfile. A call that still overflows a budgeted chunk falsifies
that number, not the partitioning — and fails gracefully, marking the chunk
unreviewed and continuing.

**What this does NOT fix.** Coverage is stated in prose; the exit code does not
fail closed on incomplete coverage, so an `--enforce` run over a partial review
can still return 0. The findings artifact carries `coverage`, but
`check_finding_dispositions --ingest` reads only `.findings`, so the durable
ledger does not yet record it.

## The teeth (defined + wired, not yet armed)

`self_review_gate.ts` exposes pure, unit-tested:

- `classifyBlocking(finding)` — a finding is merge-blocking **iff**
  `kind ∈ {security, claim}` **and** `severity ∈ {critical, high}`. Style and
  correctness findings, and low/medium security findings, advise only. (Council
  2026-07-08, claude-sonnet-4-5 + gpt-4o: a 100 %-blocking gate at
  solo-maintainer token cost gets ignored or gamed — block only on the narrow
  security/claim × high+ intersection.)
- `gateVerdict(findings, {enforce})` — mirrors
  `check_quality_regression.gateVerdict`: `0` pass / `2` block. Shipped
  `enforce: false` (advisory always returns `0` and reports the would-block
  set).

## Escalation on large / claim-affecting diffs

The two in-session lenses are a floor. A **large** diff (≥ 400 changed lines
across reviewable files) or one that touches a **claim-affecting surface**
(`docs/CLAIMS.md`, `docs/proof.md`, `docs/comparison.yaml`, or `README.md`)
warrants the full `ai-council` advisor panel — a spend-bearing multi-model run.

Per blocker `self-review-gate-cost`, the paid council stays governed by the
standing spend-authorization discipline **at run time**. So the gate does not
fire council calls itself: `escalationReasons(files, changedLines)` (pure,
unit-tested) DETECTS the condition, the dry-run plan prints it, and the posted
review RECOMMENDS a maintainer `/council:pr` run. Detection is deterministic
and zero-spend; the multi-model run is the maintainer's run-time act.

## Arming it (maintainer, one flip)

1. Add the `ANTHROPIC_API_KEY` repo secret (per-PR budget sign-off) — turns
   `live-advisory` from no-op into a real dogfooded review.
2. Pass `--enforce` in the live job to arm the teeth (block on
   security/claim × high+).
3. Require the `Self-review gate` check in branch protection
   (`road-to-maintainer-bus-factor` Phase 2) so even solo merges pass the gate.
4. Record the floor CLAIM on the proof page **once it is live** — not before
   (an inert gate is not a passed gate).

Blocker `self-review-gate-cost` (maintainer-owned) gates steps 1–2.

### Two correctness preconditions, open (recorded 2026-09-04)

That blocker settled **cost and authority**. Steps 1-2 above have a separate
**correctness precondition** that it never covered, and it is not met:

1. **The gate cannot tell a defect a diff INTRODUCES from one it DOCUMENTS.**
   Pull request #1839 changed six roadmaps and one evidence file — prose
   describing defects elsewhere in the tree, introducing none — and the gate
   reported ten findings, two of them `high (Blocking)` security, each mapping
   1:1 to a defect the diff *documents*. Under `--enforce` every analysis pull
   request would be blocked by the findings it was written to record, and the
   only way to pass would be to describe defects less precisely. The class is
   **not** prose-specific: finding `fec596e8beb4` on #1836 was reported against a
   `.ts` file, where the sole occurrence of the pattern in the diff was the
   already-landed fix commenting on what it had removed.

   An AI council (2026-09-04, 2 seats, 2 rounds, quorum 2/2) found **no cheap
   discriminator**; the three obvious candidates — non-prose paths, cite-a-changed-
   line, prose-advisory-code-blocking — all fail on that one code instance. The
   shared failure mode is causal misattribution: an added line may expose rather
   than cause, and a regression may arrive by deletion, configuration, or
   template.

2. **Finding ids are not stable across runs.** `finding_id` is
   `sha256(kind|title|file)`, so a reworded title mints a new id for the same
   defect. #1839 carries two machine blocks 3.5 minutes apart, ten findings each,
   **zero id overlap**, with eight of ten `(kind, file)` pairs shared. Since the
   consumer takes the last block, a ledger dispositioned against the first run is
   red against the second. This blocks enforcement independently of (1).

Until both are closed, `--enforce` stays off. A narrower pilot is defensible only
if named for what it is (`added-code security enforcement`), kill-switched,
override-audited, treating a malformed or duplicate result block as an
infrastructure failure rather than a quiet pass, and splitting `security` from
`claim` rather than enforcing the union.
