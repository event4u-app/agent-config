---
complexity: lightweight
status: ready
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this addition carries no roadmap of its own to retire: the run archived two roadmaps, but both were status: draft and therefore never counted, so neither is available as an offset. The addition is sanctioned on its own terms -- three parked roadmaps name this instrument's capture rate as their resume condition."
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Instrument roadmap: hook-carried capture for suggestion-block emission and user selection. Its published capture-rate figure is the citable telemetry reading that the resume conditions of later/road-to-composite-dispatch-topology and later/road-to-cost-parity-2-state-aware-dispatch already name, and the measurement prerequisite for later/road-to-elicitation-front-door. One addition unblocks three parked measurements; growth is claimed, not dodged via draft status (the hole road-to-draft-status-ratchet-boundary documents)."
---
# Road to suggestion block capture — a hook-carried instrument, not appetite

> **Source:** `agents/tmp.old/5-steps/road-to-suggestion-block-capture.md`, from a senior-review session 2026-08-23 against pinned commit
> `c7e82087e1402968b9ecf16d43cc3affd3968e47` (v14.10.0). The predecessor
> draft of an elicitation front door was rejected in that review because its
> verdict metrics had no capture instrument — the same defect that resolved
> the retrospective orchestration claim HONEST NULL at 0.27 % model-carried
> capture (`docs/CLAIMS.md:276` ff.). This roadmap builds the instrument
> first. The front door itself is parked in
> `later/road-to-elicitation-front-door.md` until this file's AC-4 is citable.

## Goal

A `user_prompt_submit` hook detects, from the existing deterministic render
signature, that the previous assistant turn emitted a numbered-options
suggestion block, classifies the current user turn (option number / as-is /
other), and appends a derived-counts JSONL line to the existing audit sink —
and a pre-registered capture-rate claim is resolved from a soak window with a
figure other roadmaps can cite. Zero standing-payload growth: the detector
keys on output the layer already produces.

## Context — what is verified in the tree

1. **The signature already exists.** `src/scripts/command_suggester/render.ts`
   emits a numbered-options block followed by "Exactly one
   `Recommendation: N — …` line" (`render.ts:10`), with the as-is option
   always last (`src/rules/command-suggestion-policy.md:31` ff.). Detection
   therefore needs no rule or contract text change — the corpus both
   standing-payload gates flag red (`road-to-standing-payload-diet.md:30-37`)
   is untouched.
2. **The hook slot is wired and linted.** `hooks/hooks.json` registers
   `UserPromptSubmit` through the central dispatcher; slot semantics are
   documented in `src/scripts/hook_manifest.yaml:339` ff. and gated by
   `lint_hook_manifest`. Latency budget: `any_hook_event p95_ci 250` ms
   (`src/config/hook-latency-budget.json`).
3. **The sink and the privacy pattern exist.**
   `agents/runtime/state/audit/*.jsonl` is the established telemetry sink,
   and `src/config/dispatch-economy-metrics.json:27` fixes the discipline:
   "a count derived from the result object, never its content."
4. **The model-carried alternative is measured and dead.** The
   `orchestration_record` model-carried step captured 1 of 369 dispatches
   (`docs/CLAIMS.md:276`). This roadmap exists because that number may not
   be repeated.
5. **Three parked consumers.**
   `later/road-to-composite-dispatch-topology.md:22-31` resumes only when
   "a post-hook telemetry capture rate has been recorded somewhere citable";
   `later/road-to-cost-parity-2-state-aware-dispatch.md` shares the queue
   conjuncts; `later/road-to-elicitation-front-door.md` (sibling of this
   change) names this file's AC-4 as its first resume conjunct.

## Prerequisites

- [x] Hook dispatcher path resolves on a maintainer machine
      (`dist/hooks/dispatch.js` present after build).
      verify (discharged 2026-08-24): `dist/hooks/dispatch.js` is present after
      `task build-ts`, and a `UserPromptSubmit` dispatch on a no-op turn exits 0
      — measured by `bench_hook_latency`, which drives every slot **via the
      bundle** (`user_prompt_submit` p50 65 ms over n=50).

## Phase 1 — Payload probe and pre-registration, before any capture code

