---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
basis_pin: 33d7f74af1f070b35e74f8718388102acae8dcfd
consolidates:
  - road-to-trigger-delivered-rule-bodies-v2
  - road-to-executable-simplicity-and-portable-runtime
estate_offset_exempt: "No active roadmap owns the subject — whether the router's 745 triggers over 80 tier-2 rules can DELIVER rule bodies at runtime instead of describing them. The three neighbours own strictly different axes: road-to-standing-payload-diet owns body length, later/road-to-mixed-trigger-activation-cost owns paths: scoping, later/road-to-deferred-rule-retriever owns a command-invoked retriever. Offsetting this against any of them would delete an axis rather than fold it, so the addition is carried unoffset and ships status: draft — the owner's flip is where the estate charge lands."
estate_growth_exempt: "Two blockers are filed open (b-subagent-payload-trigger-match, b-behavioural-equivalence-unmeasurable). Both are genuinely open: the first is answered only by a probe against the installed binary, the second by a standing decision (ADR-202, three closures) that this roadmap does not reopen. Neither can be resolved at authoring time, so the estate carries +2 blocker rows rather than a pair of pre-answered placeholders."
---

# Road to trigger-delivered rule bodies — a thin standing projection plus hook-injected bodies, gated only on what can still be measured

> **Source:** the surviving roadmap draft of an inbox bundle dropped on
> 2026-08-22 and consumed into the gitignored `agents/tmp.old/` archive. Its
> exact path is
> `ENC1:JhN6KzYRtUmObLIq5q4+ebXSER4+U1ZpLtHjv1wa07exiuvDfUHet33y8ixxA006u1upPdXd0EpeImPJk5A1hb6LpA5UXlQbrs2KdnsNKSajqp5DwrOfCHtUUF1OwbACHFZE/sarBY8S9yFima8dDiFAn6OEOpmkp/7f99Q4jy86k1p5PUy3`
> — decrypt with `./scripts-run src/scripts/_lib/link_crypto decrypt --value <token>`.
> A token rather than plain text because the directory segment carries the
> harvested suite's name; `source-confidentiality` forbids the tracked tree
> recording which third-party package seeded an idea, and the token resolves to
> the full path for anyone holding the key. The suite itself is `Source A` in
> `## Provenance`. It came from
> an external analysis session (two models, six loops), 2026-08-22, drafted
> against `33d7f74af`. Adopted via `/analyze:inbox` after per-claim verification
> against `f6703b78a`. **Four claims were refuted at the drafting SHA and are
> corrected here**: the tier-2 rule count (85 → 80), the D2 `paths:` evidence
> (a grep that returns zero by construction), the D6 root-cause gap (already
> shipped, narrowed to its one surviving delta), and the review-lens count
> (five → six routes). A sibling draft
> (`road-to-trigger-delivered-rule-bodies-v2.md`, 904 lines) and a predecessor
> (`road-to-executable-simplicity-and-portable-runtime.md`) were
> cross-examined and dropped as files; their surviving deltas are folded in
> below and tagged `corrected-from-reproduction`.
>
> **Source anonymisation (`source-confidentiality`).** The external
> agent-instruction suite that seeded four of the mechanisms below is
> `Source A (an external agent-instruction suite, MIT)` @ `2ed6c52c`. The real
> identifier is not written into this tree; see § Provenance.
>
> **This is a proposal.** Nothing in it is adopted, and nothing in it may be
> cited elsewhere as a foundation until the phase that would establish it has
> its `verify:` line green. Figures marked *(proposal)* come from the analysis
> session's scratch measurement and must be re-derived by Phase 0 from a
> committed script before any later phase leans on them.

## Goal

On a default Claude Code install, a session carries the **kernel** (9 rules)
in standing context and receives every other rule's **body** only when one of
its triggers fires — on the prompt, or on the file being touched — delivered by
a hook rather than by a pointer the model is asked to follow. The flip away
from `lean_projection.mode` = default is licensed by three deterministic
endpoints (delivery census, labelled-corpus recall, priced cost) plus one live
census, by the owner, and only for Claude; the one endpoint nobody can
currently measure — behavioural equivalence — is stated as unmeasured rather
than assumed.

"Smaller preamble" is the consequence this roadmap measures, not the goal it
assumes. The pre-registered null is that trigger recall on the labelled corpus
falls below its floor for rules that are not cheaply fixable — in which case
the default does not move, the recall table is published, and Phases 0–1 still
stand on the defects they close.

## Context — verified in the tree at `33d7f74a`, re-verified at `f6703b78a`

- **D1 — the per-spawn preamble is RED and drifting.**
  `check_preamble_payload_budget` reads **135,575 tok against a 107,646
  ceiling** (project-scope rules **120,368** · preloaded skills catalog 14,461
  · CLAUDE.md hierarchy 746), against `baseline_tokens: 102520` in
  `src/config/preamble-payload-budget.json`. Every rule description here is
  re-written on **every** subagent spawn, so growth is paid per spawn.
  **Body length is owned by `road-to-standing-payload-diet` (status: ready),
  not here.**
