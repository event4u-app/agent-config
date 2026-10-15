---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-a-hook-carrier-that-is-never-silent, road-to-a-release-that-reads-its-settings-delta]
estate_offset_exempt: "Round inbox-2026-10-n carries the owner's directive of 2026-10-12 — remove the lean settings and make loading default and dynamic, but only if the package gets no worse and stays as reliable as today. road-to-an-installed-layer-that-is-thinned plans the opposite form (its step 3.1 keeps the rollback as one setting) and is blocked on an instrument no scheduled file owns; folding six phases into it would turn a three-phase opt-in file into the largest active roadmap and bury its own owner answer. Archiving or parking it is wrong because its opt-in phases stay valid; this file replaces only its 3.1 form."
estate_growth_exempt: "+1 open_blockers for `instruction-load-observer-has-no-scheduled-owner`, the question this round raises for the seventh time: the observer stub records six earlier arrivals, and its binding was moved into that stub by owner answer D10 on 2026-10-06. The entry asks the owner to schedule it here; it closes no box and changes no behaviour."
relates:
  - slug: road-to-a-hook-carrier-that-is-never-silent
    relation: depends
    note: "Added in the same change. No machine is promoted to a thinned form before that file's Phase 3 has merged; the decision function reads its probe (2.2) and demotion state (3.3)."
  - slug: road-to-a-release-that-reads-its-settings-delta
    relation: depends
    note: "Active. Owns removed-key tombstones and the open owner blocker `what-a-minor-may-remove`; Phase 4 here removes keys only through that mechanism."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: extends
    note: "Active. Its opt-in thinned install (Phase 1) and standing-only fixture (AC-3) stay; its step 3.1 form — flip the default, rollback stays one setting — is replaced by Phase 3 here. Phase 2 here produces the arrival record its step 2.1 and blocker `arrival-record-needs-a-cancelled-observer` wait on."
  - slug: road-to-instructions-loaded-observer
    relation: extends
    note: "Stub. Its step 3.0 is step 1.1 here, kill switch kept as written — once the owner answers this file's blocker."
  - slug: road-to-skills-that-arrive-when-called
    relation: extends
    note: "Added in the same change. `projection.mode` is removed here only after that file's completeness question is answered."
  - slug: road-to-delivery-on-hook-hosts
    relation: disjoint
    note: "Later. Owns the effect verdicts in host-injection-effect.json; the decision function only reads those rows."
---
# Road to a setup that decides itself

> **Source:** `agents/tmp.old/inbox-2026-10-n/` — a round of five supplied plans
> and one transcript. The operative plan was a consolidation over three of them;
> the fourth, a later consolidation by a second session, was not among its
> parents and is folded in here. Owner directive in the transcript, 2026-10-12:
> *remove the lean settings, make it default and dynamic — but only if the
> package does not get worse; it must stay as reliable as it is today.* Verified
> against `main` @ `d760ecbde` on 2026-10-12.

## Goal

A consumer never sets, reads or reasons about how the package loads its rule
layer. Per host and machine the package computes the form — full or thinned —
from evidence it can check when the form matters, and computes full whenever
that evidence is missing, stale or contradicted. No form may cost a check, a
gate or a law that today's setup delivers.

Done means: the lean projection keys and the retired `tiered` value are gone
from every public surface through the release's tombstones; `doctor` says which
form each layer is in and why; and a pre-registered comparison shows no
regression — or every machine stays on today's full form, which is still a valid
end state for this file, now without its keys.

## What "as reliable as today" means — measured

- **Installed layer:** full bodies. Reproduced 2026-10-12: 106 rule files,
  369,415 bytes under `~/.claude/rules`, although the template says
  `mode: delivery` — the installer refuses a template-only value
  (`src/scripts/_lib/lean_projection_mode.ts:407-413`).
- **Project tree on the first host:** `delivery` since ADR-267 — 616/616
  byte-equal deliveries, 101/101 labelled rules reachable, 0 of 212 near-misses
  fired on the frozen routing-matrix corpus.
- **Every other host:** byte-identical to `eager-all`, asserted by
  `check_host_tree_parity`.
- **First-host effect:** delivery mechanics observed, behavioural effect not —
  `src/config/host-injection-effect.json` row `claude` is `unobserved`.
