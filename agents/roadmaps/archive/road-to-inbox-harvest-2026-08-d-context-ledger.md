---
complexity: structural
status: ready
---

# Road to a context ledger that captures before the state is destroyed

**Goal.** The context economy stops being warn-only where deterministic action
is available: the byte class nobody meters gets a meter, the one slot that fires
while state is being destroyed gets a writer, the recycle threshold learns the
window it is advising, expired session state gets collected by the sweeper that
already exists, and the payload ratchet gains a direction instead of a parked
destination.

**Source:** two proposal roadmaps that arrived in the inbox from two independent
runs of the same analysis prompt — an older pass pinned at `e44e87865` and a
newer one pinned at `e3bd96158`. Both are archived local-only at
`agents/tmp.old/context-custodian/`. This roadmap is their merge; the triage,
the claim-by-claim verification and the reasons three items were dropped:
`agents/evidence/analysis/inbox-harvest-2026-08-d-triage.md`.

## Context

Every claim below was re-verified against the tree at `e3bd96158`, not carried
over from either proposal.

- **The `pre_compact` slot carries one concern, and it is not a writer.**
  `src/scripts/hook_manifest.yaml:641` binds `language-mirror` and nothing else;
  the comment at `:635` states it is the only binding on the slot in the tree.
  An auto-compaction therefore destroys session state with no capture in front
  of it. The envelope writer exists, but on the Stop slot
  (`src/scripts/hooks/session_eol_hook.ts`), which a compaction does not reach.
- **Tool-result bytes are the largest context consumer and the only one with no
  meter.** `src/config/hook-token-budget.json:61` registers it verbatim:
  "bytes-into-context from tool RESULTS is not instrumented anywhere". The
  injection census covers hook payloads only.
- **The recycle advisory fires at a threshold derived from a window class it
  cannot detect.** `src/config/recycle-threshold-budget.json:8` holds a flat
  `800000`; `:10` states in its own `known_limitation` that a ≤200k-window
  session auto-compacts near 160–206k and is never served by it. The same field
  names the reason: the transcript carries no explicit window marker.
  Auto-compact incidence has a baseline — 23 of 205, 11.2 %
  (`src/config/hook-token-budget.json:76`).
- **Session-scoped runtime state has writers, readers, and no collector for its
  own directory.** `agents/runtime/state/{end-review-nudge,edit-shape,
  reread-guard,session-eol,…}/` accretes per session behind once-per-session
  latches. A TTL sweeper *does* exist — `src/scripts/janitor.ts`, run by
  `task janitor` / `task janitor-apply` — and its `TTL_CONFIG` covers
  `agents/tmp.old`, `agents/runtime/tmp` and `agents/runtime/council/responses`.
  It does not cover `agents/runtime/state/*`. **Neither proposal cited it**, and
  the older one proposed a new `agent-config state:gc` CLI instead. The work is
  a config extension, not a new surface.
- **The payload ratchet has a destination and no route to it.**
  `src/config/preamble-payload-budget.json:19` records `baseline_tokens:
  102520` against `target_tokens` of 40,000 median / 50,000 p95 (`:33-36`), and
  the ratchet fails on growth only — its own comment says so. Measured cold-start
  median is 230,930 (`:39`). On the delivery side,
  `src/config/budgets.yml:27-29,38-39` records both layers at 176,354 tokens and
  the project layer alone at 75,107, and names the lever: `paths:` scoping plus
  the digest, not dedup. `docs/contracts/rule-router.md:47,50-53` states that a
  rule without `paths:` loads unconditionally on Claude Code and that the
  residual gap is per-rule coverage rather than a missing mechanism. Coverage in
  the host-neutral projection is 0 of 115. **Corrected 2026-08-15:** that is one
  projection only — `.claude/rules/` carried 25 of 110, and scoping there
  *replaced* rather than extended the activation surface, so 19 rules had
  silently lost their keyword reach. Repaired under Step 5.2; the measurement
  and its cost are in the census page.

