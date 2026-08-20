---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to org telemetry

> Skill activation, distinct-user counts, and self-repair failure records flow from real consumer installs into one sink — consent-gated and content-free by default — so estate decisions run on measured data instead of a structurally blind zero.

## Goal

Replace the zero-activation reading in the usage report with a number that is either non-zero and sink-backed, or a published null establishing that real activation is genuinely near zero — and gate every byte of it behind recorded human consent.

## Prerequisites

- [x] Read `docs/contracts/hook-architecture-v1.md` and `src/rules/self-repair-loop.md`
- [x] Read `src/agent-src/templates/scripts/telemetry/settings.ts` and `src/shared/settingsConsent.ts`
- [x] Re-verify every path in Context against branch HEAD before executing a phase — all five Context claims re-verified at `851568b5c` for Phase 0; see the note below the table

## Context

Source: an external analysis session over this repository, 2026-08-13, pinned at `d83186c`. That pin is 479 commits behind the branch base — the largest gap of any plan carried in this pass — so every claim was re-verified at `6d18f5bb2`. The striking result is that none of them moved: the instrumentation gap is exactly as it was.

**Re-verified at `6d18f5bb2`:**

| Claim | Status | Evidence |
|---|---|---|
| The usage report reads 337 tracked, 0 active, 181 exposed-only, 156 dead | still true — byte-identical after 479 commits | `agents/evidence/metrics/skill-usage-report.md` |
| The collector roots its output at this repository and reads only this repository's session slug, so consumer sessions are invisible by construction | still true | `src/scripts/skill_usage_collect.ts` |
| The only trigger is a local quality-pipeline task, i.e. it runs on the maintainer's machine | still true (the task moved line but not existence) | `taskfiles/ci-fast.yml` |
| No transport exists: every record stays on the machine that wrote it | still true — zero hits for outbound calls across the telemetry surface | negative grep, 2026-08-17 |
| No remote telemetry namespace exists in the settings template | still true | negative grep, 2026-08-17 |

**Re-verified again at `851568b5c` (2026-08-18, before executing Phase 0).** All five rows still hold: the report header is still byte-identical; the collector still derives its slug from `REPO`; the trigger is still `taskfiles/ci-fast.yml:243`+`:252`; the telemetry surface still has zero outbound calls; and the 1,405-line settings template still carries no `telemetry:` namespace (two prose mentions only, neither a key). Phase 0 then found one claim **understated** and one path **broken** — both in `org-telemetry-s03.md`: the zero is not merely blind to invocation, it is uncorrelated with it, and the path both scripts read (`agents/metrics/skill-usage.jsonl`) does not exist while the data sits at `agents/runtime/metrics/`.

The zero is therefore an instrumentation artifact, not an adoption measurement. Estate decisions currently waiting on usage data — the skill rationalization sweep foremost — are blocked on this gap and have been for the whole 479-commit window.

**What already exists and is reused rather than rebuilt.** The hook dispatcher runs in every consumer install and already receives all events. The settings surface has a tolerant reader whose doctrine is that anything unparseable means disabled. A distinct-user threshold constant already exists in the tier-usage defaults. Consent provenance already distinguishes a human-chosen value from a machine-inferred one, with the standing doctrine that an auto-detected value never grants consent. The self-repair loop already queues user-reported and detector-found defects, with the Iron Law that the outward step needs the user's word in the same turn.

**Payload classes.** Class A is metadata — failure or usage class, the active rule and skill snapshot, host, package version, a pseudonymous user hash, a session hash, and a timestamp. It is the package describing itself, carries zero bytes of project content, and ships automatically under recorded consent. Class A is also the attribution key: a complaint localizes a session, but only "this rule was loaded in six of seven reports of this class" localizes an artefact. Class B is an abstracted case — expected versus actual behaviour and the artefacts involved, with no paths, identifiers, code, or prompt content — and ships only on explicit per-case approval.

## Phase 0 — Falsification spikes

