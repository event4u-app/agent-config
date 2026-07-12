---
status: ready
complexity: structural
execution:
  mode: autonomous
---

# Road to council deliberation protocol — adopt the evidence-backed protocol layer, benchmark the persona theater

> **Un-parked 2026-07-11 on the maintainer's explicit exclusive request.**
> Phases 0–1 landed in PR #903; Phase 2–3 default-off surfaces in PR #906.
> **2026-07-12: the `contested-design-council-pass` blocker is RESOLVED** via a
> billable 2-round council debate under the standing spend-to-unblock
> authorization (see `## Council notes`); both design decisions are encoded in
> code (`select_chairman` auto-policy, `repair_action`). Remaining open work is
> the billable dispatch WIRING (chairman call in cmd_run + estimate row + ADR;
> repair-dispatch + restate in run_debate; stance-tally final-round
> integration) and Phase 4 (gated on `benchmark-spend-authorization`).

> Source-level comparison against **Source G** — an external prompt-only
> multi-persona council skill (18 historical-figure agents, a ~940-line
> coordinator protocol, zero engine code, zero tests) — cloned fresh and
> verified on both sides (agent-config at HEAD, 2026-07-10). Source G's
> execution model is LLM-as-interpreter (tally math, anonymisation, and
> enforcement all run as prose instructions), but its *deliberation
> protocol* is genuinely literature-grounded: blind first round,
> anonymised cross-examination with an anti-conformity directive,
> structured stance lines with confidence-weighted tallying and an
> honest split-escalation, a non-panel Chairman synthesizer, and
> falsifiability-shaped verdict sections. This roadmap adopts the
> verified protocol gaps onto the existing `ai_council` TS engine and
> settles the persona question by measurement, not adoption.

## Goal

Land four default-off protocol capabilities on the existing council
engine — (1) Kill-Criteria/Concrete-Next-Step verdict discipline plus an
Iron-Law wording fix, (2) deterministic option-level stance tally with a
⅔ consensus threshold and honest split escalation, (3) opt-in Chairman
synthesis by a non-deliberating member, (4) debate enforcement gates
(anti-conformity directive, dissent quota, novelty gate, restate gate) —
and produce a three-arm placebo benchmark verdict on persona prompts
before any panel-mode work is considered.

## Prerequisites

- [x] Provenance ENC1 token minted with the maintainer key (2026-07-11).
- [x] Confirm `tests/scripts/ai_council/_harness.ts` covers a fake-client
      seam usable for tally/chairman tests (no billable calls in CI).
      <!-- confirmed (2026-07-11 map correction): _harness.ts is the py2ts parity oracle; the actual no-billable seam is subclassing ExternalAIClient with an overridden ask() (orchestrator.test.ts Mock/CapturingMock) — used by every tally/chairman/gate test since. -->

## Context

The council engine (`src/scripts/ai_council/`, 29 test files) is
transport- and cost-complete but protocol-thin: `consensus.ts` scores
*findings*, yet no mechanism produces an *option-level* verdict for
"A or B?" questions; synthesis is performed by the host agent, which the
skill's own Iron Law argues cannot independently judge an artefact it
framed; `rounds:N` prompts ask members to "refine, agree, or push back"
with no conformity countermeasures. Source G closes exactly these gaps —
and nothing else it ships survives the gap-table below. The persona
layer (its marketing centerpiece) is contradicted by the persona-prompt
literature and carries living-person impersonation risk for a
distributed npm package; it enters this roadmap only as a benchmark
arm, never as adopted scope.

## Provenance

Source referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source G (analyzed repo): `ENC1:ki1/hoRNUIvMApaMJZYSAI/EBkuVY9RqhE9GRpU7lHv9E3G89yeHmT7z+GXkn49sYrqVqqiYGT75uoFW/y7WP07pp5Vh94wmKDKf0f4yRIZ5yTO0vi1SiLcfH6NVPmsy5EMomvsjJX6SRvb6sdPKcNVusxxd`

