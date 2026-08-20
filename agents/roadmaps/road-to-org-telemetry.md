---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to org telemetry

> Skill activation, distinct-user counts, and self-repair failure records flow from real consumer installs into one sink — consent-gated and content-free by default — so estate decisions run on measured data instead of a structurally blind zero.

## Goal

Replace the zero-activation reading in the usage report with a number that is either non-zero and sink-backed, or a published null establishing that real activation is genuinely near zero — and gate every byte of it behind recorded human consent.

## Outcome

> **Archived does not mean achieved.** This roadmap set out to replace a
> zero-activation reading with a measured number. It did not do that, and it
> could not: the number requires a sink and an enablement decision, and both
> are external acts. What it did do is remove every repository-side reason the
> number is unavailable, so that when the two external acts happen there is
> nothing left to build first.

Per phase, with the outcome vocabulary the drain-run framework requires
(`satisfied` · `narrowed` · `transferred` · `abandoned`). Nothing here is
`abandoned`.

| Phase | Outcome | What that means |
|---|---|---|
| **0 — Falsification spikes** | `satisfied` | Closed before this run. Three spikes, three written results, one of them a pre-registered FAIL that redirected the transport design. |
| **1 — Emission** | `satisfied` | Closed before this run. |
| **2 — Transport** | `narrowed` | The transport shipped and both properties Phase 0 deferred here are measured. The sink stand-up is `transferred`, so the phase exit criterion is half met: an outage is invisible to the session (tested against a blackhole), records appearing on a second machine is not claimed. |
| **3 — Consent** | `narrowed` | Its ADR, its disclosure concern and its security documentation were closed before this run. Routing the design through the data-protection process is `transferred` — and it gates enablement only, never the code, which is why steps 1-3 could close while step 4 could not. |
| **4 — Report** | `narrowed` | The second source shipped, and with it the path repair Phase 0 named a prerequisite: both scripts had been reading a retired directory, so the first source read nothing. The measurement steps are `transferred` — they need fourteen days of enablement. |
| **5 — Self-repair intake** | `narrowed` | The automatic Class-A shadow and the Class-B render-and-approve gate shipped. Two narrowings, both recorded at their step: the enumerated active-rule snapshot has no producer on a hook path, so the per-artefact attribution claim is unavailable; and the Class-B *store* is `transferred` while its repository-side half landed. |
| **6 — Aggregation** | `transferred` | The only phase where nothing shipped, which is the correct outcome rather than a shortfall: every step in it is defined over a record set that does not exist. |

**Acceptance criteria: three satisfied, two transferred.** AC1 (zero operations
when inactive) and AC2 (no Class-B content without a human reading the exact
text) are verified rather than asserted — thirteen not-opted-in shapes across
three writers, and a digest-bound approval. AC4 (a clone cannot phone home) is
measured against the shipped template, by a stricter mechanism than its own
wording names. AC5 (the undercount published as a number) was satisfied in
Phase 0 and this run repaired the collector's output path rather than retiring
it. AC3 is `transferred`: both of its branches need records to exist.

**The two transfers, and why neither is a parking lot.** Each carries the
three-point integrity check — the original criterion verbatim, the complete
list of moved steps, and a **named** producer with a probe measured failing on
the transfer date — plus something this run added because a telemetry sink is a
**standing egress** rather than a feature: a monitoring owner, a review date, a
rollback trigger set and a rollback procedure. The dissenting council seat
asked for exactly that (*"who operates it? SLA? monitoring?"*) and the
framework's output format had no slot for it. An egress with no named
off-switch would have been the wrong thing to leave behind.

- [`stubs/road-to-org-telemetry-sink.md`](stubs/road-to-org-telemetry-sink.md)
  — 1 gate, 4 moved items. Producer: the org repository administrator. **The
  pending act is itself Hard-Floor**, and the stub says so rather than
  inheriting the README's "crosses no Hard Floor" reading of a drain transfer.
- [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md)
  — 1 gate, 6 moved items. Producer: the named internal data-protection
  reviewer. Four of its items need the sink as well; both gates must clear.

**Twelve, now, is the count of steps in this roadmap whose `verify:`
annotation named a path that does not exist.** Phase 1 recorded the seventh,
Phase 3 the eighth and ninth and explicitly left Phase 5 step 2 for this run to
fix. This run found three more (`test_telemetry_transport`,
`test_self_repair_privacy`, and the `validate_evals` reference Phase 3 named),
re-pointed each at a suite that exists, and left `test_sink_clustering`
untouched on a transferred step. Twelve instances in one roadmap is a finding
about how these annotations are written, not about this roadmap.

