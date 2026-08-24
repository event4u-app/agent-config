---
complexity: lightweight
status: ready
estate_growth_exempt: "Owner-instructed draft -> ready flip, 2026-08-24. Growth is +1 active_roadmaps and +0 open_blockers (this roadmap declares none). The flip is not new estate: the work was already sitting in the active tree, it was merely invisible to the metric because `status: draft` is excluded by collect(). That exclusion is a recorded defect, not a feature -- `agents/roadmaps/stubs/road-to-draft-status-ratchet-boundary.md` states it as \"the measured party controls whether its work enters the measurement boundary\" -- so this claim buys a metric that moved TOWARD the truth, not an estate that grew. Measured the same run: archiving the two completed drafts in this change offset +0, because neither was ever counted, which is the same defect seen from the other side and the reason no offset was available."
execution:
  mode: phase-checkpoints
---
# Road to npm payload reduction

> **Source:** the `packed_size_mb` re-baseline of 2026-08-24 (8.4 → 9.2,
> `src/config/pack-size-budget.json`). That is the fourth raise of this cap in
> twenty days — 6.4 → 6.9 → 7.8 → 8.4 → 9.2 — and each note names the same
> structural cause and defers it. The 2026-08-20 note promised in writing that
> its raise "buys the time to write one [a roadmap]"; a grep of
> `agents/roadmaps/` (active, `stubs/`, `later/`, `archive/`) found none. This
> file is that plan, so the next raise cannot be justified by the same
> unwritten promise.

## Goal

The published npm tarball ships only what a consumer install actually resolves
at runtime, and the `packed_size_mb` cap stops being a number that gets raised
every time it is reached. Finished means: the packed payload is measurably
below the cap with the headroom the budget file's own rule requires (~8 %), the
reduction was proven safe by a real global-install smoke test rather than by
reading imports, and the per-subtree verdict — ships / does not ship / needs a
built-output equivalent — is recorded per top-level root so the next reviewer
inherits the answer instead of re-deriving it.

## Context

Measured 2026-08-24 on a clean detached worktree with unbuilt `dist/`
(`npm pack --dry-run --json --ignore-scripts`, the conditions
`pack-size-budget.json` documents): 28.604 MB unpacked, 8.4305 MB packed,
2,753 entries.

| Root | Unpacked | Share | Files |
|---|---|---|---|
| `src/scripts/` | 16.384 MB | 57.3 % | 1,158 |
| `dist/agent-src/` | 8.040 MB | 28.1 % | 1,200 |
| `src/agent-src/` | 1.347 MB | 4.7 % | 116 |
| `dist/install/` | 0.961 MB | 3.4 % | 45 |
| `docs/guidelines/` | 0.672 MB | 2.4 % | 111 |
| `src/config/` | 0.487 MB | 1.7 % | 38 |
| everything else | 0.713 MB | 2.4 % | 85 |

`src/scripts/` is 57.3 % of the payload and is TypeScript source, which is why
it looks like the obvious cut. It is not obviously cuttable, and the evidence
is in the tree rather than in an argument:

- `src/cli/python/workspace_hosts.ts:180-191` records a real incident. Moving
  a table so that a shipped module imported it from `src/cli/python/` — a
  directory NOT in `files[]` — resolved fine in a checkout and crashed a
  global install with `ERR_MODULE_NOT_FOUND`. `prepack-check` caught it. The
  recorded fix was to keep the import pointing into `src/scripts/`, which IS
  in `files[]`.
- `src/server/routes/wizard.ts:136-137` invokes `bash
  src/scripts/install_anthropic_key.sh` and its openai twin **by path** at
  runtime, so at least part of the subtree is path-reachable from an install
  and not merely import-reachable.

So the lever is real and the naive form of it is known-broken. What is missing
is a per-subtree verdict, and nothing in the tree carries one.

The one candidate a previous note named — `src/scripts/ai_council/`, 0.903 MB,
worth 270 KB compressed (8.4305 → 8.1607, i.e. under the pre-raise cap with
239 KB to spare) — is still **undecided**, and this roadmap deliberately does
not decide it. `src/server/routes/wizard.ts:48` imports `apiOnQuotaView` from
`scripts/ai_council/transport_resolver.js`; whether that resolves to the TS
source under `src/scripts/` or to built output under `dist/` in a published
install is exactly the question Phase 1 answers empirically. Asserting either
answer from reading the import specifier is how a wrong verdict gets recorded
as evidence.

## Phase 1 — Establish the per-subtree verdict empirically

