---
complexity: structural
status: ready
---

# Roadmap: Feedback 9.2.0 Follow-ups

> **Source:** external review passes of Release 9.2.0 / `main` @ 9.2.0
> (`agents/tmp.old/feedback-9.2.0-1.txt`, multiple independent reviewers, verdicts
> 9.4–9.6/10 and 119/120). The reviews are overwhelmingly positive; this roadmap
> captures **only the concrete, code-shaped, net-new defects and gaps** they
> surfaced — not the field/measurement-gated items (those are routed in
> § Disposition, not rebuilt). **Draft — pending maintainer OK / council
> greenlight before execution.**

## Goal

Close the small set of concrete, verifiable defects and instrumentation gaps the
9.2.0 review passes converged on — the ones that are **code, not field**: the
missing behavioral eval for the new situational rule, one oversized skill the
project's own linter already flags, a release-PR review that reads the wrong diff
base, and a recurring install-bundle build-hygiene defect. Everything the reviews
frame as *field*, *measurement-gated*, or *already-tracked* is routed in
§ Disposition without a duplicate roadmap.

The strongest single reviewer signal: `cross-source-consistency` ships **default
`on` without a behavioral eval or an ask-rate measurement**, in a package that
otherwise binds default-flips to evidence. That inconsistency — and the
over-firing (ask-inflation) failure mode it exposes — is Phase 1.

## Non-goals (already tracked, measurement-gated, or council-deferred — see § Disposition)

- Adversarial-council benchmark / claim resolution → `road-to-adversarial-council-benchmark.md`.
- Adversarial reconciliation core v2 → **gated on that benchmark** — do not extend
  an `unbacked`, default-off surface before it survives its own claim.
- Verification-surface router (one intent-based selector over council / team /
  judge / adversarial / verify-repair / review-changes) → **design-first**, route
  to `road-to-orchestration-scope-decision.md`; it is an architectural cut that
  needs a council, not a build-now step.
- Real external participant / adoption → `road-to-adoption-without-narrative-debt.md` — field, not code.
- Team-mode outcome benchmark → `road-to-team-mode.md` — needs benchmark spend.
- Utilization sweep (REAP / KEEP / MERGE / DEMOTE) → **let the pre-registered
  window run**; decide after it elapses, do not rebuild telemetry.
- Knowledge sensitivity classes → **shipped** (ADR-121); the broader
  knowledge-security block (cross-project isolation, PII, retention, org
  promotion) is its own track, not this roadmap.
- Bus factor / second maintainer → `road-to-maintainer-bus-factor.md`.
- `/explain-run` → true runtime execution-trace (read a recorded trace, not
  reconstruct) → larger observability effort; the discoverable command already shipped.
- Governance-overhead-per-workflow metric, external ticket connectors → feature-bets, demand-gate defer.

---

## Phase 1 — A behavioral eval for `cross-source-consistency` (minimal-first)

> **Unification note (2026-07-27, road-to-honesty-bench):** the
> execute-or-park question is resolved in favor of EXECUTE. The fixture
> corpus for step 1.2 now EXISTS, built once for two owners:
> `internal/bench/corpora/honesty-false-premise.yaml` (30 fixtures in this
> phase's 1.1 shape — `sources:` + `expected: action ask|proceed|warn` +
> `question_contains` / `forbidden_assumptions`, incl. the 10 negative
> controls). Steps 1.1 (runner) and 1.3–1.5 remain THIS roadmap's work;
> step 1.2's authoring should extend the shared corpus, never fork it.

The reviewers' most-repeated P0. The existing harnesses do not fit: trigger-evals
are skill-scoped (rules are unsupported), and golden-outcome baselines fit only
sharp Iron-Law rules — a situation-dependent rule has no home. **Council correction
(accepted):** build the *minimal apparatus that gets the evidence for this one rule*
first — do **not** build a generic situational-rule harness up front on the strength
of five named-but-unfixtured future rules (premature abstraction; the package's own
`minimal-safe-diff` / evidence discipline). The generic harness is extracted later,
once a **second** situational rule proves the abstraction boundary (step 1.5).