**What a reader should NOT conclude from this file being closed.** That skill
activation has been measured. It has not. The usage report still reads zero
active, the second source still renders "no sink data", and the honest reading
of both is *no instrument* — which is what the report now says in as many
words, instead of rendering a zero.

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

- [x] Flush unsent records at session end as a batched outbound call per the second spike's result, with a timeout at or below one second, silent failure, and local retention for the next flush. **Landed as enqueue-at-write plus a detached sender** — `transport.ts` (spool derivation, spawn), `flush_sender.mjs` (the only outbound call in the tree), and the `telemetry-flush` `session_end` concern bound on the six platforms carrying that slot. The spike's result resolved this step to enqueue-only, and the spool is written by `append_class_a_record` in the same call that logs the record: a flush that worked out for itself which records were unsent would need a byte watermark into a log `enforce_retention` rewrites in place, and a watermark over a compacting file is a silent-corruption pair. **Both properties Phase 0 deferred to Phase 2 are now measured** (`org-telemetry-p2-transport.md`): a detached child survives `SIGKILL` of the spawning process group, and the queue is bounded because it shares the log's growth budget — at the observed 6.6 events/day a 90-day outage leaves ≈ 160 KiB. The sender is plain node so a detached child needs no `tsx` resolution at teardown, and it holds the only copy of the drain algorithm. Claim-by-rename, not read-then-truncate: the naive design reds three tests. **Step-text correction:** the `verify:` named `src/scripts/test_telemetry_transport`, which **does not exist** — tenth recorded instance of a step naming a measurement path that does not exist. Re-pointed at the real suite. <!-- verify: npx vitest run tests/scripts/telemetry_transport.test.ts -->
- [x] Declare a retention policy for the local record log and enforce it. Phase 1 ships an append-only file with no cap and no pruning, and `flush: never` endorses that as an indefinite steady state — one line per skill invocation, forever. The R2 review of Phase 1 raised it; it is a `scale-discipline` R-A7 growth-budget obligation and it is owed before the namespace is enabled anywhere broadly. **Landed as a TTL plus a byte backstop, enforced by the only writer** — `retention_due` / `enforce_retention` in `telemetry/remote.ts`, called from `append_class_a_record`, so there is no sweep a caller can forget to run. Defaults 90 days / 2 MiB, both measured rather than picked: `tool-result-census.jsonl` carries 24 `Skill` events over 3.62 days (6.6/day) and a Class-A line serialises to 248–286 bytes, so 90 days is ≈ 600 records ≈ 160 KiB and is the cap that actually binds; 2 MiB is the backstop for an unobserved rate. The hook passes the install's declared policy rather than the module defaults, and a test proves it fails when that wiring is dropped. <!-- verify: grep -q retention src/agent-src/templates/scripts/telemetry/remote.ts -->
- [-] Stand up the sink as a minimal append-only ingest with no read API in this phase. **Transferred** to [`stubs/road-to-org-telemetry-sink.md`](stubs/road-to-org-telemetry-sink.md) — disposition B, outcome `transferred`. Creating a repository is an org-admin act and a Hard-Floor action; the council's preference (a private repository) is recorded in the stub, and the parent may not record the creation as done. <!-- blocked-by: sink-choice -->

**Exit criteria:** records written on a second machine appear in the sink, and an endpoint outage is invisible to the session. **Second half MET** — an outage is invisible by construction and by test: the session spawns and returns, and a blackhole sink (the 1002 ms shape from spike 2) costs it nothing. **First half TRANSFERRED with the sink** — there is no sink for a second machine to reach, and this run does not claim otherwise.

**Rollback:** disable the flush flag; emission continues locally and nothing is lost.

## Phase 3 — Consent