- **Standing laws:** the installed-layer roadmap's AC-3 already proves every
  consequence-class law stays loaded with the carrier off.

"Not worse" is therefore four checkable statements: no host receives less than
today unless a recorded observation shows the thinned form arrives there; no
session runs thinned on a carrier not proven in its launch environment; a dead
carrier is never silent on a thinned layer; and Phase 5 shows no regression.

## Context

The tree already holds what two of the supplied plans proposed to build. Each
row is a reuse instruction:

| Proposed | Already in the tree |
|---|---|
| a capability lifecycle state machine | the activation ladder `eligible → selected → projected → delivered → visible → adhered` (`src/scripts/_lib/activation_ladder.ts:36-43`) |
| an obligation graph so gates do not depend on skill text | the obligation ledger (`src/scripts/_lib/obligations.ts`) and the consequence class that keeps its law standing |
| per-rule kernel / path / triggered / manual classes | `type: always` / `auto` / `manual` plus tiers, `safety-floor` among them |
| explain and doctor verbs | `route:explain`, `route:audit`, `doctor`, `hooks:doctor`, `routing:doctor` (`src/cli/registry.ts:42`, `:90-95`) |
| a new frozen task corpus | routing matrix, trigger corpus with sealed holdout, conformance cases |

The defects:

- **D1 — One key, several meanings.** `lean_projection.mode`: template
  `delivery` (`src/config/agent-settings.template.yml:213-214`), schema default
  `eager-all` (`src/server/schemas/settings.ts:66`), parser fallback `eager-all`
  (`lean_projection_mode.ts:77-85`), and nothing from the template at install.
  `projection.mode`: template `scoped` (`:60-61`), schema default `legacy-all`
  (`settings.ts:32`).
- **D2 — The knob produced the silence it exists to prevent.** The module header
  records 2026-10-02: the delivery concern read a settings file that does not
  exist on a normal install, resolved `eager-all` and closed its own gate while
  thin stubs were on disk (`lean_projection_mode.ts:15-25`). At `d760ecbde`, 19
  non-test source files read `lean_projection` and 20 read `projection.mode` or
  `legacy-all` outside it.
- **D3 — The instrument that would prove a thinned form is unbound.**
  `InstructionsLoaded` is in no event vocabulary or alias row
  (`src/scripts/check_standing_rule_delivery.ts:289` calls it a host feature this
  suite does not yet bind). Owner answer D10 of 2026-10-06 moved the binding into
  `stubs/road-to-instructions-loaded-observer.md`, which no active file owns.
- **D4 — Stale anchors on the type this file keeps.**
  `src/scripts/_lib/activation_ladder.ts:32` and
  `src/scripts/_lib/delivery_arm_experiment.ts:6`, `:239` cite
  `lean_projection_mode.ts:19`; the type is at `:75`.
- **D5 — A retired experiment is still a reachable value.** `tiered` is accepted
  by `src/scripts/_lib/mcp_bridge.ts:303-307` and acted on by
  `src/scripts/install.ts:3441`, though its roadmap closed measured-null.
- **D6 — Removing settings keys is public contract.** `BREAKING_CHANGES.md:12-13`
  names settings keys part of the public contract; whether a minor may remove one
  is the open blocker `what-a-minor-may-remove`.

Not planned here: shortening the stubs' absolute pointer prefix (12,371 of the
stubs' 52,925 characters) is a lever for the installed-layer ceiling and stays
with that file.

## Phase 0 — One baseline, recorded before anything moves

- [ ] **0.1 Today as fixtures.** Per host: projected and installed rule layer
  (file set, byte totals, which rules are full), the hook commands written, the
  resolved form. These are the "today" arm of Phase 5.
  verify: two runs at one commit are byte-equal; every row names its commit;
  run at `d760ecbde` the installed row reads 106 files / 369,415 bytes.
- [ ] **0.2 Corpus by reuse.** The comparison set is the routing matrix, the
  train slice of the trigger corpus, the host-graded cases and the conformance
  cases, plus one added class: obligation cases — a safety-floor or
  consequence-class rule must fire — drawn from rule frontmatter.
  verify: a test asserts no sealed holdout file is opened.
- [ ] **0.3 Fix the stale anchors** of D4.
  verify: the three cites resolve to the type.

