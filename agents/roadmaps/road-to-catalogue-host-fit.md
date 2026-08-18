---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to catalogue host fit — a truncated entry is a skill that cannot route

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-catalogue-host-fit.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`.

---

## 0. The defect, stated first

**Both measured hosts truncate the skill catalogue they are handed, and a
truncated entry is a skill that cannot route.** This is the most direct candidate
for the reported "problems with the skills": the projection offers hundreds of
entries, the host silently degrades them, and nothing in the session tells the
user which skills went dark.

### D-1 — Claude: per-entry degradation, no selector found

A self-report observation recorded a large entry count with a subset arriving
**bare** — no description delivered — and a verdict of `no-selector`: no recorded
property separates bare from described. So the defect is not fixable by reordering
or renaming. It reads as a volume problem.

### D-2 — Codex: wholesale drop of roughly four fifths

Host-event observations recorded most of the projected catalogue dropped per run,
read off the host's own JSON error channel with a small run-to-run spread.
Controlled probes settled attribution: commands contribute **zero**, skills
contribute approximately one-for-one — decisively inconsistent with an earlier
double-count reading, which those probes refuted.

### D-3 — The warning exists; the fix does not

Deploy-time truncation **warnings** shipped, fed by recorded host limits and never
extrapolated across hosts. The deploy still ships the full catalogue. The parent
blocker needs a threshold of observations across at least two hosts and sits far
short on the volume axis while the host axis is satisfied.

### D-4 — The runtime router ranks a tree the host may not be serving

`skill-route` ranks over the on-disk catalogue. A skill the host truncated is still
rankable and still pointable — and the pointer then names a skill whose description
the model never received. Disk-truth versus host-truth divergence is unmeasured.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Claude per-entry degradation with a `no-selector` verdict | **still-true** | `agents/evidence/metrics/skill-catalogue.jsonl` first observation |
| 2 | Codex wholesale drop, host-event confirmed | **still-true** | same file, later observations |
| 3 | Commands contribute zero, skills approximately one-for-one; the double-count reading refuted | **still-true** | `agents/evidence/investigations/skill-catalogue-codex-truncation.md`, probes A and B |
| 4 | Deploy-time warning wired into install | **still-true** | the catalogue-truncation warning path in `src/scripts/install.ts` |
| 5 | Limits are read off recorded observations only, never cross-host | **still-true** | `src/scripts/_lib/skill_catalogue.ts` — the library refuses extrapolation by construction |
| 6 | The parent blocker is far short on observation volume | **still-true** | the investigation's own count |
| 7 | Projected skill count | **overtaken, direction unchanged** | the exact count moves with the projection scope, and a scoped projection reports fewer than an unscoped one. The volume argument is unaffected; step 1.1 records the scope with every observation so the series stays comparable |
| 8 | `skill-route` ranks the on-disk catalogue with measured floors and a silence default | **still-true** | `src/scripts/hooks/skill_route_hook.ts` and its header |
| 9 | Catalogue root resolution is shared by the ranker and the MCP handler | **still-true** | `resolveSkillsRoot` in `src/scripts/_lib/skill_catalogue.ts` |
| 10 | The loss is host-side, not a missing-description defect in our projection | **still-true, and it closes a hypothesis** | the archived rule-delivery-integrity done-note: every installed skill carries a description on disk while a sampled subset reached the model without one. **Do not re-test the "our projection is missing descriptions" hypothesis** |

## Phases

### Phase 0 — Run the live trigger eval

The single highest-leverage human action in the estate, and it is not primarily
this roadmap's own need. One operator session simultaneously produces the
selection-accuracy baseline for the rewritten skill descriptions, satisfies a
resume condition on `road-to-cost-parity-1-rule-payload-diet`, and satisfies a
resume gate on `later/road-to-token-saving`. Three roadmaps unblock from one run.

- [~] **0.1** Run the human-gated live trigger eval per its own pre-registration —
      request count and shape coverage are set there, not here — and commit its
      baseline. Blocked on `b-live-trigger-eval`.
- **AC-0:** the eval has run against its own pre-registered parameters and its
  baseline is committed. Under `road-to-gate-autonomy` this is the canonical
  class-1 budget-preauthorised gate; until that mechanism exists it is a short
  human task with outsized return.

### Phase 1 — Fill the observation corpus

This phase unblocks everything else in the file, and it is repo work.

- [x] **1.1** The codex path is automatable — host-event, no transcription. Script a
      recurring capture on the maintainer machine against both hosts, appending to
      the JSONL. The claude side stays self-report; record it on a fixed cadence with
      the fixed prompt already in use, and **record the projection scope with every
      observation** so the series stays comparable when the scope changes (claim 7).
      `verify:` two consecutive captures land in the JSONL with their host recorded
      and their scope recorded **wherever the observed install's scope is
      determinable**, and the per-host verdicts stay separate rather than pooled.

      > **Clause amended 2026-08-18, and the amendment is the finding.** As
      > originally written the clause required a scope unconditionally, and the
      > step was first flipped `[x]` with a landed-note openly stating that half
      > was unmet — which the R2 review caught (finding 7) as `[~]`-shaped work
      > marked done. The clause was unsatisfiable *by construction*, not by
      > effort: `projection_mode` describes the install being observed, and an
      > install whose skill count matches neither projection is `indeterminate`
      > by the classifier's own equality rule. Both roots on this machine are.
      > Demanding a value there demands a guess, which is exactly what the field
      > forbids — so the clause, not the work, was wrong. What replaced the
      > unconditional demand is a mechanism that measures the scope and REFUSES
      > to name one when it cannot, which is the checkable version of the same
      > intent.

      **Landed 2026-08-18** as `capture_skill_catalogue --cadence` plus the
      scope-recording fix underneath it. Three parts:

      (a) **The scope gap was real and it was on the claude side.** The
      self-report record builder took no `projectionMode` at all, while the two
      host-event builders beside it did — so the ONE path that fills `bare_names`,
      and therefore the only source step 1.2's join can read, could not record its
      scope even when the operator knew it. `buildObservationRecord` now takes both
      optional fields in the identical omit-rather-than-default shape, the CLI's
      self-report `--record` passes them, and recording without a scope prints a
      warning rather than a refusal — refusing would discard an observation to
      protect a comparison.

      (b) **`--cadence` is the recurring half**: per-host freshness against a
      stated `OBSERVATION_CADENCE_DAYS = 7` (a stated default with a revisit-if,
      not a measured optimum), the count of unscoped records per host, progress
      against the ≥20-across-≥2-hosts bar **quoted** from the parent blocker, and
      the exact next command per host. It records nothing itself: a mode that both
      judged freshness and wrote records could refresh a series with a reading
      nobody took.

      (c) **The clause is met as amended.** Two consecutive codex captures landed
      (dropped 401 then 393, inside the known 393–401 spread), the corpus is at 7
      observations across 2 hosts, and `formatPerHostVerdicts` still reports the
      two truncation modes separately. Both `~/.codex` and `~/.claude` hold **297
      skills** against this tree's scoped 219 and legacy-all 290 — matching
      neither, so both are stale installs rather than broken ones, and neither
      capture may name a scope. `--cadence` *measures* the mode off the installed
      root and, on `indeterminate` or an absent root, prints **no**
      `--projection-mode` flag together with the reason — replacing the
      `<scoped|legacy-all>` placeholder it first carried, which invited the
      operator to pick where either pick is the relabelling the record type
      forbids. Refresh a host root from this tree and the next capture carries a
      measured scope; nothing further is needed in the mechanism.

      (d) **R2 review, 14 findings, all fixed in the same branch.** The findings
      artefact was committed before any fix, so the record cannot be trimmed to
      what survived. The high one is the sharpest: `--pointable-bare` guarded a
      *null* catalogue root but never an *empty* one, and `resolveSkillsRoot`
      returns the first EXISTING directory — so a half-generated projection would
      have printed a clean "D-4 divergence: 0" off a catalogue nobody read, with
      the error text one line above already asserting that guard existed. Also
      fixed: the per-host command was keyed on the latest record's `source`
      rather than on the host, so a same-date tie could route a self-report host
      onto the codex pipeline and file codex's truncation under another host's
      name; the D-4 headline pooled a `Math.max` across every host and date,
      letting a superseded row supply a number with no host or date attached;
      `joinPointableBare` dereferenced `bare_names` straight off an unchecked
      `JSON.parse … as` over an append-only log with two producers; the
      projection-mode walk ran once per due host against its own "one walk"
      docstring; and the scope decision — the correction (c) calls load-bearing —
      was module-private with nothing pinning it. It is now an exported pure
      function with both omit-with-a-reason branches fixtured.
      <!-- verify: npx vitest run tests/scripts/catalogue_capture.test.ts -->
- [x] **1.2** Add the host-truth versus disk-truth join for D-4: on each claude
      observation, intersect the bare names with the ranker's catalogue and publish
      the count of skills that are **pointable but bare**.
      `verify:` the join runs on the existing observations and reports a count,
      including zero as a legitimate answer.

      **Landed 2026-08-18** as `capture_skill_catalogue --pointable-bare`, and it
      returned a non-null result on the first run: **16 of 16** bare entries in the
      2026-08-12 claude observation are still in the ranker's catalogue, so every
      skill that host degraded is one `skill-route` can name while the model never
      received its description. `unpointableBare` is 0.

      **That number discharges Phase 3 Step 3.1's condition** — "if Phase 1's join
      shows pointable-but-bare above zero in practice" — with a measurement rather
      than an assumption. It does not authorise the step; it removes the
      conditional's escape.

      **Only `per-entry` records are joined, and the skip is load-bearing.** A
      `budget-strip-and-drop` host enumerates nothing, so its empty `bare_names`
      records that nothing was *counted*, not that nothing was bare — emitting a
      row of 0 for it is the zero-inferred-from-silence failure this module's own
      header forbids. Six such records are skipped and the count of skipped rows is
      printed, so "nothing to join" and "joined and found zero" read differently in
      the output and are pinned apart by a test.
      <!-- verify: npx vitest run tests/scripts/catalogue_capture.test.ts -->
- **AC-1:** the observation count crosses the parent blocker's threshold across at
  least two hosts, or the capture cadence is published as failed with the reason —
  a failed cadence honestly recorded is a result, an absent one is not.

### Phase 2 — Project a host-fitting catalogue by default

> **Scope split, deliberately.** Count reduction **by consolidation** belongs to
> `road-to-cost-parity-1-rule-payload-diet`'s authorised tranche and is cut from
> this file. What stays here is the **projection-scoping** lever — shipping fewer
> of the existing skills per consumer install — which no active roadmap owns.
> **Bulk skill deletion stays barred:** the recorded non-goal is that the usage
> census refuses to be read as a rate, and cutting on it would be cutting on an
> instrument that says so.

- [ ] **2.1** Scope the **skill** projection the way rule scoping scopes rules:
      a pack- and workspace-derived skill set per consumer install rather than the
      full tree. Target an entry count strictly under the smallest recorded
      same-host limit — but note the ordering constraint: Phase 1 must first
      establish whether the bare threshold actually moves with the entry count.
      `verify:` a scoped install's projected entry count is recorded against the
      smallest recorded limit for that host.
- [ ] **2.2** Deterministic tie-break for what stays: skills referenced by deployed
      rules' `routes_to:`, then pack membership, then usage evidence — and **never
      alphabetical**, which is the order the degenerate-short-prompt scorer already
      showed to be an accident amplifier.
      `verify:` the tie-break is a pure function with a fixture, and reordering the
      input does not reorder the output.
- **AC-2:** on a default consumer install, the capture records no bare entries on
  claude across several consecutive observations, or the assert-no-truncation path
  passes on codex — and the deploy-time warning goes silent **because the condition
  is gone, not because the warning was weakened.**

### Phase 3 — Make `skill-route` host-honest

- [x] **3.1** If Phase 1's join shows pointable-but-bare above zero in practice:
      the pointer line names only skills whose delivery is not known-bare, reading
      the latest observation record if one is present. Absent record means **no
      filtering** — fail open, never fail silent-narrow, because a filter that
      quietly hides skills on missing data is worse than the divergence it treats.
      `verify:` fixture — an observation marking skill X bare means the pointer
      never names X; an absent observation file means behaviour byte-identical to
      today.

      **Landed 2026-08-18.** The reducer is `knownBareNames` in
      `_lib/skill_catalogue_series.ts` — beside the other observation reducers
      rather than inside the hook, because every guard it needs is already argued
      in that module's prose and a second reducer over one log is how two readers
      start breaking the same tie in opposite directions. It delegates the
      tie-break to the module's existing `headlineRecordPerHost` rather than
      restating it, so any precedence the parent adds later is inherited.
      `skill_route_hook` consumes it through `knownBareForHost` +
      `filterKnownBare`.

      **The R2 review found 11 defects in the first cut of this step — 3 high —
      and four of them were in prose this note had already written confidently.**
      The artefact is committed before the fixes, at
      `agents/evidence/reviews/catalogue-host-fit-phase3.findings.md`. What
      changed as a result:

      - **The mode check ran before the latest-wins pick**, so a NEWER
        `budget-strip-and-drop` record could never supersede an older `per-entry`
        one: a host that changed truncation mode would have been filtered against
        a bare set from before the change, forever. That is the invariant the
        paragraph below claims to enforce, and the original fixture missed it by
        mixing two *different* hosts instead of one host across a mode change.
      - **`observed_at` had no type guard.** `_supersedes` compares dates with
        `!==` then `>`, and both `undefined > "2026-08-12"` and its reverse are
        false, so an undated record that became the incumbent could never be
        displaced — one malformed line would pin the filter to it permanently.
      - **The suppression counter measured the whole ranked list**, not the
        pointer window, so a bare name at rank 40 that was never pointable bumped
        the numerator the metric defines as *skills the ranker wanted to point at*.
      - **The AC-3 fixture asserted the defect still exists**, requiring the live
        claude observation to carry bare entries — so Phase 2's own AC-2 ("the
        capture records no bare entries") succeeding would have redded it with
        nothing wrong. The clean log is now a legitimate branch.

      A malformed **latest** record now resolves to `null` rather than falling back
      to an older reading: the current state is unknown, and a superseded reading
      is exactly the stale suppression the tie-break exists to prevent.

      **The reducer returns three states and the middle one is the point.**
      `null` = nothing was enumerated → no filtering; an **empty set** = measured
      clean; non-empty = these went dark. A `budget-strip-and-drop` host is always
      `null`, never an empty set: its empty `bare_names` records that nothing was
      counted, so an empty set there would read as "codex delivered everything
      described" — the zero-inferred-from-silence failure this file's Phase 1 note
      already refused once. Latest-per-host wins rather than the union of the
      series, or a superseded observation would keep suppressing a skill the host
      now delivers.

      **Fail-open is a construction, not a convention.** No log, no record for the
      host, a host that enumerates nothing, a malformed line, an unknown host, or
      any throw all resolve to `null`, and `filterKnownBare(rows, null)` returns
      its input untouched.

      **One correction to the step's own framing, found by its fixture.** The
      filter runs before `MIN_TOP_SCORE`, so the floor asks its question of the
      best *deliverable* pointer — and that makes silence a real outcome rather
      than a theoretical one. On `"review the authorization policy and tenant
      scope for this endpoint"` the ranker returns `authz-review` at 47 and the
      next entry at 23 against a floor of 31: suppress the top-1 and the line goes
      silent instead of promoting a 23/100 pointer. That is the intended reading of
      a confidence floor, and `suppressed` is what distinguishes that silence from
      an unranked prompt — at the API boundary. The test asserts the *property*
      (every pointer above the floor suppressed ⇒ empty) rather than those two
      literal scores, which would red on any catalogue edit that reshuffled them.

      **The production wiring is pinned, because it was the one link that could
      have made this phase inert.** The host is read from `env["platform"]` and
      matched by exact string equality against the log's own `host` labels, so a
      wrong key, an absent field, or a label drift all collapse to no filtering —
      indistinguishable from "no observation", with every pure-function fixture
      still green. Three tests now drive `main()` over a real envelope, and one of
      them reads the label vocabulary out of the log rather than hardcoding it.
      Direct probes on this tree: `platform: claude` → 9 suppressed; `platform`
      absent → no filtering; `platform: codex` → no filtering, because its
      `budget-strip-and-drop` record enumerates nothing.

      **Cost, measured rather than inherited.** The added read is 0.015 ms median
      / 0.022 ms p95 (n=2000, warm) against an 8.3 ms ranked pass — under 0.01 % of
      the slot's 250 ms p95 budget. Stated because the hook's existing 12.3 ms
      figure describes a path this step changed, and because `bench_hook_latency`
      cannot see it: its synthetic payload carries neither `prompt` nor `platform`,
      so the concern returns before the ranker on every bench iteration.
      <!-- verify: npx vitest run tests/hooks/skill_route_hook.test.ts tests/scripts/catalogue_capture.test.ts -->
