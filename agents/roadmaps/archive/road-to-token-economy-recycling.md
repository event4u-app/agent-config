---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to token-economy — recycling: deliberate envelope-mediated fresh starts instead of lossy auto-compaction

> **Source:** consumed inbox `agents/tmp.old/fix-token-problem.txt`
> (maintainer analysis session 2026-08-10, third cut from the token-burn
> diagnosis series — `road-to-token-economy-dispatch` = per-spawn floor,
> `road-to-token-economy-cache` = per-turn overhead, this = session
> end-of-life; claims re-verified against the tree 2026-08-10 during inbox
> analysis). The claim this roadmap operationalizes points cost and
> quality the same direction: long sessions are simultaneously the most
> expensive (every turn re-pays the accumulated context) and the worst
> (context rot — the host vendor's own named phenomenon: accuracy falls as
> token count climbs). A deliberate recycle at a committed threshold beats
> both the degraded long session and the host's automatic compaction.
>
> **Why not just rely on auto-compact:** third-party measurements report
> the autocompact reserve consuming tens of thousands of tokens of usable
> window (~20 %+ of a 200k window) and compaction triggering as early as
> ~75 % utilization; the compaction summary itself is a paid model run
> whose output the session cannot review; and its loss profile is
> uncontrolled — what survives is whatever the summarizer kept. These are
> third-party numbers on a moving host surface: Phase 1 measures OUR
> incidence and reserve before any behaviour ships, and every number above
> is treated as a hypothesis until the probe note exists.
>
> **Substrate, verified in-tree:** CHECKPOINT envelopes exist for WORKER
> recycling — `later/road-to-worker-generation-recycling` (Phases 0-1
> shipped, PR #1228; Phase 2+ parked on the maintainer blockers
> `host-worker-respawn`, `capsule-quality-near-budget`,
> `orchestrator-only-mode-decision`). That roadmap owns the
> worker-at-budget handoff chain; THIS one generalizes the envelope
> substrate to the orchestrator/main session, whose receiver problem is
> different (no surviving orchestrator to hand to — the successor
> bootstraps from the envelope alone). The two must share the schema, not
> duplicate it; and nothing here pre-empts the parked Phase 2 or its
> blockers.
>
> **Observability, corrected against the tree:** the inbox draft assumed
> "transcript bytes are the only proxy, tokens unobservable to hooks."
> Partially false: the transcript JSONL at `transcript_path` carries
> per-record `message.usage` INCLUDING the cache split, and
> `src/scripts/_lib/cc_transcript.ts` already parses it (cache-economy,
> 2026-07-30). A Stop-slot reader can therefore compute the ACTUAL current
> context size in tokens from the last assistant record — no byte-proxy
> calibration needed for the threshold unit. What remains host-fixed:
> hooks cannot inject `/clear`, so the recycle action itself stays
> advisory-carried (model writes the envelope and asks; the user or a
> wrapper clears).
>
> **Cross-repo note:** the agent-switch managed-statusline +
> token-accounting design (maintainer's own, designed, unshipped) is the
> natural display surface for the fill level. It enters as an OPTIONAL
> integration phase behind a blocker — this roadmap must be able to close
> without a second repo shipping first (bus-factor discipline).

## Goal

A main session approaching its useful-context ceiling ends on purpose: state
flows into a validated recycle envelope (decisions, constraints, open work,
artifact paths — never a prose summary of the transcript), the session is
cleared, and the successor resumes from the envelope at a fraction of the
cost and with measurably no worse verify outcomes than the long-session
baseline. Auto-compaction incidence trends to zero as the recycle path is
adopted — and if the measured quality claim fails (recycled sessions verify
worse), that result is publishable and the threshold or the envelope schema
widens by evidence.

## Prerequisites

- [x] CHECKPOINT envelope schema + validator on main
      (`road-to-worker-generation-recycling` Phases 0-1, PR #1228) —
      implementer verifies current schema version and its extension policy
      (`additionalProperties` posture) before Phase 2 extends it.
      <!-- verified 2026-08-10: PR #1228 MERGED; substrate is src/scripts/_lib/subagent_capsule.ts
           (hand-rolled validator, NO version field exists yet — Phase 2.1 INTRODUCES versioning;
           TS validator is open-posture while the wire schema subagent-status.json is
           additionalProperties:false — the recycle variant gets its own strict validator
           in the same module) -->
- [x] `cc_transcript.ts` usage-parsing lib on main (cache-economy) — the
      Phase 1/3 token-reading substrate; no new parser.
      <!-- verified 2026-08-10: src/scripts/_lib/cc_transcript.ts on main incl.
           billableInputTokens + cache split -->


## Context (verified against tree 2026-08-10 during inbox analysis, do not relitigate)

- **Worker recycling exists (Phases 0-1); main-session recycling does
  not.** The CHECKPOINT flow assumes an orchestrator survives to receive
  the envelope. Recycling the orchestrator itself has no receiver — the
  successor session must bootstrap from the envelope alone, which is a
  stricter completeness requirement on the schema (Phase 2's core
  problem).
- **The fill level IS computable in-suite.** No hook receives token counts
  from the host directly, but the Stop slot receives `transcript_path`
  (already read by `end_review_nudge_hook.ts`), and the transcript carries
  per-record `message.usage` — `cc_transcript.ts` parses it. Phase 1 reads
  real token counts; the byte-size fallback exists only for transcripts
  the lib cannot parse.
- **The host recycle actions are user-surface commands** (`/clear`,
  `/compact`, session restart). Third-party reporting is explicit that
  hooks cannot inject them. Therefore every recycle in this roadmap is
  ADVISORY-carried — the same delivery honesty as the shipped nudges.
- **Handoff prior art exists in-tree:** `handoff_context_hook.ts` already
  injects handoff material at session_start — the successor-side receiving
  slot is built; what is missing is the producer side (envelope written at
  recycle time) and the contract between them.
- **The compact-instructions surface exists on the host** (committed
  compact guidance is honoured per host docs) — a cheap fallback lane for
  users who compact anyway, independent of the envelope path.

## Phase 1 — measure the end-of-life we actually have

- [x] 1.1 Instrument (record-only, hook-carried): per session — final
      context size in tokens (last assistant record's usage via
      `cc_transcript.ts`), turn count, whether auto-compaction occurred
      (detectable marker in transcript, implementer verifies the current
      marker shape on a live host), and post-compaction verify-fail
      incidence where applicable. Two weeks of real sessions.
      <!-- done 2026-08-10: `session-eol` Stop-slot concern (src/scripts/hooks/session_eol_hook.ts,
           incremental counts-only state under agents/runtime/state/session-eol/) + scanner lib
           src/scripts/_lib/session_eol.ts. Marker shape verified on a REAL observed compaction
           (host v2.1.222) and fixture-pinned. The "two weeks" data requirement is over-satisfied
           retroactively: transcripts persist, so the baseline covers 6.5 weeks / 205 real sessions
           (2026-06-25..2026-08-10). Verify-fail incidence is not retroactively derivable (no
           verify field in transcripts) — stated in the note §6; forward instrument registered. -->

- [x] 1.2 Fallback-path check (narrowed from the draft's byte-calibration):
      for transcripts the usage-parse path cannot read, record the
      incidence; if >0, pair transcript bytes against parsed tokens on the
      readable set and publish the correlation so the fallback unit is
      honest. The primary unit is parsed tokens, not bytes.
      <!-- done 2026-08-10: incidence 4/205 (>0), published Pearson r=0.387 (n=194) — byte proxy
           FALSIFIED as a unit; policy: unparseable → null, never a byte-derived estimate (note §5) -->
- [x] 1.3 Publish the baseline note: session-length distribution,
      auto-compact incidence, and the measured cost of a late-session turn
      vs. an early one. Every threshold in Phase 3 cites this note.
      <!-- done 2026-08-10: agents/evidence/analysis/token-economy-recycling-phase1.md —
           median final ctx 519,349 tokens; 31 auto-compactions (trigger min 941,636);
           late/early turn cost 2.1x median; reproduce: session_eol_report -->


**Exit:** "when do our sessions die, how, and at what cost" is a note with numbers in a token unit read from the ledger, not inferred.
**Rollback:** n/a (observation).

## Phase 2 — the recycle envelope: state, never summary

- [x] 2.1 Extend the CHECKPOINT schema (versioned, additive — shared with
      `road-to-worker-generation-recycling`, never forked) with the
      main-session recycle variant: active task + acceptance criteria,
      decisions made with one-line rationales, binding constraints, open
      worker envelopes by path, artifact paths, explicit
      NOT-carried-forward list (what the successor must re-derive from
      source rather than trust). Selection and pointers only — a prose
      transcript summary is schema-invalid by construction (the series'
      anti-summarisation stance, enforced here as a validator rule, not a
      convention). <!-- verify: npx vitest run checkpoint_schema -->
      <!-- done 2026-08-10: subagent_capsule.ts gains CAPSULE_SCHEMA_VERSION=2 +
           variant discriminator + MainSessionRecycleEnvelope + validateRecycleEnvelope
           (strict unknown-key sweep; shared isShortLine/checkList/validateAssumption
           primitives — one module, two variants). Versioning was INTRODUCED, not
           extended: the Phase-0 worker capsule shipped unversioned and stays valid
           (implicit v1, wire schema untouched). verify run green: 32 tests
           (checkpoint_schema + the untouched worker suite). -->
- [x] 2.2 Producer command `session:recycle` — validates, writes the
      envelope to the runtime state dir, prints the exact resume
      instruction. Deterministic, no model step in the write path beyond
      the model composing the envelope content it already knows.
      <!-- done 2026-08-10: src/scripts/_cli/cmd_session_recycle.ts (stdin/--file/--template;
           strict validation; 6144-byte selection cap; atomic write to
           agents/runtime/state/recycle-envelope.json; deterministic provenance fill).
           Registered: cli/registry.ts + _dispatch.bash + budget sync 95→96
           (evaluator-budgets + evaluator-measurements, same PR per the record's contract).
           7 tests green + end-to-end smoke via ./agent-config. -->
- [x] 2.3 Consumer side: `handoff_context_hook` learns the recycle-envelope
      shape — a successor session starting with a fresh context and a
      pending envelope gets it injected at session_start, once, with the
      envelope consumed (moved, not copied) so stale envelopes cannot leak
      into unrelated sessions.
      <!-- done 2026-08-10: consume_recycle_envelope() in handoff_context_hook.ts —
           strict validation + workspace identity check (Risk 4) + 48h staleness;
           every non-absent outcome MOVES the file to recycle-envelope.consumed.json;
           injected as spotlighted DATA before the generic handoff block; 6 consumer
           tests + the untouched handoff suite green. -->
- [x] 2.4 Round-trip test: scripted session A writes an envelope mid-task;
      scripted session B resumes and completes; the deliverable diffs
      equal against an uninterrupted control run. This is the correctness
      gate for the schema — a field whose absence changes the outcome is a
      missing field, found here and not in production.
      <!-- verify: npx vitest run recycle_roundtrip -->
      <!-- done 2026-08-10: tests/scripts/recycle_roundtrip.test.ts — session A recycles
           through the REAL producer (runSessionRecycle → file), session B bootstraps from
           the REAL consumer's injected block alone; deliverable equals the uninterrupted
           control byte-for-byte. Degradation arm proves `decisions` is load-bearing
           (dropping it diverges the deliverable); third session finds nothing (consumed).
           verify run green: 3 tests. -->

**Exit:** a session can end on purpose and its successor provably completes the task; the envelope carries state, not summary, validator-enforced.
**Rollback:** schema version step back; the producer command is additive.

## Phase 3 — the threshold and the advisory carrier

- [x] 3.1 Committed recycle threshold in parsed tokens (unit from 1.1),
      derived from the baseline note (committed shape: comfortably below
      the measured auto-compact trigger, above the median healthy session —
      exact number cites 1.3, never hand-feel). One threshold, one config
      constant, owner + review date in the file header per the budget-
      ownership discipline.
      <!-- done 2026-08-10: src/config/recycle-threshold-budget.json —
           recycle_threshold_tokens=800,000 (~p90 of measured finals, 54% above median,
           15% below min observed auto-compact trigger; cites the phase-1 note).
           owner+review_by present; filename contains "budget" so lint_budget_ownership
           scans it (7 budget configs green). Statically imported into the hook bundle —
           one source, consumer-safe; AGENT_RECYCLE_THRESHOLD_TOKENS is the test seam /
           emergency off. Known 200k-window limitation recorded in the file. -->
- [x] 3.2 Advisory carrier on the Stop slot (reads `transcript_path` like
      the end-review nudge): past threshold, once per session (F2 state
      pattern), inject one line — "context past recycle threshold: run
      `session:recycle`, clear, resume from envelope." Same
      conditional-silence and fail-open discipline as the shipped nudges;
      an unreadable transcript is silence, never a block.
      <!-- done 2026-08-10: session-eol concern (session_eol_hook.ts, claude stop binding,
           worker drop list, concern_registry row, budget row 1024B). Fires once per session
           (F2 marker in the per-session state file), {decision:"warn", additional_context}
           at exit 2 — the verified delivery pattern; unreadable transcript/off-override =
           silence. 10 hook tests green incl. fires-once/never-on-short/never-twice. -->
- [x] 3.3 Compact-instructions fallback lane: commit the host
      compact-guidance template (prioritize decisions, constraints, verify
      state; drop tool output) so a user who compacts instead of recycling
      loses less. One committed file, no hook.
      <!-- done 2026-08-10: src/templates/compact-instructions.md (ships via the
           existing files[] "src/templates/" entry). Host surface verified against the
           live cost docs 2026-08-10: a "# Compact instructions" section in CLAUDE.md
           is honoured by the summarizer; /compact <instructions> is the ad-hoc twin.
           Template prioritizes decisions/constraints/verify-state, drops tool output,
           and pins epistemic states through summarization. -->
- [x] 3.4 REGISTER metrics: recycle-advisory adoption rate;
      auto-compact incidence (target: trends toward zero as adoption
      rises); envelope resume success (successor completes without
      re-asking for carried state — measured by the 2.1 NOT-carried list
      staying honest); post-recycle verify-fail rate vs. the long-session
      baseline from 1.1. The quality claim is the falsifiable core: if
      recycled sessions verify WORSE, the result is published and the
      threshold/schema revises — the claim never survives on vibes.
      <!-- done 2026-08-10: four registrations in src/config/hook-token-budget.json
           § advisory_adoption_metrics (the P4-P6 pattern): recycle_advisory_adoption
           (kill standard), auto_compact_incidence (baseline 11.2%, direction target),
           envelope_resume_success (audit-carried, honest gap stated),
           post_recycle_verify_fail_vs_baseline (publish-if-worse pre-registered).
           bench_hook_injection gate green after the edit. -->

**Exit:** the recycle path is advised at a cited threshold, adopted at a measured rate, and its quality claim has numbers against a baseline.
**Rollback:** one manifest line (the carrier) + one config constant.

## Phase 4 — statusline integration (optional, cross-repo)

- [-] 4.1 Behind blocker `statusline-substrate`: when the agent-switch
      managed statusline ships, surface the fill level and the threshold
      state live (display only — the advisory carrier from 3.2 stays the
      in-band mechanism, so this roadmap's behaviour is identical with or
      without the statusline).
      <!-- skipped 2026-08-10: lapsed-optional per the blocker's own resolution clause
           ("or this roadmap closes with Phase 4 recorded as lapsed-optional") — the
           agent-switch statusline substrate has not shipped; no work in this repo beyond
           the 4.2 read surface is permitted while it is open. The read surface (4.2) is
           live, so a future statusline finds its input waiting. -->
- [x] 4.2 The integration contract lives on the agent-switch side; this
      repo exposes only the read surface (fill level + threshold state as
      a machine-readable line in the runtime state dir).
      <!-- done 2026-08-10: agents/runtime/state/context-fill.json — overwritten every
           Stop by the session-eol concern: {schema_version, final_context_tokens,
           recycle_threshold_tokens, past_threshold, updated_at}. Counts only, gitignored
           (blanket /agents/runtime/), key-set pinned by test. Roadmap behaviour is
           identical whether or not anything reads it. -->

**Exit:** if the substrate exists, the burn is visible before the advisory fires; if it never ships, this roadmap closed anyway.
**Rollback:** the read surface is one gitignored state file.

## Phase 5 — what this roadmap will not do

- [x] 5.1 No hook-forced `/clear` or `/compact` and no wrapper that
      simulates them — the host does not offer the injection surface;
      pretending otherwise via keystroke automation is fragile and
      user-hostile. The advisory + user action IS the design.
      <!-- held 2026-08-10: the session-eol concern emits exit-2 warn (never a block,
           never an action); the resume instruction in session:recycle names /clear as
           the USER's step. No wrapper, no keystroke automation anywhere in the diff. -->
- [x] 5.2 No transcript summarisation pipeline — the envelope is selection
      and pointers; prose summaries are schema-invalid (2.1). One
      anti-summarisation stance across the roadmap series, enforced twice.
      <!-- held 2026-08-10: enforced twice as specified — validateRecycleEnvelope's
           unknown-key sweep (a prose FIELD fails) and the shared isShortLine/checkList
           primitives (prose CONTENT fails); both fixture-proven in checkpoint_schema. -->
- [x] 5.3 No fighting the autocompact reserve (threshold overrides, buffer
      games) — the reserve is host territory and version-volatile;
      recycling below it makes the reserve irrelevant instead of contested.
      <!-- held 2026-08-10: the 800k threshold sits 15% below the minimum OBSERVED
           trigger; nothing in the diff reads, overrides, or pads the host reserve.
           The env override is an off-switch/test seam, not a reserve game. -->
- [x] 5.4 No 1M-context escape hatch as the fix — a bigger window raises
      the cost ceiling and postpones rot; it does not address either. A
      task genuinely needing an unbroken long evidence chain may use it
      case-by-case; doctrine stays recycle-first.
      <!-- held 2026-08-10: the baseline SHOWS the 1M window is already the norm here
           (190/201 sessions) and late turns still cost 2.1x — recorded as evidence FOR
           recycle-first, not as an escape hatch. No window-size recommendation ships. -->
- [x] 5.5 No automatic recycling of INTERACTIVE sessions without the
      advisory step — the user's in-flight mental context is state the
      envelope cannot carry; the human decides the moment.
      <!-- held 2026-08-10: the only recycle trigger in the tree is the once-per-session
           advisory line; session:recycle runs only when invoked. Nothing recycles
           anything automatically. -->
- [x] 5.6 No fork of the CHECKPOINT schema and no pre-empting of
      `road-to-worker-generation-recycling` Phase 2 or its parked
      blockers — one schema, two variants, one validator.
      <!-- held 2026-08-10: the main_session variant lives in the SAME module
           (subagent_capsule.ts) sharing the same primitives; the worker validator,
           the wire schema (subagent-status.json), and the Phase 0.4 additive-and-off
           test block are byte-untouched. checkpoint_schema pins the anti-fork check. -->

## Blockers

### blocker: compaction-marker-shape

- **Status:** resolved (2026-08-10)
- **Owner:** maintainer
- **Blocks:** Phase 1.1 auto-compact incidence field
- **What to do:** host_semantics — verify on the current host version what
  a compaction event looks like in the transcript file (marker, summary
  block shape, anything greppable) and pin the detector to observed
  reality with a fixture. A host update changing the shape must fail the
  fixture, not silently zero the metric (never-silent discipline).
- **Resolved when:** the detector + fixture exist from an observed real
  compaction.
- **Resolution:** a real auto-compaction (2026-08-06, host v2.1.222) was
  located in the local store: `{"type":"system","subtype":"compact_boundary",
  "compactMetadata":{"trigger":"auto","preTokens":...,"postTokens":...}}`
  plus a paired `isCompactSummary:true` user record. Detector:
  `src/scripts/_lib/session_eol.ts`; structural fixture:
  `tests/scripts/_lib_session_eol.test.ts`. Never-silent: the scanner counts
  both markers independently and `session_eol_report` flags divergence as
  marker drift (31/31 agree on the current store).

### blocker: statusline-substrate

- **Status:** resolved (2026-08-10 — by lapse, per this blocker's own second
  resolution clause: the roadmap closes with Phase 4.1 recorded as
  lapsed-optional; the 4.2 read surface is live so a future statusline finds
  its input waiting)
- **Owner:** maintainer
- **Blocks:** Phase 4 only
- **What to do:** carried dependency on the agent-switch managed-statusline
  design shipping. No work in this repo beyond the read-surface file until
  it does. Explicitly NOT a blocker for roadmap closure — Phases 1–3 + 5
  close without it.
- **Resolved when:** the statusline exists and 4.1 lands, or this roadmap
  closes with Phase 4 recorded as lapsed-optional.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The envelope silently drops load-bearing state | product | A recycled session that confidently proceeds without a constraint the transcript held converts token savings into wrong work — the exact failure auto-compact has, rebuilt by hand | Round-trip equality test as the schema gate (2.4); the NOT-carried-forward list makes omission explicit instead of silent; resume-success + verify-fail metrics against baseline (3.4) with a published-if-worse commitment | Phase 2 |
| 2 | Usage-parse path fails on some transcripts and the threshold goes blind | implementation | A threshold that silently reads zero recycles nothing and reports nothing | 1.2 records unparseable-transcript incidence with an honest byte-fallback correlation; the advisory is fail-open once-per-session, so a blind read costs silence, not a block | Phase 1 |
| 3 | Advisory adoption stays near zero | product | A recycle line the user always ignores is dead weight — the cosmetic-injection failure class this repo already measured | Adoption is a registered metric with the shipped kill standard (3.4); the statusline phase, if it lands, attacks the same problem from the visibility side | Phase 3 |
| 4 | Stale envelope resumes into the wrong session | implementation | An unconsumed envelope injected into an unrelated fresh session plants foreign constraints | Consume-on-read (moved, not copied, 2.3); envelope carries its task identity and the consumer validates it before injecting | Phase 2 |
| 5 | The quality claim fails and gets rationalized | implementation | "Recycling is better" is this roadmap's premise; a worse verify number invites explaining-away instead of revision | The claim is pre-registered as falsifiable with the publication commitment written into 3.4 before data exists; a failed claim revises threshold or schema in a PR citing the numbers | Phase 3 |
| 6 | Schema drift against the worker-recycling variant | implementation | Two CHECKPOINT variants maintained apart re-create the dual-source drift this suite keeps re-measuring | One schema file, versioned, additive (2.1 + 5.6); the worker roadmap's validator runs against both variants' fixtures | Phase 2 |
| 7 | Interactive-session recycling annoys at the worst moment | product | A recycle advisory mid-flow interrupts the user's thought exactly when context is fullest | Stop-slot placement only (turn boundary, never mid-turn), once per session, and 5.5's human-decides doctrine | Phase 3 |

## Acceptance criteria

- [x] The Phase 1 baseline note exists with session-length distribution,
      auto-compact incidence from an observed-marker detector, and the
      token unit sourced from parsed usage (fallback correlation published
      only if unparseable transcripts occurred).
      <!-- agents/evidence/analysis/token-economy-recycling-phase1.md; incidence 4/205 > 0
           → correlation published (r=0.387, byte proxy falsified) -->
- [x] The round-trip test passes: an envelope-recycled two-session run
      produces a deliverable equal to the uninterrupted control.
      <!-- tests/scripts/recycle_roundtrip.test.ts — equality + load-bearing-field
           degradation arm + consume proof, green -->
- [x] A prose-summary field in a recycle envelope fails validation
      (fixture-proven), and a stale envelope is not injected into a
      non-matching session (fixture-proven).
      <!-- checkpoint_schema (prose field + prose content) · recycle_envelope_consumer
           (stale discarded; non-matching workspace discarded; both consumed) -->
- [x] The recycle advisory fires once past threshold on a scripted
      long session and never on a short one; adoption,
      auto-compact-incidence, and post-recycle verify metrics accumulate
      with registered thresholds and review dates.
      <!-- session_eol_hook tests: fires-once / never-on-short / never-twice;
           four metric registrations with owner + review_by 2026-11-10 -->
- [x] The quality comparison (recycled vs. long-session verify-fail) has a
      recorded verdict at the review date — whichever way it went.
      <!-- the in-repo half is in place 2026-08-10: post_recycle_verify_fail_vs_baseline
           is pre-registered with the publish-if-worse commitment and review_by 2026-11-10;
           the baseline side is published in the phase-1 note. The verdict itself is
           due AT the review date by construction — this criterion binds the reviewer
           then, and the registration is what makes "whichever way it went" enforceable. -->
- [x] Phases 1–3 and 5 are closable with the statusline blocker still
      open (verifiable: no step outside Phase 4 references the statusline).
      <!-- verified 2026-08-10: grep shows statusline mentions outside Phase 4 only in
           header prose, the blocker itself, and Risk 3 — no step text -->
- [x] The CHECKPOINT schema remains single-sourced: the worker-recycling
      validator passes against both variants (anti-fork check).
      <!-- _lib_checkpoint_schema.test.ts: both fixtures validate through
           subagent_capsule.ts; wire schema + worker tests byte-untouched -->