- [x] Confirm the tool-event payload delivered to the dispatcher carries enough identity to name an invoked skill. If it does not, the design falls back to a transcript scan at session end and the per-invocation precision claim is withdrawn rather than weakened. **PASS** — `tool_name: "Skill"` on 22 live `post_tool_use` records out of 14,171, and `input.skill` present in 164/164 real invocations. The fallback branch does not fire. <!-- verify: test -f agents/evidence/eval-findings/org-telemetry-s01.md -->
- [x] Measure a fire-and-forget outbound call from a session-end hook against a stub endpoint. Pass condition: added latency at or below one second at p95, silent on failure, no session block. Failure moves transport to a detached spool process with session end only enqueuing. **FAIL for the inline flush — the pre-registered fallback fires.** Healthy 0.4 ms p95, refused 0.3 ms, but a blackhole costs 1002 ms p95 against a 1000 ms bar; the detached spool reads 20.5 ms against the same blackhole. <!-- verify: test -f agents/evidence/eval-findings/org-telemetry-s02.md -->
- [x] Run the existing regex collector and an event-based emitter over the same session set and record the delta as the published undercount of the current method. **PUBLISHED: 0 of 89** invocations detected on the set the collector reads; 163 of 164 across every worktree slug. <!-- verify: test -f agents/evidence/eval-findings/org-telemetry-s03.md -->

**Exit criteria:** all three spikes have a written pass or fail with numbers under `agents/evidence/eval-findings/`. **Met** — `org-telemetry-s01.md`, `-s02.md`, `-s03.md`, all three at tree `851568b5c`.

**Rollback:** spikes are scratch-only; nothing ships.

### What Phase 0 changed for the phases behind it

Recorded here so nobody re-derives it from the findings files.

- **Phase 1 keeps its event and gains one requirement.** The confirmed event is
  `post_tool_use` with `tool_name == "Skill"`, name from `tool_input.skill`. But
  the host sends the *same* skill under two spellings — `roadmap:process-full`
  (64) and `roadmap-process-full` (22), likewise `roadmap:ai-council` — so the
  emitter must normalise before writing, or per-skill counts split and the
  busiest skills undercount by roughly a quarter. Normalising in the report
  instead would leave the raw records ambiguous.
- **Phase 2 resolves to enqueue-only.** Its step already reads "per the second
  spike's result", and that result is: session end appends to a local queue and
  spawns a detached sender. 20.5 ms p95 is the number not to regress. Two
  properties the spike did **not** measure and Phase 2 must: whether a detached
  child survives host teardown of the session process group, and the queue's
  growth bound across a multi-day outage.
