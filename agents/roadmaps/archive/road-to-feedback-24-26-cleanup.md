---
status: ready
complexity: lightweight
---

# Road to Feedback 24–26 Cleanup — the genuinely-new, non-blocked items

> Triage of the three "normal" feedback rounds (`agents/tmp/feedback24.txt`,
> `feedback25.txt`, `feedback26.txt`, all 2026-06-02, scoring 5.8.0–5.9.0 at
> A 115/120 and 10/10-as-platform). A deep re-audit of the repo (2026-06-02)
> found that **most of what these rounds ask for is already done or already
> tracked** — so this roadmap deliberately stays small and only lands the
> handful of items that are genuinely new AND autonomously actionable. The
> larger product asks (employee UX, profile dashboard) route forward to the
> existing [`road-to-employee-product-and-external-proof.md`](road-to-employee-product-and-external-proof.md)
> and the 6.0.0 roadmaps. This roadmap is sequenced to run **before** the
> `road-to-6.0.0-*` series.

## Goal

Close the small, real gaps from feedback 24–26 without duplicating in-flight
work: capture the Glama registry entry, verify the automated-release body and
branch-protection are genuinely in place (the feedback flagged both as risks),
and confirm the profile-complexity gate covers the overlapping-overlay case.
Everything else is explicitly recorded as done / tracked-elsewhere / human-owner
so feedback rounds 27+ don't re-litigate it.

## Context