- [x] **1.1 Add a `cross_source`-specific eval fixture format + runner.** A fixture
      declares `sources:` (ticket / mockup_description / spec / code_state / api_contract)
      and `expected:` (`action: ask | proceed | warn`, `question_contains`,
      `forbidden_assumptions`). Scope the runner to what `cross_source` needs — no
      speculative generalization; keep the fixture shape simple enough that a second
      rule could later reuse it, but do not build the generic abstraction yet.
      verify: the runner loads a fixture and produces a pass/fail against the
      `expected` block on a hand-written sample; runs under the repo's TS test tool.
      <!-- done 2026-07-28: src/scripts/bench_cross_source_eval.ts loads +
      validates the real internal/bench/corpora/honesty-false-premise.yaml
      corpus, classifies a raw response string into ask|proceed|warn, and
      reuses bench_honesty_score.ts's scoreFalsePremiseItem for the match
      logic; tests/scripts/bench_cross_source_eval.test.ts (21 tests, all
      green) proves loading + pass/fail on hand-written samples incl. fp-01
      (ask) and fp-21 (proceed control) plus a malformed-fixture rejection
      suite. -->
- [x] **1.2 Author the `cross-source-consistency` fixture set — positives AND the
      negative control.** Positives: text↔image (birthday-today vs mockup-two-days-ago),
      spec-silent-on-holidays (no unrequested scope), ticket↔codebase, intra-ticket.
      Negative controls (the more important half): consistent sources → do **not**
      ask; cosmetic/naming-only difference → do not ask; mockup marked illustrative →
      prioritize text; an authoritative source hierarchy present → use it, do not
      re-ask. verify: real discrepancies flip `action: ask`; every negative control
      is `action: proceed` (a false-positive on any negative control fails the eval).
      <!-- done 2026-07-28: satisfied by the shared corpus (unification note above) —
      internal/bench/corpora/honesty-false-premise.yaml carries all 30 fixtures in
      exactly the required classes: text-image×5 (fp-01 = birthday-today vs
      two-days-ago mockup), silent-needed×5, spec-code×5, intra-ticket×5 +
      negative controls control-consistent×3 / control-cosmetic×3 /
      control-illustrative×2 / control-hierarchy×2. Verified fresh this run:
      structural check (every positive expected.action=ask with
      question_contains, every control expected.action=proceed with
      forbidden_question_regex — 0 violations) + bench_cross_source_eval tests
      21/21 green. Corpus extended-not-forked per the unification note. -->
- [x] **1.3 Register a pre-registered claim for `cross_source` (even as debt).**
      Add a `docs/CLAIMS.md` entry so the weaker-evidenced default-on rule is bound
      to a measurement like every other default-flip: target discrepancy precision
      ≥ 85% and unnecessary-ask (over-firing) rate ≤ 5% on the fixture set. Status
      `unbacked` until the eval is run; honest-null accepted (loosen the default or
      the confidence tiers, never silently keep firing). verify: `check_claims` sees
      the new entry; it does not claim `backed` without a run.
      <!-- done 2026-07-28: docs/CLAIMS.md `### claim: cross-source-consistency-precision`
      (kind quant, status unbacked, PRE-REGISTERED with falsification criteria +
      honest-null consequence: default on→auto or tighter confidence tiers).
      check_claims green: 36 entries (31 backed, 5 unbacked inventory). -->
- [x] **1.4 Ask-rate telemetry facet.** Emit a per-task counter of surfaced
      cross-source discrepancies (structured, PII-exclusion-by-construction — an id
      + a discrepancy-type enum + a boolean, no free-form fields), so real over-firing
      is measurable before a user disables the rule out of friction. verify: a
      simulated task with one real discrepancy records exactly one surfaced-discrepancy
      event; a consistent-sources task records zero.
      <!-- done 2026-07-28: additive `cross_source` field on the engagement-event
      schema (src/agent-src/templates/scripts/telemetry/engagement.ts) — array of
      {id, type∈text-image|silent-needed|spec-code|intra-ticket, asked:bool}, no
      free-form fields, id redaction-floor-checked, capped at 32/event, schema_version
      unchanged (1). `telemetry_record.ts` gained a repeatable `--cross-source
      id:type:ask|warn` CLI flag. Verified fresh: 37/37 green across
      templates_telemetry_record.test.ts + templates_telemetry_boundary.test.ts +
      new templates_telemetry_cross_source.test.ts (one-discrepancy → exactly one
      cross_source entry; consistent-sources task → field omitted entirely) +
      `task typecheck-ts` clean. -->
- [ ] **1.5 (gated — do not start until a 2nd situational rule exists) Extract the
      generic situational-rule harness.** When a second rule of this class actually
      needs the same fixture shape (e.g. a future scope-control / design-fidelity /
      evidence-freshness eval), extract the common format from the *two concrete
      instances* — proven need, not anticipated need. Until then this stays open by
      design; the `cross_source` eval (1.1–1.2) is the only apparatus built now.
      verify: two real fixtures (cross_source + the second rule) share the extracted
      format without per-rule special-casing.
      <!-- gate checked 2026-07-28 (process-full run): no second situational rule
      with a fixture set exists (the five named future candidates remain
      unfixtured), so the extraction precondition has NOT cleared. Stays [ ] by
      the step's own design + the acceptance criteria (1.5 explicitly not
      required for Phase 1) — same disposition as the 9.8.0-followups
      window-gated item. Do not build ahead of the second instance. -->