## Phase 1 — The instrument

- [ ] **1.1 Bind `InstructionsLoaded`.** Absorbs step 3.0 of
  `stubs/road-to-instructions-loaded-observer.md` (D6). Vocabulary, alias and platform
  row, in the stub's order; observe-only; the stub's kill switch kept —
  removable on hook failure, duplicate events, session-start regression or
  unexplained test breaks.
  verify: the stub's re-entry probe returns `1` and `1`.
- [ ] **1.2 Negative controls for the observer.** Event unavailable on
  the host version, events reordered, malformed payload, duplicate call: each is
  recorded as `unknown`, never as arrival.
  verify: one fixture per control; none produces an arrival record.

## Phase 2 — An arrival record per session, on the ladder

- [ ] **2.1 The record.** Per session: host version, launch context where
  exposed, which package rule files loaded and why (`load_reason`), whether the
  dispatcher was reached. It is the observable predicate of the ladder's
  `visible` rung for standing rules — no new state vocabulary. Names, counts and
  enums only.
  verify: a fixture produces one record; the schema rejects a body or prompt
  field; `activation_ladder` maps the record to `visible`.
- [ ] **2.2 Hand it to its waiting consumer.** The installed-layer
  roadmap's step 2.1 reads this record.
  verify: that step's verify line has an input.

## Phase 3 — The package decides; no key does

- [ ] **3.1 One decision function.** Per layer, host and machine it returns
  `full` or `thinned` and a reason code. `thinned` requires all of: host in
  `THINNABLE_HOSTS` (`lean_projection_mode.ts:113`); delivery mechanics observed
  for that host in `host-injection-effect.json`; an arrival record (2.1) for this
  host version showing stubs and the standing-law set loaded; the carrier probe
  of the carrier roadmap's 2.2 passing on this machine; not `demoted`; payload
  and layer of one version; no release-brake row (3.4); no user pin (3.5). It
  never thins a rule in the consequence class or the safety-floor tier. Anything
  else is `full`. It reads no settings key; the forms stay an internal enum, so
  the delivery experiment's arms keep working.
  verify: table test — each condition failing alone yields `full`; a
  consequence-class rule is `full` under every input.
- [ ] **3.2 Shadow first.** Until 5.3 enables it, the function runs and records
  what it would choose; `doctor` prints that as `would-be`, and nothing on disk
  changes.
  verify: fixture where every condition holds — the layer on disk is unchanged
  and doctor prints `would-be: thinned`.
- [ ] **3.3 Promote after proof, never at install.** A fresh install writes the
  full layer, exactly as today. A later session whose arrival record satisfies
  3.1 promotes the layer for following sessions, in the `session_start` concern
  under a latency budget fixed from 0.1's measurement; a promotion that would
  exceed it is not attempted in that session. An arrival record that disagrees
  with the form on disk — a standing law missing — demotes the machine as a dead
  carrier does.
  verify: fresh-`HOME` fixture — session 1 full, session 2 thinned, only with
  the record present; a record missing a standing law yields `demoted`.
- [ ] **3.4 A release brake the maintainer owns.** A shipped table row forces
  `full` for a host version or a package version. It is the operator rollback,
  not a consumer surface.
  verify: a row for a fixture host version forces `full`.
- [ ] **3.5 A user brake that is not a setting.** `install --full` writes one
  field into the install receipt; only 3.1 reads it; no settings key, schema
  entry or wizard question.
  verify: receipt fixture with the field forces `full`; the settings schema has
  no matching key.
- [ ] **3.6 The project tree uses the same function**, with the project's own
  dispatcher as its carrier.
  verify: ADR-267's three corpus figures reproduce, and
  `./scripts-run src/scripts/check_host_tree_parity` -> 0
- [ ] **3.7 Declare it.** `doctor` and the receipt print form, reason code, last
  arrival record and demotion state per layer and host.
  verify: snapshot per reason code.

## Phase 4 — Remove the keys through the release, loudly

- [ ] **4.1 One ADR.** It records the key removal and the computed decision, and
  supersedes ADR-267 decision 3 (rollback is one setting), ADR-278 (the
  user-global layer carries the thinning opt-in) and the installed-layer
  roadmap's D3 (the template value is not consent), which no longer has a key to
  apply to.
  verify: the ADR exists and the three superseded records name it.
