---
status: ready
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to feedback 8.11 round 4 — ship the smallest real /team

> Disposition roadmap for the round-4 review of PR #921 (9.8/10; source
> `agents/tmp/feedback-8.11-4.txt`, gitignored, summarized inline). Its
> closing directive: "the next big task should now actually be the
> standalone team-mode track — NOT another round of internal governance
> reports." This run executes exactly that: road-to-team-mode Phases 1+2
> (+ the close-out subset they need), plus the review's four small asks as
> a light Phase 0.
>
> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-07-12, 2
> rounds):** Round 1 both members leaned Phases 1-4; Round 2 BOTH
> rebuttals converged on **Phases 1+2 only** — under the default-off +
> fail-closed contract, the multi-host fallback (P3) and Review-Gate
> governance (P4) are essential to future GA enablement, not to this
> ship; fail-with-remediation IS the v1 answer on hosts without the
> plugin; smaller radius, faster feedback. P3+P4 = the immediately-next
> PR. Unanimous: small asks ride along (docs-class); coupling-quality
> adopts ONLY the correctness slice now (orphan-stub target resolution —
> a broken promise, not a metric), semantic metrics parked; the
> later-hard-gates list is recorded, never built here; settings UX stays
> routed; NO public review-lift claim ships before the spend-gated
> benchmark (claims stay pre-registered/absent).

## Goal

Land a default-off, fail-closed `/team` v1 on the Claude-Code path:
doctor detection + guided setup (owner Phase 1), the `/team` command
family with the `ai_team` config contract and subscription-quota wiring
(owner Phase 2), and the close-out surface those need — while the
round-4 small asks (Batch-B/C stub-necessity guidance, branch-protection
operating conditions, linter warning, on-demand-proof cross-ref) and the
backlink correctness check land as Phase 0. Owner-roadmap boxes flip in
`road-to-team-mode.md` (source of truth for the build); this file tracks
the run.

## Phase 0 — Round-4 small asks + backlink correctness slice

- [x] <!-- done 2026-07-12: four pre-questions into Batch B AND C (C adds
      "remove answer = escalate with disposition note, never silent cut" —
      floors are must-stay); Batch A keep-all-9 explicitly not inherited. -->
      **Batch B/C stub-necessity guidance**: amend
      `road-to-request-scoped-rule-load.md` Phase 5 Batch B/C text with
      the per-rule questions from the review — does the stub need to
      exist at all / can the rule be removed entirely / is a router entry
      enough / is it merely historical? (Batch A deliberately kept all 9
      stubs; B/C must not inherit that automatically.)
- [x] <!-- done 2026-07-12: "Operating conditions under strict:false"
      section added (no post-CI amend, checks on final head, auto-merge
      only on complete green). -->
      **Branch-protection operating conditions**: extend
      `docs/maintainers/branch-protection.md` with the strict:false
      conditions — the checked commit must not change after green CI,
      critical checks run on the final head, auto-merge must never
      smuggle unchecked changes.
- [x] <!-- done 2026-07-12: root cause = migrated stub lost the concrete
      verification-tool names the linter maps; one sibling-style line added
      (src + dist); re-run: PASS 0 warnings both. -->
      **Linter warning**: clear the `pass_with_warnings`
      (missing_verification_tool_mapping) on the migrated
      `improve-before-implement` stub (src + dist + ledger).
- [x] <!-- done 2026-07-12: sentence in request-scoped-rule-load Phase 5
      intro — owned by utilization-window D-rules + request-scoped load. -->
      **On-demand-proof cross-ref**: one line recording WHERE "are the
      migrated bodies actually loaded only on demand?" is owned — the
      utilization window (D-rules) + request-scoped rule load; no new
      apparatus.
