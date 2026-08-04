---
complexity: structural
---

# Roadmap: Plan Governance Gates — confidence gate, plan-risk review, completion review

> Three mandatory governance gates around the plan/delivery workflow:
> (C) a **confidence gate** that routes uncertain plan asks through the
> `/challenge-me vision` interview before authoring, (R1) a **plan-risk
> review** that makes every new/substantially-changed plan carry a
> schema-validated Risk Register, and (R2) a **completion review** that
> forces a findings-before-fixes senior review when a roadmap reaches 100%
> or a PR is created. All three default **on**; C is toggleable via
> settings, R1/R2 are governance with settings escape hatches. Evidence
> direction: a gate exists only when enforcing code blocks on it — roadmap
> prose does not count as implementation.

## Prerequisites

- [x] Read `AGENTS.md` and `src/rules/source-of-truth.md` (edit `src/` only)
- [x] Read `/challenge-me vision` (`src/domains/meta/challenge-me/vision/command.md`)
      — the four 95%-confidence conditions are the reused measure for Gate C
- [x] Read `src/config/gate-coverage.yml` — every new gate script must emit
      `scanned: <N>` and register there (the guard reports `pending` entries)

## Context

- **Motivation (two recurring failure modes):**
  1. *Plans without risk analysis.* Roadmaps are authored and executed
     directly; product/implementation risks surface only when they fire.
     "The agent thought about risks" is not falsifiable — a persisted,
     schema-validated Risk Register is.
  2. *Silent fixing instead of auditable review.* On roadmap completion or
     before a PR, the agent fixes findings inline without ever listing
     them. The review artifact stays empty, the audit trail is worthless,
     and "0 findings" is indistinguishable from "no review happened".
- **Gate C confidence measure (reused, not reinvented):** the four
  AND-conditions from `/challenge-me vision` § "The four 95% conditions" —
  (1) every load-bearing branch resolved, (2) no new load-bearing branch
  after the last answer, (3) goal / in-scope / out-of-scope / hard
  constraints / AC / two edge cases explicit, (4) draft pitch stable across
  two turns. At seed time (before any interview turn) the check degrades
  to: does the ask already pin goal, scope boundary, hard constraints, and
  observable acceptance criteria without guessing? Any gap → below 95%.
- **Gated plan-authoring surfaces (Gate C + Gate R1):**
  - `/roadmap:create` — `src/domains/product-basic/roadmap/create/command.md`
  - `roadmap-writing` skill — `src/skills/roadmap-writing/SKILL.md`
  - `/feature:plan` — `src/domains/engineering-base/feature/plan/command.md`
  - `/feature:roadmap` — `src/domains/engineering-base/feature/roadmap/command.md`
- **Existing repo mechanisms to dock onto (do not rebuild):**
  - `src/config/gate-coverage.yml` + `check_gate_coverage.ts` — the
    `scanned: <N>` / `min_scanned` contract every new validator must obey.
  - `src/scripts/hooks/` + `hook_manifest.yaml` — PreToolUse/pre-push hook
    registration surface.
  - `/judge:on-diff` + `judge-*` skills + `subagent-orchestration` — the
    fresh-context reviewer machinery Gate R2 Phase 1 reuses.
  - `CLAIMS.md` — pre-registered thresholds land here (regen `build_proof`
    + denominator bump in the same change).
  - `/create-pr` § 1c archival sweep — the pre-PR chokepoint R2 extends.
- **Settings precedent:** `roadmap:` section in
  `src/config/agent-settings.template.yml` + Zod schema in
  `src/server/schemas/settings.ts`. The schema is embedded in the tracked
  esbuild bundle `dist/install/install.mjs` — any schema edit requires a
  bundle rebuild in the same change (CI "Install Aux Tests" diffs it).
- **Key naming:** new `planning:` section — scope is every plan artifact,
  not only roadmaps, so the keys do not live under `roadmap:`.
- **Pack boundary:** `/challenge-me` ships in `product-reasoning`; the
  roadmap cluster ships in `product-basic`. Consumers without the
  challenge-me command need a degrade path (inline interview per
  `ask-when-uncertain`, same stop conditions) — Gate C never hard-depends
  on the command being installed.
- **Host boundary:** hook-capable hosts get the pre-push layer;
  instruction-file-only hosts (e.g. Copilot) rely on the agent-side step +
  CI as the authoritative gate. The contract doc names this split
  explicitly so no host silently loses coverage.

## Non-goals

- No LLM-as-judge in any gate path. Gates check existence, schema, and
  status completeness of artifacts — deterministic, CI-capable. Finding
  *quality* is measured in Phase 7, never judged inside a gate.
- No retro-application to already-merged PRs or archived roadmaps.
- No separate review bot / external service — everything runs in existing
  hooks + the gate-coverage guard.
- No execution authorization: none of the gates soften the post-artifact
  hard stop or any safety floor.

## Gate specifications

### Gate C — plan-confidence gate (before authoring)

- **Trigger:** a plan-artifact authoring ask on any gated surface.
- **Activation:** `planning.challenge_on_create` (default `true`; missing
  key = `true`; `false` → inert). Explicit user bypass ("just write it")
  wins for that turn — bypasses are counted (`gate_c_bypass_rate`,
  Phase 7) so gate erosion is visible.
- **Confident path (all four 95%-conditions hold):** emit exactly one
  marker line — `> Confidence ≥ 95% — creating directly
  (planning.challenge_on_create)` — then proceed with the surface's normal
  flow.
- **Uncertain path:** route into the `/challenge-me vision` interview with
  the plan ask as seed; on reaching 95% (or `!pitch`) the pitch feeds the
  surface's normal authoring flow (reuse of the existing `!roadmap`
  routing mechanic). Degrade path without the command: inline interview,
  one question per turn, same four stop conditions (protocol spelled out
  in the Phase 2 context doc).
