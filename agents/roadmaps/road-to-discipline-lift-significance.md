---
complexity: structural
status: ready
parent_roadmap: road-to-agentic-headroom-benchmark
---

# Roadmap: discipline-lift to significance (clean harness)

The harness contamination is fixed (clones now in /tmp; vanilla is truly plain —
it was loading ~126k tokens of the package via project scope inside the repo,
which masked the real effect and produced every prior false null). The FIRST
valid measurement already shows a clean, replicated lift: on `trapE-scope-01`,
plain haiku fails the downstream/scope discipline both seeds (dis=0.0) while the
package-equipped haiku gets it right both seeds (dis=1.0) — exactly the
`downstream-changes` rule's value, made measurable.

Goal: scale the clean discipline measurement until it reaches the locked
significance bar (**≥6 discordant pairs**, McNemar/Wilcoxon p<0.05, + placebo
attribution) — or an honest "directional only" if it doesn't.

## Locked methodology (from prior councils)

Clean harness (/tmp clones); 4 arms incl. placebo; paired stats; ≥6 discordant
pairs for any significance claim; honest framing ("helps where plain models lack
discipline — downstream/scope/over-engineering — not raw intelligence"); weak
host first (most headroom; claim then scoped to weaker hosts unless sonnet also
shows it); deterministic oracle; cost per arm.

## Phase 1 — Find the discordant pairs (cheap, vanilla vs package)

- [ ] Run all 17 discipline tasks (trapA/B/C/D/E micro + 2 meso) × {vanilla,
      package} × 2 seeds on haiku, clean harness. Count discordant pairs
      (vanilla-fail & package-pass) per task. Identify the productive archetypes.

## Phase 2 — Scale to significance

- [ ] If ≥6 discordant pairs already: run the full 4-arm (add package-rdp +
      placebo) on the discordant tasks × ≥3 seeds for significance + attribution.
- [ ] If <6: author more tasks in the productive archetype(s) (the family where
      plain models actually fail — downstream/scope showed it first), then re-run.
- [ ] Optionally confirm on sonnet (strong host) for the discordant tasks — does
      the lift hold, or is it weak-host-scoped? State the host scope plainly.

## Phase 3 — Render + resolve

- [ ] Render docs/benchmark.md: discipline-lift table (paired Δ, p, effect size,
      placebo column) + cost; honesty labels; explicit host scope. PASS = ≥5pp /
      significant discipline lift over placebo with ≥6 discordant pairs; else
      honest "directional, underpowered".

## Acceptance criteria

- A significant, placebo-attributed discipline lift (≥6 discordant pairs) with
  explicit host scope — or an honest directional/underpowered report.
- Clean harness throughout (no project-scope contamination); deterministic
  oracle; cost per arm; honest framing (discipline, not intelligence).