- [x] Record an ADR introducing an org-pack provenance class alongside the existing human-chosen and auto-detected classes. It counts as recorded consent because a human org administrator made the choice; the machine still never grants itself permission, so the existing doctrine is preserved rather than bent. Auto-detected remains never-consent, verbatim. **Landed as ADR-233.** The mechanism that keeps the doctrine intact is a type asymmetry, not a check: the reader's `ConsentSource` gains `org-pack`, the CLI writer's `ProvenanceSource` deliberately does not, so `--source org-pack` is rejected like a typo and no agent-reachable path can stamp its own permission — asserted by a test that reads both unions off their sources. The grant is scoped to `telemetry.remote.*` rather than general, per Risk 6. **Two step-text corrections.** (1) The `verify:` below is a SILENT NO-OP as written: `regenerate_index` defaults to `--dir docs/adr/`, this repo keeps ADRs in `docs/decisions/`, and the script prints `adr-dir not found` and exits **0**. Re-pointed to the real directory; eighth recorded instance of a step naming a measurement path that does not exist. (2) The ADR does NOT classify the `telemetry.remote` keys, and cannot: `lint_settings_classes` check 2 requires every contract row to name a key the shipped template has, and Phase 1 deliberately keeps the namespace out of the template so a clone carries names without values. ADR-233 § D6 records the intended classification and the constraint instead — which leaves the org-pack branch reachable-by-design and unreached until those keys ship. <!-- verify: ./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions/ -->
- [x] Surface one visible disclosure line at first session start under an org-pack-enabled install, stating that the install reports pseudonymous usage data and to whom. **Landed as the `telemetry-disclosure` `session_start` concern**, bound on all seven platforms carrying the slot. "First session start" is implemented as once per `(org_id, endpoint)` pair with the note in `agents/runtime/state/telemetry-disclosure.json`, and it re-discloses when either changes — a new sink is a new fact, and a design that showed the line once and then silently followed the data elsewhere would be worse than one that never showed it. An unreadable state file reads as not-yet-disclosed, so the failure mode is a repeated line rather than a suppressed one. The line carries the org, the endpoint HOST only (never the full URL, which can hold a token), what is sent, what cannot be sent, and the local read path; it never carries the salt. Emission is asserted under the 1024-byte per-concern default, so no `hook-token-budget.json` row is owed, and `session_start_chain` runs the real dispatcher on all seven platforms at exit 0 under the composed context budget. **Step-text correction:** the `verify:` named `src/scripts/validate_evals`, which **does not exist** — `validate_evals_json` is a function inside `skill_linter.ts`, not a runnable script, so the check exits non-zero for the wrong reason. Ninth recorded instance of a step naming a measurement path that does not exist; Phase 5 step 2 carries the identical broken reference and is left for that phase to fix. Re-pointed to the concern's own suite. <!-- verify: npx vitest run tests/scripts/telemetry_disclosure_hook.test.ts -->
- [x] Add a security-documentation paragraph covering what ships, what never ships, the local inspection path for the emitted records, and that the default is off for everyone outside an org pack. **Landed as `SECURITY.md` § Telemetry**, covering all four required elements plus the consent provenance. The what-never-ships half is stated as the structural property it is — the record type has no field able to hold free-form content, so there is no scrubber to fail — rather than as a promise about filtering. The zero-file-operations claim is not asserted on trust: `tests/hooks/telemetry_usage_hook.test.ts` § "inactive installs write nothing" covers all four not-opted-in shapes including no settings file at all. <!-- verify: grep -q "telemetry" SECURITY.md -->
- [-] Route the design through the company data-protection process before any org-wide enablement. **Transferred** to [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md) — disposition B, outcome `transferred`. A written internal data-protection signature is categorically external; an agent may draft the submission but cannot be the reviewer. The two artefacts to review both exist in the tree and are named in the stub. <!-- blocked-by: dpo-signoff -->

**Exit criteria:** the ADR is indexed, and an enabled flag without a consent-bearing provenance record is treated as disabled by the dispatcher.

**Rollback:** the ADR is superseded and the gate fails closed by construction.

## Phase 4 — Report and the rationalization unblock

