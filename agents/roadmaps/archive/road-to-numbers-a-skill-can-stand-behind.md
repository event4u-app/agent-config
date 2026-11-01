---
complexity: lightweight
status: ready
tree_pin: 5a66c1bf19
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-01 in the invocation (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"): the round's executable residue is processed in the same run, so it is written active, not to later/. Active estate goes from 8 to 9, over the WIP cap of 5, by that explicit instruction; the decision-gated remainder of the round is written to later/."
estate_offset_exempt: "Owner search at 5a66c1bf19 (grep -rlF for lint_flows.py, runway-cognition, fundraising-narrative, FIRST_WIN, laravel-dto, pool_winsim, decidePairedVerdict, a real browser UA over agents/roadmaps, later, stubs) found no roadmap owning these defects; the two partial hits (later/road-to-skill-ecosystem-executable-payloads.md owns scripts for money skills, not their prose; later/road-to-reach-reddit-approved-api.md owns the Reddit API, not the help text) are set aside in the round's disposition. No active roadmap is archived to offset it."
---
# Road to numbers a skill can stand behind

> **Source:** `agents/tmp.old/inbox-2026-11-a/` (topics T1–T4: four transcripts, five supplied plans, five proposals).
> **Arrivals:** 1 — `inbox-2026-11-a` (2026-11-01).

## Goal

Every number, path and example the finance, prediction and DTO skills hand a
consumer is true at the tree it ships in: an example that contradicts itself,
a link to a file that does not exist, a floor statement about a skill it does
not reach, a DTO example whose mapping is silently ignored, and a simulator
whose recommendation changes with the seed are each fixed or made honest.

Not started at the pin because each item was verified only by this round
(four read-only lanes against `5a66c1bf19`, `file:line` per claim). The
decision-gated remainder — trading/betting analysis, data-helpers expertise,
the investor chain, payload-bound grants — is in `later/` and on existing
owners, not here.

## Phase 1 — Prose that matches the tree

- [x] **1.1 Dead link in the flows README.** `src/flows/README.md:57` names
      `scripts/lint_flows.py`; only `src/scripts/lint_flows.ts` exists.
      verify: `grep -n 'lint_flows' src/flows/README.md` shows the `.ts` path only.
- [x] **1.2 Stale usage comment.** `src/scripts/prediction-pool/poisson_sim.ts:46`
      shows a `python3 …poisson_sim.py` call; replace with the `npx tsx` call the
      skill documents. The `USAGE` text at `:422`/`:434` is a parity copy and stays.
      verify: `grep -n 'python3' src/scripts/prediction-pool/poisson_sim.ts` -> no hit outside USAGE.
- [x] **1.3 Handoff contract says one thing.** `docs/contracts/cross-wing-handoff.md:77`
      names `scripts/lint_handoffs.py` (absent; the linter is `src/scripts/lint_handoffs.ts`);
      `:96` reads SHOULD where `:46` reads MUST. Keep MUST, say it is not linted yet.
      verify: no `.py` linter path; `:46` and the input-shape row agree.
- [x] **1.4 The runway example agrees with itself.** `src/skills/runway-cognition/SKILL.md:144-148`
      labels burn "last 3 quarters" and uses it monthly, and emits `gap=-5mo`
      against a stated gap of 4.5–7.5 months.
      verify: the arithmetic in the example reproduces by hand; the emitted gap is the stated range.
- [x] **1.5 Pack description names its own content.** `src/config/discovery/packs.yml:235`
      and `src/packs/finance-advanced/README.md:5` name comp banding, which ships
      in ops-people (`src/skills/comp-banding/SKILL.md:11`).
      verify: `grep -n -i 'comp' src/config/discovery/packs.yml` hits only the ops-people entry.
- [x] **1.6 Floor text names only what it reaches — the two stale statements.**
      `src/rules/finance-safety-floor.md:51` lists `fundraising-narrative`, which
      the strategy floor covers via founder-strategy; drop it there.
      `src/rules/engineering-safety-floor.md` says "lives in `core`" against its own
      `packs: [engineering-base]`; make the sentence match the frontmatter.
      The three skills that reach no floor at all are owner decision E1 in
      `later/road-to-a-reason-that-is-still-there.md`, not this step.
      verify: both statements match the `packs:` frontmatter of the named skills.
- [x] **1.7 First-win guides point at nothing.** `FIRST_WIN.md` in
      `src/packs/{finance-basic,ops-people,founder-strategy,gtm-sales}/` references
      a screenshot under `docs/wizard/screenshots/`, which does not exist. Remove
      the reference.
      verify: `grep -rn 'screenshots' src/packs/*/FIRST_WIN.md` -> 0.
- [x] **1.8 No advice to spoof a browser.** `src/scripts/_lib/reddit_thread_parse.ts:542`
      tells the reader to send "a real browser UA"; name a descriptive agent string
      instead.
      verify: `grep -n 'real browser' src/scripts/_lib/reddit_thread_parse.ts` -> 0.
- [x] **1.9 DCF hands workbook output to its owner.** `src/skills/dcf-modeling/SKILL.md`
      never references `spreadsheet-authoring`, whose core rule its markdown tables
      break (`spreadsheet-authoring/SKILL.md:46`). One hand-off line; the output
      contract change is `later/road-to-a-reason-that-is-still-there.md` Phase 3.
      verify: `grep -c spreadsheet-authoring src/skills/dcf-modeling/SKILL.md` >= 1.

## Phase 2 — DTO guidance that compiles and maps

The namespace half (`Vendor\DataHelpers` vs the real `event4u\DataHelpers`) is
blocked by the portability gate (`src/scripts/check_portability.ts:112-138`)
and is owner decision E11 in `later/road-to-a-library-the-agent-can-vouch-for.md`.
This phase fixes only what the gate does not touch.

- [x] **2.1 Mapping attributes live on the constructor.** `src/skills/laravel-dto/SKILL.md:73-84`
      declares `#[Map]` on properties without a constructor; the library reads
      mapping only from constructor parameters, so the example's mapping is
      silently ignored. Rewrite the example with constructor promotion and add the
      rule.
      verify: the example has a `__construct` carrying every `#[Map]`; a gotcha line states the constructor rule.
- [x] **2.2 No blanket base-class mandate.** `laravel-dto/SKILL.md:37,108,113`
      and `docs/guidelines/php/patterns/dtos.md:18,113` say "always/must extend",
      contradicting their own `:100` / `:122-125`. Follow the project's convention.
      verify: no "always extend" / "must extend" line remains in either file.
- [x] **2.3 No consumer-specific doctrine in the generic skill.** German legacy
      column names (`laravel-dto/SKILL.md:43`, `dtos.md:40,48`) and a mandatory
      `Math::` helper (`laravel-dto/SKILL.md:102`, `dtos.md:188`) are one
      consumer's conventions. Neutralise in these two files; the seven further
      sites of the same pattern are listed in the round disposition for a batched ask.
      verify: `grep -nE 'bezeichnung|id_equipment|German' src/skills/laravel-dto/SKILL.md docs/guidelines/php/patterns/dtos.md` -> 0.

## Phase 3 — Simulated numbers name their basis

- [x] **3.1 Seed, runs, method on every simulated figure.** `src/skills/prediction-pool-optimizer/SKILL.md`
      never asks for the seed (`grep seed` -> 0) although `poisson_sim.ts:18`
      renders it. One rule next to the executed-numbers block.
      verify: the skill names runs, seed, method and "same seed, same numbers".
- [x] **3.2 A held-out draw before a flip is recommended.** Reproduced at the pin:
      `pool_winsim.ts` selects flips and scores them on the same scenarios
      (`:264-267`, `:300-308`) and accepts any strict gain (`:343-344`); seeds 1–10
      at `--runs 4000` gave 10 distinct flip sets. Add opt-in `--holdout-runs N`:
      flips are chosen on draw A, re-scored on an independent draw B, kept only
      where B confirms the gain; report the held-out P(win). Default output stays
      byte-identical (parity pin, `pool_winsim.ts:5-9`).
      Landed with one correction found while proving it: re-drawing only the
      scenarios still confirmed flips that lost to the next field draw (the field
      is itself a random draw), so the held-out side re-draws the field every 100
      runs. On the fixture all ten seeds then confirm no flip, while the
      unchecked greedy sets regress against the field model on 3 of 10 seeds;
      the test goes red when the unchecked flips are substituted.
      verify: `npx vitest run tests/scripts/prediction-pool_pool_winsim.test.ts` -> 0, with
      a test that seeds 1–10 under `--holdout-runs` agree on the flip set or report none,
      and the existing parity cases unchanged.
- [x] **3.3 The skill uses the held-out draw.** `prediction-pool-optimizer/SKILL.md`
      passes `--holdout-runs` wherever it calls `pool_winsim` and says what an
      empty flip set means.
      verify: every `pool_winsim` invocation in the skill carries the flag.

## Risk Register

| Risk | Mitigation |
|---|---|
| 3.2 changes a parity-pinned script | opt-in flag; default path and all parity tests unchanged |
| Neutralising `Math::` drops a real money-precision rule | the replacement keeps "never float arithmetic for money" |
| Floor text edits read as weakening a floor | only statements about skills the floor never reached change; no Iron Law line moves |

## Acceptance Criteria

- Every step's `verify:` holds at the branch head.
- `task ci` is green; `dist/` regenerated from `src/`.
- No step weakens an Iron Law, a floor's reach, or a parity pin.
