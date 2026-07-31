---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
related_roadmaps: [road-to-zero-ceremony-detection, road-to-zero-ceremony-install]
related_adrs: [ADR-020, ADR-037, ADR-110]
related_contracts: [settings-api, layered-settings]
---

# Road to zero-ceremony settings — the user's file records decisions, the template stays the defaults source

> The 1,233-line template is materialised into every user's global settings
> file, so a fresh install starts with 1,233 lines of opinions nobody formed.
> Split the two jobs that file is doing: the template stays the package's
> internal defaults-and-schema source; what the *user* gets becomes a sparse,
> provenance-stamped record of decisions actually made.

> **Blocked until** the composition-ratchet polish gate exits — 3 documented
> external adoptions, or `road-to-adoption-without-narrative-debt` archived.
> This roadmap is config-management work, which that gate names explicitly;
> its exceptions (bug fixes, completing broken first-run flows, CI/claims
> infrastructure) do not cover it. Parked whole rather than smuggled in as
> "simplification", which is not one of the listed exceptions.

## Goal

A fresh install writes no settings opinions; the user's global settings file
contains one entry per decision actually made, each stamped with how it was
made — while the template↔schema parity gate that keeps the GUI honest stays
exactly as strict as it is today.

## Prerequisites

- [x] Global settings root is the decided storage answer (ADR-020).
- [x] A zod schema mirrors the template leaf-for-leaf, CI-enforced.
- [x] Atomic-write helpers exist.
- [x] The GUI settings editor, its schema routes, and its diff machinery exist.

## Context

Source: an external planning set, audited 2026-07-31. Corrections and refusals:
[`zero-ceremony-inbox-cut`](../../settings/contexts/zero-ceremony-inbox-cut.md).

The audit changed this roadmap's central claim. The draft's headline was **ship
NO settings template**. That is not available: the template is the source of
truth for every configurable setting, a CI parity test fails when a schema key
has no matching template path (its own comment: *loosen it and the GUI silently
drifts*), the installer hard-fails when the template or its placeholders are
missing, and nine further scripts read the template path directly.

But the draft's *goal* is available, because the template is doing two
unrelated jobs:

1. **package-internal**: the defaults and schema-parity source — keep, untouched;
2. **user-facing**: materialised verbatim into the user's global settings file —
   this is the one that should become sparse.

Separating them delivers the draft's outcome (a fresh install writes no
opinions; the file reads as a decision ledger) while every gate above stays
green. That reframe is the whole reason this roadmap survives at all.

Also verified: `settings set` does not exist (`settings` is a GUI alias, and
only `check` / `sync` / `migrate` mutate or validate) — the writer is greenfield.

### Gap audit against the source draft

| Draft item | Verdict | Why |
|---|---|---|
| A/B/C key taxonomy as a checked-in contract, with a lint refusing unclassified keys | **KEEP** | The C class is the injection fence; no conflict |
| `settings set` CLI: zod-validated, atomic, C-refusing, provenance-stamping, loud echo | **KEEP** | Greenfield |
| Sparse **user** settings file; absent = documented default | **KEEP, reframed** | Applies to the materialised user file, not to the template |
| Ship **no** settings template | **CUT** | Breaks the schema↔template parity gate, the installer invariant, and nine consumers |
| Provenance field (`jit-answer \| gui \| manual \| auto-detected`) + timestamp | **KEEP** | No conflict anywhere |
| Language auto-detected, never asked | **KEEP** | A question whose answer is already visible is a wasted question |
| Nickname as the single first-run question, prefilled, activating the canary | **KEEP** | Genuinely un-inferrable; one keypress to accept |
| B-class JIT asks with a one-ask-per-run budget + conservative-default summary | **KEEP** | The anti-nag mechanism is the load-bearing part |
| Hook verification of consent-class settings on capable hosts | **KEEP** | Deterministic teeth where the host allows them |
| GUI as the only C-class writer | **KEEP** | Server-side refusal mirrors the CLI's |

## Phase 1 — The taxonomy contract

- [ ] Classify every key in the current template into A (preferences, never
      asked) / B (consent, JIT-asked once, persisted) / C (guarded, never
      agent-writable) in one table, checked in as
      `docs/contracts/settings-classes.md`.
- [ ] Add a lint refusing any new or existing key without a class.
      <!-- verify: npx vitest run tests/scripts/lint_settings_classes.test.ts -->
- [ ] Put every budget-raising key, allow/deny list, kill-switch, strict mode,
      and master flag in C — and justify each B assignment in one line, because
      a wrong B is the only way this design can hurt someone.
- [ ] Council-review the C list specifically: the fence is only as good as its
      completeness, and completeness is not something a single reviewer should
      certify alone.

**Exit criteria:** the contract exists, the lint fails on a deliberately
unclassified key, and no key with irreversible or spend-raising effect sits
outside C.
**Rollback:** the contract and lint are additive — delete both.

## Phase 2 — The writer

- [ ] `settings set <key> <value>`: zod-validated against the existing schema,
      atomic via the existing helper, refusing every C-class key from every
      caller, stamping `source` and a timestamp, echoing each write as one loud
      line.
      <!-- verify: npx vitest run tests/scripts/settings_set.test.ts -->
- [ ] Effective-value resolution (sparse file → template defaults) sits behind
      the existing settings read path, so every consumer stays oblivious.
      <!-- verify: npx vitest run tests/server/schemas/parity.test.ts -->