## Phase 2 — Bring `subagent-orchestration` back under its size budget

The project's own `skill_linter` emits `pass_with_warnings: skill_too_large` for
this skill (9 modes + contracts + prompts + schemas in one file) — a real
`size-enforcement` budget breach, not an invented one. **Council correction
(accepted):** this is **size-budget / split-by-responsibility hygiene**, not a
claimed maintainability or scalability win — the skill still routes all 9 modes, so
the routing cognitive load is unchanged; what improves is that detail no longer
sits in the router. Frame and verify it as exactly that, and require the split to
*genuinely relocate* detail (not relabel), losing no invariant.

- [x] **2.1 Move the mode detail out of `SKILL.md`.** Keep routing / mode selection
      (the form gate + the mode-picker) in the skill; relocate the per-mode execution
      contracts, council-mode detail, and telemetry/reporting detail into `contexts/`
      (or sibling skills) the skill points to. Preserve every Iron Law, cross-model
      invariant, and the advisory/Hard-Floor boundary **verbatim** (`preservation-guard`).
      verify: (a) `skill_linter` on `subagent-orchestration` no longer warns
      `skill_too_large`; **AND** (b) all 9 modes still resolve from the skill; **AND**
      (c) `preservation-guard` holds — every Iron Law / invariant present pre-split is
      present post-split (a diff shows relocation, not deletion); `check_references` +
      host-loadability green. Passing the linter alone is **not** sufficient — (b)+(c)
      are the real success criteria.
      <!-- done 2026-07-28: 428→357 lines. Relocated VERBATIM into
      src/agent-src/contexts/execution/subagent-modes-detail.md (119→220 lines,
      now "per-mode detail" home): modes 1–6 decision rows + mode-2 stage-routing
      contract, severity-conditioned composition table, status-taxonomy
      table/rationale/NEEDS_CONTEXT-vs-BLOCKED; telemetry §6 now points at
      orchestration-telemetry § Emit procedure (shape already lived there —
      duplicate dropped, recorder-not-hand-authored line kept). Kept in skill:
      Iron Law verbatim, form gate, all 9 mode headings + essence lines, prompts
      map, procedure, gotchas, Do NOT, handover. (a) skill_linter PASS (no
      skill_too_large); (b) 9 mode sections resolve + 8 prompt files mapped;
      (c) diff = relocation (skill −127 / context +117), invariant spot-check 8/8
      present in target, check_references green. Honest drift fix in the same
      pass: stale tests/test_subagent_{status_schema,prompt_loading}.py
      references (files retired in the py2ts migration, no TS successor)
      replaced with schema/prompt-table pointers in SKILL.md + prompts/README.md. -->
- [x] **2.2 Re-sync projections + descriptions.** Run `task sync` +
      `task generate-tools` + `/condense` for the touched surfaces; the skill
      description still carries the mode list; `validate_frontmatter` clean. verify:
      `sync-check` + `sync-check-hashes` clean; the mode count in the description
      matches the routed modes.
      <!-- done 2026-07-28: /condense flow for the 7 changed surfaces (2 real:
      SKILL.md + subagent-modes-detail.md, dist rewritten with the existing
      condensation transforms preserved; 5 dep-folded command hashes re-marked) +
      condense.sh --sync + task generate-tools (0 regenerated = already clean).
      verify: sync-check + sync-check-hashes + check_condensation green;
      validate_frontmatter 424 artefacts / 0 failing; description names all
      nine routed modes. task consistency's trailing `git diff --quiet` fails
      only on this run's own uncommitted work-tree state, not on drift. -->

## Phase 3 — Tag-aware release-PR review

On a release PR the review bot diffs `release-branch → main` and then reports the
release's own features as "not in the diff" (they merged before the cut). **Council
correction (accepted):** anchor this to the concrete instance rather than "most
visible" — the `feedback-9.2.0-1.txt` review documents PR #957 (the 9.2.0 release
PR) emitting exactly these false findings ("the new rule is not in the diff",
"ADR-122 is not in the diff", "the test delta is not explained by new test files").
Release PRs need the `previous_tag...release_head` base.