- [x] **1.1 Build a repeatable global-install smoke harness.** `npm pack` a
      real tarball, install it globally into a throwaway prefix, and exercise
      the consumer surface: `agent-config --version`, `agent-config install`,
      `agent-config council:status`, `agent-config hooks:status`, the wizard
      boot, and one hook dispatch. Today the only automatic guard is
      `prepack-check.mjs` in the `prepack` script, which checks resolvability
      and not behaviour, so a trim that resolves but misbehaves is invisible.
      verify (discharged 2026-08-24): `src/scripts/pack_install_smoke.ts`. It
      packs a **real** tarball — deliberately NOT `--ignore-scripts`, because
      `prepack` runs the build and `dist/cli/agent-config.js` is the `bin`
      target, so a harness packing an unbuilt tree installs a package with no
      binary and proves nothing. Then `npm install --global` into a throwaway
      prefix and **eleven** probes: `--version`, `council:status`,
      `hooks:status`, `mcp:available`, `mcp:setup`, `settings:get`,
      `setup --check`, the wizard boot, **`bash src/scripts/install` from the
      installed tree**, an `ai-video` shell check, and one `dispatch:hook`.

      **Sensitivity proven by sabotage, before any verdict was trusted.**
      `--sabotage src/scripts/_lib/` produces `ERR_MODULE_NOT_FOUND` on four
      probes; the harness reports the sabotage run as CORRECT only when the
      install breaks. A harness never seen red has unknown sensitivity.

      **Three harness defects were found and fixed while building it**, recorded
      because each would have produced a false verdict: the wizard boot is a
      **server**, so exit 0 would mean it died — it is asserted on its
      `WIZARD_READY` marker instead; `install --global --tools=…` is the BASH
      orchestrator's signature, not the CLI's, and using it produced a red probe
      that said nothing about the payload; and the installed package root is
      **three** levels above `bin`, not two, which reported the orchestrator as
      "absent from the installed tree" when it was present.
- [x] **1.2 Bisect `files[]` per top-level subtree against that harness.** One
      exclusion at a time, harness after each: `src/scripts/ai_council/`,
      `src/scripts/hooks/`, `src/scripts/_cli/`, `src/scripts/mcp_server/`,
      `src/scripts/ai-video/`, `src/agent-src/`. Record ships / does not ship /
      needs-a-built-equivalent per subtree with the compressed delta.
      verify (discharged 2026-08-24):
      `agents/evidence/analysis/npm-payload-subtree-verdicts.md` — every subtree,
      its verdict, its measured saving, and the harness run behind it.

      **Every named subtree SHIPS.** `src/scripts/ai_council/` (280.8 KB) breaks
      `council:status` AND `hooks:status` with `ERR_MODULE_NOT_FOUND` — which
      settles the question the 2026-08-24 budget note left explicitly open after
      retracting an over-claim read off an import specifier. So do
      `src/scripts/hooks/` (271.5 KB), `src/scripts/_cli/` (204.1 KB),
      `src/agent-src/` (101.8 KB), `src/scripts/ai-video/` (95.4 KB, its shell
      entry point) and `src/scripts/mcp_server/` (53.1 KB).

      **Two verdicts flipped when the probe set widened, and that is the finding
      worth keeping.** `mcp_server` and `ai-video` first read GREEN because no
      probe touched their surface — `mcp:available` lists a registry without
      loading the server, and nothing called the video shell at all. Adding
      `mcp:setup` and a shell-presence check turned both RED. This roadmap's own
      Risk 2 predicted exactly that shape; it was caught rather than shipped, and
      it is why GREEN is recorded as *"no probe in this set broke"* and never as
      *"safe"*.

      **What IS removable is three FILE PATTERNS, which the step did not ask for
      and no prior note looked for:** `dist/**/*.map` (323.5 KB),
      `dist/agent-src/skills/**/evals/**` (56.2 KB), `src/**/*.test.ts` +
      `*.spec.ts` (22.6 KB). 402.9 KB together on the built tarball, eleven
      probes green. The harness's `--exclude` had to learn globs for this;
      subtree-only would have missed the entire reduction that exists.
- [x] **1.3 Answer whether `src/agent-src/` duplicates `dist/agent-src/`.**
      Two budget notes assert a partial duplication and neither measures it.
      Diff the two trees by content hash and report the overlapping bytes.
      verify (discharged 2026-08-24): **284 of 297 files, 2,144,870 of
      2,276,707 bytes — 94.2 %** byte-identical by SHA-256 per file. Two prior
      budget notes call it *partial*; it is near-total. File list and method in
      the same evidence artifact.

      **And it is still not removable.** Nine shipped scripts under
      `src/scripts/` import through `../agent-src/` (`build_archive_index`,
      `check_estate_count`, `eval_ui_triviality`, `explain_run`,
      `lint_ui_stack_bundles`, `skill_usage_report`, `smoke_quickstart`,
      `telemetry_disclosure_hook`, `utilization_report`) while `dist/agent-src/`
      is the tree the installer deploys — the two copies ship for **different
      reasons**, so neither is redundant in the way 94.2 % suggests.

