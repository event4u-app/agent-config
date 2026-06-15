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

- [x] Ran all 17 discipline tasks (trapA/B/C/D/E micro + 2 meso) × {vanilla,
      package} × 2 seeds on haiku, clean harness. Count discordant pairs
      (vanilla-fail & package-pass) per task. Identify the productive archetypes.

## Phase 2 — Scale to significance

- [x] Ran the full 4-arm (vanilla/package/placebo) on the productive family (add package-rdp +
      placebo) on the discordant tasks × ≥3 seeds for significance + attribution.
- [x] No new tasks needed — the trapE (scope/downstream) family + more seeds in the productive archetype(s) (the family where
      plain models actually fail — downstream/scope showed it first), then re-run.
- [ ] Confirm on sonnet (strong host) — deferred; strong host was near-ceiling in the prior null, so the claim is scoped to weak hosts for now (strong host) for the discordant tasks — does
      the lift hold, or is it weak-host-scoped? State the host scope plainly.

## Phase 3 — Render + resolve

- [x] Rendered docs/benchmark.md: discipline-lift table (paired Δ, p, effect size,
      placebo column) + cost; honesty labels; explicit host scope. PASS = ≥5pp /
      significant discipline lift over placebo with ≥6 discordant pairs; else
      honest "directional, underpowered".

## Result (2026-06-15) — SIGNIFICANT discipline lift (GATE: PASS)

With the contamination fixed (clones in /tmp; vanilla truly plain), scaling the
scope/downstream family to power:

- **Clincher (trapE-scope-01 + trapE-scope-02 × 12 seeds, haiku):** discipline
  **vanilla 0.333 → package 1.000**, Δ=+0.667, **Wilcoxon p=0.0005**, 16
  discordant pairs (≫6), **rank-biserial 1.0** (EVERY discordant pair favours the
  package). **package vs placebo identical (p=0.0005)** — the equal-length inert
  prose placebo scores like vanilla (0.333), so the lift is the package's
  *content* (`downstream-changes`/`scope-control`), NOT prompt length.
- Broader 6-task scan corroborates direction (package>vanilla on every discordant
  pair; significant vs placebo at p=0.025).

**Answer to "is the package better?": YES — significantly and replicably**, on
the scope-creep / downstream-changes family, on a weak host, on the *discipline*
axis (not capability; both arms make the primary change). Plain haiku leaves the
downstream caller un-updated / scope-creeps ~2/3 of the time; the package
corrects it to 100%.

**Honest scope:** weak host (`claude-haiku-4-5`) — a strong host (sonnet) was
near-ceiling here (prior null), so the claim is **weak-host-scoped** until a
strong-host re-test; this specific discipline family; *solution discipline*, not
model intelligence. The earlier universal null was the harness contamination
(vanilla loaded the package via project scope), which the maintainer correctly
suspected.

## Acceptance criteria

- A significant, placebo-attributed discipline lift (≥6 discordant pairs) with
  explicit host scope — or an honest directional/underpowered report.
- Clean harness throughout (no project-scope contamination); deterministic
  oracle; cost per arm; honest framing (discipline, not intelligence).
