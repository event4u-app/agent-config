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

- [ ] Read `docs/contracts/hook-architecture-v1.md` and `src/rules/self-repair-loop.md`
- [ ] Read `src/agent-src/templates/scripts/telemetry/settings.ts` and `src/shared/settingsConsent.ts`
- [ ] Re-verify every path in Context against branch HEAD before executing a phase

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

The zero is therefore an instrumentation artifact, not an adoption measurement. Estate decisions currently waiting on usage data — the skill rationalization sweep foremost — are blocked on this gap and have been for the whole 479-commit window.

**What already exists and is reused rather than rebuilt.** The hook dispatcher runs in every consumer install and already receives all events. The settings surface has a tolerant reader whose doctrine is that anything unparseable means disabled. A distinct-user threshold constant already exists in the tier-usage defaults. Consent provenance already distinguishes a human-chosen value from a machine-inferred one, with the standing doctrine that an auto-detected value never grants consent. The self-repair loop already queues user-reported and detector-found defects, with the Iron Law that the outward step needs the user's word in the same turn.

**Payload classes.** Class A is metadata — failure or usage class, the active rule and skill snapshot, host, package version, a pseudonymous user hash, a session hash, and a timestamp. It is the package describing itself, carries zero bytes of project content, and ships automatically under recorded consent. Class A is also the attribution key: a complaint localizes a session, but only "this rule was loaded in six of seven reports of this class" localizes an artefact. Class B is an abstracted case — expected versus actual behaviour and the artefacts involved, with no paths, identifiers, code, or prompt content — and ships only on explicit per-case approval.

## Phase 0 — Falsification spikes

- [ ] Confirm the tool-event payload delivered to the dispatcher carries enough identity to name an invoked skill. If it does not, the design falls back to a transcript scan at session end and the per-invocation precision claim is withdrawn rather than weakened. <!-- verify: test -f agents/evidence/eval-findings/org-telemetry-s01.md -->
- [ ] Measure a fire-and-forget outbound call from a session-end hook against a stub endpoint. Pass condition: added latency at or below one second at p95, silent on failure, no session block. Failure moves transport to a detached spool process with session end only enqueuing. <!-- verify: test -f agents/evidence/eval-findings/org-telemetry-s02.md -->
- [ ] Run the existing regex collector and an event-based emitter over the same session set and record the delta as the published undercount of the current method. <!-- verify: test -f agents/evidence/eval-findings/org-telemetry-s03.md -->

**Exit criteria:** all three spikes have a written pass or fail with numbers under `agents/evidence/eval-findings/`.

**Rollback:** spikes are scratch-only; nothing ships.

## Phase 1 — Emission in the dispatcher

- [ ] Add a remote telemetry namespace beside the existing engagement namespace in the settings template, defaulting to disabled, with an endpoint, an org identifier, and a session-end flush policy; extend the tolerant reader with the same default-off semantics. <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [ ] Append Class-A usage records in the consumer project on the tool event confirmed by the first spike, with a schema aligned to the existing records plus user hash, package version, host, and active tier. Perform zero file operations when disabled. <!-- verify: ./scripts-run src/scripts/test_telemetry_settings -->
- [ ] Derive the user hash as a salted hash of hostname and user, with the salt living in the org pack rather than the public repository. No prompt content anywhere in Class A. <!-- verify: grep -q user_hash src/agent-src/templates/scripts/telemetry/settings.ts -->

**Exit criteria:** an enabled install writes records for real invocations; a disabled install performs zero file operations, matching the doctrine the engagement telemetry already follows.

**Rollback:** the namespace defaults off; removing the dispatch branch restores current behaviour exactly.

## Phase 2 — Transport

- [ ] Flush unsent records at session end as a batched outbound call per the second spike's result, with a timeout at or below one second, silent failure, and local retention for the next flush. <!-- verify: ./scripts-run src/scripts/test_telemetry_transport -->
- [ ] Stand up the sink as a minimal append-only ingest with no read API in this phase. <!-- blocked-by: sink-choice -->

**Exit criteria:** records written on a second machine appear in the sink, and an endpoint outage is invisible to the session.

**Rollback:** disable the flush flag; emission continues locally and nothing is lost.

## Phase 3 — Consent

- [ ] Record an ADR introducing an org-pack provenance class alongside the existing human-chosen and auto-detected classes. It counts as recorded consent because a human org administrator made the choice; the machine still never grants itself permission, so the existing doctrine is preserved rather than bent. Auto-detected remains never-consent, verbatim. <!-- verify: ./scripts-run src/scripts/adr/regenerate_index -->
- [ ] Surface one visible disclosure line at first session start under an org-pack-enabled install, stating that the install reports pseudonymous usage data and to whom. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Add a security-documentation paragraph covering what ships, what never ships, the local inspection path for the emitted records, and that the default is off for everyone outside an org pack. <!-- verify: grep -q "telemetry" SECURITY.md -->
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

- **Status:** open
- **Owner:** user
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

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Class-B leaks project content | product | An abstraction miss ships a path or an identifier out of a consumer project. | Per-case human review of the exact outbound text is the gate rather than a filter heuristic; the symptom template carries no content fields; silent shipping is permanently out of scope. | Phase 5 |
| 2 | The user-text-to-issue-to-change chain becomes an injection channel | product | A crafted complaint steers generated changes toward a public repository. | Class-B is quarantined as data end to end, the generation step reads taxonomy fields only, and the human gate on the final step is permanent. | Phase 5, Phase 6 |
| 3 | A public repository that phones home reads as spyware | product | Any default-on path is judged by its perception, not its payload. | Default-off everywhere, a consent-bearing provenance record required, the security documentation states how to verify it, and an acceptance criterion pins the posture. | Phase 3 |
| 4 | Hook latency regression | implementation | A session-end outbound call stalls sessions. | The second spike measures before anything ships; the fallback is a spool with a detached sender. | Phase 0 |
| 5 | Complaint-phrase false positives flood the sink | implementation | Over-firing triggers form clusters on noise. | The three-distinct-session threshold gates issue creation; singles remain visible as counts only. | Phase 6 |
| 6 | The consent doctrine erodes | product | The org-pack class becomes a precedent for machine-granted permissions. | The ADR defines it narrowly as a human administrator's decision disclosed to the affected user, and restates that auto-detected stays never-consent verbatim. | Phase 3 |
| 7 | The telemetry confirms the zero | product | Real activation is genuinely near zero even with correct instrumentation. | That is a result rather than a failure: the null is published and effort redirects to the estate. | Phase 4 |

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
