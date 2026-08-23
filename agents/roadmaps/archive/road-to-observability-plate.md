---
complexity: structural
status: ready
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

> **Execution order (council-mandated, blocker resolution).** Step 2.1's four
> Golden-Signal definitions land **before** 1.1's detection step: detection
> cannot be specified until what is detected is defined, and Phase 2 must not
> depend on an evidence contract authored after it. No new step — this reorders
> existing ones. `alerting-doctrine` is likewise **not** created first, so a
> downstream consumer cannot dictate the evidence ontology.

- [x] **1.1 Restate `logging-monitoring` as required signal → detected
      implementation → evidence.** The skill stops being a list of how to
      configure one stack's log channels and becomes a way to answer "what does
      this project actually have". Vendor specifics move behind the detection
      step, not in front of it.
      verify (discharged): `git show HEAD:...| wc -l` = **105**, pre-state
      confirmed. Reworked skill is **288** lines with **4** `Typical detection
      paths` lines — one per required signal — plus Procedure step 2 as the
      detection step. Vendor material survives *behind* it under
      `## Detected implementation — stack-specific evidence`; nothing was deleted.
      One `## Procedure` block only, so the `>= 2 ## Procedure` responsibility
      trigger stays unfired.
- [x] **1.2 Keep the specialists as specialists.** The vendor-specific
      dashboarding and error-tracking skills stay where they are and gain an
      inbound pointer from the capability model. Nothing is merged.
      verify (discharged): `check_references` PASS. `grep -c 'Golden Signals'
      src/skills/dashboard-design/SKILL.md` = **2**, identical to HEAD, and
      `git status` reports the file **unmodified** — the specialist is untouched,
      not merely count-stable. The capability model reaches it by pointer
      (`logging-monitoring` § Detected implementation).
- [x] **1.3 Write the negative fixture first.** A project with logs and no
      metrics must be scored as missing a signal, not as observable. The
      fixture is authored before the model it scores.
      verify (council-amended, see blocker resolution): `logging-monitoring`
      carries a malformed/clean contract-fixture pair differing only in the
      condition under test — the malformed case omits exactly one required signal
      and states the expected `missing-signal` verdict with its reason, the clean
      counterpart supplies it and states the passing verdict. NOT registered in
      `src/config/gate-coverage.yml`, which registers gate scripts and their
      mutation canaries, never fixture identifiers.
      **Discharged:** `logging-monitoring` § Examples → *Missing signal*, verdicts
      `missing-signal: saturation` / `all-signals-detected`, the pair differing
      only in the omitted signal. `git status` confirms
      `src/config/gate-coverage.yml` **unmodified**, so no ratchet moved.

## Phase 2 — Define the Golden Signals and the SLI/SLO representation

- [x] **2.1 Define the four signals in the tree.** Latency, traffic, errors,
      saturation — each with what it measures and what a missing one costs.
      Today `dashboard-design/SKILL.md:28` names the family and nothing defines
      the members.
      verify (council-amended — the original asserted a pre-state of 0 that is
      false): `grep -rniE 'saturation' src/skills/` returns **13** unrelated
      lexical matches at HEAD (colour saturation in the design corpora, interview
      saturation in `customer-research:54`, channel saturation in
      `scenario-modeling:52`) and **zero** definitions of observability
      saturation. Verify instead that `grep -cE '^### Golden Signal:'
      src/skills/logging-monitoring/SKILL.md` returns exactly 4 and each of the
      four is defined in exactly one place; the broad grep is retained only as an
      informational collision check.
      **Discharged:** `grep -cE '^### Golden Signal:'` = **4**; each of latency,
      traffic, errors and saturation defined exactly once, each with what it
      measures, what a missing one costs and its detection paths. The contract
      test also asserts `logging-monitoring` is the **only** definer in
      `src/skills/`, which is the AC-2 claim the raw grep could not make.