- **D2 — the router routes nothing at runtime.** `dist/router.json` carries
  9 kernel + 24 tier-1 + **80 tier-2** entries and **745 triggers** — keyword
  480 · phrase 204 · path_prefix 41 · file_pattern 13 · command 7. Four rules
  carry no trigger at all (`no-roadmap-references`, `skill-quality`,
  `source-confidentiality`, `rule-type-governance` — all maintainer-workspace).
  **The evidence that nothing consumes the router at runtime is the reader
  census, not a `paths:` grep:** `grep -rln router.json src/ scripts/ hooks/`
  resolves to `compile_router`, `rule_trigger_eval`, `trigger_coverage`,
  `project_thin_rules`, `router_telemetry`, a handful of lint/smoke scripts and
  docs — and **zero readers under `src/scripts/hooks/`**. The thin projector
  itself is wired (`src/scripts/condense.ts:1129`, mode selected by
  `lean_projection.mode: thin` in `.agent-settings.yml`, read by
  `_lean_projection_mode()` at `condense.ts:461`).
  *(The drafting session's evidence for D2 was `grep -l '^paths:'
  dist/agent-src/rules/*.md → 0`. That grep returns zero **by construction**:
  `paths:` is host-emitted, never present at the `dist/` layer — see
  `src/scripts/check_rule_activation_census.ts:132,146`, "the emitter gives it
  `paths:`" / "the emitter drops `paths:` entirely". The claim is sound; that
  particular evidence was not, and is replaced above.)*
- **D2a — the quality instrument for thin-vs-eager is closed, three times.**
  `docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md`:
  paired judging, LLM or human, is "not admissible for this question" (`:69-71`);
  "0.48 is not inherited" (`:83`, `:146`); inter-evaluator Cohen's κ **0.472**
  against a registered floor of **0.800**, "the final honest null" (`:402-407`).
  The ADR's `review_trigger` (c) — a judge substrate with measurable
  reliability — has not fired. **Any gate here that depends on a model judging
  transcripts is inadmissible by standing decision, and the 48 % bar is not
  reinstated by this roadmap.**
- **D2b — what *is* deterministic and already in the tree.**
  `tests/eval/routing-matrix/`: **94 yaml files, 46 carrying `open_files`**.
  `src/scripts/trigger_coverage.ts` is green at 26/26 and its matcher semantics
  are the contract ("a tier rule fires iff any of its triggers matches").
  *(proposal — re-derive in 0.3)* keyword/phrase-only matching over that corpus
  recalls ~0.90 of labelled positives with zero near-miss false fires, and the
  residual misses concentrate in path-triggered rules — the prompt alone cannot
  fire a file trigger, which is a binding-slot fact, not a matcher defect.
- **D2c — the activation split is a hard ratchet, and any scoping flip fails
  it by design.** `src/scripts/check_rule_activation_census.ts` pins the
  **scoped and mixed rule ID SETS by identity** (a count-only check can be
  satisfied by one rule in and one rule out; an id-set check cannot) and
  ratchets the **unconditional corpus token total DOWN only**. HEAD reads
  **4 scoped · 17 mixed · ~111.6k unconditional tokens (exact BPE) · 119 rule
  files**, against `src/config/rule-activation-census.json`. The gate NAMES the
  movers on failure and `--write-baseline` is the only path that changes the
  numbers. **Neither drafting session mentioned this gate; it is the largest
  omission the verification pass found.**
- **D3 — the demand datum is empty.** `rules_efficiency`
  (`src/config/dispatch-economy-metrics.json:50`) is defined as
  `rules_used / rules_carried` per worker envelope with a low-quota bar of 0.2;
  `dispatch_economy_report` prints `envelopes with pair=0 · median quota=— ·
  low-quota signal (< 0.2): no data`. `later/road-to-deferred-rule-retriever`
  gate (2c) reads that metric and can therefore never fire.
- **D4 — the only runtime router delivers pointers, by design.**
  `src/scripts/hooks/skill_route_hook.ts:14` — "POINTERS, NEVER BODIES" — bound
  on `user_prompt_submit`. `ui-route-nudge` already fires on Write/Edit against
  a UI path from `pre_tool_use`, so a **file-trigger binding on the tool slot is
  an existing shape in this tree**, not a new one.
- **D5 — subagents.** `subagent_start` is bound to `subagent-ledger` only. The
  manifest records that the payload carries `agent_id`; whether it carries
  enough of the Task prompt to trigger-match is **unverified** — blocker
  `b-subagent-payload-trigger-match`.
- **D6 — REFUTED at the drafting SHA.** The drafting session claimed no
  root-cause / search-the-tree directive exists. `src/rules/downstream-changes.md:52-56`
  carries one verbatim under § "Defect-pattern search — one instance is a
  sample, not the population", and it was present at `33d7f74a`. The only
  surviving delta is narrow and is what amendment A1 now covers.
- **D9 — the over-build lens is still off the default review path.**
  `dist/agent-src/commands/review/changes.md:6` routes to **six** lenses —
  `code-review`, `judge-bug-hunter`, `judge-security-auditor`,
  `judge-test-coverage`, `judge-code-quality`, `architecture-review-lens` (the
  sixth, the spec lens, landed in-window as `6af4d14ec`). `overbuild-review-lens`
  is **not among them**: `grep -rln overbuild-review-lens dist/agent-src/commands/`
  → none. Out of this roadmap's subject; amendment A5 still stands.
- **Behavioural equivalence is UNMEASURED, and this roadmap does not measure
  it.** The confirmed older figure is `docs/CLAIMS.md:189` — the thin
  projection reduced eager rule load **78,513 → 13,881 GPT tokens** — and the
  null at `docs/CLAIMS.md:188-189` scored **36.2 % against a required 48 %**.
  That run tested **POINTERS** at eager 78,513. The **delivery** arm — bodies
  injected on a trigger — was never run, which is why it is untested rather
  than refuted, and why the flip below is gated on deterministic endpoints
  only.

### Gap table — KEEP / FOLD / CUT against the existing surface

| Source A mechanism | Existing surface here | Verdict |
|---|---|---|
| Hook injects one filtered **body**, never a pointer | `skill_route_hook.ts:14` ships the opposite policy on the same slot | **KEEP** — Phase 1 builds the twin concern |
| SessionStart context never reaches subagents; re-inject at SubagentStart | `subagent_start` bound to `subagent-ledger` only; payload contents unverified | **KEEP, gated** — probe first (0.4), build only on a *yes* |
| Never-block hook shape (bounded stdin, fail-open, exit 0 on every path) | `hook-latency-budget.json` exists; the shape is not uniform across concerns | **FOLD** into 1.5, not a new contract |
| Pre-fix root-cause enumeration before editing a shared path | `downstream-changes.md:52-56` ships the **post-fix** sweep | **FOLD** — A1 carries only the pre-fix delta |
| Adversarial task-list benchmark with a published comparator | `stubs/road-to-solution-minimalism-full-tier-run.md` has no comparator | **FOLD** into that stub as A2 |
| Runtime intensity modes, statusline, per-session policy JSON, 20 adapters, marker schema | `discipline_profile`, `router.json profiles`, `host-capabilities.yml` | **CUT** — see § Non-goals |

### The cost model *(proposal — re-derive in 0.3)*

Keyword/phrase match over the labelled corpus put matched rules per prompt at a
median of 1 and a p90 of 4, and matched body tokens at a median around 1.3k
against ~110k tier-1+tier-2 tokens carried standing. The direction is what
matters and the magnitudes are unverified: injected context is **uncached
input**, standing context is **cache-read after turn 1 but paid in full on
every spawn**. 0.3 prices both under `internal/bench/pricing.yaml`.

## Phase 0 — Pin the baseline, pay the ratchets, fill or bury the empty datum

No metered calls in this phase. Exit criteria: 0.1–0.7 all green, and the
Phase 0 decision block below is fully filled. Rollback: Phase 0 writes one
evidence file, one script, one PREREG-adjacent probe file and at most a
one-line settings/config change — revert the commits; nothing else in the tree
depends on them yet.

- [ ] **0.1 One evidence file for the baseline numbers.** Write
      `agents/evidence/analysis/trigger-delivery-baseline.md` carrying: the
      preamble total and its rules bucket, the thin-projection delta, the
      trigger-kind census by kind, the activation-census split, and the three
      ADR-202 closures with their κ — so that nobody re-proposes a judge, and
      so that no later phase quotes a *(proposal)* figure as measured.
      verify: `./scripts-run src/scripts/check_preamble_payload_budget 2>&1 | tail -6` and `./scripts-run src/scripts/check_rule_activation_census 2>&1 | tail -2` reproduce the figures quoted in the file, and `grep -c "ADR-202" agents/evidence/analysis/trigger-delivery-baseline.md` is ≥ 3.
- [ ] **0.2 Pay the activation-census ratchet, or establish that this roadmap
      never trips it.** `check_rule_activation_census` fails on ANY movement of
      the scoped/mixed ID sets and on ANY growth of the unconditional corpus.
      A thin projection that removes bodies from the standing corpus moves the
      weight axis DOWN (allowed) but a scoping change moves the identity axis
      (fails, by design, and the gate names the movers). Decide and record
      which of the two this roadmap does: if the identity sets are untouched,
      say so and prove it; if a flip moves them, the flip commit carries a
      `--write-baseline` re-anchor with the reason in the same change and a
      `baseline_history` entry. **This roadmap does not raise a baseline to
      clear a failing check.**
      verify: `./scripts-run src/scripts/check_rule_activation_census 2>&1 | tail -2` exits 0 on the committed tree, and `agents/evidence/analysis/trigger-delivery-baseline.md` names the current `scoped_ids` and `mixed_ids` sets verbatim and states which axis this roadmap moves.
- [ ] **0.3 Pre-register the matcher against the shipping lexical/BM25 core
      BEFORE writing one.** Council 2026-07-28 (recorded at the head of
      `agents/roadmaps/later/road-to-deferred-rule-retriever.md`) locked the
      house pattern: *rule retrieval is also a retrieval problem*, a
      lexical/BM25 core already ships at `src/scripts/_lib/lexical_index.ts`,
      and it is **the cheaper baseline any new retriever must beat on a
      pre-registered measurement before it is built, not after** — build-then-measure
      already cost this repo a whole engine (code graph: recall 0.365 vs
      disciplined grep 0.797). So: score `lexical_index` and
      `trigger_coverage`'s exact-trigger matcher over
      `tests/eval/routing-matrix/` (94 files, 46 with `open_files`) on the same
      labelled positives and near-misses, publish both columns, and only then
      decide whether a third matcher is warranted. If exact-trigger matching
      wins, no new matcher is written and Phase 1 imports
      `trigger_coverage`'s semantics directly.
      verify: `./scripts-run src/scripts/model_rule_injection --baseline-comparison --corpus tests/eval/routing-matrix 2>&1 | tail -12` prints one recall/false-fire row per candidate matcher including `lexical_index`, and the winner is named in the script's own header with the sentence "no new matcher" or the reason one is needed.
- [ ] **0.4 Commit the recall and cost model as one script.**
      `src/scripts/model_rule_injection.ts` over
      `tests/eval/routing-matrix/`, using the matcher 0.3 selected (imported,
      never re-implemented; if import is impossible the header says why):
      per-rule recall on positives, false fires on near-misses, both **with and
      without** `open_files` honoured, the matched-token distribution, and a
      10/50/200-turn × 0/5/20-spawn price table for the three delivery shapes
      under `internal/bench/pricing.yaml`. Appends to 0.1's file.
      verify: `./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix 2>&1 | tail -12` prints recall with and without `open_files`, the false-fire count, the token quantiles and the price table; a second consecutive run is byte-identical.
- [ ] **0.5 The matcher is offline↔runtime identical, with collision
      fixtures.** `corrected-from-reproduction` (sibling draft § 0.2): the
      offline price/recall model and the runtime concern MUST import the same
      matcher module, because an experiment whose offline pricing and runtime
      delivery use different matchers measures nothing. Ship fixtures for
      exact trigger, overlapping triggers (deterministic ordering, explicit
      collision behaviour), no match, many matches, and kernel exclusion.
      verify: `npx vitest run tests/scripts/model_rule_injection.test.ts 2>&1 | tail -5` green with a case per fixture class, and `grep -c "from './_lib/" src/scripts/hooks/rule_inject_hook.ts` shows the concern importing the same module path the model script imports.
- [ ] **0.6 Probe what `subagent_start` carries on the installed binary.**
      One zero-tool-call subagent whose prompt contains three known trigger
      values; the ledger concern records the raw payload keys without
      interpreting them. Answer one yes/no: can a body be trigger-matched at
      spawn from the payload alone?
      verify: `agents/evidence/investigations/subagent-start-payload-probe.md` exists, names the binary version, lists the payload keys verbatim and carries a one-line verdict; `grep -c "verdict:" agents/evidence/investigations/subagent-start-payload-probe.md` ≥ 1.
- [ ] **0.7 Probe whether `user_prompt_submit` and `pre_tool_use` fire inside a
      subagent session.** Same spawn: `session-canary` writes a marker — read
      whether one exists under the subagent's session id; touch a file matching
      a `file_pattern` trigger and read whether the tool-slot concern recorded
      it. Note that in a worktree session hook state lands in the PARENT
      checkout, so the probe reads the parent's state paths.
      verify: the probe file carries two further verdict lines, each naming the absolute state path that was or was not written.
- [ ] **0.8 CLASSIFY `rules_efficiency` before touching it — never synthesise
      it.** `corrected-from-reproduction` (sibling draft § 0.7). Classify
      exactly one of: **miswired** (the data exists but the producer or report
      path is broken) · **pre-intervention-impossible** ("rules used" cannot
      exist while every rule is carried eagerly and no runtime consumer reads
      bodies) · **stale** (the semantics no longer answer a useful decision).
      Then act: miswired → smallest wiring fix; impossible → remove it as a
      precondition from `later/road-to-deferred-rule-retriever` gate (2c) and
      replace it with a datum that can actually be produced; stale → retire the
      metric and the gate that cites it. **Do not manufacture "usage" from
      prompt substring counts and call it runtime usage** — that is the
      metric-repair-manufactures-evidence failure, and it would make the
      retriever's demand gate self-fulfilling.
      verify: `agents/evidence/analysis/trigger-delivery-baseline.md` contains exactly one of the three literal classification tokens for `rules_efficiency`, and either `./scripts-run src/scripts/dispatch_economy_report 2>&1 | grep -A2 rules_efficiency` no longer prints `no data`, **or** `git log -1 --format=%s -- src/config/dispatch-economy-metrics.json` names the retirement/replacement.

**Phase 0 decision block** — Phase 1 may not start until every line is filled:

```text
rule matcher:            <module>  (or: no new matcher — trigger_coverage semantics)
lexical baseline beaten: yes | no  (recall Δ, false-fire Δ)
activation axis moved:   identity | weight-only | none
injection persistence:   session | per-turn
compact re-arm:          yes | no
subagent delivery:       spawn | per-turn | both | orchestrator-only
rules_efficiency:        miswired | pre-intervention-impossible | stale
state convention:        <existing helper/path>
```

## Phase 1 — The `rule-inject` concern: default off, twin of `skill-route`, opposite payload policy

Same slots, same shape, opposite payload policy — and the difference is
deliberate rather than incidental. A skill is a thing the agent *invokes*, so a
pointer suffices. A rule is a thing the agent must *already be under*, and the
36.2 % pointer run is the only datum anyone has on pointers; whatever its
instrument's flaws, it points one way.

Exit criteria: `rule-inject` exists on two slots, is default-off, never blocks,
honours all five trigger kinds, keeps trigger-less rules eager, and neither
touched slot carries more concerns than at the Phase 0 baseline. Rollback: the
concern is a single file plus two manifest list entries and one settings mode
value — remove the entries and the mode value and the tree is at HEAD
behaviour; nothing else reads it while the default is off.

- [ ] **1.1 Write the concern — prompt triggers.**
      `src/scripts/hooks/rule_inject_hook.ts` on `user_prompt_submit`: read
      `dist/router.json` tiers 1–2, match keyword / phrase / command with the
      matcher 0.3 selected, emit the matched **bodies** as additional context,
      kernel excluded, silent on no match. Cap per prompt by score at the p90
      from 0.4, rounded to 500. Carries a `hook-token-budget.json` row.
      verify: `./scripts-run src/scripts/lint_hook_concern_budget 2>&1 | grep -c "^error" ` is not above HEAD's count, and `echo '{"prompt":"fix the failing migration"}' | ./scripts-run src/scripts/hooks/rule_inject_hook` emits the body of at least one tier rule and nothing whose id appears in `dist/router.json`'s `kernel` list.
- [ ] **1.2 The same concern — file triggers.** Second binding on
      `pre_tool_use` scoped to the file-touching tools, matching `path_prefix`
      and `file_pattern` against the tool input path. Without it the 54 file
      triggers never fire under a thin projection and the four path-scoped
      rules are unreachable — that is exactly the residual-miss column 0.4
      measures. `ui-route-nudge` already proves the binding shape on this slot.
      verify: `echo '{"tool_name":"Edit","tool_input":{"file_path":"resources/views/x.blade.php"}}' | ./scripts-run src/scripts/hooks/rule_inject_hook --event pre_tool_use` emits `design-review-after-ui-write` and `ui-audit-gate`; `./scripts-run src/scripts/model_rule_injection --corpus tests/eval/routing-matrix --honour-open-files 2>&1 | grep "path-rule misses"` reads 0.
- [ ] **1.3 Trigger-less rules stay eager, and the residue is visible.** The
      four rules with no triggers cannot be delivered, so they are not thinned:
      they project full-bodied, and the projector prints their names and token
      sum rather than leaving a silent hole.
      verify: `./scripts-run src/scripts/project_thin_rules --measure 2>&1 | grep -c "no-trigger residue"` is 1 and the line names four rules.
- [ ] **1.4 Inject once per session per rule; re-arm on compaction.** Seen-set
      under `agents/runtime/state/`, using the helper existing hook concerns
      already use — the class `context-hygiene.json` occupies, permitted by
      `docs/contracts/no-runtime-boundary.md` § Permitted (git-as-state row,
      and the ADR-124 § 6 rebuildable-artifact carve-out) and untouched by
      § Prohibited (no subprocess outlives the turn). `pre_compact` clears it,
      following the `language-mirror` pin-lost pattern. **No new top-level
      state convention is created by this roadmap.**
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts 2>&1 | tail -5` green with a case asserting two prompts tripping the same rule emit its body once, and a case asserting `--event pre_compact` empties the seen-set.
- [ ] **1.5 Never block.** Bounded `unref()` stdin fallback, fail-open to no
      injection, exit 0 on every path. p95 within the slot budget on both
      slots. `Source A`'s hook shape, folded rather than adopted as a contract.
      verify: `./scripts-run src/scripts/bench_hook_latency --slot user_prompt_submit 2>&1 | tail -4` and the same with `--slot pre_tool_use` are within `src/config/hook-latency-budget.json`; the unit test covers stdin-never-ends and malformed JSON.
- [ ] **1.6 A third projection mode, default unchanged.**
      `_lean_projection_mode()` (`src/scripts/condense.ts:461`) today returns
      `thin` or `eager-all` from `lean_projection.mode` in
      `.agent-settings.yml`. Add the delivery mode; in it, `build_thin` writes
      the thin files **and** both bindings register. The shipped default does
      not move in this phase.
      verify: `npx vitest run tests/scripts/condense.test.ts tests/scripts/project_thin_rules.test.ts 2>&1 | tail -5` green with a case asserting the new mode writes thin files and registers both bindings, and a case asserting the default settings value still resolves to today's behaviour byte-for-byte.
- [ ] **1.7 Pay the concern-count charge on EVERY slot this change touches.**
      `corrected-from-reproduction` (sibling draft § 1.5): the charge is not
      `user_prompt_submit`-only. HEAD on Claude reads **session_start 14 · stop
      12 · user_prompt_submit 10 · pre_tool_use 13 · post_tool_use 12** against
      a warn-only placeholder of `max_per_event: 8`
      (`src/config/agent-settings.template.yml:1237`). Rule: **no slot this
      roadmap touches may finish with more concerns than it had at the Phase 0
      baseline.** So `user_prompt_submit` and `pre_tool_use` each retire or
      merge one concern in the same change, and any `subagent_start` binding
      added under 0.6's *yes* either creates no new concern under the manifest
      model or pays its own slot-local charge. Candidates are named in the
      change, not pre-committed here.
      verify: `./scripts-run src/scripts/lint_hook_concern_budget 2>&1 | grep "platforms.claude.user_prompt_submit\|platforms.claude.pre_tool_use"` reports counts not above 10 and 13 respectively, and `npx vitest run tests/scripts/lint_hook_manifest.test.ts 2>&1 | tail -3` green.

## Phase 2 — The falsifier, on instruments that are still admissible

No judge. No 48 % bar. No anchor evaluators. Three endpoints that are pure
functions of inputs already in the tree, plus one live census on the installed
host. Pre-registered together; the flip is licensed only by all four **and** by
the owner.

Exit criteria: the PREREG predates every run artefact, all four endpoints are
reported, and either the flip happens with the unmeasured-behaviour sentence in
three places or the failing row is published and the default stays. Rollback:
the flip is one settings default value — revert it; the mode remains available
opt-in and the published table stays as the record.

- [ ] **2.1 Pre-register, before any run artefact exists.**
      `internal/bench/thin-inject-PREREG.md`, committed first, carrying four
      endpoints and their decision rule verbatim: **(a) delivery census** — on
      every labelled positive where the matcher fires, the injected body is
      byte-equal to the eager projection's body, zero tolerance; **(b) recall
      floor** — per-rule recall on positives with `open_files` honoured, the
      floor derived from the frozen corpus spread and written down *before*
      scoring, residual misses listed by rule; **(c) false-fire ceiling** on
      near-misses, not above the eager arm's count by more than the registered
      number; **(d) price** — the delivery mode below the eager mode at 50
      turns × 5 spawns under 0.4's table. Plus this sentence, verbatim: *"This
      licenses delivery equivalence and cost. It does not measure behavioural
      equivalence; that instrument is closed (ADR-202) and this run does not
      reopen it."*
      verify: `git log --diff-filter=A --format=%ci -- internal/bench/thin-inject-PREREG.md` predates every path matching `internal/bench/reports/thin-inject-*`, and `grep -c "does not measure behavioural equivalence" internal/bench/thin-inject-PREREG.md` is ≥ 1.
- [ ] **2.2 Falsify the scorer before trusting it.** Known-good and known-bad
      fixtures per endpoint — a body with one byte changed must fail (a); a rule
      with a removed trigger must fail (b); a near-miss that fires must count in
      (c) — plus a mutation pass over the matcher. A scorer never seen red has
      unknown sensitivity.
      verify: `./scripts-run src/scripts/model_rule_injection --selftest 2>&1 | tail -3` green with at least one rejecting case per endpoint and no metered call.
- [ ] **2.3 Live delivery census on the installed host.** Twenty
      zero-tool-call prompts drawn from the labelled positives; after each, the
      agent is asked to quote the fired rule's first line and the answer is
      exact-string-matched against the projected body. Twenty more through a
      subagent **only** if 0.6 and 0.7 answered yes. Cents, not a sweep.
      verify: `internal/bench/reports/thin-inject-<date>.md` records 20/20 with the verbatim quoted lines, and either a second 20/20 block or the literal line "subagent arm not run — 0.6 no".
- [ ] **2.4 Decide the default once, Claude-only, with the gap named.**
      `corrected-from-reproduction` (sibling draft § "Claude-only default"):
      the flip is **scoped to Claude and gated on Claude being the verified
      host** — every other host keeps today's behaviour, because a thin
      projection without a body-delivering hook is the pointer arm that already
      scored 36.2 %, and hook-less hosts cannot run the concern at all. All
      four endpoints hold → the owner may flip; the flip carries 2.1's sentence
      and `docs/CLAIMS.md` gains an entry whose claim is **delivery equivalence
      and cost**, never quality. Any endpoint fails → the table is published,
      the default does not move, the mode stays opt-in, and this roadmap
      archives with the failing row.
      verify: `grep -c "thin-inject" docs/CLAIMS.md` ≥ 1 and that entry's `claim:` line contains neither "quality" nor "behaviour"; `grep -c "Claude" internal/bench/thin-inject-PREREG.md` ≥ 1 naming the host scope; and either `docs/CLAIMS.md` records the flip or its `status:` reads `null` with the failing endpoint named.

## Amendments to existing artefacts — each lands as its own change

- [ ] **A1 — `minimal-safe-diff`: the PRE-fix half of root-cause enumeration
      (D6, NARROWED).** The drafting session's claim that no such directive
      exists is **refuted**: `src/rules/downstream-changes.md:52-56` already
      ships the **post-fix** sweep ("after fixing a defect, before claiming the
      fix is complete: write down the exact wrong construct, grep the tree,
      report how many sites matched"). The single surviving delta is the
      **pre-fix** direction, which nothing in the tree carries: *before editing
      a shared path, enumerate its callers and repair the shared path once,
      rather than patching the reported call site.* A1 adds only that clause, in
      this suite's own words, and cross-links `downstream-changes.md:52` as the
      post-fix half so the pair reads as one discipline. The rule-stub ceiling
      is tight, so the same change moves at least as many exact-BPE tokens of
      rationale out to `minimal-safe-diff-mechanics`.
      verify: `./scripts-run src/scripts/check_rule_stub_ceiling 2>&1 | grep minimal-safe-diff` reports a size not above HEAD's, and `grep -c "downstream-changes" src/rules/minimal-safe-diff.md` ≥ 1.
- [ ] **A2 — `stubs/road-to-solution-minimalism-full-tier-run`: give it a
      published comparator.** `Source A`'s feature-plus-safety task list over a
      pinned public template repository, with baseline numbers already public,
      scored by executed adversarial scorers rather than judges. Own oracle
      text, `CREDITS.md` entry, source referenced per § Provenance.
      verify: `grep -c "@" agents/roadmaps/stubs/road-to-solution-minimalism-full-tier-run.md` shows the pinned revision in the task table, and `grep -c "Source A" CREDITS.md` ≥ 1.
- [ ] **A3 — `road-to-per-turn-hook-economy-carry`: the count, not only the
      clock.** One step: `max_per_event` becomes a measured shrink-only floor
      per slot. HEAD on Claude reads 14/12/10/13/12.
      verify: `grep -c "14/12/10/13/12\|max_per_event" agents/roadmaps/archive/road-to-per-turn-hook-economy-carry.md` ≥ 1 and the step names the producing command.
- [ ] **A4 — `road-to-standing-payload-diet`: hook-enforced rules first.**
      Nine rules carry `enforced_by: hook:*` and re-describe in prose what
      their hook implements — `verify-before-complete`, `minimal-safe-diff`,
      `git-history-discipline`, `roadmap-progress-sync`, `onboarding-gate`,
      `evaluator-independence`, `context-hygiene`, `self-repair-loop`,
      `session-canary`, together ≈ 14.7k tok (context-hygiene 2,765 ·
      roadmap-progress-sync 2,595 · session-canary 2,364). The spec belongs in
      the hook header; the rule keeps the fallback. **This is an amendment into
      the payload-diet roadmap, not a phase here** — body length is that
      roadmap's axis.
      verify: `grep -c "enforced_by: hook" agents/roadmaps/archive/road-to-standing-payload-diet.md` ≥ 1 and the step names all nine files and the total.
- [ ] **A5 — `review/changes`: route the over-build lens as the seventh.** The
      command already routes six; `overbuild-review-lens` is not one of them.
      Add it on-demand like the others; no standing-token cost.
      verify: `grep -c overbuild-review-lens dist/agent-src/commands/review/changes.md` ≥ 2 after regeneration, and `./scripts-run src/scripts/check_preamble_payload_budget 2>&1 | grep "measured total"` is unchanged.

## Blockers

### blocker: b-subagent-payload-trigger-match
- **Status:** open
- **Owner:** external
- **Blocks:** Phase 1 — 1.7's `subagent_start` charge, and Phase 2 — 2.3's second census arm
- **Question:** Does the installed binary's `subagent_start` payload carry enough of the Task prompt to trigger-match a rule body at spawn?
- **Recommendation:** Run 0.6 and 0.7 and take the answer; do not design either arm before the probe returns. A *no* costs only the subagent arm — the orchestrator-only shape still ships.
- **If you do nothing:** 1.7 cannot price its charge and 2.3 reports a census with an unexplained missing arm, which reads as a skipped step rather than a probed negative.
- **What to do:**
  1. Run the 0.6 probe: one zero-tool-call subagent whose prompt contains three known trigger values, with the ledger concern recording raw payload keys.
  2. Read `agents/evidence/investigations/subagent-start-payload-probe.md` <!-- ref-ignore --> (the probe writes it; it does not exist yet); in a worktree session the hook state is written to the PARENT checkout, so read the parent's path.
  3. Record the verdict line and fill the `subagent delivery:` field in the Phase 0 decision block.
- **Resolved when:** `grep -c "verdict:" agents/evidence/investigations/subagent-start-payload-probe.md` <!-- ref-ignore --> is ≥ 3 (spawn payload, prompt slot, tool slot) and the Phase 0 decision block's `subagent delivery:` field is non-empty.

### blocker: b-behavioural-equivalence-unmeasurable
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2 — 2.4's flip decision
- **Question:** Is the owner willing to flip a delivery default on delivery-equivalence and cost alone, with behavioural equivalence explicitly unmeasured?
- **Recommendation:** Flip on the four deterministic endpoints with 2.1's sentence carried into the PREREG, the flip commit and the CLAIMS entry — and Claude-only. The alternative is not "measure it": ADR-202 closed three instruments (paired LLM judging, its length-neutral rerun, anchor evaluation at κ 0.472 against a 0.800 floor) and this roadmap does not reopen any of them.
- **If you do nothing:** Phases 0–1 still close their own defects and the mode ships opt-in, but the ~120k-token standing rules bucket keeps being re-written on every spawn while the preamble ratchet stays red at 135,575 against 107,646.
- **What to do:**
  1. Read `internal/bench/thin-inject-PREREG.md` and the four endpoint results in `internal/bench/reports/thin-inject-<date>.md`.
  2. Read `docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md:402-407` so the closed instrument is not re-litigated at the decision point.
  3. Choose: flip Claude-only with the gap stated, or leave the default and keep the mode opt-in.
- **Resolved when:** either `docs/CLAIMS.md` carries a `thin-inject` entry whose `claim:` names delivery equivalence and cost, or `internal/bench/reports/` carries the published failing row and this roadmap is archived with it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A needed rule never fires and the session drifts silently | product | Prompt-only matching misses the path-triggered rules; a rule that should have been in force simply is not, with no error anywhere | 1.2 binds the file triggers; 2.1(b) sets a per-rule recall floor with residual misses listed by name; 1.3 keeps trigger-less rules eager; the kernel never leaves standing context | Phase 1 — The `rule-inject` concern |
| 2 | The flip is read as "quality-equivalent" when only delivery was measured | product | The only quality datum is a 36.2 % pointer run on a closed instrument; a loose claim would convert an unmeasured axis into an asserted one | 2.1's sentence is mandatory in the PREREG, the flip commit and the CLAIMS entry; 2.4's verify greps the entry for "quality" and "behaviour" | Phase 2 — The falsifier |
| 3 | The activation-census ratchet is tripped and the baseline is raised to clear it | implementation | Any scoping flip fails the identity axis by design; the tempting fix is to re-anchor the baseline, which is the config-weakening move this repo blocks | 0.2 decides the axis before any code, and either proves the identity sets untouched or lands a `--write-baseline` re-anchor with a `baseline_history` reason in the same change | Phase 0 — Pin the baseline |
| 4 | A new matcher is built before the shipping BM25 core is measured | implementation | The exact failure that cost this repo a whole engine: build-then-measure produced recall 0.365 against grep's 0.797 | 0.3 pre-registers the comparison against `_lib/lexical_index.ts` and permits "no new matcher" as an outcome; 0.5 forbids a second matcher at runtime | Phase 0 — Pin the baseline |
| 5 | Offline pricing and runtime delivery diverge | implementation | Two matchers means the price table describes a system that was never shipped, and every Phase 2 endpoint measures the wrong thing | 0.5 requires one imported module with collision fixtures and a test asserting the shared import path | Phase 0 — Pin the baseline |
| 6 | Uncached injection costs more than cached standing context on long sessions | implementation | Injected bodies are uncached input on every matching turn; standing context is cache-read after turn 1 | 0.4 prices both across 10/50/200 turns × 0/5/20 spawns before any hook code exists; 1.4 injects once per session per rule | Phase 0 — Pin the baseline |
| 7 | Two concerns land on slots already over their placeholder | implementation | Claude's `user_prompt_submit` is at 10 and `pre_tool_use` at 13 against a threshold of 8; adding without paying makes the hook estate the new debt | 1.7 pays on every touched slot with a retirement or merge and verifies the counts do not rise | Phase 1 — The `rule-inject` concern |
| 8 | `rules_efficiency` is "repaired" with synthesised telemetry | implementation | Manufacturing usage from prompt substring counts would make the retriever's own demand gate self-fulfilling | 0.8 requires one of three literal classifications before any change, and forbids substring-derived usage in as many words | Phase 0 — Pin the baseline |
| 9 | Subagents go rule-blind under a thin projection | product | If 0.6/0.7 answer no, a spawned worker carries the kernel and nothing else | The delivery mode is orchestrator-only in that case, stated in the PREREG; `b-subagent-payload-trigger-match` gates the arm | Phase 2 — The falsifier |
| 10 | The seen-set is read as the council-rejected per-session mode flag | implementation | A prior council rejected a runtime policy-profile store; bounded hook state resembles it from a distance | 1.4 uses the existing hook-state helper under `agents/runtime/state/`, creates no new convention, and adds no user-facing switch or statusline | Phase 1 — The `rule-inject` concern |

## Non-goals — with the dropped drafts' proposals dispositioned

- **Dieting rule bodies** — owned by `agents/roadmaps/archive/road-to-standing-payload-diet.md` (status: ready). A4 lands there.
- **Restoring `paths:` scoping** — owned by `agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md`.
- **A command-invoked rule retriever** — `agents/roadmaps/later/road-to-deferred-rule-retriever.md` is **superseded only if Phase 2 licenses the flip**, and is not run in parallel with this roadmap. Its 0.3 council lock is honoured here rather than bypassed.
- **Re-opening thin-vs-eager quality measurement** — ADR-202, closed three times. The 48 % bar is not reinstated; the dropped sibling's "the 48 % gate stays unchanged" is the exact `decision-revisit-gate` failure the sixth analysis loop caught.
- **Rules over MCP** — no per-turn MCP primitive exists.
- **A "Simplicity Resolver" emitting a structured decision record per change** (predecessor draft § A) — still model-filled, no deterministic discovery of "the stdlib already does it", and self-reported candidates violate `evaluator-independence`.
- **A "Policy Profile Runtime"** (per-session JSON, four intensity modes) — duplicates `discipline_profile`, `router.json profiles` and `host-capabilities.yml` auto-resolution. The predecessor draft is right that the original rejection misstated the daemon boundary (`no-runtime-boundary.md` permits bounded state); its second reason — the install-time profile already carries the knob — stands, and no new evidence about value exists, so `decision-revisit-gate` does not open.
- **A "Host Capability Registry"** — `src/config/host-capabilities.yml`, `docs/contracts/multi-tool-projection-fidelity.md` and the two projection/compliance probes already exist. The genuine gap (the live half of the compliance probe is a human gate nobody runs) is one step in a fidelity roadmap, not a registry.
- **Runtime intensity modes, a statusline, twenty adapters, a marker schema** — rejected previously; reasons unchanged.

## Provenance

External input, per `source-confidentiality`. The seeding suite is referenced
throughout as `Source A (an external agent-instruction suite, MIT)`, pinned at
`2ed6c52c`. Its real identifier is stored encrypted rather than in plaintext:

- `ENC1:7Esb/rdkLi3cLWb3COfz77JzBrmkh2FmbVPQv0mw9IDrOxIEjx7KAxRLjXJ5gK7TMCV3wzqeHxKR2gyNY67lqjLjV7m6LfSa1Ni2g77y87JDGlk8SxrC94u1vySy5X1A+pV7UwQk9FgdX0AL0zaPojwlTeD5pwkJvyTmp3h8HENgtJlh/81rKOAcHqeWBYX68AKgOuF8Ag/XOgBxSDGz6QAEdHDrwz8kvokyUA==`
  — decrypt with
  `./scripts-run src/scripts/_lib/link_crypto decrypt --value '<token>'`
  (the `--value` flag is required; without it the CLI reads stdin and silently
  round-trips the empty string). Key: `secrets.link_encryption_key`, resolved
  project-then-global, never committed.

Four mechanisms are drawn from it and each is folded rather than dumped: the
body-not-pointer injection policy (Phase 1), the re-inject-at-spawn
observation (0.6/0.7, gated on a probe), the never-block hook shape (1.5), and
the pre-fix root-cause clause (A1, narrowed to its one surviving delta after
the shipped post-fix half was found). Raw named evidence stays in the consumed
inbox copy under `agents/tmp.old/`, which is gitignored.

**Council convergence, inlined.** Council 2026-07-28 (two members, two rounds),
recorded at the head of `agents/roadmaps/later/road-to-deferred-rule-retriever.md`:
rule retrieval is a retrieval problem; the shipping lexical/BM25 core
(`src/scripts/_lib/lexical_index.ts`) is the cheaper baseline any new retriever
must beat on a **pre-registered** measurement **before** it is built, because
build-then-measure already produced one permanently disabled engine (recall
0.365 vs disciplined grep 0.797). That verdict is step 0.3 here, and it is why
"no new matcher" is a permitted outcome of Phase 0 rather than a failure of it.

## Acceptance Criteria

- [ ] **AC-1 — The baseline is one reproducible file, not scattered prose.**
      `agents/evidence/analysis/trigger-delivery-baseline.md` exists, and every
      figure in it is reproduced by a committed command; no `(proposal)` figure
      survives into any later phase's reasoning.
- [ ] **AC-2 — The activation-census ratchet is green on the committed tree**,
      and the file states which of its two axes this roadmap moves, with a
      `baseline_history` reason if the identity axis moved.
- [ ] **AC-3 — The shipping BM25 core was measured before a matcher was
      written.** The comparison table names `lexical_index` as a scored
      candidate, and the outcome is either "no new matcher" or a written reason
      one was needed.
- [ ] **AC-4 — One matcher, offline and at runtime.** The price/recall model and
      the hook concern import the same module, proven by a test, with collision
      fixtures covering overlapping triggers and deterministic ordering.
- [ ] **AC-5 — `rules_efficiency` carries exactly one of the three literal
      classifications**, and no usage figure anywhere in the tree is derived
      from prompt substring counts.
- [ ] **AC-6 — The delivery mode exists, default unchanged.** It honours all
      five trigger kinds across two slots, never blocks, keeps trigger-less
      rules eager and visible, and the shipped default resolves to today's
      behaviour byte-for-byte.
- [ ] **AC-7 — No slot this roadmap touches grew.** Claude's
      `user_prompt_submit` and `pre_tool_use` concern counts at completion are
      at or below their Phase 0 baseline.
- [ ] **AC-8 — The PREREG predates every artefact**, all four endpoints are
      reported, and the flip either happens Claude-only with the
      unmeasured-behaviour sentence in the PREREG, the flip commit and the
      CLAIMS entry, or the failing row is published and the default stays.
- [ ] **AC-9 — A1–A5 landed as five separate changes**, each citing the tree
      line it corrects or extends, and A1 carries only the pre-fix delta with a
      cross-link to the shipped post-fix half.
- [ ] **AC-10 — Integration, not dump.** Every Source A mechanism appears in the
      § gap table with a KEEP / FOLD / CUT verdict, no CUT item has a phase or
      step anywhere in this file, and every FOLD item names the existing
      artefact it folded into.
