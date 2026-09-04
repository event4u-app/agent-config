<!-- evidence-type: analysis -->
# Inbox round `inbox-2026-09-d` — verification and disposition

One set, nine files, ~100 KB. The artefacts were drafted against
`main@022c0d24`; the whole 2026-09-c drain merged in between, so every claim was
re-checked against `main@46022ddd8` and two were overtaken by it. Three roadmaps
were written. The set's own central finding is owner-reserved and is recorded
below rather than planned.

## The set's discipline, stated because it changes how it was read

Unlike the previous round, this one is defect-first by construction: it carries
a kill register that removed its own first ideas against existing inventory
(`ai-code-blindspots` already exists, `build_proof.ts` already shipped), it
degrades one item to an owner decision rather than planning past a recorded
boundary, and it recommends folding rather than six new stems. That did not
exempt it from verification — one of its proposals is refuted by a decision
already in the tree, one of its counts is wrong, and two of its defects were
closed by a drain that landed after its pin.

## Verified, and carried into a roadmap

| Claim | Verdict | Evidence at `46022ddd8` |
|---|---|---|
| No deterministic tamper/cheat detector | **still-true** | `ls src/scripts/` matches nothing for `tamper`/`cheat`/`fake`; `verify-repair-loop/SKILL.md:54` says an agent can "skip assertions, weaken checks — and still hit the threshold" and `:185` that "the numeric gate cannot catch this" |
| Canonical test-smell names absent | **still-true** | `grep -ricE 'assertion roulette\|magic number'` over `src/skills/testing-anti-patterns/` → 0 |
| No error-swallow diff check | **still-true** | `ls src/scripts/` matches nothing for `swallow` / `bare_except`; prose coverage exists in three skills |
| `threats.csv` blind to IaC | **still-true** | `surfaces.csv` carries 9 surface classes, all application-level; `threats.csv` carries 15 rows across the same 9; `grep -icE '0\.0\.0\.0\|security group\|cidr'` → 0 |
| `terraform` covers pinning, not permissiveness | **still-true** | `:51` "Always pin provider versions"; `grep -c '0\.0\.0\.0'` → 0 |
| `aws-infrastructure` has no least-privilege content | **still-true** | `grep -icE 'least.privilege\|Action: ?\*\|Resource: ?\*'` → 0 over 157 lines |
| No plan-scoring rubric | **still-true** | `grep -ricE 'necessity\|sufficiency\|groundedness\|premature\|scope creep'` over `feature-planning/` + `complexity-first-planning/` → 0 |
| Render surface has no state rows | **still-true** | `ai-code-blindspots/SKILL.md:50` is all security controls; `grep -icE 'empty state\|loading state\|error state'` → 0 |
| Transactional email uncovered | **still-true** | only `outlook` hit is `humanizer/data/patterns.md`; `laravel-mail` carries one generic line at `:173` across 204 |

## Overtaken by the 2026-09-c drain

- **WCAG 2.2 criteria missing from `accessibility-auditor`.** Closed:
  2.4.11 and 3.3.8 now resolve. `road-to-declared-coverage-truth` landed in
  PR #1831 and is archived. The item is prevented rather than planned.
- **The finding-disposition ingest is manual and the ledger empty.** Half
  closed: `agents/evidence/release-findings/14.15.0.json` exists and the
  authorization defects are fixed (`road-to-binding-findings`, PR #1834,
  archived). The other half — the ordering race that made the gate green — was
  deferred with `carried-to=road-to-release-finding-ordering` and now sits at
  `agents/roadmaps/later/road-to-release-finding-ordering.md`. The deferral is
  reasoned: the two workflows are separate files so `needs:` cannot express the
  dependency, and the demonstration requires a synthetic `release/*` branch,
  which is Hard-Floor gated. `release-validation.yml` is byte-identical to the
  version that produced the false green, which is the expected state of a
  carried step and is recorded here so the next reader does not re-derive it.

## Corrected

- **Cyclomatic complexity delta — refuted by the tree.** The set proposes
  flagging a pull request that raises a function's cyclomatic complexity by
  three. `src/scripts/_lib/bench_ab_complexity.ts:32` rejects cyclomatic by
  name — "it scores a flat `switch` above a triply-nested `if`, so it cannot
  detect golfing" — and implements cognitive complexity over the tree-sitter
  pair instead, having walked the alternatives ladder to get there. Not
  adopted; a future complexity-delta signal reuses that module.
- **Flaky mentions: fifteen skills, not six.** `grep -rli 'flaky' src/skills/`
  returns 15. The substantive half holds:
  `docs/contracts/evidence-artifact-types.md` carries no repeat-run evidence
  mode, so a test that passes on the second attempt has nowhere to be recorded
  as anything but green.

## Found here, not in the source

`docs/CLAIMS.md:215` retires `claim:no-runtime-daemon` with
`retires_phrasings: zero runtime daemon | no background daemon` — two literal
strings. `README.md:486` publishes "**Zero overhead by default** — nothing runs
until you ask for it", which asserts a property stronger than the retired one
and is contradicted by the successor entry recording that a supervised resident
process is permitted under ADR-249. It survives the retirement because it shares
no substring with either phrase. Carried by `road-to-checklist-rows` Phase 4,
together with the honest statement of what a substring list can reach.

## The ninth arrival — owner-reserved, and the hold has not held

The set's leading finding is that the tree covers most researched failure modes
in content and reaches nobody with them: skill activation "separately measured
and is near zero" (`docs/CLAIMS.md:240`), the delivery projection measured at
$0.73 against $4.03 per session with the shipped default still `eager-all`
(`docs/CLAIMS.md:357`, `src/scripts/_lib/lean_projection_mode.ts:21`), and a
trigger corpus at 100 of 299 skills. All four re-verified at `46022ddd8`.

This is owned. `agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md`
was added on 2026-08-19 — **16 days parked** — and is held by two blockers,
`b-matrix-semantics-amendment` and `b-behavioural-bench-spend`. The second is
spend-bearing and therefore owner-reserved; no agent lifts it.

**A grep over `agents/tmp.old/` for the "near zero" activation line matches
eight earlier rounds** (`agent-config-fremon-harvest`, `elder-OBLITERATUS.txt`,
`fix-token-problem.txt`, `improve-frontend`, `inbox-2026-08-g`,
`inbox-2026-09-b`, `road-to-10`, `skill-retrieval-mcp`). This is the ninth. Per
`recurring-criticism` that is evidence about the disposition rather than about
the item: parking was a defensible decision each time, and nine arrivals mean it
has stopped being an answer. Which of the three outcomes applies — the
disposition was wrong, or it was right and unrecorded, or right and unreachable
— is the owner's call, because the blocker holding it is one an agent may not
lift. It is stated here so the tenth round meets a count rather than a fresh
argument.

## Declined

- **A dedicated tamper-detector import.** The source names two field tools as a
  vocabulary reference. Only the specification is reused; no detector code is
  adopted, per `code-provenance` and the source-silence boundary.
- **A duplication-delta check in any form.** `docs/CLAIMS.md:417` registers as
  falsification criterion (4) that no user-facing surface may assert a
  CI-facing similarity or duplication detector — council 2026-07-28, K1 Option
  A — and `license-compliance-audit/SKILL.md:4` states it is the only home of
  that capability with no CI gate. The source correctly degrades this to an
  owner decision about the boundary's scope; that decision is not taken here.
- **AI-provenance routing for IaC diffs.** The source itself killed it in its
  third loop as a new dark instrument colliding with the attribute-based
  execution-authority model. Recorded so it is not re-proposed.
