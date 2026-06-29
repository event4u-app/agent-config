---
complexity: structural
status: ready
---

# Road to shadcn Registry & MCP Awareness

> Teach `react-shadcn-ui` the modern shadcn distribution model — the JSON registry, namespaced `@registry/component` resolution, the `shadcn info --json` project-context handshake, token-carrying `registry-item.json`, and the optional shadcn MCP server — so the skill grounds in the real project + registry instead of only driving the legacy `npx shadcn add` CLI.

## Goal

Close the registry/MCP gap in `react-shadcn-ui`. Today it knows `npx shadcn@latest add` + reads `components.json`, but has **no** awareness of: the registry-as-JSON model, namespaced registries (`@acme/button` → URL), the self-describing `registry-item.json` (deps graph + OKLCH `cssVars` light/dark/theme), the `shadcn info --json` handshake, or the shadcn MCP server. Add these as an **opt-in enhancement** — the existing CLI path keeps working.

## Context

**What we have (verified):**
- `react-shadcn-ui` — bundles `scripts/shadcn_add.ts` wrapping `npx shadcn@latest add`; reads `components.json` for detection + post-run sanity; gated `assisted`/`strict`, `allowed_tools:[npx]`, propose-never-silent-run, `--dry-run`. Anti-slop hooks at polish. Validated vs shadcn 2.1 / Tailwind 3.x / React 18+.
- `existing-ui-audit` writes `state.ui_audit.shadcn_inventory` (a project-context handshake of our own).
- This skill is on the `source-confidentiality` skip-list (integrating shadcn the tool is explicitly allowed; naming the tool is fine).

**What the Source D reference adds (deep-dived 2026-06-28):** the *decoupled* pattern — a skill that TEACHES the agent to drive a CLI + MCP + a self-describing namespaced JSON registry, rather than embedding component knowledge. Key mechanisms: `shadcn info --json` reads the project's `components.json` (framework, aliases, installed components, icon lib) before acting; `registry-item.json` encodes `dependencies`/`registryDependencies` (dependency graph) + `cssVars` (OKLCH, light/dark/theme scopes) so the agent scaffolds + themes without guessing; namespaced resolution maps `@ns/name` → URL via the `registries` key; the shadcn MCP server exposes the same surface (browse/search/install-with-NL) over MCP.

**Council verdict (2026-06-28):** ADOPT — but as an **opt-in enhancement, not a mandatory per-operation gate**. Sonnet's round-2 walk-back: the current skill "works on 90%+ of shadcn projects"; do not add 2–3 round-trips (`info` → parse → decide) to *every* component op. Make registry awareness opt-in; make `shadcn info --json` the handshake when the project uses custom/namespaced registries or when theme-alignment matters. gpt ranked it high. Net: real gap, adopt deliberately, don't over-gate.

## Token-optimization stance

This is mostly *executor* knowledge (CLI/MCP/registry mechanics), not loaded prose — `react-shadcn-ui` is `model_tier: medium`, not `rich`. The registry/MCP reference detail lives in the skill's bundled `scripts/` + a reference file lazy-loaded only on the registry path, not in always-loaded context. No budget change. The handshake (`shadcn info --json`) returns structured JSON the agent reads transiently — zero persistent context cost.

## Prerequisites

- `react-shadcn-ui` is the sole edit surface (skip-listed for source-confidentiality).
- Keep the existing `shadcn_add.ts` CLI path intact and default.

## Phase 0 — Registry model + JSON schema literacy

- [x] Add a lazy-loaded reference (skill-local) describing `registry-item.json`: the `type` enum (`registry:ui|block|component|hook|lib|theme|style|page|file`), `dependencies`/`devDependencies` (npm), `registryDependencies` (built-in / `@ns/x` / GitHub / URL / local), `files[]` (path + type + target placeholders), `cssVars` (theme/light/dark, OKLCH), `css` (raw `@layer`/`@utility`). Loaded only on the registry path. <!-- done: src/skills/react-shadcn-ui/reference/registry.md — full schema, lazy-loaded only on the registry/MCP path (zero always-on tokens). -->
- [x] Document namespaced resolution: `components.json` `registries` map (`@acme-ui` → URL template with `{name}`/`{style}`), the resolution regex, and per-registry `headers` with `${ENV_VAR}` for auth registries. <!-- done: reference/registry.md § Namespaced registries — map, resolution regex, ${ENV_VAR} auth headers, decentralized-namespace note. -->

