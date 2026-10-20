---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-n carries the owner's directive of 2026-10-12 — remove the lean settings and make loading default and dynamic, but only if the package gets no worse and stays as reliable as today. road-to-an-installed-layer-that-is-thinned plans the opposite form (its step 3.1 keeps the rollback as one setting) and is blocked on an instrument no scheduled file owns; folding six phases into it would turn a three-phase opt-in file into the largest active roadmap and bury its own owner answer. Archiving or parking it is wrong because its opt-in phases stay valid; this file replaces only its 3.1 form."
estate_growth_exempt: "+3 open_blockers on 2026-10-20, each registering a stop the Phase 4 drain lane MET rather than one it introduced: `instructions-loaded-binding-needs-a-ratification-quorum` (the byte half of 1.1's stop is gone — the lane freed 1,148 B — and what remains is a two-provider ratification the `anthropic` seat could not supply that day), `project-tree-form-source-needs-a-full-quorum` (one seat of two answered 3.6), and `projection-mode-removal-waits-on-second-host-reach` (ADR-289 point 3, falsified in the skills roadmap the same week). Each closes no box, changes no behaviour, and names the venue that resolves it; between them they close out eight steps' worth of re-derivation for the next lane. The original entry read: +1 open_blockers for `instruction-load-observer-has-no-scheduled-owner`, the question this round raised for the seventh time — resolved 2026-10-15 by owner answer (a)."
relates:
  - slug: road-to-a-hook-carrier-that-is-never-silent
    relation: extends
    note: "Archived 2026-10-20, every step closed, so the dependency is met. No machine is promoted to a thinned form before that file's Phase 3 has merged; the decision function reads its probe (2.2) and demotion state (3.3)."
  - slug: road-to-a-release-that-reads-its-settings-delta
    relation: extends
    note: "Archived. It landed the removed-key tombstone mechanism and its `what-a-minor-may-remove` blocker; Phase 4 here removes keys through that shipped mechanism. An archived file lands nothing further, so this is `extends`, not `depends`."
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

