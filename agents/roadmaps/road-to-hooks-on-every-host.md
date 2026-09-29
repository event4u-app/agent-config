---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane 7 of road-to-leading-every-row"
relates:
  - slug: road-to-host-catalogue-contract
    relation: extends
    note: "parked; the per-row verified block this lane fills is its catalogue shape"
  - slug: road-to-delivery-for-every-host
    relation: extends
    note: "archived 30/30 — rule delivery to every host; this lane is about lifecycle slots, which it left at 0 for codex/copilot"
---
# Road to hooks on every host

> **Source:** ten-package code audit (2026-09-28), rows Host portability 5,
> Gate reachability 4 against S8 at 8 (one hook script serving four hosts)
> and S9 at 7 (21 capability descriptors with cited evidence). Tree facts at
> `8de8a4c`: `src/scripts/hooks/host_lowering.yaml` (185 lines) has rows for
> `claude, augment, cursor, cline, windsurf, gemini, cowork, copilot` — **no
> `codex` row** (deliberate, `docs/enforcement-by-host.md:176-179`, no
> `platforms.codex` in `hook_manifest.yaml:1368-1556`); `verified:` is a
> per-row block `{docs_at, docs_url, probe_at, host_version, expires}`
> (`:57-62`), filled for claude only (expires 2027-09-06), `null` on seven
> rows; the expiry/unverified gate is `lint_hook_manifest._check_host_lowering`
> (`:664-690`); claude configures refusal on 3 of 32 host×slot pairs
> (`enforcement-by-host.md:38,193`); `install.ts:1579-1605` already runs a
> per-platform `smokeProbeEvents()` from `host_lowering.yaml`.

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

Every row in `host_lowering.yaml` carries a dated `verified:` block in the
existing shape; every slot has a dated answer (`block_exit` set or a
documented `null` with `docs_url`); a codex row exists if and only if the
host documents lifecycle hooks; and the install smoke probe covers every host
with slots > 0 — so a "0" in the enforcement table is a fact about the host
with a date on it.

## Prerequisites

- Lane 2 Phase 1 landed (edits to `host_lowering.yaml` go through the
  ratified-edit path).

## Phase 1 — Fill the verified blocks

- [ ] **1.1 Probe and fill the seven `null` rows** (augment, cursor, cline,
      windsurf, gemini, cowork, copilot) using the existing keys `docs_at`,
      `docs_url`, `probe_at`, `host_version`, `expires`; `expires` follows the
      host's own docs cadence (claude's committed value is 2027-09-06 — no
      blanket 90 days). Cowork's block records what its row comment already
      says (`:165-166`: dispatcher exits 0 unconditionally, host cannot read
      settings).
      verify: `lint_hook_manifest` green; `grep -c 'verified: null' host_lowering.yaml`
      is 0; `tests/scripts/host_lowering_expiry.test.ts` unchanged.
- [ ] **1.2 Every slot has a dated answer.** For each host×slot pair with
      `block_exit: null`, add `answered_at:` and `docs_url:` beside it, or set
      `block_exit`. The bar is "every pair dated", not a refusal count.
      verify: `check_enforcement_matrix --write` regenerates
      `docs/enforcement-by-host.md`; no pair without a date.
- [ ] **1.3 Docs digest beside `docs_at`.** Every `verified:` block gains
      `docs_digest: <sha256 of the fetched docs_url body>`; a scheduled job
      (the scorecard workflow of lane 9 § 4.2, or a sibling) re-fetches each
      `docs_url` and, on a digest change, sets `expires: <today>` so the
      existing `lint_hook_manifest._check_host_lowering` (`:685-712`) goes
      red on any blocking binding of that host. No lifecycle vocabulary, no
      auto-adoption of upstream text — a red gate opens a local finding.
      Vendor docs URLs are not harvest subjects and stay plaintext.
      verify: fixture with a changed digest → `lint_hook_manifest` red on the
      bound host; unchanged digest → green; the job's run is committed once.