- **Phase 4 inherits a broken first source.** Both scripts read
  `agents/metrics/skill-usage.jsonl`; that path does not exist, while the data
  sits at `agents/runtime/metrics/skill-usage.jsonl` (gitignored, last written
  2026-05-16 — the path the report's own emitted prose still names). Adding the
  sink as a *second* source lands beside a first source that reads nothing, so
  the path repair is a Phase 4 prerequisite rather than a nicety.
- **Neither blocker moved, and neither had to.** `sink-choice` blocks Phase 2 and
  `dpo-signoff` blocks Phase 3 onward; both say in as many words that Phase 0
  runs in full without them. It did.

## Phase 1 — Emission in the dispatcher

- [x] Add a remote telemetry namespace beside the existing engagement namespace in the settings template, defaulting to disabled, with an endpoint, an org identifier, and a session-end flush policy; extend the tolerant reader with the same default-off semantics. **Landed as `telemetry.remote`** — `read_remote_settings` in `telemetry/settings.ts`, documented in `agent-settings.md` beside `artifact_engagement`. `enabled: true` alone is deliberately NOT the switch; see the note below. <!-- verify: npx vitest run tests/scripts/templates_telemetry_remote.test.ts -->
- [x] Append Class-A usage records in the consumer project on the tool event confirmed by the first spike, with a schema aligned to the existing records plus user hash, package version, host, and active tier. Perform zero file operations when disabled. **Landed as the `telemetry-usage` PostToolUse concern**, bound on all six platforms carrying `post_tool_use`, `tools: [Skill]`. Active tier reads `rule_loading_tier`; an unresolvable version or tier records `null` rather than a guess. <!-- verify: npx vitest run tests/hooks/telemetry_usage_hook.test.ts -->
- [x] Derive the user hash as a salted hash of hostname and user, with the salt living in the org pack rather than the public repository. No prompt content anywhere in Class A. **Landed in `telemetry/remote.ts`** — `derive_user_hash` refuses an empty salt outright, and the settings reader will not activate without one. <!-- verify: npx vitest run tests/scripts/templates_telemetry_remote.test.ts -->

**Exit criteria:** an enabled install writes records for real invocations; a disabled install performs zero file operations, matching the doctrine the engagement telemetry already follows. **Met** — both halves asserted in `tests/hooks/telemetry_usage_hook.test.ts`, the disabled half across four not-fully-opted-in shapes, each asserting the log file does not exist.

**Rollback:** the namespace defaults off; removing the dispatch branch restores current behaviour exactly.

### What Phase 1 settled, and one place the step text was imprecise

- **"The settings template" is two files, and the shipped YAML deliberately
  carries no `telemetry:` key at all.** `src/config/agent-settings.template.yml`
  has none — that absence IS the default-off mechanism, and
  `agent-settings.md` line 636 already says so in as many words ("Not in the
  shipped template — a missing `telemetry:` section means disabled"). So the
  namespace was added where the engagement one actually lives: the documented
  example block and the key table in `agent-settings.md`. Adding live keys to
  the shipped YAML would have contradicted the doctrine the step asked to
  match.
- **`enabled: true` is not the switch, and that is a deliberate strengthening
  of what the step asked for.** `active` requires `enabled` AND an `endpoint`
  AND an `org_id` AND a `salt`, none of which has a default. The reason is
  acceptance criterion 4: this repository is public, so it must ship the key
  names and no values. A clone cannot reach the write path by copying the
  documented block. `missing` names which field is absent so a future doctor
  command can explain an inactive install without printing the salt.
- **The salt is load-bearing, not decoration.** An unsalted digest of a login
  name is dictionary-reversible in seconds, so `derive_user_hash` throws on an
  empty salt rather than producing one. Hash parts join on NUL — a username
  may contain a space, so a space join would let `("a b", "c")` and
  `("a", "b c")` collide.
- **Phase 0's normalisation requirement is enforced at write time**, as its
  note demanded. The collapse direction is `:` → `-` because that mapping is
  total; the reverse is undecidable without carrying the command catalogue
  into the hot path (`brand-asset-generation` has no cluster). Asserted on
  both spellings of `roadmap:process-full`.
- **Two `verify:` annotations named scripts that do not exist.**
  `src/scripts/test_telemetry_settings` is absent from the tree, and
  `grep -q user_hash …/settings.ts` would have failed because the hash lives
  in `remote.ts` (schema + derivation) rather than in the settings reader —
  the same split `engagement.ts` and `settings.ts` already use. Both
  re-pointed at the real tests. Seventh recorded instance of a step naming a
  measurement path that does not exist.
- **No outbound call ships here.** Both blockers stand: `sink-choice` gates
  Phase 2's transport and `dpo-signoff` gates Phase 3's enablement. The
  concern appends to a local JSONL file and stops.

## Phase 2 — Transport

- [ ] Flush unsent records at session end as a batched outbound call per the second spike's result, with a timeout at or below one second, silent failure, and local retention for the next flush. <!-- verify: ./scripts-run src/scripts/test_telemetry_transport -->
- [x] Declare a retention policy for the local record log and enforce it. Phase 1 ships an append-only file with no cap and no pruning, and `flush: never` endorses that as an indefinite steady state — one line per skill invocation, forever. The R2 review of Phase 1 raised it; it is a `scale-discipline` R-A7 growth-budget obligation and it is owed before the namespace is enabled anywhere broadly. **Landed as a TTL plus a byte backstop, enforced by the only writer** — `retention_due` / `enforce_retention` in `telemetry/remote.ts`, called from `append_class_a_record`, so there is no sweep a caller can forget to run. Defaults 90 days / 2 MiB, both measured rather than picked: `tool-result-census.jsonl` carries 24 `Skill` events over 3.62 days (6.6/day) and a Class-A line serialises to 248–286 bytes, so 90 days is ≈ 600 records ≈ 160 KiB and is the cap that actually binds; 2 MiB is the backstop for an unobserved rate. The hook passes the install's declared policy rather than the module defaults, and a test proves it fails when that wiring is dropped. <!-- verify: grep -q retention src/agent-src/templates/scripts/telemetry/remote.ts -->
- [ ] Stand up the sink as a minimal append-only ingest with no read API in this phase. <!-- blocked-by: sink-choice -->

**Exit criteria:** records written on a second machine appear in the sink, and an endpoint outage is invisible to the session.

**Rollback:** disable the flush flag; emission continues locally and nothing is lost.

## Phase 3 — Consent

- [x] Record an ADR introducing an org-pack provenance class alongside the existing human-chosen and auto-detected classes. It counts as recorded consent because a human org administrator made the choice; the machine still never grants itself permission, so the existing doctrine is preserved rather than bent. Auto-detected remains never-consent, verbatim. **Landed as ADR-233.** The mechanism that keeps the doctrine intact is a type asymmetry, not a check: the reader's `ConsentSource` gains `org-pack`, the CLI writer's `ProvenanceSource` deliberately does not, so `--source org-pack` is rejected like a typo and no agent-reachable path can stamp its own permission — asserted by a test that reads both unions off their sources. The grant is scoped to `telemetry.remote.*` rather than general, per Risk 6. **Two step-text corrections.** (1) The `verify:` below is a SILENT NO-OP as written: `regenerate_index` defaults to `--dir docs/adr/`, this repo keeps ADRs in `docs/decisions/`, and the script prints `adr-dir not found` and exits **0**. Re-pointed to the real directory; eighth recorded instance of a step naming a measurement path that does not exist. (2) The ADR does NOT classify the `telemetry.remote` keys, and cannot: `lint_settings_classes` check 2 requires every contract row to name a key the shipped template has, and Phase 1 deliberately keeps the namespace out of the template so a clone carries names without values. ADR-233 § D6 records the intended classification and the constraint instead — which leaves the org-pack branch reachable-by-design and unreached until those keys ship. <!-- verify: ./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions/ -->
- [x] Surface one visible disclosure line at first session start under an org-pack-enabled install, stating that the install reports pseudonymous usage data and to whom. **Landed as the `telemetry-disclosure` `session_start` concern**, bound on all seven platforms carrying the slot. "First session start" is implemented as once per `(org_id, endpoint)` pair with the note in `agents/runtime/state/telemetry-disclosure.json`, and it re-discloses when either changes — a new sink is a new fact, and a design that showed the line once and then silently followed the data elsewhere would be worse than one that never showed it. An unreadable state file reads as not-yet-disclosed, so the failure mode is a repeated line rather than a suppressed one. The line carries the org, the endpoint HOST only (never the full URL, which can hold a token), what is sent, what cannot be sent, and the local read path; it never carries the salt. Emission is asserted under the 1024-byte per-concern default, so no `hook-token-budget.json` row is owed, and `session_start_chain` runs the real dispatcher on all seven platforms at exit 0 under the composed context budget. **Step-text correction:** the `verify:` named `src/scripts/validate_evals`, which **does not exist** — `validate_evals_json` is a function inside `skill_linter.ts`, not a runnable script, so the check exits non-zero for the wrong reason. Ninth recorded instance of a step naming a measurement path that does not exist; Phase 5 step 2 carries the identical broken reference and is left for that phase to fix. Re-pointed to the concern's own suite. <!-- verify: npx vitest run tests/scripts/telemetry_disclosure_hook.test.ts -->
- [x] Add a security-documentation paragraph covering what ships, what never ships, the local inspection path for the emitted records, and that the default is off for everyone outside an org pack. **Landed as `SECURITY.md` § Telemetry**, covering all four required elements plus the consent provenance. The what-never-ships half is stated as the structural property it is — the record type has no field able to hold free-form content, so there is no scrubber to fail — rather than as a promise about filtering. The zero-file-operations claim is not asserted on trust: `tests/hooks/telemetry_usage_hook.test.ts` § "inactive installs write nothing" covers all four not-opted-in shapes including no settings file at all. <!-- verify: grep -q "telemetry" SECURITY.md -->
- [ ] Route the design through the company data-protection process before any org-wide enablement. <!-- blocked-by: dpo-signoff -->

**Exit criteria:** the ADR is indexed, and an enabled flag without a consent-bearing provenance record is treated as disabled by the dispatcher.

**Rollback:** the ADR is superseded and the gate fails closed by construction.

## Phase 4 — Report and the rationalization unblock

- [ ] Add the sink as a second source to the usage report, with per-skill distinct-user counts wired to the existing threshold constant. <!-- verify: ./scripts-run src/scripts/skill_usage_report --help -->
- [ ] Re-run the report after fourteen days of org enablement. Falsification criterion: at least three distinct users with at least one activation each. Below that, the hypothesis that colleagues actively use the package is examined before the pipeline is — and the null is published either way. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] Only after that criterion passes, hand the data to the rationalization sweep as its deciding input; that sweep already names usage data as its verdict source. <!-- verify: grep -q "distinct_users" agents/evidence/metrics/skill-usage-report.md -->

**Exit criteria:** an estate decision cites sink-backed distinct-user numbers with provenance, or the null is published.

**Rollback:** the report keeps its local source; the sink source is purely additive.

## Phase 5 — Self-repair intake over the wire

- [ ] Emit the Class-A shadow automatically under org consent when the self-repair loop queues a record: failure class, active-context snapshot, host, version. No content. <!-- verify: ./scripts-run src/scripts/test_self_repair_privacy -->
- [ ] Add the Class-B path: on queue creation, render the case into the existing symptom format, strip paths, identifiers, and code, show the result to the user, and ask for send approval in that turn — the Iron Law's "user's word this turn" becomes the anonymization review. Silent shipping of case content is permanently out of scope, not deferred. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Transport and store Class-B text as quoted, typed data, never concatenated into a downstream prompt as instruction. <!-- verify: ./scripts-run src/scripts/lint_agent_security -->

**Exit criteria:** a provoked defect in a consumer session produces a Class-A record automatically and a Class-B record only after visible approval of the exact outbound text.

**Rollback:** the Class-B path sits behind the same setting; Class A reverts with Phase 1.

## Phase 6 — Aggregation and issues

- [ ] Cluster sink-side on artefact and failure class, with a threshold of at least three distinct sessions aligned to the existing constant. At threshold, generate one deduplicated issue carrying Class-A statistics in the header and approved Class-B examples quoted as data blocks. <!-- verify: ./scripts-run src/scripts/test_sink_clustering -->
- [ ] Apply a thirty-day falsification gate: if no cluster reaches threshold after thirty days of active telemetry, record the finding — detection too blunt, or a genuinely low defect rate, both of which are results — and do not build the generation step below. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] Only after that gate passes, generate draft changes from a thresholded issue in maintainer context, reading the structured taxonomy fields and never Class-B free text, through neutral review and the standing quality floor. Automatic merging stays permanently out of scope: the change fixes a hypothesis, and the user-text-to-issue-to-change chain into a public repository is an injection channel that keeps a human on the final gate. <!-- verify: ./scripts-run src/scripts/lint_agent_security -->

