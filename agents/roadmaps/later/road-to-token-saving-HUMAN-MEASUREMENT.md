---
status: later
slug: token-saving-human-measurement
title: "token-saving — human-measurement track: verdict-gated phases split off the autonomous parent"
parent_roadmap: token-saving
---
<!-- check-refs: skip -->

# Road to Token-Saving — Human-Measurement Track

> Split off `road-to-token-saving.md` per the autonomous-mandate master-plan
> council (claude-sonnet-4-5 + gpt-4o, deep, 2026-06-23,
> `agents/runtime/council/responses/master-plan-2026-06-23.json`). The council <!-- council-ref-allowed: predecessor council trace (transient roadmap citation) -->
> defined the autonomous/deferred boundary for the 52-step token-saving roadmap:
> an unattended agent can build the measurement *harness* and the disabled-by-
> default scaffolding, but it **cannot** produce the trustworthy human-judged
> measurement, falsify host non-compliance, or flip the default projection — those
> require a human in the loop. Those verdict-gated phases live here.
>
> **Status `later`:** parked. **The premise below is partly OBSOLETE — read the
> measured-outcome block first.** The judge-gated half of this track is closed by
> measurement, not waiting on an operator; only the two non-judge-gated phases
> (H2, H3) remain genuinely open.

## Measured outcome (2026-07-11 / 2026-07-12) — the judge gate is CLOSED, not pending

This track was filed on the assumption that a human-judged paired experiment
would eventually unblock the thin flip. **That experiment ran, twice, and
resolved negative:**

- **2026-07-11, full sonnet n=90:** thin 17 / eager 30 decisive → win-rate
  **36.2%**, below the pre-registered **48%** floor → flip-gate **RED**.
- **2026-07-12, pre-registered length-neutral RERUN** (±15% token-band pairing,
  double-blind claude-opus-4-8 + gpt-4o, both orders, κ floor 0.60): **second
  inconclusive** (κ=0.46, ρ=0.45 flagged, 25/90 pair survival, 7 agreed-decisive
  pairs splitting 3/4 at p=1.0). Per the pre-registered design this is a **STOP**.
  → LLM-paired judging is **CLOSED-BY-DIAGNOSIS** (`docs/benchmark.md`).
- **Council re-scope 2026-07-11:** the token-savings *thesis* is intact;
  **only the thin mechanism died.**

**Council 2026-07-29 (claude-sonnet-4-5 + gpt-4o, 2 rounds) — human judging is
NOT the re-open path.** Both members converged: the ±15% band selects the cases
where the treatment did *not* manifest (selection bias *against* the effect, not
a clean subset); ρ=0.45 within-band shows the confound is *qualitative*
(elaboration fingerprints), which no judge substrate can be told to ignore; n=25
against a 48% threshold cannot distinguish the threshold from a coin flip; and a
single human judge has no measurable κ — the exact floor run 3 failed becomes
unmeasurable. **Deterministic anchor-scoring against `must_include`/`must_not`
is the sound instrument.** The council also rejected relaxing the rollout gates
on "zero external consumers" grounds: *the gates exist to force honest
measurement, not to protect users* — the legitimate move is to DECOUPLE the
essential-baseline from the flip, never to waive it.

**`task tokensave:falsify` was never built, and is intentionally not built.** It
was designed (parent § Automation & human gates) as the aggregate runner for
Phase 4's six gates — Phase 4 *is* the thin flip. Its quality gate already
returned RED, so the runner would aggregate a decided-negative result. The
individual pieces that do exist and stay useful:
`src/scripts/check_token_regression.ts`, `check_quality_regression.ts` (INERT by
design), `check_token_quality_golden.ts`, `probe_host_compliance.ts` (scaffold,
retained as the anchor-scoring re-open anchor), and — added 2026-07-29 —
`bench_quality_run --dump-answers`, which exports blinded answer pairs for ANY
external instrument and makes no judge calls.

> **Program sequencing:** the token program's single critical path + tracking
> table live in `road-to-token-proof-and-story.md` § Program tracking — this
> roadmap links there, never copies the sequence.

## Why these were NOT autonomous (council ruling, 2026-06-23 — HISTORICAL)

