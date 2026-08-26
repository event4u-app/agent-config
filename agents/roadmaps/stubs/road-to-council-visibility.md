---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to council visibility as a product surface

> **Stub — not active work.** Recurring external-review ask (pre-8.0.0 and
> 8.1.0 dumps): make the AI council visibly productized — a `--council` mode
> on `/work` / `/implement-ticket` / PR review, plus a standardized visible
> verdict-report format (roles + findings + final decision block) instead of
> council output living only in gitignored `agents/runtime/council/`.
> Council 2026-07-08 (claude-sonnet-4-5 + gpt-4o, split verdict fold-vs-stub;
> maintainer tie-break → stub): the `/council:*` commands already exist; the
> ask is a UX/positioning layer whose demand is unproven, and the
> orchestration front itself is prove-or-drop pending
> (`road-to-orchestration-scope-decision.md`).

## Promotion gates

1. **Orchestration decision resolved first:** promoting a council UX layer
   while the orchestration claim may be publicly dropped would build
   marketing surface on an unproven front. Wait for
   `road-to-orchestration-scope-decision` Phase 3 to resolve.
2. **Demand signal:** ≥2 real usage asks for in-flow council verdicts (vs
   the standalone `/council:*` commands).

## Seed content on promotion

- `--council` flag on `/work` + `/implement-ticket` routing through the
  existing `/council:*` machinery; one standardized verdict block
  (members · date · findings by severity · decision) rendered in-reply and
  persisted per the existing council-output contract; no new backend.