**Exit criteria:** one real cluster produces one issue with correct deduplication, and the falsification gate has a recorded outcome.

**Rollback:** the clustering is sink-side only; disabling it loses no data.

## Blockers

### blocker: sink-choice

- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 2 (sink stand-up)
- **Question:** Should the sink be a minimal ingest endpoint, or a private repository used as an append-only store?
- **Recommendation:** the private repository. The volume is small, the write path is an existing authenticated primitive rather than new infrastructure to operate, and the Phase 6 clustering runs offline over the file set. An ingest endpoint is the better answer only if the volume outgrows a repository, which the current zero makes unlikely in the measurement window this roadmap needs.
- **If you do nothing:** Phases 0 and 1 still run in full — the spikes and the local emission need no sink. The plan stalls at the first outbound flush, which is also the first point at which any data would leave a machine, so the cost of the delay is bounded and the privacy posture is unaffected.
- **What to do:**
  1. Pick one: a private repository (name it), or an ingest endpoint (name where it would run).
  2. For the repository option, create it and record its identifier in the org pack settings — no public repository, and no repository this package's CI can reach.
  3. For the endpoint option, name the runtime and who operates it; the operational burden is the deciding factor, not the code.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. The
  rendered default (the private repository) is the conservative choice and is recorded
  as the PREFERRED CHOICE, but *creating* that repository is repository creation — the
  first item in Rule 3's categorical list
  ([drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)),
  so it takes `B`, never `D`. Batch A carries the three-point check verbatim: original
  criterion, Phase 2 sink stand-up and all sink-dependent steps moved, re-entry producer
  the org repository administrator, probe a private package-CI-inaccessible identifier
  resolving in org-pack settings.