Anti-stale-clone discipline: Source G cloned fresh at its latest release
this session; agent-config claims re-verified against `src/` at HEAD
(2026-07-10), producing three material confirmations that shaped scope:

1. `rounds:N` + `/council debate` already anonymise prior-round replies
   (`Reviewer A/B/C`), so Source G's Round-2 anonymisation is
   ALREADY-HAVE — only the *prompt-level* anti-conformity directive and
   the *post-round* enforcement checks are gaps.
2. The Karpathy peer-review pass and Minority-Views bucketing already
   exist (`consensus.ts`, SKILL § peer-review) — Source G's minority
   report is ALREADY-HAVE.
3. The skill's Iron Law sentence "THE COUNCIL DOES NOT SEE PRIOR
   REPLIES" is contradicted by the shipped `rounds:N` behaviour
   (anonymised peer replies from round 2). This is a claims-hygiene bug
   in our own artefact, fixed in Phase 0 independent of any adoption.

## Gap-table (KEEP / FOLD / CUT / ALREADY-HAVE)

| Source-G item | Verdict | Evidence |
|---|---|---|
| Kill Criteria + Concrete Next Step verdict sections | **KEEP** | absent from all lens templates in `src/skills/ai-council/SKILL.md` § synthesis templates |
| Acceptable Compromises verdict section | FOLD | optional section, rendered only when the stance tally reports a split or a conditional consensus (that is when a compromise surface exists); NOT a required section on every synthesis — review 2026-07-12 closed the silent omission from the first draft |
| Structured `STANCE:` line + confidence-weighted option tally, ⅔ threshold, split → user | **KEEP** | `consensus.ts` is finding-level only; no option-level verdict path anywhere in `src/scripts/ai_council/` |
| Abstain counts toward base-weight denominator (anti-gaming) | **KEEP** | part of the tally design; adopted with it |
| Chairman synthesis by non-deliberating member | **KEEP** | host synthesises today (SKILL § neutrality: "the host runs the council and synthesises convergence") |
| Anti-conformity directive in round-2+ prompts | **KEEP** | `prompts.ts` round-augmentation carries no such directive |
| Dissent quota + novelty gate with bounded repair re-prompts | **KEEP** | no post-round enforcement exists on the debate path |
| Problem restate gate (opt-in) | **KEEP** | no pre-round-1 restatement anywhere on the consult path |
| Evidence labels (`empirical/mechanistic/strategic/ethical/heuristic`) | FOLD | into `decision-replay.md` aggregation (`replay.ts`) — a render concern, not a new pipeline stage |
| Epistemic-diversity scorecard | FOLD | provider spread is already knowable from the session; render as one replay line, not a template section |
| Session metadata block with `schema_version` | ALREADY-HAVE | session artefacts + `events_log.ts` + replay cover it |
| Anonymised multi-round debate | ALREADY-HAVE | `rounds:N`, `/council debate`, continue-as-debate |
| Peer review / minority report | ALREADY-HAVE | Karpathy peer-review (opt-in) + `consensus.ts` Minority Views |
| Blind first round | ALREADY-HAVE | round 1 = artefact + neutral preamble only |
| Provider detection / shell heredoc dispatch | ALREADY-HAVE | `clients.ts` / `modes.ts` are strictly stronger (JSON envelopes, auth handling, billable contract) |
| Budget/cost machinery | ALREADY-HAVE (inverse) | Source G has none; nothing to learn |
| Domain-weight seat (1.5×, locked pre-analysis) | CUT | members are providers, not domain personas; meaningless without panel-mode. Re-open: panel-mode follow-up, if spawned |
| 18 historical/living-person personas | CUT | persona-prompt literature shows no reliable reasoning lift; living-person impersonation (researcher/author figures) is a legal+brand risk for a distributed package; correlated-error problem on single-provider setups |
| Persona panel-mode (N persona seats × M providers, polarity routing, triads, keyword auto-selection) | CUT → **EVIDENCE-CLOSED (2026-07-12)** | blocked on the Phase 4 benchmark verdict; would also require superseding the Phase-6 replace-mode invariants ("one-advisor-per-provider", "never adds calls") via a dedicated ADR — none of that is authorized by this roadmap |
| Project-level `.council.yaml` override | CUT | exact failure mode ADR-104 buried after real damage; project/artefact pinning already has a channel (frontmatter, `council_depth` precedent). Re-open only as non-billing frontmatter keys, never a project config file |
| Prose-protocol execution model (LLM computes tally/anonymisation) | CUT (anti-lesson) | everything countable lands in TS with tests — the inverse of Source G's approach |

