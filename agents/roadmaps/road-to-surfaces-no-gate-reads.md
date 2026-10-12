---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Three small truth-surface holes with no owner in the estate. Reopening archive/road-to-leading-every-row was rejected because its truth-surface lane closed on owner answers and reopening it would make closed criteria read open; merging into road-to-skill-scripts-that-run-where-they-land was rejected because that file owns bundled-script startup, not installer comments or README counts; parking in later/ was rejected because every step is executable today with no external precondition."
relates:
  - slug: road-to-leading-every-row
    relation: disjoint
    note: "Archived. Closed the earlier README-prose drift (Commands); the Rules half recurred after it closed and is what Phase 1 here gates."
  - slug: road-to-skill-scripts-that-run-where-they-land
    relation: disjoint
    note: "Active. Owns bundled skill scripts and their stale contract doc; the installer-comment sweep here touches src/install, src/server, src/ui and src/config only."
  - slug: road-to-skill-menu-economy
    relation: disjoint
    note: "Parked. Owns what reaches the model-visible menu; Phase 3 here only stops a skill body from growing."
---
# Road to surfaces no gate reads

> **Source:** `agents/tmp.old/inbox-2026-10-i/` — a three-loop audit of the host
> surface plus two supplied plans, re-verified against `origin/main` @
> `d41121927` (v16.4.0) on 2026-10-11. Three of the audit's truth-surface
> defects survived verification; every other one it named was already fixed or
> is held elsewhere (see § Provenance). Steps marked
> `corrected-from-reproduction` carry the wording the reproduction forced.

## Goal

Three numbers and one path that a reader trusts are produced by the tree instead
of typed by hand, and a check fails when they drift: the README sub-note's
command and rule counts, the installer path that 61 non-archive files name, and
the byte size of every skill body. Nothing here adds a capability; it removes
three places where the published surface can silently disagree with the tree.

## Context

- **README prose drift, recurring.** `README.md:9` carries a sub-note under the
  badges: "**Commands 205** counts every command file **recursively** (the
  linked directory holds 60 at its top level), and **Rules 121** counts the
  **source** rules while the linked projection holds 120". At the base,
  `src/rules/*.md` holds 122 and `dist/agent-src/rules/*.md` holds 121, the
  badge says `Rules-122`, and `./scripts-run src/scripts/update_counts --check`
  exits 0 with "All counts in sync". The README entry in `TARGETS`
  (`src/scripts/update_counts.ts:248-266`) matches badges only; its comment
  says "Prose counts were removed from the README on purpose". The sub-note
  re-added prose in `fc1bdec4f`, and the Commands half the audit reported
  (202 / 61) was corrected since; the Rules half drifted instead.
- **A path that does not exist, named as the live installer.**
  `src/server/routes/install.ts:8` says "The real *apply* path is owned by
  `scripts/install.py --apply-payload`". No `scripts/install.py` exists; the
  wizard bridge spawns `src/scripts/install.ts` (`src/server/routes/wizard.ts`,
  the `scriptPath` join under `/api/v1/wizard/apply`). `grep -rl 'install\.py'
  src docs README.md | grep -v archive | wc -l` reads 61 at the base, spread
  over `src/install`, `src/server`, `src/ui`, `src/cli` and `src/config`.
- **Skill bodies with no size gate.** `lint_token_budget_discipline.ts` gates
  only `token_budget_class: rich` (ceiling 3,500 tokens) and `continue`s on a
  skill with no key (`:157`, "no key = lean by default"). The rule
  `token-budget-discipline` puts `lean` under 500 tokens. At the base, 145 of
  299 `SKILL.md` files exceed 8,192 bytes, 141 of them carry no class key,
  the median is 8,014 bytes and the largest is 24,902
  (`src/skills/existing-ui-audit/SKILL.md`). Nothing stops any of them
  growing.

## Phase 1 — README counts come from the counter