- **Resolved when:** the sink and its location are named, and the identifier exists in the org pack rather than in this repository.

### blocker: dpo-signoff

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 3 (org-wide enablement onward)
- **Question:** Does the company data-protection process approve the Class-A field list and the disclosure text?
- **Recommendation:** run it as a written review of exactly two artefacts — the Class-A field list from Phase 1 and the one-line disclosure from Phase 3 — rather than of the roadmap. The design was built to make this review short: no content fields exist to argue about, and the pseudonymous hash is salted outside the public repository.
- **If you do nothing:** every phase through 2 still runs, and a single-machine enablement remains legitimate for testing. Only enablement across colleagues waits. The measurement in Phase 4 needs at least three distinct users, so the null it publishes without this sign-off would be an artifact of the missing approval rather than a finding about adoption — which is worth knowing before reading that number.
- **What to do:**
  1. Take the Class-A field list from the Phase 1 step and the disclosure line from Phase 3.
  2. Submit both through the internal data-protection review, noting explicitly that no project content, path, identifier, or prompt text is transmitted in that class.
  3. Record the written outcome; the agent can draft the submission text on request.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. A
  written internal data-protection signature is categorically external, so Rule 3 in
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  assigns it `B` and forbids the parent recording the action as done. The rendered
  default — run the review over exactly two artefacts rather than the whole roadmap —
  narrows the ASK and stands as the preferred choice inside the transfer; it does not
  supply the signature. Batch A carries the three-point check verbatim: original
  criterion, Phase 3 org-wide enablement and every downstream rollout step moved,
  re-entry producer the named internal DPO reviewer with the ADR link as the probe.
  Nothing here lowers the privacy floor: the sign-off is still required.
