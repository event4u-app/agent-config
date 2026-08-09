---
complexity: structural
status: ready
---

# Road to orchestrator discipline carriers — the delegation obligation and the end-review obligation get mechanisms that reach real sessions

> Five session transcripts (2026-07-21 → 2026-08-08) measure the defect: 0, 0,
> 7, 6, 2 subagent dispatches out of 245–403 tool calls each, ~99 % serial
> single-tool responses, main-agent contexts grown to 582k and 887k tokens
> without compaction, and **zero neutral end-of-task reviews** — every session
> self-attests "CI green, ready for review". The code-verified cause chain:
> `delegation-policy.md` is tier-2b and no host runs the rule router, so the
> obligation is never in context; `classifyTask` has zero production callers
> and zero signal producers; `host_capability.ts` safe-defaults all-false so
> every fresh install ships delegation dead; no unconditional end-review
> mandate exists anywhere; `orchestration_record` is model-carried (measured
> capture 1 of 370 = 0.27 %); tier downshift has zero callers and the model
> selected UP (27 of 39 metric-bearing dispatches on an Opus tier).

> Council provenance (inline per no-roadmap-references): 2026-08-08, members
> anthropic/claude-sonnet-4-5 + openai/gpt-4o, prompt mode, $0.075 actual.
> Second pass 2026-08-09 (post-merge, same members, $0.095): the release
> gate escalated the 3538-line diff to a full council review, which the
> merge had skipped; the catch-up ran over the security-critical core
> (end_review_nudge + telemetry shape IN FULL — the 50 KB bundle ceiling
> forced that scope; the rest was covered by the pre-merge in-session
> reviewer + two gate lenses). Verdict: path validation on
> transcript_path is mandatory and the fd47df62 high-to-low downgrade is
> sound only WITH it; the 16-hex session-key truncation is a telemetry-
> integrity defect (collisions suppress counts — use full SHA-256); the
> once-per-session dedupe undercounts multi-phase sessions and the bias
> must be recorded before any blocking calibration; privacy shape
> confirmed robust. One council suggestion rejected with reason: prefix-
> validating under workspace_root would reject every real transcript
> (they live under the user home, not the workspace) — the shipped check
> is home-prefix + .jsonl + size cap.
> Convergent verdict: ship F5 + F1 + F6 first (F6 explicitly promoted ahead of
> the nudges — without deterministic telemetry the nudges' effect is
> unmeasurable); F3 and F4 only as conditional, advisory LITE variants (the
> session-canary round-5 evidence — 24/29 misses WITH a per-turn carrier —
> condemns cosmetic injection, not decision-support injection; that
> distinction is untested and therefore gated here); CUT F2 (kernel promotion:
> no router fires it, 24 h soak buys nothing); the ignored explicit user
> instruction and the cross-session duplicate work are separate bug classes
> and stay out of scope as blockers.

## Goal

A fresh install of this package on a spawn-capable host carries the
delegate-by-default obligation and the end-review obligation into every real
session through deterministic carriers (registry + always-loaded surface +
hooks), emits `orchestration_record` telemetry deterministically instead of
model-carried, and does all of it advisory-first so the blocking decision is
made on measured data rather than on hope.

## Prerequisites

- [x] Measured session evidence: five transcripts analysed by independent
      readers (dispatch counts, serial ratios, context growth, zero
      end-reviews) — summarised in the header blockquote.
- [x] Code-verified cause chain with file:line for every break (steps 1–8 of
      the analysis; key anchors: `src/scripts/_lib/auto_dispatch.ts:60-95`,
      `src/scripts/_lib/host_capability.ts:26-37`,
      `src/scripts/hook_manifest.yaml` concern table,
      `src/rules/delegation-policy.md:1-18` frontmatter).
- [x] Working hook precedent for a per-turn advisory carrier
      (`session-canary`, bound on `session_start` + `user_prompt_submit`).
