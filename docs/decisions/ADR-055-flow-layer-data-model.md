---
adr: 055
status: proposed
date: 2026-06-06
decision: flow-layer-data-model
supersedes: —
superseded_by: —
phase: v6.1 · product consolidation (Step 8b)
type: structural
---

# ADR-055 — The flow-layer data model: a schema + validate-on-load lint, not a live resolver

## Status

**Proposed** · 2026-06-06. Drafted for maintainer review (design-first), as the
data-model foundation for road-to-6.1.0 Step 8b. Routed through the AI council
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode, deep) — convergence
recorded under *Council convergence* below.

## Context

`Profile → Pack → Flow → Command → Skill → Rule` is the layered model the
6.1.0 consolidation is built around. Four flows were scaffolded as inert stubs
in 6.0.0-D Step 15b (`src/flows/{discovery,implementation,review,delivery}.yaml`),
each carrying only `id` / `title` / `summary` / a `commands:` seed lifted from
the command-classification worksheet `·_flow:` tags. They were "parsed by
nothing" — documentation, not data.

Step 8b's job is narrow: **make a flow a real, validated artefact** — define the
schema for the three activation fields (`entry_points`, `default_path`,
`skills`) and lint that every reference resolves. This is explicitly *not*
Step 9 ("make the flow the primary view of the command surface"), which the
prior 6.1 council flagged HIGH-risk and deferred to land last. Step 8b is the
data-model floor Step 9 stands on.

A prior council round (deliberating whether `process-full` should proceed at
all now that PR2 merged) raised a hard objection: **you cannot write a flow
schema before the data model exists**, and "stub file existence ≠ structure
defined." This ADR answers that objection by *defining and committing to* the
data model here — not merely writing it down, but binding it to a stated Step 9
scope so the schema encodes a decided structure, not a guessed one.

**Committed Step 9 scope (the schema is designed for exactly this):** "Primary
view" means flows become the **first-class navigation surface** — the agent
surfaces the four flows, lets the user pick an `entry_point`, and presents the
`default_path` as a *suggested* command sequence with the flow's `skills` as
context. Step 9 does **not** execute flows as branching workflow graphs (no
conditional `transitions`, no automated skill invocation). Flows are **curated,
navigable command lists**, not workflow engines. The three activated fields are
sufficient for that scope, as this usage sketch shows:

```python
flow = load_flow("discovery")                 # id/title/summary + 3 fields
show_menu(flow["entry_points"])               # daily front doors
chosen = user_pick(flow["entry_points"])
for cmd in flow["default_path"]:              # suggested sequence (not auto-run)
    suggest(resolve_command(cmd))
surface(flow["skills"])                        # contextual help
```

If Step 9's scope later widens to executable graphs, that is a **schema v2**
event with a migration plan (see *Consequences*), not a silent in-place change.

**Verified facts (this branch):**

- Skills resolve at `src/skills/<slug>/SKILL.md` (223 skills); commands resolve
  via `resolve_logical("commands/<ref>.md")` in `src/scripts/_lib/agent_src.py`,
  which maps a logical command path to its physical backing (top-level stem or
  `cluster/sub`). Every command + skill referenced by the four populated flows
  resolves (verified: zero misses).
- The established schema home is `src/scripts/schemas/` (`pack.schema.json`,
  Draft-07), validated by `validate_pack_yaml.py` with a **shape-vs-resolution
  split**: the JSON Schema fixes shape; the Python lint resolves references.
- The worksheet/flow seeds use future-canonical names (`git-commit`,
  `git-pr-create`). Per `pack.schema.json`'s own `$comment`, those are pack
  `slug_prefix` *projections* (the `git` pack with `slug_prefix: git` projects
  `commit` → `git-commit`) that land with Step 8 — they do **not** resolve in
  the current layout.

## Decision

1. **Schema fixes shape; the lint enforces referential integrity.** Mirror the
   `pack.schema.json` + `validate_pack_yaml.py` split. The JSON Schema
   (`flow.schema.json`, Draft-07) requires `id`, `title`, `summary`,
   `entry_points`, `default_path`, `skills`; `commands` stays optional
   (descriptive seed). The schema validates slug/path *shape* only.
   `lint_flows.py` validates that every `entry_points` / `default_path` /
   `commands` entry resolves to a real command, every `skills` slug to a real
   skill, the `id` equals the filename stem, the `id` is in the closed flow set,
   and all four flows have a file. Errors are **granular and partial** — each
   unresolved ref is its own line (not a generic "flow invalid"), with a
   `difflib` "did you mean 'X'?" hint when a near-match exists. The `commands`
   field stays optional and descriptive (the worksheet seed); Step 9 decides
   whether to require it, drop it, or keep it as a human-readable index — Step 8b
   does not force that call.

