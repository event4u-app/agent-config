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

- [x] **1.1 Probe and fill the seven `null` rows** (augment, cursor, cline,
      windsurf, gemini, cowork, copilot) using the existing keys `docs_at`,
      `docs_url`, `probe_at`, `host_version`, `expires`; `expires` follows the
      host's own docs cadence (claude's committed value is 2027-09-06 — no
      blanket 90 days). Cowork's block records what its row comment already
      says (`:165-166`: dispatcher exits 0 unconditionally, host cannot read
      settings).
      verify: `lint_hook_manifest` green; `grep -c 'verified: null' host_lowering.yaml`
      is 0; `tests/scripts/host_lowering_expiry.test.ts` unchanged.

      **Evidence (2026-10-01).** Already satisfied at `9f2b9fb4a` by commit
      `d28ce587a`, verified rather than assumed: all **nine** rows (the seven
      above plus `claude` and a `codex` row that did not exist when this step
      was written) carry a `verified:` block with `docs_at`, `docs_url`,
      `expires`. `grep -c 'verified: null' src/scripts/hooks/host_lowering.yaml`
      → **1**, and `grep -n` shows the single hit is line 13 of the header
      prose (`\`verified: null\` means nobody established anything`), not a row —
      so the row count is 0 as the step requires. `lint_hook_manifest` exits 0
      with 8 warnings, all of them the admissible-but-not-fully-cited
      `verified.host_version is null` note. `host_lowering_expiry.test.ts` is
      unchanged and its 6 tests pass. Cowork's block records exactly what the
      step predicted: `docs_url: null` with the comment stating no public hooks
      page exists to cite.
- [x] **1.2 Every slot has a dated answer.** For each host×slot pair with
      `block_exit: null`, add `answered_at:` and `docs_url:` beside it, or set
      `block_exit`. The bar is "every pair dated", not a refusal count.
      verify: `check_enforcement_matrix --write` regenerates
      `docs/enforcement-by-host.md`; no pair without a date.

      **Evidence (2026-10-01).** Already satisfied at `9f2b9fb4a`, and the bar
      is enforced rather than merely met: `lint_hook_manifest._check_slot_answers`
      makes an undated pair an **error**, not a warning, and the gate is green —
      so "no pair without a date" is now a property the tree refuses to lose,
      not a state this step left behind. `check_enforcement_matrix` reports
      `32 host-slot row(s) in docs/enforcement-by-host.md match
      src/scripts/hooks/host_lowering.yaml`, and every one of the 32 generated
      rows carries an `Answered` cell of `2026-09-29` — no `undated` sentinel
      anywhere in the region. Re-running with `--write` produced no diff, which
      is the stronger reading of "regenerates": the committed table was already
      the generator's output.