## What was dropped from the two proposals, and why

- **A new in-run context-diet advisory.** The newer proposal's third phase adds
  one, and the older proposal's own central argument refutes it: round 5
  measured that both blocking carriers reached zero violations and neither
  advisory carrier did (`src/scripts/hook_manifest.yaml:456-457,568`). Four of
  the six adoption metrics in `hook-token-budget.json` still carry "threshold:
  none committed before data — baseline first" with `review_by: 2026-11-10`.
  Adding an eleventh advisory before reading the tenth's baseline is the pattern
  both proposals were written to stop. It is a candidate for the review date,
  not for this roadmap.
- **A standalone adoption-readout phase.** The older proposal made the
  2026-11-10 readout its own phase. It is a date, not work: nothing can execute
  it before the date and nothing needs a plan to execute it after. Recorded here
  as the precondition on any future advisory instead.
- **A task key for `turns_per_task`.** `hook-token-budget.json:67` registers the
  metric as per-SESSION "until a task key ships". No task envelope exists to key
  against, and neither proposal names one — the older one says as much in its own
  step. Blocked on infrastructure that does not exist, with no urgency signal
  behind it.

Two corrections to the proposals are carried here rather than repeated: the
older one's claim that *every* adoption metric carries the baseline-first phrase
is 4 of 6, and the newer one's second phase treats the window signal as derivable
from `src/scripts/_lib/cc_transcript.ts` — that file parses `message.model`
(`:81,285`) but nothing in the tree maps a model string to a context window, and
the window is an account/flag distinction rather than a property of the model id.
That is why the spike below gates the threshold work.

## Phase 1 — Meter what is dark

- [x] 1.1 Extend the existing `post_tool_use` chain with a counts-only capture
      of tool-result bytes per call — `{ts, tool, bytes}` appended to the
      injection-census JSONL family. Disk-only, zero emission bytes, the same
      shape as `subagent-ledger`. Register its budget row in the same change;
      the CI gate that fails an emitting concern with no row is the backstop.
      <!-- verify: grep -c '"tool_result_bytes"' src/config/hook-token-budget.json -->
- [x] 1.2 Window-detection spike, pre-registered and honest-null capable: can
      the effective context window be established per session from what the
      transcript actually carries, or from observed auto-compact boundary sizes?
      Output is an evidence page either way. A negative verdict parks Phase 3
      with the null attached and does not block anything else here.
      <!-- verify: test -f agents/evidence/analysis/context-window-detection-spike.md -->

## Phase 2 — Capture before the state is destroyed

- [x] 2.1 Bind a capture writer to `pre_compact`, so a compaction is preceded by
      the same capture a Stop already gets. **Implemented as a binding
      extension, not a new concern** — the deterministic writer already exists
      as `hot-context` (bound on `stop` and `session_start`), and a second
      writer for the same cache would be the duplication this roadmap's own
      janitor finding argues against. `hot_context_hook.ts` gained
      `pre_compact` in its write branch; the concern gained the binding. No new
      budget row: it emits nothing on this slot.
      <!-- verify: grep '^    pre_compact:' src/scripts/hook_manifest.yaml | grep -c hot-context -->
- [x] 2.2 Join compaction events with envelope presence in the session-EOL
      report, so "state was destroyed" and "state was captured first" become one
      reading rather than two counters nobody correlates.
      <!-- verify: grep -c 'envelope' src/scripts/session_eol_report.ts -->

## Phase 3 — A recycle threshold that knows what it is advising

- [-] 3.1 Replace the flat `800000` with a `{window → threshold}` table.
      **PARKED on the published null — this is the gate firing as written, not
      a skipped step.** The step's own condition was "gated on 1.2 returning a
      usable signal". The spike
      (`agents/evidence/analysis/context-window-detection-spike.md`) returned
      **PARTIAL**: the model identifier does not yield the window (the 1M tier
      is an account/flag property, not a model property), and the only real
      signal — `compact_boundary.pre_tokens` — is observable *only after* the
      session has already compacted, i.e. after the event the advisory exists
      to prevent. A table keyed on a window nothing can establish before the
      first advisory would be a threshold invented rather than measured, which
      is the failure mode this roadmap's own Context section cites. The flat
      800k and its `known_limitation` field both stay, and the limitation is
      now backed by a measurement instead of an assumption.
      <!-- verify: grep -c 'PARTIAL' agents/evidence/analysis/context-window-detection-spike.md -->