2. **Schema location follows the repo convention, not the roadmap's literal
   path.** Every JSON Schema in this repo lives in `src/scripts/schemas/`
   alongside its validator (`pack.schema.json` + `validate_pack_yaml.py`); none
   live at `src/schemas/`. Step 8b's prose said `src/schemas/flow.schema.json` —
   almost certainly a path slip, since that directory holds no schemas. The file
   lands at `src/scripts/schemas/flow.schema.json` next to `pack.schema.json`.
   (Deviation noted so the roadmap text is not read as a contradiction.)

3. **The flow set is closed and curated `{discovery, implementation, review,
   delivery}`.** Enforced by the lint, **not** a schema `enum` — not because
   enums are "brittle" in the abstract, but for two concrete reasons: (a) the
   lint gives a readable "id 'x' not in {…}" error instead of a generic
   schema-enum failure that reads as "malformed YAML"; (b) a developer can author
   an experimental flow on a local branch without the schema rejecting the file —
   the lint blocks it at PR time. `agent-admin` is **not** a flow (feedback-6):
   it is the platform/system surface, not a user-work journey. **Design rule for
   any future flow:** it must be a user-work journey with (a) distinct entry
   points, (b) a coherent value stream, and (c) exit conditions. Cross-cutting
   concerns (debugging, onboarding, config) are platform features or pack
   surfaces, **not** flows. Adding one is an ADR-gated governance decision that
   argues it as a *fifth user-work journey*.

4. **Flows reference current LOGICAL command paths** (`pr/create`,
   `fix/pr-comments`), not future slug-prefix projections (`git-pr-create`).
   This keeps the validate-on-load gate green today. **This is a real coupling to
   Step 8, not a trivial follow-up:** when Step 8 lands the pack `slug_prefix`
   projections, `pr/create` may stop resolving (or resolve elsewhere) and the
   flows go red. Migration plan: **Step 8's PR includes the one-time rewrite of
   every flow ref** to its projected slug, and `lint_flows.py` accepts *both* the
   logical and the projected form during a transition window so in-flight
   branches still merge. If Step 8 slips, the dual-form acceptance becomes
   permanent with a deprecation warning on the logical form. The coupling is
   tracked here, not discovered later.

5. **The four headline flows are the user-work journey discovery →
   implementation → review → delivery.** Acceptance Criterion 5 of the 6.1
   roadmap says "the 5 headline flows"; that "5" predates feedback-6 (which
   demoted `agent-admin` from a 5th flow to the platform surface). The headline
   count is **four user-work flows**; AC5 is updated to match.

6. **Validation is CI-time in Step 8b; load-time validation is Step 9's
   responsibility.** Today the flow files are **inert** — nothing in the agent
   loop loads or executes them — so there is no time-of-check/time-of-use gap to
   close: the only consumer is CI (`task lint-flows`), and a malformed flow that
   somehow bypassed CI (emergency merge, lint override) still does nothing at
   runtime. When Step 9 makes flows **load-bearing**, it MUST add a load-time
   check at agent startup with an explicit failure mode (fail-safe: refuse to
   start and name the offending file/field; opt-in graceful-degradation: drop the
   broken flow with a warning). That load-time contract is called out here as a
   Step 9 prerequisite so it is not forgotten, but it is **out of scope for
   Step 8b** precisely because flows are still inert.

## Consequences

- **Positive.** Flows become first-class validated artefacts; a typo in an
  `entry_point` or a renamed/removed command fails CI instead of rotting
  silently. The data model Step 9 needs is now decided and encoded, unblocking
  the higher-risk "primary view" work without committing to it. The
  shape-vs-resolution split keeps the schema small and the policy in reviewable
  Python.
- **Negative / cost.** One new CI lint (`task lint-flows`, ~ms). When Step 8's
  slug-prefix projections land, the flow refs need a one-time update (Decision 4
  migration plan) — tracked, not silent.
- **Rollback scope is *deferred*, not *independent*.** Today reverting Step 8b is
  trivial (delete schema + lint + restore stubs; nothing depends on them). But
  the instant Step 9 makes flows load-bearing, the rollback boundary **expands to
  include both steps** — you can no longer revert 8b without reverting 9. This
  ADR claims rollback-*deferred*, not rollback-*independent*; the honest cost is
  stated rather than implied away.