- [ ] Refuse C-class writes server-side in the GUI's write route too — the CLI
      refusal must not be the only fence.
      <!-- verify: npx vitest run tests/server/routes/settings.test.ts -->
- [ ] Add the provenance column to the GUI's settings view.

**Exit criteria:** every C-class key is refused from CLI and server routes; the
parity test is still green; a set/read round-trip preserves provenance.
**Rollback:** remove the command and the route guard; the file format is
backward-compatible because absent keys already mean defaults.

## Phase 3 — The user file becomes sparse

- [ ] Stop materialising the full template into the user's global settings file;
      write only what the install genuinely decided (the installer presets that
      fill profile-dependent keys stay, and stay explicit).
      <!-- verify: npx vitest run tests/install/settings_materialisation.test.ts -->
- [ ] Keep the template as the package-internal defaults source: parity gate,
      installer placeholder invariant, and every direct template reader
      untouched. Pin this with the parity test in the same change.
      <!-- verify: npx vitest run tests/server/schemas/parity.test.ts -->
- [ ] Generate the human-readable reference page from the schema plus the class
      table, so the long-form documentation survives the file shrinking.
- [ ] Migration: an existing populated user file is honoured as-is, every entry
      stamped `source: manual`. Nothing is rewritten under the user.
      <!-- verify: npx vitest run tests/install/settings_materialisation.test.ts -->

**Exit criteria:** a fresh install produces a user settings file whose entry
count is bounded by what the install actually decided; the parity gate and the
installer invariant are both still green; an existing file upgrades with zero
behaviour change.
**Rollback:** restore full materialisation; sparse files remain readable
because absent means default in both directions.

## Phase 4 — First run: one question, one notice

- [ ] Auto-set the language from the first message's language, falling back to
      the system locale, with a visible one-line notice and provenance
      `auto-detected`; any later explicit statement by the user overrides it.
- [ ] Ask the nickname once, prefilled from git user name then `$USER`, so
      accepting is one keypress; answering activates the session canary the
      package already ships dark.
- [ ] Skip cleanly in non-TTY, CI, and headless contexts: no file, defaults,
      no questions, ever.
      <!-- verify: npx vitest run tests/scripts/first_run.test.ts -->

**Exit criteria:** a fresh interactive session asks exactly one question and
prints exactly one auto-set notice; a non-TTY session asks nothing; the
resulting file has at most two entries, each with provenance.
**Rollback:** disable the first-run trigger; the canary stays dark as today.

## Phase 5 — The JIT protocol

- [ ] One normalised B-class ask template as a single rule: what is needed, why
      now, options with the default marked, and where the answer is stored.
- [ ] Enforce the budget: at most ONE settings question per command execution.
      Further undecided B keys in the same run take the conservative default
      silently and are listed in the end-summary with the command that changes
      them.
      <!-- verify: npx vitest run tests/scripts/jit_ask_budget.test.ts -->
- [ ] Migrate the three existing ask-shaped settings onto the protocol and
      delete their bespoke per-setting prose — the pattern already exists
      piecemeal; this universalises it.
- [ ] On hook-capable hosts, have the consent-gated action verify the recorded
      decision before it runs, and state the enforcement gradient honestly for
      prose-only hosts: the ask is model-carried there, and ask-once can
      degrade to ask-never.
      <!-- verify: npx vitest run tests/scripts/jit_ask_budget.test.ts -->

**Exit criteria:** a planted fixture needing three B decisions asks once,
assumes two conservatively, and lists both in the summary; the gated action on a
hook-capable host refuses to run without the record.
**Rollback:** revert to per-setting prose; no stored data changes shape.

## Blockers

### blocker: polish-gate-open
- **Status:** open
- **Owner:** maintainer
- **Blocks:** every phase
- **What to do:**
  1. Confirm this is config-management work under the composition-ratchet gate
     and therefore parked, or
  2. grant an explicit exception on the record — noting that "simplification"
     is not one of the gate's three listed exceptions, so an exception here is a
     decision, not an interpretation.
- **Resolved when:** 3 external adoptions are documented, or
  `road-to-adoption-without-narrative-debt` is archived, or an explicit
  exception is recorded.

## Acceptance criteria

- Every template key carries an A/B/C class; the lint fails on an unclassified
  key; no spend-raising or irreversible key sits outside C.
- `settings set` refuses every C-class key from every caller, including the
  GUI's server route.
- A fresh install writes no settings opinions beyond what it actually decided;
  the template↔schema parity gate and the installer placeholder invariant are
  both still green — pinned in the same change, not asserted.
- An existing populated settings file upgrades with zero behaviour change and
  is stamped `source: manual`.
- A fresh interactive session asks exactly one question; a non-TTY session asks
  none.
- No command execution ever asks more than one settings question; a planted
  three-need fixture produces one ask, two conservative defaults, and a summary
  naming both.
- The reference documentation is generated from the schema plus the class
  table — one source, not a second hand-maintained page.
- The honest non-claims are recorded in the shipped docs: no enforcement on
  prose-only hosts, no protection against a user answering a B question badly,
  and no shorter first *week* — the same decisions get made, later and in
  context.

## Provenance

Source: an external planning set delivered through the user inbox, drafted by
an assistant that had the repository tree but not its decision memory. The
maintainer offered the idea explicitly for critical review; the review changed
its shape twice — the language question was dropped as answerable by
observation, and "ship no template" became "split the template's two jobs" once
the parity gate and installer invariant were verified. Corrections and refusals:
[`zero-ceremony-inbox-cut`](../../settings/contexts/zero-ceremony-inbox-cut.md).
