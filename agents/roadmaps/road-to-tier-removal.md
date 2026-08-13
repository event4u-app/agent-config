---
complexity: structural
parent_roadmap: metadata-and-command-surface-leanness
---

# Roadmap: Command `tier:` Alias Removal

> **Un-parked 2026-07-12 (road-to-opt-portfolio-consolidation Phase 2):**
> resume evidence verified live — the released npm 8.10.0 (2026-07-10)
> ships `dist/discovery/discovery-manifest.json` with the `deprecations`
> block on `tier` (since ADR-092, replacement `visibility`, `sunset:
> null`), and zero tier-related breakage issues exist. The maintainer
> review happened via the merged optimization-sweep PR that scheduled
> this revival. Phase 1 (evidence mechanism) shipped; the soak clock has
> been running since publish. The re-open mechanism the roadmap was blocked on now exists:
> the discovery manifest is **v2** with a machine-readable `deprecations`
> signal on the integer `tier` key (Option B — chosen by AI council, telemetry
> ruled out as infeasible in a no-runtime package; see § Council notes). `tier`
> is still emitted (non-breaking) — the signal only starts the soak.
>
> **Blocked until:** the manifest-v2 `tier` deprecation signal has soaked (no
> external breakage reported) **and** the maintainer reviews at the next
> minor-release planning window (ADR-092). Until then the just-in-time audit
> (Phase 2), soak confirmation (Phase 3), and removal (Phase 4) cannot proceed
> — all gated on the external soak + a maintainer decision, so the roadmap is
> parked here rather than left in the active tree.
>
> Spawned from `road-to-metadata-and-command-surface-leanness` (Phase 3) per the
> 2026-06-13 AI-council decision recorded in
> [`ADR-092`](../../docs/decisions/ADR-092-defer-command-tier-alias-removal.md):
> dropping the command `tier:` alias is **deferred** because the published
> discovery manifest dual-emits the integer `tier` and external npm consumers
> are unknown. This roadmap institutionalises the trigger so the defer stays
> visible in planning rather than becoming folklore.

## Goal

Drop the command `tier:` back-compat alias (ADR-090 "Option B" / ADR-092
deferred), leaving `visibility:` as the sole command classifier — but only
after the published-manifest unknown-consumer risk is evidenced away.

## Re-open trigger (Phase 1 must clear one)

- **Versioned manifest** — `discovery-manifest` v2 without `tier` ships
  alongside v1; v1 header carries `deprecated: true` + a maintainer-set
  sunset; soak window passes with no breakage reported.
- **Zero-external-read evidence** — manifest-fetch telemetry (or an explicit
  "tier key deprecated" notice + soak) shows no external integer-`tier`
  reads.

Re-evaluate at the next minor-release planning (maintainer-set review
window), escalating with pre-committed options: build the v2 mechanism ·
proceed with removal · keep deferred.

## Phase 1 — Evidence mechanism build-out

