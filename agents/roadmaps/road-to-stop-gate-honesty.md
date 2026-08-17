---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to stop-gate honesty — a blocking gate earns a number

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-stop-gate-honesty.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`. One of the draft's phases is materially narrowed by
> that verification — see claim 4 and step 2.2.

---

## 0. The defect, stated first

**The suite refuses turn-ends, and a refused turn-end is at least one extra model
turn the user experiences as slowness and as the agent fighting them — with no
per-session visibility into how often it happens.**

No infinite loop exists: the re-entrancy guard is two-layered and sound. The cost
is per-refusal, and it is unmeasured in the field.

### D-1 — The gate is always armed, with three detectors

Armed unconditionally since the settings switch was removed, which shipped
**inside** the "before 12 it was good" window the report names — itself evidence
that the report's version attribution needs Phase 0 of
`road-to-per-turn-hook-economy` before anything is attributed to 12.1. The
detectors are (A) promissory closing, (B) language mismatch against a fresh pin,
and (C) unverified edit — a turn that changed a file and ran no verify-shaped
command is refused at Stop. For a German-speaking team, B fires on English replies
under a German pin; for quick-edit workflows, C converts every "fix this one line"
turn into "fix it and run a verifier, or be refused".

### D-2 — Refusal frequency is invisible

Per-session ordinal state exists — one small file per session, and its own header
admits there is no TTL — but nothing aggregates refusals into a rate anyone
reviews. A gate that blocks unobserved is exactly the shape this estate's own
advisory-kill discipline exists to prevent: advisories here carry registered kill
standards, and this **blocking** concern carries none.

### D-3 — Stop is the heaviest slot and the least elastic

Stop binds the largest concern chain on claude, including a large transcript read,
a JSONL rebuild, and git scans. **Every refused Stop runs the whole slot again on
the retry.**

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | The gate refuses turn-ends; three detectors A/B/C | **still-true** | `src/scripts/hooks/turn_end_gate_hook.ts` header |
| 2 | Two-layer re-entrancy guard; a wedge rather than a loop is the named failure | **still-true** | same header, re-entrancy section; the `stop_hook_active` check |
| 3 | Always armed; the settings switch was removed | **still-true** | header's always-armed section; the commit is contained in tags from 10.0.0 onward, i.e. before the window the report blames |
| 4 | `_VERIFY_RE` may not recognise the team's PHP toolchain, producing false refusals | **OVERTAKEN — the named toolchain is already covered** | `_VERIFY_RE` matches bare `phpunit` and `pest` in its first alternation, and `composer` / `php artisan` followed by a verify-shaped subcommand in its second. So `vendor/bin/phpunit`, `pest`, `composer test` and `php artisan test` all register as verification today. Step 2.2 is narrowed accordingly: the audit is still worth running, but not on the examples the draft named |
| 5 | Session state files accumulate with no TTL | **still-true** | stated explicitly in the hook header |
| 6 | Stop binds the largest chain on claude | **still-true** | `src/scripts/hook_manifest.yaml` claude block |
| 7 | A large transcript read cap per Stop | **still-true** | the read cap in `turn_end_gate_hook.ts` |
| 8 | Measured origin: language violations survived a fresh pin, and advisory carriers hit zero effect | **still-true** | the round-5 audit citation in the hook header. This is the strongest single result in the enforcement estate and is why this roadmap tunes rather than repeals |
| 9 | The team operates German-language sessions, so detector-B exposure is real rather than hypothetical | **still-true** | `agents/roadmaps/road-to-conformance-round7-followup.md` corpus quotes |
| 10 | Refusal rates are expected to correlate with the local 12.1 install date | **prediction, not a claim** | derived from `road-to-mixed-trigger-activation-cost` § 0 — per-edit obligations multiplied by detector C. Phase 1 tests it; nothing downstream assumes it |

## Phases

### Phase 1 — Count before judging

- [ ] **1.1** Aggregate refusals: a small reader over the per-session ordinal files
      plus a refusals counter in the session-register record, reported by the hooks
      doctor and rolled up per period — **per detector separately**, because A, B
      and C have different legitimacy profiles and a pooled rate would hide which
      one is firing. The counter rides the existing session-register write, so it
      adds no spawn.
      `verify:` the doctor prints per-detector counts on this machine, and a fixture
      session with a known refusal is counted once.
- [ ] **1.2** Add the TTL the header admits is missing: prune ordinal files past a
      declared age at session start. Cheap and bounded.
      `verify:` a fixture directory with aged and fresh files keeps exactly the
      fresh ones.
- [ ] **1.3** Split the counts before and after the local 12.1 install date per
      machine, to test claim 10's prediction rather than assume it.
      `verify:` the split appears in the rollup, with the install date recorded per
      machine.
- **AC-1:** a per-detector refusal rate exists for the maintainer machine and at
  least one colleague machine, over a window long enough to be read as a rate
  rather than an anecdote.

### Phase 2 — Judge each detector on its measured rate against its measured benefit

- [~] **2.1** Pre-register the bar per detector **before looking at Phase 1 data**:
      a detector whose refusals are re-refused on the retry above some share — the
      model could not satisfy it — or whose median per-session count exceeds some
      threshold is demoted from blocking to advisory **for that detector only**, and
      the demotion is published with the distribution. The numbers are the
      maintainer's; the shape is the requirement. Blocked on
      `b-detector-demotion-bars`.
- [ ] **2.2** Detector C's verify allowlist decides what counts as verification.
      **Narrowed by claim 4:** the PHP toolchain the draft worried about is already
      matched, so this step is no longer "add phpunit and pest". What remains is a
      real audit with a smaller surface — enumerate the verify-shaped commands the
      team actually runs, test each against `isVerificationCommand`, and record the
      misses. Any addition ships with a fixture mapping command string to
      recognised, the same as every allowlist in this tree.
      `verify:` a fixture table of real commands with their recognition verdict;
      every addition has its own row.
- **AC-2:** each detector has either a green verdict — rate under its bar — or a
  demotion PR citing the distribution. **No detector stays blocking without a
  number.**

### Phase 3 — Make refusals cheap when they happen

- [ ] **3.1** On a refusal retry, skip the non-gate Stop concerns: chat history has
      already written, and re-running the context rebuild, the end-review scan and
      the self-repair detector on the retry is pure duplicate cost. Manifest-level,
      one opt-in flag per concern, default off, flipped only with a per-concern
      argument in the PR — never a blanket skip. Verify per concern that its dedup
      is idempotent before flagging it.
      `verify:` a fixture retry runs only the refusal-capable concerns, and each
      skipped concern's artefact is identical to the non-retry run.
- [ ] **3.2** Complementary lever, recorded here so the two files cannot drift:
      moving the non-gating Stop concerns to the host's async handler form is owned
      by `road-to-per-turn-hook-economy` step 5.3. This roadmap records only the
      split — gates synchronous, recorders async — and defers the mechanism and its
      acceptance criterion to that file.
      `verify:` this step needs no code; it is closed by that file's 5.3 landing, or
      by recording that it did not.
- **AC-3:** a refused-turn retry costs materially less than a full Stop in the
  bench, measured rather than asserted.

## Blockers

### blocker: b-detector-demotion-bars
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 2 step 2.1, and therefore any demotion. Steps 1.x, 2.2 and 3.x
  are repo work and proceed without it.
- **What to do:** pre-register the demotion bar per detector, before reading Phase
  1's data — pre-registration after the fact is not pre-registration. Options:
  (a) name a re-refusal share and a per-session median for each of A, B and C
  separately; (b) name one bar shared by all three, accepting that it will fit the
  most-firing detector worst; (c) declare that no demotion is available and the
  gate stays blocking regardless of rate, in which case Phase 2 closes with that
  recorded and Phase 1's numbers become monitoring rather than a decision input.
  The counter-argument to keep in view: the round-5 measurement — blocking
  carriers at zero violations, advisory carriers not — is the strongest single
  result in the enforcement estate, so a demotion trades a measured win for a
  measured cost and both numbers should be on the table.
- **Recommendation:** **option (a) — per-detector bars.** The three detectors have
  genuinely different legitimacy profiles: A fires on the agent's own promissory
  language, B on a language mismatch against a fresh pin, C on an edit with no
  verifier. A single shared bar (option b) would be set by whichever detector fires
  most and would either demote a detector that was working or protect one that was
  not. Option (c) is defensible on the round-5 evidence but forecloses the question
  permanently, and this roadmap's whole premise is that a blocking gate should carry
  a number.
- **If you do nothing:** the gate keeps refusing turn-ends at an unmeasured rate,
  and the estate keeps a blocking concern with no registered kill standard while
  every advisory around it has one. Phase 1's counts would accumulate with nothing
  authorised to act on them — measurement without a decision rule, which is the
  shape this roadmap was opened to fix.
- **Resolved when:** the bars, or option (c), are recorded at this blocker with
  their reasoning, and the record predates the first read of Phase 1 data.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Demoting a detector reintroduces the violations it closed | product | The measured origin of this gate is that advisory carriers achieved zero effect on exactly these violations while blocking carriers eliminated them; a demotion could re-open a class the estate already paid to close | Demotion is per-detector, evidence-cited and reversible; the round-5 numbers stay the baseline the advisory form is measured against, so a failed demotion is detectable rather than invisible | Phase 2 — Judge each detector |
| 2 | Widening the verify allowlist turns detector C into a rubber stamp | product | Every command added is a way to satisfy the gate without verifying anything; enough additions and the detector stops detecting | Each addition ships a fixture mapping command to verdict, and claim 4 already removed the pressure to add the obvious PHP commands because they match today | Phase 2 |
| 3 | Skipping concerns on retry loses a legitimate second-chance write | implementation | A concern skipped on the retry might have been the one that needed the second pass, and the loss would be silent | Per-concern opt-in with a stated argument, never a blanket skip; idempotence is verified per concern before its flag is flipped, and the artefact diff is the check | Phase 3 |
| 4 | The refusal counter's own cost lands on the slot it measures | implementation | Stop is already the heaviest slot; instrumenting it could make the thing it measures worse | The counter rides the existing session-register write and adds no spawn, which is why 1.1 specifies that carrier rather than a new one | Phase 1 — Count before judging |
| 5 | Pre-registration is quietly done after the data is seen | product | The bar is only meaningful if it predates the distribution; a bar chosen after looking is a description dressed as a decision | The blocker's resolution condition requires the record to predate the first read, and Phase 1 and the blocker are deliberately separable so the data can accumulate while the bar is being decided | Phase 2 |
| 6 | Attributing the refusals to 12.1 when the gate predates it | product | The gate was armed before the window the report blames, so a correlation with the install date could be read as causation and mis-route the whole investigation | Claim 10 is labelled a prediction rather than a claim, step 1.3 tests it as a split, and D-1 states the arming date's position relative to the window up front | Phase 1 |

## CUT list — do not re-litigate

- **Removing the gate.** The round-5 measurement is the strongest single result in
  the enforcement estate. This roadmap tunes; it does not repeal. Cut.
- **A settings kill-switch.** The argument that removed it stands: a default-off
  safety gate soaks nothing. Per-detector demotion by evidence replaces it. Cut.
- **Keying refusal state on prompt text.** Already tried and found wrong in three
  directions. The ordinal stays. Cut.

## Honest-null consequence

If Phase 1 shows refusal rates are negligible across all three detectors, this
roadmap closes as a null with the numbers published, and the "slow since 12.1"
investigation returns fully to the activation flip, the context size and the
environment — which is itself a decidable and valuable answer.
