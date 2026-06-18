# Tier / Visibility / Command-Merge — Evidence Base

Canonical record of *why* the command/rule/skill classification metadata
(`tier`, `visibility`, `model_tier`) is load-bearing and *why* the command
and skill trees are not consolidation candidates. Captured so future sessions
do **not** re-derive this from source or re-litigate settled verdicts.

Last validated: 2026-06-13.

## 1. The metadata is load-bearing — not dead frontmatter

`tier` is three distinct fields with three distinct consumers; none is
write-only.

| Field (artifact) | Values | Read by | Effect |
|---|---|---|---|
| **rule `tier`** | `kernel` / `tier-1` / `tier-2` (+ legacy `1`/`2a`/`2b`/`3`/`safety-floor`/`mechanical-already`) | `src/scripts/compile_router.ts` → `dist/router.json` | session-start rule activation per profile |
| **command `tier`** | `0` / `1` / `2` | `src/cli/commands/commands.ts` (`--visible`), `src/scripts/audit_command_surface.ts` (per-pack budget), `src/scripts/build_discovery_manifest.ts` | CLI filtering, budget enforcement, published manifest |
| **command `visibility`** | `visible` / `advanced` / `internal` | same three readers (prefer `visibility`, fall back to `tier` — ADR-090) | the *authoritative* classifier; `tier` is its back-compat alias |
| **skill `tier`** | `senior` | `src/scripts/skill_linter.ts`, `src/scripts/lint_handoffs.ts` | senior-structure required-section checks + handoff-graph constraints |
| **skill `model_tier`** | `inherit` / `lite` / `medium` / `high` (227/227 skills) | model-recommendation routing | model selection — distinct from `tier` |

CI enforces command `tier`+`visibility` via `src/scripts/lint_command_tiers.ts`
(present + valid enum + consistency when both set); rule `tier` via
`src/scripts/lint_rule_tiers.ts`.

**The only genuine redundancy** is command `tier` ⇄ `visibility` (two fields,
same 3-level concept). ADR-090 (2026-06-13) made `visibility` the source of
truth and `tier` a back-compat alias, **deferring** the `tier` drop (its
"Option B"). [ADR-092](../../../docs/decisions/ADR-092-defer-command-tier-alias-removal.md)
(2026-06-13, AI council) closed that question as **deferred-with-forcing-function**:
the discovery manifest is a published npm artifact that dual-emits the integer
`tier`, external consumers are unknown, and the defer rests on a Runtime Risk
that cannot be ruled out (assumption, not evidence). Integer-`tier` readers are
all internal (`commands.ts` fallback, `audit_command_surface.py`,
`build_discovery_manifest.py` dual-emit); `workspace_hosts.py` uses an
unrelated host-inventory tier. Removal execution + the re-open mechanism
(versioned manifest v2 / telemetry + time-boxed review) live in
`road-to-tier-removal.md` (blocked).

## 2. Command & skill consolidation — already adjudicated, keep-verdicts

- **Command surface.** A council converged on **"keep · 0 merge · 0 retire"**
  — every flagged overlap (`roadmap:process-*` scope ladder, `council:*` /
  `judge:*` specialists, `ghostwriter:*` CRUD, thin aliases, the
  `commit`/`commit:in-chunks` confirmation-vs-autonomous fork) is an
  intentional structural pattern, not duplication. Evidence:
  `agents/reports/command-surface.md`, `agents/reports/command-budget-audit.md`.
- **Skills.** Skill rationalization is locked at **"210 keep · 0 merge ·
  0 retire"** (maintainer override 2026-05-16); the 208 → ≤160 reduction target
  was *dropped*. The overlap detector found 0 structural merge candidates —
  every flagged pair maps to a router-dispatched family (judge-*,
  project-analysis-*, laravel-*, UI-stack dispatchers). Evidence:
  `agents/evidence/metrics/skill-rationalization-candidates.md`,
  `agents/evidence/metrics/skill-overlap.md`. Re-opening starts at the
  never-run 2026-06-15 activation re-analysis gate, **not** by re-deriving
  structural overlap.
- **Validation council (2026-06-13, anthropic/claude-sonnet-4-5 +
  openai/gpt-4o, deep + peer-review)** reviewing the metadata-leanness plan
  converged on **conditional approval**: keep the keep-verdicts, do not re-run
  a council on `commit`+`commit:in-chunks` inside an active roadmap (it
  contradicts the keep-lock), finalize only the already-deprecated `fix:pr-*`
  variants and the `tier` alias collapse.

## 3. File count ≠ runtime load — "merging makes it leaner" is false

Sub-commands load **lazily** — a command file enters context only when its
parent orchestrator routes to it. The per-tool projections (`.claude/`,
`.cursor/`, `.augment/commands`) are **symlinks** to `dist/agent-src/commands`
(0 bytes materialized). Command file count therefore carries a *build-time +
navigation* cost, never a per-session token cost. Merging two thin variants
into one flag yields fewer file entities and a clearer mental model — **not**
load savings, and not "fewer subclasses loaded". Any future "consolidate to go
leaner" argument must be made on maintainability grounds, not token-load.

## See also

- `docs/decisions/ADR-090-visibility-command-frontmatter-field.md` — the
  `visibility` source-of-truth decision + deferred `tier` drop.
- `docs/contracts/command-surface-tiers.md` — tier/visibility contract.
- `docs/contracts/rule-router.md`, `docs/contracts/kernel-membership.md` —
  rule-tier routing.