## Phase 4 — Collect what accretes, with the sweeper that exists

- [x] 4.1 Extend `janitor.ts`'s `TTL_CONFIG` to cover the session-scoped state
      directories with a committed TTL carrying `owner` and `reviewBy`, the same
      discipline as the two budget files. No new CLI: `task janitor` already
      provides the dry-run and `task janitor-apply` the sweep. **Scoped to four
      named directories, not to `agents/runtime/state` as a whole** — that path
      also holds the cumulative measurement streams (`audit/`, the two census
      files, the telemetry JSONL), and a directory-level TTL would delete the
      corpora this roadmap exists to build.
      <!-- verify: grep -c 'runtime/state' src/scripts/janitor.ts -->
- [x] 4.2 Report reclaimed files and bytes per run, so the TTL has a falsifier:
      a reclaim that stays near zero over a full review window means the
      accretion was not real and the entry comes back out. **The fix was the
      ZERO case** — a run that reclaimed nothing printed no total at all, so
      "ran and found nothing" and "did not run" were byte-identical, and only
      the first of those can retire a TTL.
      <!-- verify: grep -cE 'reclaim' src/scripts/janitor.ts -->

## Phase 5 — Give the payload a direction

- [x] 5.1 Publish a `paths:` coverage census over `dist/agent-src/rules/` —
      per-rule, with the delivered token weight beside each. Coverage is 0 of
      115 at the base commit, so the census is a ranking exercise, not a
      discovery one.
      <!-- verify: test -f agents/evidence/analysis/rule-paths-coverage-census.md -->
- [x] 5.2 Act on what 5.1 found about scoping. **Blocked, and the blocker's
      question changed**: the census surfaced that 25 of 110 rules are already
      scoped in the Claude host projection and that scoping *replaces* rather
      than extends the activation surface, so 19 rules silently lost their
      keyword reach. Repairing or ratifying that comes before extending the
      scoped set, and both are consumer-visible.
      <!-- verify: grep -c 'derive_trigger_globs' agents/evidence/analysis/rule-paths-coverage-census.md -->
- [x] 5.3 Convert the parked 40k/50k destination into dated milestones in
      `preamble-payload-budget.json`, so the ratchet has a schedule rather than
      a target it only defends against growth. Milestones are recorded with
      their derivation; missing one is a published fact, not a silent slip.
      <!-- verify: grep -c 'milestone' src/config/preamble-payload-budget.json -->

## Acceptance criteria

- [x] Tool-result bytes have a meter, and its budget row exists.
- [x] A compaction is preceded by a capture, and the report says whether it was
      — as an aggregate reading, labelled `join_basis: aggregate` on every
      emission because the two sides come from corpora with no joining key.
- [x] The recycle threshold is either window-aware or carries a published null
      explaining why it cannot be. **It carries the null**
      (`context-window-detection-spike.md`).
- [x] The session-scoped state directories have a collector with a committed
      TTL and a reclaim figure that can falsify it. **Four named directories,
      not `agents/runtime/state/*`** — the cumulative measurement streams live
      under the same path and must not be swept.
- [x] The `paths:` coverage census is published and the payload ratchet carries
      dated milestones.
- [x] No new advisory line ships from this roadmap.

## Blockers

### blocker: paths-scoping-consumer-flip

- **Status:** resolved

