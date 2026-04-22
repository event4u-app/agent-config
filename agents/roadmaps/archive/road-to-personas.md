# Roadmap: Personas — reusable review lenses as a first-class primitive

> **Status: v1 SHIPPED (2026-04-22).** Phases 1–5 landed on
> `feat/improve-agent-setup-10`. Phase 4 wiring of the three
> `judge-*` skills (bug-hunter, security-auditor, code-quality) is
> deferred to v1.1 until matching specialist personas exist.
> Phase 6 (smart activation) is v1.1+ as designed.

> Promote "review lens" from an implicit, per-skill concept to a
> **shared, versioned, lintable artifact type**. Skills reference
> personas; users invoke one, several, or all. Absorbs the
> `role-modes` axis as a `mode:` field. Unblocks Q23
> (multi-perspective review) and Q25 (ticket refinement).

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame adopted
- [x] [`road-to-role-modes.md`](road-to-role-modes.md) Phases 1–4 shipped — six contract skeletons live as `role-contracts` guideline + linter check; personas subsume the axis without replacing the shipped mechanism
- [x] `skill-quality`, `preservation-guard`, `augment-portability`, `size-enforcement` rules active — new artifact kind inherits the same gates
- [x] `scripts/skill_linter.py`, `scripts/check_references.py`, `scripts/check_portability.py`, `scripts/update_counts.py` are the extension points — no parallel linter stack
- [x] `.agent-src.uncompressed/` is the source of truth; `.agent-src/` is regenerated

## Vision

Today, every skill that reasons "from a viewpoint" hardcodes its own
taxonomy. `adversarial-review` ≈ Critical Challenger. The four
`judge-*` skills ≈ specialist reviewers. Q23 proposed 7 lenses; Q25
proposed 6. Without a shared primitive each new multi-lens skill
re-invents the cast, drifts, and makes output untraceable.

A **persona** is a small, reusable file that declares a *voice*:
focus, mindset, questions it asks nobody else asks, output
expectations, anti-patterns. Skills cite personas in a
`personas:` frontmatter key. Users invoke one, several, or all:
`/refine-ticket --personas=po,senior-engineer`.

Personas are **passive reference content** — loaded on demand by
the skills that cite them. They do not trigger by description.
This is what separates them from skills.

## Non-goals (explicit)

- **No** auto-firing personas — personas are invoked by skills, not by user triggers.
- **No** fine-grained developer variants by default (frontend / backend / devops) — overlap risk without unique signal; decide case-by-case during drafting.
- **No** replacement of `role-contracts` (shipped via role-modes roadmap) — personas subsume the *voice* axis, role-contracts own the *workflow closing contract* axis. They coexist.
- **No** project-specific personas in `.agent-src.uncompressed/` — consumer overrides land in `.agent-src/personas/` of the consumer repo, same pattern as skills.
- **No** LLM-generated personas without human sign-off — every Core persona is authored via `artifact-drafting-protocol`.

## The Core-6 (v1 canon, always loaded by default)

Decided in Q24, 2026-04-22:

| ID | Focus | Unique question nobody else asks |
|---|---|---|
| `developer` | Implementation reality | "What's the edge case the wording hides?" |
| `senior-engineer` | Architecture impact, long-term risk | "Which decision are we locking in here that we can't cheaply undo?" |
| `product-owner` | Outcome, testable AC, scope | "What does 'done' look like from a user's side?" |
| `stakeholder` | Business value, relevance | "Why now, and why this shape?" |
| `critical-challenger` | Fake clarity, hidden complexity | "What are we pretending is simple that isn't?" |
| `ai-agent` | Automation-readiness, safe execution | "Can a coding agent execute this without hallucinating context?" |

## Specialist personas (opt-in)

Candidates, decided per v1.1+:

- `qa` — testability, failure scenarios. **Strongly recommended** — produces unique signal from day one. Ship in v1.0 alongside Core-6.
- `security`, `performance` — v1.1 candidates; delegate to existing `threat-modeling` / `performance-analysis` where a dedicated skill already owns the lens.
- `frontend-developer`, `backend-developer`, `devops` — under review, leaning NO. Add only if drafting reveals questions Core-6 misses.
- **Rejected for v1**: `maintainer` (= senior-engineer + challenger), `new-user` / `optimizer` / `developer-dx` (better expressed as review modes than personas).

**Canonical heuristic for every future proposal:**
> A persona is only worth adding if it asks questions none of the
> existing personas ask. No unique questions → no persona.

## Role-mode absorption (Q3 + Q4)

