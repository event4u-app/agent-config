---
complexity: structural
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap, no blocker. Three live wrong-output defects in what the installer and doctor report about the host — a listing override computed without the host's inputs, a hook status that reads bound under a policy that disables it, and no visibility of a foreign gateway."
estate_offset_exempt: "The nearest owner, road-to-an-installed-layer-that-is-thinned, governs payload size, not whether the override formula matches the host; road-to-placeholders-on-the-wire receives only a criteria amendment (Phase 3.3). Archiving an unrelated finished file to buy the slot would hide the growth."
relates:
  - slug: road-to-placeholders-on-the-wire
    relation: extends
    note: "Step 3.3 amends that roadmap's 7.2 probe criteria and 7.6 start check; it builds nothing there."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: "Phase 2 touches the same global settings file but not the payload size."
  - slug: road-to-seats-that-know-why-they-failed
    relation: disjoint
    note: "Same source round; split because these defects are host-surface correctness, not council failure handling."
---
# Road to host inputs the installer honours

> **Source:** `agents/tmp.old/inbox-2026-10-y/` — the same round as
> `road-to-seats-that-know-why-they-failed`. Host facts were read from Claude Code 2.1.304 by
> the strings method `docs/setup/host-traffic-environment.md` documents, by the supplied plan,
> and are **not re-read here** — each Phase 1 probe re-establishes the one it needs against the
> then-current host. Tree facts were re-verified against `origin/main@447f8fd` on 2026-10-22.

## Goal

What the installer writes and what `doctor` reports about the host is computed from the
inputs the host itself uses. Today the listing override ignores three of them, a managed
policy can switch off every hook while `doctor` reports them bound, and nothing can say that
Claude Code is talking to a foreign gateway.

## Context — reproduced on this tree

| # | Defect | Evidence | State |
|---|---|---|---|
| H1 | The installer writes `skillOverrides` from `computeOverrides`, which calls `modelListingBudget` with a fixed `contextWindowTokens: 200_000` and the default fraction. `host_listing_model.ts` already accepts a `fraction` input; nothing passes one. The host computes with the real model window, the user's `skillListingBudgetFraction`, and lets `SLASH_COMMAND_TOOL_CHAR_BUDGET` replace the formula (0 matches for that variable under `src/` and `docs/`). A user who raises the fraction so descriptions stay visible has them taken away again as `name-only`. Two further fixed windows: `compute_skill_tiers.ts:134`, `report_skill_host_census.ts:67`. | `src/scripts/_lib/skill_listing_overrides.ts:107`, called from `install.ts`; `_lib/host_listing_model.ts` | live |
| H2 | A managed policy can silence every hook unseen. `allowManagedHooksOnly` and `disableAllHooks` have 0 matches under `src/` and `docs/`. The host then skips unmanaged hooks, while `hook_effect_doctor` runs hooks synthetically and reports them bound — green where it should be red. | grep; `src/scripts/hook_effect_doctor.ts` | live, false green |
| H3 | Host and model are one axis in the tree. `ANTHROPIC_BASE_URL` has 0 matches under `src/` and `docs/`; `doctor` cannot say Claude Code is behind a gateway, where the tier mapping means whatever the gateway makes of it; the capability matrix sets column = host = vendor. | grep; `_lib/model_tier.ts`; `agents/evidence/cross-model-capability-matrix.md` | live, visibility |
| H4 | The 7.2 probe of the planned request gateway does not check four things the host already exposes: (a) start behaviour when `ANTHROPIC_BASE_URL` already points at a foreign gateway; (b) the request-class header (`main`, `subagent`, `workflow`, `compaction`, `auxiliary`, `side_reply`) that would make compaction recognisable without parsing bodies; (c) a terms-of-use axis for forwarding a subscription login; (d) a list of host features that switch off behind a foreign gateway. | `agents/roadmaps/road-to-placeholders-on-the-wire.md` 7.2 / 7.6 | live, before the build |

## Phase 1 — Red probes first

- [ ] **1.1 Override against host inputs (H1).** Three fixtures: `SLASH_COMMAND_TOOL_CHAR_BUDGET`
  set; `skillListingBudgetFraction: 0.03`; window 1,000,000. Expected today: the same
  `name-only` set in all three.
  verify: three red cases against `computeOverrides`.
- [ ] **1.2 False green under policy (H2).** A `managed-settings.json` fixture with
  `allowManagedHooksOnly: true` in a sandbox root. Expected today: `hook_effect_doctor` reports
  the hooks bound.
  verify: the test is red at the base commit.

## Phase 2 — The listing override uses the host's inputs (H1)

- [ ] **2.1 Host order.** `computeOverrides` reads the three inputs in the host's order: a set
  `SLASH_COMMAND_TOOL_CHAR_BUDGET` replaces the formula; otherwise the user's
  `skillListingBudgetFraction` applies; the window comes from a known source, else 200,000 as
  the host default with `window_source: host-default` in the result.
  verify: 1.1 green.