- [x] **1.1 Probe: can the hook read the previous assistant turn?** On
      Claude Code, confirm from a live `user_prompt_submit` invocation which
      of the following the hook can reach: the event payload's own fields,
      or the transcript tail via a payload-carried path. Record the finding
      in `agents/evidence/analysis/suggestion-capture-probe.md` **either
      way** — a negative finding parks this roadmap to `later/` with the
      probe as the trigger, and is a publishable result, not a failure.
      Deliberately a phase step and not a `### blocker:` entry: the estate
      policy sanctions no new blockers without the claim path
      (`src/config/estate-count-budget.json` § growth_allowances).
      verify (discharged 2026-08-24):
      `agents/evidence/analysis/suggestion-capture-probe.md` — host version, the
      full key set of both slots, and the read path chosen.

      **The answer is YES, and it changed the design.** Probed live in a **clean
      throwaway project** (probing inside this repository would have measured this
      tree's own dispatcher configuration rather than the host's payload), two
      turns through `claude -p` / `--continue`:

      | | `UserPromptSubmit` | `Stop` |
      |---|---|---|
      | `transcript_path` | present | present |
      | — file exists, turn 1 | **NO** | yes |
      | — file exists, turn ≥ 2 | yes | yes |
      | `prompt` | **present** | absent |
      | `last_assistant_message` | absent | **present** |

      **`stop` carries `last_assistant_message` in the payload**, so the
      "was a block emitted" half needs **no transcript read at all** — cheaper
      than the planned single-slot read, and with no turn-1 blind spot. The
      instrument shipped as a **two-slot latch** on that finding. Risk 1 of this
      roadmap — *"host payload may not expose the transcript tail; the whole
      design rests on it"* — **does not arise**.

      Scope stated rather than assumed: Claude Code only. The manifest binds this
      slot on six platforms and the other five were not probed, so any figure the
      instrument produces is host-scoped.
- [x] **1.2 Register `claim:suggestion-capture-rate` in `docs/CLAIMS.md`,
      status `unbacked`, BEFORE the hook lands.** Threshold for the first
      soak window: **greater than zero and rising** — no percentage figure
      anywhere in the entry, mirroring the registered form of
      `claim:subagent-valid-envelope-rate`
      (`agents/roadmaps/archive/road-to-subagent-envelope-adoption.md:200`
      ff.), whose entry was written so `grep -c '%'` over it returns 0.
      Falsification: a window in which blocks are known to have been emitted
      (manual log kept by the maintainer during the window) but zero lines
      land DROPS the claim and parks the consumer roadmaps' resume
      conditions as unsatisfiable-by-this-instrument.
      verify (discharged 2026-08-24): the entry carries **0** `%` characters and
      `check_claims` is green (87 ledger entries, 58 backed, 23 unbacked
      inventory). Registered `unbacked`, BEFORE the hook existed, threshold
      "greater than zero and rising".

      Two things the entry states that the step did not ask for, because writing
      it surfaced them: the model-carried comparator is **not a number this claim
      beats** — `orchestration_record`'s 1-of-369 "may not be cited for either
      direction" per its own entry, so it is the *reason* this instrument exists;
      and the metric's denominator must have a reading **independent of the
      instrument under test**, or the instrument measures only itself. That second
      sentence is what makes Phase 3 need a human.
- [x] **1.3 Register the record schema as counts-only.**
      `src/config/suggestion-capture.json` (`schema_version`,
      `registered_at`, `owner`, `review_by` per the budget-ownership
      pattern of `hook-latency-budget.json`): fields are
      `ts, block_emitted, options_count, evidence_class,
      turn_classification` — classification enum
      `option_n | as_is | other | stale_block`. No prompt text, no option
      labels, no command names beyond the evidence class.
      verify (discharged 2026-08-24): `src/config/suggestion-capture.json`
      exists and the grep over its field **definitions** returns **0**.

      **Privacy is a property of the type, not of a scrubber**, and the config
      says so in its own `field_ban.why_a_ban_and_not_a_scrubber`: a scrubber can
      fail and leave content in the sink; a record with no field able to hold a
      string cannot. `tests/scripts/suggestion_capture.test.ts` asserts the
      **written** key set equals the registry exactly, so an added field fails a
      test rather than shipping quietly.

      One field is deliberately narrower than it could be: `option_n` records
      THAT a numbered option was chosen and — via `options_count` — out of how
      many, but **not which number**. The block's option order is content, and
      the capture-rate question does not need it.