- [x] **0.1 Today as fixtures.** Per host: projected and installed rule layer
  (file set, byte totals, which rules are full), the hook commands written, the
  resolved form. These are the "today" arm of Phase 5.
  verify: two runs at one commit are byte-equal; every row names its commit;
  run at `d760ecbde` the installed row reads 106 files / 369,415 bytes.
  Re-screened 2026-10-18, still open: a scratch-`HOME` install is the reproducible path (the carrier roadmap's 0.1 census already stages one per install path), but a byte-equal fixture also has to exclude the install-date and machine-path fields the receipt writes, and naming that exclusion set is the decision this step still lacks. Not forced: nothing on disk moves before 5.3.
  Open 2026-10-16: the instrument exists (`src/scripts/installed_layer_report.ts`), the per-host fixture set does not. The 106 / 369,415 row is a reading of one maintainer machine's `~/.claude/rules`, not of a scratch-`HOME` install at that commit, so the step needs a decision on which install path the fixture is taken from before it can be byte-reproducible.
  Landed 2026-10-20: `./scripts-run src/scripts/layer_baseline_report` runs a real `--global --tools=<host>` install into a scratch `HOME` for each of the five hosts with a rule directory (the only scope a consumer gets, ADR-020) and records the installed file set, bytes, full/stub per file, the hook commands written and the resolved form; it adds the package's five projected rule directories. The fixture is `agents/evidence/analysis/setup-layer-baseline.md`, measured at `89e094819`, and names that commit. The exclusion set is D9. Two full runs at that commit compared byte-equal with `cmp`, and `tests/scripts/layer_baseline_report.test.ts` asserts the same for claude-code. The same reader pointed at a checkout of `d760ecbde` (`--package-root`) reads the claude-code installed row as 106 files / 369,415 bytes. So the maintainer-machine figure was also a scratch-`HOME` figure, and the open note above did not need a different install path. Today all five installed layers are 106 full files and every host resolves `full`. claude-code and the two other thinnable hosts read `delivery-unobserved`; augment and windsurf read `host-not-thinnable`.
- [x] **0.2 Corpus by reuse.** The comparison set is the routing matrix, the
  train slice of the trigger corpus, the host-graded cases and the conformance
  cases, plus one added class: obligation cases — a safety-floor or
  consequence-class rule must fire — drawn from rule frontmatter.
  verify: a test asserts no sealed holdout file is opened.
  Open 2026-10-16: no artefact named "host-graded cases" exists in the tree (the only other mention is the skills roadmap's own plan), and `tests/conformance/` holds a retrieval set only. Building the manifest now would name two of its four sources by guess. The train slice is already holdout-sealed by `loadTrainCases` in `src/scripts/_lib/routing_corpus.ts`.
  Open 2026-10-20, re-screened: the host-graded case set is still absent. It is the case set `road-to-skills-that-arrive-when-called` pre-registers (its Phase 5 outcome reads it), so this step waits on that file producing it. `tests/conformance/` still holds a retrieval set only. A manifest built now would carry one of its four named sources as a guess, and that is the form this step forbids.
  Landed 2026-10-20: `src/config/layer-form-comparison-corpus.json` and its one reader `src/scripts/_lib/layer_form_corpus.ts`. Three sources are present and resolve to a count — the routing matrix, the holdout-sealed train slice through `loadTrainCases`, and the obligation class this step adds (every consequence-class member plus every `tier: safety-floor` rule, derived from the frontmatter that decides the class). Two are recorded `absent` with a reason and a reopening condition rather than named by guess: `host-graded`, which exists nowhere and which `road-to-skills-that-arrive-when-called` 5.1 declared unmeasurable on 2026-10-20 rather than substituting for, and `conformance`, because `tests/conformance/retrieval/` validates the v1 retrieval ENVELOPE against its schema and carries no prompt and no expectation. Naming an absence is not the guess the step forbids; swapping in the nearest measurable set is, and that is the distinction the manifest encodes. The verify clause is a tripwire rather than an assertion over a spy: `tests/scripts/layer_form_corpus.test.ts` builds a scratch root where the sealed corpus path is a DIRECTORY, so a reader that opens it raises `EISDIR`. Sensitivity shown by removing the `partition === 'holdout'` skip in `routing_corpus.ts`: that one test went red and the other six stayed green.
- [x] **0.3 Fix the stale anchors** of D4.
  verify: the three cites resolve to the type.
  Landed 2026-10-16: the cites (and a fourth in `tests/scripts/activation_ladder.test.ts`) now name `LeanProjectionMode` by symbol, not by line, so they cannot go stale on the next edit to that file.

## Phase 1 — The instrument

<!-- blocked-by: instructions-loaded-binding-needs-a-ratification-quorum -->
- [ ] **1.1 Bind `InstructionsLoaded`.** Absorbs step 3.0 of
  `stubs/road-to-instructions-loaded-observer.md` (D6). Vocabulary, alias and platform
  row, in the stub's order; observe-only; the stub's kill switch kept —
  removable on hook failure, duplicate events, session-start regression or
  unexplained test breaks.
  verify: the stub's re-entry probe returns `1` and `1`.
  Open 2026-10-18 — the observer is built, its binding is not shipped. The concern `instructions-observer` (`src/scripts/hooks/instructions_observer_hook.ts`, kill switch `AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off`) writes one capture line per event to `<machine root>/runtime/arrivals/<session>.jsonl` through one `O_NOFOLLOW|O_NONBLOCK` descriptor, owner-only, 50 sessions × 256 KiB retained; classification runs at read time (`_lib/instructions_loaded_classify.ts`). It is in no manifest row and not in the concern registry, so the probe still reads `0` and `0`. The binding (vocabulary, alias, platform row, registry entry) was written and then taken out of this change, for two reasons that are both recorded here rather than worked around:
  (1) **Council modification review, 2026-10-18, anthropic + openai, seven rounds (the first two attempts timed out on both seats), all subscription-authed, nothing billed — no round reached a pass.** Each round closed real defects and raised new ones: a racy shared rotation file (→ one file per session), an order-sensitive record under asynchronous delivery (→ a set, D7), an unsanitised session id, an all-or-nothing reader, a recreated file skipping its prune, a check-then-append symlink race (→ one no-follow descriptor), a fail-open boundary that had slipped, a FIFO that could stall the open. Round 7's open items — verify the `arrivals` directory itself (not a symlink, owned, `0700`) before opening anything in it; give the `arrivals.last-error` marker the same no-follow, non-blocking, owner-only treatment as the session files; a test that a torn trailing line is skipped — are done in this change, outside the bundle, so round 8 reviews them with the binding instead of re-deriving them.
  (2) **The dispatcher bundle has no room for them.** With the binding in and before the round-7 items, it measured 1,549,991 B against its 1,550,000 B ceiling (`src/config/hook-bundle-budget.json`); the round-7 items cost more than the 9 B left. Raising `max_bytes` is a ratchet move recorded in that file's `raise_log` and is the owner's, and a sibling change moving the egress engine into a conditional chunk would free room without one. Either unblocks this step; the review then resumes at round 8.
  **Decided 2026-10-18 (D8): no raise first.** AI council 2/2, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"), chose to make room before raising: a per-module byte ranking from the esbuild metafile, then the largest narrow-event module — this observer is the candidate both seats named — behind a conditional import, proven inside `hook-latency-budget.json`. A raise of `max_bytes` is the evidence-backed fallback only, sized from all blocked work. Record: `agents/evidence/council/hook-bundle-ceiling-20261018.md`. Measured at `f55e5a760`: 1,547,451 B of 1,550,000 B. Re-measured 2026-10-20 at `80809d5a0`, with the egress engine already in its own chunk: 1,549,546 B of 1,550,000 B, 454 B left — the conditional chunk the step named has landed and did not make room, so D8's per-module ranking is still the next move, and its extraction touches the ratification gate's watched set, which needs a council record this lane could not spend (both seats' local quota near exhaustion).
- [x] **1.2 Negative controls for the observer.** Event unavailable on
  the host version, events reordered, malformed payload, duplicate call: each is
  recorded as `unknown`, never as arrival.
  verify: one fixture per control; none produces an arrival record.
  Landed 2026-10-18: `tests/scripts/arrival_record.test.ts` — one fixture per control plus lost start-up events and mixed host versions; each yields a record with `status: unknown` and no layer-form evidence. Sensitivity shown by neutralising the duplicate check: that control went red. *Correction to the step:* "events reordered" cannot be a signal here. The host runs the event asynchronously, so disk order is scheduler order, and a rule that made reordering `unknown` would turn most real sessions into unknowns (the council's openai seat, round 1). The record is built as a set instead, and the reorder fixture asserts that a shuffled sequence yields exactly the in-order record — order can neither create nor remove an arrival. Recorded as D7.

## Phase 2 — An arrival record per session, on the ladder

- [x] **2.1 The record.** Per session: host version, launch context where
  exposed, which package rule files loaded and why (`load_reason`), whether the
  dispatcher was reached. It is the observable predicate of the ladder's
  `visible` rung for standing rules — no new state vocabulary. Names, counts and
  enums only.
  verify: a fixture produces one record; the schema rejects a body or prompt
  field; `activation_ladder` maps the record to `visible`.
  Landed 2026-10-18: `src/scripts/_lib/arrival_record.ts` — `buildArrivalRecord`, the closed-shape `validateArrivalRecord`, `arrivalReceipts` onto the ladder's `ActivationReceipt`, and `arrivalEvidence` in the shape 3.1 already typed. Host version is read from the host's `AI_AGENT` string and launch context from `CLAUDE_CODE_ENTRYPOINT`; where neither is exposed the field is `null`, which 3.1 reads as a version mismatch and so as `full`.
- [x] **2.2 Hand it to its waiting consumer.** The installed-layer
  roadmap's step 2.1 reads this record.
  verify: that step's verify line has an input.
  Landed 2026-10-18: `./scripts-run src/scripts/arrival_report` prints one block per session with a `host version` line, which is the token the installed-layer step 2.1 verify greps; that step now names it as its input. The tool exists; data begins to arrive only once 1.1's binding ships, so the consumer's verify has an input and, until then, an empty one.

## Phase 3 — The package decides; no key does

- [x] **3.1 One decision function.** Per layer, host and machine it returns
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
  Landed 2026-10-16: `src/scripts/_lib/layer_form_decision.ts` (`decideLayerForm`, `ruleForm`), test `tests/scripts/layer_form_decision.test.ts`. The arrival record and carrier probe enter as typed inputs with no producer yet, so every machine reads `full`. "Delivery mechanics observed" is read as `observed-true` in `host-injection-effect.json`, because that record has no mechanics field — stricter, never looser.
  AC-2 closed on this step 2026-10-20 at `80809d5a0`: `npx vitest run tests/scripts/layer_form_decision.test.ts` — 31/31 green. Each single failing condition yields `full` with its own reason, the reason set is covered exactly once, and every consequence-class and safety-floor id is `full` under the all-hold input and every single-failure input. Sensitivity rests on construction: the input set includes the all-hold case, where an ordinary rule is asserted `thinned`, so a `ruleForm` that ignored either class would red on that id. The explicit sabotage probe (dropping the safety-floor branch) was refused by the host's auto-mode classifier and was not run; the edit was reverted before any commit.
- [x] **3.2 Shadow first.** Until 5.3 enables it, the function runs and records
  what it would choose; `doctor` prints that as `would-be`, and nothing on disk
  changes.
  verify: fixture where every condition holds — the layer on disk is unchanged
  and doctor prints `would-be: thinned`.
  Landed 2026-10-16: `agent-config doctor --check layer-form` prints the per-host shadow decision; live it reads `would-be: full (delivery-unobserved)` for all three thinnable hosts.
<!-- blocked-by: instructions-loaded-binding-needs-a-ratification-quorum -->
- [ ] **3.3 Promote after proof, never at install.** A fresh install writes the
  full layer, exactly as today. A later session whose arrival record satisfies
  3.1 promotes the layer for following sessions, in the `session_start` concern
  under a latency budget fixed from 0.1's measurement; a promotion that would
  exceed it is not attempted in that session. An arrival record that disagrees
  with the form on disk — a standing law missing — demotes the machine as a dead
  carrier does.
  verify: fresh-`HOME` fixture — session 1 full, session 2 thinned, only with
  the record present; a record missing a standing law yields `demoted`.
  Open 2026-10-20: 0.1 has landed, but it records no latency figure (the step names none), so the budget source is the shipped `src/config/hook-latency-budget.json`, which binds this concern either way. Stop (2) is the one that holds this step open: no room in the bundle and no council record to make some, see 1.1.
  Open 2026-10-18, screened: two independent stops. (1) Its latency budget is "fixed from 0.1's measurement", and 0.1 is open. (2) The promotion runs in the `session_start` concern, inside the dispatcher bundle, whose ceiling 1.1's binding alone already exhausts (1,549,991 B of 1,550,000 with it in, see 1.1). A thin pass in that concern needs either a raised `max_bytes` (a ratchet move recorded in `hook-bundle-budget.json`'s `raise_log`, an owner decision) or bytes removed elsewhere first. Nothing promotes before 5.3 in any case, so leaving it open costs no behaviour.
  Stop (2) is now governed by D8: room is made before any raise.
- [x] **3.4 A release brake the maintainer owns.** A shipped table row forces
  `full` for a host version or a package version. It is the operator rollback,
  not a consumer surface.
  verify: a row for a fixture host version forces `full`.
  Landed 2026-10-16: table `src/config/layer-form-brakes.json` (empty), read by `loadBrakes`; an unreadable or malformed table holds the brake on.
- [x] **3.5 A user brake that is not a setting.** `install --full` writes one
  field into the install receipt; only 3.1 reads it; no settings key, schema
  entry or wizard question.
  verify: receipt fixture with the field forces `full`; the settings schema has
  no matching key.
  Landed 2026-10-18: `src/install/userPin.ts` writes `user_pin` into `runtime/carrier.json` (the receipt the carrier probe already writes, which now keeps fields it does not own); `prepareClaudeCarrier` refuses to thin while it is there, and `withMachineEvidence` hands it to 3.1 for every host. Sticky across a plain `install` and upgrades; `uninstall` removes it with the runtime directory. Tests: `hook_carrier_never_silent.test.ts` (pin on a reached carrier, survives a probe rewrite and a plain install) and `layer_form_evidence.test.ts` (`user-pin` on all three thinnable hosts). `grep -c user_pin src/server/schemas/settings.ts` reads 0. Documented in `docs/installation.md`.
<!-- blocked-by: project-tree-form-source-needs-a-full-quorum -->
- [ ] **3.6 The project tree uses the same function**, with the project's own
  dispatcher as its carrier.
  verify: ADR-267's three corpus figures reproduce, and
  `./scripts-run src/scripts/check_host_tree_parity` -> 0
  Open 2026-10-18, screened: the project tree on the first host runs `delivery` today (ADR-267). Routed through 3.1 as it stands, it would read `delivery-unobserved` and fall back to full — a default change for every project tree on that host that is not a "no worse" move and has no consent behind it. The step needs either a project-tree effect row the function can read as observed, or a decision that the project tree keeps ADR-267's evidence as its proof; neither is in the tree.
- [x] **3.7 Declare it.** `doctor` and the receipt print form, reason code, last
  arrival record and demotion state per layer and host.
  verify: snapshot per reason code.
  Landed 2026-10-18: `doctor --check layer-form` now decides on the machine's evidence (`src/scripts/_lib/layer_form_evidence.ts`) and prints per host `would-be: <form> (<reason>)`, the last arrival record, and the claude layer's state on disk with the pin; the install receipt prints the carrier probe and demotion lines it already printed plus the pin line. `layer_form_evidence.test.ts` pins one line per reason code, all twelve. Live on this machine it reads `would-be: full (delivery-unobserved)` for all three hosts and "the observer has not seen a session". The current host version is read from the host's own hook environment, so once a host's effect row is observed, a `doctor` run from a plain terminal reads `arrival-host-version-mismatch` — named here because it is what a maintainer will see first.

## Phase 4 — Remove the keys through the release, loudly

> **Screened 2026-10-18 — not executed by a drain lane.** Blocker
> `what-a-minor-may-remove` closed 2026-10-14 on option (c): a key may leave in a
> minor only when no consumer can rely on it. `lean_projection.mode: delivery`
> written user-globally is a live opt-in that thins `~/.claude/rules`
> (`installerThinsHost`), and `projection.mode: tiered` is still acted on by
> `install.ts`, so removing either is relied-on behaviour and fixes the next
> release as a major. Landing that on `main` is a release commitment, which is
> owner-reserved; the owner's 2026-10-12 directive orders the removal, not its
> release class or timing. 4.1's ADR carries that choice and is not written ahead
> of it.
>
> **Put to the AI council 2026-10-18 — split, still open.** Both seats agree
> Phase 4 ships as a major; `anthropic` chose to hold it until a major is cut for
> another reason (the Node floor) and land both together, `openai` to land it
> when ready, since waiting couples it to an unrelated release. Under the owner's
> delegation of 2026-10-18 a split resolves nothing. New input for a second round:
> ADR-290 (2/2 the same day) makes the Node-floor raise a semver-major, which
> removes the hold option's main uncertainty. Record:
> `agents/evidence/council/setup-key-removal-release-class-20261018.md`.

- [x] **4.1 One ADR.** It records the key removal and the computed decision, and
  supersedes ADR-267 decision 3 (rollback is one setting), ADR-278 (the
  user-global layer carries the thinning opt-in) and the installed-layer
  roadmap's D3 (the template value is not consent), which no longer has a key to
  apply to.
  verify: the ADR exists and the three superseded records name it.
  Landed 2026-10-20: **ADR-292 — the package decides its own rule-layer form.** It records the four-key defect set, the computed decision, the two non-settings brakes, the tombstone and one-window migration, and the release class. The three superseded records name it: ADR-267 `superseded_by: ADR-292 (decision 3 only)`, ADR-278 `superseded_by: ADR-292` with `status: superseded`, and D3 of `road-to-an-installed-layer-that-is-thinned` carries `superseded — ADR-292` in its revisit column. ADR-267's other decisions stand, its absent-key-resolves-to-full reading included, which is the default the computed function keeps.
- [x] **4.2 Tombstones, not deletions.** Every removed key gets a tombstone in
  the settings-delta mechanism of `road-to-a-release-that-reads-its-settings-delta`,
  and ships in the release its blocker `what-a-minor-may-remove` allows — a major
  unless that blocker is answered otherwise.
  verify: the release dry-run reports each tombstone.
  Landed 2026-10-20: `lean_projection.mode` and `lean_projection.hosts` carry entries in `REMOVED_KEYS` (`_lib/settings_removed_keys.ts`), each naming what decides instead — which `lint_settings_classes` enforces, so a bare "removed" is rejected. The loader's `warnRemovedKeys` prints one line per key per process. `tests/scripts/projection_key_migration.test.ts` pins both entries, the once-per-process dedupe, and that the keys the migration reads are the keys that have tombstones. The release class is the major the council fixed on 2026-10-20, recorded in ADR-292 and in `setup-key-removal-release-class-20261020.md`.
- [x] **4.3 Read old values once.** For one release window an explicitly written
  `eager-all` or `legacy-all` becomes the 3.5 pin; anything else is dropped; both
  are printed. After the window `doctor` still names a leftover key as ignored.
  verify: upgrade fixtures for every prior value.
  Landed 2026-10-20: `_lib/projection_key_migration.ts`, wired into the installer at the point `--full` is read. An explicitly written `eager-all` or `legacy-all` — the two values that meant *keep the full layer* — becomes the receipt pin; every other prior value is dropped; **both are printed**, which is the half that matters, because a value silently honoured and one silently dropped look identical to the consumer who wrote them. The window is named in the output, not only in a comment. Sixteen cases cover every prior value of both keys plus a non-string, a non-object branch and a hand-edited `  EAGER-ALL `. The installer reads MACHINE-global layers with the TEMPLATE layer isolated — the load-bearing half, since ADR-278 and D3 both record that a template value is not consent, and reading it would have printed a drop line on every install for a value nobody wrote.
- [x] **4.4 Remove `lean_projection.*`** from template, schema, whitelist
  (`src/scripts/_lib/agent_settings.ts:311-312`), wizard and docs.
  verify: `! grep -rq lean_projection src/config src/server docs/settings-reference.md` -> 0
  Landed 2026-10-20, and wider than the step's list, because the list alone would have left the tombstone lying. Gone from the template, both schemas, the user-global whitelist and `docs/settings-reference.md` (regenerated). Three `src/config` files named the key in HISTORICAL prose — an effect-row reason, a budget-raise reason and a ratchet log — and each was reworded to name it descriptively rather than rewritten or deleted, so the records keep their content and the grep is a true statement about the live surface. **The readers went too.** `resolveLeanProjection` no longer reads the settings cascade at all and `installerThinsHost` is a constant `false`: without that, `warnRemovedKeys` would print "ignored" for a key the projector still honoured. The form now comes from the package-owned record (3.6's reading, below). Measured side effect: the hook bundle fell to 1,548,551 B of 1,550,000 — 1,148 B BELOW the pre-change reading, so this step made room rather than spending it.
- [x] **4.5 Retire `tiered`** with its install branch; the measured null stays
  in `docs/CLAIMS.md`.
  verify: tests naming `tiered` are deleted with the branch, not skipped.
  Landed 2026-10-20. `ProjectionMode` is two values; `projectionModeOf` maps a leftover `tiered` onto `legacy-all`, which is the full surface and the safe direction. The install branch, `applyTieredPrune`, `TieredPruneOutcome`, `tierBPrunePredicate` and install.ts's `_prune_tier_b_modules` / `_resolve_tier_b` went with it, as did `migrationEligibility`'s `already-tiered` reason — an install carrying a leftover value now reaches the real eligibility test instead of being told it is already narrowed. `resolveTierB` and the per-machine split STAY: they feed the listing-budget advisory and the MCP catalogue, which never depended on the mode. `tests/scripts/tiered_projection.test.ts` was DELETED with the branch, not skipped. The measured null stays in `docs/CLAIMS.md`, rewritten into the past tense with its promotion path closed: reopening needs a result that contradicts the measurement that retired it.
- [x] **4.6 `projection.rule_workspaces` becomes a rule.** Maintainer-only rules
  never project to a consumer; derived from frontmatter, same rule set as today.
  verify: consumer install fixture equals 0.1's rule set.
  Landed 2026-10-20. `consumerRuleWorkspaces()` derives the set from `src/config/discovery/packs.yml` — every workspace id minus `agent-config-maintainer` — and `ruleScopeFromSettings` uses it in place of the key, including when a settings file carries no `projection` block at all: a rule is not a setting, so a file that omits a section cannot switch one off. The derived set is the nine ids the template shipped as its default, pinned literally in `tests/scripts/consumer_rule_workspaces.test.ts` so a drift in either direction is visible; the sensitive case asserts `agent-config-maintainer` IS in the vocabulary and is NOT in the result, so its absence is a subtraction that happened rather than a vocabulary that never had it. `check_consumer_scope_flip` reproduces the same lever on the derived scope: 15 rules excluded, 120 -> 106, −10,004 tok. An unreadable vocabulary yields the inactive axis — more ships, never less. The MAINTAINER projection stays unscoped by construction (`condense._read_rule_workspaces` is now a documented constant `null`), because the derivation's subtraction is exactly wrong for this repository's own tree. Five install-suite cases changed contract with it, each rewritten to the inverse rather than relaxed: a hand-written `rule_workspaces` is now ignored, a settings doc cannot produce a wider install, and the reap test moved to the pack axis — the axis that is still a setting and the same code path.
<!-- blocked-by: projection-mode-removal-waits-on-second-host-reach -->
- [ ] **4.7 `projection.mode` last.** Removed only after the skills roadmap's
  completeness question is answered; on hosts with a listing lever, scoping moves
  to visibility; elsewhere the active profile decides, reversing the template's
  "never inferred from profile.id" deliberately in the 4.1 ADR.
  verify: until then it is the only remaining key, documented as such.
  The completeness question is answered (ADR-289, reach, 2026-10-18), with one
  condition that binds this step: `projection.mode` stays until the reach
  mechanism and its tests exist.
- [x] **4.8 Downgrade stays safe.** A machine downgraded to a release that still
  reads the keys resolves the absent key to its full form.
  verify: mixed-version fixture — removal release, then the previous release —
  lands on `eager-all` / `legacy-all`.
  Landed 2026-10-20: `tests/scripts/projection_key_downgrade.test.ts`. There is no second checkout in the fixture and there does not need to be — the previous release's readers ARE `normalizeLeanProjectionMode` and `projectionModeOf`, and ADR-292 left both untouched precisely so this direction keeps working. So the fixture takes the settings file the REMOVAL release actually writes (through `sparseSettingsValues` / `renderSparseSettings`, not a hand-made stand-in), asserts it carries no projection key for an older reader to find, and feeds it to those readers: `eager-all` and `legacy-all`. The matrix covers every value a prior release could have written, the retired `tiered` included — which maps onto the full surface rather than pruning on a split this reader no longer computes. Sensitivity shown by making the normaliser map `''` onto `delivery`: two of the four cases went red, and the two that did not are the ones that assert on the written file rather than on the reader.

## Phase 5 — Prove "not worse" once, then enable

> **Screened 2026-10-18 — waits on accrued data.** The computed arm needs a
> machine where 3.1 can return `thinned`, which needs arrival records from real
> sessions under the binding landed in 1.1 and an observed effect row in
> `host-injection-effect.json` (owned by `road-to-delivery-on-hook-hosts`); the
> today arm needs 0.1's fixtures. Neither exists on the day the observer ships.

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

### blocker: instructions-loaded-binding-needs-a-ratification-quorum

<!-- asked: 2026-10-20 | record: agents/evidence/council/hook-bundle-ceiling-20261018.md -->

- **Status:** open — raised 2026-10-20 by the Phase 4 drain lane, which freed the bundle bytes and then found the second half of the stop still standing
- **Owner:** council
- **Class:** 2
- **Blocks:** steps 1.1 and 3.3. Nothing else: Phase 4 landed without them, and Phase 5's full-only outcome does not need them.
- **What to do:** the BYTE half of this stop is gone. Phase 4 measured the bundle at 1,548,551 B of 1,550,000 — 1,148 B below the pre-change reading — so the 454 B of 2026-10-20 is now 1,449 B, and D8's per-module ranking exists: `chat_history.ts` 55,899 B, `ai_council/config.ts` 42,091 B, `memory_lookup.ts` 34,765 B, `design_slop_rules.ts` 23,997 B (esbuild metafile, 2026-10-20, 294 modules). What remains is a GOVERNANCE stop and it is not about bytes: the binding edits `src/scripts/hook_manifest.yaml` and `src/scripts/hooks/dispatch_hook.ts`, both on the ratification gate's plumbing list (`check_kernel_edit_ratified.ts`), so it needs a ratification artifact naming `required_providers: 2` distinct providers (`src/config/ratification-policy.json`). The `anthropic` seat returned `cli_quota_exhausted` on 2026-10-20, so a two-provider artifact could not be produced. Pick one: (a) produce the artifact at a full quorum and land the binding in one change; or (b) extract the largest narrow-event module into a conditional chunk first per D8 — which ALSO touches `src/config/hook-bundle-budget.json`, on the same watched list, so it needs its own artifact and is not a way around this one; or (c) record that the binding waits for quorum, and Phase 5 stays full-only indefinitely.
- **Resolved when:** a ratification artifact with two distinct providers covers the binding diff, or the stub's re-entry probe reads `1` and `1`.
- **Recommendation:** (a). (b) spends a second ratification round to buy bytes that are no longer the constraint. ADR-268 § 4 forbids the lane ratifying its own expansion of what it may do, and this diff edits the dispatcher's event vocabulary, so no reading of a drain grant substitutes for the quorum.
- **If you do nothing:** every machine stays on today's full form — safe, and the state Phase 4 already shipped the keys out of. The dynamic default the owner's 2026-10-12 directive asks for does not arrive.

### blocker: project-tree-form-source-needs-a-full-quorum

<!-- asked: 2026-10-20 | record: agents/evidence/council/setup-project-tree-form-source-20261020.md -->

- **Status:** open — one seat of two answered on 2026-10-20; `anthropic` returned `cli_quota_exhausted`
- **Owner:** council
- **Class:** 2
- **Blocks:** step 3.6. Nothing else — Phase 4 shipped on the reading, and the thing it shipped changes no behaviour.
- **What to do:** confirm or overturn option (a) at a full quorum. (a) is what landed: the project tree keeps ADR-267's evidence as its proof, carried in `src/config/project-tree-form.json`, which an observed layer-form verdict supersedes in both directions. The alternative the seat weighed is (b) — route the tree through the decision function now, read `full (delivery-unobserved)`, and let the delivery mechanism go dark with nothing measured against it. The one risk the seat named against (a) is that the record becomes permanent and bypasses the decision function indefinitely; the precedence rule and its tests are what answer it, and a full quorum should check that they do.
- **Resolved when:** a two-seat record confirms (a), or names (b) and the record is removed in the same change.
- **Recommendation:** confirm (a). It is the only option on the table that changes no behaviour, which is the owner's own 2026-10-12 constraint, and it is reversible — deleting the record is the rollback, and a test asserts the full form follows.
- **If you do nothing:** the project tree keeps today's `delivery` on the first host, which is what it had, and step 3.6 stays open.

### blocker: projection-mode-removal-waits-on-second-host-reach

<!-- asked: 2026-10-20 | record: docs/decisions/ADR-289-skills-owe-reach-not-presence.md -->

- **Status:** open — raised 2026-10-20 by the Phase 4 drain lane on reading ADR-289's condition against the tree
- **Owner:** council
- **Class:** 2
- **Blocks:** step 4.7 and, through it, AC-1.
- **What to do:** nothing here — this entry records WHY 4.7 did not close with the rest of Phase 4, so the next lane does not re-derive it. ADR-289 point 4 binds 4.7 to "the reach mechanism and its tests exist", and they do (`_lib/skill_reach.ts`, `tests/scripts/skill_reach.test.ts`, `doctor`'s reach report). Point 3 of the same record is the one that is not met: the contract is published as met only once that report counts zero `unreachable`, and `road-to-skills-that-arrive-when-called` step 5.2 FALSIFIED its S3 arm on 2026-10-20 — a policy-disabled skill is not in the model-visible list and the model answers `UNAVAILABLE` without a tool call. That is its open blocker `second-host-unlisted-reachability`, which is where the remedy is chosen. Removing `projection.mode` while that stands would make scoping non-optional on a host where an unlisted skill has no retrieval path, which is a "worse" this file's goal forbids.
- **Resolved when:** `second-host-unlisted-reachability` records a remedy and `doctor`'s reach report counts zero `unreachable`; 4.7 then closes in its own change.
- **Recommendation:** resolve it there, not here. Two files asking the same question is how one of them answers it wrong.
- **If you do nothing:** `projection.mode` stays the only projection key, documented as such — which is exactly what 4.7's own verify clause describes for the interim, and AC-1 stays open naming it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | The user brake is `install --full`, one receipt field read only by 3.1 | The directive excludes a setting; both rule-layer plans and the later consolidation converge on an install-time flag | a consumer needs the brake on a machine where they cannot re-run install |
| D2 | contested-technical | agent | Non-inferiority margin: zero on safety-floor, consequence-class and obligation cases; at most one regressed case per hundred elsewhere as a candidate, valid only with a powered pre-registration; an uncertain reading means stay full | Converged across three plans; the later consolidation notes one per hundred is not a bound by itself; the council reviews it at 5.1 before the pre-registration is frozen | the council at 5.1 finds the corpus too small to power the margin |
| D3 | product-owned | owner | Land as a new file rather than fold into the installed-layer roadmap | Operator instruction of 2026-10-12 to land this round's roadmaps; folding would make that file the largest active roadmap | the installed-layer file closes its Phases 1–2 before this file starts Phase 3 |
| D4 | reversible-technical | agent | The forms stay an internal enum after the keys go | The delivery experiment uses the modes as arms (`delivery_arm_experiment.ts`) | the experiment closes |
| D5 | reversible-technical | agent | Thinnable hosts stay `THINNABLE_HOSTS` (claude-code, cursor, cline); each needs its own observed row before 3.1 can thin it | Binding and effect are separate axes (`host-injection-effect.json` `_comment`) | — |
| D6 | product-owned | owner | Blocker `instruction-load-observer-has-no-scheduled-owner` → (a): this file schedules the `InstructionsLoaded` binding as steps 1.1–2.2, absorbing stub step 3.0 with its kill switch | owner answer 2026-10-15 to the PR #2373 report, the subject's eighth arrival | the kill switch fires, or the host drops the event |
| D7 | reversible-technical | agent | The arrival record is a set per session: reordered events are not `unknown`, lost start-up events are | The host documents `InstructionsLoaded` as asynchronous; parallel hooks reach disk in scheduler order; council openai seat, 2026-10-18 round 1, refused the order-sensitive form | the host starts delivering the event synchronously with a sequence number |
| D8 | reversible-technical | council:agents/evidence/council/hook-bundle-ceiling-20261018.md | The hook-bundle ceiling is not raised for 1.1 or 3.3: room is made first (per-module byte ranking, then the largest narrow-event module behind a conditional import, latency proven inside `hook-latency-budget.json`); a raise only as the evidence-backed fallback, sized from all blocked work | AI council 2026-10-18, `anthropic` + `openai`, prompt mode, one round, 2/2, $0.00, under the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen"); no sibling roadmap schedules a move out of the bundle | no extraction frees meaningful room within the latency and reliability budgets |
| D9 | reversible-technical | agent | 0.1's fixture is taken from a scratch-`HOME` global install, the only consumer scope (ADR-020). It excludes the install receipt, lock and log (each carries an install time), the scratch root (recorded as `<HOME>`) and the host's own version (a machine property, not a commit property) | Two full runs at `89e094819` compared byte-equal; at `d760ecbde` the same reader reproduces the step's 106 / 369,415 claude-code row | a field outside the exclusion set is found to vary between runs at one commit |

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
- [x] AC-2 — 3.1 returns `full` whenever any of its conditions fails, and for
  every consequence-class and safety-floor rule under every input.
- [ ] AC-3 — 5.2 reads non-inferior under D2, or consumers stay full and the
  record says why.
- [ ] AC-4 — `check_host_tree_parity` green at every step.
