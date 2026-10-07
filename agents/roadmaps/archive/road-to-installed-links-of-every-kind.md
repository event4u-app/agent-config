---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Merging into road-to-rule-triggers-and-links-that-hold was considered and rejected: it owns rule links, was re-reviewed on 2026-10-06, and its risk register cannot record a second review on the same date, so a step added there today reds the register gate. Folding it into road-to-gates-a-pull-request-can-hear was tried and reverted for the same reason. Nothing can be archived or parked to pay for it. One step, one report, no failing check."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; the natural owner cannot take a step today."
relates:
  - slug: road-to-rule-triggers-and-links-that-hold
    relation: extends
    note: "That roadmap counts and repairs links from installed rules; this file widens the count to the other installed kinds and repairs nothing."
---
# Road to installed links of every kind

> **Source:** an external review round (opaque id `inbox-2026-10-e`), round
> `agents/tmp.old/inbox-2026-10-e/`. One of fifteen reviews of 16.3.0 asked
> that every path inside installed instructions resolve against the installed
> tree, for every artefact kind, not only rules. Anchors re-read at `main` @
> `a75bb3210` on 2026-10-06.

## Goal

One command prints, per installed artefact kind, how many links point at
something the install does not carry. Rules already have that count; skills,
commands and contexts get the same one, and the numbers can only go down.

## Context

- Links from installed rules are counted by
  `src/scripts/report_installed_rule_links.ts`, which reads 115 unresolved for
  Claude Code against 502 links on 2026-10-06
  (`agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md`, AC-2 note).
- Links from one skill to another are counted by
  `src/scripts/lint_skill_link_reach.ts`.
- A link from an installed skill to a guideline or a context, and every link
  from an installed command or context, is counted by nothing. The report's
  own options today are `--root`, `--prefix-chars` and `--json`; there is no
  kind selector.
- ADR and `docs/` targets are not projected into an install at all, so a link
  to one is dead by construction and belongs in its own row rather than mixed
  into the deployable count.

## Phase 1 — The count, per kind

- [x] **1.1 One unresolved count per installed kind.** The report gains a
      kind selector covering skills, commands, contexts and guidelines beside
      rules, and prints one line per kind of the form `kind: <name> unresolved
      <n> of <m>`, with ADR and `docs/` targets as their own row. It reports and
      fails nothing.
      verify: `./scripts-run src/scripts/report_installed_rule_links --kinds all | grep -c 'kind:'` -> /^[1-9]/
      Landed 2026-10-06: `--kinds` and `--host` (default `claude-code`) on the
      existing report, reading every kind through the rule report's own link
      resolver. First reading for Claude Code: rules 114 of 501, skills 296 of
      1752, commands 441 of 891, contexts and guidelines not installed,
      non-projected 314 of 314. Contexts read 107 of 447 for augment, the one
      host that deploys them; no host deploys guidelines.
- [x] **1.2 The counts become a baseline that only shrinks.** The per-kind
      numbers are recorded in `src/config/gate-violation-baselines.json` with
      the date and the command, and a test shows a fixture link added to a
      skill raises its kind's count while the recorded baseline does not move.
      verify: `npx vitest run tests/scripts/report_installed_links_kinds.test.ts` -> 0
      Landed 2026-10-06: five `report_installed_rule_links:kinds:<host>:<kind>`
      entries, each with `landed` and a `falsifier` naming the command; the
      report prints each one as `[baseline N]` beside the live count. A kind at
      zero or not installed carries no entry, because the baseline file admits
      only positive counts. The test plants one dead link per kind and was seen
      red with the resolver pointed at the wrong install directory.

## What this roadmap deliberately does not do

- No link is rewritten or deleted here; repairs stay with the roadmap that owns
  each kind.
- No failing check. Whether a kind's count should ever fail a build is decided
  after one release of numbers.
- No change to which trees the installer deploys.

## Acceptance Criteria

- [x] AC-1 — One command prints an unresolved count for every installed kind,
      with non-projected targets on their own row.
- [x] AC-2 — The per-kind counts are recorded with their date and command, and
      a test shows a new dead link moves the count and not the baseline.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Widen the existing rule-link report rather than add a second script | The rule report already resolves against the deploy plan; a second resolver would be the drift this count exists to catch | The per-kind output makes the rule report's own reading harder to follow |
| D2 | reversible-technical | agent | Report, never fail | The rule-link criterion already sits at 115 dead links held by an owner blocker; a failing kind count would red on day one | One release of counts shows a kind at zero |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The widened report resolves a kind against the wrong install root | implementation | Skills, commands and contexts deploy to different directories per host. | 1.1 reads the same deploy plan the rule report already uses, and 1.2's fixture asserts one known dead link per kind. | Phase 1 — The count, per kind |
| 2 | A large first count is read as a regression | product | Links nobody counted before will appear all at once. | The page and the baseline carry the date the counting started, so the first number is a starting point, not a change. | Phase 1 — The count, per kind |