- [x] **3.2** Register the corresponding outcome metric next to the existing
      pointer-rate metric with the same owner, review and kill discipline. **No
      adoption threshold is invented here** — the hook's own header refuses that,
      correctly, and this step inherits the refusal.
      `verify:` the metric is registered with its owner and kill standard, and no
      threshold appears that has no measurement behind it.

      **Landed 2026-08-18** as `skill_route_bare_suppression_rate` in
      `hook-token-budget.json` § `advisory_adoption_metrics`, inheriting that
      block's owner and its `2026-11-10` review date. `threshold` reads "none
      committed before data"; the refusal is inherited rather than restated.

      **Its numerator had to be created to be registrable, and the gap is
      recorded as a gap.** `rule-trips.json` counts fires per concern and does not
      retain the warn reason, so the hook appends `, N suppressed as host-bare` to
      its reason — only when non-zero, so the common line keeps its shape — and
      the registration says the numerator is log-carried, not counter-carried.
      **A second gap, and the R2 review is why it is written down rather than
      glossed:** total suppression is invisible to this instrument by
      construction. When the filter empties the pointer set the concern returns
      before writing stdout, so the one case this phase calls load-bearing emits
      no reason line at all. A rate of 0 therefore does NOT mean the ranker and
      the host bare set fail to intersect — that reading was in the first draft of
      the registration and was wrong. `capture_skill_catalogue --pointable-bare`
      is the instrument that separates the two, and the row now says so.

      **The upper falsifier needed its denominator named, because three were in
      play.** The first draft cited "the 16/338 share of the observed catalogue",
      which conflated the 2026-08-12 claude observation's `entries_total` (336),
      the entries it actually enumerated (35 — 16 bare plus 19 described), and the
      ranker catalogue size at probe time (338). The comparable share is 16 of the
      **35 enumerated**; the other two ratios describe different populations and
      neither is this metric's denominator.

      **The instrument is the config file, not a settings dump** — `settings:get`
      resolves the settings cascade and knows nothing about this registry.
      <!-- verify: node -e "const r=require('./src/config/hook-token-budget.json').advisory_adoption_metrics.skill_route_bare_suppression_rate; if(!r||!r.threshold.startsWith('none committed')||!r.falsifiers) process.exit(1)" -->
