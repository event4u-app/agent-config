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

- [ ] **1.1** The codex path is automatable — host-event, no transcription. Script a
      recurring capture on the maintainer machine against both hosts, appending to
      the JSONL. The claude side stays self-report; record it on a fixed cadence with
      the fixed prompt already in use, and **record the projection scope with every
      observation** so the series stays comparable when the scope changes (claim 7).
      `verify:` two consecutive captures land in the JSONL with their scope and host
      recorded, and the per-host verdicts stay separate rather than pooled.
- [ ] **1.2** Add the host-truth versus disk-truth join for D-4: on each claude
      observation, intersect the bare names with the ranker's catalogue and publish
      the count of skills that are **pointable but bare**.
      `verify:` the join runs on the existing observations and reports a count,
      including zero as a legitimate answer.
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

- [ ] **3.1** If Phase 1's join shows pointable-but-bare above zero in practice:
      the pointer line names only skills whose delivery is not known-bare, reading
      the latest observation record if one is present. Absent record means **no
      filtering** — fail open, never fail silent-narrow, because a filter that
      quietly hides skills on missing data is worse than the divergence it treats.
      `verify:` fixture — an observation marking skill X bare means the pointer
      never names X; an absent observation file means behaviour byte-identical to
      today.
- [ ] **3.2** Register the corresponding outcome metric next to the existing
      pointer-rate metric with the same owner, review and kill discipline. **No
      adoption threshold is invented here** — the hook's own header refuses that,
      correctly, and this step inherits the refusal.
      `verify:` the metric is registered with its owner and kill standard, and no
      threshold appears that has no measurement behind it.
- **AC-3:** the fixture passes in both directions — filtered when an observation
  exists, unchanged when none does.

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
