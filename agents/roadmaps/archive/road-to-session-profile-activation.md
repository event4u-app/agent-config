---
status: active
complexity: structural
---

# Road to Session-Profile Activation

> Let a developer **activate a profile for the current session** (e.g. Laravel,
> Developer, PO) so the matching packs — and the commands/skills/rules they
> bundle — are the surfaced set, then switch freely without persisting the
> choice. Reuse the existing `pack` axis as a session overlay; never invent a
> fifth axis (ADR-010). Ship a recommendation-bias MVP first; gate execution
> only if the host agent can support it.

## Goal

A `/profile`-family command set that writes an **ephemeral** `runtime.active_packs`
overlay (the active profile expanded to its pack closure), and a runtime filter
that surfaces only the active packs' commands/skills in `/help` +
`<available_skills>`. Install everything once → switch profiles per session →
see the right surface. Session-scoped: the overlay does not leak into committed
config and resets per the session-boundary decision locked in Phase 0.

## Context

The suite already has **four orthogonal axes** (ADR-010, "a knob belongs to
exactly one axis; duplication is a contract violation"), resolution chain
`pack → profile → preset → rule_loading_tier → user/env/runtime overrides`:

- **profile** — audience id (founder/developer/…); default surface + persona pre-selection.
- **preset** — governance band (fast/balanced/strict).
- **pack** — installable bundle, a frozen 4-tuple `profile + preset + allow_skills + allow_commands`, with `requires_hint` deps (laravel → php → engineering-base). **A pack already bundles its commands.**
- **rule_loading_tier** (formerly `cost_profile`, renamed in PR #321) — minimal/balanced/full, selects rule TIERS.

Current facts the design must respect:
- **Rules** load by tier only (router `dist/router.json`, trigger-activated) — not by pack/profile.
- **Commands/skills** carry `packs:`/`workspaces:` frontmatter, but gating is **install-time only** (file exists or not). **No runtime/session availability filter exists yet** — that layer is the core new build.
- **`/mode`** is the nearest "activate X" precedent but **persists** to `.agent-settings.yml` and only gates output compliance, not artefact availability.
- Session plumbing that exists: `.agent-settings.local.yml` (gitignored, deepest-winning layer), `agents/runtime/state/*.json`, and a `session_start` hook event. There is **no reliable session-end hook**.

The council (claude-sonnet-4-5 + gpt-4o, deep tier, 2026-06-01) converged: reuse the pack axis as a session overlay (no new axis); ship a recommendation-bias MVP (filter `/help` + `<available_skills>`, do NOT gate execution); defer hard execution-gating and auto-cleanup to a host-capability assessment; and **lock the meaning of "session-only" before any code** — it is architecturally undefined today (no session boundary the agent can detect).

## Phase 0 — Lock semantics + host-capability audit (BLOCKING)

Goal: remove the two ambiguities that make every later phase unimplementable.

### Locked decisions (2026-06-02)

Phase-0 council (claude-sonnet-4-5 + gpt-4o, deep tier / 3 rounds, actual
spend $0.11; trace `agents/runtime/council/responses/session-profile-phase0.json`). <!-- council-ref-allowed: ADR decision-trace to originating council response -->
Both members **blocked the naive design and converged** on the calls below.

- **0.1 → option (a)** `/profile deactivate` (task-scoped; survives IDE
  restart). **Rejected (b)** (`session_start` clears overlay). Rationale:
  the host builds the command/skill registry **once** at `session_start`,
  *before* any reset hook can run — so (b) cannot narrow the next session,
  it only resets invisibly (the registry-refresh Catch-22). Honest v1 =
  explicit deactivate. To approximate the user's "session-only" intent
  without the broken silent reset, `session_start` emits a **staleness
  notice** (not a reset) when an overlay is carried over from a prior
  session: *"profile X still active from a previous session — `/profile
  deactivate` to clear."*
- **0.4 → option (iii)** command/skill surfacing only for v1.
  **Rejected (ii)** (profile sets an ephemeral `rule_loading_tier`):
  letting a UX convenience override a governance/security control is a
  CVE waiting to happen (a `strict`-tier rule silently dropped by a
  profile). **Rejected (i)** ("defer with rationale") as dishonest
  procrastination. Disposition is a **hard scope decision** with a
  forcing-function falsifiability test (see Phase 3.2).
- **0.5 mapping** — activatable token is a **pack id** *or* a named
  session-profile alias; activation expands the `requires_hint` transitive
  closure from `config/discovery/packs.yml`. Aliases live in
  `config/discovery/session-profiles.yml` (new): `laravel → {laravel}`,
  `developer → {engineering-base + installed language packs}`,
  `po → {product-basic, product-discovery}`, etc. Only **installed** packs
  are activatable (fail-fast otherwise). This is a runtime modulation of
  the existing `pack` axis, not a new axis (see 0.3 / ADR addendum).
- **Folded must-haves (from the council block-list) → Phase 1:** atomic
  overlay write; schema-validated, **fail-open** overlay read (corrupt /
  unparseable → ignore, full surface returns); stale pack-id in overlay →
  ignore + warn; `/profile show` as the observability surface; cross-pack
  invocation notice at dispatch; kill-switch = delete the overlay key.

- [x] **0.1** Lock the **"session-only" deactivation trigger**. Decide which of: (a) explicit `/profile deactivate` only (task-scoped, survives IDE restart), (b) cleared by the `session_start` hook at each new session start (true session-scope, using existing plumbing), (c) TTL expiry. Record the decision + rationale in this roadmap; the user's stated intent is "only for the active session" → (b) is the leading candidate iff `session_start` fires per the user's notion of a session.
- [x] **0.2** **Host-capability audit.** For each target host (Claude Code first, then Cline/Cursor/etc. as installed): does it expose a stable session/conversation id? Does `session_start` fire per-conversation, per-IDE-window, or per-process? Is there any **mid-session refresh** of the command/skill registry, or is it built once at session start? Capture findings in `agents/settings/contexts/`. This decides whether (b) is real and whether Phase 2 hard-gating is even possible.
- [x] **0.3** **ADR-010 addendum** (`docs/decisions/`): clarify that a `runtime.active_packs` overlay is **not a fifth axis** — it is an ephemeral instance of the chain's existing `…→ user/env/runtime overrides` link that modulates the `pack` axis. No orthogonality violation. Cite the resolution chain.
- [x] **0.4** **Rule-gating disposition** (do not silently drop it — the user asked for rules too). Decide one: (i) defer rule gating with a written rationale (rules are trigger/tier-activated, lack `packs:` frontmatter, no per-session surface), or (ii) let profile activation also set an ephemeral `rule_loading_tier` override in the same overlay, or (iii) confirm with the user that command/skill surfacing alone is enough for v1. Record the choice.
- [x] **0.5** **Profile → pack-set mapping.** Define the named profiles the commands expose and the pack closure each maps to (e.g. `laravel → {laravel, php, engineering-base}`, `developer → {engineering-base + language packs}`, `po → {product-basic, product-discovery}`). Source the closure from `config/discovery/packs.yml::requires_hint`. Only installed packs are activatable.

## Phase 1 — Recommendation-bias MVP (no host changes required)

Goal: switch profile per session → the active packs' commands/skills are the surfaced set; execution stays open with a notice. Gated on Phase 0 decisions.

- [x] **1.1** Overlay schema + writer: store `runtime.active_packs: [...]` (the expanded closure) in `.agent-settings.local.yml` (gitignored, deepest-winning layer) per the Phase-0.1 lifecycle decision. If 0.1 = (b), also wire the `session_start` hook to clear it.
- [x] **1.2** `/profile` command cluster (orchestrator + sub-commands): `activate <name>` (resolve closure via `requires_hint`, fail-fast if a pack is not installed), `deactivate [name]` (cascade rules: refuse to remove a transitive dep that a still-active profile needs), `show` (active profiles + expanded pack list). Mirror the `/mode` UX shape but write the overlay, not `.agent-settings.yml`.
- [x] **1.3** Recommendation-bias filter: when an overlay is active, `/help` and the `<available_skills>` surface show only commands/skills whose `packs:` intersect `active_packs` (unscoped/core artefacts always shown). **Execution is NOT gated** — typing an inactive-pack command still runs, with a one-line notice ("from inactive pack X; `/profile activate X` to surface it").
- [x] **1.4** Transitive-dep + conflict handling per Phase 0.5: activation expands the `requires_hint` closure; store the expanded set; document deactivation cascade behaviour.
- [x] **1.5** Tests: activate → `/help` shows only the closure + core; inactive command runs with notice; deactivate → full surface returns; overlay never written to a committed file; (if 0.1=(b)) a simulated `session_start` clears it.
- [x] **1.6** Docs: a short `docs/` section + `--profile=<id>` reconciliation (the existing single-session CLI flag) so the two mechanisms don't drift.

## Phase 2 — Hard execution gating (CONDITIONAL on Phase 0.2)

Goal: actually block inactive-pack commands, not just hide them. Only if the host audit (0.2) shows it is achievable without a multi-month host-protocol dependency.

- [-] **2.1** Pre-execution check in the command router: if a command's pack ∉ `active_packs`, refuse with an activate-suggestion. <!-- cancelled: 0.2 audit found NO host with a mid-session registry refresh or a pre-execution veto hook (Claude/Augment/Cursor/Cline/Gemini all build the registry once at session start). Hard-gating would be a half-gate. Re-open trigger: any host ships a pre-exec veto hook → new roadmap. Acceptance-criteria-sanctioned cancellation. -->
- [x] **2.GATE** Decision: if 0.2 found no host support for mid-session registry refresh / gating, mark 2.1 `[-]` cancelled with the host-RFC follow-up recorded; do not build a half-gate. <!-- decided 2026-06-02: 0.2 found no host support → 2.1 cancelled; host-RFC follow-up = re-audit trigger in agents/settings/contexts/session-host-capability-audit.md. -->

> **Phase 2 outcome:** cancelled-with-rationale, not half-built — exactly the acceptance criterion ("Execution-gating ships only if the host supports it"). The recommendation-bias MVP (Phase 1) is the shipped surface.

## Phase 3 — Deferred (recorded, not built unless re-opened)

These are out-of-scope for **this** roadmap by design (the section title);
each is cancelled here with a recorded **re-open trigger**, so nothing is
left in an undecided state and the watch-list survives in the archive.

- [-] **3.1** Auto-cleanup on true session end — requires a host `session_end` lifecycle event (RFC to host maintainers). Until then, the Phase-0.1 mechanism is the ceiling. <!-- cancelled: no universal session_end (absent on Windsurf, not firing on Cowork — 0.2 audit). Re-open trigger: a reliable cross-host session_end lands. Ceiling today = explicit /profile deactivate + staleness notice. -->
- [-] **3.2** Rule gating by pack — only if Phase 0.4 chose (ii); otherwise stays deferred with the 0.4 rationale. <!-- cancelled: 0.4 chose (iii) command/skill surfacing only — rules load by tier+trigger, no packs: frontmatter; pack→rule gating would let a profile override a governance control. Re-open trigger: the 90-day falsifiability test (below) produces ≥1 qualifying issue. -->
- [-] **3.3** Mid-session host command-list refresh — host-protocol dependency; blocks any "instant re-surface without restart" UX. <!-- cancelled: no host rebuilds its registry mid-session (0.2 audit). Re-open trigger: any host ships mid-session registry refresh. -->

### 3.2 forcing-function — rule-gating falsifiability test

The disposition (0.4 → option iii) is falsifiable, not a silent drop. If
pack-scoped rule gating is genuinely needed, open an issue with: (1) the
user story, (2) why `rule_loading_tier` does not solve it, (3) an example
rule that should toggle by profile. **Zero qualifying issues in 90 days
(by 2026-09-02) → the non-requirement is confirmed** and 3.2 stays closed.

## Acceptance Criteria

- A user can `/profile activate laravel`, see only Laravel/PHP/engineering-base + core commands in `/help`, switch to `/profile activate po`, and the surface changes — within one session, with nothing written to a committed config file.
- The overlay is an ADR-010-compliant runtime modulation of the `pack` axis (addendum landed), not a new axis.
- "session-only" has one locked, documented meaning (Phase 0.1) and the host-capability reality is recorded (Phase 0.2).
- Rule-gating disposition is explicit (Phase 0.4), never silently dropped.
- Execution-gating (Phase 2) ships only if the host supports it; otherwise it is cancelled-with-rationale, not half-built.

## Council review (2026-06-01)

Deep-tier council (claude-sonnet-4-5 + gpt-4o), one round of independent review on the design question. Actual spend $0.09.

### Convergence

- **Reuse the pack axis as a session overlay — no fifth axis.** A "Laravel profile" is the `laravel` pack + its `requires_hint` closure; a `runtime.active_packs` overlay modulates the existing `pack` axis (the chain's `…→ runtime overrides` link), so ADR-010's no-duplication rule holds. (both members)
- **MVP = recommendation-bias, not hard gating.** Filter `/help` + `<available_skills>` to active packs; do NOT gate execution. Achievable today with no host-agent changes. (both members)
- **Lock "session-only" before any code.** No reliable session boundary exists; the requirement is undefined until the deactivation trigger + host session-lifecycle are pinned. (claude-sonnet-4-5, gpt-4o concurs on clarifying session vs persistence)
- **Write the overlay to `.agent-settings.local.yml` (gitignored), never `.agent-settings.yml`.** `/mode`'s persist-to-disk is the antipattern to avoid. (both)

### Convergence findings

1. **Pack-axis reuse, no new axis** — profile-name → pack closure via `requires_hint`. · trace: §claude R3 §2/§5, §gpt-4o pt.1
2. **Recommendation-bias MVP** — filter surface, leave execution open + notice. · trace: §claude §6 Revised Phase 1, §gpt-4o pt.4
3. **Session boundary is the crux** — define the deactivation trigger; audit host session lifecycle. · trace: §claude §3/§4, §gpt-4o pt.3
4. **Don't silently drop rule gating** — decide defer-with-rationale vs profile→rule_loading_tier override. · trace: §claude §4D
5. **ADR-010 addendum** — runtime overlay is not a new axis. · trace: §claude §7.4
6. **Hard gating + auto-cleanup are host-dependent** — defer to a capability audit / RFC. · trace: §claude §4B/§6 Defer, §gpt-4o pt.2

### Divergences (no consensus)

- **Build Phase 1 now vs. block on research.** claude-sonnet-4-5: do NOT build until session-identity + gating-vs-recommendation are resolved (Phase 0 first). gpt-4o: build the lightweight recommendation MVP in parallel with research. → resolved in this roadmap by making Phase 0 BLOCKING but scoping it to two concrete decisions, not open-ended research.

### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Pack-axis reuse, no new axis | `accept` | matches ADR-010 resolution chain (`…→ runtime overrides`) + packs are 4-tuples with `allow_commands` |
| 2 | Recommendation-bias MVP | `accept` | command/skill gating is install-time today; a `/help` + `<available_skills>` filter is the only host-independent path |
| 3 | Lock "session-only" first | `accept` | no session-end hook exists; `session_start`-clears-overlay is a viable true-session mechanism the council under-weighted → Phase 0.1/0.2 |
| 4 | Don't drop rule gating | `accept` | user asked for rules; rules lack `packs:` frontmatter → explicit disposition in Phase 0.4 |
| 5 | ADR-010 addendum | `accept` | prevents a future "is this a 5th axis?" relitigation → Phase 0.3 |
| 6 | Hard gating host-dependent | `accept-with-modification` | host builds the registry at session start; mid-session refresh `needs-verification` → Phase 0.2 audit gates Phase 2 |

### Predecessor council trace

`agents/runtime/council/responses/session-profile-activation-roadmap.json` (this run).