- [x] Council pass on the fix portfolio (provenance inline above).

## Context (verified against the tree, do not relitigate)

- **The settings gate is green but fragile.** `subagents.auto: "on"` plus the
  `host_capabilities` override live in the gitignored project-local
  `.agent-settings.yml` — every fresh clone and every consumer install starts
  with delegation silently dead because `SAFE_DEFAULT` in
  `host_capability.ts` is all-false and no registry exists.
- **`classifyTask` is no-runtime by design** (recorded in the archived
  subagent-value-realization roadmap): its only non-test importer is the
  `routing:doctor` diagnostic. Nothing extracts `parallelizable` /
  `independent_slices` / `size_estimate` from a real prompt. Giving it a
  production caller is a designed extension point, not a repurpose.
- **Claude Code loads neither `dist/router.json` nor `.claude/rules/`.** The
  always-loaded surfaces are AGENTS.md (via CLAUDE.md symlink) and the hook
  injections. AGENTS.md currently contains zero occurrences of
  "delegate"/"subagent"/"orchestrat". Any obligation that must reach every
  session must ride one of those two surfaces.
- **Delivery is the trap, not the exit code alone.** Verified during
  implementation: the repo dispatcher discards a concern's `context` field at
  severity `allow` on every slot except `session_start` — an "exit 0 +
  context" advisory is a structural no-op on `user_prompt_submit`/`stop`
  (which likely explains part of the canary 24/29 misses). The working path
  is the language-mirror mechanism: dispatcher-internal `warn` whose
  `additional_context` `emitFor` forwards at host-facing exit 0 — never a
  block (`host_semantics.emitFor` returns exit 0 for `warn` unconditionally).
  Every advisory concern in this roadmap is host-facing exit 0 on every path.
- **The canary counter-evidence is real and bounded.** A per-turn cosmetic
  reminder produced 24/29 misses. The claim that *decision-support* injection
  (concrete slice verdict + tier recommendation) behaves differently is a
  hypothesis this roadmap tests with F6 telemetry — it is not assumed.
- **`team-review-gate` already exists on the `stop` slot** but is no-op by
  default (`ai_team.enabled: false`, `review_gate.managed: false`). The F4
  carrier composes with it rather than duplicating it: the new concern is the
  advisory/telemetry tier; the existing gate stays the managed/blocking tier.
- **Kernel stays at 9.** No kernel rule is touched; the kernel-prefix
  byte-stability gate must therefore stay green untouched (measured trap:
  batch sweeps that touch kernel rules red the gate).

## Phase 1 — F5: committed host-capability registry

- [x] 1.1 Add a small committed registry to
      `src/scripts/_lib/host_capability.ts`: known host identifiers map to
      observed capability sets (Claude Code → `subagent_spawn: true`,
      `parallel_spawn: true`; polling/quota stay `false` — only what was
      observed). Unknown hosts keep the all-false safe default.
- [x] 1.2 Resolution order becomes: explicit `subagents.host_capabilities`
      settings override (wins) → committed registry row for the detected
      host → all-false. The gitignored override keeps working unchanged.
- [x] 1.3 Unit tests: registry hit, registry miss (all-false), override
      beats registry, strict-true coercion unchanged.
      <!-- verify: npx vitest run tests/scripts/_lib_host_capability.test.ts -->
- [x] 1.4 Verify end-to-end with `classifyTask` directly (not by reading
      settings): a probe task with `independent_slices: 3` on the detected
      host must return `dispatch` given `auto: on`, with no
      `host_capabilities` override present (the registry alone opens the
      spawn gate; absent `auto` resolves to `ask`, which is the gate open
      in ask-mode, not closed).

**Exit:** a fresh clone on Claude Code resolves `subagent_spawn: true` with zero manual settings (classification then follows `subagents.auto`: absent → `ask`); unknown hosts unchanged.
**Rollback:** registry is one table + one lookup in a single file; revert restores pure safe-default.