The six role-mode contracts (Developer / Reviewer / Tester / PO /
Incident / Planner) stay **as-is** as workflow-closing contracts in
`role-contracts.md`. Personas add the **voice** axis above them.
A persona may declare an optional `mode:` field linking to the
role-contract it most often composes with, e.g.
`mode: reviewer` on `critical-challenger`. The link is advisory,
not enforcing — a persona may compose with any mode.

Q4 conflict resolution (Warn + Ask with numbered options) applies
verbatim to the combined persona + mode invocation: if the active
mode forbids the requested action and a persona would override it,
the agent surfaces the numbered prompt, never silently switches.

## Phases

### Phase 1 — primitive + linter + compression ✅ SHIPPED (2026-04-22)

- [x] Persona file schema drafted and frozen — frontmatter
  (`id`, `role`, `description`, `mode?`, `tier: core | specialist`,
  `questions` count target, `version`) + required sections
  (Focus / Mindset / Unique Questions / Output Expectations / Anti-Patterns).
  Size budget: Core ≤ 120 lines, Specialist ≤ 80 lines.
  → [`.agent-src.uncompressed/personas/README.md`](../../.agent-src.uncompressed/personas/README.md) + [`templates/persona.md`](../../.agent-src.uncompressed/templates/persona.md).
- [x] `scripts/skill_linter.py` gains a persona validator: required
  frontmatter fields, required sections, Unique-Questions heuristic
  enforcement (≥ 3 questions that don't appear verbatim in any other
  persona). CI-breaking on fail.
- [x] `scripts/check_references.py` extends to validate every
  `personas:` entry in skill/command frontmatter resolves to a
  known persona file. Unknown persona = CI fail.
- [x] `scripts/check_portability.py` covers persona files by path —
  `.agent-src*` recursive scan already includes `personas/`.
- [x] `scripts/update_counts.py` TARGETS extended so README /
  AGENTS.md / docs pick up `personas: <n>` automatically.
- [x] Compression handling: each persona compresses separately
  (symmetric with skills/rules), preserving frontmatter and
  section markers. `scripts/compress.py` updated; hashes
  tracked in `.compression-hashes.json`.
- [x] Projection to `.augment/personas/`, `.claude/personas/`,
  `.cursor/personas/` added to `scripts/compress.py
  --generate-tools` — same strategy as skills (symlinks).

### Phase 2 — Core-6 authored ✅ SHIPPED (2026-04-22)

Each of the six Core personas drafted via `artifact-drafting-protocol`,
committed in a single batch so cross-references resolve at once.

- [x] `.agent-src.uncompressed/personas/developer.md`
- [x] `.agent-src.uncompressed/personas/senior-engineer.md`
- [x] `.agent-src.uncompressed/personas/product-owner.md`
- [x] `.agent-src.uncompressed/personas/stakeholder.md`
- [x] `.agent-src.uncompressed/personas/critical-challenger.md`
- [x] `.agent-src.uncompressed/personas/ai-agent.md`
- [x] Every persona passes the Unique-Questions heuristic against
  the other five — linter enforces.

### Phase 3 — specialist: qa ✅ SHIPPED (2026-04-22)

- [x] `.agent-src.uncompressed/personas/qa.md` drafted (strong
  recommendation per Q24).
- [x] `artifact-drafting-protocol` run verifies qa produces
  questions Core-6 does not cover; if not, the persona is dropped.

### Phase 4 — integration into existing artifacts ✅ SHIPPED (2026-04-22)

- [x] `adversarial-review` skill reframed as a thin wrapper
  invoking `personas: [critical-challenger]`. Logic stays the
  same; the cast becomes explicit and reusable.
- [x] `judge-test-coverage` cites `personas: [qa]` — natural mapping
  to the shipped specialist persona. Dispatch via `review-changes`
  is unchanged.
- [ ] `judge-bug-hunter`, `judge-security-auditor`, `judge-code-quality`
  — **deferred to v1.1** until matching specialist personas exist
  (`bug-hunter`, `security-auditor`, `code-quality`). Wiring now
  would require either citing Core-6 (wrong fit) or shipping three
  new specialists without unique-question validation. Drafting each
  specialist is its own `artifact-drafting-protocol` run.
- [x] `receiving-code-review`, `requesting-code-review` cite
  `personas: [critical-challenger]` — the fake-clarity lens fits
  both triage (receiving) and self-review (requesting). No new
  variants — the single persona is the variant.
- [x] `role-contracts.md` guideline gains a "Personas" section
  linking each role mode to its most common persona companions
  (advisory, not enforcing).

### Phase 5 — settings integration (depends on Q6 two-file split)

