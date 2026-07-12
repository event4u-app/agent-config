# Artifact Drafting Protocol — Mechanics

> Phase A/B/C detail and the roadmap batch-mode carve-out for the `artifact-drafting-protocol` rule

_Origin: migrated from `src/rules/artifact-drafting-protocol.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, the trigger surface, and the golden rules stay in the rule; this file carries the per-phase procedure._

## Phase A — Understand

Ask up to **5** clarifying questions (numbered options, each with a
*"skip / I don't know yet"* escape):

1. **Problem** — what does this solve that no existing artifact solves?
2. **Trigger surface** — which user phrasings should fire this?
3. **Should-trigger examples** — 2-3 in the user's words.
4. **Near-miss cases** — 2-3 phrasings that must **not** fire.
5. **Artifact type** — skill, rule, command, or guideline? Offer a
   3-line primer if unsure.

If the user skips Q1 or Q5, stop and surface the ambiguity — don't guess.

## Phase B — Research

Run the **search protocol** from
[`learning-to-rule-or-skill` § 4](../../../src/skills/learning-to-rule-or-skill/SKILL.md)
— `ls` all four surfaces (`skills/`, `rules/`, `guidelines/`, `commands/`),
grep with **solution-words AND problem-words**, scan sub-directory
taxonomies, then **open and skim** the 3 nearest matches. A negative grep
alone is not proof of no overlap. Report the top 3-5 most-similar
artifacts and ask (numbered options):

- Extend an existing one?
- Create a new one — gap is real?
- Show overlap first?
- Promote via `learning-to-rule-or-skill` instead?

Carry the summary into the commit message (*"Reviewed before drafting:
X, Y"*).

## Phase C — Draft

Propose **2-3 description variants** — Conservative / Pushy
(per `skill-quality`) / Concrete (embedded trigger example). User picks
or merges. Only then draft the body. Surface every structural choice
(size class, section order) as numbered options if in doubt.

Enforce size live: *"Body is at 420/500 lines. Split?"* (budgets per
`size-enforcement`). New skills also get an `evals/triggers.json` stub
(5 should-trigger + 5 should-not-trigger). See `skill-writing` § 1c.

## Roadmap-run batch mode — the ONE structured bypass

When a `/roadmap:process-*` run starts under an **accepted execution
contract** (`roadmap-execution-contract`) whose pre-scan detected
artifact-authoring steps, the protocol runs in batch mode for exactly
those artifacts:

- **Phase B (Research) runs ONCE at contract time, against the CURRENT
  artifact state** — one overlap scan covering every artifact the
  roadmap plans; results (nearest matches, extend-vs-create verdicts)
  are surfaced inside the contract summary the user accepts. This is
  why authoring-time-only checking is not enough: a sibling roadmap may
  have landed overlapping artifacts between authoring and execution.
- **Phases A (Understand) and C (Draft) run non-interactively during
  the run** — the roadmap step text is the Understand input; the
  contract acceptance is the approval that the per-phase prompts exist
  to obtain.
- **Scope is the batch, nothing more.** An artifact NOT declared in the
  roadmap (discovered mid-run) triggers the full interactive protocol —
  or, under the contract, the scope-out-of-roadmap halt.
- Batch mode never skips the Research pass itself — it relocates and
  batches it. `artifact_protocol: skip` does not exist.

## See also

- `artifact-drafting-protocol` (rule) — Iron Law, triggers, golden rules.
- `ask-when-uncertain` · `improve-before-implement` · `user-interaction` · `skill-quality` — the protocol extends these; cross-link, don't restate.
