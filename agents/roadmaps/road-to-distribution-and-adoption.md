# Road to Distribution and Adoption

**Status:** READY FOR EXECUTION — split out of `road-to-better-skills-and-profiles.md` 2026-05-01.
**Started:** 2026-05-01 (split out of `road-to-better-skills-and-profiles.md`
after AI #5 review).
**Trigger:** Multi-AI review identified marketing, multi-tool expansion,
orchestration DSL, and audit-as-memory as Block H/I/G/Q. AI #5 flagged
these as scope creep relative to the Thinking Layer's 6-week horizon.
**Mode:** Four phases (H · I · G · Q), one per block. Recommended
sequencing in pre-conditions section — not enforced; the user picks
the active phase.

## Purpose

Track the four distribution / adoption / orchestration blocks
(Marketing · Multi-tool expansion · Orchestration DSL · Audit-as-Memory)
that were originally synthesised under
`road-to-better-skills-and-profiles.md` and split out 2026-05-01 to
keep the Thinking Layer roadmap inside its 6-week plate.

## Out of scope (this roadmap)

- Skill / persona / stakeholder work — sibling roadmap.
- Engine, governance, packaging — `road-to-post-pr29-optimize.md`,
  `road-to-governance-cleanup.md`.
- MCP server — `road-to-mcp-server.md`.

## Horizon (6-week visible plate)

Per `road-to-better-skills-and-profiles.md` "Roadmap horizon" decision —
6 weeks is the visible commitment plate; anything outside is **out-of-horizon** (beyond 6 weeks).

**Inside the plate (this 6-week window):**

- **Phase 2 (I — Multi-tool expansion)** *if* sibling Block B
  (projection-layer review) finishes within the window. I1–I3 are
  cheap once the abstraction is clean; estimate 1–2 weeks once
  unblocked.

**Outside the plate (out-of-horizon, gated on dependencies):**

- **Phase 1 (H — Marketing)** — four pre-conditions stacked
  (Thinking A+C ≥80% shipped, post-pr29 1.15.0, `docs/contracts/`
  policy, named owner with 1 day/week cap). None due in 6 weeks.
- **Phase 3 (G — Orchestration DSL)** — gated on Thinking Layer A + C
  ≥80% shipped. C alone is 4–6 weeks after A; not realistic in plate.
- **Phase 4 (Q — Audit-as-Memory)** — gated on Phase 3 (G) shipping.
  Two phases out from the plate.

The dashboard treats every phase as ready (per "Phase pre-conditions"
section); this block makes the realistic timing explicit so reviewers
know which phase is the next-in-window candidate.

## Phase pre-conditions (recommended sequencing)

Originally a hard promotion gate; kept here as **recommended**
sequencing after promotion. The dashboard treats every phase as
ready; the user decides when to start a phase based on these
conditions:

1. Thinking Layer Blocks A + C are ≥80% shipped (POWERFUL eval tier)
   — required for **Phase 3 (G)** and **Phase 1 (H, marketing)**.
2. Phase 1 of `road-to-post-pr29-optimize.md` shipped 1.15.0 with green
   CI and counter-drift guard active — required for **Phase 1 (H)**.
3. `docs/contracts/` stability policy is in force (no public links into
   `agents/`) — required for **Phase 1 (H)**.
4. Block owner is named and 1 day/week cap is committed for ≥6 weeks
   — required for **Phase 1 (H)**.
5. Sibling roadmap Block B (projection-layer review) finished
   — required for **Phase 2 (I)**.
6. Phase 3 (G) shipped — required for **Phase 4 (Q)**.

## Phase 1: Block H — Marketing

**Goal:** 200 stars / 5 external consumers / 1 talk in 6 months *after
this phase ships*. Hard cap 1 day/week per person on marketing work,
locked from the Thinking Layer decisions.

**Pre-conditions:** items 1, 2, 3, 4 of "Phase pre-conditions".

**Risk if started early:** marketing eats engineering, depth narrative
backfires (no depth to point at).

- [ ] **H1** — README rewrite for OSS-light positioning (waits on
      sibling roadmap F7 shipping).
- [ ] **H2** — Skill-bundle landing pages (waits on sibling roadmap
      Block A personas shipping).
- [ ] **H3** — Comparison page vs `alirezarezvani/claude-skills` (waits
      on eval thresholds producing numbers).
- [ ] **H4** — Medium / dev.to articles, conference CFP — owner +
      budget assigned first, then content.

## Phase 2: Block I — Multi-tool expansion

**Goal:** Add Aider, Kilo Code, OpenCode, Codex projections to
`task generate-tools`. AI #2 ranked these as cheap wins after the
projection-layer review.

**Pre-conditions:** item 5 of "Phase pre-conditions" — sibling roadmap
Block B (projection-layer review) must produce a clean abstraction;
otherwise each new tool re-implements the projection logic.

- [ ] **I1** — Per-tool projection scripts for Aider, Kilo Code,
      OpenCode, Codex (one script per target).
- [ ] **I2** — Integration tests against each tool's loader.
- [ ] **I3** — Installation docs in `docs/installation.md` under
      `advanced`.

## Phase 3: Block G — Orchestration DSL

**Goal:** YAML pipeline definition + `/orchestrate` command chaining
personas / skills / sub-agents into reproducible flows. AI #2 ranked
this **after** A + C complete because the DSL is empty without
personas to compose.

**Pre-conditions:** item 1 of "Phase pre-conditions".

**Risk if started early:** DSL ships without enough personas to
compose → becomes a prettier `/work`.

- [ ] **G1** — DSL schema + linter.
- [ ] **G2** — `/orchestrate` command + state machine in `work_engine`.
- [ ] **G3** — Reference pipelines for the 4 demo scenarios from
      `road-to-post-pr29-optimize.md` (Phase 2 demo-track).

## Phase 4: Block Q — Audit-as-Memory

**Goal:** Persistent agent-action log + promotion gate that turns
repeated successful patterns into validated skills/rules. The honest
version of the "self-improving agent" claim that AI #2 ruled out.

**Pre-conditions:** item 6 of "Phase pre-conditions" — Phase 3 (G) must
ship first; without orchestrated pipelines there are no repeated
patterns to mine.

- [ ] **Q1** — Append-only audit log schema (extends existing
      chat-history split).
- [ ] **Q2** — Pattern-extraction script + human review gate (no
      auto-promotion).
- [ ] **Q3** — Integration with `learning-to-rule-or-skill` skill.

## Risk register (delta from sibling roadmap)

| Risk | Mitigation |
|---|---|
| Phases started before pre-conditions met | Pre-conditions section; user picks active phase, dashboard shows readiness |
| Phase 3 (G) started as "tooling looks easy" before A + C deliver depth | Pre-condition item 1 (≥80% A + C shipped) |
| Phase 1 (H, marketing) consumes engineering capacity | 1 day/week cap is non-negotiable |
| Phase 4 (Q) rebrands as "self-improving agent" | Title locked at "Audit-as-Memory"; AI #2 explicit non-goal |

## Reference

- Thinking Layer: `road-to-better-skills-and-profiles.md`
- Engine + governance: `road-to-post-pr29-optimize.md`,
  `road-to-governance-cleanup.md`
- MCP: `road-to-mcp-server.md`

## Next step

User picks the first phase to start when its pre-conditions are met.
Recommended order: Phase 2 (I) first if sibling Block B is closest to
done; otherwise Phase 3 (G) once Thinking Layer A + C are ≥80%
shipped. Phase 1 (H) gates on the most pre-conditions; Phase 4 (Q)
gates on Phase 3.