- [x] Add the sink as a second source to the usage report, with per-skill distinct-user counts wired to the existing threshold constant. **Landed, together with the path repair Phase 0 named a prerequisite.** Both scripts read and wrote `agents/metrics/`, a directory the agents/ taxonomy consolidation retired — the collector and the report agreed with each other and with nothing else. Repaired to `agents/runtime/metrics/`, which is where the data actually is and what `taskfiles/ci-fast.yml`'s own task descriptions already claimed. The sink lands as a separate SECTION rather than extra columns, because the two sources count different things over different populations; merging them would produce a row whose numbers come from two populations. Distinct users come from `user_hash` and the bar is imported from `DEFAULT_TIER_USAGE_RETIER.min_distinct_users` rather than restated, so the section and the re-tier cannot drift. Non-usage record classes are excluded so a Phase 5 defect report can never read as adoption. An absent sink renders a paragraph naming the path and the reason instead of nothing — a reader must be able to tell no instrument from a sink that answered zero, which is this roadmap's whole subject. **One hazard found and closed while doing it:** pointing the output at the tracked `agents/evidence/metrics/` baseline made every run in a checkout WITHOUT the gitignored record set overwrite that baseline with zeros — measured at 297 insertions / 339 deletions, every row reclassified `dead`. Output is the runtime copy; promotion to `evidence/` stays a deliberate act. <!-- verify: ./scripts-run src/scripts/skill_usage_report --help -->
- [-] Re-run the report after fourteen days of org enablement. Falsification criterion: at least three distinct users with at least one activation each. Below that, the hypothesis that colleagues actively use the package is examined before the pipeline is — and the null is published either way. **Transferred** to [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md); gated by the sink stub as well, since it needs records to exist. A null published without the sign-off would be an artefact of the missing approval rather than a finding about adoption — the blocker says so and it must not be published as an adoption result. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [-] Only after that criterion passes, hand the data to the rationalization sweep as its deciding input; that sweep already names usage data as its verdict source. **Transferred** to [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md) — it depends on the step above, which is itself transferred. The rationalization sweep therefore stays blocked on usage data, as it has been for the whole window. <!-- verify: grep -q "distinct_users" agents/evidence/metrics/skill-usage-report.md -->

**Exit criteria:** an estate decision cites sink-backed distinct-user numbers with provenance, or the null is published. **NEITHER — transferred.** No estate decision is claimed and no null is published: with no sink there is nothing to publish a null *about*, and a zero rendered from an absent instrument is the blind zero this roadmap exists to remove. The report says exactly that in its own second-source section.

**Rollback:** the report keeps its local source; the sink source is purely additive.

## Phase 5 — Self-repair intake over the wire

- [x] Emit the Class-A shadow automatically under org consent when the self-repair loop queues a record: failure class, active-context snapshot, host, version. No content. **Landed as `emitDefectShadow`**, called at the seam where `upsertFinding` has just returned a record, so nothing re-runs the detectors to learn whether anything was queued. `ClassADefectRecord` is a SEPARATE type rather than a widened `ClassARecord`, and that is the whole privacy argument: `DefectFinding` carries `evidence` (a quoted span of the offending text) and `suggested_surface` (a free sentence), those are the Class-B payload, and they are not passed to the builder at all — not sanitized, not truncated, not optional. The type therefore has no field able to hold project content and there is no scrubber to fail; the test asserts it over the written BYTES so a later field addition cannot slip content past an object-shaped assertion. A defect class outside the vocabulary pinned in `self_repair.ts` is dropped rather than recorded. **NARROWED, and the narrowing is the interesting part:** the enumerated active-rule / active-skill snapshot has **no producer on a hook path**. `match_prompt` needs the compiled router, which no hook in this tree loads and which is not established as present in a consumer install. `discipline_profile` is recorded instead — the knob that decides which rule surfaces load — and it is a profile-level snapshot, **not** the per-artefact attribution key. So the Context's stated use ("this rule was loaded in six of seven reports of this class" localizing an artefact) is **not** available from what ships, and the code says so rather than letting a field name imply it. **Step-text correction:** the `verify:` named `src/scripts/test_self_repair_privacy`, which **does not exist** — eleventh recorded instance. <!-- verify: npx vitest run tests/hooks/telemetry_self_repair.test.ts -->
- [x] Add the Class-B path: on queue creation, render the case into the existing symptom format, strip paths, identifiers, and code, show the result to the user, and ask for send approval in that turn — the Iron Law's "user's word this turn" becomes the anonymization review. Silent shipping of case content is permanently out of scope, not deferred. **Landed as `self_repair_class_b.ts`, built on the two primitives that already existed** rather than on new ones: `renderReport` IS the existing symptom format the step names, and `egressBlockedReason` IS the audited privacy floor — the same one the local corpus write already passes through. That floor **refuses rather than rewriting**, which is what makes it a gate; a module that silently scrubbed and shipped would be a soft gate wearing a hard gate's name. The approval is **digest-bound**: `approve` takes a SHA-256 of the rendered text, so an approval cannot carry over to a re-render — a third occurrence folding in changes the text and the old approval stops matching, which is the difference between approving a case and approving a category. No auto-approve, no safe-class allow-list, no timeout that approves by default. **Step-text correction:** the `verify:` named `src/scripts/validate_evals`, which **does not exist** — the identical broken reference Phase 3 recorded as its ninth instance and explicitly left for this phase to fix. Twelfth instance overall; fixed here as Phase 3 asked. <!-- verify: npx vitest run tests/scripts/self_repair_class_b.test.ts -->
- [-] Transport and store Class-B text as quoted, typed data, never concatenated into a downstream prompt as instruction. **Transferred** to [`stubs/road-to-org-telemetry-sink.md`](stubs/road-to-org-telemetry-sink.md) — the **store** half only, because there is nowhere to store it. Marked transferred rather than done deliberately: the repository-side half DID land with the step above (`case_text` is a named typed member, `serialiseCase` emits one JSON object so newlines survive as escapes rather than as line breaks that would let one case look like several records, and `assertNeverInterpolated` throws on a prompt-shaped use so the Phase 6 "taxonomy fields only" rule is a check rather than a convention), but the step says *store* and a box that claimed it would be overselling a sink that does not exist. <!-- verify: ./scripts-run src/scripts/lint_agent_security -->

