---
complexity: lightweight
status: ready
parent_roadmap: road-to-zero-ceremony-settings
---

# Road to scripts settings defaults — give the SCRIPTS read path the defaults layer the server already has

> **Source:** the one genuine `[~]` deferral in
> [`archive/road-to-zero-ceremony-settings.md`](archive/road-to-zero-ceremony-settings.md)
> (Phase 3, "Effective-value resolution"), disposed 2026-08-09 with maintainer
> approval via the Iron-Law-3 resolution menu — the cancel-with-successor path
> the 2026-08-07 AI council recommended for exactly this moment ("whoever
> closes Phase 3 must dispose of this item in the same change").

## Context

The sparse-user-file design rests on "absent means default in both directions" —
and only the SERVER settings family actually delivers that: it resolves absent
keys from the template defaults layer, pinned by
`tests/server/schemas/parity.test.ts`. The SCRIPTS family
(`load_agent_settings`) has **no defaults layer at all** — `_DEFAULTS` is `{}`,
and the tree is sparse-tolerant only because every consumer supplies its own
fallback at the read site. That is not the same guarantee: a consumer that
forgets its fallback breaks on a sparse file, and nine keys are already
documented where absent ≠ the template default.

Why this is its own roadmap rather than a step in the parent: giving the
scripts family a template-defaults layer means touching `load_agent_settings`,
whose precedence is the **inverse** of the server's and whose user-global layer
is whitelist-filtered through `MERGEABLE_KEYS` under an ADR. That is the
filename/precedence convergence — a different change class from the parent's
first-run scope.

## Goal

A key absent from every settings layer resolves to the template default on the
scripts read path exactly as it does on the server read path — without changing
the resolved value of any key that is present today, and without weakening the
`MERGEABLE_KEYS` whitelist or its ADR.

## Phase 1 — Map the divergence before touching it

- [ ] Inventory the two read paths side by side: `load_agent_settings`
  (scripts) vs the server resolver — layer order, `MERGEABLE_KEYS` filtering,
  and the governing ADR. Emit the comparison as an Evidence Report in
  `agents/evidence/analysis/` (per `source-discovery-gate`) so the convergence
  decision is made on cited lines, not memory.
- [ ] Enumerate every scripts-family read site with its own fallback and the
  nine documented absent-≠-default keys; classify which fallbacks agree with
  the template default and which silently diverge (those are the live defects
  this roadmap exists to catch).

## Phase 2 — The defaults layer, behind the existing read path

- [ ] Give `load_agent_settings` a template-defaults resolution layer so every
  consumer stays oblivious — same contract the server half already honours.
  Precedence and `MERGEABLE_KEYS` filtering stay exactly as the ADR fixes
  them; the defaults layer sits below every real layer, never above one.
  *Verify:* a parity-style test pinning that an absent key resolves to the
  template default on BOTH families, and that every key present in a populated
  file resolves to the same value before and after the change.
- [ ] Retire read-site fallbacks that merely restate the template default;
  keep (and comment) the ones that intentionally diverge, each with the reason
  — a silent divergence is the defect, an explained one is a decision.
  *Verify:* the Phase-1 classification table has zero unexplained divergences
  left; the full test suite stays green.

## Acceptance criteria

- An absent key resolves identically on the scripts and server read paths,
  pinned by tests on both families.
- No key that is present in a populated settings file changes its resolved
  value — zero behaviour change for existing installs, pinned in the same
  change.
- `MERGEABLE_KEYS` and its ADR are untouched, or any change to them is its own
  recorded decision rather than a side effect here.
- All quality gates pass — see `quality-tools`.