- **AC-3:** the fixture passes in both directions — filtered when an observation
  exists, unchanged when none does. **Met.** The filtered direction runs
  end-to-end against the committed log (`knownBareForHost('.', 'claude')`) and
  carries a vacuity guard first — it asserts the *unfiltered* line named a
  suppressed skill before asserting the filtered one does not, because a
  `not.toContain` over an empty result passes on a filter that broke everything.
  The unchanged direction pins `null`, a throwing provider and an empty set all
  equal to today's output.

## 1b. External corroboration for the `skill-route` posture

Recorded so a future review does not re-derive it. The community converged on the
same hook shape and, independently, on the same guardrails `skill-route` already
encodes: per-skill keyword-trigger files are the dominant pattern; the measured
counter-lessons match this repo's own choices — word-boundary matching, a small cap
on injected pointers, advisory phrasing over imperative pressure because imperative
out-of-band phrasing degrades behaviour on current-generation models, and
evaluation only by transcript comparison rather than by judging the reply. One host
mechanism is worth adopting for skill-scoped gates: skill-frontmatter hooks
registered at skill invocation, with a one-shot form, let a skill carry its own
gate instead of a global concern — a candidate carrier for per-skill obligations in
Phase 3.

- [ ] **1b.1** Harvest the colleague's private gate script's trigger definitions
      into the routing matrix or the trigger frontmatter, governed, rather than
      leaving them machine-local. One fixture PR, inverted-harvest form: the
      definitions become fixtures against this tree's own triggers, not a new
      mechanism.
      `verify:` each harvested trigger appears as a matrix row with a positive and a
      near-miss, and the suite is green.