- [x] **2.2 Represent an SLI and an SLO without inventing a number.** The
      representation must carry provenance: a threshold is either **operational**
      (it came from a measurement or a stated commitment) or **proposed** (the
      agent suggested it). A proposed threshold may never be rendered as an
      operational one.
      verify (council-amended): provenance is a four-value enum — `measured`
      (observed in telemetry), `committed` (stated in a doc/contract, awaiting
      verification), `proposed` (agent-suggested, untrusted), `unknown`
      (inspection could not establish a result). A malformed/clean contract pair
      pins both directions: the malformed case attempts to render an
      agent-suggested threshold as operational and yields `invalid-provenance`;
      the clean counterpart retains `provenance: proposed` with
      `operational: false`. `measured` and `committed` stay distinguishable.
      **Discharged:** `logging-monitoring` § Evidence states carries the
      four-value table with a *May be rendered as operational* column
      (`proposed` and `unknown` = **Never**) and the explicit no-promotion-path
      paragraph; § Examples → *Provenance* carries the pair
      (`invalid-provenance` / `valid-proposed-threshold`).
- [x] **2.3 Record the signals a project cannot supply.** A signal with no
      available implementation is a null with a reason, not a gap silently
      dropped from the report.
      verify (council-amended): a malformed/clean contract pair — the malformed
      case carries a null signal with no reason and yields
      `invalid-unavailable-signal`; the clean counterpart adds a non-empty reason
      and passes. `unknown` (not inspected) stays distinct from affirmatively
      `unavailable`, and the reported signal count equals four minus the recorded
      nulls.
      **Discharged:** § Evidence states separates `unavailable` (established, needs
      a non-empty reason, a recorded null) from `unknown` (nobody looked, reduces
      nothing, unfinished work) and states the count arithmetic. § Examples →
      *Unavailable signal* carries the pair (`invalid-unavailable-signal` /
      `valid-unavailable-signal`).

## Phase 3 — Alerting doctrine and a lean runbook contract

- [x] **3.1 Three classes, stated provider-neutrally: page, action, info.**
      What earns each, and what a misclassification costs. This is the layer
      that exists today only inside the vendor dashboarding skill.
      verify (discharged): defined in `src/skills/alerting-doctrine/SKILL.md`
      (**225** lines, provider-neutral — no vendor named in the class definitions;
      `lint_framework_leakage` = 0 hits across the tree). The wake-a-human
      criterion is three **conditions**, not a preference:
      user-visible-or-irreversible, actionable-now, not-self-clearing, with
      "fail any one -> `action` or `info`". Misclassification cost is stated in
      both directions, naming fatigue as the mechanism by which a real outage is
      missed.
- [x] **3.2 A page without an owner, a runbook and a first diagnostic step is
      malformed.** All three are mandatory; a page that cannot name them is a
      configuration defect, not a judgement call.
      verify (council-amended — one pair proves only one branch, three are needed
      for the universal claim): `alerting-doctrine` carries **three**
      malformed/clean contract pairs, one per mandatory field (owner, runbook,
      first diagnostic step). Each malformed case omits exactly one field and
      yields `malformed-alert: missing-<field>`; each clean counterpart supplies
      only that field and yields `valid-page-alert`.
      **Discharged:** three pairs in `alerting-doctrine` § Examples —
      `missing-owner`, `missing-runbook`, `missing-diagnostic-step`, each clean
      counterpart adding **only** the field under test and yielding
      `valid-page-alert`. The obligation is an Iron-Law block, and the procedure
      forbids dodging it by downgrading the class.
- [x] **3.3 A runbook contract, deliberately lean.** The minimum a runbook must
      carry to be worth paging into. `incident-commander/SKILL.md` gains the
      inbound pointer; its `:62` status-page cadence and `:143` post-mortem-owner
      requirement are untouched.
      verify (discharged): `git show HEAD:...| grep -c runbook` = **0**,
      pre-state confirmed; the file now carries **2** occurrences, both inside an
      appended `## See also` block. The two named lines are byte-identical **and
      still at lines 62 and 143** — `sed -n '62p;143p' | md5` returns
      `eacfbecf95af91a4cad8dbb17ad5ca96` before and after, because the pointer was
      appended at EOF rather than inserted. The runbook contract is five items in
      `alerting-doctrine`, with an explicit not-in-a-runbook list (architecture
      background, topology) since a runbook is read under time pressure.

## Phase 4 — Finite-resource readiness and host hardening