- [x] **1.1 Prose patterns in `TARGETS`, test first.** Add to the README entry
      of `TARGETS` the four sub-note positions: `**Commands N**` →
      `commands_active`, `holds N at its top level` → a new kind
      `commands_toplevel` (non-recursive count of
      `dist/agent-src/commands/*.md`), `**Rules N**` → `rules`, and
      `projection holds N` → a new kind `rules_projected` (count of
      `dist/agent-src/rules/*.md`). A fixture README with a stale Rules figure
      reds `--check` before the patterns exist. `corrected-from-reproduction`:
      the audit asked for the Commands figure; that one is already right and
      the Rules figure is the live drift.
      verify: `npx vitest run tests/scripts/update_counts.test.ts` -> 0
- [x] **1.2 Run the counter once and commit what it writes.** The sub-note
      reads the tree's four figures; `--check` stays green afterwards.
      verify: `./scripts-run src/scripts/update_counts --check` -> 0

      **Closed 2026-10-12.** The two Rules figures moved (121 -> 122 source,
      120 -> 121 projected); the two Commands figures were already right, which
      is how a hand-typed number fails — on some of them, silently.

      **A second defect this step triggered rather than found.** Adding the two
      new patterns without adding their kinds to `KINDS` rewrote the sub-note to
      "holds undefined at its top level", and `--check` then said "All counts in
      sync" because the pattern no longer matched its own output. A generator
      that can corrupt the file it maintains and then call the corruption clean
      is worse than one that does nothing. `apply_to_text` now refuses a kind
      with no count and names it, and a structural test fails when a pattern is
      added without its kind.

## Phase 2 — The installer is named where it is