- **Risk: schema insufficiency discovered in Step 9.** If Step 9 cannot render
  the primary view with `entry_points` / `default_path` / `skills` (e.g. it turns
  out to need `transitions` / `exit_conditions` / per-command `skill_bindings`),
  the schema needs a breaking change. Mitigation: **versioned schema** —
  `flow.schema.json` is implicitly v1; a v2 ships its own file, and
  `lint_flows.py` accepts both during a transition while the four flows migrate
  (est. 4–6 h, carried in Step 9's PR). **Success metric for this ADR: Step 9
  ships without a schema change.** If it cannot, the v2 path above applies — a
  budgeted contingency, not a surprise. (Reserved speculative fields were
  considered and rejected — see *Alternatives*.)
- **No known external consumers.** The flow files were inert stubs (parsed by
  nothing); making `entry_points` / `default_path` / `skills` required is a
  breaking change only for a tool that *reads* the YAML, and there is no such
  consumer today (no docs generator, IDE plugin, or script parses `src/flows/`).
  If one appears, it must handle the three required fields.
- **Neutral.** No runtime behavior change: nothing *executes* or even *loads* a
  flow yet. The flow files remain inert to the agent loop; only CI now reads
  them.

## Alternatives considered

- **Schema `enum` for the flow id.** Rejected — hard-locks the set in the
  schema; growing/renaming a flow would mean editing the schema and the lint.
  The closed set lives in the lint (one constant) instead.
- **Resolve future-canonical slugs (`git-commit`) now.** Rejected — those
  projections do not exist until Step 8's pack `slug_prefix` work; encoding them
  now would make the gate red against a layout that does not yet exist.
- **Put the schema at `src/schemas/` (roadmap's literal path).** Rejected —
  splits the schema home; `pack.schema.json` and every validator expect
  `src/scripts/schemas/`.
- **Do Step 8b and Step 9 together.** Rejected — Step 9 (primary-view rewrite of
  the command surface) is HIGH-risk and was deferred by the prior council; this
  ADR delivers only the data-model floor.
- **Reserve speculative workflow fields now** (`transitions`, `exit_conditions`,
  `skill_bindings`, ignored by the lint). Rejected — unvalidated fields with no
  current consumer are YAGNI and quietly commit v1 to a *guessed* execution
  model. The schema-insufficiency risk they hedge is addressed more honestly by
  the explicit **v2 + transition-window** migration (Decision-scope commitment +
  *Consequences*), which keeps v1 minimal and surfaces a real schema change as a
  real change rather than a silently-pre-blessed field.

## Council convergence

Two design-mode rounds (anthropic/claude-sonnet-4-5 + openai/gpt-4o, deep,
2026-06-06). The first (scope) converged that: (a) the flow schema must encode a
*decided* data model — "stub existence ≠ structure"; (b) Step 8b is legitimate
only as the data-model definition, decoupled from Step 9's primary-view rewrite;
(c) a mega-PR collapsing the remaining deferred steps is rejected. The second
(this ADR) judged the design **sound but under-honest about risk** and converged
on six fixes, all integrated above: the CI-time-vs-load-time boundary
(Decision 6), the rollback-*deferred* framing + schema-versioning contingency +
success metric (*Consequences*), the explicit Step 8 coupling + migration plan
(Decision 4), the committed Step 9 scope + usage sketch (*Context*), the
lint-not-`enum` rationale + future-flow design rule (Decision 3), and granular
"did you mean?" lint errors (Decision 1). This ADR + the schema + lint is the
minimal, rollback-**deferred** unit that satisfies the convergence.

## References

- `agents/roadmaps/road-to-6.1.0-product-consolidation.md` — Step 8b, AC5.
- `src/flows/README.md` — flow-set definition + feedback-6 (`agent-admin` is not
  a flow).
- `src/scripts/schemas/flow.schema.json` · `src/scripts/lint_flows.py` — the
  artefacts this ADR governs.
- `src/scripts/schemas/pack.schema.json` · `src/scripts/validate_pack_yaml.py` —
  the shape-vs-resolution pattern mirrored here.
- `agents/reports/command-classification-6.0.0-d.md` — the `·_flow:` seed tags.
- ADR-044 (amendment A3) — pack `slug_prefix` projection (the future-canonical
  command names).