- [x] Pick the mechanism (versioned manifest v2 **or** fetch telemetry).
      <!-- AI council (claude-sonnet-4-5 + gpt-4o, 2-round peer-review design debate, 2026-06-16): fetch-telemetry is infeasible in a no-runtime / file-first package (no server, no fetch endpoint) → versioned-manifest family only. Council split A (dual-publish) vs B (single manifest + deprecations block); host consolidation = Option B — both members debated "soak observability" as if telemetry were possible (it isn't under no-runtime), which collapsed A's main edge for the signal-only Phase-1 scope. B = minimal-safe-diff + non-breaking; the Phase-4 removal is itself the forcing function (cheaply reversible, ADR-092). -->
- [x] Implement it; ship the deprecation signal on the integer `tier` key.
      <!-- manifest version 1→2 + top-level machine-readable `deprecations` block (src/scripts/build_discovery_manifest.py); discovery-manifest.schema.json extended (version const→2, `deprecation` $def, tier desc); 2 new tests in test_build_discovery_manifest.py (v2 + deprecation signal; non-breaking dual-emit of tier+visibility); docs/contracts/command-surface-tiers.md note. tier STILL emitted (non-breaking). lint_discovery_manifest + determinism + lint_command_tiers all green. -->
- [x] Run the soak window; confirm no external breakage / zero reads.
      <!-- done 2026-07-28 — the soak HAS run and its measurable half is clean, but
      it does NOT clear the removal gate (that verdict is Phase 3's).
      MEASURED: the deprecation signal is live in the published artifact —
      unpacked the real npm tarball of 8.10.0 and read
      `dist/discovery/discovery-manifest.json`: `version: 2` plus a top-level
      `deprecations` entry `{key: tier, replacement: visibility, scope: command,
      since: ADR-092, sunset: null}`. Published continuously 8.10.0 (2026-07-10)
      → 9.8.0 (2026-07-26) = 13 published versions across 18 days.
      `gh issue list --state all --search "tier"` → `[]`: zero tier-related
      issues have ever been filed, so NO EXTERNAL BREAKAGE was reported over the
      window. HONEST LIMITS, stated not glossed: (a) "zero reads" is
      structurally unverifiable in a no-runtime package (the 2026-06-16 council
      already ruled fetch telemetry infeasible) — absence of breakage reports is
      not evidence of zero reads; (b) the published `sunset` is `null`, so no
      sunset was ever set; (c) known adoption is ~7 stars / 1 fork, so quiet is
      weak evidence. -->

## Phase 2 — Internal dependency audit (just-in-time)

- [x] Re-grep integer-`tier` readers immediately before removal (audit is
      stale if run during the defer): `commands.ts`, `audit_command_surface.py`,
      `build_discovery_manifest.py`, plus any added since. Classify each as
      Runtime Risk (branches/registers on the integer) vs Discovery Risk
      (display/fallback only).
      <!-- PRELIMINARY inventory (2026-06-16, NON-BINDING — must be re-run just-in-time at removal): commands.ts `tierOf`/`visibilityOf`/`explain` = Discovery Risk (visibility-preferred; tier is fallback/alias-label only); audit_command_surface.py `_is_visible` = Discovery Risk (fallback), `_tier_at_ref` reads tier from HISTORICAL git revisions = correct, must NOT change, VISIBLE_TIERS = dead once visibility is always present; build_discovery_manifest.py = the emitter. No internal Runtime Risk reader found; the open risk is unknown EXTERNAL manifest consumers — exactly what the soak addresses. -->
      <!-- done 2026-07-28 — just-in-time audit run; the preliminary inventory
      above is SUPERSEDED and was materially wrong. It named 3 readers and
      concluded "no internal Runtime Risk found". The real count is ~13, and
      three Runtime-Risk readers were missed entirely:
      · `src/scripts/lint_command_verbs.ts:34,113-120,226-235` — gates verb-prefix
        linting SOLELY on `tier:`, no `visibility:` fallback anywhere in the file
        (`const tier = tm ? parseInt(tm[1],10) : 2`). Drop `tier:` and every
        command silently defaults to 2/internal → the lint stops gating. Silent.
      · `src/scripts/lint_command_routing.ts:36,173-176,313-316` — identical shape,
        identical silent-default failure.
      · `src/scripts/install.ts:2871-2909` (`_apply_claude_flat_command_wrappers`,
        added 2026-07-08, post-dates the inventory) — reads manifest `tier` to
        decide which flat commands are projected as Claude-Code skill wrappers
        (`(a.tier ?? 2) <= 1 && a.visibility !== 'internal'`); changes what lands
        on a consumer's disk.
      CONFIRMED Historical (must NOT change): `audit_command_surface.ts`
      `_tier_at_ref` / `_is_visible_tier` — read `tier:` out of PAST git revisions
      for the promotion baseline; old blobs only ever carried `tier:`.
      Discovery Risk (display/fallback only): `src/cli/commands/commands.ts`
      `tierOf`/`visibilityLabel`, `src/cli/discovery/loadManifest.ts:77` (optional
      type field), `build_catalog_index.ts:141` (search tag),
      `gen_discovery_baseline.ts:250` (report), `audit_command_surface.ts`
      `_is_visible` (visibility-preferred fallback).
      Also: `src/scripts/schemas/command.schema.json:17-21` defines the property
      and its description still cites the retired `lint_command_tiers.py` name.
      Corpus state: 191/191 command files carry BOTH keys, 0 disagreements
      (5 `0→visible`, 17 `1→advanced`, 169 `2→internal`). -->

- [x] **Migrate the internal Runtime-Risk readers to `visibility`** (added
      2026-07-28 on council convergence — see § Council notes). Non-breaking:
      the manifest KEEPS dual-emitting `tier`, so external consumers are
      untouched; this only removes the silent-default failure mode inside the
      repo and shrinks the eventual Phase-4 removal to the emitter plus the
      display-only fallbacks.
      <!-- done 2026-07-28. Shape in all three: read `visibility` first, fall
      back to the `tier` alias, and treat "NEITHER key present" as a LOUD
      violation instead of the old silent default-to-2 (which skipped the file
      and quietly un-gated it).
      · `lint_command_verbs.ts` — `_parse` now returns `visible: boolean | null`;
        the `tier` fallback is RETAINED on purpose because this linter parses
        PAST git revisions (`git show <baseline>:<path>`) for the promotion
        check, and pre-ADR-090 blobs carry only `tier:`. Removing the fallback
        here would have made already-visible commands look newly-promoted.
      · `lint_command_routing.ts` — new `_isVisible(fm)` helper, same precedence,
        used by both `check()` and the visible-count loop.
      · `install.ts` `_apply_claude_flat_command_wrappers` — visibility-primary
        with a tier fallback for an older locked manifest. Kept the DENY shape
        (`visibility !== 'internal'`) rather than an allowlist, so any
        visibility value outside the linted vocabulary resolves exactly as the
        previous `(tier ?? 2) <= 1 && visibility !== 'internal'` clause did.
      · NOT touched: `audit_command_surface.ts` `_tier_at_ref` /
        `_is_visible_tier` (Historical readers).
      NO-OP EVIDENCE (the council's Q4 bar): `lint_command_routing.ts` produces
      BYTE-IDENTICAL output before/after against the real 191-file corpus
      (`✅ 22 visible command(s) …`, exit 0 both ways). 5 new regression tests
      lock the new behaviour (visibility-only visible / visibility-only internal
      / visibility-wins-over-tier / neither-key-is-loud); the pre-existing test
      `exempts a command with no tier (defaults to 2)` was REPLACED — it pinned
      the silent default that is the defect. 69 tests green across the 6
      affected suites; `task typecheck-ts` exit 0.
      HONEST GAP: the same corpus-level differential could NOT be produced for
      `lint_command_verbs.ts` — see the dead-path note under § Out-of-scope
      findings; its coverage is the 16 unit tests over `check()`, not a real
      corpus run. -->


## Phase 3 — External soak confirmation

- [x] Confirm the Phase-1 deprecation signal has soaked; record the
      zero-consumer evidence that closes the unknown-consumer hard stop.

      **CLOSED 2026-08-13 by maintainer waiver, and the waiver is what closes it
      — not new evidence.** Asked directly, the maintainer answered *"sofortige
      Entfernung. wir haben lange genug gewartet."* Two acts in one: the concrete
      `sunset` that ADR-137 had reduced the trigger set to is now SET
      (`build_discovery_manifest.ts`, `sunset: '2026-08-13'`), and the
      wait-for-it-to-pass leg is expressly waived rather than satisfied.
      Recording it as a waiver matters, because the alternative reading — that
      the soak produced clearing evidence — would be false. It did not. The
      Phase-1 announcement has been live since 2026-07, no breakage was reported,
      and this roadmap already states why that is weak: known adoption is ~7
      stars / 1 fork, so quiet is close to uninformative about unknown consumers.
      The maintainer weighed that and judged the window sufficient. That is a
      legitimate call and squarely theirs; it is not a measurement, and nothing
      here should later be cited as one.
      The unknown-consumer hard stop is therefore **accepted, not disproved** —
      with the reversibility note below (a manifest schema patch, under an hour)
      as the standing mitigation.
      <!-- deferred 2026-07-28 — the soak evidence EXISTS (Phase 1) but it does
      NOT close the hard stop, and no autonomous run can make it close. The
      re-open trigger set is unsatisfiable as written:
      · Trigger 1 (versioned manifest) is a three-part conjunction — v2 manifest
        ✅, `deprecated`-style signal ✅, "plus a maintainer-SET sunset" ❌. The
        published value is `sunset: null`; `null` is the absence of a set value,
        and "set" is load-bearing.
      · Trigger 2 (zero-external-read evidence) is structurally IMPOSSIBLE — the
        2026-06-16 council already ruled fetch telemetry infeasible in a
        no-runtime package. It can never be satisfied, by construction.
      Council 2026-07-28 (claude-sonnet-4-5 + gpt-4o, 2 rounds) converged on
      option (c): treating the impossible trigger as merely "inert" would
      SILENTLY EDIT the published roadmap, which the package's honest-nulls
      positioning forbids. The gate design must be amended on the record BEFORE
      any removal — see blocker `trigger-set-amendment`. Note that "no breakage
      reported" is also weak evidence here: known adoption is ~7 stars / 1 fork,
      so quiet is close to uninformative about unknown consumers. -->

## Phase 4 — Removal execution (blocked on Phases 1–3)

- [ ] Scripted backfill: drop `tier:` from the command sources, remove the
      `tier` property + the tier↔visibility consistency clause from
      `command.schema.json` / `lint_command_tiers.ts`, drop the `tier`-fallback
      branches in the remaining display-only readers, stop dual-emitting `tier`
      in the manifest. One reviewable diff; `lint_command_tiers.ts` then
      enforces `visibility` alone.
      <!-- deferred 2026-07-28 — the INTERNAL half of this step landed early
      under Phase 2 (the three Runtime-Risk readers now prefer `visibility`),
      which is what makes the remainder small and safe. What is left is the
      EXTERNAL half only: stop dual-emitting `tier` in the manifest, drop the
      property from `command.schema.json`, strip the consistency clause from
      `lint_command_tiers.ts`, drop `tier:` from all 191 command frontmatters,
      and remove the display-only fallbacks (`commands.ts` `tierOf`,
      `loadManifest.ts:77`, `build_catalog_index.ts:141`,
      `gen_discovery_baseline.ts:250`). `audit_command_surface.ts`
      `_tier_at_ref` stays. That half changes a PUBLISHED data contract and is
      blocked on `trigger-set-amendment` above — not on any missing code work.
      The `lint_command_tiers.py` filename in the step text was stale; the
      module is TypeScript now, corrected above. -->
- [x] Reversibility note: restoring `tier` is a manifest schema patch
      (< 1h to publish) if a regression surfaces post-removal.
      <!-- done 2026-07-28 — the note is now concrete rather than an estimate,
      because the Phase-2 migration changed what a rollback has to touch.
      Restoring `tier` after the eventual Phase-4 removal means: (1) re-add the
      `tier` property to `command.schema.json`; (2) re-enable the dual-emit in
      `build_discovery_manifest.ts` (the `deprecations` block already carries
      the machine-readable shape); (3) re-add `tier:` to command frontmatter —
      mechanically derivable from `visibility` via the frozen mapping
      `visible→0`, `advanced→1`, `internal→2`, so no human judgement is needed
      and no information is lost by the removal. The three migrated readers do
      NOT need reverting: they already prefer `visibility` and keep a `tier`
      fallback, so they work correctly with or without the alias. That is the
      property that makes the removal cheaply reversible — the rollback is a
      regenerate-and-publish, not a code redesign. Publication is one patch
      release; the "< 1h" figure is an unmeasured estimate and stays labelled
      as one. -->

## Acceptance criteria

- The unknown-external-consumer hard stop is cleared by Phase-1 evidence
  before any removal lands.
- Command frontmatter + schema carry `visibility:` only; no tier↔visibility
  consistency check remains; the manifest no longer dual-emits `tier`.
- A superseding ADR records the proceed decision (ADR-092 → superseded).
  <!-- 2026-07-28: NOT yet met, and ADR-137 is not it. ADR-137 amends the
  trigger SET (withdraws the impossible Trigger 2, keeps Trigger 1 as the sole
  gate); ADR-092's deferral still stands. The proceed ADR is written when the
  amended gate clears and the removal actually lands. -->
- The internal readers resolve visibility from `visibility`, not from the
  integer alias, so the alias can be dropped without silently un-gating a
  command. <!-- met 2026-07-28, Phase 2. -->

## Council notes

Phase-1 mechanism choice — AI council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2-round peer-review design debate, 2026-06-16). The roadmap/ADR-092
offered two re-open mechanisms: a **versioned manifest** or **fetch telemetry**.
Telemetry is **infeasible** in this no-runtime / file-first package (no server,
no fetch endpoint — `audit_command_surface.py` states per-command telemetry is
unavailable), so the viable family is the versioned manifest only. Within that,
the council split between **A** (publish a second `discovery-manifest-v2.json`
without `tier` alongside v1) and **B** (single manifest, bump `version 1→2`, add
a machine-readable top-level `deprecations` block, keep emitting `tier`). Host
consolidation chose **B**: both members argued "soak observability", but a
no-runtime package cannot observe external reads under *either* shape, which
collapses A's main advantage for the **signal-only, non-breaking** Phase-1 scope.
B is the minimal-safe-diff path; the eventual Phase-4 removal is itself the
forcing function (and is cheaply reversible per ADR-092). Shipped under Phase 1.

Soak sufficiency + run scope — AI council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2 rounds, 2026-07-28, $0.10). Asked whether the measured soak
clears the removal hard stop, and what should land instead if it does not.
**Both members converged on the same two answers.**

**(1) Removal is blocked — the trigger SET needs a recorded amendment
(option c), not a judgement call about risk.** Trigger 1's "maintainer-set
sunset" leg is unmet (`sunset: null`) and Trigger 2 is impossible by
construction. Sonnet's load-bearing argument: the "exactly ONE must clear"
clause was written when BOTH triggers were believed achievable — the
infeasibility ruling came later — so reading the impossible leg as merely
"inert" retro-fits the gate to whichever leg survived, which is silent
roadmap-editing. It also rejected the tempting shortcut explicitly: *"This
conflates 'the risk is low' with 'the gate is satisfied'. If we bypass an
unsatisfied gate because we've separately convinced ourselves the risk is low,
we've just deleted the gate while pretending to respect it."* gpt-4o reached
the same place from the consumer side — `sunset: null` is what a consumer can
read today, so removing against it breaks the published contract.
**Recorded dissent / revisit condition** (sonnet, verbatim): a timestamped
commit PRIOR to this roadmap's publication showing the maintainers already knew
Trigger 2 was impossible when they wrote "exactly ONE must clear" would prove
the OR-clause always had one real leg — and would reopen (b).

**(2) Land the internal migration now; it is separable.** Both members agreed
the three Runtime-Risk readers should move to `visibility` while the manifest
keeps dual-emitting `tier` — non-breaking externally, kills the silent-default
hole, and shrinks the eventual removal. Sonnet on the objection: *"The 'half-
migrated state' objection is backwards. The CURRENT state is the dangerous
half-migrated state"* — the manifest advertises a deprecation the codebase has
not internalised. gpt-4o's reservation (a split creates internal/external
compatibility drift) was answered by keeping the dual-emit, so no consumer sees
a change. Both demanded no-op evidence before accepting it as behaviour-
preserving; that evidence is recorded on the Phase-2 step (byte-identical
corpus output for the routing linter, plus the 191/191 zero-disagreement pair
census).