- [ ] **2.2 Inputs recorded.** The `skill-overrides.json` sidecar records the inputs used;
  `doctor` shows them, and when an input later differs it reports "overrides computed with
  other inputs" and writes nothing.
  verify: changing the fraction after install makes `doctor` report it, with the settings file
  byte-identical.
- [ ] **2.3 No override when everything fits.** When the user raised the fraction and all owned
  descriptions fit the new budget, no `name-only` entry is written.
  verify: a fixture with a raised fraction under which every owned description fits yields an
  empty override set.
- [ ] **2.4 The two other fixed windows** read the same source as 2.1; a report that must mean
  the host default instead says so in a one-line reason beside the constant.
  verify: no non-test `200_000` under `src/scripts/` stands without the shared source or its
  one-line reason.

## Phase 3 — Behind a gateway: make it visible, change no behaviour (H3, H4)

- [ ] **3.1 `doctor` line `model_route`.** When `ANTHROPIC_BASE_URL` is set, show the origin
  only — never path, query or token — whether model discovery or tier variables are set, and
  the sentence that this package's tier names, cache economy and cost claims describe Claude
  models and do not hold behind a gateway. The package writes none of these variables (K2).
  verify: a URL carrying a token in its query prints as its origin alone.
- [ ] **3.2 The capability matrix gains the host × model-vendor axis**; the cell "Claude Code ×
  foreign model" reads `UNKNOWN — host same, model foreign`, not a Claude row.
  verify: the matrix lint requires both axes.
- [ ] **3.3 Amend `road-to-placeholders-on-the-wire` 7.2 / 7.6** (a fold, no new plan) with the
  four checks of H4: (a) refuse to start and name the foreign origin when
  `ANTHROPIC_BASE_URL` is already set (decision A1); (b) the launcher sets the gateway hint
  header and selects rewrite reach by request class, and the probe checks that `compaction`,
  `auxiliary` and `side_reply` arrive at the pinned host; (c) a terms-of-use criterion for a
  subscription login forwarded over a loopback base URL, with a documented source; (d) the
  feature list that switches off behind a foreign gateway, each row to be checked at the pin.
  verify: the 7.2 section names all four points with a host pin.
- [ ] **3.4 Check one claim before writing it.** S1 claims that
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` suppresses gateway model discovery; the supplied
  plan could not attribute it in the binary. Check it with the page's own strings method, then
  add the line to `docs/setup/host-traffic-environment.md` or record the claim as refuted.
  verify: the result, in either direction, is recorded on that page with the host version.

## Phase 4 — A policy-aware hook doctor (H2)

- [ ] **4.1 Read the readable policy sources** — the managed-settings file under
  `/etc/claude-code/` and the Windows program directory. When one of them sets
  `allowManagedHooksOnly` (or `disableAllHooks`), every bound finding carries the cause
  `suppressed-by-policy`. Registry and MDM sources are not file-readable: there the result says
  `policy: unknown`, never "ok". No sixth state.
  verify: 1.2 green; a fixture without a policy is unchanged.

## Kill register

| # | Not done | Why |
|---|---|---|
| K1 | Taking code, prompts or text from S1 | AGPL-3.0-only vs MIT; ideas only, re-derived |
| K2 | Detecting a gateway and changing behaviour, or writing any `ANTHROPIC_*` variable | report only (3.1); any behaviour change is its own decision |
| K3 | Installing RTK or a compression proxy through the installer | `rtkDetection.ts` exists; compression proxies were declined in earlier rounds |
| K4 | A proxy or launcher for foreign agents, a model catalogue, an admin UI | the package is not a router |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | When the package's own request gateway starts and `ANTHROPIC_BASE_URL` already points elsewhere, v1 refuses and names the origin; chaining two gateways is not planned | a second gateway sits outside the threat model of `road-to-placeholders-on-the-wire` 7.3; refusing keeps today's data path unchanged | an owner decision asks for chaining |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The override set changes on existing installs | product | Phase 2 alters which skills are written `name-only` for someone already installed. | The "only what we wrote" sidecar logic stays; recomputation only on `install`, `doctor` only reports (2.2). | Phase 2 — The listing override uses the host's inputs (H1) |
| 2 | Host internals move | implementation | The budget formula or the request-class list changes in a later host version. | Every host fact carries its host version; each Phase 1 probe re-reads at the then-current host. | Phase 1 — Red probes first |
| 3 | `doctor` leaks a gateway token | implementation | The gateway URL carries a token in its path or query and is printed. | 3.1 prints the origin only, with a test on a token-bearing URL. | Phase 3 — Behind a gateway: make it visible, change no behaviour (H3, H4) |

## Acceptance Criteria

- [ ] AC-1 Both Phase 1 probes are committed red before any change and green afterwards.
- [ ] AC-2 The `skillOverrides` set matches the host formula in all three fixture cases (2.1).
- [ ] AC-3 `doctor` reports neither "bound" without a policy status nor a gateway token (3.1, 4.1).
- [ ] AC-4 The 7.2 probe of `road-to-placeholders-on-the-wire` names the four host checks (3.3).