> Retained as the original rationale. Gates 1 and 2 below are now moot: gate 1
> ran and resolved negative (see the measured-outcome block above); gate 2's
> probe was cancelled 2026-07-12 because it verifies a mechanism that is dead.

The headline lever is the **thin projector flip (−46k tok/req)**, which the
package ships **DISABLED** on purpose. Flipping it is gated on:

1. A **length-controlled paired-judge** experiment (pairwise A/B, randomised
   order, human verdicts) proving thin projection does not regress answer
   quality — an agent cannot judge its own output quality credibly.
2. A **host-compliance falsification**: proving every demoted rule still fires
   under the thin projection on a real host — a real-world test, not a self-claim.
3. A **48h opt-in rollout + kill-switch** — a production-shaping rollout decision
   the operator owns.

An agent marking any of these "done" from self-assessment is exactly the
false-"done" failure the master-plan forbade.

## Resume trigger (corrected 2026-07-29)

Two independent triggers, no longer one:

1. **H2 + H3 (judge-free).** Not blocked by the closed judge path. H3 is fully
   deterministic and is now MEASURED (below). H2 is judge-free but NOT
   deterministic — its saving side needs a paid live generation run.
2. **H1 + H4 (judge-gated).** Closed. Re-open ONLY via deterministic
   anchor-scoring, which is a new mechanism and needs its own decision — not a
   resumption of this track.

## Phase H1 — Thin projection flip (parent Phase 4, the −46k lever)

- [-] Run `task tokensave:falsify` and confirm ALL six gates pass.
  <!-- cancelled 2026-07-29: never built and intentionally not built — it
  aggregates Phase-4's gates, and the quality gate among them already returned
  RED (36.2% < 48%, 2026-07-11). -->
- [-] Flip the default projection to `thin` behind the 48h opt-in rollout.
  <!-- cancelled 2026-07-29: flip-gate RED. `lean_projection.mode: eager-all`
  stays the shipped default. Re-open only via deterministic anchor-scoring. -->
- [-] Operator sign-off on the rollout decision.
  <!-- cancelled 2026-07-29: nothing to sign off — the gate that would have
  produced a green result is closed-by-diagnosis. Not a skipped human step. -->

**Disposition:** CANCELLED, not superseded — the precondition (a green quality
gate) was *falsified*, not replaced by a better plan.

## Phase H2 — Retire telegraph-speak (parent Phase 6) — JUDGE-FREE, but NOT deterministic

> **Reclassified and then CORRECTED 2026-07-29.** Judge-free (the gate metric is a
> token count, not a preference verdict), but **not deterministic**: the rule
> condenses reply prose at generation time, so the only harness
> (`_lib/bench_telegraph.ts:1-12`) is a live, paid, non-reproducible run.
> **A deterministic threshold is not a deterministic measurement.**

- [x] Confirm from the real-tokenizer measurement that telegraph-speak is
  net-negative (the D3 premise) BEFORE deleting a shipped rule.
  <!-- MEASURED 2026-07-29 (exact tiktoken cl100k_base). Verdict NET-NEGATIVE —
  HIGH confidence on the sign, MEDIUM on the magnitude.
  · COST (deterministic): body = 982 exact GPT tok/session (1,067 with
    frontmatter); currently injected TWICE in a maintainer session (global
    ~/.claude + project projection) = ~1,964 tok. Carve-out sections are 438 tok
    = 44.6% of its own cost. tier_1, NOT kernel — but eager-all inlines every
    rule and its trigger is `intent: "any reply"`, so always-loaded in practice.
    INVISIBLE to the repo's budget gate: check_always_budget.ts:186 selects
    `type === 'always'`; this is `type: auto`.
  · CONSUMERS PAY ZERO — one of the 16 exclusively-maintainer rules pruned by the
    2026-07-13 rule_workspaces flip. All cost falls in this repo.
  · SAVING (not deterministically obtainable): single n=10 run telegraph-v1
    (2026-05-16, $0.0805), median vs_terse −9.27% (API counts); re-analysis of the
    same 30 replies with exact cl100k_base gives −5.47% — SAME SIGN, 41% smaller.
    Condensed emitted +88 GPT tok MORE than terse-control over 10 replies.
    Telegraph wins only on pure prose (+53%, +57%), loses hard on carve-out-heavy
    prompts (−103%, −107%): a prose discount paid for by a carve-out tax.
  · NET at the 600-tok reference scale: +33 tok/reply → +1,014 (1-reply session)
    to +2,631 (50 replies). BOTH sides cost.
  · Four in-tree locks agree: multiplier suspended 0.9155 < 1.0; kill-criterion
    row 1; ADR 0001 `Status: accepted` = off; vs_terse negative both tokenizers.
  · MEDIUM on magnitude: n=10, one run, NO repeats (no variance estimate, no CI
    on the median), corpus weighted 7/10 toward carve-outs, `aggressive` arm only
    — `prose_only` was NEVER benched. Plus a validity defect: the rule declares 7
    carve-outs, the detector implements 6 (#6 mode-markers and #7 deliverables
    are not regex-detectable) and ADDS markdown tables, which the rule does not
    list — so the bench measured a different carve-out set than ships. -->