- [x] **1.3 Docs digest beside `docs_at`.** Every `verified:` block gains
      `docs_digest: <sha256 of the fetched docs_url body>`; a scheduled job
      (the scorecard workflow of lane 9 § 4.2, or a sibling) re-fetches each
      `docs_url` and, on a digest change, sets `expires: <today>` so the
      existing `lint_hook_manifest._check_host_lowering` (`:685-712`) goes
      red on any blocking binding of that host. No lifecycle vocabulary, no
      auto-adoption of upstream text — a red gate opens a local finding.
      Vendor docs URLs are not harvest subjects and stay plaintext.
      verify: fixture with a changed digest → `lint_hook_manifest` red on the
      bound host; unchanged digest → green; the job's run is committed once.

      **Evidence (2026-10-01).** Landed in four pieces.

      *The watcher.* `src/scripts/check_host_docs_digest.ts` — the consumer the
      table header already named and which did not exist, so the header was a
      forward reference to nothing. Four modes: a no-network offline report,
      `--fetch` (compare, exit 1 on drift), `--fetch --write` (record), and
      `--self-test`. Unknown flags exit 2 naming the known set.

      *The digests.* `--fetch --write --today 2026-10-01` filled **8** of 9
      rows; `cowork` stays `null` because its `docs_url` is `null` and there is
      no body to hash. The write is **8 changed lines, nothing else** —
      `git diff --stat` reported `8 insertions(+), 8 deletions(-)`. That is a
      deliberate property: a `parseDocument` round-trip was tried first and
      **rejected after measurement** — it preserves every comment but
      renormalises the hand-aligned `slots:` flow mappings (361 bytes across 32
      rows), so the watcher now edits the two lines whose content changes and
      nothing else.

      *Reproducibility, checked rather than assumed.* The obvious failure mode
      for a digest watcher is a page carrying a build id or timestamp, which
      makes it permanently red and then muted. A second independent `--fetch`
      returned **8 unchanged, 0 changed**, so none of the eight pages is
      volatile at this granularity.

      *The chain, and its sensitivity.* `tests/scripts/host_docs_digest.test.ts`
      (12 tests) runs the **real** `lint_hook_manifest._check_host_lowering`
      over the **real** writer's output — the verify line's "fixture" is only
      the fetched body, because that is the single input a unit test may not
      reach. Drift on `claude` (the one host with blocking bindings) reds the
      gate naming `claude/any`, the new `expires`, and `pre_tool_use`; drift on
      `cursor` (binds 5 slots, can refuse on none) only warns; unchanged and
      unreachable both leave the table byte-identical. **Seen red twice, for
      two different reasons:** first a genuine defect in the test itself (it
      asserted a no-op write using a digest that was never the committed one,
      so it was not testing a no-op at all), then deliberately — neutralising
      `isDrift` turned 3 of 12 red, which is the sensitivity proof.

      *Correction to this step's own text, recorded not smoothed.* The step
      says the job "sets `expires: <today>`". That is **off by one** and would
      not fire: the gate tests `expires < today`, so `expires: <today>` is still
      valid today. The table header (lines 56-64) already states the correct
      rule — the day BEFORE detection — and the watcher follows the table. The
      test `expires to the day BEFORE detection` pins the off-by-one explicitly
      by showing the same-day value leaves the gate green.

      *The job.* `.github/workflows/host-docs-digest.yml` — weekly (Mon 06:17
      UTC), `permissions: contents: read`, read-only `--fetch` with no `--write`
      and no PR-opening step. Weekly rather than daily because the rows carry
      year-long `expires` values, so a daily run would spend 7× the vendor
      requests for the same finding. `--strict-fetch` is deliberately **not**
      passed: a 503 or an egress-less runner establishes nothing about the page,
      and a watcher that reddened on every flake would be muted within a month.
      The job never writes the table — adopting upstream text automatically is
      the one thing this package must not do, so a red means "go read a page".

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

- [x] **3.1 Assert `smokeProbeEvents()` reaches every host with slots > 0.**
      Extend `tests/install/global_install_hooks_smoke.test.ts` to iterate
      `host_lowering.yaml` rows and fail on a bound host the probe skips.
      verify: test green; a fixture row with slots > 0 and no probe path is red.

      **Evidence (2026-10-01).** Three tests added to
      `tests/install/global_install_hooks_smoke.test.ts`; all green, and the
      existing 200s install smoke is untouched.

      *What was actually missing.* `install_snapshot.test.ts` already asserted
      that every event `smokeProbeEvents()` names IS bound — the **soundness**
      half, "the probe invents nothing". The **completeness** half was checked
      by nothing: a host added to `host_lowering.yaml` with five bound slots and
      never added to `SMOKE_PROBE_SLOTS` passes every pre-existing test, because
      nothing enumerated the table and asked what the list was missing. The
      probe would be correct about everything it mentioned and silent about a
      whole host, which reads as green.

      *Sensitivity, proven on the real file rather than argued.* A `session_start`
      slot was temporarily added to the `codex` row in the committed table and
      the test run: it failed with exactly its intended message —
      `host_lowering.yaml binds slots for codex but the install smoke probe
      never exercises them`. The table was then restored and the tests re-run
      green. A third test carries the same case as a permanent in-process
      negative control, so the assertion cannot be satisfied by today's table
      alone, and a second asserts the converse (nothing with `slots: {}` is
      probed) so it cannot be satisfied by probing everything.

      *One hole found, noted rather than fixed — per `active-remediation`'s
      note tier.* Being in `SMOKE_PROBE_SLOTS` is only **half** of being probed:
      `_smoke_test_hooks` resolves `SMOKE_BRIDGE_PATHS[platform] ?? ''` and
      counts a platform with no entry as `skipped`, so a host could be listed as
      probed and silently never exercised. There is **no live instance** (all
      six listed platforms have a bridge path today), so this is latent. It was
      deliberately not closed here: the constant is unexported, and exporting it
      edits `src/scripts/install.ts`, which reds two committed-build-output
      freshness gates (`build:cli` + `build:install-bundle`) and requires the
      bundle to be rebuilt against a real `node_modules` — this run is in a
      worktree whose `node_modules` is a symlink, which bakes absolute paths
      into the shipped bundle. Paying that for a latent hole is the wrong trade;
      it is recorded in the test file's own comment so the next reader meets it
      instead of rediscovering it.

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
