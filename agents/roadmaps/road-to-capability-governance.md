---
complexity: structural
status: ready
---

# Road to capability governance — boundary matrix, risk-class, growth gate

> From the 7.1.0 multi-reviewer feedback (`agents/tmp/legal-and-feedback.txt`) +
> the legal deep-council (2026-06-24). The recurring theme across reviewers:
> the suite keeps *growing capabilities* (packs, skills, missions, subagents)
> faster than it *governs* them — there is no single place that answers, per
> capability: is it on by default? does it need consent? a disclaimer? an eval?
> how risky is it? This roadmap builds that governance spine. Legal is the
> first N=1 instance; this extracts the generalizable layer **only where N≥2
> evidence exists** (the rest stays documentation, not enforced framework).

> **N=2 discipline (the council's own rule).** The legal deep-council split on
> whether to build a generic `risk_class` framework now (gpt-4o) or wait for a
> 2nd high-risk domain (anthropic, won on the package's own ADR-004 extraction
> rule). Resolution baked in here: document the matrix + add the metadata keys
> now (cheap, makes coverage visible); defer the *enforced generic framework*
> until medical/tax/compliance actually lands.

## Phase 1 — Capability boundary matrix (documentation)

> One table the maintainer + every reviewer asked for: per pack/capability,
> the safety posture at a glance. Documentation-first — makes the invisible
> visible without committing to enforcement machinery.

- [x] **1.1 — Author `docs/contracts/capability-boundary.md`** — one row per pack with columns: `default_install` (yes/no) · `requires_consent` · `requires_council` · `requires_disclaimer` · `has_eval` · `risk_class` (low/medium/high) · `surface_tier` · `promotion_gate`. Populate every current pack from existing `packs.yml` metadata; legal-review-prep = the high-risk exemplar.
- [x] **1.2 — Link it** from `docs/contracts/package-self-orientation.md` + the pack-architecture guideline so it is discoverable, not buried.
- [x] **1.3 — Verify** — every pack in `packs.yml` appears exactly once; `check-refs` green.

## Phase 2 — risk_class as documented pack metadata

> Generalize the legal-specific `risk_profile` key (from `road-to-legal-review-prep`
> Phase 4) into a cross-pack `risk_class` field — documentation + validation only;
> behavioural enforcement stays per-pack in the floors.

- [x] **2.1 — Add `risk_class: low|medium|high`** to the pack frontmatter schema + `generate_pack_manifests.ts`; backfill every pack (default `low`; legal-review-prep `high`). <!-- impl: source-only field in packs.yml (matches risk_profile; generator ignores it, no pack.yaml schema change); default low = omitted, non-low marked -->
- [x] **2.2 — Validate** — a lint check that `risk_class: high` ⇒ `default_install: false` + `requires_consent: true` + `surface_tier: lab` (the legal posture becomes the enforced shape for any future high-risk pack).
- [x] **2.3 — Verify** — lint passes on current packs; fails on a simulated `high` pack that defaults on.

## Phase 3 — Skill-growth gate

> Reviewers: skill count keeps climbing; nothing forces "should this be a new
> skill at all?" Make the question structural at authoring time.

- [ ] **3.1 — Author the gate** — extend the artifact-drafting / skill-writing flow so a NEW skill must answer: which family · which capability (vs an existing one) · why not extend/merge · why not a guideline · visibility tier. Record the answers in the PR body.
- [ ] **3.2 — Overlap surfacing** — wire `skill-overlap` evidence into the gate so near-duplicates are flagged before merge (reuse the existing overlap metric script).
- [ ] **3.3 — Verify** — gate documented + referenced from the skill-writing skill; a dry-run on a deliberately-overlapping skill flags it.

## Phase 4 — Subagent-boundary contract

> Reviewers flagged subagent sprawl + unclear ownership. Define what a subagent
> owns (delegation of a scoped task) vs what it must NOT own (task-meaning,
> cross-task memory, pack-surface decisions, safety-floor bypass).

- [ ] **4.1 — Author `docs/contracts/subagent-boundary.md`** — the ownership line: a subagent executes a scoped, named task and returns a conclusion; it does not redefine the parent task, does not bypass any floor (Hard Floor / safety floors apply inside subagents), does not silently expand scope.
- [ ] **4.2 — Cross-link** from the Agent/Workflow orchestration docs + the relevant skills.
- [ ] **4.3 — Verify** — contract referenced; `check-refs` green.

## Phase 5 — Capability lifecycle

> A single lifecycle vocabulary so capabilities can be promoted/retired
> predictably (today `trust_level`/`surface_tier` exist but per-axis; reviewers
> wanted one lifecycle).

- [ ] **5.1 — Define the lifecycle** — `experimental → validated → recommended → deprecated` for packs/skills/missions, mapping onto the existing `trust_level` + `surface_tier` + eval-presence so it is a *view*, not a new axis. Document promotion criteria (e.g. validated ⇒ has eval; recommended ⇒ in a default profile + N consumers).
- [ ] **5.2 — Surface it** in the capability-boundary matrix (Phase 1) as a derived column.
- [ ] **5.3 — Verify** — lifecycle doc references real metadata fields; no new orthogonal axis introduced.

## Phase 6 — Deferred / rejected (recorded)

- [ ] **6.1 — Enforced generic high-risk *framework*** (runtime gating engine, generic consent machinery) — deferred until N≥2 high-risk domains. The matrix + `risk_class` + per-pack floors are the honest current mechanism.
- [ ] **6.2 — Auto-promotion of capabilities** — out of scope; promotion stays a human/maintainer decision (lifecycle is descriptive + criteria-documented, not automated).

## Acceptance criteria

- `capability-boundary.md` exists, covers every pack once, is linked + ref-green.
- `risk_class` is a validated pack field; `high` ⇒ off-by-default + consent + lab (lint-enforced).
- New-skill authoring forces the family/overlap/why-not-merge questions.
- Subagent-boundary contract authored + cross-linked.
- Capability lifecycle defined as a view over existing metadata, no new axis.
