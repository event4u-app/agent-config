---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Skill-Authoring Rigor

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**B**/**B-spec** = the official vendor skills
repo + the public Agent-Skills specification, **C** = official CLI plugin-dev
skills, **G** = a security-firm repo); full provenance in the index § Provenance.

**Priority: P2.** Raises the quality floor of every *future* skill and aligns the
suite's contract with the emerging public spec — leverage compounds across the
whole catalog.

## Goal

Adopt the strongest authoring mechanics the ecosystem's meta-skills demonstrate —
a quantitative description-optimizer, machine-readable spec fields, and a scoped
register note — while keeping the suite's superset contract (`token_budget_class`,
personas, condensation pipeline) intact.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Skill contract + linter + size budgets | Shipped, superset | `skill-writing`, `skill-quality`, `size-enforcement`, `skill_linter.ts` |
| Progressive disclosure / body budgets | Shipped | `token-budget-discipline`, `load_context` pattern (spec *confirms* the direction) |
| "Commands are instructions FOR the agent" | Shipped | `command-writing`, `command-suggestion-policy` |
| Scoped tool grants / least-agency | Shipped | `tool-safety` |
| Trigger evals | Shipped (stub) | `evals/triggers.json`, `bench:ab` |

- [x] Reality check complete — the gaps are the **packaged eval loop**, a few **spec fields**, and a **register note**; the contract itself is already a superset.

## Phase 1 — Adopt-now plate (≤ 5 units)

- [ ] **U1 — Packaged description-optimizer loop.** Chain the primitives the suite already has (`bench:ab`, subagent orchestration, `triggers.json`) into one authoring workflow: draft → generate should/should-not-trigger queries → run baseline-vs-skill subagent pairs → measure trigger-rate over N runs on a **held-out split** → pick the description that scores best on the test split (avoids overfitting to the training queries). Land as a documented procedure in `skill-writing` + a helper that drives it. *Source B (skill-creator).* Verify: run on one existing skill, show a before/after trigger-rate delta on held-out queries.
- [x] <!-- done 2026-07-13: skill_linter errors spec_name_dir_mismatch +
      spec_name_consecutive_hyphens (both proven on deliberate violations);
      optional 'compatibility' string field (max 500) in skill.schema.json.
      408 skills pass unchanged; frontmatter 407/0. -->
      **U2 — Agent-Skills spec alignment.** Confirm/extend the `skill_linter` to enforce the two public-spec `name` rules (**must match parent directory**; **no consecutive hyphens**) for any skill the suite wants spec-portable, and add an optional machine-readable `compatibility` frontmatter field (declares system-package / network / product requirements — today those live only in prose for the media/doc skills). *Source B-spec.* Verify: linter flags a deliberately-mismatched name; a skill with `compatibility` passes schema validation.
- [x] <!-- done 2026-07-13: execution.disallowed_tools in skill schema +
      linter field allowlist (deny-list layered UNDER allowed_tools,
      defense-in-depth); scoped-grant syntax + deny-list + numeric-threshold
      guidance in tool-safety § Scoped grants; exemplar condense-memory
      carries scoped grants (Bash(scripts-run:*), Bash(diff:*)), a deny-list
      (Bash(rm:*), Bash(git push:*)) and a numeric activation threshold
      (~150 lines / ~4,000 chars) in its description. lint-skills 408 pass,
      frontmatter 407/0, condensation in sync. -->
      **U3 — Tool-grant surface uplift.** Adopt the `Bash(cmd:*)`-style scoped-grant syntax and an optional per-skill `disallowed-tools` deny-list (defense-in-depth over the current allow-list-only model), and add falsifiable numeric activation thresholds to descriptions where they apply (e.g. "fires when TLS < v1.2 OR cert < 30 days"). *Source B-spec, C, G.* Verify: `tool-safety` + `skill-quality` docs updated; one skill carries a deny-list and a threshold; projections still emit correctly.
- [x] <!-- done 2026-07-13: § Register in
      docs/guidelines/agent-infra/skill-quality-checklist.md — capability
      skills explain the trade-off; kernel rules + *-safety-floor +
      Hard-Floor surfaces stay imperative Iron-Law register
      (preservation-guard cited as the byte-level enforcement). -->
      **U4 — Register note (scoped).** A ~3-line addition to `skill-quality`: capability skills should **explain the trade-off** rather than shout ALL-CAPS MUSTs; the **safety kernel keeps its imperative Iron-Law register** (non-negotiable). *Source B.* Verify: the note names both registers and cites which artifacts stay imperative.
- [ ] **U5 (rolling) — Self-QA loop pattern.** Generalize the "assume there are problems; use fresh-eyes subagents to verify visual/structural output" loop as an optional pattern in `skill-writing` for output-producing skills (design/doc/deck). *Source B (pptx QA).* Verify: documented with one worked example; complements `verify-before-complete`.

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) endorsed U1 as raising the floor for all
future skills, and scoped U4 explicitly: the "drop ALL-CAPS / explain the why"
advice is right for **capability** skills and **wrong** for the safety kernel —
land it as a small `skill-quality` addition, not a governance artifact.

## Acceptance criteria

- [ ] U1 shows a held-out trigger-rate delta on a real skill.
- [x] U2 linter enforces name==dir + no-consecutive-hyphens; `compatibility` field validates.
      <!-- 2026-07-13: probes above; schema validate green. -->
- [x] U4 preserves the kernel's imperative register (no Iron-Law downgrade).
      <!-- 2026-07-13: the note names both registers + the enforcement. -->
- [ ] Dashboard regenerated.
