<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that `release.ts:463` makes any `!` or `BREAKING CHANGE` subject a major whatever surface it touched, that `CONTRIBUTING.md:333` calls CI changes and internal refactors a patch, that 5 of the last 7 majors are recorded in BREAKING_CHANGES.md:50-56 as needing no consumer action, and that `_is_newer` truncates at the first `-` (update_check.ts:188-190) so a published `next` prerelease compares equal to its final release and its user is never told the release exists. No active, parked or stub roadmap owns any of these: a grep over agents/roadmaps/{*,later,stubs} for release.ts, _is_newer, BREAKING_CHANGES, Consumer-Impact and semver returns nothing. Archiving or parking costs more because the prerelease comparator is a live executable defect on the only path that tells a user an update exists; merging into road-to-truthful-surfaces would put a numbering model the owner must rule on behind a set of one-line text corrections that need no ruling at all."
estate_growth_exempt: "Adds one owner blocker (`impact-numbering-model`) above the open_blockers floor measured at origin/main. The blocker is the correct discharge rather than growth for its own sake: how every future release is numbered is a decision the agent must not take, and template rule 27 names a structured blocker as the record of exactly that. Measure the delta with `./scripts-run src/scripts/check_estate_count` on the landed commit rather than reading this sentence."
relates:
  - slug: road-to-truthful-surfaces
    relation: disjoint
    note: "Owns which command the banner names and which pointers resolve. This file changes what the version number means; it edits no badge, no topic list and no README surface."
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe
    relation: extends
    note: "That file's safety envelope consumes the impact map and the comparator built here. It is the only consumer; nothing in this file installs anything."
  - slug: road-to-a-cold-start-paid-once
    relation: disjoint
    note: "Owns what a first run costs. The 24 h update probe is read here for its request budget and is not changed."