- [x] **2.1 Repoint or reword every live reference.** Each non-archive file
      that names `scripts/install.py` as a path or a command is changed to name
      `src/scripts/install.ts`, or — where the sentence is history ("ported
      from the retired Python installer") — reworded so it no longer reads as
      a path. `docs/contracts/skill-bundled-assets.md` is left to
      `road-to-skill-scripts-that-run-where-they-land`, which owns it.
      verify: `grep -rln 'scripts/install\.py' src README.md | wc -l` -> /^\s*0$/
- [x] **2.2 A test that keeps it gone.** One vitest case walks `src/` and fails
      on any `scripts/install.py` token, with the file and line in the
      message. It is seen red against a fixture file carrying the token before
      2.1's sweep is applied to the fixture tree.
      verify: `npx vitest run tests/install/installer_path_references.test.ts` -> 0

      **Closed 2026-10-12, and the verify's zero needed a carve-out the step did
      not anticipate.** 20 files under `src/` named the path (not the 61 the
      Context records, which counted `docs/` at an older pin). Two of them name
      it on purpose and neither names it AS a path:
      `lint_pre_migration_refs.ts` is the gate that SEARCHES for it, and
      `migration_status.ts` compares against the historical path to categorise a
      file from the git history. The first sweep rewrote both — a detector's own
      pattern and a path equality — which is how a sweep deletes the detector
      instead of the defect. Caught by reading the diff before committing it.
      The two are named individually in the test's allow-list, and the test
      proves that list is load-bearing rather than assuming it: removing it reds
      on exactly those two files.

## Phase 3 — A skill body may shrink, never silently grow

- [x] **3.1 A per-skill byte ceiling, measured at the base.**
      `src/config/skill-body-budget.json` records each `SKILL.md`'s byte count
      at the commit that lands this step, plus a `raised` list whose entries
      carry skill, old, new and a one-line reason. A new check
      (`check_skill_body_budget`) fails when a body exceeds its recorded
      ceiling without a `raised` entry, prints the skill and both sizes, and
      lowers nothing on its own. A new skill gets its ceiling on first
      landing. It is wired where the other budget checks run, with a
      `scanned:` line.
      verify: `npx vitest run tests/scripts/check_skill_body_budget.test.ts` -> 0
- [x] **3.2 Seen red, then green.** The test raises one fixture body by one
      byte and asserts exit 1; adds a `raised` entry and asserts exit 0;
      shrinks a body and asserts the ceiling is not moved by the check itself.
      verify: `npx vitest run tests/scripts/check_skill_body_budget.test.ts -t red` -> 0

      **Closed 2026-10-12. Baseline: 300 bodies, median 8,164 bytes, max 24,902,
      147 over 8 KB** — the measured distribution, recorded per skill, which is
      why the non-goals declined a fixed bar.

      **Three ratchets, as the estate's own record predicted.** The gate is
      registered in `gate-coverage.yml` with a `min_scanned` floor of 250 and a
      `no_canary_reason`: the only violation it can express is an in-place
      growth, so a create-only canary would run it green and certify nothing.
      It adopts `_lib/gate_self_test.ts` — six cases, three rejecting, over real
      fixture trees through the real CLI — so the `registered-non-adopters`
      ratchet stays at its baseline of 24 rather than rising to 25. And it
      adopts `_lib/gate_ledger.ts`, so `check_gate_completeness` reads 237 on
      this branch, exactly what `origin/main` reads: the gate adds nothing to a
      red that was already there.

## What this roadmap deliberately does not do

- No 8 KB bar. 145 bodies over it would make a fixed bar unfillable; the
  ceiling is the measured distribution, monotone down (source K-row in the
  supplied plan, adopted as-is).
- No forced split of the largest bodies. A split moves content into
  `references/`, and no measurement exists of whether the model still reaches
  it; the supplied plan's top-five split is declined until a routing
  evaluation exists.
- No reachability badge in the README. The enforcement ratio is published in
  exactly one place, `docs/proof.md` § 4b, and `check_enforcement_denominator`
  reds a second copy; that decision of 2026-08-23 is not reopened here.

## Acceptance Criteria

- [x] AC-1 — `update_counts --check` fails on a stale command or rule figure in
      the README sub-note, and the live sub-note matches the tree.
- [x] AC-2 — No file under `src/` names `scripts/install.py`, and a test fails
      when one does.
- [x] AC-3 — Growing any `SKILL.md` body without a recorded `raised` entry
      fails a check; shrinking one never does.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Gate the README sub-note through `TARGETS` instead of deleting the sub-note | The sub-note answers a real reader question (why the badge differs from the linked directory); deleting it would trade a drift for an unexplained mismatch | The sub-note is removed by its own author |
| D2 | reversible-technical | agent | Byte ceiling per skill, not a token ceiling | Bytes are exact on every machine; the token count needs a devDependency and is a band on machines without it (`lint_token_budget_discipline.ts:103-120`) | A token-exact measurement becomes available in CI everywhere |
| D3 | reversible-technical | agent | A raise is allowed with a recorded reason, never silently | `token-budget-discipline` § Value-over-budget escalation: a budget line is an input to a decision, never the decision | Raises outnumber shrinks over two releases |
| D4 | deterministic | evidence | lean-default: 141 of 299 skills carry no class key and exceed 8,192 bytes at `d41121927`, against a lean target under 500 tokens; this roadmap freezes their growth and does not reclassify them | Byte census over `src/skills/*/SKILL.md` at the base | A reclassification roadmap lands |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A ceiling blocks a necessary addition | product | A skill that needs one more paragraph cannot get it without ceremony, so authors route content elsewhere to dodge the check | A `raised` entry with a reason is the sanctioned path and costs one line; the check message names it | Phase 3 — A skill body may shrink, never silently grow |
| 2 | A prose pattern matches the wrong number | implementation | `holds N` or `**Rules N**` could match a sentence elsewhere in the README | Patterns anchored on the sub-note's exact phrasing; 1.1's fixture includes a decoy sentence | Phase 1 — README counts come from the counter |
| 3 | A history sentence loses its meaning | implementation | Rewording a mention of the retired Python installer could erase why a TypeScript port behaves as it does | 2.1 rewords history as history rather than deleting it | Phase 2 — The installer is named where it is |

## Provenance

Source ids from the supplied plan, by disposition in this roadmap: W0.1 →
Phase 1 (`corrected-from-reproduction`); W0.2 → Phase 2; W3.3 → Phase 3, top-five
split declined; W5.3 → declined (already published, `docs/proof.md:308`). All
other source ids are dispositioned in the round's ledger, not here.
