# Feedback 24–26 Disposition

> Durable triage record for feedback rounds 24, 25, 26 (all 2026-06-02,
> scoring 5.8.0–5.9.0 at A 115/120 and 10/10-as-platform). A re-audit
> against the actual repo on 2026-06-02 found that most asks were already
> done or already tracked; only a handful were genuinely new and
> autonomously actionable. This note records, per item, where each ask
> landed so the next feedback round starts from the disposition, not from
> scratch.
>
> Produced by the feedback-24-26-cleanup roadmap pass. Roadmaps are named
> by slug only (no path link) per `no-roadmap-references`.

## Disposition vocabulary

| Disposition | Meaning |
|---|---|
| `done` | Already shipped; verified in the repo. No further action. |
| `tracked` | Real work, owned by another active roadmap (named by slug). Not duplicated here. |
| `human-owner` | Requires a maintainer action the autonomous pass cannot take (external write, repo settings, third-party submission). |
| `closed-here` | Landed or verified by the feedback-24-26-cleanup pass. |

## Dispositions

| # | Feedback ask | Round | Disposition | Where it landed |
|---|---|---|---|---|
| 1 | `doctor` global-only | fb25 P3 | `done` | Shipped 5.9.0; `road-to-doctor-global-only-readiness` closed (0 open). |
| 2 | Knowledge connectors | fb26 P1 | `done` | Pivoted to local-only ingestion (Hard-Floor on OAuth); `/knowledge:ingest\|list\|forget` shipped. |
| 3 | Branch-protection policy exists | fb25 | `done` (doc) / `human-owner` (UI) | `docs/contracts/branch-protection-policy.md` is active. **But live `main` is NOT protected** — see Surfaced risks below. |
| 4 | Profile UX surface / status | fb26 P0 | `tracked` | Session-profile overlay engine + `profile_staleness_hook.py` + `/profile show` shipped (5.8.0). The *unified* status dashboard is tracked in `road-to-employee-product-and-external-proof` Phase 4 Step 9 (blocked on the ADR-023 Tier-1 right-rail surface). |
| 5 | Employee workflows | fb26 P0 | `tracked` | `road-to-employee-product-and-external-proof` Phases 3 (role experiences) + 5 (document workflows: offer / mail / memo / brief / video-script). |
| 6 | Simplicity / experience-first | fb24/26 | `tracked` | The `road-to-6.0.0-*` rebuild series — this is the 6.0.0 thesis, not a quick fix. |
| 7 | Glama registry capture | fb25 | `closed-here` | Glama row added to `docs/distribution/registries.md` § MCP registries; status `⬜ open (human-owner: maintainer submits via the Glama claim flow)`. |
| 8 | MCP-registry rows sweep | fb25 | `closed-here` | Swept: all three rows (punkpeye, mcp.so, mcpservers.org) still `⬜ open` / `pending` across `registries.md`, `registry-submissions.md`, `dist/mcp/registry-manifest.json`. No submissions landed; nothing stale. |
| 9 | Registry submissions | fb25 | `human-owner` | Third-party PRs / directory forms require the maintainer's GitHub identity (per `road-to-product-adoption` Phase 2 + `registries.md`). |
| 10 | Recruit sessions | fb24–26 | `human-owner` | Maintainer-run, no autonomous surface. |
| 11 | Release body populated | fb25 | `closed-here` (path) / `human-owner` (5.8.0 backfill) | Regular path verified correct — see Surfaced risks below. |
| 12 | Profile-complexity gate / overlay precedence | fb26 P0 | `closed-here` | Verified covered — no gap, no extension. See gate-coverage note below. |

## Surfaced risks (maintainer action required)

These two items were flagged as risks by feedback25 and confirmed by the
re-audit. Neither is fixable autonomously.

### A. `main` branch protection — DRIFT (high priority)

`docs/contracts/branch-protection-policy.md` is `active` with the full
per-PR-shape required-check matrix, but the live GitHub state has **no
protection on `main`**:

- `gh api repos/event4u-app/agent-config/rulesets` → `[]`
- `.../branches/main/protection` → 404 "Branch not protected"
- `.../branches/main` → `{"protected": false}`

The doc is the source of truth the UI is supposed to mirror; today it
mirrors nothing. Remediation is maintainer-owned (Settings → Rules UI):
create a ruleset for `main` requiring the feature-PR status-check floor +
restrict force pushes, per the matrix in `branch-protection-policy.md`.
Not changed autonomously — Hard Floor on repo settings.

### B. 5.8.0 GitHub release body — empty (low priority)

The 5.8.0 GitHub release body is empty (`gh release view 5.8.0` → `body: ""`).
This was a one-off on that automated tag; the regular path is correct
(`scripts/release.py` step 9 runs `gh release create <tag> --notes
plan.changelog_body`; `cloud-release.yml`/softprops only attaches artefacts
to the pre-existing release and never sets/blanks the body). Byte-accurate
backfill notes were prepared from `docs/archive/CHANGELOG-pre-5.9.0.md`. The
`gh release edit 5.8.0 --notes-file …` external write was denied by the
harness auto-mode classifier (external collaboration artifact). Remediation:
maintainer runs `gh release edit 5.8.0 --notes-file <5.8.0-body>`.

## Gate-coverage verdict — overlay precedence

Feedback26 P0 asked for "no overlapping profile overlays without an explicit
precedence doc". Verified **covered**, no gap:

- The session-profile overlay (`docs/contracts/session-profile-overlay.md`)
  writes a single key `runtime.active_packs` to one layer
  (`agents/settings/.agent-settings.local.yml`, deepest-winning). <!-- ref-ignore -->
  `/profile activate A B C` unions closures deterministically — no two
  overlays touch the same key with undocumented precedence.
- The config-cascade layer precedence is documented in
  `docs/customization.md` and code↔docs parity is guarded by
  `scripts/check_overlay_cascade_subdirs.py`.
- Extending that script would be wrong — it audits layer participation, not
  writer exclusivity. AI council (claude-sonnet-4-5 + gpt-4o, 2026-06-02)
  converged on "covered, present-tense"; the only optional belts-and-
  suspenders item is a `runtime.active_packs` key-exclusivity test in the
  session-profile suite, flagged as not required for coverage.

## No-duplication guarantee

This note and the feedback-24-26-cleanup roadmap deliberately do **not**
duplicate `road-to-employee-product-and-external-proof` scope (employee
workflows, unified profile dashboard) or the `road-to-6.0.0-*` rebuild
(experience-first simplicity). Those remain the homes for the larger
product asks.