**Exit:** probe answered, claim and schema merged, zero hook code written.
**Rollback:** delete two files; nothing consumes them yet.

## Phase 2 — The hook

- [x] **2.1 Implement `suggestion_capture_hook` on `user_prompt_submit`.**
      Detection: previous assistant message matches the render signature
      (numbered options + exactly one `Recommendation:` line, per the
      GT-CS golden shapes in
      `tests/scripts/command_suggester_goldens.test.ts`). Classification of
      the current turn only when the signature is on the **immediately
      preceding** assistant message; an older block classifies as
      `stale_block`, never as a pick — this is the misclassification guard
      for a bare "1" answering something else.
      verify (discharged 2026-08-24): `tests/scripts/suggestion_capture.test.ts`,
      **30 tests green**. All four enum outcomes are reachable and asserted as a
      set; the no-latch path writes **nothing at all** (`record: false`), because
      recording every ordinary turn would make the sink a prompt log with the
      volume of one.

      **The misclassification guard is consume-once, and it is the whole
      correctness argument.** The latch is deleted on read, so a bare `1` three
      turns later meets no latch and classifies `other`. Past its TTL →
      `stale_block`. **Unparseable → `stale_block` too, never a guess.**
      Out-of-range (`7` against a 3-option block) → `other`. And `1. rename the
      helper` → `other`, not a pick: counting an instruction that happens to
      start with a digit would inflate the exact rate this measures.

      Two matchers are wider than the step implied, each for a reason in the
      tree: the recommendation label is matched in **both languages**, because
      `user-interaction` Iron Law 1 makes a wrong-language label a violation
      rather than a variant, so a single-language matcher would under-count
      precisely the sessions the mirror rule produces; and the as-is option is
      matched **by intent**, because `command-suggestion-policy` requires it
      present and last but fixes no wording.

      **One defect in the first version, recorded because it is the silent
      kind.** It read the event from `hook_event_name` only. The dispatcher
      supplies `envelope.event`, so under the dispatcher the concern ran, matched
      nothing, and exited 0 — indistinguishable from a disabled hook. It now
      reads both, through `envelope.ts`'s `unwrap`, and `eventOf` carries the
      reason in its docstring.
- [x] **2.2 Manifest entry and latency compliance.** Register the hook in
      `src/scripts/hook_manifest.yaml` for the `user_prompt_submit` slot.
      verify (discharged 2026-08-24): `lint_hook_manifest`,
      `lint_hook_concern_budget` and `compile_hook_manifest` green;
      `hooks:status` lists `suggestion-capture` in the claude `stop` and
      `user_prompt_submit` chains. Latency, budget file **untouched**:
      `user_prompt_submit` p95 **71 ms**, `stop` p95 **109 ms**, against the
      registered `any_hook_event` cap of **250 ms**. `bench-hook-injection` green
      — this concern emits **no** context bytes at all, so it adds nothing to the
      per-turn injection budget.

      **Registered on TWO slots, which the step did not anticipate** — the
      two-slot design came out of 1.1's probe, so the manifest entry covers `stop`
      as well.

      A settings key came with it and cost one honest correction:
      `hooks.suggestion_capture.enabled`, classified in
      `docs/contracts/settings-classes.md`. The first draft called its disposition
      `derivable` on the ground that the sink's line count answers whether the
      soak is running — true, and the wrong question. What the key authorises is
      *the package observing this operator's turns*, which is **`consent`**, and
      no predicate computes it. The `derivable-surface` ratchet is shrink-only and
      refused the row immediately; being unable to add a `derivable` key is that
      mechanism working.
- [x] **2.3 Sink wiring.** Append to `agents/runtime/state/audit/*.jsonl`
      alongside the orchestration lines; derived counts only, per 1.3.
      verify (discharged 2026-08-24): one synthetic turn through the real
      dispatcher-envelope contract produced **exactly one** line, `jq`-parseable,
      with the latch consumed and gone:

      ```json
      {"ts":"2026-08-24T09:55:27Z","block_emitted":true,"options_count":3,
       "evidence_class":"latch-consumed","turn_classification":"option_n"}
      ```

      No field carries free text — the key set is asserted against
      `src/config/suggestion-capture.json` by a test, so this is a checked
      property rather than an inspection.