- [ ] On confirmation: delete `src/rules/telegraph-speak.md`, trace downstream refs
  (frugality-charter index, router, projections), changelog note.
  <!-- CORRECTION 2026-07-29: this step previously read "+ its CI gate". THERE IS
  NO CI GATE — validate_telegraph_carveouts.ts appears in NO Taskfile target and
  NO workflow (verified: 0 hits); the rule calls it "Optional". The deletable
  surface is 5 scripts (~20,259 tok of TS, 0 session tokens), 4 test files,
  tests/golden/telegraph/, and the compile toggle at compile_router.ts:56-61.
  COUNCIL 2026-07-29: REMOVE (both members) — but gpt-4o dissented in round 2
  that `prose_only` was never benched and MEDIUM magnitude leaves room for
  targeted re-evaluation. Deletion needs operator authorization. -->

- [ ] **Zero-cost dormancy is available NOW and neither council member named it.**
  Verified 2026-07-29: `COMPILE_TIME_TOGGLES['telegraph-speak']`
  (`compile_router.ts:56-61`) gates on `telegraph.enabled` / `telegraph.speak` and
  **never reads `speak_scope`** (0 hits across compile_router, project_thin_rules,
  condense). So `speak_scope: off` kills the BEHAVIOUR but not the ~982-token
  COST, while **`telegraph.speak: false` omits the rule from `dist/router.json`
  entirely** — cost gone, nothing deleted, fully reversible. This satisfies the
  council's cost argument AND preserves the dissent's request to bench
  `prose_only` (~$0.80) before any deletion.

- [x] Resolve the `speak_scope` default contradiction.
  <!-- DONE 2026-07-29: the rule said `prose_only`, ADR 0001 (Status: accepted)
  and the kill-criterion contract said `off`, and the key existed in NO config,
  NO loader default, and NO schema property — the default lived only in prose and
  the prose disagreed. Resolved toward the accepted ADR: rule now states `off`,
  and `telegraph.speak_scope: "off"` is written explicitly into
  agent-settings.template.yml. QUOTED deliberately — bare `off` is a YAML 1.1
  boolean, and the same trap was found live in two pre-existing enum keys
  (`subagents.auto: on`, `decision_engine.min_confidence: off`), both now quoted.
  Zod rejects booleans for these keys (tested), so `subagents.auto: off` unquoted
  would NOT have switched subagents off — a kill-switch that fell through. -->

## Phase H3 — Condensation ROI decision (parent Phase 7) — DETERMINISTIC

> **Reclassified 2026-07-29.** The gate is a deterministic threshold (≥500 tok
> saved AND deterministic AND readable) on the real tokenizer, not an
> output-quality verdict. Not blocked by the closed judge path.