- [x] <!-- done 2026-07-12: resolve_target()/validate_targets() with the
      real shape map (skill:/guideline:/contract: dual-home/context paths);
      Orphan-stubs + Unknown-shape + Fan-out(info) + gated-future-work
      sections; --check exits 1 only on orphans; LIVE: 76 targets, 0
      orphans, max fan-out 8 (safety floors, info only); 14+34 tests green,
      typecheck green. -->
      **Backlink correctness slice**: extend `rule_backlinks.ts` with
      target-resolution validation — an orphan stub (routing target that
      does not resolve to an existing skill/guideline/contract/context)
      is LISTED and fails a `--check` mode (report mode stays exit 0);
      fan-out distribution rendered as info. Semantic metrics (cycles,
      competing owners) PARKED per the kill-criterion discipline; the
      review's later-hard-gates list recorded verbatim in the report
      design notes as gated future work ("only precise, non-proxy
      metrics may ever hard-gate").

## Phase 1 — Execute road-to-team-mode Phase 1 (detection + guided setup)

Owner boxes flip in `road-to-team-mode.md`; this step tracks the run.

- [x] <!-- done 2026-07-12: owner P1 Steps 1-4 all flipped in
      road-to-team-mode (doctor check, wizard hint, getting-started
      section, fixtures); 81+26 tests green. -->
      Doctor `team` section (codex binary+auth probe reuse, plugin
      detection under `~/.claude/`, Review-Gate state WARN) with exact
      remediation commands; wizard/init one-line recommendation
      (suppressible, never auto-installs); getting-started team-mode
      section with the 3-row council-contrast table; doctor/wizard
      fixture tests green.

## Phase 2 — Execute road-to-team-mode Phase 2 (/team family + contract)

- [x] <!-- done 2026-07-12: owner P2 Steps 1-6 all flipped in
      road-to-team-mode (5 command files, cluster registered, ai_team
      contract + loader + schema parity, quota via existing counter);
      validate_frontmatter 406/0; 23+3 tests green. -->
      New domain `src/domains/meta/team/` (orchestrator + review /
      adversarial / delegate / status wrappers; `cluster: team`,
      `disable-model-invocation: true`, suggestion triggers); thin
      fail-closed delegations to `/codex:*`; `/team:delegate` behind
      `ai_team.allow_delegate: false` second opt-in; `ai_team` settings
      block + `docs/contracts/ai-team-config.md` + schema rejection of
      unknown keys (role semantics in config + prompt library — council
      verdict, NO frontmatter key); quota via the existing
      `cli_call_budget` openai bucket; tests (fail-closed rendering,
      delegate gate, config defaults/rejection, quota increment).
      <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->

## Phase 3 — Close-out subset (what Phases 1+2 need)

- [x] <!-- done 2026-07-12: sync + generate-tools (183 commands),
      surface-map classification (coverage lint: 183/183), counts/
      capabilities/catalog/command-flows/proof regenerated + gates green,
      check-refs green, install bundle rebuilt (real ai_team schema, no
      path noise), condensation ledger clean; owner P6 Step 1 flipped
      (featured entry deliberately deferred to the P5 verdict); P3+P4
      next-PR note in owner § Notes. -->
      Command-surface regen + docs: `task sync` + `task generate-tools`
      (new commands into catalog/counts/surface maps), count gates green,
      `check-refs`-class link verification over the touched docs, and the
      team-mode roadmap's P6 boxes that these items satisfy flipped there
      (catalog/sync/refs); CHANGELOG stays with the release PR (release
      process owns it). Record in road-to-team-mode § Notes: P3 (multi-
      host fallback) + P4 (Review-Gate) are the immediately-next PR per
      the round-4 council; P5 stays spend-gated.

## Acceptance criteria (anti-dump)

- `ai_team.enabled: false` default → no `/team` command suggested,
  invocation prints the enable pointer; with the plugin absent every
  wrapper fails CLOSED with the remediation block — never a silent no-op.
- No public claim of review-lift value anywhere in docs/commands (the
  benchmark claim stays pre-registered only).
- New tests run once locally (new-gate carve-out); full pipeline stays
  with remote CI.
- Owner-roadmap (`road-to-team-mode.md`) boxes flipped for everything
  landed; this roadmap archives in the PR that completes it.

## Blockers

- **blocker: benchmark-spend-authorization** — unchanged, owner: user,
  lives in `road-to-team-mode.md` (blocks only its Phase 5).
- **blocker: branch-protection-apply** — unchanged, owner: user (from
  round 2+3; the doc gains conditions in Phase 0 here).

## Notes

- Round-4 items deliberately NOT adopted here: team-mode Phases 3+4
  (next PR, council round-2 convergence), semantic coupling metrics
  (parked behind the kill criterion), settings-UX work (routed to the
  wizard/profile system), any hard complexity gate.
