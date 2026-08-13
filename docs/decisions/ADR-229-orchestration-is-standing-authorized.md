---
adr: 229
status: accepted
date: 2026-08-13
decision: orchestration-is-standing-authorized
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Revisit when either (a) a consumer reports a worktree created unprompted that
  they could not trivially undo — which would falsify the reversibility premise
  the `worktrees.mode` flip rests on — or (b) a billable council run lands a
  spend the user did not expect while a ceiling WAS configured, which would mean
  the ceiling is not functioning as the standing authorization this record
  treats it as. Neither trigger is a date; both are observable from a single
  consumer report plus `~/.event4u/agent-config/council-spend.jsonl`.
---

# ADR-229 — Orchestration is standing-authorized; the bound moves from per-run approval to a ceiling

## Status

**Accepted** · 2026-08-13. Maintainer decision, requested directly.

## Context

Two shipped defaults made the user re-approve orchestration on every use:

- `worktrees.mode: ask` — the `using-git-worktrees` skill ran a per-creation
  permission ask, and `subagent-orchestration` mode 6 (`do-in-worktrees`)
  inherited it. Every parallel-work spawn cost a round trip.
- The `ai-council` skill's Procedure § 3 read **"Confirm spend. Before any
  network call … require an explicit user `1` to proceed. Autonomy settings do
  not override this gate."** Unconditional — it fired even when every configured
  member was `mode: cli` under subscription auth and therefore `billable=False`,
  i.e. when the projected spend was exactly $0.

The maintainer's report: the approval burden is the cost, not the orchestration.
Both defaults were set when the surfaces were new and the failure modes unknown.
Neither is a Hard-Floor surface — a worktree is local and reversible, and a
$0 council call moves no money.

## Decision

**1. `worktrees.mode` ships `on` instead of `ask`.**

`on` was already the documented "standing permission" value; `scope-control`
accepts a standing instruction as explicit permission, and the shipped default
now *is* that standing instruction. The Iron-Law gates the skill actually needs —
ignore-safety check, clean baseline — are unchanged and still run. `ask` and
`off` remain available; nothing was removed from the enum.

The reversibility premise is load-bearing and worth stating plainly: `git
worktree add` is undone by `git worktree remove`, touches no remote, and moves
no money. That is why this flip is a default change and not a Hard-Floor
question.

**2. The council's per-invocation spend confirmation becomes a bound, not an ask.**

Procedure § 3 now resolves in three cases:

| Situation | Behaviour |
|---|---|
| No billable member (all `mode: cli`, subscription auth) | No gate. Estimate rendered as information; fan out. Spend is $0. |
| Billable member **with** a ceiling (`cost_budget.max_total_usd` or `daily_limit_usd` non-zero) | No per-run ask. The ceiling **is** the authorization the user already gave. `on_overrun` still fires per member on breach. |
| Billable member with **no** ceiling (both `0` = both disabled) | Ask, as before. Nothing bounds the spend, so the user must. |

Consumers who want the old per-run gate set a small `cost_budget.max_total_usd`;
every call then breaches and `on_overrun` asks per member.

**3. `subagents.adversarial_council` stays `off` — deliberately excluded.**

This was in the original request and is being declined on evidence, not
preference. The pre-registered claim `adversarial-council-finding-coverage`
**resolved as an honest null on 2026-07-21** (`docs/benchmark.md`):

| quantity | value |
|---|--:|
| single-skeptic residual recall | 0.60 |
| 2-vendor panel residual recall | 0.60 (**zero lift**) |
| panel FP on correct-code controls | **1.00** |

The second vendor's catches were a strict subset of the first's. Both
pre-registered thresholds (+25% relative, +8 pp absolute) missed, and under the
adversarial-skeptic posture the panel false-flagged **all three**
controversial-but-correct controls. Per the locked pre-registration gate the
surface stays default-off **permanently**.

So this key is not an approval gate at all — it is a feature switch over a
measured-negative capability. Turning it on by default would spend money to
flag correct code on every high-risk change. `ask` is no better: offering a
100%-FP panel is an approval burden with a negative expected payoff, which is
the opposite of what this ADR is for.

**4. `ai_team.allow_delegate` stays `false` — different axis.**

It grants an external tool **write access to the repository**. That is not
"may the agent orchestrate", and it was scoped out of this decision explicitly.

## Consequences

- A fresh install spawns worktrees without prompting. `agent-config settings:get
  worktrees.mode` reports the value and its layer; one key reverts it.
- A council run against subscription-authed members is now silent end-to-end.
- **A permissive default was made permissive on purpose.** `settings-ask-protocol`
  carries the line *"A SILENT PERMISSIVE DEFAULT IS A DECISION TAKEN IN THE
  USER'S NAME. NEVER TAKE ONE."* That Iron Law binds the **agent** picking a
  default mid-run; this is a maintainer changing a shipped default, recorded
  here so it is not silent. The distinction is the whole reason this record
  exists rather than a bare diff.
- The class-B conservative-default invariant is **not** touched: both keys are
  class C, and that invariant is scoped to B (`settings-classes.md` § 88). No
  linter enforces conservative defaults for C — verified, not assumed.
- With `worktrees.mode` no longer shipping `ask`, **no** shipped default routes
  a question through `settings-ask-protocol`. The whole class-C ask path is now
  opt-in. The protocol is unchanged; its shipped surface is simply empty.

## Alternatives considered

- **Flip `adversarial_council` to `on` as originally asked.** Rejected on the
  benchmark above. Recorded rather than silently dropped, per
  `decision-revisit-gate`.
- **Add a new `ai_council.confirm_spend` key.** Rejected: `cost_budget` already
  expresses the bound, and a second control over the same money would be two
  sources of truth.
- **Remove the council spend gate outright.** Rejected: a billable member with
  no ceiling has nothing bounding it, and autonomy is not a ceiling.

## References

- `src/config/agent-settings.template.yml` — both keys, with the YAML-quoting note.
- `src/server/schemas/settings.ts` — the zod defaults.
- `src/skills/ai-council/SKILL.md` § Procedure 3 — the three-case bound.
- `src/skills/using-git-worktrees/SKILL.md` § 0 — the pre-flight table.
- `docs/benchmark.md` § adversarial-verification-council finding coverage — the null.
- `docs/contracts/settings-classes.md` — class C, and the B-only invariant.