- [x] Measure on the real tokenizer: does skills-condensation save ≥500 tok AND
  stay deterministic AND readable?
  <!-- MEASURED 2026-07-29 (exact cl100k_base, src/ → dist/agent-src/, n=429:
  111 rules + 318 skills). COMBINED VERDICT: FAIL (2 of 3 sub-gates).
  · SAVING — FAIL. 0 of 429 artifacts clear 500 tok; best case 368
    (skills/ai-council, 3.0%); median delta 0; aggregate 5,930 tok = 0.86% of
    691,382. 305/429 have delta 0; 267/429 are BYTE-IDENTICAL (literal no-op for
    62% of the corpus). 22 artifacts are net-NEGATIVE. On the always-loaded
    kernel the 9 rules go 7,680 → 7,716 = −36 tok: condensation makes the
    per-request surface WORSE. Body-only: 0.92%, still 0/429 ≥500. The ≥500 unit
    was ambiguous — per-artifact FAIL decisively, per-request FAIL, only the
    aggregate reading passes and no consumer pays that in one request.
  · DETERMINISM — FAIL. An LLM prose rewrite (condense.ts:668; /condense Step 3).
    effective_hash() (condense.ts:463) hashes the SOURCE; the output is never
    hashed, so --check-hashes answers "has the source changed", never "would
    re-condensing reproduce the same bytes". OBSERVED LIVE 2026-07-29: after a
    parallel agent partially reverted this session's work, three dist files
    carried repairs their src counterparts lacked and --check-hashes still
    reported "All condensation hashes are clean". The drift is undetectable by
    construction.
  · READABILITY — PASS with 4 named defects. 0/429 Iron Law headings lost, 0/429
    fenced blocks lost, 424/429 keep every heading. Real content losses:
    rules/fast-path-marker-visibility (4 sections, and it redirects the reader to
    a file that does not exist), rules/user-interaction, skills/laravel-validation,
    skills/php-coder. Passes largely BECAUSE the transform is near-no-op. -->
- [ ] Decide per the gate and apply (keep, or remove the rule-condensation
  machinery if it does not clear the bar) — a measurement-gated decision.
  <!-- COUNCIL 2026-07-29 (claude-sonnet-4-5 + gpt-4o, 2 rounds): REMOVE,
  UNANIMOUS, no dissent. Sonnet: "the locked number never existed"; "the
  determinism claim is unfalsifiable by construction"; "readability passes only
  because 62% of outputs are unchanged". Ordered steps both members converged on:
  (1) preserve apply_path_rewriter (condense.ts:524) as a standalone deterministic
  transform — it is the ONE load-bearing piece, affecting ~38 artifacts;
  (2) redirect /condense to copy src → dist with path rewriting only;
  (3) delete the LLM condensation instruction set; (4) delete
  internal/.condensation-hashes.json (744 keys); (5) delete check_condensation.ts
  + its CI step; (6) update preservation-guard's condensation applicability;
  (7) verify all 430 pairs still pass structural checks; (8) record an ADR.
  APPLYING this needs operator authorization (deletes shipped CI machinery +
  raises whether dist/agent-src should exist as a separate tree at all). -->

### H3 incidental findings — independently re-verified 2026-07-29

Defects in their own right, surfaced by the H3 measurement. **Fixed this session:**