**Exit:** hook live on the maintainer workspace only.
**Rollback:** manifest entry removal; the sink keeps already-written lines.

## Phase 3 — Soak and verdict

- [~] **3.1 Run the soak window** <!-- deferred: transferred to agents/roadmaps/stubs/road-to-suggestion-capture-soak.md — the denominator is a human's contemporaneous log, which no autonomous run can supply without making the measurement circular --> (length fixed in the 1.2 entry before the
      window starts) with a contemporaneous manual emission log kept by the
      maintainer, so "blocks emitted" has a reading independent of the
      instrument under test.
- [~] **3.2 Resolve `claim:suggestion-capture-rate`** <!-- deferred: transferred with 3.1 to agents/roadmaps/stubs/road-to-suggestion-capture-soak.md; depends on that window --> per 1.2 — greater
      than zero and rising, or DROP. Publish the figure in the claim entry
      in the citable form the parked consumers' resume conditions name.
      verify: the verdict PR flips the claim status and `check_claims`
      resolves the cited figures; the consumer roadmaps' resume text needs
      no edit to point at it.

**Exit:** a citable capture-rate reading exists — either direction.

**TRANSFERRED 2026-08-24 to [`stubs/road-to-suggestion-capture-soak.md`](stubs/road-to-suggestion-capture-soak.md).**
AI council, 2/2 convergent (a first attempt reached only 1 of 2 —
`openai/codex-default` returned `os_error: ENOBUFS` — and was re-run rather than
banked, because a degraded reading is not convergence and this decides an estate
outcome). Verdict: 3.1, 3.2 and AC-4 are a **capability-gated drain-run transfer**;
the probe is `probe:suggestion-capture-soak-evidence-ready`.

**Why it cannot be automated**, in the second seat's words: *"an autonomous run
cannot manufacture the independent denominator without making the measurement
circular."* The claim's falsification clause requires "blocks emitted" to have a
reading independent of the instrument under test — a run counting its own output
twice and calling the second count a control is not a control.

**The roadmap therefore does NOT archive, and the estate count does not drop.**
Both seats were explicit that acceptance criteria gate completion *individually*:
transferring one blocked criterion does not erase a separate unproven one, and
AC-2's live half is unproven for reasons that have nothing to do with this
transfer. One seat argued for archiving on the ground that an 11-of-13 roadmap
kept active overstates the automatable estate; the refusal carried, and the
dissent is recorded in the stub.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Hook cannot see the previous assistant turn | implementation | Host payload may not expose the transcript tail; the whole design rests on it | Phase 1.1 probes before any code; negative finding parks the roadmap with the probe note as evidence | Phase 1 — Payload probe and pre-registration, before any capture code |
| 2 | Misclassification of bare numeric replies | implementation | A "1" answering an unrelated question logged as a pick corrupts every downstream metric | Signature-on-immediately-preceding-message precondition; `stale_block` enum; unit tests for all outcomes (2.1) | Phase 2 — The hook |
| 3 | Latency regression on a per-turn slot | implementation | `user_prompt_submit` fires every turn; a slow detector taxes every interaction | Registered 250 ms p95 budget enforced by the existing bench gate, budget file untouched (2.2) | Phase 2 — The hook |
| 4 | Content leakage into telemetry | product | Prompt text in an audit line is a privacy defect | Counts-only schema registered before code (1.3) with a grep-guard; sink review in 2.3 | Phase 1 — Payload probe and pre-registration, before any capture code |

## Acceptance Criteria

- [x] AC-1 — The probe note, the claim entry, and the counts-only schema
      exist and predate the first hook commit in history.
      **Met, and the history order is the checkable part.** All three land in
      commits BEFORE the hook commit on this branch, which is what makes 1.2 a
      pre-registration rather than a description of whatever the code did. The
      probe also names its own negative branch as a legitimate terminal state —
      it returned positive, so that branch was not taken.
