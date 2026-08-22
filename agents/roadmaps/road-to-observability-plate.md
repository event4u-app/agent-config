---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
---
# Road to an observability plate

> **Source:** `agents/tmp.old/infra-structure` — an external critique of this
> package's infrastructure posture. Its packaging half is a separate roadmap;
> this one takes the observability half. Every `file:line` and every zero-hit
> claim below was re-verified against HEAD on 2026-08-22.

## Goal

**This is about the capability the suite ships to agents working in consumer
projects, not about infrastructure this package operates.** The distinction
decides the whole scope. This package has no app runtime; its only deployed
surfaces are an MCP Worker and a docs site, both already smoke-covered. So
nothing here asks the package to instrument itself — it asks the package to
stop shipping a vendor-specific log-plumbing skill as its entire answer to
"is this system observable".

When this is finished an agent asked to make a consumer project observable has
a provider-neutral capability model to reason from: which signal is required,
what implementation the project actually has, and what evidence says so. The
four Golden Signals are defined in the tree rather than name-dropped. Alerting
carries a doctrine — page, action, info — where every page names an owner, a
runbook and a first diagnostic step. Finite-resource exhaustion is a readiness
question with a surface to ask it on. And a readiness verdict cannot average a
red away.

## Context

Verified at HEAD, including the zero-hit claims:

- `src/skills/logging-monitoring/SKILL.md` is **105 lines** and stack-specific:
  log channels, label conventions, dashboard rules. A case-insensitive search
  for `SLI`, `SLO`, `error budget`, `burn rate` and `runbook` across that file
  returns **0** hits.
- The **four Golden Signals** appear as a name-drop and are defined nowhere.
  `src/skills/dashboard-design/SKILL.md:28` says "choose visualization per
  signal (RED / USE / Golden Signals)" and its frontmatter `:4` repeats the
  phrase; the rest of the hits are derived catalogs
  (`docs/catalog.md`, `docs/skills-catalog.md`) plus one mention in
  `docs/contracts/mental-models.md:189`. A search for the actual four —
  latency, traffic, errors, saturation named together — returns **0** hits in
  `src/` and `docs/`.
- **Alerting doctrine exists only inside the vendor-specific dashboarding
  skill.** There is no provider-neutral statement of what earns a page.
- `src/skills/incident-commander/SKILL.md` has update intervals and a status
  page (`:62`) and requires a post-mortem owner before closing (`:143`), and
  contains **0** occurrences of `runbook`. The only `runbook` hits in `src/`
  are passing mentions in `src/skills/onboarding-program/SKILL.md:159-163` (as
  a ramp milestone) and `src/skills/privacy-review/SKILL.md:165` (as a
  breach-notification deliverable). Neither is a contract.
- `src/rules/scale-discipline.md` returns **0** hits for `quota`, `saturation`
  and `exhaust`. It governs query shape, index parity, bounded reads and growth
  budget — a finite-resource readiness surface is simply not among them.
- **Host hardening has no owner at all.** A search for `unattended upgrade`,
  `ufw`, `fail2ban`, `ssh hardening`, `server hardening` and `host hardening`
  across `src/skills/`, `src/rules/` and `docs/guidelines/` returns **0** hits.
  This is the one genuinely ownerless gap in the set.
- `src/skills/code-review/checklists/infra.md` is **17 lines**, and its scanner
  row is prose: "A real scanner (Checkov / Trivy) is the gate, not just a
  successful `plan`."