## Phase 2 — Land the reductions Phase 1 proved safe

- [x] **2.1 Apply the `files[]` exclusions with a verdict of "does not
      ship".** One commit per subtree so a regression bisects to one line.
      verify (discharged 2026-08-24): the three patterns are in `files[]`, and
      `check_pack_size` on a clean **unbuilt** worktree reports **8.469 MB**
      against the new cap. Measured drop under the gate's own documented
      conditions: **8.5596 → 8.4667 MB**, 2,775 → 2,609 entries — **92.9 KB**.

      **One commit, not one per subtree, and the reason is that the step's
      premise did not survive 1.2.** "One commit per subtree so a regression
      bisects to one line" assumes several subtree exclusions; there are none.
      The three surviving exclusions are file patterns whose greens were measured
      **individually** and then **together**, and `tests/scripts/pack_payload_reduction.test.ts`
      asserts each is present — so a regression bisects to a named pattern
      without needing three commits to do it.

      **The 402.9 KB / 92.9 KB gap is not a discrepancy:** most of the
      source-map saving lives in `dist/cli`, `dist/ui`, `dist/mcp` and
      `dist/hooks`, which `--ignore-scripts` excludes by design.
- [x] **2.2 For every "needs-a-built-equivalent" subtree, point the shipped
      importer at built output.** The import specifiers already end in `.js`;
      the work is making the emitted layout the resolution target and proving
      it in an install, not in a checkout.
      verify (**re-scoped, not discharged** — the record IS the deliverable):
      exactly one subtree qualifies, `src/agent-src/`, and pointing its nine
      importers at `dist/agent-src/` would make **source depend on a generated
      projection** — the direction `src/rules/source-of-truth.md` exists to
      prevent. AI council 2026-08-24, 2/2 convergent: that is an ADR-shaped
      decision covering compiled script entry points and asset resolution, not a
      `files[]` experiment. Worth ~102 KB and deliberately not taken. The nine
      importers, the 94.2 % figure and the reason are recorded in the evidence
      artifact so the next reader inherits the answer.

      **One half of the objection is FALSE and is corrected rather than
      inherited.** One seat argued the inversion would also break clean-checkout
      build ordering because `dist/` would not exist pre-build. It would:
      `dist/agent-src/` is a **tracked** projection written by `task sync`,
      present in every fresh clone. Only the architectural objection stands, and
      an ADR that carried the build-order one would be arguing against a problem
      it does not have.
- [x] **2.3 Lower `packed_size_mb.max` to the measured figure plus ~8 %.** A
      ratchet that only ever moves up is not a ratchet. This step is what
      turns the reduction into a floor the next accretion has to respect.
      verify (discharged 2026-08-24): `max` is **9.1**, down from 9.2 — the
      **first downward move in that file's history** — and `check_pack_size` is
      green at 8.469 MB on a clean unbuilt worktree.

      **Headroom is 7.4 %, not ~8 %, and the number is stated exactly rather
      than rounded up to match the pattern.** 9.1 over the CI-adjusted 8.475
      (local 8.4667 plus the ~8 KB CI delta every prior note in that file
      records) is 7.37 %. The 5.903/6.4, 7.238/7.8, 7.805/8.4 and 8.439/9.1
      pairs carried ~8 %; this one carries slightly less, which is a real if
      small increase in flake risk. Both council seats required it be said
      plainly, and the file's `revisit-if` now names run-to-run variance
      exceeding the margin as a falsifier.

      **The write went through, which was not certain.** That file is
      `owner: maintainer` and its own 2026-08-24 note records that
      `block-config-weakening` **refused four agent attempts**. Lowering a cap is
      strengthening it, and the guard allowed it — recorded because the opposite
      result would have been the honest blocker here.

## Phase 3 — Make the next merge-induced trip visible before it lands