- [x] `.agent-project-settings.yml` gains `personas.default: [...]`
  (team-wide default lens selection) and
  `personas.specialists.auto_include: [qa]` (auto-include on every
  multi-lens run). *(2026-04-22: [`agent-project-settings.example.yml`](../../.agent-src.uncompressed/templates/agents/agent-project-settings.example.yml) — `personas:` block with Core-6 default and `[qa]` auto-include)*
- [x] `.agent-settings.yml` gains `personas.override: [...]` so a
  developer can narrow or widen their local defaults without
  changing team config. *(2026-04-22: [`agent-settings.md`](../../.agent-src.uncompressed/templates/agent-settings.md) — `personas.override` (full replacement) + `personas.ignore` (drop-only) with settings-reference rows)*
- [x] Merge contract documented in [`layered-settings.md`](../../.agent-src.uncompressed/guidelines/agent-infra/layered-settings.md)
  — six-step resolution (project default → override → specialist auto-include
  → ignore → `.augmentignore` → skill frontmatter wins). No separate
  `load_settings.py` script; same contract consumers implement against as for
  all other settings (Q6 Phase 0). *(2026-04-22)*
- [x] `.augmentignore` semantics: a user can ignore a persona by
  id; ignored personas drop out of default lens selection but
  remain invokable explicitly via `--personas=<id>`. *(2026-04-22: codified as step 5 of the resolution order in [`layered-settings.md`](../../.agent-src.uncompressed/guidelines/agent-infra/layered-settings.md); matches skill-ignore behaviour)*

### Phase 6 — smart activation (v1.1+, deferred)

Auto-add specialist personas based on ticket/PR content
("UI" → `frontend` when it exists, "auth/payment" → `security`,
"performance" → `performance`). Deferred until at least three
specialist personas ship and usage data shows the default lens
selection is wrong often enough to justify the complexity.

## Unblocks

- **Q23 — multi-perspective review skill** — Core-6 is the
  default cast; `--fresh-eyes` and `--rank-by-leverage` are
  modes, not new personas.
- **Q25 — refine-ticket** — the six perspectives map 1:1 to the
  Core-6, no new personas required; qa is the strong `--personas=+qa`
  opt-in.
- **Tier-1 skill rewrites (Q13)** — once Personas ship, Tier-1
  rewrites can absorb persona references instead of hardcoded
  lenses.

## Open questions (for Phase 1 drafting)

- Persona compression semantics — single pass per file, or
  cross-persona deduplication? Default: single pass per file
  (symmetric with skills). Revisit if total persona count > 15.
- Persona versioning — frontmatter `version: 1.0` required? Or
  derive from git history? Default: explicit `version` field so
  skill citations can pin to a version during breaking changes.
- `.augmentignore` granularity — ignore at persona-id level, or
  allow ignoring whole categories (`personas:specialist:*`)?
  Default: persona-id only; category-level deferred.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Persona proliferation via drive-by additions | Unique-Questions heuristic enforced in linter; `artifact-drafting-protocol` mandatory per new persona |
| Overlap with role-contracts muddles the model | Personas = voice; role-contracts = workflow closing contract. Advisory `mode:` link, no cross-enforcement |
| Consumer overrides drift from package baseline | Consumer personas live in consumer `.agent-src/personas/` overrides; package check_portability stays strict |
| Compression doubles the maintenance load | Personas compress independently; linter verifies frontmatter survives; CI enforces `task sync` parity |

## Acceptance criteria

Phase 1 is shipped when: persona schema is frozen, linter
validates, check_references resolves `personas:` entries,
compression round-trips, and at least one Core persona (pilot:
`critical-challenger`) is drafted and cited by `adversarial-review`
end-to-end. Phase 2 is shipped when all Core-6 personas exist,
pass the Unique-Questions heuristic, and are cross-linked from
at least one skill each.

## See also

- [`open-questions.md`](open-questions.md) — Q3, Q4, Q23, Q24, Q25 (source of all decisions)
- [`road-to-role-modes.md`](road-to-role-modes.md) — role-contracts guideline personas compose with
- [`road-to-ticket-refinement.md`](road-to-ticket-refinement.md) — primary consumer
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — Tier-1 rewrites absorb persona references
- [`.agent-src.uncompressed/rules/artifact-drafting-protocol.md`](../../.agent-src.uncompressed/rules/artifact-drafting-protocol.md) — mandatory per new persona
- [`.agent-src.uncompressed/rules/skill-quality.md`](../../.agent-src.uncompressed/rules/skill-quality.md) — quality baseline personas inherit
- [`.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md`](../../.agent-src.uncompressed/guidelines/agent-infra/role-contracts.md) — workflow closing contracts
