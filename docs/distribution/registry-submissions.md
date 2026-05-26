---
stability: beta
keep-beta-until: 2026-08-26
roadmap_ref: road-to-adoption-proof-and-ci-green.md
---

# Registry Submissions — tracking sheet

> Phase C Step 2 of [`road-to-adoption-proof-and-ci-green.md`](../../agents/roadmaps/road-to-adoption-proof-and-ci-green.md).
> Post-submission tracking sheet. The submission shape, schedule, and
> the maintainer's automation contract live in
> [`registries.md`](registries.md); this file is the operational
> ledger.

## Why a separate tracking sheet

`registries.md` defines **what** to submit (the entry template, the
audit cadence, the GitHub Discussions setup). This file records
**what happened** — one row per submission, with status, link, and
maintainer notes. Splitting them keeps `registries.md` editable as
the submission shape evolves; this file accumulates history.

## Status legend

| Status | Meaning |
|---|---|
| `pending` | Pre-submission. Entry text staged but the maintainer has not opened the PR / submitted the form yet. |
| `submitted` | PR opened or form submitted. Awaiting upstream review. |
| `accepted` | Upstream merged the PR or accepted the directory entry. |
| `rejected` | Upstream declined. Maintainer notes the reason. |
| `stalled` | ≥ 60 days in `submitted` with no upstream response. Treated as effectively `rejected` for adoption-tracking purposes. |

## Tracking rows

| # | Registry | Submission shape | Status | PR / form URL | Date | Maintainer notes |
|---|---|---|---|---|---|---|
| 1 | `punkpeye/awesome-mcp-servers` | One-line entry under agent-tooling section; PR via `scripts/mcp_registry_submit.sh` | `pending` | — | — | Scaffold ready. Run `bash scripts/mcp_registry_submit.sh --dry-run` once before live; the live path needs the maintainer's GitHub identity. |
| 2 | `mcp.so` | Directory form submission (web form, no programmatic API) | `pending` | — | — | Form URL: <https://mcp.so/>. Submission shape: same one-line entry, paste into the form's `description` field. |
| 3 | `mcpservers.org` | Directory form submission (web form, verify URL at submission time) | `pending` | — | — | Form URL: <https://mcpservers.org/>. Submission shape: one-line entry; check the site is live before posting. |

## How to update a row

When a row transitions:

1. **`pending` → `submitted`.** Set `Status: submitted`, `Date: YYYY-MM-DD`, `PR / form URL: <link>`. Add one-sentence maintainer note (e.g. "PR #142; reviewer assigned").
2. **`submitted` → `accepted`.** Set `Status: accepted`. Append the merge timestamp to the maintainer notes. Cross-link the merge commit / form-confirmation in the notes.
3. **`submitted` → `rejected`.** Set `Status: rejected`. Append the reviewer's stated reason verbatim (or paraphrase if the conversation is verbal).
4. **`submitted` → `stalled`.** Set `Status: stalled` once the row has been in `submitted` for ≥ 60 days with no upstream movement. The agent's `task adoption:status` (Phase C Step 6) flags any `stalled` row.

The dates are UTC.

## Maintainer-side checklist

Before flipping a row from `pending` to `submitted`:

- [ ] The `README.md` hero block is current (no stale claims about deferred features).
- [ ] `task ci:status --branch main` is green (per `ci-green-floor.md`).
- [ ] The submission template in `registries.md` § Submission template matches the package's current positioning.
- [ ] The PR body (or form description) cites concrete reality, not aspiration — `task adoption:status` outputs the recent green-check tally + npm install delta the maintainer can paste into the submission.

If any row stays `pending` for more than four weeks, the maintainer
re-validates the readiness checklist; positioning that was current
in week 1 can age out by week 4.

## Adoption-tracking signal

Each row's status contributes to the adoption-dimension score
tracked in
[`road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md)
Phase 0 § Adoption surface:

- ≥ 1 row in `accepted` — adoption-dimension lifts from "scaffolded"
  to "evidence" for the next review round.
- ≥ 2 rows in `accepted` — registries are no longer the bottleneck;
  next adoption-dimension lift requires recruit-session reports
  (Phase B of this roadmap).
- All rows in `pending` after four weeks — the bottleneck is the
  human-owner action, not the scaffold; the scaffold is solid.

## See also

- [`registries.md`](registries.md) — submission template + audit cadence + Discussions setup.
- [`scripts/mcp_registry_submit.sh`](../../scripts/mcp_registry_submit.sh) — automation for row 1.
- [`mcp-submission-checklist.md`](mcp-submission-checklist.md) — MCP-specific pre-submission floor.
- `task adoption:status` (Phase C Step 6) — one-screen adoption dashboard.