---
# Road to a release that says whether it needs you

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-1/` — one transcript and
> four supplied plans from two parallel sessions. Pinned at `main@a10aa16a`;
> re-read at `main@5fa963cec` on 2026-10-16. Readings marked *(executed)* ran
> against this tree in a scratch directory outside the repository.

## Goal

This package's version number carries **consumer impact**, so "install it when
it is safe, ask when it matters" is a lookup rather than a guess. A release
that changed nothing a consumer can see is not a major; a release that needs a
hand is one, and says so in a field a machine can read.

Nothing here installs anything, asks anything, or changes an observable
output. It is the classifier and the data behind it.

## Prerequisites

- `npx vitest` runs locally.
- A read of `BREAKING_CHANGES.md:50-56` and `CONTRIBUTING.md:329-333` before
  Phase 2 — the replay in 2.2 is scored against those rows.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| G1 | **Majors are cut against this package's own written policy.** `CONTRIBUTING.md:333` puts "CI changes … internal refactors with no user-visible effect" in the **patch** row. `BREAKING_CHANGES.md:50`, `:52`, `:53` record 16.0.0, 14.0.0 and 13.0.0 as majors whose own rows read "No consumer action — package-internal" or name this repository's CI config. |
| G2 | **The cause is one line.** `src/scripts/release.ts:463` — `const breaking = Boolean(m.groups!['bang']) \|\| subject.includes('BREAKING CHANGE');` — so any `!` subject is a major whatever surface it touched. |
| G3 | **"Breaking" therefore has no machine-readable meaning.** *(executed)* classifying `BREAKING_CHANGES.md:50-56`: none-or-automatic = {16.0.0, 14.0.0, 13.0.0, 11.0.0, 10.0.0}; needs-action = {12.0.0, 15.0.0}. **5 of 7.** An updater keyed on SemVer-major would have asked seven times in one month for two real actions. Seven majors shipped in 31 days (`:50`…`:56`, 2026-08-12 → 2026-09-12). |
| G4 | **A prerelease compares equal to its own release.** `update_check.ts:188-190` does `v.replace(/^v+/,'').split('-')[0]`, dropping everything after the first `-`. *(executed)* `_is_newer('16.6.0','16.6.0-next.3')` → `false`; `_is_newer('17.0.0','16.6.0-next.3')` → `true`. The package publishes a `next` dist-tag (`.github/workflows/publish-npm.yml:154-168`), so a user on that channel is never told the final release exists. |
| G5 | **Staleness is a support state, not a cosmetic one.** `SECURITY.md:21-22` — fixes land on the latest published version and older releases are not backported. An install that is not current is unsupported, which is what makes G1–G4 worth fixing even with no adoption goal anywhere. |
| G6 | **The runtime floor is already past its support window and nothing checks it.** `package.json:78` declares `">=20.11.0"`. *(executed)* the CI `node-version` histogram is **45 on Node 20**, 10 on 22, 1 on 24, 3 unquoted — 59 pins. Nothing compares a candidate's `engines` against `process.version`, so a future floor raise is a release that installs and cannot start. |

## Phase 1 — Name the impact where it is known: at commit time

- [x] **1.1 Define the trailer.** `Consumer-Impact: none | automatic | notice |
      action`, plus an optional `Security: yes`, documented in
      `CONTRIBUTING.md` beside the bump table at `:329-333`. `none` = nothing a
      consumer can observe; `automatic` = the update handles it; `notice` =
      read this; `action` = do something or it breaks.
      The four values are enumerated on one line.
      verify: `grep -c 'Consumer-Impact' CONTRIBUTING.md` -> /^[1-9][0-9]*$/
- [x] **1.2 Parse it where commits are already parsed.** `src/scripts/release.ts`
      builds its `Commit` records at `:455-470`; read the trailer in that same
      pass, defaulting to `none` with the absence recorded.
      verify: a unit test over a synthetic commit list returns the four values
      and `none` for an untrailered subject.
- [x] **1.3 Refuse a breaking subject with no trailer.** A commit carrying `!`
      or `BREAKING CHANGE` inside the release span and no `Consumer-Impact:`
      fails the release check — the one place the author is still present.
      verify: a fixture span with such a commit exits non-zero; the same span
      with the trailer exits 0. Both directions.
      Landed: `src/scripts/_lib/consumer_impact.ts` (`impact_span_verdict`),
      called from `release.ts` `main()` right after the span is read;
      `tests/lib/consumer_impact.test.ts` builds a real span in a temp
      repository and asserts both directions plus an out-of-enum value. Seen
      red by neutralising the predicate. The span since 16.5.0 carries no `!`
      subject, so the next release is not affected.

## Phase 2 — The bump follows the impact, not the punctuation

- [ ] **2.1 Replace the `release.ts:463` rule.** Major only when a commit in
      the span carries `action`, or touches a surface `CONTRIBUTING.md:331`
      already lists as major. An internal `!` becomes a minor.
      verify: unit tests over the two branches.
      Open (2026-10-17): still held by blocker `impact-numbering-model`
      option (a). The rule exists as the pure, uncalled `impact_bump` in
      `src/scripts/_lib/impact_bump.ts` so 2.2 could score it; wiring it into
      `infer_bump` is the owner-reserved part.
      Still open (2026-10-20), and the reason has changed. The council's
      evidence precondition is discharged — see the blocker — so the step is
      no longer waiting on a measurement. It waits on the owner alone: binding
      the trailer to the version number changes a public compatibility
      commitment, which `decision-revisit-gate`'s reserved set routes to the
      owner whoever holds the pen. The second half of the step also acquired a
      specification gap the measurement found: `CONTRIBUTING.md:331`'s major
      list names rules and skills and omits **commands**, and 15.0.0's break
      was a command removal. Wiring the surface clause as written would leave
      that shape uncovered, so the list is edited in the same change as the
      wiring or the clause ships with a known hole.
- [x] **2.2 Replay the real history.** Score 10.0.0 → 16.0.0 through the new
      rule against the recorded rows.
      verify: 13.0.0, 14.0.0 and 16.0.0 come out **minor**; 12.0.0 and 15.0.0
      come out **major**. A replay that reproduces the old classification has
      changed nothing and is the failure, not the pass.
      Landed (2026-10-17): `replay_majors` reads the 2.3 column from the live
      `BREAKING_CHANGES.md`. Result over 10.0.0 → 16.0.0: 12.0.0 and 15.0.0
      major; 10.0.0, 11.0.0, 13.0.0, 14.0.0 and 16.0.0 minor — five of seven
      majors would have been minors. The surface half of the rule is not
      scored: the record has no surface column, and inferring one would
      re-judge history. Accuracy on this window is 7/7 with zero false
      negatives on `action`, but the window is the same seven rows that
      supplied the expected values, so it is a consistency check, not an
      independent measurement. Test: `tests/lib/impact_bump.test.ts`, seen
      red before the column existed.
- [x] **2.3 Backfill the record.** Add a `Consumer impact` column to
      `BREAKING_CHANGES.md` for 2.0.0 → 16.5.0, taken from each row's existing
      Migration prose rather than re-judged.
      verify: every row in that table carries a value from the enum.
      Landed (2026-10-17): all 17 rows (1.0.0 → 16.0.0, two for 6.0.0)
      carry a value; the table has no row for a non-major, so 16.5.0 adds
      none. Prose that says "no consumer action" → `none`; "Automatic" →
      `automatic`; an instruction to change something → `action`; 9.0.0
      (an opt-out rollback, nothing breaks) → `notice`. No row needed the
      undecided-prose fallback. The column carries the blocker's
      experimental, non-normative disclaimer.

## Phase 3 — Publish the map, and read versions correctly

- [x] **3.1 Write the map into the published package.** The release script
      emits `agentConfig.impact` into `package.json`, non-`none` entries only,
      so the document stays small.
      verify: a dry-run release writes the key and omits `none` rows.
      Landed: `set_package_version` (release step 2) writes the map through
      `write_impact_map`. `--dry-run` returns before step 2 and writes no
      file, so the writer is exercised on a temp `package.json` instead: an
      `action` release writes the key, a `none` release adds no row.
- [x] **3.2 Spike — is the map reachable in one request?** `update_check.ts:36`
      already fetches `https://registry.npmjs.org/@event4u/agent-config/latest`
      once per 24 h. Establish whether that document carries custom
      `package.json` fields. If it does not, cost the packument fallback
      against the one-request-per-24-h budget **before** anything depends on
      it. This is a spike with a written outcome, not a build step.
      verify: the finding is recorded in this file's `## Decisions` as D4 with
      the observed response shape.