- **Resolved when:** a written internal sign-off exists and is referenced from the ADR.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Class-B leaks project content | product | An abstraction miss ships a path or an identifier out of a consumer project. | Per-case human review of the exact outbound text is the gate rather than a filter heuristic; the symptom template carries no content fields; silent shipping is permanently out of scope. | Phase 5 |
| 2 | The user-text-to-issue-to-change chain becomes an injection channel | product | A crafted complaint steers generated changes toward a public repository. | Class-B is quarantined as data end to end, the generation step reads taxonomy fields only, and the human gate on the final step is permanent. | Phase 5, Phase 6 |
| 3 | A public repository that phones home reads as spyware | product | Any default-on path is judged by its perception, not its payload. | Default-off everywhere, a consent-bearing provenance record required, the security documentation states how to verify it, and an acceptance criterion pins the posture. | Phase 3 |
| 4 | Hook latency regression | implementation | A session-end outbound call stalls sessions. | The second spike measures before anything ships; the fallback is a spool with a detached sender. | Phase 0 |
| 5 | Complaint-phrase false positives flood the sink | implementation | Over-firing triggers form clusters on noise. | The three-distinct-session threshold gates issue creation; singles remain visible as counts only. | Phase 6 |
| 6 | The consent doctrine erodes | product | The org-pack class becomes a precedent for machine-granted permissions. | The ADR defines it narrowly as a human administrator's decision disclosed to the affected user, and restates that auto-detected stays never-consent verbatim. | Phase 3 |
| 7 | The telemetry confirms the zero | product | Real activation is genuinely near zero even with correct instrumentation. | That is a result rather than a failure: the null is published and effort redirects to the estate. | Phase 4 |
| 8 | The local record log grows without bound | implementation | Phase 1 ships an append-only file with no cap and no pruning — one line per skill invocation — and `flush: never` endorses that as an indefinite steady state. Raised by the Phase 1 completion review. | A retention policy is a Phase 2 step with the `scale-discipline` R-A7 growth-budget obligation named, and the `flush` documentation states the unbounded case rather than leaving an operator to discover it. | Phase 2 |
| 9 | A host without a `Skill` tool reads as non-adoption | product | The capture concern is bound on six platforms but fires only on a `Skill` tool-use, a Claude-family surface. A zero from any other host means "no instrument", which is the blind-zero class this roadmap exists to remove, reproduced one layer up. | Every record carries `host`, so the denominator is reconstructable per host; the manifest entry states the caveat where a future reader of Phase 4 will meet it. Unbinding was rejected — it would convert a readable absence into a guaranteed one. | Phase 4 |

## Acceptance Criteria

- [ ] A disabled or consent-less install performs zero telemetry file operations and zero network calls, verified rather than assumed.
- [ ] No Class-B content leaves a machine without the reporter having seen the exact outbound text.
- [ ] The usage report either cites one estate decision made on sink-backed distinct-user data, or publishes the null from the fourteen-day criterion.
- [ ] An external clone cannot phone home under any setting combination lacking a consent-bearing provenance record.
- [ ] The regex collector's undercount is published as a number before any decision retires it.

## Provenance

- Source: an external analysis session over this repository, 2026-08-13, on the gap between reported in-company users and the zero-activation report. Pinned at `d83186c` there; every claim re-verified at `6d18f5bb2` for this file, and the Context table records the outcome of that re-verification.
- Raw session material stays local and untracked at `agents/tmp.old/org-telemetry.txt`.
- Council: not convened. The two contested items are carried as structured blockers.