- [ ] **AC-2 — OPEN.** On the maintainer workspace, an emitted suggestion block
      followed by a pick, an as-is choice, an unrelated turn, and a stale
      reply each produce exactly the registered classification — unit- and
      one-live-turn-demonstrated, with no line written on ordinary turns.

      **Verified:** unit behaviour across all four enum outcomes plus the
      no-signature no-op path (30 tests); manifest registration and both budgets
      (latency p95 71 / 109 ms against 250 ms; zero injection bytes); and one
      direct dispatcher-envelope invocation producing a valid capture line and
      consuming the latch.

      **NOT verified:** a live host turn through `agent-config dispatch:hook`
      creating and consuming the latch and writing the line. Three bounded
      isolation attempts produced no concern output, after which the N=3
      validation budget stopped further iteration. The compiled manifest and the
      bundle both carry the concern, `hooks:status` lists it in the claude `stop`
      chain, and `enabled()` returns true for that project's settings file — so a
      failure in the local CLI's `--project-dir` path is **suspected but not
      established**, and suspecting it is not evidence that the live path works.

      **Recorded OPEN rather than "partially met"**, on both council seats'
      insistence: partial verification describes *evidence*, and is not an
      executable state for an acceptance criterion. A later reader — or an
      accounting tool — must not be able to read an incomplete gate as satisfied.
- [x] AC-3 — `lint_hook_manifest` and the hook-latency bench are green with
      the hook registered, with no edit to the latency budget file.
      **Met.** `lint_hook_manifest`, `lint_hook_concern_budget` and
      `compile_hook_manifest` green. `bench_hook_latency`, budget file untouched:
      `user_prompt_submit` p95 **71 ms**, `stop` p95 **109 ms**, cap **250 ms**.
      `bench-hook-injection` green with this concern contributing **0 bytes** —
      it emits no context at all, so it cannot move the per-turn injection
      budget.
- [ ] **AC-4 — TRANSFERRED UNRESOLVED.** `claim:suggestion-capture-rate` carries
      a resolved verdict with a citable figure, in the form the parked consumers'
      resume conditions name — or a recorded DROP that parks them honestly.

      Resolution depends on the independent 14-day soak preserved in
      [`stubs/road-to-suggestion-capture-soak.md`](stubs/road-to-suggestion-capture-soak.md).
      **This roadmap does not claim a resolved verdict.**

      Transferred **unresolved rather than re-scoped**, which one seat argued for
      specifically: rewriting it into "the claim is registered with a threshold"
      would be accurate progress reporting and would not be the criterion. The
      criterion is a verdict, and there is no verdict.

## Corrections applied at landing (2026-08-24)

Recorded rather than silently fixed, per this repository's convention.

| What | Was | Now | Why |
|---|---|---|---|
| Risk type, row 2 | `measurement` | `implementation` | `lint_plan_risk_register.ts:288-293` admits **only** `product` or `implementation`. A non-draft roadmap is not exempt, so the file could not have landed green at `status: ready` as written. |
| Risk type, row 4 | `legal` | `product` | Same gate, same reason. |
| Claim citation | `docs/CLAIMS.md:259` / `:269` | `docs/CLAIMS.md:276` | Line drift only. The figures (1 of 369 model-carried captures, 0.27 %) are real and verified at HEAD; only the anchor moved. |

**Verified unchanged at HEAD `0f7c26ee9`, not inherited:** all nine of this
roadmap's file:line citations re-resolve — `render.ts:8-12` (the numbered-options
plus single-`Recommendation:` signature), `command-suggestion-policy.md:31`
(as-is always present and last), the `UserPromptSubmit` registration,
`any_hook_event p95_ci 250`, `dispatch-economy-metrics.json:27` ("a count derived
from the result object, never its content"), the composite-dispatch resume
conjunct, and the "greater than zero and rising" claim model.

**One acceptance criterion is deliberately weaker than its phase.** Step 1.1
parks this entire roadmap if the probe finds a `user_prompt_submit` hook cannot
read the preceding assistant turn. That is unusual for `status: ready`, and it is
honest rather than accidental: the estate policy sanctions **no** new
`open_blockers` ("Nothing in the policy sanctions a new blocker"), so the
dependency is carried as a phase step instead of a blocker record. AC-1 names the
negative probe as a legitimate terminal state, not a failure.