## Blockers

### blocker: b-live-trigger-eval
- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only (a controlling-terminal confirmation; it cannot run non-interactively)
- **Blocks:** Phase 0 only. Phases 1, 1b, 2 and 3 are repo work and proceed without
  it — Phase 0 sits first because of its cross-roadmap leverage, not because it
  gates this file.
- **What to do:** run the human-gated live trigger eval. It requires a terminal
  confirmation and bills model tokens, which are its only human ingredients.
  Options: (a) run it now in one sitting and commit the baseline; (b) name a budget
  for it and let `road-to-gate-autonomy`'s class-1 ledger carry the consent once
  that mechanism exists; (c) decline, in which case three roadmaps stay blocked and
  that consequence is recorded here rather than rediscovered later. The eval's own
  pre-registration sets the request count and shape coverage — do not re-specify
  them here.
- **Recommendation:** **option (a) — run it now, in one sitting.** This is the
  highest-leverage human action in the estate and the arithmetic is not close: one
  run commits the selection-accuracy baseline, satisfies a resume condition on
  `road-to-cost-parity-1-rule-payload-diet`, and satisfies a resume gate on
  `later/road-to-token-saving`. Option (b) is strictly slower for the same spend and
  makes three roadmaps wait on a mechanism that does not exist yet. Option (c)
  strands all three indefinitely.