**This is not a duplicate of prior observability work**, and the check was made
by reading the archived roadmaps rather than by their titles. Four archived
files carry the word: `03-observability-pr-series.md` ("Make the system
measurable enough to support quality improvement and safe automation"),
`03-observability-roadmap.md` ("Track execution and quality of skills"),
`phase-3-observability.md` (upgrading the package into a "high-observability,
safely evolving, nearly self-optimizing agent system") and
`road-to-session-profile-observability.md` (making the active profile legible
to a non-technical colleague). All four are about **this package observing
itself**. None is about the capability shipped to a consumer project. One
honest correction to the brief this roadmap was built from: it pointed at an
evidence file under `agents/evidence/analysis/` said to record this plate's
deferral and name the missing set. No such file exists at HEAD — a search of
`agents/evidence/` for the deferral produces nothing. That citation is dropped
rather than paraphrased, and the non-duplication argument above stands on the
four archived roadmaps, which do resolve.

**Excluded as already fixed.** The deploy-safety floor.
`src/rules/engineering-safety-floor.md:53-57` already mandates all five of
blast radius, rollback path, pre-flight checks, observability ("what signal
will detect a regression, and where to look for it") and a named risk owner,
with `:59` stating that missing any of the five means the change is not ready
to ship. Nothing in this roadmap restates it; Phase 2 supplies the signal
definitions that floor's item 4 already assumes exist.

## Phase 1 — Turn log plumbing into a capability model

- [ ] **1.1 Restate `logging-monitoring` as required signal → detected
      implementation → evidence.** The skill stops being a list of how to
      configure one stack's log channels and becomes a way to answer "what does
      this project actually have". Vendor specifics move behind the detection
      step, not in front of it.
      verify: `git show HEAD:src/skills/logging-monitoring/SKILL.md | wc -l`
      reports the 105-line pre-state, and the reworked skill names at least one
      detection step per required signal.
- [ ] **1.2 Keep the specialists as specialists.** The vendor-specific
      dashboarding and error-tracking skills stay where they are and gain an
      inbound pointer from the capability model. Nothing is merged.
      verify: `./scripts-run src/scripts/check_references` is green and
      `grep -c 'Golden Signals' src/skills/dashboard-design/SKILL.md` is
      unchanged from its pre-state.
- [ ] **1.3 Write the negative fixture first.** A project with logs and no
      metrics must be scored as missing a signal, not as observable. The
      fixture is authored before the model it scores.
      verify: the fixture id appears in `src/config/gate-coverage.yml` and the
      capability model returns a missing-signal verdict on it.

## Phase 2 — Define the Golden Signals and the SLI/SLO representation

- [ ] **2.1 Define the four signals in the tree.** Latency, traffic, errors,
      saturation — each with what it measures and what a missing one costs.
      Today `dashboard-design/SKILL.md:28` names the family and nothing defines
      the members.
      verify: `grep -rniE 'saturation' src/skills/ | wc -l` is greater than its
      pre-state of 0, and each of the four is defined in exactly one place.
- [ ] **2.2 Represent an SLI and an SLO without inventing a number.** The
      representation must carry provenance: a threshold is either **operational**
      (it came from a measurement or a stated commitment) or **proposed** (the
      agent suggested it). A proposed threshold may never be rendered as an
      operational one.
      verify: a fixture carrying a proposed threshold renders it marked as
      proposed, and the same fixture with the marker stripped fails.
- [ ] **2.3 Record the signals a project cannot supply.** A signal with no
      available implementation is a null with a reason, not a gap silently
      dropped from the report.
      verify: the report for a fixture missing one signal names the signal and
      the reason, and the signal count in the report equals the four minus the
      recorded nulls.

## Phase 3 — Alerting doctrine and a lean runbook contract

- [ ] **3.1 Three classes, stated provider-neutrally: page, action, info.**
      What earns each, and what a misclassification costs. This is the layer
      that exists today only inside the vendor dashboarding skill.
      verify: the three classes are defined outside any vendor-specific skill,
      and `grep -rn 'page' <new-surface>` shows the wake-a-human criterion
      stated as a condition rather than a preference.
- [ ] **3.2 A page without an owner, a runbook and a first diagnostic step is
      malformed.** All three are mandatory; a page that cannot name them is a
      configuration defect, not a judgement call.
      verify: the negative fixture — a page definition missing an owner —
      scores as malformed, and its paired complete definition scores clean.
- [ ] **3.3 A runbook contract, deliberately lean.** The minimum a runbook must
      carry to be worth paging into. `incident-commander/SKILL.md` gains the
      inbound pointer; its `:62` status-page cadence and `:143` post-mortem-owner
      requirement are untouched.
      verify: `git show HEAD:src/skills/incident-commander/SKILL.md | grep -c
      runbook` reports the 0 pre-state, and the two named lines are byte-identical
      after the phase.

## Phase 4 — Finite-resource readiness and host hardening

- [ ] **4.1 Add a quota / saturation readiness surface.**
      `src/rules/scale-discipline.md` has a growth budget for append-only
      tables and nothing for connection pools, rate limits, disk, memory or
      third-party quotas. Extend the existing rule rather than adding a
      sibling.
      verify: `git show HEAD:src/rules/scale-discipline.md | grep -ciE
      'quota|saturation|exhaust'` reports the 0 pre-state, and the rule stays
      under its 200-line cap — `wc -l src/rules/scale-discipline.md`.
- [ ] **4.2 One `server-hardening` procedure for the ownerless gap.** SSH
      posture, firewall baseline, unattended upgrades. This is the only item in
      the roadmap with no existing owner anywhere in the tree, which is why it
      is a new surface rather than an extension.
      verify: `grep -rciE 'unattended upgrade|fail2ban' src/skills/ | grep -v
      ':0'` returns at least one file, where the pre-state returns none.
- [ ] **4.3 The readiness verdict cannot average a red away.** A single red
      signal makes the verdict not-ready, regardless of how many greens sit
      beside it. State it as an enum with an explicit floor, not as a score.
      verify: a fixture with one red and four greens returns not-ready, and the
      verdict type has no numeric aggregation path.

## Blockers

### blocker: b-plate-vs-skill-sprawl

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 step 1.1, and by dependency every later phase — the shape
  decision determines where Phases 2 through 4 land.
- **What to do:** pick exactly one — (a) upgrade `logging-monitoring` in place
  into the capability model, carrying Phases 2 and 3 as sections within it and
  accepting the resulting file size; or (b) split into named sibling skills for
  the signal model, alerting doctrine and readiness surface, and name for each
  one why it is not a thin per-topic skill.
- **Recommendation:** **(a) — upgrade in place, and re-test the split at the
  cap.** One capability model is easier to keep coherent than three siblings
  that must agree, and `size-enforcement` puts the burden on whoever creates
  thin per-topic skills. If the upgraded file then breaches its own size budget,
  that is a measured trigger to split — a better basis for (b) than a guess made
  before the content exists.
- **If you do nothing:** Phase 1.1 lands wherever the first step found
  convenient, Phases 2 to 4 inherit that destination without anyone choosing it,
  and the shape question resurfaces at Phase 4 when moving the content is
  expensive.
- **Resolved when:** the choice is recorded with its reason, and the Phase 1
  artefact lands at the destination the choice names rather than at whichever
  destination the first step found convenient.

The tension is real in both directions. A prior deferral of this plate named
three missing capabilities, which reads as an argument for three skills. But
`src/rules/size-enforcement.md` is explicit that per-topic content belongs as a
section on an existing skill and that a grid of thin per-tool skills is exactly
the sprawl it exists to prevent — while also requiring a split when a file
mixes responsibilities. A signal model, an alerting doctrine and a readiness
surface are arguably three responsibilities. That is precisely why this is a
decision to record rather than one to take mid-phase.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The plate is built as infrastructure this package operates | product | The package has no app runtime; a roadmap that instruments the package answers a question nobody asked and leaves the consumer-facing gap open | The Goal states the scope in its first sentence, and every phase names a consumer-project surface rather than a package-internal one | Phase 1 — Turn log plumbing into a capability model |
| 2 | The shape decision is taken by drift | implementation | Without the blocker resolved, Phase 1 lands somewhere by convenience and Phases 2 to 4 inherit that destination silently | The blocker gates 1.1 explicitly and requires the destination to be recorded before the artefact lands | Phase 1 — Turn log plumbing into a capability model |
| 3 | A proposed threshold is read as an operational one | product | An agent-suggested SLO rendered without provenance becomes a commitment nobody made, which is worse than no SLO | 2.2 makes provenance part of the representation and pins both directions with a fixture pair | Phase 2 — Define the Golden Signals and the SLI/SLO representation |
| 4 | The readiness verdict becomes a score | implementation | Any numeric aggregation lets four greens hide one red, and the red is always the interesting one | 4.3 requires an enum with an explicit floor and a verdict type with no aggregation path | Phase 4 — Finite-resource readiness and host hardening |
| 5 | The rule extension breaches its size cap | implementation | `scale-discipline` is a rule, and rules are capped; a readiness surface bolted on can push it over | 4.1's verify checks the line count in the same step, so the cap is a step condition rather than a later surprise | Phase 4 — Finite-resource readiness and host hardening |
| 6 | Vendor specifics get promoted into the neutral layer | implementation | The fastest way to write a capability model is to generalise the one stack already documented, which produces a neutral-looking layer that only fits that stack | 1.2 keeps the specialists intact and requires the neutral layer to reach them by pointer, so a stack-specific detail has somewhere else to live | Phase 1 — Turn log plumbing into a capability model |

## Acceptance Criteria

- [ ] AC-1 — An agent can answer "which required signal does this project lack"
      from a provider-neutral model, with the answer grounded in what was
      detected in the project rather than in what the skill happens to document.
- [ ] AC-2 — The four Golden Signals are each defined once in the tree. Naming
      the family without defining its members no longer occurs.
- [ ] AC-3 — Every threshold the suite emits is marked operational or proposed,
      and a proposed one cannot be rendered as operational. A fixture pins both
      directions.
- [ ] AC-4 — A page definition missing an owner, a runbook or a first
      diagnostic step scores as malformed, proven by a committed negative
      fixture registered as a canary in `gate-coverage.yml`.
- [ ] AC-5 — Finite-resource exhaustion is a question the readiness surface
      asks, where today the governing rule contains no such term.
- [ ] AC-6 — Host hardening has exactly one named owner in the tree, closing
      the only item in this set that had none.
- [ ] AC-7 — A readiness verdict containing one red is not-ready. No numeric
      aggregation path exists that could produce a different answer.
- [ ] AC-8 — The destination question is answered in writing before the first
      artefact lands, so the resulting shape is a recorded choice rather than
      the residue of drift.
