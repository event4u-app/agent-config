---
complexity: lightweight
status: ready
execution:
  mode: autonomous
---

# Road to weighted decision matrix — quantitative mode for `decision-record`

> Give the decision cluster the one mechanic it lacks — user-weighted criteria
> × option scores with sensitivity analysis and an argue-against-the-winner
> pass — as a mode inside `decision-record`, not as a new skill.

## Goal

Extend `src/skills/decision-record/SKILL.md` with an optional quantitative
weighted-matrix mode (elicit-user-first criteria + weights 1-10, fixed-anchor
scores 1-10, weighted sums, flip-threshold sensitivity block, argue-against
delegation to `adversarial-review`), cross-linked into the existing decision
cluster, with zero new skill files and zero README-count changes.

## Context

Origin: a user-provided article + prompt on weighted decision matrices
(System-1/System-2 framing, anti-recency and anti-confirmation-bias steps),
2026-07-19. An overlap scan confirmed the combined mechanic exists nowhere in
the suite: `decision-record` has a qualitative trade-off matrix (no weights,
no sums), `rice-prioritization` multiplies numbers but with a fixed formula,
`adversarial-review` owns the attack step. A research pass added the
methodology guards prior art carries (sensitivity/flip analysis,
criteria-independence check, fixed anchors, when-not-to-use gate) and the
anchoring evidence for user-first elicitation.

### Council notes (2026-07-19, 2 members: anthropic/claude-sonnet-4-5, openai/gpt-4o, 2 rounds)

- **Convergence: no standalone skill.** Round 1 split (one member: standalone
  skill; one: reject entirely). Round 2 converged on rejecting the standalone
  shape — maintenance surface, fighting trigger surface with
  `decision-record`/`rice-prioritization`, and duplication.
- **Dissent preserved:** one member rejects the mechanic in any form
  ("pseudo-precision": user-guessed scores × user-guessed weights; a ±1 score
  change can flip a close winner). Mitigations encoded below: sensitivity
  analysis is the load-bearing quality gate (not the argue-against step),
  fixed anchors are mandatory, a when-NOT-to-use gate front-runs the mode,
  and the output is framed as "a structured argument, not a verdict"
  (the `rice-prioritization` framing).
- **Elicitation order verdict:** user defines criteria + weights FIRST; AI
  supplements afterward, labeled as AI-suggested. The original proposal
  (AI proposes 5-7 criteria first) is overruled by the anchoring evidence.

### Gap-table (KEEP / FOLD / CUT) — proposal vs existing surface

| Proposal element | Verdict | Where |
|---|---|---|
| Options × criteria matrix, weights 1-10, scores 1-10, weighted sums | **FOLD** | Quantitative mode inside `decision-record` |
| Criteria defined before scoring (anti-recency) | **KEEP** | Mode procedure step |
| AI proposes 5-7 criteria first | **CUT** | Replaced by user-first elicitation (anchoring evidence, council verdict) |
| Argue against the winning option | **FOLD** | Delegate to `adversarial-review` (the `premortem` delegation pattern) — scoped to the top-scoring row |
| Intuition caveat ("inner resistance = wrong weight or unquantified info") | **KEEP** | Mode output contract |
| Standalone skill / standalone prompt | **CUT** | Council convergence: extend, don't add |
| Sensitivity/flip analysis, fixed anchors, criteria cap 4-8 + independence check, when-not-to-use gate | **KEEP** (added from research, absent in proposal) | Mode must-haves |

### Provenance

Primary source is the user-provided article in chat (2026-07-19) — user-owned
content, no external attribution required. External references consulted
during research (a public decision-matrix skill; devil's-advocate LLM
studies; Lord/Lepper/Preston 1984 "considering the opposite") are cited by
neutral descriptor; raw links live only in the local, gitignored council
question file.

## Prerequisites

- [x] Confirm `src/skills/decision-record/SKILL.md` current structure and size headroom (target ≤ 1200 words after edit; if the mode pushes past, extract the mode body to a `references/` file per skill-writing conventions). <!-- verify: wc -w src/skills/decision-record/SKILL.md --> <!-- outcome: baseline was already 1280 words; mode body extracted to references/weighted-matrix.md, SKILL.md carries the compact gate+procedure (1516 words) -->

## Phase 1 — Quantitative weighted-matrix mode in `decision-record`

