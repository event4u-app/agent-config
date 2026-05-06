# Package Optimizer — design poll

## Context

`event4u/agent-config` ships a governed agent-config suite with ~134 skills,
~55 rules, ~94 commands, and a growing `agents/contexts/` knowledge layer. The
maintenance surface is real: rules drift, skills overlap, commands fragment,
contexts go stale. Today the optimization tooling is **siloed by artifact
type**:

- `/optimize skills` — duplicates + sizes inside `.agent-src.uncompressed/skills/`
- `/optimize agents` — token overhead of always/auto rules + AGENTS.md
- `/optimize augmentignore` · `/optimize rtk` — ignore/filter tuning
- `skill-reviewer` skill — 7 Skill Killers per single skill
- `skill-management` skill — compress/expand/refactor a single skill
- `rule-compliance-audit` skill — rule trigger quality + activation simulation
- `preservation-guard` rule — quality floor for merge/refactor (Iron Laws stay)
- `lint_rule_interactions.py` — validates rule-pair conflict matrix
- `skill_linter.py` — frontmatter/section/exec-metadata validation

**The gap:** no single audit detects **cross-artifact-type contradictions**
(rule X says A, skill Y dispatches B), no single tool produces a **deletion
candidate list with per-file rationale**, and no entry point asks the user
**up front** "do we even hunt for stuff to delete?" Today's flow forces 4
separate sub-command invocations; the maintainer has to mentally join.

The ask: a `package-optimizer` (skill, command-cluster, or both) that
audits the whole package or a single artifact, detects duplicates +
overlaps + contradictions across types, classifies low-utility assets as
deletion candidates, and gates AI Council use. Must work on this package
AND on consumer projects (per `augment-portability`). `preservation-guard`
floor stays absolute — Iron Laws never delete, regardless of council vote.

## Q1 — Architecture: where does this live?

Pick the shape that minimizes overlap with the existing `/optimize` family
and `skill-{reviewer,management}` skills, while delivering the cross-artifact
audit the existing tools cannot.

- **(a)** Single new **`package-optimizer` skill**, no command. Loaded by
  trigger description. Sub-procedures inline (`audit`, `dedupe`, `prune`).
- **(b)** Extend `/optimize` with a new sub-command **`/optimize package`**.
  Routes to `commands/optimize/package.md`, dispatches to existing skills
  (`skill-reviewer`, `rule-compliance-audit`) for per-type passes; adds a
  cross-artifact pass for contradictions + deletion-candidate scoring.
- **(c)** **Both** — skill + command. Skill is the consultable handbook
  (decision tree, ICE rubric, council-prompt templates, deletion gate).
  Command is the executable orchestrator that drives the skill's procedure
  on a target (file, dir, whole package). Skill answers "how do I think
  about this?", command answers "run it now".

Pick one + 1-line rationale. State which existing skill/command becomes
redundant or shrinkable if your pick lands.

## Q2 — Deletion gate: how to ask, classify, decide

The user explicitly required: "Initial wird aber erst einmal gefragt, ob auch
zu löschende files gesucht werden sollen. Ansonsten können wir uns den
Schritt eh sparen." Plus per-file decision: bulk-delete OR per-file
description + keep/drop. `non-destructive-by-default` Hard Floor applies —
no deletions without `this-turn` confirmation, no `git rm` of >5 unrelated
files in one shot.

- **(a)** Single up-front prompt: "Hunt for deletion candidates? [y/n]"
  → if no, skip the whole prune pass. If yes, produce a ranked list with
  ICE-style scoring (Impact = removed-load × redundancy, Cost = breakage
  risk, Effort = cite-count to clean up). Then second prompt: "Bulk delete
  the top-N OR walk through one-by-one?"
- **(b)** Two-pass: pass 1 surfaces "obvious" deletion candidates (zero
  inbound references, last-touched > 6 months, lint-FAIL since 3 commits)
  with no prompt — they appear as a default-collapsed section. Pass 2 asks
  the per-file question only on borderline candidates.
- **(c)** Three-tier: tier-S (zero refs + zero downstream impact, surface
  silently in summary), tier-A (low refs but plausible value, ask per-file),
  tier-B (load-bearing but redundant, council-vote required). Bulk delete
  forbidden by construction — Hard Floor protection.

Pick one + state the **default behavior when AI council is OFF** (council
gate must not block the audit, only gate tier-B).

## Q3 — AI Council integration

The user wants Council use to be **opt-in initially** — "Er kann ja initial
danach fragen ob er das nutzen soll. Aber für den skill ist es definitiv
sinnvoll." Also: must work without council (some maintainers don't pay for
multi-AI polls).

- **(a)** Council always-prompted at audit start: "Use AI council for
  contradiction-resolution + tier-B deletion votes? [y/n]" Default = no
  unless `ai_council.enabled: true` in `.agent-settings.yml`.
- **(b)** Council never-prompted, only triggered automatically on
  contradictions where the skill cannot resolve from the contract matrix
  (`docs/contracts/rule-interactions.yml`). Logs cost estimate before
  invoking; aborts if estimate > $0.10 without explicit `--council` flag.
- **(c)** Council prompted only at tier-B/contradiction surfaces, NOT at
  audit start. Audit always runs deterministic-first; council only fires
  when the deterministic pass produces a flagged-for-judgment list.

Pick one + state how the council vote is **made auditable** (where the
question + responses land — `agents/council-questions/` pattern stays?).

## Q4 — Net-new candidate (max one)

If you see ONE Tier-S item this design is missing — a guard, a check, a
template, a rule — name it (≤2 sentences) with ICE estimate. If none worth
adding, write "no Tier-S net-new" and move on. (We had Sonnet's telemetry-
stub move on the token-optimizer plate; same shape here.)

## Output discipline

- Pick ONE option per Q1/Q2/Q3 — no "depends".
- 1–3 sentence rationale per pick.
- Total budget: ≤3500 tokens per member.
- Cost-aware: this poll is the architecture-shaping moment, not a debate
  on Iron Laws — those are locked.
