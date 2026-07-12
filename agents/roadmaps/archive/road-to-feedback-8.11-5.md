---
status: ready
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to feedback 8.11 round 5 — the fallback and the gate

> Disposition roadmap for the round-5 review of PR #924 (9.4/10; source
> `agents/tmp/feedback-8.11-5.txt`, gitignored, summarized inline). Verdict
> there: team-mode v1 is "a safe, governed access layer — not yet the
> build→review→fix orchestrator"; this PR (team-mode Phases 3+4, mandated
> as next by two prior councils) decides whether team mode becomes a real
> agent-config work form. Also lands the review's hardening asks and the
> three advisory bot findings.
>
> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-07-12, 2
> rounds):** envelope = EXTEND the subagent-status frame (one envelope
> family across subagents and team mode), emitted by the fallback and
> documented as the normalization target for plugin output; full
> build→review→fix loop NOT built — gated behind a positive Phase-5
> review-lift verdict (same gate as the deferred worker-delegate), and the
> /team docs stop implying an existing loop; bot findings (i) malformed-
> settings red-path, (ii) expiry-aware auth check (local parse, no
> network), (iii) namespace-resistant plugin identity all land now in
> their cheap forms; quota-status clarity + Phase-5 metric-family
> amendment adopted. Round-2 rebuttal flipped pack ownership: /team MOVES
> to the meta pack now (pack-scoped installs would otherwise ship /team
> through product-reasoning — a routing consequence, not cosmetics; the
> move is 5 frontmatter lines + manifests while the family is young).
> Phase-5 refinement pre-registers the metric FAMILY (planted-defect
> recall with ground truth, false positives, cost/time/calls, fix
> success; judge preference demoted to secondary); numeric thresholds are
> fixed at fixture-authoring time — still BEFORE execution.

## Goal

Execute road-to-team-mode Phase 3 (read-only multi-host fallback:
`team_dispatch.ts` repo-context bundle through the existing
OpenAICliClient, honest capability-delta header, same quota/auth,
`--manual` render; worker-delegate stays deferred) and Phase 4
(Review-Gate governance: `ai_team.review_gate` managed-mode circuit
breaker, ledger lines, doctor WARN) — plus the round-5 hardening: the
team-review result envelope extending the subagent-status frame, three
bot findings, quota-status clarity, /team wording tightened to what it
IS, the pack move to meta, and the Phase-5 design amendment. Owner
boxes flip in `road-to-team-mode.md`.

## Phase 0 — Round-5 hardening (bot findings + clarity + ownership)

- [x] <!-- done 2026-07-12: loader was ALREADY fail-closed (unparseable →
      {} → safe defaults; scalar/array/string-bool → TeamConfigError) — now
      locked by 5 red-path tests; no fix needed, regression-proofed. -->
      **Malformed-settings red-path test**: a malformed/unparseable
      settings file must NEVER yield `allow_delegate: true` (or
      `enabled: true`) — explicit fail-closed proof in the ai_team config
      tests.
- [x] <!-- done 2026-07-12: offline expiry from explicit fields + JWT
      payload exp (base64url only, no verification), latest-wins semantics
      (real-world: expired id_token beside live access_token), WARN
      "appears expired — run codex login"; presence-only limitation
      appended when underivable; 5 tests. -->
      **Expiry-aware auth signal (cheap)**: doctor's codex auth
      sub-signal parses the local auth file for an expiry/refresh field
      when one exists (no network call) and WARNs on past expiry;
      otherwise the check output states the presence-only limitation
      explicitly.
- [x] <!-- done 2026-07-12: installed_plugins.json carries no source —
      identity verified via known_marketplaces.json source.repo ==
      openai/codex-plugin-cc; honest "identity not fully verified (prefix
      match)" fallback (informational, presence still real); namespace-
      squat fixture test; 3 tests. -->
      **Namespace-resistant plugin identity**: strengthen the
      installed-plugins match by verifying the marketplace source
      (repo/owner) when the metadata carries it; fall back to prefix
      matching WITH an honest "identity not fully verified" note in the
      doctor detail.
