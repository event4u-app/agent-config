---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps, new work requested by the owner on 2026-11-19 per agents/evidence/owner-directives/2026-11-19-arena-panel-subscription-first.md."
estate_offset_exempt: "Owner-requested new work; the appeal-jury stub it absorbs (agents/roadmaps/stubs/road-to-an-appeal-jury-wired.md) is retired in Phase 2, nothing active covers /arena, /panel or a subscription-first default."
relates:
  - slug: road-to-a-loss-that-can-be-appealed
    relation: extends
    note: "Archived definition of the bracket; /arena is its visible entry, not a second engine. Its kill list (no standalone arena skill) holds."
  - slug: road-to-a-link-with-agent-switch
    relation: depends-on
    note: "Owns spreading seats across agent-switch profiles (Phase 5: 5.1 council, 5.3 bracket). Arena and panel consume it; they never pick accounts themselves."
---
# Road to an arena and a panel

> **Source:** owner session 2026-11-19, recorded in
> `agents/evidence/owner-directives/2026-11-19-arena-panel-subscription-first.md`
> (D1–D5). AI council the same day (2/2, subscription, $0) on D2.

## Goal

`/arena` runs the bracket defined on 2026-10-31 from any project, with losses
that a paid jury votes back in (shadow first). `/panel` turns the judging
workflows the owner has run as "arena" into a defined command. Across the
council, arena and panel, a resolvable API key stops being consent to spend:
subscriptions first, metered APIs only with no subscription seat or explicit
configuration.

## Acceptance criteria

- **AC-1** `agent-config bracket <sub>` runs in a consumer project; `/arena` and
  `/judge bracket` call it, no command body names `./scripts-run src/scripts/bracket`.
- **AC-2** A shadow appeal jury is recorded on every card decision with ≥ 2
  paid families; it never changes the outcome while `appeal_jury: shadow`.
- **AC-3** A split, inconsistent or under-seated jury records `inconclusive`,
  keeps the elimination, spends no card.
- **AC-4** No free seat enters the binding tally (test).
- **AC-5** `/panel decide` and `/panel review` exist with the two shapes of D3.
- **AC-6** With keys present and no opt-in, a lost CLI transport does **not**
  retry on the metered rung; `council:status` says so.
- **AC-7** Every new verb is in `command-verbs.yml` with an ADR-041 addendum.

## Phase 1 — Arena entry

- [x] **1.1** `bracket` registered in `src/cli/registry.ts` and `_dispatch.bash` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/registry.ts -->
      (help line included); `agent-config bracket plan --tier S1` answers.
- [x] **1.2** `/judge bracket` calls `agent-config bracket` instead of the <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      in-repo script path.
- [x] **1.3** Cluster `arena` locked in `docs/contracts/command-clusters.md`; <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `/arena` head command routes to the bracket procedure; verb `arena` in
      `command-verbs.yml` with an ADR-041 addendum.

## Phase 2 — Appeal jury, staged (D2)

- [x] **2.1** Mode `off | shadow | binding`, default `shadow` — a driver flag <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/cli.ts -->
      (`--jury-mode`), not a settings key: the mode is per run and `binding` is
      code-gated by `BINDING_UNLOCKED`, so a setting would add a surface with no
      decision left in it.
- [x] **2.2** Engine: a jury decision helper that takes juror verdicts (both <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bracket/engine.ts -->
      orders each), counts only seats whose billing is `subscription` or
      `per-token`, requires ≥ 2 families and a strict majority; anything else
      is `inconclusive`. In `shadow` the record is attached to the card or
      decline and never decides; in `binding` it decides and `inconclusive`
      leaves the elimination with no card spent.
- [x] **2.3** Pre-registered claim `paid-appeal-jury` in `docs/CLAIMS.md` <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      (decisive-vote rate, position-swap consistency; thresholds fixed before
      the first run). `binding` stays refused by the CLI until the claim reads
      `backed`.
- [x] **2.4** AC-9 test amended to admit exactly the bracket consumer, only once <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      2.3 is backed — until then the jury helper lives in `src/scripts/bracket/`
      and does not import `jury_aggregate.ts`.
- [x] **2.5** Retire the stub `road-to-an-appeal-jury-wired` (absorbed by Phase 2). <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->

## Phase 3 — Panel (D3)

- [x] **3.1** Cluster `panel` (`decide`, `review`), verb in `command-verbs.yml`. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/discovery/command-verbs.yml -->
- [x] **3.2** `/panel decide`: points × lenses (default 4: practice, theory, <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      system, skeptic; overridable), structured vote schema, one synthesis that
      tallies (consensus ≥ 3 of 4), records dissent and owner-only, adds no
      preference.
- [x] **3.3** `/panel review`: N angle reviewers (line + quote per finding), <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      jurors verify pairs against the source and reject the unverifiable, one
      merger dedupes, re-checks, ranks.
- [x] **3.4** Both state: a same-model fan-out is a panel, never a council. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->

## Phase 4 — Subscriptions first (D4)

- [x] **4.1** New key `fallback.api_on_cli_loss` (unset = ask once per run, D6): the four <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/fallback_config.ts -->
      no-double-charge classes fall through to the metered rung only when set.
- [x] **4.2** `council:status` prints the new posture. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/council_fallback_posture.ts -->
- [x] **4.3** `docs/contracts/ai-council-config.md` § Mid-flight fallback updated. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
- [x] **4.4** Owner's own config: the ignored `defaults.mode: api` removed. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->

## Phase 5 — Profiles (D5)

- [x] **5.1** Arena and panel name `road-to-a-link-with-agent-switch` 5.1/5.3 as <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      the account path; no account choice in either command.