## Phase 2 — F1: the obligation reaches the always-loaded surface

- [x] 2.1 Add the delegate-by-default and end-review obligations to AGENTS.md
      as two to three sentences with a pointer to
      `dist/agent-src/rules/delegation-policy.md` — stated obligation, not
      bare pointer (a pointer no host follows is the current defect).
- [x] 2.2 Mirror the same lines into `src/agent-src/templates/AGENTS.md` so
      consumer installs carry them.
- [x] 2.3 Both files must stay inside the `agents-md-thin-root` contract
      (char ceilings, ≥ 40 % pointer ratio, emergency-triage block intact).
      <!-- verify: npx tsx src/scripts/lint_agents_md.ts 2>/dev/null || task lint-skills -->

**Exit:** grep for "delegat" over AGENTS.md returns the obligation; thin-root lint green.
**Rollback:** two files, a few lines each.

## Phase 3 — F6: deterministic orchestration telemetry

- [x] 3.1 Add an `orchestration-record` concern on the `post_tool_use` slot
      (same carrier as `context-hygiene`): when the completed tool call is an
      `Agent`/`Task` dispatch, emit one `orchestration_record` line via the
      existing CLI/lib — deterministic, no model step. Reuse the existing
      privacy-by-construction event shape; emit only derived ids, defined
      enums, measured numbers (recorded trap: host-supplied opaque values in
      tracked artifacts trip secret/source gates).
- [x] 3.2 Async dispatches carry no metrics at completion time (measured:
      326 of 370) — record the dispatch fact with `metrics: absent` rather
      than fabricating; sync dispatches record the real usage fields.
- [x] 3.3 Register the concern in `src/scripts/hook_manifest.yaml`, exit 0
      always, `fail_closed: false`. Bound on `post_tool_use` for every
      platform carrying that slot (augment, claude, cowork, cursor, cline,
      gemini — windsurf has no `post_tool_use` surface) with `tools: [Agent,
      Task]`; registered in `hooks/concern_registry.ts` for the in-process
      dispatch path.
- [x] 3.4 Tests: dispatch event → one line written; non-Agent tool → no line;
      malformed payload → silent exit 0 (never a block).
      <!-- verify: npx vitest run tests/scripts/orchestration_record_hook.test.ts -->

**Exit:** capture rate for new in-session dispatches is structural (hook-carried), not model-carried; the 0.27 % measured rate becomes obsolete for future sessions.
**Rollback:** one concern binding + one hook file.

## Phase 4 — F3-lite: conditional delegation nudge (advisory, decision-support only)

- [x] 4.1 Add a `delegation-nudge` concern on `user_prompt_submit`: extract
      cheap signals from the submitted prompt (enumerated file lists,
      "for each"/"alle …"-shapes, explicit slice counts, multi-deliverable
      conjunctions) and call `classifyTask` with them — its first production
      caller, and the missing signal producer.
- [x] 4.2 Inject ONLY on a positive verdict (`do-in-parallel` /
      `do-in-steps`): one line naming the mode, the slice count, and the tier
      recommendation for slices (downshift default from
      `resolveSubagentRouting` — its first production caller). No match →
      inject nothing. This is the anti-canary condition: silence by default,
      decision support on signal, never etiquette.