- [x] **3.0 Record the concrete failure instance as the justification.** Capture the
      PR #957 false-advisory case (the three findings above) as the anchoring evidence
      in the fix's design note, so the phase is grounded in an observed defect, not a
      "most visible" assertion. verify: the design note cites PR #957's false findings
      as the reproduction case.
      <!-- done 2026-07-28: docs/design/release-pr-review-mode.md quotes the three
      PR #957 false findings verbatim (fenced, standalone — the feedback file is a
      local-only inbox archive) + the reviewer's own wrong-base diagnosis and the
      5-step requested fix; check_md_language + check_references green. -->
- [x] **3.1 Add a release-mode to the PR-review path.** Detect a release PR
      (version in title / changelog block), resolve the previous tag, analyze
      `previous_tag...release_head` as the feature range, and treat the release-PR
      diff only as an additional packaging diff. Validate claims against the full
      release commit range, not the packaging diff. verify: on a synthetic release
      PR whose feature merged pre-cut (the PR #957 shape), the review no longer emits
      "feature/ADR not in diff"; a normal feature PR's review base is unchanged.
      <!-- done 2026-07-28: src/scripts/self_review_gate.ts — detectReleaseVersion
      (CHANGELOG heading + package.json bump, pure) + pickPreviousTag (highest
      semver strictly below, pure) + release-aware buildPlan/buildSystemPrompt/
      main() (feature range prevTag...HEAD; packaging diff surfaced separately;
      explicit do-not-report-as-missing prompt note; no-tag fallback → normal base
      with ::notice::). Workflow YAML unchanged (checkout fetch-depth:0 already
      fetches tags). verify run fresh: npx vitest run
      src/scripts/self_review_gate.test.ts → 27/27 green incl. temp-git-repo
      release-PR shape (pre-cut feature file IN release-mode plan, absent from
      normal-mode plan) + normal-PR base unchanged; task typecheck-ts + eslint clean. -->

## Phase 4 — Hermetic, reproducible install-bundle build

Repeated 9.1 rebuild-fixes (real `node_modules` paths, repo-relative module paths,
post-settings rebuilds) show the bundle is sensitive to build environment and path
origin. Make local/absolute/worktree path leakage structurally impossible rather
than patched per PR.

- [x] **4.1 Guard against path leakage in the built bundle.** Add a check that fails
      the build if any absolute, `/Users`/home, or worktree-specific module path
      appears in the emitted install bundle. verify: the guard is red on a synthetic
      absolute-path-in-bundle fixture and green on a clean bundle.
- [x] **4.2 Document + wire the reproducible build path.** Document the
      clean-checkout → `npm ci` → build → pack → manifest/hash sequence and wire the
      leakage guard into the package's release/build gate so a leak cannot merge.
      verify: a from-clean build reproduces a stable bundle manifest; the guard runs
      in the build gate.

---

## Disposition — reviewer items routed, not rebuilt

| Reviewer item | Disposition |
| --- | --- |
| Adversarial-council benchmark / resolve the claim (P0) | Existing `road-to-adversarial-council-benchmark.md` — corpus + maintainer-gated spend |
| Adversarial reconciliation core v2 (semantic finding identity, severity aggregation, confidence labeling, structured description) | **Gated on the benchmark** — do not extend an `unbacked` default-off surface first |
| Verification-surface router / mechanism-proliferation consolidation (P1) | **Design-first** → `road-to-orchestration-scope-decision.md`; needs a council, not a build-now step |
| Real external participant / adoption (P0) | Existing `road-to-adoption-without-narrative-debt.md` — field, not code |
| Team-mode outcome benchmark | Existing `road-to-team-mode.md` — needs benchmark spend |
| Utilization sweep (REAP/KEEP/MERGE/DEMOTE) | Gated on the pre-registered window; let it run |
| Knowledge sensitivity classes | **Shipped** — ADR-121; broader knowledge-security is its own block |
| Bus factor / second maintainer | Existing `road-to-maintainer-bus-factor.md` |
| `/explain-run` → true runtime execution trace | Larger observability effort; discoverable command already shipped |
| Governance-overhead-per-workflow metric | Feature-bet; gated on real utilization data |
| External ticket connectors (Linear / Jira / Confluence) | Feature-bet, demand-gate defer (reviewers agree) |

## Acceptance criteria

- Phase 1 delivers a `cross_source`-specific eval (fixtures: positives + negative
  controls) + a `docs/CLAIMS.md` entry + an ask-rate telemetry facet; the eval runs
  and the claim is either `backed` or a documented honest-null. The **generic**
  situational-rule harness (1.5) is explicitly **not** required for Phase 1 — it is
  gated on a second situational rule proving the pattern.
- Phase 2: `subagent-orchestration` is back under its `size-enforcement` budget
  (`skill_too_large` cleared) **with every Iron Law / invariant preserved**
  (`preservation-guard`, relocation-not-deletion) and all 9 modes resolving;
  projections re-synced. Linter-green alone does not satisfy this criterion.
- Phase 3: the PR #957 false-advisory case is recorded as the anchoring evidence;
  release-PR review uses the previous-tag feature range; the "feature not in diff"
  false-advisory does not recur on a release PR.
- Phase 4: a path-leakage guard fails on a synthetic leak and is wired into the build gate.
- `task ci` green (remote CI is the authoritative gate).
- No duplicate roadmap created for any § Disposition item.

## Rollback

All changes are a new eval harness + fixtures, a CLAIMS entry, one telemetry
counter, a skill split (content-preserving), a review-path branch, and a build
guard — each revertable by reverting its commit. No runtime or data migration.
State-dependent note: the Phase-1 CLAIMS entry is a debt marker; reverting it
un-registers the measurement rather than breaking behavior. The Phase-2 split must
preserve every Iron Law and invariant verbatim (preservation-guard) — a revert
restores the single-file skill unchanged.

## Council review (2026-07-14)

Deep debate, 3 rounds, cross-vendor (`anthropic/claude-sonnet-4-5` +
`openai/gpt-4o`), roadmap input-mode, actual **$0.15**. The transcript is gitignored and
auto-pruned, so it is not cited by path — the date, composition and cost above
are the durable trace.

**Convergence — one load-bearing finding (both members).** The roadmap
**over-builds and is internally inconsistent with its own evidence discipline**:
it holds *deferred* items to a measurement/evidence bar while exempting its *own
build-now phases* from the same bar. Phase 1 builds a **generic** situational-rule
harness justified only by five *named-but-unfixtured* future rules (premature
abstraction — no second instance proves the boundary); Phase 2's sole success
criterion is silencing a `skill_too_large` linter warning with no evidence the
warning tracks real maintenance burden (moving prose out does not reduce the
routing cognitive load — the skill still must know all 9 modes); Phase 3 asserts
"most visible operational weakness" without documenting concrete harm from the
false advisory.

### Convergence findings

1. **Phase 1 is speculative abstraction** — build the *minimal `cross_source`-specific*
   eval first, back the claim, and extract the generic harness only when a second
   situational rule proves the pattern (YAGNI / two-instances-before-abstraction) ·
   trace: §claude-sonnet-4-5, §gpt-4o.
2. **Phase 2 is linter-appeasement framed as architecture** — the split moves
   documentation, not the routing load; drop any maintainability claim and justify
   it honestly (size-budget hygiene) or measure the friction first · trace: both.
3. **Phase 3 lacks documented operational harm** — anchor it to a concrete instance
   of the false advisory before prioritizing, or demote it · trace: both.
4. **Meta: double standard** — apply the same evidence bar to the build-now phases
   that the disposition applies to deferred items · trace: §claude-sonnet-4-5.

### Divergences (no consensus)

- **Council vs. the review *source*** — the `feedback-9.2.0-1.txt` author explicitly
  asked for a **generic** situational-rule harness (P0); the council calls that
  premature. Host resolves toward the package's own anti-over-engineering doctrine
  (`minimal-safe-diff`, evidence-discipline) while keeping the generic harness as
  the *eventual* target, not the first step — see Host verdict finding 1.

### Host verdict

The council never saw the codebase; each finding is checked against the roadmap
and repo before acceptance.

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Phase 1 generic harness is speculative | `accept-with-modification` | Matches Phase 1.1 (5 unfixtured future rules). Aligns with `minimal-safe-diff` anti-premature-abstraction. BUT the feedback source asked for generic → reframe: `cross_source`-specific eval + claim FIRST; generic extraction becomes a later step gated on a 2nd situational rule. |
| 2 | Phase 2 is linter-appeasement | `accept-with-modification` | `skill_too_large` is a *real* project budget (`size-enforcement`), not invented — keep the phase, but drop the implied maintainability win, frame as size-budget/responsibility-split hygiene, and require genuine detail relocation under `preservation-guard`. |
| 3 | Phase 3 lacks documented harm | `accept-with-modification` | The concrete instance exists — the feedback cites PR #957's false "feature/ADR not in diff" advisory. Add a step to capture that evidence as the justification; do not demote (cheap fix, real trust cost). |
| 4 | Meta double standard | `accept` | Resolved by applying findings 1–3's evidence-anchoring; no separate patch. |

### Predecessor council trace

Same run as the 2026-07-14 session above (`anthropic/claude-sonnet-4-5` +
`openai/gpt-4o`, 3 rounds). Not cited by path — council output is gitignored
and auto-pruned after the retention window.
