---
complexity: lightweight
status: later
parent_roadmap: road-to-command-structure-optimization
---

# Roadmap: Follow-up to command-structure optimization — deferred cluster items

> **Parked in `later/` — blocked-for-later, will resume.** Collects the two
> items deferred (not dropped) from the completed
> [`road-to-command-structure-optimization`](../archive/road-to-command-structure-optimization.md)
> Phase 5. Both were deferred with recorded reasons + revisit conditions; neither
> can proceed autonomously now (one needs usage telemetry, one needs an audit +
> ADR decision), so they are parked rather than abandoned.
>
> **Blocked until:** the per-item triggers below fire.

## Context

These are lifted verbatim from the archived parent's Phase 5. The parent shipped
the cluster restructuring; these two were council-deferred for real reasons, not
oversight. Resolution of the parent's open decision (2026-07-10) = **spawn this
follow-up** (preserve the work) rather than drop it.

## Phase 1 — Deferred cluster items (resume per trigger)

- [ ] `ticket` cluster (implement/estimate/refine/jira). <!-- deferred: tier-0
      slug change + cross-pack move rejected by both council members; revisit
      with usage telemetry. -->
      **Resume trigger:** usage telemetry shows the flat `implement-ticket` /
      `estimate` / `refine` / `jira` commands are frequently invoked together or
      mis-discovered — evidence that a `ticket` cluster head would help. Absent
      that signal the council REJECT stands (do not relitigate without telemetry).
- [ ] Demote `check-current-md` / `update-form-request-messages`. <!-- deferred:
      needs md-language-check skill-coverage verification + a Laravel pack-boundary
      ADR. -->
      **Resume trigger:** (a) confirm `md-language-check` coverage makes
      `check-current-md` redundant, AND (b) a Laravel pack-boundary ADR decides
      where `update-form-request-messages` belongs. Both are prerequisites before
      any demotion.

## Acceptance criteria

- [ ] Each item is either executed once its trigger fires, or explicitly
      cancelled with a recorded rationale (never silently dropped).

## Provenance

Deferred from the archived parent per its Phase 5 + ADR-115 (council rejects +
defers). No external source; internal council decision.