- [x] **3.3 A real comparator for policy decisions.** Add one beside
      `_is_newer`: prerelease ordering, `v` prefix, invalid input → no action.
      **Keep `_is_newer` and its behaviour** as a pinned regression fixture —
      `_is_newer('16.6.0','16.6.0-next.3') === false` is the witness that the
      new path and the old one are different code.
      verify: the new comparator returns `true` for that pair; the pinned
      fixture still returns `false`.
- [x] **3.4 The local machine overrides the map.** If the candidate's
      `engines.node` is unsatisfied by `process.version`, the impact for this
      machine is `action`, whatever the map says.
      verify: a fixture with `engines.node: ">=22"` under a Node 20
      `process.version` yields `action`.
      Landed (3.3 + 3.4): `is_newer_version` sits beside `_is_newer` in
      `src/scripts/_lib/update_check.ts`, backed by the pure
      `src/scripts/_lib/version_order.ts` (SemVer precedence and the
      `engines.node` range subset); `_is_newer` and the banner are untouched.
      `machine_override` in `classify_update.ts` returns `action` for that
      fixture and for a range it cannot check. Tests:
      `tests/lib/version_order.test.ts`, `tests/lib/classify_update.test.ts`.

## Phase 4 — One pure classifier, no behaviour change

- [x] **4.1 Write `classifyUpdate`.** Signature:
      `{installed, candidate, origin, env, impactMap, engines, publishedAt, deprecated, provenance, settings} → {action: auto|ask|notify|none, reasons[]}`.
      Origins come from `src/scripts/_cli/doctor_install_mode.ts`; no new
      detector, no new CLI verb (ADR-041).
      verify: the function is pure — no filesystem, no network, no process
      exit — asserted by a test that calls it with a frozen input object.