**Exit criteria:** a provoked defect in a consumer session produces a Class-A record automatically and a Class-B record only after visible approval of the exact outbound text. **MET for the mechanism, NOT for the consumer session.** Both halves are asserted over real writes in tests — the automatic Class-A record and the refusal of a Class-B record whose digest was not approved. What is not claimed is the end-to-end provocation in a live consumer session: that needs an enabled install, which needs both transferred gates.

**Rollback:** the Class-B path sits behind the same setting; Class A reverts with Phase 1.

## Phase 6 — Aggregation and issues

- [-] Cluster sink-side on artefact and failure class, with a threshold of at least three distinct sessions aligned to the existing constant. At threshold, generate one deduplicated issue carrying Class-A statistics in the header and approved Class-B examples quoted as data blocks. **Transferred** to [`stubs/road-to-org-telemetry-sink.md`](stubs/road-to-org-telemetry-sink.md) — the step says sink-side and there is no sink. Building the clusterer here would produce a component whose only input is an empty file, and whose threshold could never be observed firing. <!-- verify: ./scripts-run src/scripts/test_sink_clustering -->
- [-] Apply a thirty-day falsification gate: if no cluster reaches threshold after thirty days of active telemetry, record the finding — detection too blunt, or a genuinely low defect rate, both of which are results — and do not build the generation step below. **Transferred** to [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md); needs the sink too. "Thirty days of active telemetry" is the clause that cannot be simulated: zero clusters from zero records is not a finding about the defect rate. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [-] Only after that gate passes, generate draft changes from a thresholded issue in maintainer context, reading the structured taxonomy fields and never Class-B free text, through neutral review and the standing quality floor. Automatic merging stays permanently out of scope: the change fixes a hypothesis, and the user-text-to-issue-to-change chain into a public repository is an injection channel that keeps a human on the final gate. **Transferred** to [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md) — the step's own first clause forbids building it before the gate above passes, and that gate is transferred. The one piece that could be built early was: `assertNeverInterpolated` exists so the "taxonomy fields only" constraint has a callable check when the generation step arrives. <!-- verify: ./scripts-run src/scripts/lint_agent_security -->

**Exit criteria:** one real cluster produces one issue with correct deduplication, and the falsification gate has a recorded outcome. **NEITHER — transferred in full.** Phase 6 is the only phase where nothing shipped, and that is the correct outcome rather than a shortfall: every step in it is defined over a record set that does not exist.

**Rollback:** the clustering is sink-side only; disabling it loses no data.

## Blockers

### blocker: sink-choice