> **Ownerless-gap re-audit before 4.2 (council-mandated).** Before
> `server-hardening` is created, re-run
> `grep -rniE 'unattended.upgrade|fail2ban|ssh.hardening|ssh.posture|firewall.baseline' src/skills/`.
> Zero hits → create the skill; any hit → extend the owner found instead, or
> record in 4.2 why a new surface is still justified. Folded into 4.2's evidence
> rather than added as a step. A second council note binds 4.1: staying under 200
> lines is *budget, not fit* — finite-resource policy must remain a **rule**, and
> acquiring procedural verdict logic is its own stop condition.

- [x] **4.1 Add a quota / saturation readiness surface.**
      `src/rules/scale-discipline.md` has a growth budget for append-only
      tables and nothing for connection pools, rate limits, disk, memory or
      third-party quotas. Extend the existing rule rather than adding a
      sibling.
      verify (discharged): `git show HEAD:...| grep -ciE
      'quota|saturation|exhaust'` = **0**, pre-state confirmed; now **7** hits.
      Rule is **123** lines (was 99), under the 200 cap. Extended, not siblinged:
      **R-A12 finite-resource readiness** joins R-A1..R-A11 and the Iron Law gains
      one line. Per the council's second note, fit was checked and not only
      budget — R-A12 states a *review-time requirement* (name the ceiling, name
      the headroom) and delegates verdict logic to `operational-readiness`, so the
      rule acquired no procedure. It also says why it is not R-A7: growth
      degrades, exhaustion stops.
- [x] **4.2 One `server-hardening` procedure for the ownerless gap.** SSH
      posture, firewall baseline, unattended upgrades. This is the only item in
      the roadmap with no existing owner anywhere in the tree, which is why it
      is a new surface rather than an extension.
      verify (discharged): pre-state returned **no file**, and the
      council-mandated Phase 4.0 re-audit widened it — both
      `grep -rniE 'unattended.upgrade|fail2ban|ssh.hardening|ssh.posture|firewall.baseline' src/skills/`
      and a broader `ufw|nftables|sshd_config` probe returned **zero hits**, so the
      gap was genuinely ownerless and a new surface is justified. Now
      `src/skills/server-hardening/SKILL.md` (**159** lines) is the single owner —
      the contract test asserts it is the *only* skill matching
      `unattended[ -]upgrade|fail2ban`, which is the AC-6 "exactly one" claim the
      roadmap's original grep could not make.
- [x] **4.3 The readiness verdict cannot average a red away.** A single red
      signal makes the verdict not-ready, regardless of how many greens sit
      beside it. State it as an enum with an explicit floor, not as a score.
      verify (council-amended): a malformed/clean contract pair in
      `operational-readiness` — the malformed case carries exactly one red among
      greens and yields `not-ready`; the clean counterpart replaces only that red
      and yields the applicable non-red value. The skill defines no score,
      weight, average or other aggregation path able to override the red floor,
      and `unknown` is never treated as green.
      **Discharged:** `src/skills/operational-readiness/SKILL.md` (**184** lines)
      states the verdict as a three-value enum (`ready`, `ready-with-risk`,
      `not-ready`) with the floor as an Iron-Law block; § Examples carries the
      one-red-among-four-greens pair plus a second pair pinning
      `invalid-unknown-as-amber`, because routing `unknown` to amber is the subtler
      way to average a red away. **A defect in this step's own premise:** "the
      verdict type has no numeric aggregation path" is not decidable by banning the
      words — the first version of the assertion failed on the skill's own
      `Do NOT compute a ... weighted score` line, i.e. it could have been satisfied
      by deleting the prohibition and making the artefact worse. The assertion is
      now contextual (every mention of an aggregation construct must sit on a
      prohibitive line), and its sensitivity was proven by sabotage: appending
      "The readiness score is the weighted average of the five inputs." turns it
      red; restoring from a `cp` backup returns it green at 184 lines.

## Blockers

### blocker: b-plate-vs-skill-sprawl