- **Handoff to R1 (single flow, no double interview):** Gate C persists
  its resolved branches as machine-readable state
  (`agents/runtime/state/gate-c-<plan-slug>.json`: resolved branches, plan
  hash, timestamp, **and a mandatory `transcript_ref`** — path + content
  hash of the interview transcript artifact; the R1 validator checks
  existence + hash match, so a forged state file requires a forged,
  census-visible transcript). R1's risk pass reads it when present,
  plan-hash-fresh, and same-session; otherwise it runs fresh. Only the
  Gate C flow writes `agents/runtime/state/gate-c-*.json` — generic write
  operations on that glob are a lint violation. Threat model (verdict
  #19): the guard defends against *silent agent shortcuts*, not against
  the local human, who holds a legitimate settings escape hatch anyway —
  detectability over prevention, by design. Contract in Phase 4 Step 1.

### Gate R1 — plan-risk review (at plan creation/substantial change)

- **Trigger:** (a) new roadmap/plan file under a roadmaps directory,
  (b) substantial change per the heuristic **defined as a precise contract
  in Phase 4 Step 1** (phase/milestone headings added, removed, or
  renamed; deliverable checkboxes added or removed; content diffs inside
  an `## Acceptance Criteria` block). Checkbox state flips (`[ ]`→`[x]`),
  typo fixes, and prose-only edits outside those blocks never trigger.
- **Mandatory artifact:** a `## Risk Register` section in the plan itself:

  ```markdown
  ## Risk Register
  <!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <agent-id|human> -->
  | Rank | Item | Risk type | Description | Mitigation | Anchored under |
  |------|------|-----------|-------------|------------|----------------|
  | 1    | ...  | product \| implementation | ... | ... | Phase 2 Step 3 |
  ```

  Rules: `Rank` strictly ascending from 1, ordered most → least risky;
  every row MUST carry a `Mitigation` AND an `Anchored under` reference to
  an existing phase/step in the same document (dangling reference =
  fail); `reviewed:` may not be older than the last substantial plan diff
  (stale = fail). **Honest-null:** an empty register is valid only with
  the exact marker block defined in the Phase 4 contract (marker comment +
  `**Honest-null:** … because: …` line). A missing section is NOT an
  empty section: missing = fail; an empty or prose-only section without
  the honest-null marker = fail.
- **Enforcement points:** authoring-flow step on the gated surfaces
  (agent-side) + pre-push hook + CI check via a gate-coverage-registered
  validator. NOT a blocking pre-write hook — incremental authoring must
  stay possible; `status: draft` roadmaps are exempt until flipped to
  ready (see Parked / Refused).
- **Review mode:** self-review suffices — R1 checks completeness of risk
  capture, not blindness to one's own code; no fresh context needed.

### Gate R2 — completion review (100% roadmap completion / pre-PR)

- **Trigger (two triggers, one gate):** (1) all roadmap items reach done
  (completion event), (2) PR creation (pre-PR chokepoint). On overlap, one
  findings artifact covers both triggers if the diff hash matches.
- **Applicability guard (explicit skip, never silent):** R2's review is a
  *code* review — it requires a code diff surface. When there is no code
  access (plan-only change, prose/docs-only deliverable, working outside
  a project repo, analysis-only session), the gate records an explicit
  skip declaration instead of a findings artifact (exact marker grammar in
  the Phase 4 contract): `**Skipped:** no code surface for this
  completion — <reason>, diff <sha|none>, declared YYYY-MM-DD`. A missing
  artifact is never a valid skip; the declaration is. The validator
  rejects a skip declaration when the diff does touch code paths.
  Roadmap/docs-only PRs in this repo take the same path.
- **Two phases, strictly ordered — findings BEFORE fixes:**
  - *Phase 1 — review (senior-engineer mode):* scope = full diff of the
    roadmap work / PR branch against base. Search grid: errors,
    inconsistent logic, inefficiencies, bug-producing patterns. Output: a
    persisted artifact `agents/reviews/<branch-or-roadmap-slug>.findings.md`,
    ordered critical → least critical. **No fixing in Phase 1** — the
    reviewer context writes no code.

    ```markdown
    # Findings: <id>
    <!-- completion-review: v1 | reviewed: YYYY-MM-DD | diff: <sha> | reviewer: <fresh-subagent-id> -->
    | # | Severity | File:Line | Finding | Status | Reason/Ref |
    |---|----------|-----------|---------|--------|------------|
    | 1 | critical | src/x.ts:42 | ... | open | |
    ```

    `Severity` ∈ {critical, high, medium, low}, sorted descending;
    initial status of every finding: `open`.
  - *Phase 2 — fix:* work the findings in priority order; every finding
    ends in exactly one status: `fixed` (+ commit ref), `accepted-risk`
    (+ reason, who accepts), or `deferred` (+ ticket/issue ref — debt is
    made visible, not hidden).
- **Deterministic gate rules:** no findings artifact (and no skip
  declaration) for the current diff hash → block; ≥1 finding `open` →
  block; `deferred` without ticket ref or `accepted-risk` without reason →
  block; artifact diff hash ≠ current diff → stale review → block (a push
  after review forces re-review). **Honest-null:** "0 findings" is valid
  only as the exact marker declaration (`**Honest-null:** 0 findings, diff
  <sha>, reviewed YYYY-MM-DD`).
- **Anti-silent-fixing enforcer:** the Phase-1 artifact must exist before
  the first fix commit — fix commits that predate the findings artifact
  (commit-ancestry check) → block. Enforcement point: **pre-push hook +
  CI (dual layer, CI authoritative)**; the agent-side check is advisory
  (warns, never blocks local work). Without this enforcer, the two-phase
  split is prompt prose.
- **Review mode:** a **fresh subagent without the implementation
  context** (adversarial-critic / council-blind-review pattern; reuse the
  `/judge:on-diff` machinery). The reviewer receives only: diff, roadmap,
  acceptance criteria — never the session history — and runs under a
  **tool allowlist** (branch-scoped `git diff` + file reads; no `git log`
  beyond the branch, no repo-wide grep, no reads of `agents/runtime/` or
  session artifacts) so the context cannot be reconstructed through
  tools. The artifact header carries a context manifest (schema in
  Phase 4 Step 1) so isolation is checkable. **The manifest is
  verification, not self-attestation (verdict #18):** the reviewer input
  is never assembled by the implementing agent — a deterministic
  dispatcher script constructs the reviewer context (branch diff via git,
  roadmap file, extracted AC), computes the `inputs` hashes itself, and
  writes the manifest; CI re-derives the expected hashes from diff SHA +
  roadmap path and blocks on mismatch. Residual (`accepted-risk`):
  host-level context injection outside the dispatcher is not preventable
  from inside the repo; detection floor = the adversarial-leak E2E.

## Phase 1: Settings keys + schema

- [x] **Step 1:** Add a `planning:` section to
      `src/config/agent-settings.template.yml` with three keys and comment
      blocks (what each gate does, default semantics, honest-null/skip
      semantics, degraded mode): `challenge_on_create: true` (Gate C),
      `risk_review: true` (Gate R1), `completion_review: true` (Gate R2).
      Missing key = `true` for all three.
- [x] **Step 2:** Add the matching `planning` object to
      `src/server/schemas/settings.ts` — three `z.boolean().default(true)`
      leaves with `.describe(...)`. Every schema leaf must exist as an
      ACTIVE template key (parity test).
- [x] **Step 3:** Rebuild the tracked install bundle:
      `npm run build:install-bundle` — **in the same commit as Steps 1–2**
      (schema edit + bundle rebuild are atomic; Phase 8's `task sync`
      regenerates `dist/agent-src/` only, never this bundle).
- [x] **Step 4:** Verify: `npx vitest run tests/server/schemas/parity.test.ts`
      passes. Template comments are review-time surface — confirm in PR
      review that each comment matches the gate semantics (parity checks
      keys, not prose).

## Phase 2: Gate C shared context

- [x] **Step 1:** Create
      `src/agent-src/contexts/execution/plan-confidence-gate.md` defining
      Gate C once (surfaces link to it, no duplication): activation read,
      seed-time assessment after the codebase lookup (challenge-me Step 0 —
      never ask what grep answers), confident-path marker line,
      uncertain-path routing into `/challenge-me vision`, the C→R1
      handoff state write, and the **inline degrade protocol** for hosts
      without the command: (1) resolve goal / scope / constraints / AC
      from the ask + codebase, (2) surface one load-bearing branch per
      turn with a recommended option, (3) repeat until every surfaced
      branch is resolved AND no new load-bearing branch appeared after the
      last answer AND the cached draft summary is stable for two turns,
      (4) then author. Non-goals: no execution authorization; no firing on
      checkbox flips / dashboard regen / archival; explicit user bypass
      wins (and is counted).
- [x] **Step 2:** Verify: the new context file passes
      `./scripts-run src/scripts/check_references` and the md-language
      check (English-only prose).

## Phase 3: Wire Gate C surfaces

- [x] **Step 1:** `/roadmap:create` — insert a "Step 0: Confidence gate"
      before "Determine location", linking the context doc; keep existing
      inbound cross-references (challenge-me's links into
      `roadmap/create.md`) valid.
- [x] **Step 2:** `roadmap-writing` skill — extend § "0. Drafting protocol"
      with the gate (free-form "write a plan/roadmap" path).
- [x] **Step 3:** `/feature:plan` — gate before its Step 1 ("Gather the
      idea"); seed = the provided description.
- [x] **Step 4:** `/feature:roadmap` — gate after reading the feature plan;
      seed = the feature document; gaps that would change phases/AC →
      interview first.
- [x] **Step 5:** `/challenge-me vision` — add a See-also note that plan
      surfaces auto-route in when Gate C fires (reverse pointer; no
      behavior change in challenge-me itself).
- [x] **Step 6:** C→R1 handoff: Gate C writes
      `agents/runtime/state/gate-c-<plan-slug>.json` (resolved branches,
      plan hash, timestamp, `transcript_ref` with content hash — schema
      per Phase 4 Step 1); the R1 authoring step reads it when present +
      plan-hash-fresh + same-session (validator checks the transcript
      hash), and skips re-asking resolved branches. The user is never
      interviewed twice for the same plan.
- [x] **Step 7:** Verify: `./scripts-run src/scripts/check_references` and
      `./scripts-run src/scripts/validate_frontmatter` green across all
      touched files; walkthrough evidence that (a) a Gate C interview
      followed by the R1 risk pass re-asks zero resolved questions, and
      (b) with the challenge-me command unavailable, the inline degrade
      interview runs and converges (transcript reference in the PR).

## Phase 4: R1/R2 schemas + deterministic validators

- [x] **Step 1:** Write the contract file
      `docs/contracts/plan-review-gates.md` defining ALL machine-checked
      grammars in one place: `risk-review: v1` marker + table rules;
      `completion-review: v1` marker + table rules; the **exact
      honest-null line grammar** (marker comment + `**Honest-null:** …
      because: …` — anything else in an otherwise-empty section fails);
      the **exact skip-declaration grammar** (R2); the **substantial-change
      heuristic** (phase/milestone heading added/removed/renamed,
      deliverable checkbox lines added/removed, content diff inside an
      `## Acceptance Criteria` block; state flips and prose-only edits
      excluded); the **context-manifest schema** for R2 reviewer headers
      (`inputs` hashes, `excluded` classes, `tools` allowlist, timestamp)
      including the dispatcher-writes-manifest rule and the residual
      host-injection `accepted-risk` (verdict #18); the **C→R1 handoff
      state schema** with mandatory `transcript_ref` (path + content
      hash), the gate-c write-path glob rule, and the explicit
      detectability-over-prevention threat model (verdict #19); and the
      **validator exit-code contract**: `0` = pass, `1` = policy violation
      (block), `2` = internal error (crash/timeout/parse failure →
      **degraded advisory mode**: log a warning, allow the operation — a
      broken gate must never block its own fix).
- [x] **Step 2:** Implement `src/scripts/lint_plan_risk_register.ts`
      (deterministic, no LLM): existence on ready (non-draft) roadmaps,
      marker parse, rank monotonicity, mitigation presence, dangling
      `Anchored under` refs, staleness vs last substantial diff,
      honest-null grammar. Emits `scanned: <N>`; obeys the exit-code
      contract.
- [x] **Step 3:** Implement `src/scripts/check_completion_review.ts`
      (deterministic, no LLM): artifact existence for current diff hash,
      severity ordering, status completeness (`open` /
      `deferred`-without-ref / `accepted-risk`-without-reason → fail),
      diff-hash match, honest-null and skip-declaration grammars,
      skip-rejected-when-diff-touches-code, fix-commit-before-artifact
      ancestry check. Emits `scanned: <N>`; obeys the exit-code contract.
- [x] **Step 4:** Unit tests with **synthetic fixtures** (this roadmap's
      own Risk Register is a reference example, never a test input — live
      files get edited/archived) for ALL fail paths (missing section,
      empty without honest-null, prose-only "no risks" without marker,
      dangling ref, stale date, open finding, deferred without ticket,
      hash mismatch, fix-before-artifact, backdated artifact, silent skip,
      skip-on-code-diff) AND the pass paths (valid register, honest-null,
      valid skip declaration, draft exemption), plus FP/FN fixtures for
      the substantial-change heuristic (typo-in-heading, scope-change-in-
      prose, phase-add, checkbox flip).
- [x] **Step 5:** Register both scripts in `src/config/gate-coverage.yml`
      with CI-identical `argv` and a real `min_scanned` floor (derived from
      the current roadmap/PR corpus, documented in `corpus:`).
- [x] **Step 6:** Verify: `npx vitest run` on the two new test files — 0
      false-pass on the fail fixtures; exit-code-2 paths demonstrably
      warn-and-allow.

## Phase 5: Wire Gate R1

> Prerequisite: Phase 3 complete (the gated surfaces carry Gate C) and
> Phase 4 merged (the contract + validator exist).

- [x] **Step 1:** Implement trigger detection per the Phase 4 contract's
      substantial-change heuristic (new-plan-file + heuristic match); wire
      the FP/FN fixtures from Phase 4 Step 4 as its regression suite.
- [x] **Step 2:** Authoring-flow step: add the risk-review step to the
      gated surfaces (after draft, before save) — the agent (a) reads the
      C→R1 handoff state if present, (b) identifies the highest
      product/implementation risks, (c) ranks them descending, (d) writes
      mitigations back into the plan and anchors each row. Prompt
      scaffolding lives in the surfaces; the validator stays the enforcer.
- [x] **Step 3:** Pre-push enforcement: register the R1 validator in the
      pre-push hook path (~~`hook_manifest.yaml`~~ → `task preflight`, see
      note) for ready roadmaps touched by the push; drafts exempt;
      exit-code-2 → warn-and-allow.
      <!-- executed 2026-08-04 — the step text named the wrong surface; corrected here per R2 finding 6. The git pre-push chain in this repo is `.git/hooks/pre-push` → `task preflight` (verified: the hook body invokes it and exits non-zero on failure). `hook_manifest.yaml` carries AGENT-lifecycle hooks (session_start / pre_tool_use / post_tool_use) and has no pre-push slot, so it is the wrong registration point. Both validators are registered in `task preflight` and the `task ci` aggregate, each call site carrying the exit-2 → warn-and-allow wrapper. The AC "fails pre-push" is met by the real chain. -->
- [x] **Step 4:** CI enforcement: wire `lint_plan_risk_register` into the
      CI pipeline (gate-coverage entry flips `status: pending` →
      `enforced`).
- [x] **Step 5:** Add the Risk Register requirement + schema pointer to
      `src/agent-src/templates/roadmaps.md` (new numbered rule) and to the
      roadmap-authoring surfaces' docs.
- [x] **Step 6:** E2E acceptance: (a) a ready roadmap without a valid Risk
      Register can be neither pushed (hook) nor merged (CI); (b) the
      honest-null path passes both; (c) a `status: draft` roadmap without
      a register pushes fine, and flipping it to ready without adding a
      register blocks; (d) a crashed validator (forced exit 2) warns and
      allows.

## Phase 6: Wire Gate R2

- [x] **Step 1:** Completion-event detection: when the last open item of a
      roadmap flips to done in a session, the completion-review flow fires
      (extend the `roadmap-management` completion/archival flow, which
      already runs at `count_open == 0`).
- [x] **Step 2:** Pre-PR chokepoint: extend `/create-pr` with a fixed
      sequence — (1) § 1c archival sweep runs first, (2) R2 review (the
      findings artifact references post-archival paths), (3) PR creation
      only with a valid findings artifact, honest-null, or skip
      declaration for the current diff hash.
- [x] **Step 3:** Fresh-subagent dispatch for Phase 1: implement
      `src/scripts/dispatch_r2_reviewer.ts` — a deterministic dispatcher
      that constructs the reviewer input itself (branch diff via git,
      roadmap file, extracted AC), computes the `inputs` hashes, writes
      the context manifest into the artifact header, and dispatches the
      reviewer under the tool allowlist from the Phase 4 contract
      (branch-scoped `git diff` + branch-path file reads; no `git log`
      beyond the branch, no repo-wide grep, no `agents/runtime/` or
      session-artifact reads); reuse `/judge:on-diff` machinery for the
      review itself. The implementing agent never assembles the reviewer
      context (verdict #18). Findings artifact lands tracked under
      `agents/reviews/` (confirm exact location against the
      `agents-layout` contract; adjust there if it prescribes another
      home).
      <!-- executed 2026-08-04: agents-layout prescribes agents/evidence/ for "everything evidential" — adjusted to agents/evidence/reviews/ (and metrics to agents/evidence/metrics/); no new top-level dir needed. -->
- [x] **Step 3b:** CI manifest verification: re-derive the expected
      `inputs` hashes from the PR's diff SHA + roadmap path and block on
      manifest mismatch (manifest = verification, not self-attestation).
- [x] **Step 4:** Two-phase enforcement: the findings artifact must be
      committed before the first fix commit (commit-ancestry check in
      `check_completion_review.ts`). Enforcement point: **pre-push hook +
      CI, dual layer, CI authoritative**; agent-side advisory only.
      Silent fixing → block.
- [x] **Step 5:** Applicability guard: implement the no-code-surface skip
      path — plan-only/docs-only diffs and out-of-repo sessions produce
      the explicit skip declaration; the validator accepts it as a valid
      artifact state AND rejects it when the diff touches code paths.
- [x] **Step 6:** E2E acceptance: (a) PR without valid findings artifact is
      blocked; (b) subagent review demonstrably runs without implementation
      context (context-manifest assertion) and a blocklisted tool call
      (`git log --all`, repo-wide grep) is rejected in the review context;
      (c) fix-commit-before-artifact is detected and blocked; (d) a
      backdated findings artifact (amended to postdate fixes) is detected
      and blocked; (e) docs-only PR passes via skip declaration; (f) a
      skip declaration on a code-touching diff is rejected.
      <!-- executed 2026-08-04 — (b) HALF-MET, corrected claim per R2 finding 7. Delivered: the dispatcher builds the reviewer context deterministically and the manifest's `inputs` hashes are re-derived by CI, so "runs without implementation context" IS checkable (that is the verdict-#18 mechanism). NOT delivered: repo-side REJECTION of a blocklisted tool call. The allowlist is prompt-carried and manifest-DECLARED; the host, not this repo, decides which tools a subagent may call, so no in-repo gate can reject `git log --all` inside a review context — asserting otherwise would be a coverage claim with no mechanism behind it. The residual is recorded as `accepted-risk` in contract § 5 (host-level injection / tool grant outside the dispatcher) rather than papered over with a test that only greps the prompt text. (a), (c)-(f) are covered by the validator test suites. -->

## Phase 7: Pre-registered measurement

- [x] **Step 1:** Metrics capture from day 1 of activation — tracked
      append-only JSONL `agents/metrics/gate-metrics.jsonl` (create the
      directory if missing; PII-free by construction — ids + counters
      only; each event carries the PR id / branch hash so concurrent
      branches merge without conflict): `r2_critical_catch_rate` (share of
      PRs where R2 catches ≥1 critical/high finding before merge),
      `r1_mitigation_hit_rate` (quarterly annotation, Step 2),
      `gate_latency_p50/p95` (added latency per plan/PR),
      `honest_null_rate` (share of reviews with 0 findings — sanity:
      persistently ~100% = review toothless or reviewer too lax),
      `r2_skip_rate` (share of completions taking the no-code-surface skip
      path — sanity: a rising skip rate on code-bearing repos = guard
      miscalibrated), `gate_c_bypass_rate` (share of plan asks where the
      user bypassed Gate C — persistent ~100% = gate friction exceeds
      value).
- [x] **Step 2:** Annotation helper for `r1_mitigation_hit_rate`: a small
      script (`src/scripts/annotate_r1_outcomes.ts`) that walks Risk
      Registers of archived roadmaps and prompts per mitigation —
      `helped | fired | unknown` — appending to the metrics JSONL;
      quarterly cadence noted in the contract doc.
- [x] **Step 3:** Two-stage pre-registration (verdict #20 — the original
      flat `≥ 15%` figure is withdrawn as unanchored). **Stage A (before
      any data):** pre-register the measurement *protocol* in `CLAIMS.md`
      (regen `build_proof` + denominator bump in the same change) —
      metric definitions, denominators, and a fixed advisory window: the
      first 10 gated PRs run R2 in advisory-only mode and the observed
      catch rate is recorded as baseline. Cost ceiling
      `gate_latency_p95 ≤ 5 min` per PR and alarm `honest_null_rate ≥
      90%` over 10 consecutive reviews are protocol-level and register in
      Stage A. **Stage B (after the baseline, before the enforced
      window):** derive the enforced-mode success threshold for
      `r2_critical_catch_rate` from the observed baseline and commit it
      to `CLAIMS.md` — set exactly once, never lowered afterwards.
- [x] **Step 4:** Honest-null publication commitment: if thresholds are
      missed, publish the result and rework or roll back the gates — never
      lower the thresholds afterwards.
- [x] **Step 5:** Acceptance: the protocol (Stage A) is committed before
      the first data point and the enforced-mode threshold (Stage B) is
      committed after the 10-PR advisory baseline and before the enforced
      window (CLAIMS.md entries); after 20 gated PRs a measurement report
      exists regardless of outcome.

## Phase 8: Projections + docs

- [x] **Step 1:** Run `task sync` — regenerate `dist/agent-src/` (CI
      asserts `dist == rewrite(src)` byte-for-byte; does NOT rebuild the
      install bundle — that happened atomically in Phase 1 Step 3).
- [x] **Step 2:** Run `task generate-tools` — regenerate per-tool
      projections for the touched command/skill files.
- [x] **Step 3:** Doc-impact: the three settings keys are public surface —
      template comments are canonical; add to `docs/customization.md` only
      if a settings-key index exists there (one-line reason if not).
      Cross-link `docs/contracts/plan-review-gates.md` from the gate
      scripts and touched surfaces.

## Acceptance Criteria

- [x] `planning.challenge_on_create`, `planning.risk_review`,
      `planning.completion_review` exist in template + Zod schema, default
      `true`; missing keys behave as `true`; parity test green.
- [x] Gate C: active + confidence < 95% → interview before authoring;
      all four conditions hold → direct creation with exactly one marker
      line; `false` → today's behavior; degrade path works without the
      challenge-me command; C→R1 handoff prevents double interviews.
- [x] Gate R1: a ready plan without a valid Risk Register (or explicit
      honest-null) fails pre-push and CI; drafts are exempt (tested); stale
      or dangling registers fail.
- [x] Gate R2: PR/completion without a valid findings artifact,
      honest-null, or skip declaration for the current **review-scope
      hash** is blocked; findings-before-fixes is enforced by ancestry
      check (pre-push + CI, backdating detected); the fresh reviewer runs
      without session history, its context built by the dispatcher and
      manifest-checked (CI re-derives the input hashes) under a
      **declared** tool allowlist; no-code-surface completions skip
      explicitly, never silently, and skips on code-touching diffs are
      rejected.
      <!-- amended 2026-08-04 per R2 findings 1 + 7: (a) the binding is the review-scope diff hash, not a head sha — a head sha cannot be satisfied once the artifact is committed, and CI checks out a merge commit (contract § 2.1); (b) "leak-tested" removed — the allowlist is declared and manifest-checked, but rejecting a blocklisted tool call is host-side and not repo-enforceable; the residual is `accepted-risk` in contract § 5. -->
- [x] Degraded mode: any validator internal error (exit 2) warns and
      allows — a broken gate never blocks its own fix; policy violations
      (exit 1) block.
- [x] Both validators emit `scanned: <N>`, are registered in
      `gate-coverage.yml` with real floors, and have 0 false-pass on the
      fail fixtures.
      <!-- executed 2026-08-04 — "real floors" is HALF-MET, corrected claim per R2 round-4 finding 4. `lint_plan_risk_register` carries a real floor (`min_scanned: 12` against 19 actual). `check_completion_review` does NOT: its `scanned` is `artefacts + 1 for the diff evaluation`, so `min_scanned: 1` can never trip — the gate-coverage entry says so in its own note rather than implying a floor it does not have. Its teeth are elsewhere and they are real: the dead-scan-scope assertion exits 1 (blocking), so a moved reviews root fails loudly instead of reporting a clean scope. The `scanned:`-emission and 0-false-pass halves of this criterion are fully met. -->

      <!-- Also corrected per round-4 finding 2: the Write-path rule wording at line ~116 of this roadmap ("generic write operations on that glob are a lint violation") over-claims. There is no lint and no hook entry; the rule is agent-carried and the state file is gitignored, so CI never sees it. The shipped context (`plan-confidence-gate.md`) and contract § 4.1 now both state `enforced_by: none` explicitly. This roadmap's line stays as the historical record of the verdict-#19 decision. -->

- [x] Measurement protocol is pre-registered in `CLAIMS.md` before the
      first data point; the enforced-mode catch-rate threshold is derived
      from the 10-PR advisory baseline and frozen before the enforced
      window (two-stage pre-registration, verdict #20).
- [x] The post-artifact hard stop is unchanged on every surface; no gate
      lifts any safety floor.
- [x] `dist/agent-src/` byte-identical to `rewrite(src)`; install bundle
      rebuilt atomically with the schema change; `check_references` and
      frontmatter validation green on touched files.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host+council -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Silent fixing bypasses Phase 1 | implementation | Agent fixes before creating findings; artifact is written afterwards, empty | Commit-ancestry check at pre-push + CI (dual layer); backdating fixture in tests | Phase 6 Step 4, Phase 6 Step 6 |
| 2 | Stale reviews | implementation | Review on an old diff, then a new push without re-review | Diff-hash binding in the artifact; hash mismatch = block | Phase 4 Step 3, Phase 6 Step 2 |
| 3 | Broken gate blocks its own fix | implementation | A buggy/crashing validator blocks every push — including the push that would fix or disable it | Exit-code contract: internal errors (exit 2) → degraded advisory mode, warn-and-allow; only policy violations block | Phase 4 Step 1, Phase 5 Step 3 |
| 4 | Gate fatigue / pro-forma registers | product | Agents fill registers with generic placeholder risks; the gate becomes ritual | `honest_null_rate` alarm + quarterly annotation; dangling-ref check forces anchoring in the plan | Phase 4 Step 2, Phase 7 Step 1 |
| 5 | Reviewer context leaks | implementation | Fresh subagent reconstructs session context via data input or tools (`git log`, repo-wide grep) → blind-review property lost | Dispatcher-built reviewer context + CI hash re-derivation (manifest = verification, verdict #18); tool allowlist; adversarial leak E2E; residual host-injection declared accepted-risk | Phase 6 Step 3, Phase 6 Step 3b, Phase 6 Step 6 |
| 6 | Latency cost exceeds value | product | Three gates measurably slow every plan/PR | Pre-registered cost ceiling `p95 ≤ 5 min`; on miss: rework/rollback, never threshold-lowering | Phase 7 Step 3 |
| 7 | Substantial-change heuristic miscalibrated | implementation | R1 fires on typo fixes or misses real scope changes | Heuristic defined as a contract BEFORE implementation; FP/FN fixtures as regression suite | Phase 4 Step 1, Phase 5 Step 1 |
| 8 | Blocking write-hook breaks incremental authoring | implementation | A pre-write block would reject every intermediate save while a plan is being drafted | Enforce at ready/push/CI instead; drafts exempt; authoring-flow step carries the agent-side obligation | Phase 5 Step 3 |
| 9 | Double interviews annoy users | product | Gate C interview + R1 risk pass question the user twice for one plan | Machine-readable C→R1 handoff state (plan-hash-fresh); R1 is self-review, no second interview | Phase 3 Step 6, Phase 5 Step 2 |
| 10 | Skip path becomes the default | product | R2's no-code-surface skip gets used to dodge reviews on code-bearing work | `r2_skip_rate` metric + explicit skip declaration with reason; validator rejects skip when the diff touches code paths | Phase 6 Step 5, Phase 7 Step 1 |

## Parked / Refused

- **LLM-based finding-quality scoring in the gate path** — refused: not
  deterministic, not pre-registrable, CI-unfit. Quality is measured via
  Phase 7 metrics, never judged inside the gate.
- **Extending R2 to every single task completion** — parked: wait for
  Phase 7 data; gate-fatigue risk (Risk 4) grows with frequency.
- **Automatic fixing by the reviewer subagent** — refused: violates the
  two-phase split and reproduces the silent-fixing problem on the reviewer
  side.
- **Blocking pre-write hook for R1** — refused (adaptation of the original
  draft): rejects every intermediate save during interactive authoring;
  enforcement moved to ready/push/CI with drafts exempt (Risk 8).
- **Extending the schema parity test to validate template comments** —
  refused (council X3): comments are prose, not a deterministic contract;
  PR review covers them (Phase 1 Step 4 notes this explicitly).

## Claims Ledger (feeds `CLAIMS.md` in Phase 7)

| Claim | Status | Evidence |
|-------|--------|----------|
| "Gates block deterministically without LLM judgment" | pending | Phase 4 validators + fixtures |
| "Fresh-subagent review runs without implementation context" | pending | Phase 6 context manifest + tool-leak E2E |
| "R2 catches critical findings before merge" | pending | Phase 7 two-stage protocol — threshold derived from the 10-PR advisory baseline, then frozen (the flat 15% figure is withdrawn as unanchored, verdict #20) |
| "Gates cost ≤ 5 min p95 per PR" | pending | Phase 7 measurement |
| "A crashed validator never blocks the workflow" | pending | Phase 4 exit-code fixtures + Phase 5/6 E2E |

No claim moves to `verified` without its referenced evidence. Missed
thresholds → honest-null publication.

## Notes

- Full-pipeline CI runs stay off locally (`quality.local_auto_run: false`)
  — remote CI on the PR is the authoritative gate; only the targeted probes
  named in the steps run locally (new/changed-surface carve-out per
  `roadmap-ci-steps-policy`).
- Gate ordering within one plan lifecycle: **C** (before authoring — is the
  intent clear?) → **R1** (after drafting — are the risks captured and
  mitigated in the plan?) → **R2** (at completion/PR — did a blind review
  happen before fixes?). C and R1 share one flow (Risk 9); R2 is
  independent of both.
- Alternative key name `roadmap.challenge_on_create` was rejected: the
  scope is "roadmaps and every plan we create", which spans the feature
  cluster too.

## Council review (2026-08-04)

Deep-tier council run (`--input-mode roadmap --depth deep`), members:
anthropic/claude-sonnet-4-5 (Response-A), openai/gpt-4o (Response-B).

### Convergence findings

1. **R2 enforcement point unspecified** — where the ancestry check runs
   (pre-push vs CI vs advisory) was undefined · trace: §A C1, §B Agreement 2
2. **C→R1 handoff had no contract** — "resolved branches feed R1" was
   prose without a data format, staleness rule, or reader step · trace:
   §A C2, §B Agreement 3
3. **No kill-switch / degraded mode** — a buggy validator in the pre-push
   hook would block the very push that fixes or disables it · trace:
   §A H1, §B Agreement 4
4. **Gate C degrade path untested/unspecified** — the inline interview for
   consumers without `/challenge-me` had no protocol or verification ·
   trace: §A H4, §B Agreement 5
5. **Reviewer tool leakage** — data-input isolation without a tool
   allowlist lets the reviewer reconstruct session context · trace:
   §A H2, §B N8
6. **Honest-null needs an exact grammar** — otherwise validators diverge
   on what "empty" means · trace: §A H3, §B N3 (adjacent)
7. **Adversarial e2e gaps** — backdated artifacts (§A M4, §B N1),
   draft-exempt path (§A M5, §B N4), dangling anchors (§B N2)
8. **Metrics location underspecified** — tracked vs gitignored, merge
   conflicts · trace: §A M3, §B N5
9. **Archival-sweep vs R2 sequencing** — before/after § 1c was ambiguous ·
   trace: §A M2, §B N7
10. **Live-roadmap-as-fixture is circular** — synthetic fixtures instead ·
    trace: §B Agreement 1

### Divergences (no consensus)

- **Phase 4/5 heuristic ordering** — A: definition must move into the
  Phase 4 contract (tests can't precede the rule); B: a completion check
  suffices without reordering. Host sided with A (contract-first is the
  repo pattern; fixtures need a rule to test).
- **Schema-rebuild timing severity** — A: atomicity hazard worth a step
  clause; B: standard merge hygiene. Host added the one-line clause
  (cheap, prevents a known CI trap).
- **Parity test validating template comments** — B: include; A: low. Host
  refused (prose is not a deterministic contract) — see Parked / Refused.

### Host verdict

| # | Finding | Verdict | Applied as |
|---|---|---|---|
| 1 | R2 enforcement point (A C1) | `accept` | Gate R2 spec + Phase 6 Step 4: pre-push + CI dual layer, CI authoritative, agent-side advisory |
| 2 | C→R1 handoff contract (A C2) | `accept-with-modification` | State-file contract (slug + plan hash + same-session freshness) in Phase 3 Step 6 + Phase 4 Step 1; dropped A's 1-hour TTL (session-bound instead) |
| 3 | Substantial-change heuristic + ordering (A C3/M1) | `accept` | Heuristic defined in Phase 4 Step 1 contract; Phase 5 Step 1 implements per contract; FP/FN fixtures in Phase 4 Step 4 |
| 4 | Kill-switch / degraded mode (A H1) | `accept` | Exit-code contract (0/1/2) in Phase 4 Step 1; warn-and-allow on internal errors; Risk 3 + AC + claim added |
| 5 | Reviewer tool allowlist (A H2, B N8) | `accept` | Gate R2 spec + Phase 6 Steps 3/6 (adversarial leak E2E) |
| 6 | Honest-null exact grammar (A H3) | `accept` | Phase 4 Step 1 contract owns the exact marker grammars; new fail fixtures |
| 7 | Degrade-path protocol + verification (A H4) | `accept` | Inline protocol spelled out in Phase 2 Step 1; walkthrough evidence in Phase 3 Step 7 |
| 8 | Archival/R2 sequencing (A M2, B N7) | `accept` | Phase 6 Step 2 fixed sequence: sweep → review → PR |
| 9 | Metrics location (A M3, B N5) | `accept-with-modification` | Tracked `agents/metrics/gate-metrics.jsonl` with per-event PR id (not `agents/runtime/state/`, which is gitignored) |
| 10 | Backdating + draft-exempt + leak E2Es (A M4/M5, B N1/N4) | `accept` | Phase 5 Step 6 / Phase 6 Step 6 expanded |
| 11 | Synthetic fixtures over live roadmap (B Agreement 1) | `accept` | Phase 4 Step 4 reworded — live register is reference only |
| 12 | Context-manifest schema (A X1) | `accept` | Phase 4 Step 1 contract |
| 13 | Annotation process unfunded (A X2) | `accept-with-modification` | Lightweight `annotate_r1_outcomes.ts` as Phase 7 Step 2 (no recurring-tracker integration yet) |
| 14 | Gate C bypass audit (B N6) | `accept` | `gate_c_bypass_rate` metric in Phase 7 Step 1 |
| 15 | Parity test validates comments (A X3, B N3) | `reject` | Prose is not a deterministic contract; PR review covers it — recorded in Parked / Refused |
| 16 | Phase-5-needs-Phase-3 dependency (A S1) | `accept` | Prerequisite line on Phase 5 |
| 17 | Bundle-rebuild atomicity (A S2) | `accept` | Phase 1 Step 3 + Phase 8 Step 1 clarified |

### Predecessor council trace

Deep-tier run of 2026-08-04, members anthropic/claude-sonnet-4-5 +
openai/gpt-4o (raw responses are local-only council artifacts,
auto-pruned after the retention window — convergence is inlined above).

## Addendum: post-merge adjudication of advisory-gate blocking findings (PR #1155)

> The dogfooded advisory review on PR #1155 (2026-08-04) reported 3
> findings that WOULD block merge under an enforced gate. The PR merged
> while the gate was advisory. Per the two-phase rule this roadmap itself
> introduces, every finding must end in `fixed | accepted-risk |
> deferred`. This addendum closes that loop; the spec amendments the
> verdicts require are applied in the phases above. Verdict-table
> numbering continues from the council table (#18–#20).

### Host verdict (continued — advisory-bot blockers)

| # | Finding | Verdict | Applied as |
|---|---|---|---|
| 18 | R2 reviewer context isolation incomplete — agent-side advisory layer leaks implementation context (91e343b91057, critical) | `accept-with-modification` | Split into fix + residual. **Fix:** reviewer input is never assembled by the implementing agent — a dedicated dispatcher script (`src/scripts/dispatch_r2_reviewer.ts`, Phase 6 Step 3) constructs the reviewer context deterministically (branch diff via git, roadmap file, extracted AC), computes the `inputs` hashes itself, and writes the context manifest; CI re-derives the expected hashes from diff SHA + roadmap path and blocks on mismatch (Phase 6 Step 3b) — the manifest becomes verification, not self-attestation. **Residual (`accepted-risk`):** host-level injection outside the dispatcher (a host that prepends extra context to the subagent) is not preventable from inside the repo; detection floor = adversarial-leak E2E (Phase 6 Step 6). Threat model documented in the Phase 4 contract. |
| 19 | C→R1 handoff state file writable by any agent op — tampering bypasses the interview (c36ee4726ad5, high) | `accept-with-modification` | Cryptographic tamper-proofing is refused (a secret stored in a local repo is not a secret). Applied instead: **verifiable provenance + explicit threat model.** (a) `gate-c-<plan-slug>.json` gains a mandatory `transcript_ref` (path + content hash of the interview transcript artifact); the R1 validator checks existence + hash match — a forged state file now requires a forged transcript, which is census-visible and auditable. (b) Write path restricted by rule: only the Gate C flow writes `agents/runtime/state/gate-c-*.json`; generic write operations on that glob are a lint violation. (c) The Phase 4 contract states the threat model explicitly: the guard defends against *silent agent shortcuts*, not against the local human — who holds a legitimate settings escape hatch anyway, so forgery gains nothing that cannot be done openly. Detectability over prevention, by design. |
| 20 | R2 critical-catch threshold ≥15% / 20 PRs unanchored — no baseline (d4c3431122fe, high) | `accept` | Phase 7 Step 3 restructured into a two-stage pre-registration. **Stage A (before any data):** pre-register the measurement *protocol* — metric definitions, denominators, and a fixed advisory window of the first 10 gated PRs in which R2 runs advisory-only and the observed catch rate is recorded as baseline. **Stage B (after baseline, before the enforced window):** derive and commit the enforced-mode success threshold from the observed baseline to `CLAIMS.md` — set once, never lowered afterwards (honest-null commitment unchanged). The Claims Ledger entry "threshold ≥15% / 20 PRs" is updated to reference the two-stage protocol; the 15% figure is withdrawn as unanchored. |

### Notes

- **Sequencing:** #18 and #19 land as spec amendments before Phase 4/6
  execution starts (they change the Phase 4 Step 1 contract file); #20
  amends Phase 7 before activation. No shipped behavior is affected —
  PR #1155 was roadmap-only.
- **Bot findings vs. council findings:** the advisory bot ran *after* the
  council-adjudicated commits, so these three were structurally unable to
  appear in the original verdict table. Process note for the R2 rollout:
  the enforced gate closes exactly this window (findings after last
  commit → diff-hash mismatch → re-review before merge).
- **Remaining advisory findings (non-blocking):** the 7 advisory-severity
  findings from the same run are not adjudicated here; recommend a
  follow-up pass, in particular 3d1ec40e05b0 (substantial-change heuristic
  rename bypass — cheap contract fix) and 93a92e2d713a (stable risk IDs
  `R-001` + separate rank column — prevents cross-reference breakage on
  every register reorder).
