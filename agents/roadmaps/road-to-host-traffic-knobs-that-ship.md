---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "A grep across agents/roadmaps/ and docs/decisions/ for any host traffic environment variable returns zero, so no roadmap, stub or later/ entry can absorb this; the change is a documentation and diagnostic surface with no owner to merge into."
relates: []
---
# Road to host traffic knobs that ship

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t03/` — a four-file supplied-plan set
> (two independent agent proposals, each revised once) plus the transcript that
> commissioned them. Class: external agent proposals about this repo. One proposal's
> later revision corrects the earlier one's mapping of these variables; this roadmap
> carries the corrected mapping.

## Goal

The package documents, and `doctor` reports, which host environment variables govern
non-essential network activity — with each variable mapped to what it actually
controls and nothing more. Falsifiable: today
`grep -rnE "DISABLE_NONESSENTIAL_TRAFFIC|DISABLE_AUTOUPDATER|BASH_MAX_OUTPUT_LENGTH|MAX_MCP_OUTPUT_TOKENS" src docs`
returns **0 hits**, so a consumer running on a metered link has no surface here at all.
The goal is met when that grep returns documented entries and `doctor --json` reports
the observed state of each.

## Why this is not already the case, and what must not happen

Two things are true at once and only one of them is in the tree. The package ships
consumer settings templates and an onboarding document; neither mentions a traffic
knob. And the correct mapping is **not** the obvious one: the earlier of the two
supplied proposals treated one blanket variable as also disabling the host's
auto-updater, and its own later revision retracts that — the updater has its own
separate variable. Shipping the wrong mapping would silently leave security updates
running while the settings claim otherwise, or silently disable them while the
settings claim only telemetry was touched. Either is worse than the current zero.

This roadmap therefore **flips no default**. It documents, it reports, it does not
decide. Writing a value into a consumer's environment is a consumer-facing default
change and stays with the owner.

## Phase 1 — Get the mapping right before writing it anywhere

- [ ] **1.1 Record one variable per line with what it actually controls.** In a
      documentation surface under `docs/setup/`, one row per variable: the variable, the
      behaviour it governs, the behaviour it does **not** govern, and the dated host
      version the row was checked against. The blanket non-essential-traffic variable and
      the auto-updater variable are separate rows and must not be described as
      interchangeable.
      verify: the new rows exist and each carries a dated `checked against` field;
      `grep -c 'DISABLE_AUTOUPDATER' docs/setup` is at least 1
- [ ] **1.2 State where the mapping came from and how stale it can go.** These are
      third-party behaviours; a row with no date is a claim with no expiry.
      verify: every row carries a date, and the surface states that an undated row is
      to be treated as unverified

## Phase 2 — Report the observed state, change nothing

- [ ] **2.1 Add a traffic-environment section to `doctor --json`.** For each
      documented variable: set or unset, and the value if set. Read-only; `doctor`
      reports, it does not write.
      verify: `agent-config doctor --json` emits the section, and running it twice
      leaves the environment and every settings file byte-identical
- [ ] **2.2 Report unknown rather than guess.** On a host where the variable has no
      documented meaning, the row reads `not applicable on this host` rather than being
      omitted — an omitted row reads as "fine" and is the failure this whole surface
      exists to stop.
      verify: on a non-Claude host fixture the section is present and every row reads
      `not applicable on this host`

## Phase 3 — Say it once, in the place a reader is already looking

- [ ] **3.1 Point `ONBOARDING.md` at the new surface in one line.** No second copy of
      the table; a pointer, per this repo's thin-root discipline.
      verify: `ONBOARDING.md` gains exactly one pointer line and no table

## Phase 4 — Deferred, owner-reserved

- [~] **4.1 A settings profile that writes these variables.** Writing a value into a
      consumer's environment changes behaviour the consumer did not ask to change,
      including possibly their security updates. Deferred to an owner decision; the
      blocker below states it.
- [~] **4.2 Any figure for what these variables save.** No byte metric exists in the
      tree yet, so any saving figure would be unbacked. Deferred until a byte metric
      lands and one paired run measures it.

### blocker: traffic-profile-writes-consumer-environment

**Status:** open
**Owner:** maintainer
**Blocks:** Phase 4.1
**What to do:** pick exactly one — (a) ship documentation and the `doctor` report only,
and never have this package write a traffic variable into a consumer environment;
or (b) authorise a settings profile that writes them, with the auto-updater variable
excluded from every profile so security updates are never disabled by this package;
or (c) authorise a settings profile that may include the auto-updater variable, on the
condition that `doctor` reports the disabled updater on every run.
**Resolved when:** the maintainer states (a), (b) or (c) in a comment on the roadmap or
in an ADR, and Phase 4.1 is either cancelled or rewritten to the chosen shape.
**Recommendation:** (b). The documented gap is real and the reporting surface is
risk-free, but silently disabling a host's security updates is not a thing this package
should be able to do, and (b) keeps that specific outcome impossible by construction.
**If you do nothing:** Phases 1 to 3 still ship and are useful on their own — the
mapping is documented and `doctor` reports it — and a consumer on a metered link sets
the variables themselves. Nothing regresses; the automation simply does not arrive.

## Acceptance criteria

- A documentation surface under `docs/setup/` carries one row per host traffic
  variable, each naming what it controls, what it does not, and the dated host version
  it was checked against.
- The blanket non-essential-traffic variable and the auto-updater variable appear as
  two separate rows and neither row claims the other's effect.
- `doctor --json` emits a traffic-environment section listing the observed state of
  each variable, and two consecutive runs leave the tree byte-identical.
- On a host where a variable has no documented meaning, its row is present and reads
  `not applicable on this host`.
- `ONBOARDING.md` carries exactly one pointer line and no duplicate table.
- No default is flipped and no value is written into any consumer environment by this
  change.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The documented mapping is wrong and a reader disables more than they intended | product | This is not hypothetical here: the earlier of the two supplied proposals described the blanket non-essential-traffic variable as also disabling the host's auto-updater, and its own later revision retracts that. A consumer who follows a wrong row on a metered link can silently switch off security updates while believing they suppressed telemetry. That outcome is strictly worse than today's zero rows, because a wrong instruction is acted on and an absent one is not. | Step 1.1 gives each variable its own row naming both what it governs and what it does **not** govern, and requires the blanket variable and the auto-updater variable to be separate rows that never claim each other's effect. Its verify greps for the auto-updater variable by name, and the acceptance criteria repeat the two-row separation as a pass condition. | Phase 1 — Get the mapping right before writing it anywhere |
| 2 | The mapping goes stale silently as the host changes | product | These are third-party environment variables whose meaning is set by a vendor on their own release schedule. A row that was accurate when written stays in the tree reading as current after the behaviour behind it changes, and nothing in this package can observe the drift — so the surface degrades from correct to confidently wrong with no signal at any point. | Step 1.1 requires every row to carry the dated host version it was checked against, and Step 1.2 states in the surface itself that an undated row is to be treated as unverified. A row with no date therefore fails 1.2's verify rather than passing as fact, which makes staleness visible to the reader instead of invisible. | Phase 1 — Get the mapping right before writing it anywhere |
| 3 | A reader takes the documentation as permission for this package to set the variables | product | Documenting a knob and reporting its state is one short step from writing it, and an operator reading a complete mapping plus a `doctor` row naturally asks why the package does not just set them. Writing a traffic variable into a consumer environment changes behaviour the consumer never asked to change, and under the wrong mapping it could disable their security updates. | Phase 4.1 is deferred rather than scheduled, and the open blocker names the decision as owner-reserved with three explicit options and a recommendation. The roadmap states plainly that it flips no default and writes no value, and the acceptance criteria carry that as a pass condition rather than as prose. | Phase 4 — Deferred, owner-reserved |
| 4 | `doctor` grows a section that writes state while reporting it | implementation | `doctor` already touches settings surfaces, so a new section that resolves traffic variables is one convenience away from normalising a value, seeding a default or caching an observation into a file. A reporting command that mutates the tree makes its own output unreliable — the second run describes the state the first run created. | Step 2.1 specifies the section as read-only, and its verify is the property rather than the intent: running `agent-config doctor --json` twice must leave the environment and every settings file byte-identical. The acceptance criteria restate the two-consecutive-runs check, so a write introduced later fails a test. | Phase 2 — Report the observed state, change nothing |
| 5 | A host with no such variable silently gets no row and reads as healthy | implementation | The obvious implementation skips variables that do not apply to the current host, which produces a section listing only the variables that resolved. An operator reading a short clean section concludes their traffic is governed, when in fact the package simply had nothing to say about that host — an omission that reads as a clean bill of health is the precise failure this surface exists to prevent. | Step 2.2 requires the row to be present and to read `not applicable on this host` rather than being omitted, and its verify runs against a non-Claude host fixture where every row must read that way. The acceptance criteria carry the same requirement, so an omitting implementation fails rather than looking tidy. | Phase 2 — Report the observed state, change nothing |