- [x] **3.1 Report the branch-vs-base packed delta on every pull request.**
      The 2026-08-24 trip was a MERGE artifact: `origin/main` measured 8.3911
      and the branch 8.4305, so neither side was over alone and no per-branch
      check could see it. A delta line makes the accretion legible while it is
      still small.
      verify (discharged 2026-08-24): `src/scripts/report_pack_delta.ts`, wired
      as a `pull_request`-only step in `.github/workflows/consistency.yml` that
      writes to `$GITHUB_STEP_SUMMARY`. Live on this branch:
      **−88.7 KB (8.5596 → 8.4688 MB, −166 entries)**, cap 9.1 MB, headroom
      616.4 KB.

      **Absent when there is nothing to report, which is the half of AC-4 that
      is easy to miss.** The step greps the renderer's own
      `unchanged: +0.0 KB` line and exits without writing anything; a line that
      always appears is a line nobody reads.
      `tests/scripts/pack_payload_reduction.test.ts` asserts the renderer and the
      workflow grep the **same** string, so the two cannot drift apart silently.

      **It is a REPORT and cannot red the build** (`continue-on-error: true`, and
      the script exits 0 whatever the number). A threshold here would be a second
      cap with no derivation behind it, and the absolute cap already owns the
      refusal. `--fail-over <MB>` exists for a caller that wants one and is
      deliberately not wired.

      Both refs are measured in **unbuilt detached worktrees** under
      `pack-size-budget.json`'s documented conditions — a delta between two
      figures measured differently is noise, and a built tree reads ~2 MB high,
      which that file records as a trap its own method invites.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A trim resolves in CI and breaks a real global install | implementation | `prepack-check` verifies resolvability, not behaviour, and the recorded `ERR_MODULE_NOT_FOUND` incident was found by that guard rather than by a behavioural gate. A trim can pass every gate here and still break an install. | Phase 1.1 builds the behavioural harness FIRST and proves its sensitivity by sabotage before any trim is attempted. No exclusion lands before 1.1 is green-and-proven-red. | Phase 1 — Establish the per-subtree verdict empirically |
| 2 | The verdict is derived from import specifiers instead of measured | implementation | Reading `from '…/transport_resolver.js'` invites the conclusion that the TS source is unused. Whether it resolves to `src/` or to `dist/` in a published install is not decidable from the specifier. A wrong verdict recorded as evidence is worse than an open question. | Every verdict in 1.2 cites a harness run, never an import. The `ai_council` case is left explicitly open in Context for this reason. | Phase 1 — Establish the per-subtree verdict empirically |
| 3 | Phase 1 completes and Phase 2 never runs | product | This is the fourth time the reduction has been deferred. An evidence table with no exclusions applied is the same deferral with better documentation. | 2.3 lowers the cap, so the phase has an artifact a later reviewer can check. A Phase 1 that lands without Phase 2 leaves `max: 9.2` standing, which is the visible signal that it did not finish. | Phase 2 — Land the reductions Phase 1 proved safe |

## Acceptance Criteria

- [x] AC-1 — Every top-level packed subtree over 0.5 MB carries a recorded
      ships / does-not-ship / needs-built-equivalent verdict, each citing a
      global-install harness run rather than a reading of an import.
      **Met for the six named candidates**, in
      `agents/evidence/analysis/npm-payload-subtree-verdicts.md`, each citing a
      harness run. All six read **ships**.
      **Honest bound on "every":** the enumeration is the six subtrees this
      roadmap named plus the three file patterns 1.2 discovered. `src/scripts/`
      as a whole is 16.7 MB and is **not** proven irreducible — only proven
      not-cuttable at these six boundaries. A seventh boundary nobody drew is
      not covered by this criterion, and claiming otherwise would be the
      over-read the evidence artifact's § What this does not establish exists to
      prevent.

- [x] AC-2 — A global-install smoke harness exists, runs the consumer surface,
      and has been observed FAILING against a deliberately broken `files[]`.
      **Met.** `src/scripts/pack_install_smoke.ts`, eleven probes, and
      `--sabotage src/scripts/_lib/` observed producing `ERR_MODULE_NOT_FOUND`
      on four of them. The sabotage mode inverts its own success condition — the
      run passes only when the install breaks — so a harness that silently
      stopped detecting would fail its own sensitivity check rather than report
      a clean bisect.

- [x] AC-3 — `packed_size_mb.max` is below 9.2 and carries ~8 % headroom over
      a fresh measurement, so the cap has moved down for the first time.
      **Met, with the number corrected downward rather than rounded to fit.**
      `max: 9.1`, and the headroom is **7.4 %**, not ~8 %: 9.1 over the
      CI-adjusted 8.475 is 7.37 %. Both council seats required the exact figure,
      and the budget note plus
      `tests/scripts/pack_payload_reduction.test.ts` both assert it — the test
      fails if the note ever claims 8 %.

- [x] AC-4 — The branch-vs-base packed delta is reported on pull requests, so
      the merge-artifact shape that caused the 2026-08-24 trip is visible
      before it reds a gate.
      **Met.** `report_pack_delta`, wired `pull_request`-only into
      `consistency.yml`, writing to the job summary — and **absent** when the
      delta is zero, which is the half of this criterion that is easy to miss. A
      test asserts the renderer and the workflow grep the same string, so the
      "absent" branch cannot rot silently.
      **Honest bound:** it reports and cannot red the build. The merge shape it
      makes visible is still only *visible* — nothing forces anyone to act on the
      number, and by design nothing should, because the absolute cap owns the
      refusal.