- **Resolution:** 2026-08-15 — option (a), treated as a defect and
  repaired.** `_claude_paths_plan` now suppresses `paths:` for any rule that
  also declares keyword or phrase triggers, and reports each suppressed pattern
  rather than dropping it silently. Scoped rules went 25 → 6; the six that
  remain are path-shaped only, with zero keyword triggers between them.
  The repair is Claude-only, and that is the whole argument: globs are
  **additive** on Cursor and Windsurf but **exclusive** on Claude Code, and one
  emitter had been feeding both semantics from one list.
  **The cost is recorded, not hidden:** the 19 restored rules add ≈13,630
  tokens, about 12 % more rule payload per Claude session. That points at the
  same work the payload schedule does — those 19 should earn real `paths:`
  coverage or shed keyword triggers they do not need. The repair made that
  visible instead of paying for it with capability nobody chose to give up.
- **Owner:** user
- **Blocks:** Step 5.2
- **Question:** **The premise changed and the question narrowed.** Scoping is
  not a future option — it is live: `.claude/rules/` carries **25 of 110**
  scoped rules today, emitted from existing path-shaped `triggers:` entries.
  And it is not additive: `condense.ts::derive_trigger_globs` keeps only
  `file_pattern` / `path_prefix` and drops `keyword:` / `phrase:`, so a scoped
  rule's `paths:` block becomes its *whole* gate on Claude Code, Cursor and
  Windsurf. **19 of the 25 also carry keyword triggers** and therefore lose
  their conversational reach there — `design-fidelity` loses 21 of them, in
  exactly the handover classes its own routing section says it exists to catch.
  Meanwhile the safely-scopable remainder is small: about 4 % of the rule
  payload. So the question is no longer "may we scope" but "what do we do about
  what is already scoped".
- **What to do:** pick exactly one — (a) treat the keyword-drop as a **defect**
  and repair the emitter so path and keyword triggers OR together, leaving the
  25 scoped rules in place with their reach restored; (b) treat it as
  **intended** and record the trade-off in `rule-router.md` so the next reader
  finds a decision instead of a surprise, leaving behaviour unchanged; or
  (c) **narrow the blast radius** by removing the path triggers from the rules
  whose obligation is conversational (`design-fidelity`,
  `settings-ask-protocol`), so they return to unconditional loading, and leave
  the emitter alone.
- **Resolved when:** the user states which of (a), (b) or (c) holds. Extending
  the scoped set is a separate, smaller decision that only becomes worth making
  after this one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The window spike returns a null and Phase 3 is the reason the roadmap existed | product | The threshold work is the most visible item here, and it rests on a signal the config file itself says the transcript does not carry | 1.2 is pre-registered as honest-null capable and parks only Phase 3; Phases 1, 2, 4 and 5 carry no dependency on it | Phase 1 — Meter what is dark |
| 2 | A `pre_compact` writer runs at the worst possible moment and costs latency where the host is already under pressure | implementation | The slot fires when the host is about to compact, so a slow concern there degrades exactly the session it is trying to protect | The writer reuses the existing envelope path rather than computing anything new, and ships with a budget row that the per-slot sum cap enforces | Phase 2 — Capture before the state is destroyed |
| 3 | Scoping rules silently removes guidance a consumer relied on | product | A rule that stops loading outside its paths is a capability loss the consumer never asked for and cannot see | 5.2 is blocked on an explicit user decision, and the census in 5.1 lands first so the decision is made against per-rule weights rather than in the abstract | Phase 5 — Give the payload a direction |
| 4 | The TTL entry reclaims nothing and becomes maintenance with no payload | implementation | The accretion claim rests on directory listings, not on measured growth over time | 4.2 reports reclaimed files and bytes so a near-zero reading over a review window removes the entry rather than defending it | Phase 4 — Collect what accretes, with the sweeper that exists |
| 5 | This roadmap grows the meter estate it exists to discipline | implementation | Two new meters, a census and a TTL entry are themselves governance surface in a package whose own reviews ask it to shrink | Every addition is disk-only or a config row, no new CLI and no new advisory ships, and the dropped-items section records what was declined for exactly this reason | What was dropped from the two proposals, and why |