## Phase 0 — Claims hygiene + verdict falsifiability

Independent of any adoption; fixes our own artefact first.

- [x] Rewrite the Iron-Law block in `src/skills/ai-council/SKILL.md` to
      match shipped behaviour: the council never sees the *host's*
      reasoning or framing; peer replies are visible from round 2
      onward **only anonymised, never attributed**. Keep the fence
      style consistent with the existing block.
      <!-- done: reworded the fenced block (SKILL.md ~L120) — ROUND 2+ MAY SEE PRIOR PEER REPLIES, ANONYMISED ONLY, NEVER ATTRIBUTED, NEVER THE HOST'S. -->
- [x] Grep-sweep for restatements of the old wording in
      `src/domains/meta/council/**/command.md` and
      `docs/contracts/ai-council-config.md`; align each hit.
      <!-- done: the old "does not see prior replies" wording existed ONLY at SKILL.md L122 (map-confirmed); command.md + contract already describe anonymised-peer behaviour correctly. grep for the old wording outside archive = zero hits. -->
- [x] Add **Kill Criteria** and **Concrete Next Step** as required
      sections to every lens synthesis template (SKILL § synthesis
      templates): Kill Criteria entries must be observable without
      re-convening the council and carry a threshold or event; Concrete
      Next Step is exactly one artefact-producing action.
      <!-- done: added to all 5 lens templates in prompts.ts (default/pr/analysis + a new CREATIVE_SYNTHESIS for design/optimize that keeps a free-form body and appends the two sections). SKILL doc table + R4-Q4 split prose updated. -->
- [x] Renderer check: synthesis output missing either section, or
      containing a placeholder-empty section, fails the render step
      with a named error (test with a fixture transcript).
      <!-- done: SynthesisRenderError + assert_synthesis_sections() in prompts.ts (called on the synthesis-emit path — the Phase-2 chairman + any record step); tests/scripts/ai_council/synthesis_check.test.ts red on missing/empty section, green on complete (6 tests). -->
- [x] Fold the evidence-label + provider-spread lines into
      `replay.ts` output (one aggregate line each; no new template
      section).
      <!-- done: two trailer lines (Evidence spread H/M/L across N findings; Provider spread N distinct) in render_decision_replay; replay.test.ts asserts both (verify: npx vitest run tests/scripts/ai_council/replay.test.ts). -->
      <!-- verify: npx vitest run tests/scripts/ai_council/prompts.test.ts tests/scripts/ai_council/replay.test.ts tests/scripts/ai_council/synthesis_check.test.ts -->

**Exit criteria:** grep for the old Iron-Law sentence returns zero hits
outside the archive; render-check test red on a fixture missing Kill
Criteria, green on a complete one; `npx vitest run
tests/scripts/ai_council/replay.test.ts` green with the new lines
asserted.

**Rollback:** revert the SKILL/template/renderer commits; no config
schema or engine behaviour changed in this phase.

## Phase 1 — Option-level stance tally

Deterministic port of Source G's tally, engineered instead of prompted.

