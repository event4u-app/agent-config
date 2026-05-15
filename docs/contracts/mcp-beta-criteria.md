---
stability: experimental
mcp_scope: lite
---

# MCP Beta Criteria — Promotion Gate (Hard Contract)

> **Status:** Active · governs the `experimental → beta` promotion for
> the MCP surface (`scripts/mcp_server/` local stdio kernel + the
> hosted `workers/mcp/` bridge). Owned by Phase 3 of the
> `road-to-surface-discipline` roadmap (see `agents/roadmaps/`).
> Companion contract:
> [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) (local) ·
> [`mcp-cloud-scope.md`](mcp-cloud-scope.md) (hosted).

## Purpose

The current MCP wording uses `experimental` across READMEs, module
docstrings, and the initialize-result server description. There is no
defined bar for retiring that label. This contract names six gates
that together flip `experimental → beta`. Every gate is **observable**
(test file, doc, or script), **falsifiable** (red is allowed; missing
is not), and **machine-reportable** through `agent-config doctor
--check mcp-beta-readiness` (lands in Phase 3 Step 5).

> **Iron Law:** all six gates must be green for the same release tag
> before any user-visible surface drops `experimental`. A green gate
> sheet on `main` does not authorize a back-dated wording change on a
> release branch that did not also pass the sheet.

## The six gates

Each gate is owned by a single artefact. When the artefact is missing,
Phase 3 Step 3 creates a **failing test** (`pytest.skip("pending: …",
allow_module_level=True)` or `raise NotImplementedError("mcp-beta-gate-N
pending")`) so the AC stays falsifiable.

### Gate 1 — External-client end-to-end run

At least one MCP client **outside this repo's own test harness** has
completed a full session against MCP Lite: `initialize` →
`prompts/list` → `prompts/get` → `resources/list` → `resources/read`
→ shutdown. Evidence is a transcript or recorded session under
`tests/mcp/external-clients/` plus the client name and version
(Claude Desktop ≥ vX, Cursor ≥ vY, Zed ≥ vZ, Continue ≥ vW).

### Gate 2 — Bearer-auth coverage

`tests/mcp/auth/` must cover four cases against the hosted Worker
surface — **happy path**, **401 on missing token**, **401 on expired
token**, **401 → 200 on rotated token**. Each case asserts the wire
envelope shape, not only the status code. Gate fails if any case is
skipped, xfailed, or absent.

### Gate 3 — Lite/Full parity smoke suite

For every primitive the published surface exposes (`prompts/list`,
`prompts/get`, `resources/list`, `resources/read`), a parametrized
test asserts the response body from the hosted Worker (Lite) and the
local stdio kernel (Full) **byte-identical** (modulo the documented
deltas in `mcp-cloud-scope.md § Lite vs Full`). Failure must surface
the diff, not just a boolean.

### Gate 4 — Health endpoint under load

The hosted Worker exposes `/healthz` (or equivalent) that returns a
structured JSON envelope `{status, uptime_s, build_sha,
last_content_refresh}`. A k6 / wrk smoke test in
`tests/mcp/load/healthz.k6.js` proves p95 < 200 ms across 60 s at 50
RPS. The local stdio kernel surfaces the same envelope through a
`server/health` JSON-RPC ping.

### Gate 5 — Abuse / rate-limit plan

`docs/contracts/mcp-rate-limit.md` exists and pins three knobs —
per-token RPS, per-token daily quota, per-IP burst — with a fallback
behaviour on overrun (`429` + `Retry-After`). The Worker enforces the
knobs; a contract test in `tests/mcp/rate-limit/` asserts that
exceeding any knob returns `429` with a non-empty `Retry-After`.

### Gate 6 — Lite ↔ Full no-drift

A nightly CI job runs the Phase 3 Step 3 parity suite (Gate 3) plus a
canary: ingest one prompt and one resource on both surfaces, hash the
body, and assert equality. Drift > 0 fails the job and posts a Slack
ping. Evidence: the workflow file (`.github/workflows/mcp-no-drift.yml`)
**and** at least one successful run within the last 7 days.

## Promotion procedure

1. Open a release-candidate branch named `release/mcp-beta-rcN`.
2. Run `./agent-config doctor --check mcp-beta-readiness` — must
   print all six gates green.
3. Flip the wording in the **five** surfaces inventoried in the
   `road-to-surface-discipline` roadmap (Phase 3 Step 1, under
   `agents/roadmaps/`):
   `docs/mcp-server.md` (status banner + Remote-MCP sub-claim),
   `README.md` (pointer line), `scripts/mcp_server/server.py`
   (initialize-result `serverInfo.name`),
   `scripts/mcp_server/__init__.py` (module docstring `Stability:`).
4. Update the changelog with the gate sheet snapshot.
5. Merge the RC branch through the normal review path. Tag is **not**
   created until the gate sheet is reproducible on the merge commit.

## Demotion procedure

Any single gate going red on `main` for more than 7 consecutive days
demotes the surface back to `experimental` at the next release. This
is a wording-only demotion; no code is reverted. The doctor check
reports the demotion automatically.

## Surface delta

This contract adds **0 new commands**, **0 new skills**, **0 new
personas**. It defines a promotion gate; nothing more. Net surface
delta for Phase 3: ≤ 0.

## Cross-references

- [`mcp-phase-1-scope.md`](mcp-phase-1-scope.md) — local stdio kernel
  hard contract (A0).
- [`mcp-cloud-scope.md`](mcp-cloud-scope.md) — hosted Worker hard
  contract (A0-cloud).
- [`mcp-tool-stub-envelope.md`](mcp-tool-stub-envelope.md) — Phase 1
  discovery contract.
- [`STABILITY.md`](STABILITY.md) — stability tier definitions
  (`experimental` / `beta` / `stable`) and what wording each tier may
  use in user-visible surfaces.
- The `road-to-surface-discipline` roadmap (under `agents/roadmaps/`)
  — Phase 3 acceptance criteria and step-level evidence pointers.