- [x] 4.3 Never blocks the turn — corrected from the original "exit 0
      unconditionally" plan. That shape never delivered `additional_context`
      to the model on ANY platform (`dispatch_hook._parse_concern_stdout`
      discards a non-JSON/no-`reason` reply, and `host_semantics.emitFor`'s
      `severity==="allow"` branch discards stdout unconditionally regardless
      of platform) — a genuine caveat this task's own header once recorded.
      Fixed by mirroring `language_mirror_hook.ts`'s shipped, verified
      pattern instead: `{decision:"warn", reason, additional_context}` at
      exit 2. Verified against `host_semantics.emitFor`
      (`src/scripts/hooks/host_semantics.ts`): its `severity === "warn"`
      branch returns real host-facing exit 0 UNCONDITIONALLY — it never
      consults `CLAUDE_BLOCK_CAPABLE_EVENTS` (that set only gates the
      `"block"` branch) — so the dispatcher-internal exit 2 never reaches
      Claude Code as a block, on `user_prompt_submit` exactly as on every
      other event. Empirically confirmed end-to-end through
      `dist/hooks/dispatch.js`: a firing prompt produces host exit 0 with
      `hookSpecificOutput.additionalContext` carrying the verdict line; a
      non-matching prompt produces host exit 0 with no delegation-nudge
      content. Bound only on `claude` + `cowork` (not the full
      `language-mirror` platform list) — `cowork` qualifies because its
      trampoline (`cowork-dispatcher.sh`) discards the dispatcher's exit
      code and stdout unconditionally, so no exit code choice there can
      reach the host as a block, independent of `host_semantics`.
- [x] 4.4 Tests: matching prompt shapes inject the verdict line; ordinary
      prompts inject nothing; classifier errors degrade to silence.
      Recorded per gate finding 1ba56660: the signal floors (3 unique
      files, 3 ordered-plan lines) are POST-HOC choices made from review
      false-positives, not pre-registered stopping rules — the telemetry
      measures their precision, and the pre-authorised null (7.4) already
      covers their removal.
      <!-- verify: npx vitest run tests/scripts/delegation_nudge_hook.test.ts -->

**Exit:** a prompt like "fix the failing tests in these 6 files" produces an injected `do-in-parallel (6 slices, lite tier)` line; "why does X happen?" produces nothing.
**Rollback:** one concern binding + one hook file; removing both restores today's behaviour exactly.

## Phase 5 — F4-lite: end-review carrier on stop (advisory + telemetry, not blocking)