- **Status:** resolved
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
- **Resolution (2026-08-23):** **(b) — three responsibility-aligned skills**, with
  fixtures as **committed in-skill contract pairs (option ii)**. Decided by the AI
  council, **2/2 convergent** (`anthropic/claude-sonnet-4-5`, `openai/codex-default`;
  3 rounds, blind chairman, $0.11748) — response at
  `agents/runtime/council/responses/b-plate-vs-skill-sprawl.md`. <!-- council-ref-allowed: blocker resolution provenance; the decision body is inlined below so the record survives council-dir pruning -->
  **Reason:** the `≥ 2 ## Procedure` warning in `size-and-scope.md` is a
  *responsibility* trigger that fires **regardless of size**, and the four phases
  contain three independently executable judgements with different inputs, outputs,
  consumers and trust boundaries — signal detection (repo evidence → normalized
  signal record), alert validation (alert definition → validity + class) and
  readiness adjudication (cross-domain evidence → enum). Option (a)'s
  "upgrade now, split at the cap" defers a decision the roadmap already supplies
  evidence for, and contradicts *split by responsibility, not by length*. The
  siblings are not thin: each carries an input contract, a procedure, an output
  contract and validation examples. **Destinations:**
  Phases 1–2 → `src/skills/logging-monitoring/SKILL.md`;
  Phase 3 → `src/skills/alerting-doctrine/SKILL.md` (new);
  Phase 4.3 → `src/skills/operational-readiness/SKILL.md` (new);
  Phase 4.1 → `src/rules/scale-discipline.md` (extended);
  Phase 4.2 → `src/skills/server-hardening/SKILL.md` (new).
  `incident-commander`, `dashboard-design` and the vendor specialists receive
  **inbound pointers only**. **Fixtures (ii):** `src/config/gate-coverage.yml`
  registers gate scripts and their mutation canaries, **not fixture identifiers**,
  so the literal reading of 1.3 / AC-4 was unsatisfiable without shipping a new
  gate script; the fixture obligations are discharged as committed
  malformed/clean contract pairs in the skill that owns each verdict, and are
  never described as executable. **Kill criteria:** revisit the split if any new
  sibling is < 300 substantive words and lacks an independently executable
  workflow, a declared input/output contract, or its own validation section; or if
  executing one sibling requires opening another merely to learn its inputs,
  procedure or verdict format. Revisit fixture choice (ii) when a second machine
  consumer needs the same verdict semantics, or when two merged defects contradict
  a fixture's stated verdict — at that point introduce one schema and one
  validator gate deliberately. **Immediate rollback:** `proposed` renders as
  operational; `committed` becomes indistinguishable from `measured`; a `page`
  passes without all three mandatory fields; a numeric path overrides a red
  readiness input; `unknown` is treated as compliant. **Sequencing (council
  order):** the Golden-Signal definitions land in `logging-monitoring` *before*
  the detection step, and `alerting-doctrine` is **not** created first — a
  downstream consumer must not dictate the evidence ontology.

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

- [x] AC-1 — An agent can answer "which required signal does this project lack"
      from a provider-neutral model, with the answer grounded in what was
      detected in the project rather than in what the skill happens to document.
- [x] AC-2 — The four Golden Signals are each defined once in the tree. Naming
      the family without defining its members no longer occurs.
- [x] AC-3 — Every threshold the suite emits is marked operational or proposed,
      and a proposed one cannot be rendered as operational. A fixture pins both
      directions.
- [x] AC-4 — A page definition missing an owner, a runbook or a first
      diagnostic step scores as malformed, proven by committed malformed/clean
      contract-fixture pairs in the skill that owns the verdict, each stating its
      expected verdict and differing only in the condition under test.
      (Council-amended: registration in `gate-coverage.yml` is **not** required —
      that manifest holds gate scripts and mutation canaries, not fixture ids.
      These are contract fixtures with explicit expected verdicts, never
      described as executable, until a machine-readable schema and runner are
      introduced deliberately.)
- [x] AC-5 — Finite-resource exhaustion is a question the readiness surface
      asks, where today the governing rule contains no such term.
- [x] AC-6 — Host hardening has exactly one named owner in the tree, closing
      the only item in this set that had none.
- [x] AC-7 — A readiness verdict containing one red is not-ready. No numeric
      aggregation path exists that could produce a different answer.
- [x] AC-8 — The destination question is answered in writing before the first
      artefact lands, so the resulting shape is a recorded choice rather than
      the residue of drift.