- [x] <!-- done 2026-07-12: status Step 4 = quota block (counter/team
      ceiling/council ceiling, OPEN|BLOCKED per path, never bare "quota
      exhausted"), Step 5 reads team.gate ledger lines; worked example in
      both status command and ai-team-config (envelope-snippet placeholder
      set); frontmatter 406/0, md-language clean. -->
      **Quota-status clarity**: `/team:status` explains
      two-ceilings-one-counter with the live numbers (counter today, team
      ceiling, council ceiling, which path is currently blocked);
      `docs/contracts/ai-team-config.md` gains the worked example
      (council 100 / team 50 / counter 45 → five team calls later team
      blocks while council continues).
- [x] <!-- done 2026-07-12: "governed access layer with a read-only
      multi-host fallback" framing in master + getting-started; iterated-
      loop phrasing removed; gated-future-work line added; no-claims
      paragraph untouched; host capability table added. -->
      **Wording tightening**: /team master + getting-started stop
      implying an existing build→review→fix loop — v1+fallback is "a
      governed access layer with a read-only multi-host fallback"; the
      loop is recorded as gated future work (Phase-5 verdict), same gate
      as the deferred worker-delegate.
- [x] <!-- done 2026-07-12: 5×frontmatter pack/packs → meta (packs.yml
      needs no source change — assignment is frontmatter-driven);
      generated pack manifests + projections regen by orchestrator in
      close-out. -->
      **Pack move**: team domain pack assignment product-reasoning →
      meta (frontmatter on the 5 command files + pack manifests +
      surface regen); internal/tier-2 unchanged.

## Phase 1 — Execute road-to-team-mode Phase 3 (multi-host fallback)

Owner boxes flip in `road-to-team-mode.md`. Read-only by contract; the
worker-delegate Step 4 stays `[~]` deferred (flow-learnings null).

- [x] <!-- done 2026-07-12: src/scripts/ai_team/team_dispatch.ts —
      120k-char diff cap w/ named truncation, capability-delta header
      FIRST in both modes, TeamReviewCliClient subclass (quota/auth fully
      inherited, zero new counter code), git subcommands allowlist-guarded
      read-only, --manual ═-render (no call, no quota), fail-closed
      TeamDisabledError; NOTICE created (Apache-2.0 attribution per the
      license carve-out); 29 tests green. -->
      `team_dispatch.ts` beside the ai_team scripts sharing
      `clients.ts`: repo-context bundle (git status + size-capped staged/
      unstaged diff with truncation marker + file list) through
      `OpenAICliClient` with a review system prompt derived from the
      plugin's findings shape (attributed; NOTICE entry); honest
      capability-delta header on EVERY fallback run (single synchronous
      call, diff bundle, no background jobs — worse than the plugin and
      says so, pointing Claude-Code users to the plugin path); same
      ai_team config + quota bucket + `_AUTH_FAILURE_PATTERNS`;
      `--manual` renders the bundle between `═` rules; output emitted in
      the team-review envelope (see Phase 3); tests: bundle cap
      red/green at the boundary, header prose, auth-fail, manual render —
      fake-client seam, no billable calls.

## Phase 2 — Execute road-to-team-mode Phase 4 (Review-Gate governance)

- [x] <!-- done 2026-07-12: config+zod+loader w/ nested unknown-key
      rejection; review_gate.ts verdict parser (UNKNOWN honest, never
      counted as BLOCK), per-session state via shared atomic state_io
      (pruned to 20 sessions), dedupe on the plugin job id; circuit
      breaker exactly-once (ALLOW re-arms); JSONL ledger
      agents/runtime/team/events.log (enum-only, PII-excluded); doctor
      WARN quotes the upstream cost warning verbatim; hook wired into the
      manifest claude stop slot (cowork stays structurally-ready per its
      upstream caveat), managed:false = byte-identical Stop path;
      manifest lint 0, 208+14 tests green. -->
      `ai_team.review_gate: { managed: false, max_consecutive_blocks: 3 }`
      (managed:false = byte-identical today); managed mode counts
      consecutive BLOCK verdicts per session from the gate transcript's
      first-line ALLOW/BLOCK contract, injects the visible
      circuit-breaker notice exactly once at the bound and stops
      re-blocking (user decides — never an infinite Claude↔Codex loop);
      events-log ledger line per verdict (`team.gate: BLOCK 2/3`) read by
      `/team:status`; doctor check-c upgraded (WARN when the plugin gate
      is on while `managed: false`, quoting the upstream cost warning);
      tests: block-count state machine on fixture transcripts,
      circuit-breaker rendering, ledger line shape, doctor WARN.

## Phase 3 — Team-review envelope (council: extend the subagent frame)

- [x] <!-- done 2026-07-12: team-review-status.json beside
      subagent-status.json (additionalProperties:false, key-set test);
      unparseable → raw + DONE_WITH_CONCERNS; contract doc gained the
      envelope subsection at the placeholder. -->
      Extend the `subagent-status.json` frame family with a
      team-review payload: `{ status: DONE|DONE_WITH_CONCERNS|
      NEEDS_CONTEXT|BLOCKED, findings: [{severity, evidence,
      suggested_fix, location?}], reviewed_ref, model, quota: {used,
      ceiling} }` — one envelope family across subagents AND team mode.
      Emitted structurally by the fallback (team_dispatch); documented in
      `ai-team-config.md` as the normalization target for plugin output
      (wrappers summarize INTO it; plugin text preserved verbatim
      beneath — never rewritten). Schema + fixture tests.

## Phase 4 — Owner-roadmap bookkeeping + Phase-5 design amendment

- [x] <!-- done 2026-07-12: owner Phase 3 (4 steps, 3.4 stays [~]) +
      Phase 4 (4 steps) flipped with evidence; Phase-5 metric family
      pre-registered (recall/FP/cost/fix-success primary, judge
      secondary, thresholds at fixture-authoring); loop + worker-delegate
      share the review-lift gate. -->
      Flip road-to-team-mode Phase 3 (Steps 1-3, 5) + Phase 4 (Steps
      1-4) with evidence notes; Step 3.4 stays `[~]` deferred. Amend the
      Phase 5 design step: pre-registered metric FAMILY = planted-defect
      recall against ground truth, false-positive count, cost/time/
      calls, fix success; judge preference secondary; numeric thresholds
      fixed at fixture-authoring time (before execution — prereg
      discipline holds); record the loop-gated follow-up (build→review→
      fix loop unlocks only with a positive review-lift verdict).
- [x] <!-- done 2026-07-12: install bundle rebuilt (review_gate schema),
      sync/generate-tools/pack-manifests regenerated (team out of
      product-reasoning), team-review-gate wired into the manifest claude
      stop slot (lint 0), condensation ledger clean, counts/capabilities/
      catalog/check-refs/typecheck green, 184 tests across the team
      suites. -->
      Close-out: sync + generate-tools + counts/capabilities/catalog/
      command-flows gates green; condensation ledger; check-refs;
      typecheck; dashboard regen; archive this roadmap.

## Acceptance criteria (anti-dump)

- Fallback is READ-ONLY by construction (no write path reachable from
  team_dispatch), carries the capability-delta header on every run, and
  reuses transport/auth/quota with zero new network code (import-graph
  provable).
- `managed: false` keeps the Stop path byte-identical; the circuit
  breaker renders exactly once at the bound on fixture transcripts.
- Malformed settings NEVER enable anything (red-path proven).
- No review-lift claim anywhere; /team wording says what it is.
- New tests run once locally; full pipeline stays with remote CI.
- Owner boxes flipped; this roadmap archives in its own PR.

## Blockers

- **blocker: benchmark-spend-authorization** — unchanged (owner: user;
  road-to-team-mode Phase 5 execution only).
- **blocker: branch-protection-apply** — unchanged (owner: user).

## Notes

- NOT adopted this round: the full build→review→fix loop (gated on the
  Phase-5 verdict — building it now would ship the claim-shaped surface
  before any review value is proven); worker-delegate un-deferral;
  plugin-output rewriting (envelope wraps, never rewrites); any
  network-based auth validation.