## Phase 2 — Codex and copilot: a row only with evidence (D5)

- [ ] **2.1 Host documentation check, recorded.** Read the hosts' own hook
      documentation for codex and copilot (vendor docs are not harvest
      subjects; plaintext `docs_url` is fine); record the result as a
      `## Decisions` row here.
      verify: D1 below carries `resolved by: evidence` with the `docs_url`.
- [ ] **2.2 If codex exposes lifecycle hooks:** add `platforms.codex` to
      `hook_manifest.yaml`, a `codex` row to `host_lowering.yaml` with a
      `verified:` block, `src/scripts/hooks/codex-dispatcher.sh` in the shape
      of the six existing shims (65–117 lines), the trampoline constant in
      `install.ts` (`*_DISPATCHER_TRAMPOLINE`, `:911-1283`) and the deny
      shape in `host_semantics.ts`. If not: the enforcement table's codex row
      gets `answered_at` and the `docs_url` that says so.
      verify: either `tests/hooks/permission_decision.test.ts` gains a codex
      deny fixture and the install smoke covers codex, or the dated zero.
- [ ] **2.3 Same for copilot** (today `platforms.copilot: {ask: text,
      fallback_only: true}`, `hook_manifest.yaml:1554-1556`).
      verify: as 2.2.

## Phase 3 — Smoke covers every bound host

- [ ] **3.1 Assert `smokeProbeEvents()` reaches every host with slots > 0.**
      Extend `tests/install/global_install_hooks_smoke.test.ts` to iterate
      `host_lowering.yaml` rows and fail on a bound host the probe skips.
      verify: test green; a fixture row with slots > 0 and no probe path is red.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Codex/copilot rows are added only if the host's own documentation names lifecycle hooks; otherwise a dated zero | `docs_url` recorded in 2.1 | the host publishes hooks |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Host docs change after the block expires | implementation | A bound slot stops firing | `lint_hook_manifest._check_host_lowering` already refuses an expired row carrying a blocking binding | Phase 1 — Fill the verified blocks |
| 2 | Network needed to read vendor docs | implementation | 2.1 cannot run offline | Class-1 blocker if the run is offline; the step records the URL, not the page | Phase 2 — Codex and copilot: a row only with evidence (D5) |

## Acceptance Criteria

- [ ] AC-1 — No `verified: null` in `host_lowering.yaml`; `lint_hook_manifest`
      green.
- [ ] AC-2 — Every host×slot pair carries `block_exit` or a dated `null` with
      `docs_url`; the enforcement table regenerated; every `verified:` block
      carries `docs_digest` and the re-fetch job has run once.
- [ ] AC-3 — Codex and copilot each have a row with a verified block or a
      dated zero, per D1.
- [ ] AC-4 — The install smoke test iterates every bound host.

## Provenance

Source-derived (template rule 19). Pre-council draft.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S9 — phase-loop reference | `ENC1:<mint>` | per-host capability descriptors with cited evidence and expiry (defect: seven null rows) |
| S8 — LSP toolkit reference | `ENC1:<mint>` | one hook script, four hosts by event-name translation (2.2's shim shape) |
| S6 — spec-scaffolding reference | `ENC1:<mint>` | negative control: 41 hosts as config dicts with untested behaviour |
| S7 — best-practice curation | `ENC1:<mint>` | upstream doc-drift checklists against official host docs (1.3's digest watcher is the machine-owned form) |

Gap-table: KEEP 1.1–1.2, 2.1–2.3, 3.1; CUT "per-slot verified schema"
(shape is per-row with seven consumers), "`lint_host_lowering`" (the gate is
`lint_hook_manifest`), "refusal on ≥ 6 of 9 slots" (pre-commits a probe
result), "per-host CI matrix" (`tests.yml:66-74` is os×shard; the smoke probe
is in `install.ts`).
