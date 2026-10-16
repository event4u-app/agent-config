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
- [ ] **2.2 Replay the real history.** Score 10.0.0 → 16.0.0 through the new
      rule against the recorded rows.
      verify: 13.0.0, 14.0.0 and 16.0.0 come out **minor**; 12.0.0 and 15.0.0
      come out **major**. A replay that reproduces the old classification has
      changed nothing and is the failure, not the pass.
- [ ] **2.3 Backfill the record.** Add a `Consumer impact` column to
      `BREAKING_CHANGES.md` for 2.0.0 → 16.5.0, taken from each row's existing
      Migration prose rather than re-judged.
      verify: every row in that table carries a value from the enum.

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
      Landed (4.1 + 4.2): `src/scripts/_lib/classify_update.ts`, 55-case
      matrix in `tests/lib/classify_update.test.ts`. Interpretations taken
      where the step was silent: "wait" is `none` with a `wait:` reason; a
      security fix lifts a wait to `notify`; an absent mode, an unknown
      origin or a prerelease candidate is an uncertainty; a malformed map
      entry is treated as `action`. The origin type names the shapes
      `doctor_install_mode.ts` distinguishes; nothing calls a detector.
      The no-`auto` assertion was seen red by disabling the provenance rule.
      AC-4 stays open: its second half holds; its first holds for every
      input that is not suppressed and has a newer candidate. This step
      makes CI, non-interactive, source checkout, the opt-out and mode `off`
      resolve to `none`, so a literal "every input" contradicts it. Which
      wins is for the reviewer to settle; the test asserts the scoped form.
- [ ] **4.3 Expose it read-only.** `doctor --json` reports the verdict and its
      reasons. Nothing acts on it in this roadmap.
      verify: the banner, `upgrade` and `update` emit byte-identical output on
      the existing fixtures — a diff of recorded stdout before and after.
      Open (2026-10-16): the verdict has nothing true to report from yet.
      The cached `update-check.json` keeps only `last_seen_version`, so
      `engines`, `agentConfig.impact`, `dist.attestations` and
      `deprecated` — all present in the `/latest` document per D4 — would
      need to be persisted by the probe first, which changes a state file
      the banner reads. And `cmd_doctor.ts` sits above the 1,500-line
      ceiling, so the reporting line needs a neighbouring extraction to pay
      for it. Both belong in one reviewed change, not appended to this one.

## Blockers

### blocker: impact-numbering-model

- **Status:** open
- **Owner:** repository owner
- **Blocks:** Phase 2 and everything downstream of it. Phases 1, 3 and 4 are
  additive and run without it; Phase 2 changes how every future release is
  numbered, which is a product commitment the agent must not take.
- **What to do:** pick exactly one — (a) accept the `Consumer-Impact:` trailer
  **and** the new bump rule, recorded as an ADR, and Phase 2 proceeds as
  written; or (b) accept the trailer as **advisory only** — it is recorded and
  published, the bump rule at `release.ts:463` is untouched, and Phase 2
  reduces to 2.3 (the backfill); or (c) reject both, and this roadmap stops
  after Phase 1.1's documentation step with the rest cancelled.
- **Resolved when:** an ADR under `docs/decisions/` records (a), (b) or (c),
  and this blocker's Status reads `resolved — <adr>`.
- **Recommendation:** (b) first, then (a) once the replay in 2.2 has run.
  The replay is the evidence for (a) and it costs nothing to produce under
  (b): a trailer that is recorded but not acted on makes the next three
  releases a measurement of whether the classification is right, before the
  numbering depends on it.
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
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A release carrying a real consumer action is trailered `none` and ships as a patch | product | The classification moves from a mechanical rule to an author's judgement, and a wrong judgement now downgrades rather than upgrades. | 1.3 refuses an untrailered breaking subject at the one point the author is present; 2.2's replay is scored against seven real releases before the rule governs anything; (b) in the blocker keeps the old rule while the trailer is measured. | Phase 2 — The bump follows the impact, not the punctuation |
| 2 | The impact map is not reachable in the existing one request per 24 h | implementation | The classifier needs a second request, which the probe budget may not have. | 3.2 is a spike whose outcome is recorded before anything depends on it; the fallback is costed, not assumed. | Phase 3 — Publish the map, and read versions correctly |
| 3 | The new comparator changes an observable output | implementation | `_is_newer` feeds the banner; a different answer changes what users see. | 4.3 asserts byte-identical output on existing fixtures; the new comparator is used for policy decisions only until something consumes it. | Phase 3 — Publish the map, and read versions correctly |
| 4 | The 40-case matrix is written by the same hand as the rules | implementation | A self-written matrix covers the paths its author thought of. | The five no-action majors and the two action majors are taken from the recorded history rather than invented, so at least seven cases are adversarial by origin. | Phase 4 — One pure classifier, no behaviour change |
| 5 | The backfill re-judges history instead of reading it | implementation | A backfilled column that disagrees with the Migration prose makes the replay score itself. | 2.3 takes each value from the row's existing prose; a row whose prose does not decide gets `notice`, named in the diff. | Phase 2 — The bump follows the impact, not the punctuation |

## Acceptance Criteria

- [ ] **AC-1** Replaying 10.0.0 → 16.0.0 through the new bump rule yields minor
      for 13.0.0, 14.0.0 and 16.0.0 and major for 12.0.0 and 15.0.0.
- [x] **AC-2** A release-span commit carrying `!` with no `Consumer-Impact:`
      trailer fails the release check; the same commit with a trailer passes.
- [x] **AC-3** The new comparator returns `true` for
      `('16.6.0','16.6.0-next.3')` while the pinned `_is_newer` fixture still
      returns `false`.
- [ ] **AC-4** Over a ≥ 40-case matrix, `classifyUpdate` returns `ask` for
      every input whose `engines.node` is unsatisfied, and `auto` for **no**
      input carrying an unknown, a missing provenance or a project pin.
- [x] **AC-5** `classifyUpdate` performs no filesystem or network access,
      asserted by a test that calls it with a frozen input.
- [ ] **AC-6** The banner, `upgrade` and `update` produce byte-identical
      recorded stdout before and after the whole change.
- [ ] **AC-7** Every row of `BREAKING_CHANGES.md`'s table carries a
      `Consumer impact` value from the enum.
- [ ] **AC-8** `task ci` green.

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