- [ ] **4.2 Tombstones, not deletions.** Every removed key gets a tombstone in
  the settings-delta mechanism of `road-to-a-release-that-reads-its-settings-delta`,
  and ships in the release its blocker `what-a-minor-may-remove` allows — a major
  unless that blocker is answered otherwise.
  verify: the release dry-run reports each tombstone.
- [ ] **4.3 Read old values once.** For one release window an explicitly written
  `eager-all` or `legacy-all` becomes the 3.5 pin; anything else is dropped; both
  are printed. After the window `doctor` still names a leftover key as ignored.
  verify: upgrade fixtures for every prior value.
- [ ] **4.4 Remove `lean_projection.*`** from template, schema, whitelist
  (`src/scripts/_lib/agent_settings.ts:311-312`), wizard and docs.
  verify: `! grep -rq lean_projection src/config src/server docs/settings-reference.md` -> 0
- [ ] **4.5 Retire `tiered`** with its install branch; the measured null stays
  in `docs/CLAIMS.md`.
  verify: tests naming `tiered` are deleted with the branch, not skipped.
- [ ] **4.6 `projection.rule_workspaces` becomes a rule.** Maintainer-only rules
  never project to a consumer; derived from frontmatter, same rule set as today.
  verify: consumer install fixture equals 0.1's rule set.
- [ ] **4.7 `projection.mode` last.** Removed only after the skills roadmap's
  completeness question is answered; on hosts with a listing lever, scoping moves
  to visibility; elsewhere the active profile decides, reversing the template's
  "never inferred from profile.id" deliberately in the 4.1 ADR.
  verify: until then it is the only remaining key, documented as such.
- [ ] **4.8 Downgrade stays safe.** A machine downgraded to a release that still
  reads the keys resolves the absent key to its full form.
  verify: mixed-version fixture — removal release, then the previous release —
  lands on `eager-all` / `legacy-all`.

## Phase 5 — Prove "not worse" once, then enable

- [ ] **5.1 Pre-register.** Arms per host: today (0.1) vs computed (Phase 3).
  Primary: host-graded and conformance cases with D2's margin fixed before the
  run; repeated runs; an evaluator independent of the implementation; interval
  reported. Critical: zero regressions on safety-floor, consequence-class and
  obligation cases — one observed critical failure blocks enablement until fixed
  and re-run. Guards: `session_start` p95 latency not worse than 0.1; a session
  on a thinned layer with neither an arrival record nor the carrier roadmap's
  visible line. Fault matrix: dispatcher absent, stripped `PATH`, hook stdout
  hidden, host restart, two simultaneous sessions, stale heartbeat, a nested
  subagent session. Secondary, never a reason to flip: standing characters at
  session start, the host's size warning present or absent.
  verify: the pre-registration is hashed before the first run and reviewed by
  the council before it is frozen.
- [ ] **5.2 Run under the existing spend and independence rules.**
  verify: the result carries the claims gate's honesty label.
- [ ] **5.3 Enable on the record.** 3.3's promotion is enabled for consumers only
  on a non-inferior 5.2; otherwise every machine stays full. Phase 4 ships either
  way: full is today's behaviour, now without its keys.
  verify: the enabling commit cites 5.2's result file.

## Blockers

### blocker: instruction-load-observer-has-no-scheduled-owner