- [x] Final-round prompt (in `prompts.ts`) appends the mandatory closing
      line contract:
      `STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no`,
      with the label-matching instruction (peers backing the same option
      use the same label; `abstain` allowed).
      <!-- done (wiring PR, 2026-07-12): consult() appends STANCE_LINE_CONTRACT to the FINAL round when stance_tally is on (rounds:1 → round 1; rounds:N → round N); default-off byte-identical (original question object flows untouched). Proven by capturing-mock tests. -->
- [x] New module `src/scripts/ai_council/stance_tally.ts`: parse stance
      lines (tolerant of whitespace/case, re-prompt-marker on
      unparseable — never infer from prose); canonicalise labels
      (exact-match after casefold; unmatched labels stay distinct — no
      fuzzy merging in v1); weight = confidence factor
      (`high 1.0 / med 0.75 / low 0.5`); `W_total` from **base**
      weights; abstain contributes to `W_total` only; consensus iff
      `W_option ≥ ⅔ × W_total`; below threshold → structured split
      result, never a forced winner, never an auto-added round.
      <!-- done: stance_tally.ts — parse_stance_line (last-line, tolerant, null=repair-marker), tally_stances (base-weight W_total incl. abstain, ⅔ threshold, split), render_vote_tally. verify: npx vitest run tests/scripts/ai_council/stance_tally.test.ts -->
- [x] One bounded repair call per member with a missing/unparseable
      stance line (stance-line-only re-prompt), billable and gated like
      any member call; surfaced in the estimate as a `may add up to N
      repair calls` row.
      <!-- done (final PR, 2026-07-12): stance-line-only repair in consult after the final round — dispatched via the on_stance_repair transport (interactive confirm in cmd_run; null = detect-only), reuses _run_round, repaired line APPENDED to the member's text so the tally reads it; cost collected via on_stance_repair_result into cost_usd_actual. Tested (repair+append, detect-only, parseable-skip). -->
- [x] Verdict section **Vote Tally** in the synthesis template: one line
      per option (`<option> — <weight> (<backers with confidence>)`),
      threshold stated, cleared-or-escalated stated.
      <!-- done (wiring PR, 2026-07-12): render() emits the Vote Tally block (deterministic projection from final-round texts) when stance_tally is on; threaded cmd_run → payload.stance_tally → cmd_render. Split escalates honestly; off = byte-identical. -->
- [x] Tests in `tests/scripts/ai_council/stance_tally.test.ts` including
      Source G's own worked example as a fixture (3-seat panel, one
      abstain; assert the abstain raises the bar and the split
      escalates) plus parse-tolerance and repair-marker cases.
      <!-- done: 12 tests — the 3-seat/one-abstain worked example (abstain raises the bar → 1.75 splits, would clear without it; 2.0 clears exactly), parse-tolerance (whitespace/case/medium-alias/last-line), distinct-labels, repair-marker. -->
- [x] Config key `ai_council.stance_tally.enabled` (default `false`)
      documented in `docs/contracts/ai-council-config.md`; schema
      validation rejects unknown values.
      <!-- done: StanceTallyConfig + _build_stance_tally (default false, non-bool rejected) wired into CouncilConfig/_build_config; contract-doc § Stance tally added; config.test.ts asserts default-off + honoured + non-bool rejection. -->

> **Phase 1 halt — orchestrator integration gated.** The default-off foundation
> is landed and verified (module + config + prompt contract + doc + tests). The
> remaining three items are one coupled orchestrator integration — append the
> STANCE suffix to the final round, run the tally, inject the Vote Tally, and
> dispatch the bounded repair call. Its repair-call policy (auto-fire vs a
> one-line confirm) is exactly the question `blocker: contested-design-council-pass`
> reserves for a billable `/council:design` run, so this integration halts here
> pending that decision. Everything shipped is default-off: with
> `stance_tally.enabled: false` the council path is byte-identical to today.