**(3) Who may set the sunset date.** gpt-4o was explicit that the date "would
need to be set by a human maintainer to ensure accountability and
intentionality, rather than by an automated agent making potentially uninformed
decisions"; sonnet's amendment options all carry maintainer sign-off. So this
run records the amendment DECISION (ADR-137) but deliberately does not pick a
date — that is the one act left to the maintainer.

## Blockers

### blocker: trigger-set-amendment
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 3 (soak confirmation) and Phase 4 (the external removal
  half). Everything agent-executable is done: the audit, the internal
  `visibility` migration, and the reversibility analysis all landed 2026-07-28.
- **What to do:** the re-open trigger set is unsatisfiable as written (Trigger 1
  needs a sunset that was never set; Trigger 2 is impossible in a no-runtime
  package). [`ADR-137`](../../docs/decisions/ADR-137-amend-tier-removal-reopen-triggers.md)
  records the amendment: Trigger 2 is withdrawn as structurally impossible, and
  Trigger 1 becomes the sole gate. Its remaining leg needs ONE maintainer act —
  set a concrete `sunset` date in the `deprecations` block of
  `build_discovery_manifest.ts`, publish it, and let that date pass. The council
  ruled the date itself is not an agent decision.
- **Resolved when:** a concrete `sunset` date is published in the manifest's
  `tier` deprecation entry AND that date has passed with no external breakage
  reported — at which point Phase 3 records the confirmation and Phase 4's
  external half becomes executable.
  **Discharged 2026-08-13.** First leg: `sunset: '2026-08-13'` is set in
  `build_discovery_manifest.ts`. Second leg: **waived, not met** — the maintainer
  answered "sofortige Entfernung, wir haben lange genug gewartet", which is the
  owner exercising the call the council reserved for them ("the date itself is
  not an agent decision"). Phase 3 records the waiver as a waiver. Phase 4's
  external half is now unblocked and is the only thing left in this roadmap.

## Out-of-scope findings (2026-07-28, surfaced not fixed)

- **`lint_command_verbs.ts` currently gates nothing.** Its path filter is
  `_CMD_PATH_RE = /\.agent-src\.uncondensed\/commands\/.+\.md$/`, but that
  directory holds **0 files and is untracked** — ADR-051 moved command
  authoring to `src/domains/<domain>/**/command.md` (191 files), which
  `lint_command_routing.ts` scans correctly. So the verb-allowlist +
  banned-prefix rules have no live corpus. Verified by running the linter
  against two baselines: both report "No new/changed commands under
  `commands/`" with exit 0. This is **pre-existing** (it predates and is
  unrelated to the tier migration) and fixing it is **out of this roadmap's
  scope**: re-pointing the regex would newly enforce the verb allowlist across
  all 191 commands at once, which is a governance decision with an unknown
  violation set, not a tier-removal step. It is also why the Phase-2 migration
  could not produce a corpus-level differential for this file — the unit tests
  are its only real coverage.
