# Token Program Integration — Council Verdict (2026-07-07)

> Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-07, 2-round
> debate, $0.13). Input: three externally-drafted token roadmaps
> (request-scoped-rule-load, golden-set-coverage, token-proof-and-story) +
> handoff, all headline claims re-verified against the live checkout the same
> day, challenged against the same-day weak-host-lift verdict
> (`weak-host-lift-tiering-verdict.md`). The debate split on sequencing
> (parallel-now vs sequential-after-essential-baseline); round 2 resolved it
> on the mechanical argument below.

## Verified facts the verdict rests on (2026-07-07, live checkout)

- 95 rules shipped; **63 exclusively maintainer-workspace-scoped**, 32 other.
  Router (9 kernel / 24 tier_1 / 58 tier_2) carries **no workspace/pack
  fields**.
- `project_thin_rules --measure` (tiktoken exact): eager 77,534 / thin
  13,509 / **saved 64,025 GPT tok (82.6%)**. Default `lean_projection.mode:
  eager-all`.
- Cursor/Windsurf projectors hard-code `globs:` empty
  (`src/scripts/condense.ts` ~1054/1073) despite `file_pattern`/`path_prefix`
  triggers.
- Golden set: 30 tasks, all labelled, **14 distinct rules covered**, exactly
  1.0 rules/task. Uncovered consumer-relevant rules include ALL four domain
  safety floors, `non-destructive-by-default`, `lethal-trifecta-guard`,
  `untrusted-input-defense`.
- **Gate hole confirmed:** `check_quality_regression.ts` has zero `dry_run`
  handling and exits 0 on "inconclusive"; the parent blocker's criterion is
  literally "the report file exists".
- Intent-only rules (zero mechanical trigger signal): `telegraph-speak`,
  `user-interaction`, `think-before-action`, `artifact-drafting-protocol`.
- Pack-misfiling correction vs the external draft: only **2** of the 5
  "frontend cluster" rules are misfiled (`ui-audit-gate`→`meta`,
  `design-fidelity`→`engineering-base`); `icon-consistency` already sits in
  `frontend-design`, the two brand rules in `brand`.

## Converged verdict

1. **The three axes compose as a clean pipeline, not cascading chaos:**
   install-time consumer scoping (what ships) → discipline_profile (which
   discipline rules load) → projection mode (how bodies load). Each stage has
   independent inputs/outputs, success criteria, and failure modes. They may
   run in parallel; ADR-040 (projection-time filtering, no runtime resolver)
   guarantees trigger semantics are configuration-independent.
2. **Proceed NOW, in parallel:** consumer-scoping build (opt-in), router v2
   workspace/pack fields, Cursor/Windsurf globs, flip-gate hardening,
   golden-set scope-aware validator + trigger-anchored stubs + falsifiability
   linter. None of these depend on the essential baseline.
3. **Thin flip stays deferred** per the weak-host verdict: it un-defers only
   after `discipline_profile: essential` ships and is baseline-measured, and
   then as a **sub-mechanism of essential**, re-swept under thin. The
   HUMAN-MEASUREMENT track gates are unchanged.
4. **Rules-as-skills probe: PARKED**, not run now (2:1 council positions).
   Promotion trigger: essential baseline landed AND thin un-deferral is
   actually scheduled. Skeptical prior and honest-null-terminal framing stand.
5. **Operator labelling may proceed anytime** (labels are
   configuration-independent information; safety-floor coverage guards EVERY
   flip, incl. essential). **The paid judge run waits** until consumer scoping
   has landed (3× cheaper, measures the shipping config) and is batched with
   the essential-baseline operator sitting.
6. **Field evidence (replay + billed correlation): build the tooling now, run
   the arms post-flip, with FOUR arms** — eager-all / consumer-scoped /
   scoped+essential / scoped+essential+thin (when un-deferred). Intent-trigger
   semantics divergence (`trigger_coverage.ts` word-set vs
   `router_telemetry.ts` informational-only) must be reconciled and documented
   before any replay number is published.
7. **Settings end-state (activation story):** ONE runtime knob —
   `discipline_profile: auto | off | essential | full` (default `auto`, i.e.
   ON). Thin projection folds under `essential` as an implementation detail
   when un-deferred; `lean_projection.mode` is then absorbed/retired.
   Consumer scoping is **install-time, not a runtime setting** — default flips
   `legacy-all` → scoped after the misclassification audit + gate. This is the
   default-on shape the maintainer asked for, evidence-gated.
8. **Orchestration:** no additional orchestrator roadmap. The
   proof-and-story roadmap's Phase 1 tracking table is the single program
   surface and now covers all six tracks (token-saving parent,
   HUMAN-MEASUREMENT, request-scoped, golden-set, proof-and-story,
   discipline-profile-tiering). Other roadmaps link, never copy.
9. **Dies:** golden-set maintainer track (54 rules) — deleted; one backlog
   line in `road-to-token-saving` Phase 10. Gap closed: a rollback/reversion
   SOP for the flips is added to proof-and-story.

## Do not relitigate

Items 1–9 above; the thin-flip gates (HUMAN-MEASUREMENT, D1–D7); hand-labelled
anchors; ADR-040; product-bets DEFER; the weak-host-lift verdict locks.
Re-eval triggers: the essential baseline measurement contradicts the
composition assumption (trigger accuracy differing >15% between configs), or
the rules-as-skills promotion trigger fires.