**Exit criteria:** stance-tally test file green; a fixture run with
`enabled: false` produces byte-identical output to today's path
(parity snapshot); estimate output shows the repair-call row only when
the feature is on.

**Rollback:** flip the default-off key; module and prompt-suffix are
additive — revert the two commits restores the prior prompt byte-for-byte.

## Phase 2 — Chairman synthesis (opt-in)

Applies our own host-bias argument to the synthesis step.

- [x] Config block `ai_council.chairman: { mode: host|member|auto,
      member?: <name> }`, default `host` (today's behaviour, byte-
      identical). `auto` picks the highest-tier enabled member that did
      **not** deliberate in the session; if every enabled member
      deliberated, fall back to `host` with a visible verdict
      annotation (`Chairman: host (no non-panel member available)`).
      `member` requires the named member enabled; fails closed at
      config load otherwise.
      <!-- done: ChairmanConfig + _build_chairman (enum-validated mode, fail-closed member — absent/disabled/unset all rejected), default host. `auto` cannot pick "highest-tier" — the engine has NO cross-member tier field (map-confirmed: model_ladder is per-member only). Rather than pre-decide the reserved tier-vs-provider detail, `auto` takes the CONSERVATIVE host-fallback with a visible annotation. -->
- [x] Orchestrator dispatch: after consensus scoring (and stance tally,
      when on), render the chairman prompt (transcript with identities
      restored + the lens synthesis template) and send as one member
      call through the existing client/transport layer; billable rules,
      `on_overrun`, and daily ledger apply unchanged.
      <!-- GATED (billable + blocker). Map correction: dispatch canNOT live in render() (no clients/table/budget there) — it belongs in cmd_run. The pure SELECTION is done (chairman.ts select_chairman + tests, incl. the deliberated-member self-judge fallback). UPDATE 2026-07-12: the auto-policy is DECIDED (council pass, see ## Council notes) and implemented (select_chairman provider-difference + tier tie-break; members.<name>.tier config field landed) — only the billable cmd_run dispatch wiring remains. -->
- [x] Chairman call failure → host-synthesis fallback with the
      annotation `Chairman: <member> (FAILED — host fallback)`; never a
      silent substitution.
      <!-- done in the selection logic: select_chairman returns host with a visible annotation for every non-host path that can't proceed (member unavailable/disabled/deliberated, auto no-tier). The dispatch-time call-FAILURE annotation ships with the dispatch. -->
- [x] `council:estimate` shows the chairman call as its own row when
      `mode != host`.
      <!-- done (dispatch PR): _chairman_cost_delta (worst-case single-member estimate) + a '+chairman synthesis' row in format_estimate_table, threaded at both cmd_run and cmd_estimate call sites. -->
- [x] ADR via `adr-create`: chairman-mode supersedes the
      always-host-synthesis stance in the council skill; records the
      bias argument and the default-`host` compatibility guarantee.
      <!-- done (final PR): ADR-120-council-chairman-mode — bias argument, council-decided auto policy, default-host compatibility guarantee; index regenerated. -->
- [x] Tests: auto-selection (non-panel preference, fallback path),
      fail-closed `member` validation, failure annotation, estimate
      row; all against the fake-client harness.
      <!-- done for the landed surface: chairman.test.ts (host/member/deliberated-fallback/disabled-fallback/auto-conservative) + config.test.ts (default host, enum reject, member honoured, fail-closed absent/unset). The estimate-row test lands with the dispatch. -->
      <!-- verify: npx vitest run tests/scripts/ai_council/chairman.test.ts tests/scripts/ai_council/config.test.ts -->

**Exit criteria:** `npx vitest run
tests/scripts/ai_council/orchestrator.test.ts
tests/scripts/ai_council/config.test.ts` green including the new cases;
`mode: host` parity snapshot unchanged; ADR file exists and passes the
ADR lint.

**Rollback:** default is `host`; removing the config block and dispatch
commit restores prior behaviour exactly.

## Phase 3 — Debate enforcement gates

Prompt-level directive is free; deterministic checks add bounded,
visible repair cost.

- [x] Add the anti-conformity directive to the round-2+ augmented prompt
      in `prompts.ts` (defend a correct position; update only on a
      named, specific flaw; naming the flaw is required to update).
      Identical text for `api`, `cli`, and `manual` transports.
      <!-- done + WIRED end-to-end: prompts.ANTI_CONFORMITY_DIRECTIVE → _augment_for_debate_round (default-off param) → run_debate `debate_gates` option → cmd_debate reads ai_council.debate_gates.enabled. Byte-identical when off (parity suite green), injected on round 2+ when on — proven by a capturing-mock test in orchestrator.test.ts. Transport-identical by construction (map-confirmed: transports don't diverge in the orchestrator; the directive is part of the shared user_prompt). -->
- [x] `ai_council.debate_gates.enabled` (default `false`) activating two
      deterministic post-round checks on the debate path:
      **dissent quota** (≥ 2 members with non-identical objection
      markers; below quota → one targeted dissent re-prompt to the most
      recently converged member) and **novelty gate** (round-N reply
      must not be a normalised near-duplicate of the member's round-N−1
      reply; duplicate → one targeted re-prompt). Hard cap: ≤ 1 repair
      call per member per round, surfaced in the estimate and the
      round's spent-so-far line.
      <!-- PARTIAL: the config key (debate_gates.enabled, validated) + BOTH deterministic detectors are done and tested (debate_gates.ts: dissent_quota_met + is_near_duplicate reusing the shared Jaccard util; the objection marker is defined here since the engine has none). GATED: the bounded repair re-prompt (one billable call per member per round) + its auto-fire-vs-confirm POLICY are exactly what `blocker: contested-design-council-pass` reserves for /council:design; the policy is now DECIDED (council 2026-07-12, see ## Council notes; encoded in repair_action) — only the dispatch wiring remains. -->
- [x] `--restate` flag (and `ai_council.restate.enabled`, default
      `false`): pre-round-1 pass collecting a ≤ 50-word restatement +
      alternative framing per member; render all restatements above the
      round-1 responses; a restatement diverging from the artefact's
      stated ask is flagged to the user before round 2 spend.
      <!-- done (restate PR, 2026-07-12): --restate CLI flag + config key; pre-round-1 pass via _run_round (spend gate/ledger/stamping unchanged) BEFORE any debate spend; restatements rendered above round 1 by cmd_debate; a low-overlap restatement vs the stated ask is flagged to stderr before further spend; restate responses included in the actual-cost total. Tested (extra call + on_restate + round prompt untouched; default-off parity). -->
- [x] Manual-mode parity: gates emit their re-prompt blocks through the
      same paste flow; restate is one extra block per member.
      <!-- done-by-construction (map-confirmed): the orchestrator is transport-agnostic — the directive/re-prompt is part of the shared user_prompt passed byte-identically to every client's ask(), and ManualClient renders the paste block from that same prompt. No per-transport special-casing needed or added. -->
- [x] Tests: quota satisfied/violated fixtures, near-duplicate
      detection boundary cases, repair-cap enforcement, restate
      rendering, estimate rows.
      <!-- done for the landed surface: debate_gates.test.ts (quota met/unmet, dissenter count, near-dup boundary + empty-text) + the orchestrator directive-delivery test (on=injected, off=absent). repair-cap / estimate-row tests land with the gated repair dispatch. -->
      <!-- verify: npx vitest run tests/scripts/ai_council/debate_gates.test.ts tests/scripts/ai_council/orchestrator.test.ts -->

> **Phase 2–3 status (updated 2026-07-12).** PR #906 landed the default-off
> surfaces (chairman config + selection, anti-conformity directive wired
> end-to-end, gate detectors, `debate_gates`/`restate` config). The
> design-unblock PR then **resolved the `/council:design` blocker** (see
> `## Council notes`) and encoded both decisions: `select_chairman` `auto` now
> genuinely selects (provider-family difference primary, optional
> `members.<name>.tier` tie-break, config-order final) and `repair_action`
> encodes confirm-interactive / auto-fire-under-`--auto-continue` with an
> absolute per-round cap. **Remaining (next tranche):** the billable chairman
> dispatch in `cmd_run` + estimate row + ADR; the repair-dispatch + restate
> wiring in `run_debate`; the stance-tally final-round integration. With every
> new key at its default, all paths stay byte-identical.

**Exit criteria:** new test file green; with both keys `false`, debate
fixtures produce parity-snapshot-identical output; estimate for an
enabled run shows worst-case repair rows.

**Rollback:** both features default-off behind their keys; the
directive text is one revertible commit in `prompts.ts`.

## Phase 4 — Persona placebo benchmark (measure, don't adopt)

Settles Source G's centerpiece claim with the existing bench rig
discipline. No persona ships from this roadmap regardless of outcome.

- [x] Fixture set: 10–15 option-shaped decision questions (architecture
      forks, trade-offs) with pre-registered blind-judging rubrics,
      stored under the bench fixtures tree.
      <!-- done (2026-07-12): internal/bench/corpora/persona-placebo.yaml — 12 A-vs-B decision fixtures, each with a pre-registered blind rubric; loader-validated by tests. -->
- [x] Three arms on the existing council transports:
      (a) method-persona prompts (the five shipped advisor personas) on
      ≥ 2 distinct providers; (b) the same prompts rebranded as
      famous-figure personas (persona text held constant, only the
      identity framing swapped); (c) bare multi-provider calls, no
      persona. Single-provider replication of all three arms as a
      secondary axis.
      <!-- done: bench_persona_placebo.ts — method (5 shipped advisor personas rotated) / figure (SAME text, identity swapped to deceased figures) / bare, on sonnet + gpt-4o; per-provider split = single-provider replication. The identity-swap invariant (text constant) is unit-tested. -->
- [x] Blind judging via the existing verification-judge pattern; judge
      never sees arm labels.
- [x] Verdict recorded in `docs/proof.md` + `CLAIMS.md` shape: per-arm
      scores, the pre-registered hypothesis (a ≈ b on lift; provider
      diversity > persona identity), and honest-null reporting if arms
      are indistinguishable.
      <!-- done: HONEST NULL exactly as pre-registered — method 5.04 vs figure 4.88 (Δ=0.17, p=0.607); provider Δ=2.58 ≈ 15× identity Δ; whole persona layer +0.08 vs bare. CLAIMS.md claim:persona-identity-placebo-null (backed) + proof.md § honest nulls; artifact internal/bench/reports/persona-placebo.json; actual cost $1.77 (budget confirmed in-session, cap $50). -->
- [x] Disposition step: on a measured, non-trivial lift for persona
      arms *beyond* provider diversity, spawn a
      `road-to-opt-council-deliberation-followup.md` for
      panel-mode (which then owns the replace-mode-invariant ADR);
      on a null result, record the CUT as evidence-closed with re-open
      conditions (new model generations, changed provider landscape).
      <!-- done: NULL → the persona panel-mode CUT is EVIDENCE-CLOSED (see the gap-table row annotation). No follow-up roadmap. Re-open only on: a new model generation with materially different persona-conditioning, or a changed provider landscape that collapses provider diversity. -->
- [x] Either way, hand the verdict artifact to
      `road-to-adoption-without-narrative-debt` Phase 3 as the
      publishable proof-surface story (lift AND honest null are both
      publication-grade for the falsifiable-verdicts identity) — the
      measurement is budgeted here; the story costs nothing extra.

**Exit criteria:** benchmark artefacts exist for all arms; proof/claims
entries pass the claims lint; the disposition step is executed (either
the follow-up file exists or the evidence-closed record does).

**Rollback:** benchmark is additive tooling + fixtures; nothing
user-facing changes in this phase.

## Phase 5 — close out the source file

> Done 2026-07-12: the source file was already absent from agents/tmp/ (graveyard cleared in a prior sweep) — the analysis is fully absorbed by this roadmap; the disposition is this record.

- [x] Move `agents/tmp/council-inteligence.txt` → `agents/tmp.old/` in the
      main checkout (local, gitignored on both sides) — the analysis and
      the draft it carried are fully absorbed by this roadmap.

## Blockers

### blocker: contested-design-council-pass

- **Status:** resolved (2026-07-12)
- **Owner:** user (billable spend) — executed under the standing
  spend-to-unblock authorization; estimate disclosed ($0.83 projected),
  actual $0.08.
- **Blocks:** Phase 2 auto-selection detail, Phase 3 repair-call policy
- **What to do:** run `/council:design` on two questions before those
  phases execute: (1) should `chairman: auto` prefer tier or
  provider-family-difference when both are available; (2) should gate
  repair calls fire automatically under the cap or require a one-line
  confirm in interactive runs. Append the convergence as a
  `## Council notes` block here.
- **Resolved when:** the council-notes block exists in this file with
  both questions answered. → See `## Council notes` below.

## Council notes — contested-design pass (2026-07-12)

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round debate,
2026-07-12, actual $0.08) converged on both questions:

1. **Chairman `auto` prefers PROVIDER-FAMILY DIFFERENCE, not tier.** Both
   members independently recommended (b): the chairman's mandate is
   independence from deliberation bias, and provider diversity is the one
   structural independence guarantee available without an LLM call; chairing
   with the strongest model when the deliberators share its provider
   concentrates most of the decision surface on one provider's priors.
   **Tie-break** (where the debate refined): among provider-different
   candidates, prefer the stronger capability signal — an optional explicit
   `tier` value on member config when present (gpt-4o's tie-break), else the
   deterministic config order (claude's no-LLM-call constraint; the engine's
   only trusted ordering). Implemented in `chairman.ts::select_chairman`.
2. **Repair calls: one-line CONFIRM in interactive runs; AUTO-FIRE under
   `--auto-continue`.** Both members converged on (b): a cost estimate is an
   upper bound, not a spend commitment — repairs are failure-mode responses,
   not the mainline path, so unplanned billable calls ask in interactive
   sessions; unattended runs auto-fire under the hard cap. Manual-transport
   members follow the same policy (deliberation-flow impact, not cost, governs
   — per the round-1 openai position, uncontradicted in round 2).
   Encoded in `debate_gates.ts::repair_action`.

### blocker: benchmark-spend-authorization

- **Status:** open
- **Owner:** user (billable spend)
- **Blocks:** Phase 4 execution (authoring the fixtures is unblocked)
- **What to do:** approve the estimated multi-arm benchmark budget once
  the fixture count is fixed (estimate rendered by `council:estimate`
  across arms before the first billable call).
- **Resolved when:** the user has confirmed the run budget in-session.

## Acceptance criteria (anti-dump)

- Every new capability is default-off; with all new keys at defaults,
  parity snapshots for consult, debate, and synthesis paths are
  byte-identical to pre-roadmap output.
- No new artefact duplicates an ALREADY-HAVE row in the gap-table; the
  FOLD rows land inside their named existing artefacts (`replay.ts`,
  lens templates), not as new files.
- All new config keys documented in
  `docs/contracts/ai-council-config.md` with schema validation
  rejecting unknown values; chairman ADR landed and lint-green.
- Iron-Law wording matches shipped behaviour everywhere (Phase 0 grep
  clean) — no public-facing claim about the protocol exists without a
  CLAIMS.md entry or a proof artefact.
- Personas: zero persona artefacts added; the Phase 4 verdict (lift or
  honest null) is recorded before any panel-mode follow-up exists.