- [x] **4.2 Encode the rules.** Any `action` in range, or engines unmet →
      `ask`. `Security: yes` in range → `notify` in every mode but `off`. A
      project pin present → never `auto`. CI, non-interactive, a source
      checkout, or `AGENT_CONFIG_NO_UPDATE_CHECK=1` → `none`, mirroring the
      four suppressions already at `update_check.ts:239-255`. Deprecated, or
      inside the release-age gate → wait. Provenance missing → `notify`.
      Uncertainty of any kind → never `auto`.
      verify: a ≥ 40-case matrix including the five no-action majors, a forged
      manifest, a prerelease, a dist-tag drift and a disk-full read. **Zero
      `auto` verdicts under uncertainty** is the assertion that matters.
      Landed (4.1 + 4.2): `src/scripts/_lib/classify_update.ts`, 57-case
      matrix in `tests/lib/classify_update.test.ts`. Interpretations taken
      where the step was silent: "wait" is `none` with a `wait:` reason; a
      security fix lifts a wait to `notify`; an absent mode, an unknown
      origin, a `project-pin` origin or a prerelease candidate is an
      uncertainty; an `ephemeral` npx run is `none`; a malformed map entry
      is treated as `action`. The origin type reuses `InstallOrigin` from
      `classify_install_origin` in `update_check.ts` (landed on main in
      #2416, which `doctor_install_mode.ts` feeds) plus `source-checkout`;
      no new detector.
      The no-`auto` assertion was seen red by disabling the provenance rule.
      AC-4 stays open: its second half holds; its first holds for every
      input that is not suppressed and has a newer candidate. This step
      makes CI, non-interactive, source checkout, the opt-out and mode `off`
      resolve to `none`, so a literal "every input" contradicts it. Which
      wins is for the reviewer to settle; the test asserts the scoped form.
      Amended after the merge-danger council on this PR: engines unmet now
      yields a fifth verdict, `action`, not `ask` — `ask` means "install on
      approval", and a candidate this machine cannot run must not be
      installable that way (3.4 already names the impact `action`). A
      prerelease Node runtime is an uncertainty (`notify`), the same policy
      as a prerelease candidate, because the `engines.node` subset does not
      reproduce npm's prerelease range bounds.
- [x] **4.3 Expose it read-only.** `doctor --json` reports the verdict and its
      reasons. Nothing acts on it in this roadmap.
      verify: the banner, `upgrade` and `update` emit byte-identical output on
      the existing fixtures — a diff of recorded stdout before and after.
      Landed (2026-10-18): `doctor --json` carries an `update_verdict` block
      from `src/scripts/_cli/doctor_update_verdict.ts` — installed, the cached
      candidate, the origin, `action`, `reasons`, and a `not_cached` list
      naming the five registry fields the probe cache does not keep. Both
      objections below were answered without changing a state file: doctor
      reads `update-check.json` and never writes it or queries the registry,
      and the fields it cannot see reach `classifyUpdate` as unknowns, so the
      verdict can be `notify` or `none` but never `auto` (asserted, and seen
      red by feeding it a clean known input). `cmd_doctor.ts` paid for its two
      lines by moving `STATUS_SYMBOLS` and `_emit_checks_text` verbatim into
      `_doctor_emit.ts` (3,560 -> 3,539; the size ratchet lowered to 17,386).
      Byte-identity: the esbuild import closure of `check_update_banner.ts`,
      `cmd_upgrade.ts` and `cmd_update.ts` (27 files) shares no file with this
      change, and their five suites (85 tests) pass unchanged; this roadmap's
      only earlier edit there (#2421) added an export nothing on those paths
      calls. A source checkout is detected by a `.git` entry at the package
      root, because `dist/agent-src/` ships in every tarball.
      Test: `tests/scripts/doctor_update_verdict.test.ts`.
      Was open (2026-10-16): the verdict has nothing true to report from yet.
      The cached `update-check.json` keeps only `last_seen_version`, so
      `engines`, `agentConfig.impact`, `dist.attestations` and
      `deprecated` — all present in the `/latest` document per D4 — would
      need to be persisted by the probe first, which changes a state file
      the banner reads. And `cmd_doctor.ts` sits above the 1,500-line
      ceiling, so the reporting line needs a neighbouring extraction to pay
      for it. Both belong in one reviewed change, not appended to this one.

## Blockers

### blocker: impact-numbering-model

- **Status:** open on (a) only — **(b) is decided and (c) is refused.** AI
  council 2026-10-16, 2/2 concluded, no split, routing **per option** as the
  question invited: **(b) DECIDE** — advisory collection alters no dependency
  resolution and stays inside delegated authority; **(c) DECIDE** — preserving
  the existing rule creates no commitment, and both seats declined it; **(a)
  ESCALATE** — binding the trailer to the version number changes a public
  compatibility commitment, because version numbers govern consumer dependency
  resolution. Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.
  **2026-10-17:** the evidence (a) waits on now exists. Step 2.2 replayed
  10.0.0 → 16.0.0 and scored 12.0.0 and 15.0.0 major and the other five
  minor, with no `action` row scored as a minor. The decision itself is
  still open.
  **2026-10-19, council re-asked with the replay in hand (2/2, $0.00, record
  `agents/evidence/council/resolve-blockers-batch-20261019.md`):** (a) is still
  clause 5, unchanged by the replay, so it stays the owner's — but both seats
  chose **(a-later)**: 7/7 is in-sample (the same seven rows the rule was
  written against) and the surface axis is unscored. (a) returns to the owner
  only after the frozen classifier is scored on a pre-registered window it was
  not written on, on both axes, with zero false negatives on BREAKING. No owner
  question is put until that measurement exists.
  **2026-10-20, the precondition is discharged.**
  `agents/evidence/analysis/impact-bump-out-of-sample-20261020.md` carries a
  pre-registered protocol committed before any span was read, and the result
  in the commit after it. Window: the seven majors 2.0.0 → 9.0.0 the rule was
  not written on (4.0.0 excluded in advance — the remote carries no `4.0.0`
  tag, so its span has no lower bound). Both axes: the recorded impact, and a
  new `classify_surfaces` (`src/scripts/_lib/major_surface.ts`) that reads the
  surface axis mechanically from each span's diff, which 2.2 could not supply.
  **Zero false negatives on BREAKING, 0 of 7 out-of-sample and 0 of 14 over
  both windows.** The rule keeps 6 of 7 early majors and 4 of 7 recent ones,
  which refutes the live reading of 2.2 — that its 5-of-7 demotion was the
  rule's bias rather than the history's. 13.0.0, 14.0.0 and 16.0.0 are still
  minor with the surface axis live, so 2.2's headline survives the clause it
  could not test.
  **One figure in this paragraph was wrong when first committed and the
  correction is the most decision-relevant line here.** The first run reported
  the surface clause as inert in 14 of 14 cases; an independent R2 review found
  the detector blind (its settings-template path was anchored at a root the
  file left in 6.0.0), and the repaired run has the clause **decide** 10.0.0
  and 11.0.0. In both, the removed keys are real and each row's own prose
  records the migration as **automatic**. So `CONTRIBUTING.md:331` as written
  says a settings key removed with an automatic migration is a major — a
  question for the owner under (a), not an implementation detail.
  Limits recorded rather than argued away: the impact axis stays a consistency
  check in both windows, because no historical release carries an
  author-written trailer; two decided cases are too few to call the surface
  clause accurate; `CONTRIBUTING.md:331` omits commands, which is what 15.0.0
  removed; and this measurement was caught wrong by review rather than by its
  own controls, which is evidence about the controls. Whether it clears the bar
  the council set is the council's reading, not this roadmap's. The owner
  question on (a) is now unblocked on evidence and unasked.
- **Owner:** repository owner, **for (a) alone.**
- **Blocks:** step 2.1 and the parts of Phase 2 downstream of it. **Corrected
  2026-10-16:** this used to read "Phase 2 and everything downstream". Steps 2.2
  and 2.3 are not blocked — see the contradiction resolved under
  `What to do` — and Phases 1, 3 and 4 were already additive.
- **What to do:** **(b) now, decided by council; (a) is the owner's.**
  **Superseded 2026-10-20:** this field used to end "and waits on 2.2's
  result", which was already stale on 2026-10-19 (the council replaced that
  precondition with an out-of-sample score) and is stale again now that the
  score exists. (a) waits on nothing but the owner. The trailer is recorded
  and published as **explicitly
  experimental, non-normative metadata**; the bump rule at `release.ts:463` is
  untouched. Superseded alternatives: (a) the trailer plus the new bump rule —
  owner-reserved, not refused; (c) reject both — declined by both seats.

  **The contradiction both seats caught, and its resolution.** This field used
  to say (b) *"reduces Phase 2 to 2.3 (the backfill)"*, while the recommendation
  said *"(b) first, then (a) once the replay in 2.2 has run"*. Those cannot both
  hold: with 2.2 cut, the evidence for (a) is never produced and (b) becomes
  terminal by accident. `anthropic` supplied the clean resolution — **2.2 scores
  historical releases** (10.0.0 → 16.0.0 against the recorded rows) and
  therefore needs no new commit to carry the trailer at all. So under (b),
  Phase 2 reduces to **2.2 and 2.3**, and 2.2 is exactly the evidence (a)
  waits on.

  **"Advisory commits the package to nothing" is too absolute**, and both seats
  said so independently. The trailer is **published in git history**, so it is
  externally observable whether or not it binds: a commit reading
  `Consumer-Impact: BREAKING` that ships as a patch is contradictory public
  communication. (b) therefore ships with an explicit stability disclaimer —
  experimental, non-normative, not authoritative compatibility guidance — and
  that disclaimer is part of (b), not a nicety on top of it.

  **What 2.2 must show for (a) to be defensible, since the staged path is only
  worth as much as its threshold.** The bar is **accuracy** — the share of
  trailer-driven bumps that match actual consumer impact — and not the share of
  bumps that would change (`anthropic`: *"a 30% change rate where all 30% are
  misclassifications is worse than 5% where all are fixes"*). The hard
  requirement is **zero false negatives on BREAKING**: a missed breaking change
  is the one error consumers cannot recover trust from.
- **Resolved when:** an ADR under `docs/decisions/` records (a), (b) or (c),
  and this blocker's Status reads `resolved — <adr>`.
- **Recommendation:** (b) first, then (a) once the replay in 2.2 has run —
  **endorsed by the AI council on 2026-10-16, which decided (b) outright and
  left (a) with the owner.** The replay is the evidence for (a) and costs
  nothing to produce.

  **One clause of the original reasoning is withdrawn.** It said the trailer
  *"makes the next three releases a measurement"*, which would make (a) wait on
  three future cuts. Step 2.2 scores **historical** releases (10.0.0 → 16.0.0
  against the recorded rows), so the evidence needs no future release and no
  new commit carrying the trailer — the measurement can run the day (b) lands.
- **If you do nothing:** the package keeps cutting majors its own
  `CONTRIBUTING.md` calls patches, and the classifier in Phase 4 has an
  `impactMap` that is correct for nothing before the first trailered release.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | SemVer-major is never the ask trigger | 5 of the last 7 majors needed no consumer action (`BREAKING_CHANGES.md:50-56`, executed) | a major is cut only for consumer-visible change for four consecutive releases |
| D2 | reversible-technical | evidence | Keep `_is_newer` beside the new comparator rather than replacing it | its truncation behaviour is asserted by an existing fixture; replacing it in place would delete the regression witness for the defect | the pinned fixture is retired with a recorded reason |
| D3 | deterministic | agent | No new CLI verb; the classifier is a function `doctor --json` reports | ADR-041 | ADR-041 is superseded |
| D4 | contested-technical | evidence | Read the impact map from the `/latest` document the 24 h probe already fetches; no packument fallback is needed | step 3.2, observed 2026-10-16: `GET https://registry.npmjs.org/@event4u/agent-config/latest` returned 7,948 bytes for 16.5.0 carrying every top-level `package.json` key of the 16.5.0 tag except `files`, **including the non-standard `mcpName`** — so a custom top-level key reaches the reader. The same document carries `engines` (`{"node": ">=20.11.0"}`) and `dist.attestations` (provenance); `deprecated` is absent when unset. The fallbacks cost far more: the full packument was 842,897 bytes and the abbreviated `application/vnd.npm.install-v1+json` form 260,604 bytes, against one request per 24 h | the registry stops carrying a non-standard top-level key in `/latest`, or the first release that writes `agentConfig` shows it absent from that document |
| D5 | critical-technical | evidence | Uncertainty never resolves to `auto` | an updater that guesses on a release it cannot classify is the failure mode the whole file exists to prevent | never |

D4 was first recorded as a deferral to a measurement; step 3.2 took it. The
witness is indirect on purpose: no published version carries `agentConfig`
yet, so the evidence that it will survive is that `mcpName`, another key npm
does not define, already does. The first release that writes the key is the
direct check named in the revisit column.

## What this roadmap deliberately does not do

- It installs nothing and asks nothing. The verdict is computed and reported;
  acting on it belongs to its sibling.
- It does not raise the Node floor. G6 is why the engines check exists here;
  the raise itself is a consumer-facing commitment held in the sibling file.
- It does not touch `agent_config_version` or any team-reproducibility surface.
- It adds no setting. `update.mode` belongs to the sibling that acts.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A release carrying a real consumer action is trailered `none` and ships as a patch | product | The classification moves from a mechanical rule to an author's judgement, and a wrong judgement now downgrades rather than upgrades. | 1.3 refuses an untrailered breaking subject at the one point the author is present; 2.2's replay is scored against seven real releases before the rule governs anything, and the 2026-10-20 out-of-sample run adds seven more it was not written on — zero false negatives on BREAKING across all fourteen; (b) in the blocker keeps the old rule while the trailer is measured. | Phase 2 — The bump follows the impact, not the punctuation |
| 2 | The impact map is not reachable in the existing one request per 24 h | implementation | The classifier needs a second request, which the probe budget may not have. | 3.2 is a spike whose outcome is recorded before anything depends on it; the fallback is costed, not assumed. | Phase 3 — Publish the map, and read versions correctly |
| 3 | The new comparator changes an observable output | implementation | `_is_newer` feeds the banner; a different answer changes what users see. | 4.3 asserts byte-identical output on existing fixtures; the new comparator is used for policy decisions only until something consumes it. | Phase 3 — Publish the map, and read versions correctly |
| 4 | The 40-case matrix is written by the same hand as the rules | implementation | A self-written matrix covers the paths its author thought of. | The five no-action majors and the two action majors are taken from the recorded history rather than invented, so at least seven cases are adversarial by origin. | Phase 4 — One pure classifier, no behaviour change |
| 5 | The backfill re-judges history instead of reading it | implementation | A backfilled column that disagrees with the Migration prose makes the replay score itself. | 2.3 takes each value from the row's existing prose; a row whose prose does not decide gets `notice`, named in the diff. | Phase 2 — The bump follows the impact, not the punctuation |
| 6 | A path-anchored surface detector goes silently blind and the measurement reports inertness rather than blindness | implementation | Registered 2026-10-21 because it already happened: `SETTINGS_KEY_FILES` was anchored at `^config/`, the settings template moved to `src/config/` in the 6.0.0 span, and the settings surface therefore matched nothing across the entire scored window. The first run read that as "the clause changed no verdict in 14 of 14" — a clean, plausible, wrong result. A blind detector and an inert clause are indistinguishable from the output alone, and the error pointed at the comfortable answer. | Every surface now carries a positive control pinned to a named span as well as a negative one, which is the control the first run was missing; the repaired run has the clause decide 10.0.0 and 11.0.0. The structural fix is not available here: nothing in this branch consumes the detector, so a path that stops matching cannot fail a test. Any wiring of the surface clause under blocker option (a) must anchor the settings path on the real location and assert the positive control, or it ships this risk live. | Phase 2 — The bump follows the impact, not the punctuation |

## Acceptance Criteria

- [x] **AC-1** Replaying 10.0.0 → 16.0.0 through the new bump rule yields minor
      for 13.0.0, 14.0.0 and 16.0.0 and major for 12.0.0 and 15.0.0.
- [x] **AC-2** A release-span commit carrying `!` with no `Consumer-Impact:`
      trailer fails the release check; the same commit with a trailer passes.
- [x] **AC-3** The new comparator returns `true` for
      `('16.6.0','16.6.0-next.3')` while the pinned `_is_newer` fixture still
      returns `false`.
- [ ] **AC-4** Over a ≥ 40-case matrix, `classifyUpdate` returns `ask` for
      every input whose `engines.node` is unsatisfied, and `auto` for **no**
      input carrying an unknown, a missing provenance or a project pin.
      Open for the owner (2026-10-18): the AI council split on whether this
      text may be amended to the shipped `action` form — `anthropic` (3) leave
      it with the owner, `openai` (1) amend with ordered wording. Both agree
      the shipped behaviour is right. Record and the proposed wording:
      `agents/evidence/council/release-impact-ac4-wording-20261018.md`.
- [x] **AC-5** `classifyUpdate` performs no filesystem or network access,
      asserted by a test that calls it with a frozen input.
- [x] **AC-6** The banner, `upgrade` and `update` produce byte-identical
      recorded stdout before and after the whole change.
      (Evidence under step 4.3: no file in their import closure changed.)
- [x] **AC-7** Every row of `BREAKING_CHANGES.md`'s table carries a
      `Consumer impact` value from the enum.
- [x] **AC-8** `task ci` green.
      (Closes with the PR that closes this file: the remote pipeline is the
      authoritative run, and a green it has not yet reported is not evidence.)
      Closed by this PR's final pipeline run, which is the run the merge is
      bound to — so the box cannot ship checked over a red.
      **One reading on the way there is worth recording rather than
      absorbing.** Head `2e05048b7` read `stop` p95 272 ms against the
      `any_hook_event` cap of 250 in `src/config/hook-latency-budget.json`.
      It is a runner-speed reading, not a regression: `main` at `fba00aabf`
      carries byte-identical hook code and read 182 ms, and the control
      (`node -e 0`, none of this tree's code) moved 20 → 27 ms on the same
      run while every slot moved 35–46 % with it. Nothing in this branch is
      in the hook bundle's import closure — `major_surface.ts` is imported
      only by its own test. The cap is **not** touched: that file is
      pre-registered and owner-owned, and its own text calls raising a number
      without a measured distribution beside it the config-bending it exists
      to make visible. Re-measured on a fresh runner instead. If the overshoot
      reproduces on a runner whose control reads ~20 ms, it stops being a
      reading and becomes the finding that `stop` has grown into the tallest
      slot while `any_hook_event` still carries the cap it had when
      `pre_tool_use` was — the same pathology that forced that cap's
      re-derivation from 150 to 175.

## Provenance

Source-derived under template rule 19; same source set as
`road-to-truthful-surfaces`, not named here per `source-confidentiality`, links
`ENC1`-encrypted in the round's intake note.

| Proposed | Verdict | Why |
|---|---|---|
| `Consumer-Impact:` trailer + impact-driven bump | KEEP | G1–G3 reproduced; the written policy and the code disagree today. |
| Prerelease comparator | KEEP | G4 executed; live on the only path that tells a user an update exists. |
| `engines` check before an update | KEEP | G6: nothing compares a candidate's engines against the running runtime. |
| Pure `classifyUpdate` | KEEP | No equivalent exists; `update_check.ts` decides only whether to print. |
| A new `status` / `why` verb | CUT | ADR-041 forbids a new verb and `doctor --json` is the shipped surface. |
| `upgrade --to <version>` | CUT | `update --to` already exists (`cmd_update.ts:412`); two near-identical flags on two confusable verbs is the defect this family is fixing. |
| Release channels / staggered cohorts | FOLD | The `next` dist-tag already is the ring (`publish-npm.yml:154-168`); folded into the sibling's rollout phase. |
| Adoption-driven release cadence | CUT | Owner-reserved record; out of scope by construction. |

## Notes — how this file was derived

Three extraction passes, converged at pass 2. G3's 5-of-7 and G6's 45-of-59
were re-derived offline and reproduce to the digit; G4 was reproduced by
importing `_is_newer` in a scratch directory. The supplied plans proposed
`upgrade --to`, which verification refused — the flag already exists on the
other verb, and the confusion between those two verbs is G1's neighbour, not
something to add to.
