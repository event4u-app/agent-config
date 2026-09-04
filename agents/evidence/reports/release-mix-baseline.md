<!-- evidence-type: analysis -->

# Release governance-versus-product mix — the first two readings

> **These are levels, not verdicts.** No threshold is committed to this
> repository and none may be set from these two numbers. Both AI-council seats
> refused to pick a threshold on fewer than two readings, and one asked for four
> to five before the conversation is even had. Read
> [`ADR-253`](../../../docs/decisions/ADR-253-per-pr-user-artefact-gate-declined.md)
> before quoting a ratio from this page.

Measured 2026-09-04 at `b75d7f7cb` with
`src/scripts/measure_release_mix.ts` (classifier 1.0.0) against
`src/scripts/release_mix_taxonomy.json` (taxonomy 1.0.0). Machine-readable
readings: `release-mix-14.15.0.json`, `release-mix-14.16.0.json`.

Reproduce:

```bash
./scripts-run src/scripts/measure_release_mix --from 14.14.1 --to 14.15.0 --label 14.15.0
./scripts-run src/scripts/measure_release_mix --from 14.15.0 --to 14.16.0 --label 14.16.0
./scripts-run src/scripts/measure_release_mix --audit
```

## Reading 1 — 14.15.0 (`a3a14d535..c9f32f39f`, no-merges)

| View | consumer | governance | maintenance | mixed | unclassified |
|---|---|---|---|---|---|
| Commits | 1 | 3 | 0 | 6 | 0 |
| Lines added | 478 | 369 | 1650 | — | 0 |
| Lines deleted | 13 | 21 | 58 | — | 0 |

Mixed breakdown: `consumer+maintenance` 4, `governance+maintenance` 1,
`consumer+governance+maintenance` 1. Generated-only commits: 0. Commits
carrying an unclassified path: 0.

**Response obligation: owed.** Governance-only 3 > consumer-only 1.

## Reading 2 — 14.16.0 (`c9f32f39f..9d6ad7fc6`, no-merges)

| View | consumer | governance | maintenance | mixed | unclassified |
|---|---|---|---|---|---|
| Commits | 6 | 16 | 4 | 8 | 0 |
| Lines added | 450 | 2706 | 1371 | — | 0 |
| Lines deleted | 201 | 159 | 65 | — | 0 |

Mixed breakdown: `consumer+maintenance` 7, `consumer+governance` 1.
Generated-only commits: 1. Commits carrying an unclassified path: 0.

Largest contributors — consumer: `docs/contracts` 26, `src/skills` 6,
`docs/setup` 2. Governance: `agents/roadmaps` 10, `agents/evidence` 8,
`docs/contracts` 4. Maintenance: `src/scripts` 6, `tests/scripts` 5.

**Response obligation: owed.** Governance-only 16 > consumer-only 6.

## What the two readings say, and what they do not

Both spans trip the obligation, and 14.16.0 trips it by a wide margin on the
line view as well: governance added 2706 lines against consumer's 450. The
external reviewer's concern is therefore **substantiated by the measurement
that replaced the reviewer's proposed remedy** — the decline in ADR-253 is of
the mechanism, not of the concern, and stating that plainly is the point of
publishing rather than merely deciding.

What they do not say: nothing here establishes a variance, a trend, or a
correct ratio. Two points are a level. Commit counts are sensitive to squashing
and commit hygiene, which is the strongest argument against acting on either
number, and it is the reason the response obligation is about a written answer
rather than about a threshold.

Neither reading was taken with the metric visible to the contributors who
produced the span. Both are **retrospective baselines**, and the biases that
carries are named in the convergence below.

## Council convergence — inlined, not linked

`agents/runtime/council/` is gitignored and auto-pruned, so no tracked file may
cite a path there. The convergence is recorded here instead.

**Round 1 — the decline.** 2026-09-04 · anthropic/claude-sonnet-4-5 +
openai/codex-default · 2 rounds · quorum 2/2 · $0.00 (both seats
subscription-authed). Verdict: the per-PR user-artefact gate is **declined**,
2/2, on two grounds both seats reached independently — it measures packaging
rather than progress, and it rejects legitimate work by construction. Both
replaced it with the same shape: classify at release level, publish two views,
attach a mandatory response, refuse a threshold on one cycle.

**Round 2 — the implementation.** 2026-09-04 · same seats · 2 rounds · quorum
2/2 · $0.00. Four questions, four convergent answers:

- **Shape.** Script plus tracked JSON and report; **no CI workflow**. Both:
  a gate with no threshold is either a no-op or a smuggled threshold.
- **Where the obligation lives.** The changelog contract plus the existing
  highlights checker, **not** a new rule under `src/rules/`. A rule fires on an
  agent's prompt; a release is cut by a script and reviewed by a human.
- **Retrospective baselines.** Permitted, with the taxonomy locked before the
  numbers are computed. codex named four biases a retrospective reading carries
  that a prospective one does not — taxonomy-selection (the categories were
  designed with some knowledge of the history), history-shape (squash and
  commit-splitting practice already fixed the commit view), survivorship, and
  the absence of a behavioural response from contributors who could not see the
  metric. Both seats still preferred publishing now over waiting two cycles.
- **Categories.** `docs/contracts/` splits (consumer by default, with a named
  governance-exception list) rather than being assigned wholesale, which would
  systematically undercount shipped work. `src/scripts/` splits via an explicit
  consumer allowlist, because one bucket over 1351 files would dominate every
  reading. Generated projections are excluded from **both** views, with a
  separate `generated_only` diagnostic. `unclassified` is first-class and does
  **not** by itself make a commit `mixed` — conflating taxonomy uncertainty with
  genuine cross-category work would hide both.

**Where the seats did not converge**, recorded rather than smoothed over:

- **The `consumer` label.** codex asked for `shipped-product` or
  `shipped-surface`, on the ground that shipping a rule is observable while
  delivering consumer value is not. anthropic preferred keeping `consumer` for
  consistency with the roadmap's own wording. The roadmap's wording is kept and
  the objection is recorded in the taxonomy file's `note`.
- **Unmatched `src/scripts/` paths.** codex wanted them `unclassified` and shown
  prominently; anthropic wanted them `maintenance`. Implemented as
  `maintenance`, because a 1086-file `unclassified` bucket would make the
  reading useless — which is codex's own distortion concern, inverted. The
  volume is shown prominently instead, via the largest-contributor diagnostic.
- **How many readings before a threshold.** codex said two permit discussion;
  anthropic asked for four to five before the conversation. The stricter
  reading is adopted: nothing authorises a threshold after the second reading.

## Taxonomy audit

`measure_release_mix --audit` at `b75d7f7cb`: **9337 tracked paths over 90
classification units, 0 unmatched.** One unit resolves to a deliberate
`unclassified` (`src/shared/`, 13 files) — genuinely shared between the shipped
runtime and the repository's own automation, and left visible rather than
assigned.