- **Status:** resolved
- **Resolution (2026-08-20):** **transferred** — disposition B by AI council, quorum 2/2, recorded in [`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md). The council's *preference* is the private repository and it is recorded in the stub; creating it is an org-admin act and a Hard-Floor action, so the parent roadmap does not record it as done. Successor: [`stubs/road-to-org-telemetry-sink.md`](stubs/road-to-org-telemetry-sink.md), carrying the criterion verbatim, four moved items, a named producer (the org repository administrator) with a detection probe measured FAIL on every clause, and — because a telemetry sink is a standing egress — a monitoring owner, a 2026-11-20 review date, four rollback triggers and a two-step rollback procedure whose first step alone stops the egress.
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
- **Resolved when:** the sink and its location are named, and the identifier exists in the org pack rather than in this repository.

### blocker: dpo-signoff

- **Status:** resolved
- **Resolution (2026-08-20):** **transferred** — disposition B by AI council, quorum 2/2, recorded in [`drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md). A written internal data-protection signature is categorically external: an agent may draft the submission and cannot be the reviewer. Successor: [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md), carrying the criterion verbatim, six moved items, a named producer (the internal data-protection reviewer) with a probe measured FAIL, both artefacts-to-review located in the tree, and the same monitoring / review-date / rollback fields. It also names a real coverage gap rather than implying it is covered: no gate fails a build when a member is added to `ClassARecord` after a sign-off.
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
- **Resolved when:** a written internal sign-off exists and is referenced from the ADR.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

Re-reviewed 2026-08-20 at closure. Five rows moved because their mitigation
shipped or their scope changed; four are unchanged and are marked so rather
than silently re-dated. Rank order is unchanged: nothing that shipped made a
lower-ranked risk more dangerous than a higher-ranked one.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Class-B leaks project content | product | An abstraction miss ships a path or an identifier out of a consumer project. | **Mitigation shipped and hardened 2026-08-20.** The review gate is now digest-bound: `approve` takes a SHA-256 of the rendered text, so an approval cannot carry over to a re-render — approving a case is no longer approving a category. The privacy floor `egressBlockedReason` REFUSES rather than scrubbing, so a record whose evidence trips it produces no text to approve. No auto-approve, no safe-class allow-list, no default-approving timeout. Residual: the floor is pattern-based, so a novel identifier shape is still caught only by the human reading the text — which is why the human is the gate and the floor is not. | Phase 5 |
| 2 | The user-text-to-issue-to-change chain becomes an injection channel | product | A crafted complaint steers generated changes toward a public repository. | **Partly shipped 2026-08-20.** `case_text` is a named typed member and `serialiseCase` emits one JSON object, so newlines survive as escapes rather than as line breaks that could make one case look like several records. `assertNeverInterpolated` throws on a prompt-shaped use, so "taxonomy fields only" is a callable check rather than a convention. Residual, and it is real: that guard cannot stop a caller who never calls it, and the generation step it exists for is transferred — so the check has no consumer yet. | Phase 5, Phase 6 |
| 3 | A public repository that phones home reads as spyware | product | Any default-on path is judged by its perception, not its payload. | **Mitigation measured 2026-08-20, not just claimed.** `read_remote_settings` over the shipped template returns `active: false` with `missing: [endpoint, org_id, salt]`, and the template carries zero `telemetry:` keys — that absence IS the mechanism. Thirteen not-opted-in shapes across three writers assert zero file operations. Correction to the earlier wording: the enforcing mechanism is the four-field requirement, NOT a consent-bearing provenance check, which ADR-233 § D6 records as reachable-by-design and unreached. | Phase 3 |
| 4 | Hook latency regression | implementation | A session-end outbound call stalls sessions. | **Closed 2026-08-20.** The spike's pre-registered fallback is what shipped: the session spawns a detached sender and returns, so the blackhole case that cost an inline flush 1002 ms p95 costs the session a `stat` plus a spawn. Detached survival across teardown of the spawning process group is measured, not assumed. Residual: the 20.5 ms spawn cost is the number a future change must not regress, and nothing gates it. | Phase 0, Phase 2 |
| 5 | Complaint-phrase false positives flood the sink | implementation | Over-firing triggers form clusters on noise. | The three-distinct-session threshold gates issue creation; singles remain visible as counts only. | Phase 6 |
| 6 | The consent doctrine erodes | product | The org-pack class becomes a precedent for machine-granted permissions. | The ADR defines it narrowly as a human administrator's decision disclosed to the affected user, and restates that auto-detected stays never-consent verbatim. | Phase 3 |
| 7 | The telemetry confirms the zero | product | Real activation is genuinely near zero even with correct instrumentation. | That is a result rather than a failure: the null is published and effort redirects to the estate. | Phase 4 |
| 8 | The local record log grows without bound | implementation | Phase 1 ships an append-only file with no cap and no pruning — one line per skill invocation — and `flush: never` endorses that as an indefinite steady state. Raised by the Phase 1 completion review. **Scope widened 2026-08-20:** Phase 2 added a second append-only store, the outbound spool, and a sink that is down for days is exactly the case that grows it. | **Both stores bounded by the same policy, enforced by the same writer.** `append_class_a_record` bounds the log and the spool in one call, so there is no sweep a caller can forget and no second policy to drift. Measured: 400 records against a 4 KiB cap leave the spool at or under the cap with the newest record intact; at the observed 6.6 events/day a 90-day outage leaves ≈ 160 KiB. The cost is stated rather than hidden — an evicted unsent record is never sent. | Phase 2 |
| 9 | A host without a `Skill` tool reads as non-adoption | product | The capture concern is bound on six platforms but fires only on a `Skill` tool-use, a Claude-family surface. A zero from any other host means "no instrument", which is the blind-zero class this roadmap exists to remove, reproduced one layer up. **Second instance found 2026-08-20:** windsurf carries no `session_end` slot anywhere in the manifest, so an org running it spools records and never flushes them. | Every record carries `host`, so the denominator is reconstructable per host; the manifest entry states both caveats where a future reader of Phase 4 will meet them. Unbinding was rejected — it would convert a readable absence into a guaranteed one. The report now carries the same discipline in its own output: an absent sink renders "no instrument", never a zero. | Phase 4 |

