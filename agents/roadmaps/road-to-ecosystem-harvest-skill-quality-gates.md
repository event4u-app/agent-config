---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Skill Quality Gates

**Trigger:** Ecosystem survey, second sweep (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**R** = a credential-broker skill shipping a
rich per-skill eval schema, **C** = official CLI command-authoring skill, **S** =
a quality-toolkit skill using pinned effort frontmatter, **T** = a read-only-by-
default script skill, **F** = the auto-generated-skill-farm anti-pattern
specimen, **AA** = a canonical-skill→multi-adapter generator with a hard verify
script); full provenance in the index § Provenance.

**Priority: P2.** Closes four verified linter/eval gaps that protect the suite's
core asset — description-driven routing across ~271 skills.

## Goal

Add a description-quality lint, an eval-schema v2 (tool-choice + trajectory
budgets + environment preconditions), an optional pinned `effort:` frontmatter
key, a read-only-by-default script convention, and a real-host loadability
smoke test — all deterministic, all with must-fail/must-pass fixtures.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| ~90 linters incl. frontmatter-safety, originality, new-skill gate | Shipped | `lint_skill_frontmatter_safety`, `lint_skill_originality`, `skill_linter.ts` |
| Per-skill `evals/` (rubric + output-schema + triggers) | Shipped | `evals/*.json`, `output-schema.yml` |
| Vendor-neutral `model_tier` + routing | Shipped, superset | `model-recommendation`, router schema |
| Multi-tool bridge generation + hashes | Shipped | condensation pipeline, `.condensation-hashes.json` |
| Description-circularity lint | **Gap** (grep-confirmed: no `lint_skill_descriptions.ts`) | routing depends on descriptions; nothing rejects `Triggers on: X, X` |
| Eval tool-choice / trajectory / environment fields | **Gap** (grep-confirmed: none in any `evals/`) | assertions are rubric + output-deterministic only |
| `effort:` pinning | **Gap** (grep-confirmed: no `effort:` key) | — |
| Read-only-by-default script convention + lint | **Gap** | frontmatter-safety covers tool wildcards, not script write behavior |
| Real-host loadability smoke test | **Gap** (grep-confirmed: none) | bridge verify proves derivation, not host acceptance |

- [x] Reality check complete — four deterministic gates + a smoke job are genuine gaps; the pipeline scaffolding exists.

## Phase 1 — Description-quality lint

- [x] `lint_skill_descriptions.ts`: fail on (a) normalized description ≡ name, (b) duplicated trigger phrases, (c) all trigger phrases substrings of the name, (d) no condition clause (`use when|when the user|before|after|triggers on <non-name phrase>`). Allowlist file, same pattern as originality-lint. *Source C (positive norm), F (must-fail specimen).*
- [x] Fixture suite: the farm specimen's circular frontmatter verbatim as must-fail; 3 shipped skills as must-pass. Optional reward: a `When-NOT-to-Use` section where routing confusion is known (decision note, not a requirement).
- [x] Wire into `task lint-skills`; fix in-repo violations (each fix is a routing improvement — list before/after in the PR body).

## Phase 2 — Eval schema v2 (tool-choice, trajectory, environment)

- [x] Additive schema: `{"kind":"tool-choice","must_use":[…],"must_not_use":[…]}`; optional `environment`, `trajectory_budget` (integer meaningful-step ceiling, "meaningful step" defined), `requires_human` + `human_instructions`. *Source R.*
- [x] Harness: tool-choice evaluated against the recorded tool trace; trajectory counts tool calls net of retries; `requires_human` scenarios skipped in CI + reported `manual-pending` (never silently passed).
- [x] Seed 3 mis-routing-risk skills: `commit` (must use the conventional-commit flow, not raw `git commit`); `quality-fix` (must run the project's pinned tools); `fix-ci` (must fetch real CI logs, not guess). Numbers are conservative floors, not calibrated claims.
- [x] Update eval-freshness linters to recognize the new fields.

## Phase 3 — Read-only-by-default script convention

- [x] Guideline text: a script shipped inside a skill is side-effect-free by default; mutation requires an explicit flag (`--writable`/`--apply`) named in SKILL.md. *Source T.*
- [x] `lint_skill_scripts_readonly.ts`: scripts containing write primitives (`fs.write`, `unlink`, `rm `, `> `, `DELETE`, `DROP`) must gate them behind a flag-parse branch or be allowlisted with a rationale. Audit + retrofit existing script-bearing skills (table in PR body).

## Phase 4 — Frontmatter conformance + bridge-verify hardening + loadability

- [ ] Command audit against the official field standard: add `argument-hint` to argument-taking commands; verify user-invocable / disable-model-invocation semantics project correctly per host bridge; document deliberate divergences in `docs/parity/`. Do NOT chase host-specific fields into the neutral source. *Source C.*
- [ ] Optional `effort:` key: schema + projection to hosts with an effort knob (ignored elsewhere); picked up by the bench harness so runs pin it. *Source S.*
- [ ] Bridge-verify hardening: every generated bridge file must hash-derive from its `src/` source; the supported-tools matrix in docs equals the generated adapter set (fail on drift either direction). *Source AA.*
- [ ] **Host-loadability smoke job:** temp-home install of the Claude-Code plugin + a real host-CLI load assertion; metadata cross-consistency (marketplace ↔ plugin dirs ↔ docs). Optional in CI, required before releases. *Source G.*

## Council convergence (2026-07-11)

Vetted under the index direction. The farm-generator itself is **rejected**
(index Reject-log); its output is used only as a must-fail lint fixture. The
credential-broker runtime and the adapter-maximalism breadth are **cut** — only
the eval schema + the verify-assertion pattern transfer.

## Acceptance criteria (anti-dump)

- [ ] Every new lint ships with must-fail + must-pass fixtures; nothing warn-only.
- [ ] Eval schema changes are additive; all existing `evals.json` stay valid unmodified.
- [ ] No new runtime dependency (static-config + Node/TS scripts only).
- [ ] A seeded doc/adapter drift turns CI red in a test; the farm specimen fails the description lint.
- [ ] Dashboard regenerated.