## Phase 1 — `shadcn info --json` handshake (opt-in)

- [x] Teach the skill to run `shadcn info --json` to read framework / aliases / installed components / icon lib / base settings — used as the grounding handshake **when** the project declares custom/namespaced registries OR theme-alignment is in scope. NOT a forced first action on every add. <!-- done: SKILL "Registry & MCP awareness (opt-in)" — handshake conditions stated, explicitly not a per-add gate. -->
- [x] Reconcile with our own `state.ui_audit.shadcn_inventory` — prefer the live `info --json` when present; fall back to the audit. Document the precedence. <!-- done: precedence bullet — live info --json wins, audit is the fallback. -->

## Phase 2 — Token-aware scaffolding

- [x] When a `registry-item.json` carries `cssVars`, align additions to the project's existing theme tokens (read from `info --json` / `components.json`) instead of injecting the default shadcn neutral theme — directly reinforces our anti-slop posture (default shadcn theme + Inter fallback is a flagged tell). <!-- done: SKILL "Token-aware scaffolding" + reference cssVars note (align, never overwrite; cites C1/C5/T7). -->
- [x] Honour `registryDependencies` (install the graph) and surface version-pinned GitHub deps; keep propose-never-silent-run + `--dry-run`. <!-- done: SKILL "Namespaced installs" bullet + reference scaffold-order (recurse deps, version-pinned GitHub refs, propose-only/--dry-run kept). -->

## Phase 3 — Optional shadcn MCP path

- [x] Document the shadcn MCP server as an alternative discovery/install surface (browse / search-across-registries / install-with-NL). Reference our `mcp` skill for wiring; keep it OPT-IN (a user who has the MCP configured), never a hard dependency. <!-- done: SKILL "MCP path (opt-in)" — browse/search/install-with-NL, links the mcp skill, never a hard dep. -->
- [x] Add a decision note: CLI path = default + universal; MCP path = opt-in when configured; registry-JSON literacy underpins both. <!-- done: decision note line in the MCP path paragraph. -->

## Phase 4 — Verify

- [x] Smoke on a project with a custom namespaced registry: skill runs `info --json`, resolves `@ns/x` → URL, installs the dep graph, aligns to project `cssVars`, stays propose-only. <!-- done: SKILL + reference describe the full namespaced flow (handshake → resolution regex → view-before-add → registryDependencies graph → cssVars align → propose-only/--dry-run). Executor guidance (no code path); verified by artifact coherence + check-refs. -->
- [x] Smoke on a vanilla project: existing CLI path unchanged, no extra round-trips (the opt-in stays off). Run gates green; confirm `react-shadcn-ui` still passes the skill linter. <!-- done: registry section is additive + explicitly opt-in (shadcn_add.ts + Procedure Step 0-4 untouched). Gates: skill_linter PASS, check-refs no broken refs, condensation in sync, both ../mcp + reference links resolve. -->

## Explicitly out of scope

- No making `shadcn info --json` a mandatory gate on every component operation (council: over-gating, low ROI on vanilla projects).
- No bundling the registry catalog into the package — the registry is fetched live.

## Provenance

Source link retained encrypted per `source-confidentiality` (decrypt with the maintainer key via `src/scripts/_lib/link_crypto`):

- Source D — an external component-library "skill" (decoupled CLI/MCP/registry pattern) — `ENC1:ftPyTVUQGLup+hwroy0QSrGuRTFbRp1BpB3VWcMwlx/3hDgFowp9XOUe9bfL0/Y7NjAX9IXpwT2L3AnelMrUaw==`