- [x] 5.1 Add an `end-review-nudge` concern on the `stop` slot: fires only
      when the turn mutated tracked files beyond a threshold (default:
      > 50 changed lines outside `*.md`/docs — the council's high-risk shape)
      AND no reviewer ran this session (no Agent dispatch whose prompt is
      review/judge-shaped, and no `review-changes`/judge skill invocation).
- [x] 5.2 On fire: inject one advisory line — "this session mutated N lines
      without a neutral review; spawn a cross-model reviewer before claiming
      done (delegation-policy / verify-budget)" — and emit ONE
      `review_skipped` telemetry line with the diff size, once per session
      (local state dedupe; the line itself carries no session id).
      Host-facing exit 0.
- [x] 5.3 Blocking stays out of this roadmap by design: the block threshold
      is set from the telemetry this concern produces (see blocker
      `f4-full-blocking-decision`). The existing `team-review-gate` remains
      the managed/blocking tier and is not modified. Confirmed by
      construction: this concern only ever reports dispatcher-internal exit
      2 (warn) on a fire, never exit 1 (block); like `delegation-nudge`
      (4.3), that exit is verified (via `host_semantics.emitFor`) to reduce
      to a real host-facing exit 0 on `claude`/`cowork`, mirroring
      `language-mirror`'s shipped, non-blocking pattern rather than
      `team-review-gate`'s own `stop`-slot emission (checked as a candidate
      and found NOT to deliver its notice to the model at all on `claude` —
      a pre-existing gap in that concern, out of this task's scope to fix).
- [x] 5.4 Tests: mutation-above-threshold + no reviewer → injection +
      telemetry line; doc-only diff → silence; reviewer ran → silence.
      <!-- verify: npx vitest run tests/scripts/end_review_nudge_hook.test.ts -->

**Exit:** every mutating no-review session is COUNTED (`review_skipped` telemetry, once per session — verified). The advisory line is delivered at dispatcher level; whether the host forwards `additionalContext` on `stop` to the model is UNVERIFIED (Claude Code documents it for UserPromptSubmit/SessionStart/PostToolUse, not Stop) — the model-facing carrier for the end-review obligation is the AGENTS.md line plus this telemetry, and the delivery question is folded into blocker `f4-full-blocking-decision`.
**Rollback:** one concern binding + one hook file.

## Phase 6 — honest documentation and downstream sync

- [x] 6.1 Update `src/rules/delegation-policy.md`: name the carriers that now
      exist (registry, AGENTS.md line, nudge concerns) and state what remains
      model-carried (the decomposition itself, verify-per-return). No
      enforcement claim beyond what the hooks actually check.
- [x] 6.2 Where downshift/savings are still unwired after this roadmap,
      the touched docs say "aspirational" explicitly (council F6 condition).
- [x] 6.3 Run the projection/generator chain for the touched rule + AGENTS.md
      surfaces (`task sync` then `task generate-tools`; regenerate index and
      proof artefacts per the four-generator obligation for rule edits).
- [x] 6.4 Changed-files static pass (typecheck via task, targeted vitest for
      the three new hook tests + host_capability tests).

**Exit:** docs claim exactly what is enforced, projections byte-consistent, targeted tests green.
**Rollback:** doc lines + regenerated projections follow the source revert.

## Phase 7 — what this roadmap will not do

- [ ] 7.1 No kernel promotion of `delegation-policy` (council CUT: no router
      fires it; the AGENTS.md line + hooks are the reach mechanism).
- [ ] 7.2 No blocking gate anywhere in this PR — every new concern is
      host-facing exit 0 on every path (dispatcher-internal `warn` included).
      A future blocking proposal must cite the F4-lite telemetry distribution.
- [ ] 7.3 No cross-session coordination mechanism (see blocker — different
      bug class: session registry / file-overlap detection, not delegation).
- [ ] 7.4 No claim that the nudges change behaviour — that is what the F6 +
      F4-lite telemetry exists to measure; the null (nudges ignored like the
      canary) is a pre-authorised outcome that removes the nudge concerns.

## Blockers

### blocker: user-instruction-compliance

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — separate bug class
- **What to do:** one measured session received an explicit "use subagents &
  AI council" instruction and produced 2 dispatches in minute 5 and zero
  council runs. Diagnose whether it is a planning-execution gap (agent
  acknowledges, then forgets) or a directive-priority gap (efficiency
  instinct outranks user voice) by tracing the instruction through that
  transcript, then decide the mechanism (commitment-check hook vs directive
  escalation).
- **Resolved when:** the diagnosis is recorded and a mechanism decision made.

### blocker: cross-session-dedup

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — different mechanism class
- **What to do:** two concurrent sessions fixed the same bug (PRs #1217 and
  #1218, four merge conflicts). The session-register hook already announces
  live sessions; it does not check file/topic overlap. Decide whether a
  files-touched registry with overlap warning is worth its cost.
- **Resolved when:** decision recorded — build, defer, or drop.

### blocker: f4-full-blocking-decision

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any blocking end-review gate
- **What to do:** after the F4-lite telemetry has accumulated a usable
  distribution of `review_skipped` events, decide the block threshold (the
  council's working hypothesis: high-risk diff lines, differentiated from
  doc/test-only churn) and whether the block lands in the new concern or in
  the existing `team-review-gate` managed tier. Same decision owns the
  stop-slot DELIVERY question: Claude Code documents `additionalContext`
  for UserPromptSubmit/SessionStart/PostToolUse but not Stop, so the
  advisory line's model delivery on `stop` is unverified — the documented
  model-reaching mechanism on Stop is `decision: "block"` + reason, which
  is exactly the blocking tier this blocker gates. Two recorded biases the
  calibration MUST account for (council 2026-08-09): once-per-session
  dedupe undercounts multi-phase sessions (only the first threshold
  crossing is recorded — set a conservative, higher threshold), and
  `mutation_measure: capped_approximation` lines are floor values, not
  measurements — calibrate on `exact` lines only.
- **Resolved when:** threshold decision recorded with the telemetry cited.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-09 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The nudges repeat the canary failure | product | The only measured per-turn carrier (session-canary) produced 24/29 misses; injected advice may simply be ignored again and the whole nudge layer becomes token cost without behaviour change | 4.2 makes injection conditional (silence by default) so the cost is near-zero on non-delegable turns, and 7.4 pre-authorises the null that removes the concerns; F6 telemetry is shipped first so the effect is measurable at all | Phase 4 |
| 2 | A hook defect blocks every turn | implementation | A concern that crashes or emits a block-shaped reply could halt real work far beyond delegation | Every new concern reduces to host-facing exit 0 on every path — silent paths exit 0 directly, firing paths use the verified `warn`/`emitFor` mechanism that never blocks; crashes fall to `fail_closed: false`; tests cover the malformed-payload path (3.4, 4.4, 5.4) | Phase 3 |
| 3 | More delegation costs more, not less | product | 27 of 39 measured dispatches resolved to an Opus tier; nudging toward delegation without tier discipline amplifies the expensive pattern | 4.2 puts the downshift recommendation into the injected line itself (first `resolveSubagentRouting` caller); the cost thesis stays open until F6 telemetry measures it | Phase 4 |
| 4 | The registry over-claims host capabilities | implementation | A committed registry row asserting spawn support on a host where it degrades (headless, CI, restricted modes) would turn the safe-default inversion into misclassification | 1.1 registers only observed capabilities and only for the host this repo measured; everything else stays all-false; the settings override retains top precedence (1.2) | Phase 1 |
| 5 | The end-review nudge becomes completion theater | product | An advisory line at stop time can be satisfied by narrating "review not needed", producing the same self-attestation with extra steps | 5.2 counts every skip as telemetry regardless of narration, and the blocking decision is deliberately deferred to measured data (blocker f4-full-blocking-decision) rather than to self-report | Phase 5 |
| 6 | AGENTS.md grows past the thin-root contract | implementation | The obligation lines compete with a hard char ceiling and pointer-ratio floor; a careless edit fails the lint or evicts higher-value pointers | 2.3 runs the thin-root lint as the step's own verify; the obligation is capped at two to three sentences by design | Phase 2 |
| 7 | Deterministic telemetry emits unsafe values | implementation | The hook sees host-supplied payloads; a recorded trap shows opaque ids and free-form values tripping secret/source gates in tracked artifacts | 3.1 restates the privacy-by-construction rule (derived ids, defined enums, measured numbers only) and reuses the existing event schema instead of widening it | Phase 3 |

## Acceptance criteria

- [ ] A fresh clone on this host resolves `subagent_spawn: true` from the
      committed registry with no manual settings; with `subagents.auto: on`
      a 3-slice probe classifies as `dispatch` (absent settings resolve to
      `ask` — there is no defaults layer — so the fresh-clone verdict is
      `ask`, which is the gate OPEN, not the gate closed).
- [ ] AGENTS.md and the consumer template state both obligations and pass the
      thin-root contract.
- [ ] An in-session Agent dispatch produces an `orchestration_record` line
      with zero model involvement; a non-Agent tool call produces none.
- [ ] A delegable-shaped prompt receives exactly one injected verdict line; a
      non-delegable prompt receives none; no new concern can reach the host
      as anything but exit 0.
- [ ] A mutating no-review session produces exactly one `review_skipped`
      telemetry event (per session), and the advisory line is present in the
      dispatcher output on `stop`; doc-only sessions stay silent. (Whether
      the host forwards stop-slot context to the model is an open question
      owned by blocker `f4-full-blocking-decision` — not claimed here.)
- [ ] Every touched doc claims only what the shipped mechanisms check; the
      null outcome for the nudge layer is written down before any behaviour
      data exists.