- [x] Add a `## Weighted-matrix mode (quantitative)` section to `src/skills/decision-record/SKILL.md` with the mode gate: fire only when ALL hold — ≥ 3 options, no single dominant criterion, decision is costly/hard to reverse, criteria are commensurable (no values conflict). Otherwise stay in the default qualitative flow; 2-option or reversible decisions get a one-line "just decide / use the qualitative matrix" redirect.
- [x] Encode the procedure: (1) user states decision + options; (2) user lists criteria and weights 1-10 BEFORE any scoring — AI may append missed criteria afterward, each labeled `(AI-suggested)`; (3) criteria hygiene — cap 4-8, merge near-synonyms (double-counting check); (4) score options 1-10 against FIXED anchors (each criterion gets an explicit anchor line: what 1 means, what 10 means — never relative-to-best-in-set); (5) compute weighted sums.
- [x] Encode the sensitivity block as the load-bearing gate: report close-call margin (< 10 % = "no clear winner — the matrix says the options are equivalent, decide on unquantified factors"), the smallest single weight change that flips the winner, and the ±1-score flip test. A fragile winner is surfaced as fragile, never as "the rational choice".
- [x] Encode the argue-against step: after the sums, delegate an attack on the top-scoring option to `adversarial-review` (scoped: "attack the winner, using the losing options' strongest criteria"), mirroring the `premortem` delegation pattern — do not reimplement the attack loop inline.
- [x] Encode the output contract: matrix table + sensitivity block + attack summary + the intuition caveat verbatim in spirit ("the matrix complements intuition; resistance to the result signals a wrong weight or unquantified information — surface it, don't ignore it") + the framing line "the score is a structured argument, not a verdict"; close with the existing `decision-record` hand-off to `adr-create` for durable capture.
- [x] Run the skill linter on the touched skill. <!-- verify: ./scripts-run src/scripts/skill_linter src/skills/decision-record/SKILL.md -->

Exit criteria: `decision-record` SKILL.md contains the mode with gate,
user-first elicitation, fixed anchors, sensitivity block, delegation, and
output contract; skill linter reports 0 FAIL for the skill.
Rollback: revert the single SKILL.md edit.

## Phase 2 — Cluster routing and cross-links

- [x] Update `decision-record` frontmatter description/triggers to cover the quantitative ask ("weighted decision matrix", "gewichtete Entscheidungsmatrix", "score my options") without stealing `rice-prioritization` triggers.
- [x] Add reciprocal WHEN/WHEN-NOT routing lines: `rice-prioritization` (many items to rank on the fixed R×I×C/E formula → RICE; one choice with custom criteria → decision-record matrix mode), `stakeholder-tradeoff` (who pays vs which option wins), `adversarial-review` (receives the scoped attack delegation), `build-buy-partner` (domain-specific instance stays as-is).
- [x] Reference-check the touched files. <!-- verify: ./scripts-run src/scripts/check_references -->

Exit criteria: all four sibling artifacts carry a reciprocal routing line;
check_refs green.
Rollback: revert the cross-link hunks; Phase 1 mode remains functional
without them.

## Phase 3 — Evals and trigger hygiene

- [x] Extend `src/skills/decision-record/evals/triggers.json` with 5 should-trigger cases for the quantitative ask (incl. one German phrasing and one "help me decide between 4 job offers" consumer shape) and 5 should-not cases (RICE-shaped backlog ranking, 2-option reversible choice, stakeholder-conflict shape, pure prioritization, a request that names `rice-prioritization`).
- [x] Validate eval JSON shape against existing eval files. <!-- verify: npx tsx -e "JSON.parse(require('fs').readFileSync('src/skills/decision-record/evals/triggers.json','utf8'))" -->

Exit criteria: triggers.json parses and carries the 10 new cases.
Rollback: revert the evals file.

## Phase 4 — Condense and projection sync

- [x] Condense the touched sources and sync projections for the changed skill (per `source-of-truth`; use the `/condense` flow — changed-files scope, then mark-done). <!-- carve-out: new-gate-verification -->
- [x] Confirm no stale condensation remains. <!-- verify: bash src/scripts/condense.sh --changed -->

Exit criteria: `condense.sh --changed` reports nothing stale; projections
(`dist/agent-src/`, `.claude/skills/`) carry the mode.
Rollback: regenerate projections from the reverted `src/`.

## Acceptance criteria

- [x] No new skill file, no new pack, no README badge-count change — the capability ships entirely inside `decision-record` (anti-dump criterion; council convergence honored).
- [x] The mode is unreachable for 2-option/reversible/values-conflict decisions (gate text present) and never presents a < 10 %-margin winner as a verdict.
- [x] The argue-against step is a delegation to `adversarial-review`, not an inline reimplementation.
- [x] Skill linter + check_refs green on the diff scope.