- **Status:** resolved — owner chose (a) on 2026-10-15 in reply to the PR #2373 report (eighth arrival): steps 1.1–2.2 absorb stub step 3.0 with its kill switch, and the installed-layer blocker `arrival-record-needs-a-cancelled-observer` resolves in the same change. Was: raised 2026-10-12 by round inbox-2026-10-n, the seventh arrival of this subject; owner answer D10 of 2026-10-06 moved the binding into `stubs/road-to-instructions-loaded-observer.md`, which no active file owns, and `road-to-an-installed-layer-that-is-thinned` carries the same question as `arrival-record-needs-a-cancelled-observer`
- **Owner:** owner — scheduling the stub is an estate decision, and the binding changes what every consumer's `.claude/settings.json` receives
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** steps 1.1, 1.2, 2.1, 2.2 — and through them the thinned branch of 3.1; Phase 0, 3.2–3.7, Phase 4 and Phase 5's full-only outcome are not blocked
- **What to do:** pick exactly one — (a) schedule the binding here: steps 1.1–2.2 absorb stub step 3.0 with its kill switch, and the installed-layer blocker `arrival-record-needs-a-cancelled-observer` resolves to its option (a) in the same change; or (b) re-scope 2.1 to a record obtainable without the host event, accepting that "loaded at start" and "loaded after compaction" are never claimed, so 3.1 can never return `thinned` on an arrival condition; or (c) leave it unscheduled, and record beside D3 that every machine stays full indefinitely.
- **Resolved when:** this file's steps 1.1–2.2 carry no blocked-by marker, or 2.1 carries re-scoped text naming what is no longer claimed, or D3 records the indefinite wait.
- **Recommendation:** (a). The directive asks for a dynamic default only if the package gets no worse, and "no worse" on the installed layer is unprovable without the host's own load event; (b) keeps the keys' removal but makes the dynamic half unreachable, and (c) is (b) without saying so.
- **If you do nothing:** Phase 4 still removes the keys and every machine stays on today's full form, which is safe; the dynamic default the directive asks for never arrives, and the subject arrives an eighth time.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | The user brake is `install --full`, one receipt field read only by 3.1 | The directive excludes a setting; both rule-layer plans and the later consolidation converge on an install-time flag | a consumer needs the brake on a machine where they cannot re-run install |
| D2 | contested-technical | agent | Non-inferiority margin: zero on safety-floor, consequence-class and obligation cases; at most one regressed case per hundred elsewhere as a candidate, valid only with a powered pre-registration; an uncertain reading means stay full | Converged across three plans; the later consolidation notes one per hundred is not a bound by itself; the council reviews it at 5.1 before the pre-registration is frozen | the council at 5.1 finds the corpus too small to power the margin |
| D3 | product-owned | owner | Land as a new file rather than fold into the installed-layer roadmap | Operator instruction of 2026-10-12 to land this round's roadmaps; folding would make that file the largest active roadmap | the installed-layer file closes its Phases 1–2 before this file starts Phase 3 |
| D4 | reversible-technical | agent | The forms stay an internal enum after the keys go | The delivery experiment uses the modes as arms (`delivery_arm_experiment.ts`) | the experiment closes |
| D5 | reversible-technical | agent | Thinnable hosts stay `THINNABLE_HOSTS` (claude-code, cursor, cline); each needs its own observed row before 3.1 can thin it | Binding and effect are separate axes (`host-injection-effect.json` `_comment`) | — |
| D6 | product-owned | owner | Blocker `instruction-load-observer-has-no-scheduled-owner` → (a): this file schedules the `InstructionsLoaded` binding as steps 1.1–2.2, absorbing stub step 3.0 with its kill switch | owner answer 2026-10-15 to the PR #2373 report, the subject's eighth arrival | the kill switch fires, or the host drops the event |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Arrival without adherence | product | A record shows a law loaded, not that the model followed it. | 3.1 names the rung it relies on; 5.1 is the behavioural reading and gates enablement. | Phase 5 — Prove "not worse" once, then enable |
| 2 | Users who set a key on purpose | product | Removing a key could silently override a deliberate choice. | 4.3 reads and reports every prior value; 3.5 keeps the intent without a setting. | Phase 4 — Remove the keys through the release, loudly |
| 3 | Launch contexts differ | implementation | A layer promoted under one launch is read under another where the carrier is dead. | 3.1 requires the carrier probe; 3.3 promotes only on a matching record; the carrier roadmap's visible line covers the rest. | Phase 3 — The package decides; no key does |
| 4 | Host contracts move | implementation | A host version changes load semantics. | Rows expire per host version; 3.4's brake forces full for a host version. | Phase 3 — The package decides; no key does |

## Acceptance Criteria

- [ ] AC-1 — No projection key in template, schema, wizard or docs except
  `projection.mode` pending the skills completeness question; each removal has a
  tombstone; `doctor` names leftovers.
- [ ] AC-2 — 3.1 returns `full` whenever any of its conditions fails, and for
  every consequence-class and safety-floor rule under every input.
- [ ] AC-3 — 5.2 reads non-inferior under D2, or consumers stay full and the
  record says why.
- [ ] AC-4 — `check_host_tree_parity` green at every step.