- [x] **A blind CI gate.** `check_condensation.ts:36` hardcoded
  `SOURCE_DIR = '.agent-src.uncondensed'`, a tree containing **0 files**. It
  scanned nothing, printed `TOTAL | 0 | 0 | 0 | 0%`, exited **0**, and was wired
  into CI at `.github/workflows/consistency.yml:179`.
  <!-- FIXED: retargeted at `src/` (430 pairs) + a `scanned_nothing` error guard
  so a gate that inspects nothing can never pass. ITS OWN UNIT TEST PINNED THE
  BUG ('missing root → clean (exit 0)') — corrected, plus a second test for the
  exact shipped case (existing but empty tree). On its first real run it found 9
  hidden defects, all since repaired: 6 modified_code_block (telegraph
  condensation had leaked INTO fenced code blocks, corrupting template blocks
  meant to be copied verbatim — violating telegraph-speak's own carve-out #3 and
  preservation-guard's byte-for-byte rule), 2 lost `requires_skills` frontmatter
  keys, 1 stray `source: package` line. Gate now: 0 errors, 13 warnings, 385
  `minimal_reduction` infos — the honest, previously invisible ~1% signal. -->
- [x] **A locked contract number contradicted by measurement.**
  `docs/contracts/kernel-membership.md:66` locked median `r = 0.712` (28.8%
  saving); measured on its own three pilot files: **1.000 / 0.997 / 0.998**.
  <!-- FIXED: warning block added, pilot table marked historical. Blast radius
  verified as documentation-only — no code or config consumes `r`. -->
- [ ] **26 artifacts reference the dead `.agent-src.uncondensed` tree** (13 rules,
  13 skills). The FUNCTIONAL subset — 8 `path_prefix` trigger entries compiled
  into `dist/router.json` — is fixed (below). The remainder are prose citations
  and declared `validator_ignore` exemptions, several deliberate with stated
  reasons; they need per-case judgement, not a sweep.
- [x] **8 dead trigger entries — the sharpest finding, and not doc rot.**
  `path_prefix` triggers pointed at a directory with 0 files.
  **`skill-quality` and `rule-type-governance` had exactly ONE trigger each and
  were therefore fully inert on the path axis** — the rule requiring every skill
  to be executable and validated never fired when a skill was edited. Four more
  were degraded (`domain-adoption-policy`, `persona-governance`,
  `framework-neutrality-in-generic-skills`, `augment-edit-discipline`).
  <!-- FIXED: all 8 repointed at the real paths (src/skills/, src/rules/,
  src/agent-src/personas/, src/agent-src/commands/, src/); propagated to dist and
  hash-marked; .claude/rules are symlinks so they follow automatically.
  Corroboration that `src/`-rooted is the right convention: lethal-trifecta-guard
  and source-confidentiality already used it. -->
- [x] **A YAML enum-as-boolean trap, found while fixing the speak_scope default.**
  Bare `off`/`on` parse as booleans under YAML 1.1, and Zod `z.enum` rejects
  booleans (tested). Two pre-existing instances: `subagents.auto: on` and
  `decision_engine.min_confidence: off`. **`subagents.auto: off` unquoted would
  NOT have switched subagents off** — `auto === 'off'` is false against `False`,
  so the kill-switch fell through to dispatch.
  <!-- FIXED: all three quoted. NOTE: no linter guards this class — it was found
  by accident. A sweep over every config plus a gate is an open follow-up. -->

## Phase H4 — Rule-surface audit (parent Phase 9), after thin is proven

- [-] Only after the thin flip (H1) is proven in production: audit the 50 tier-2
  rules — which genuinely need a router pointer vs could collapse.
  <!-- cancelled 2026-07-29: the stated precondition ("after the thin flip is
  proven in production") is FALSIFIED — H1 is cancelled, so this can never fire
  as written. A rule-surface audit may still be worth doing on its own merits,
  but it would be a NEW item with its own justification. -->
- [-] Move the qualifying rules; re-measure the always-loaded surface against the
  Phase-8 budget linter.
  <!-- cancelled 2026-07-29: depends on the audit above; the parent's re-scope
  also marked the quality-elbow-gated budget linter DEAD. -->

**Disposition:** CANCELLED — falsified precondition, per the cancelled-not-
superseded convention. Re-opening needs a fresh, independently justified item.

## Acceptance criteria (human-measurement track)

- [x] Paired-judge experiment run; no quality regression at the chosen projection.
  <!-- met NEGATIVE 2026-07-11/12: the experiment ran twice. Thin does NOT clear
  the 48% floor (36.2%) and the method cannot resolve the question (κ=0.46).
  Satisfied as a *measurement performed* with a negative result — NOT as "thin is
  safe". Council 2026-07-29 confirmed human judging is not an admissible
  substitute; deterministic anchor-scoring is. -->
- [-] Host-compliance falsification passed on a real host.
  <!-- cancelled 2026-07-12 (parent): the probe verifies thin-projection host
  behaviour; the thin mechanism is dead. Scaffold + 5 tests retained in-tree. -->
- [x] Thin flip rolled out with kill-switch, **or explicitly decided against with
  the measurement recorded**.
  <!-- met via the second branch: explicitly decided AGAINST. Evidence in
  docs/benchmark.md § Length-neutral judge RERUN + internal/bench/reports/.
  Shipped default stays lean_projection.mode: eager-all. -->
- [ ] telegraph-speak (H2) / condensation-ROI (H3) decisions each backed by a
  real-tokenizer measurement, not self-assessment. **Both now measured; both
  gates RED; council says remove both.** Remaining: operator authorization to
  execute the removals, and (optionally, ~$0.80) the `prose_only` output bench
  the H2 dissent asked for. Rule-surface audit dropped — H4 cancelled.

## See also

- `road-to-token-saving.md` — the autonomous parent (measurement harness +
  disabled-by-default scaffolding + RTK wiring + CI linters).