Verified state on 2026-06-02 (re-audit against the actual repo, not the
feedback's assumptions):

- **Branch protection** — feedback25 flagged "main isn't protected". Reality:
  [`docs/contracts/branch-protection-policy.md`](../../docs/contracts/branch-protection-policy.md)
  exists (status active, owner = maintainer GitHub UI ruleset, opened
  2026-05-26) with the full PR-shape gating matrix. The doc is the source of
  truth the UI mirrors. → **verify, do not rebuild.**
- **Release body** — feedback25 flagged "automated 5.8.0 release body is empty".
  Reality: `scripts/release.py` populates `gh release create --notes` from
  `plan.changelog_body` (lines ~838–842). The empty-body observation was a
  one-off on a specific automated tag. → **verify the github-actions tag path,
  backfill 5.8.0 body if still empty.**
- **`doctor` global-only** — feedback25 P3. Reality: shipped in 5.9.0,
  `agents/roadmaps/archive/road-to-doctor-global-only-readiness.md` closed with
  0 open steps. → **done, no action.**
- **Knowledge connectors** (feedback26 P1) — pivoted to local-only ingestion
  (Hard-Floor on OAuth); `/knowledge:ingest|list|forget` shipped. → **done.**
- **Profile UX surface / status** (feedback26 P0) — the session-profile overlay
  engine, `profile_staleness_hook.py`, and `/profile show` exist (5.8.0). The
  *unified* status dashboard (active profile + overlays + stale + behavior-diff
  in one surface) is blocked on the same ADR-023 Tier-1 right-rail surface as
  `road-to-employee-product` Phase 4 Step 9. → **tracked there, not duplicated.**
- **Employee workflows** (feedback26 P0) — `road-to-employee-product` Phases 3
  (role experiences) + 5 (document workflows: offer / mail / memo / brief /
  video-script). → **tracked there.**
- **Glama registry** (feedback25 "claim Glama") — NOT captured anywhere.
  `docs/distribution/registries.md` covers npm + Packagist + three MCP
  registries but has no Glama row. → **genuinely new, this roadmap.**
- **Profile complexity gate** (feedback26 P0 "no overlapping overlays without
  explicit precedence docs") — `scripts/check_overlay_cascade_subdirs.py`
  exists. → **verify it covers the precedence case; extend only if a gap.**

> Council note: this triage is also why the 6.0.0 rebuild (the part1 feedback)
> is split out — feedback 24/26 keep scoring the platform 10/10 *as engineering
> infrastructure* while flagging *employee UX / product simplicity* as the gap;
> that gap is the 6.0.0 thesis, not a quick fix.

## Phase 1: Registry capture — Glama + sweep

- [x] **Step 1:** Add a Glama (`glama.ai`) row to the submission-status table in
  [`docs/distribution/registries.md`](../../docs/distribution/registries.md)
  § MCP registries, with the same one-line entry template the three existing
  MCP registries use (repo URL `https://github.com/event4u-app/agent-config`,
  description, tags `agent-governance`, `mcp`, `skills`). Mark status
  `⬜ open (human-owner: maintainer submits via the Glama claim flow)`.
- [x] **Step 2:** Sweep the three existing MCP-registry rows (punkpeye, mcp.so,
  mcpservers.org) for stale status text; if any submission timestamp landed
  since the rows were written, capture it. No new submissions (those stay
  human-owner per the existing roadmap).
  <!-- swept 2026-06-02: all three rows still ⬜ open / pending across registries.md,
  registry-submissions.md, and dist/mcp/registry-manifest.json — no PR URLs, no
  submission timestamps landed. No stale status, nothing to backfill. -->

## Phase 2: Verify the two flagged-but-likely-fine risks

- [x] **Step 3:** Confirm the automated release path populates the GitHub
  release body. Read the github-actions tag/release path (`.github/workflows/`
  publish/release + `scripts/release.py` `--notes` wiring). If the historical
  5.8.0 GitHub release body is still the bare merge-commit text, backfill it
  from `CHANGELOG.md` via `gh release edit 5.8.0 --notes-file …`. If the path
  already populates correctly, record "verified — non-issue" inline and close
  the step. <!-- carve-out: new-gate-verification -->
  <!-- verified 2026-06-02: regular path is correct — scripts/release.py step 9
  runs `gh release create <tag> --notes plan.changelog_body`; publish-npm.yml only
  publishes npm, cloud-release.yml (softprops/action-gh-release) only attaches
  artefacts to the pre-existing release and sets no body, so it never blanks it.
  The 5.8.0 body IS still empty (one-off). Byte-accurate backfill notes prepared
  from docs/archive/CHANGELOG-pre-5.9.0.md → /tmp/release-5.8.0-notes.md, but the
  `gh release edit 5.8.0` external write was denied by the harness auto-mode
  classifier (external collaboration artifact). RESOLVED 2026-06-02: backfill
  executed with user authorization — `gh release edit 5.8.0 --notes-file` ran;
  5.8.0 GitHub release body now carries the byte-accurate changelog. Step closed. -->
- [x] **Step 4:** Confirm `docs/contracts/branch-protection-policy.md` matches
  the live GitHub ruleset for `main` (require status checks + restrict force
  pushes). This is a maintainer UI check; record the verification outcome
  inline. If the doc and the UI drift, note the drift — do **not** change the
  ruleset autonomously (Hard Floor on repo settings).
  <!-- verified 2026-06-02: DRIFT FOUND. main is NOT protected.
  `gh api repos/event4u-app/agent-config/rulesets` → [] (no repo rulesets);
  `.../branches/main/protection` → 404 "Branch not protected";
  `.../branches/main` → {"protected": false}. The policy doc is "active" with the
  full required-check matrix, but the live GitHub UI mirrors nothing — exactly the
  feedback25 flag. Remediation is maintainer-owned (Settings → Rules UI): create a
  ruleset for `main` requiring the feature-PR status-check floor + restrict force
  pushes, per the matrix in branch-protection-policy.md. NOT changed autonomously
  (Hard Floor on repo settings). Step objective (note the drift) is complete. -->

## Phase 3: Profile-complexity gate coverage

- [x] **Step 5:** Read `scripts/check_overlay_cascade_subdirs.py` and confirm it
  covers feedback26's P0 ask — "no overlapping profile overlays without an
  explicit precedence doc". If it already enforces precedence on overlapping
  overlays, record "covered" inline and close. If there is a real gap (e.g. two
  overlays touching the same key with no documented precedence), extend the
  existing check with the minimal rule + a test; do **not** add a new script.
  <!-- carve-out: new-gate-verification -->
  <!-- verified 2026-06-02: COVERED — no gap, no extension. The session-profile
  overlay (docs/contracts/session-profile-overlay.md) writes a SINGLE key
  `runtime.active_packs` to ONE layer (agents/settings/.agent-settings.local.yml,
  deepest-winning); `/profile activate A B C` unions closures deterministically —
  no two overlays touch the same key with undocumented precedence. The config-
  cascade layer precedence is documented in docs/customization.md and code↔docs
  parity is guarded by this very script (CASCADE_ELIGIBLE_KINDS / USER_GLOBAL_
  OVERLAY_KINDS). Extending this script would be wrong — it audits layer
  participation, not writer exclusivity. AI council (claude-sonnet-4-5 + gpt-4o,
  2026-06-02) converged on "covered, present-tense"; the only optional belts-and-
  suspenders item is a `runtime.active_packs` key-exclusivity test in the session-
  profile suite, which the council flagged as NOT required for coverage. Per the
  step's own gate (extend only on a real gap) + minimal-safe-diff: closed as
  covered, no code change. -->

## Phase 4: Forward-routing record (no code)

- [x] **Step 6:** Add a short "feedback 24–26 disposition" note to
  `agents/settings/contexts/` recording, per item, where each feedback ask
  landed: done (doctor, knowledge connectors, branch-protection), tracked
  (employee workflows + profile dashboard → `road-to-employee-product`;
  simplicity/experience-first → `road-to-6.0.0-*`), human-owner (recruit
  sessions, registry submissions), or closed-here (Glama capture, gate
  verifications). This is the durable triage record so the next feedback round
  starts from the disposition, not from scratch.

## Acceptance Criteria

- [ ] Glama row present in `docs/distribution/registries.md`; MCP-registry rows
  swept.
- [ ] Release-body path verified (or 5.8.0 body backfilled); branch-protection
  doc-vs-UI parity confirmed.
- [ ] Profile-complexity gate confirmed to cover the overlapping-overlay
  precedence case (or minimally extended + tested).
- [ ] Disposition note filed under `agents/settings/contexts/`; every feedback
  24–26 item has a recorded home.
- [ ] No duplication of `road-to-employee-product-and-external-proof` scope.