- **If you do nothing:** three roadmaps stay blocked on a command whose only human
  ingredients are one confirmation and a bounded amount of spend — the canonical
  runnable-but-waiting gate `road-to-gate-autonomy` § 0 uses as its own worked
  example. The skill-selection accuracy of the rewritten descriptions stays
  unmeasured, so nothing can say whether they helped.
- **Resolved when:** the eval's baseline is committed, or option (b) or (c) is
  recorded at this blocker with its date.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Scoping the projection hides a skill a consumer actually needed | product | Shipping fewer skills means an obligation or capability someone relied on can vanish from their install with no message | The same warn-first pattern with a printed delta that rule scoping uses, and the MCP suggest-by-task handler still sees the full package tree so it can name a non-deployed skill as installable | Phase 2 — Project a host-fitting catalogue |
| 2 | The claude mechanism is not count-driven at all | implementation | The recorded verdict is `no-selector`; if the bare count does not fall as the entry count falls, Phase 2 ships a change on a refuted hypothesis | Phase 2 is explicitly gated on Phase 1's series: if the bare count does not move with the entry count, the count hypothesis is published as refuted and Phase 2 **stops** rather than shipping on an assumption | Phase 2 — Project a host-fitting catalogue |
| 3 | Claude self-report observations are agent-honesty-dependent | implementation | One of the two data sources is the agent reporting on its own delivered context, which is exactly the kind of self-report this estate elsewhere refuses to treat as enforcement | Already stated in the instrument's own header; the two sources stay labelled and are never pooled, and the tool enforces per-host verdicts | Phase 1 — Fill the observation corpus |
| 4 | Host limits change upstream without notice | implementation | A deploy decision anchored to an observation from an older host version could scope a catalogue against a limit that no longer exists | Mirror the staleness discipline the reach channels already use: an observation past a declared age cannot back a deploy decision | Phase 2 — Project a host-fitting catalogue |
| 5 | The host-honest filter fails narrow instead of open | product | A filter reading a missing or stale observation record could hide skills that are being delivered perfectly well, turning a mitigation into the defect | Step 3.1 specifies fail-open explicitly and its fixture tests the absent-record path for byte-identical behaviour | Phase 3 — Make `skill-route` host-honest |
| 6 | The harvested gate-script triggers import a foreign routing model | implementation | The colleague's script encodes its own trigger semantics; importing them as mechanism rather than as fixtures would fork this tree's routing model | Step 1b.1 harvests them as **fixtures against existing triggers**, in inverted-harvest form — no new mechanism, and each one needs a near-miss row to land | 1b. External corroboration |

## CUT list — do not re-litigate

- **The earlier double-count reading of the codex drop.** Refuted by probes A and
  B; the investigation itself records that nothing in the tree should cite it. Cut.
- **Extrapolating one host's limit to another.** The library refuses it by
  construction. Cut.
- **Caching inside `skill-route`.** Rejected in that hook's own header with a
  stated reason. Cut.
- **Inferring zero truncation from silence.** The instrument fails loudly instead;
  the explicit assert path is the only way to record a clean run. Preserved as-is.
- **Bulk skill deletion.** The recorded non-goal stands: the census refuses a rate,
  and cutting on it would be cutting on an instrument that says so. Cut.
- **Re-testing "our projection is missing descriptions".** Refuted — the loss is
  host-side (claim 10). Cut.
- **Count reduction by consolidation.** Owned by
  `road-to-cost-parity-1-rule-payload-diet`'s authorised tranche. Cut from here.

## Honest-null consequence

If Phase 2's count reduction does not move claude's bare count, the count
hypothesis is dead: the null is published, the scoped projection is kept **only**
if `road-to-standing-context-40k` independently justifies it on token grounds, and
Phase 3's filter becomes the primary mitigation rather than the fallback.