## Acceptance Criteria

- [x] A disabled or consent-less install performs zero telemetry file operations and zero network calls, verified rather than assumed. **Verified across all three writers, on thirteen not-opted-in shapes**: the usage hook (4 shapes, each asserting the log does not exist), the flush concern (5 shapes, each asserting no process was started — a marker-file sender proves the negative rather than a mock), and the self-repair shadow (4 shapes, asserting no telemetry file appears in the project at all). The network half is structural: the only outbound call in the tree is `flush_sender.mjs`, and the only thing that spawns it short-circuits on `active`.
- [x] No Class-B content leaves a machine without the reporter having seen the exact outbound text. **Held two ways, and the weaker one is the one to distrust.** Strongly: `approve` is digest-bound, so a release refuses unless the approval names the exact bytes rendered, and the privacy floor refuses outright rather than scrubbing. Trivially: nothing leaves at all, since no sink exists. The second reading would make this criterion vacuous, so it is the first that is claimed — and it is the one asserted by test, including that no code path approves by default.
- [-] The usage report either cites one estate decision made on sink-backed distinct-user data, or publishes the null from the fourteen-day criterion. **Transferred** to [`stubs/road-to-org-telemetry-enablement.md`](stubs/road-to-org-telemetry-enablement.md), gated by the sink stub as well. Both branches need records: an estate decision needs data, and a null needs an instrument that ran and answered zero. This run has neither, and rendering the absence as a zero would reproduce the exact defect the roadmap was written to remove.
- [x] An external clone cannot phone home under any setting combination lacking a consent-bearing provenance record. **Measured against the shipped template, not reasoned about:** `read_remote_settings('src/config/agent-settings.template.yml')` returns `active: false` with `missing: [endpoint, org_id, salt]`, and the template carries **zero** `telemetry:` keys — that absence IS the mechanism. A nonexistent settings path returns the same verdict. **One honest qualification:** the enforcing mechanism is the four-field requirement, not a provenance-record check. ADR-233 § D6 already records why the org-pack provenance branch is reachable-by-design and unreached — `lint_settings_classes` requires a contract row to name a key the shipped template has, and the namespace is deliberately kept out of it. So the criterion holds, by a stricter mechanism than the one its wording names.
- [x] The regex collector's undercount is published as a number before any decision retires it. **Published in Phase 0 and unchanged: 0 of 89** invocations detected on the set the collector reads, against 163 of 164 across every worktree slug (`org-telemetry-s03.md`). No decision has retired the collector; this run repaired its dead output path instead, which is the opposite of retiring it.

## Provenance

- Source: an external analysis session over this repository, 2026-08-13, on the gap between reported in-company users and the zero-activation report. Pinned at `d83186c` there; every claim re-verified at `6d18f5bb2` for this file, and the Context table records the outcome of that re-verification.
- Raw session material stays local and untracked at `agents/tmp.old/org-telemetry.txt`.
- Council: not convened. The two contested items are carried as structured blockers.
