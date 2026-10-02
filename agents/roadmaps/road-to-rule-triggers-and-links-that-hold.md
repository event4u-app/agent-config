---
complexity: lightweight
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "Round inbox-2026-10-c verified a live defect no roadmap owns: `_has_non_path_trigger` ignores `command` triggers, so `roadmap-progress-sync` reaches Claude with an exclusive `paths:` and loses three command triggers today, before any thinning. The two held objects that own the neighbouring question both misclassify that rule, so folding this into either would carry their error with it. The other steps are small residue whose absence would make the installed-layer flip ship broken links."
relates:
  - slug: road-to-a-path-route-under-delivery
    relation: extends
    note: Stub. It lists 18 mixed-trigger rules and assumes none gets `paths:`; step 1.1 shows `roadmap-progress-sync` does, and corrects the stub's count in the same change.
  - slug: road-to-mixed-trigger-activation-cost
    relation: extends
    note: Later. Its trigger table counts `roadmap-progress-sync` as path-only; step 1.1 corrects that row.
  - slug: road-to-a-rule-carrier-that-works-outside-the-repo
    relation: disjoint
    note: Same round. That roadmap repairs the runtime carrier; this one repairs what the installed files say and link to.
---
# Road to rule triggers and links that hold

> **Source:** `agents/tmp.old/inbox-2026-10-c/` — a round of four roadmap drafts
> and one transcript on the host's 150k instruction-budget notice, pinned to
> `main` @ `9bc8cd4f2` (16.2.0). Verified against `main` @ `a03f60c46` on
> 2026-10-01; only documentation changed between the two.

## Goal

What an installed rule file declares and links to is true on the host that
loads it. Done means: no rule loses a non-path trigger to the Claude `paths:`
emitter, every link inside an installed rule resolves from the directory the
install writes, and two small per-prompt and per-spawn costs are measured or
removed.

## Context

Reproduced on 2026-10-01:

- `_has_non_path_trigger` (`src/install/claudePathsPlan.ts:203-213`) returns
  true only for `keyword` and `phrase`. `roadmap-progress-sync` declares one
  `path_prefix` and three `command` triggers, so it is emitted with an
  exclusive `paths:` and its command triggers never fire on Claude.
- Both owners of the neighbouring question misread that rule:
  `stubs/road-to-a-path-route-under-delivery.md` assumes none of its 18
  mixed-trigger rules gets `paths:`, and
  `later/road-to-mixed-trigger-activation-cost.md` counts it as path-only.
- `grep -oh "](../X/" dist/agent-src/rules/*.md` counts 137 links into
  directories the Claude install step does not write (62 `contexts`, 51
  `guidelines`, 22 `docs`, 1 `scripts`, 1 `templates`) and another 23
  repo-root `](../../` links. The install step copies only `rules/`
  (`src/scripts/install.ts:1806-1811`).
- The language pin (`src/scripts/language_mirror_hook.ts:433-437`) sends a
  paragraph explaining why the pin exists with every prompt.
- 107 rule files already carry an `# obligation: line N` marker and an
  `obligation_frequency` key, so step 1.5 reads an existing index rather than
  inventing one.

## Phase 1 — Repair, then measure

- [x] **1.1 Every non-path trigger counts.** `_has_non_path_trigger` returns
      true for any trigger kind that is not path-shaped (`command`, and any
      kind added later), not for a hard-coded pair. The stub's 18-rule list and
      the later roadmap's trigger table are corrected in the same change.
      verify: `npx vitest run tests/scripts/condense_glob_emit.test.ts -t command` -> 0
      done 2026-10-02: the predicate iterates the trigger object's own keys and
      skips `file_pattern` / `path_prefix` (the two `derive_trigger_globs`
      consumes) and `reason` (documentation, matches nothing); every other
      non-empty string key counts. Five tests added, three seen red first —
      a `command` trigger, a mixed path + command plan, and an unknown future
      key — and the two that already passed pin the directions that must NOT
      move (`reason:` on a path trigger, an empty match key).
      `./scripts-run src/scripts/rule_activation_census --json` now reports
      21 path-shaped / **18 mixed** / 3 path-only over 121 rules, and
      `roadmap-progress-sync` has moved from `scoped_ids` to `mixed_ids`,
      which is the three dropped command routes coming back. The stub's
      arrivals note and body now read as repaired rather than pending, and the
      later roadmap's claim 2 carries the emitter's reading instead of a grep's.
- [ ] **1.2 Links that resolve where the file lands.** When the installer writes a rule file, rewrite
      the 160 links of Context to absolute package paths, or have the installer also write the
      directories they point into — whichever adds less standing text, measured
      by the installed-layer report of
      `road-to-a-rule-carrier-that-works-outside-the-repo` step 0.1. Record the
      choice and the two numbers in Decisions.
      verify: `npx vitest run tests/scripts/install_rule_links.test.ts` -> 0
- [ ] **1.3 Single-word triggers, reported.** A report over the routing matrix:
      tier rules with a one-token keyword that fires on more than 5 % of the
      corpus's prompts labelled against another rule. `rename` and `delete`
      (`augment-edit-discipline`) are the first expected rows. Report only; a
      trigger change is a separate decision per rule.
      verify: `grep -c 'augment-edit-discipline' agents/evidence/analysis/single-token-triggers-*.md` -> /^[1-9]/
- [x] **1.4 The pin without its history.** The rationale paragraph moves to
      the hook's header; the injected text keeps the target language and the
      instruction.
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts -t length` -> 0
      done 2026-10-02: the header already carried the rationale verbatim — the
      audit, the 626 turns, the user-role skill bodies — so the payload's copy
      was a duplicate paid for per prompt. Removed the provenance sentence;
      kept the target language, where it applies, and `Tool output … are NOT
      the trigger — this pin is.` Measured 702 → **429** characters (German;
      693 → 420 English), a 273-character saving on every pinned prompt with
      no instruction dropped. The `pinText` docblock now says the omission is
      deliberate and names the header as the place to extend. Three tests
      added, two seen red (the history assertions, the length ratchet); the
      ratchet pins both provenances so a later edit cannot move the cost from
      one branch into the other. 102/102 in the file.
- [ ] **1.5 Which obligations are already mechanical.** A report joining each
      rule's obligation marker with `report_obligation_carriers` and
      `lint_rule_enforcement_declaration`: per rule, whether a hook or gate
      already enforces the obligation, and whether the obligation is
      deterministic enough that one could. Report only — moving an obligation
      out of prose is a per-rule change with its own review.
      verify: `grep -c '^| ' agents/evidence/analysis/obligation-mechanism-audit-*.md` -> /^[1-9]/
- [ ] **1.6 Per-spawn cost.** The host loads the instruction hierarchy into
      every non-built-in subagent. Record the per-spawn standing characters next
      to the session reading, before and after the installed-layer flip.
      verify: `grep -c 'per-spawn' agents/evidence/analysis/per-spawn-standing-*.md` -> /^[1-9]/

## What this roadmap deliberately does not do

- No trigger rewrite from the 1.3 report. A common-word trigger can be correct;
  the report sizes the question.
- No obligation moved into a hook from the 1.5 report.
- No change to which rules are path-scoped beyond the 1.1 predicate fix.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The predicate is "not path-shaped", not a list of non-path kinds | A list missed `command` once; a negation cannot miss a kind added later | A trigger kind arrives that is neither path-shaped nor promptable |
| D2 | reversible-technical | agent | 1.2's two options are decided by measured standing cost, not by preference | Both resolve every link; the difference is characters on the shared host budget | The installed-layer report is not available when 1.2 runs |
| D3 | reversible-technical | agent | 1.3's 5 % threshold is a stated default for a report, not a gate | Nothing acts on the figure automatically | The report's top rows are not the known common words |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | 1.1 changes which rules load unconditionally | implementation | A rule that gains `paths:`-less emission becomes standing text on every session. | Only rules with a non-path trigger change, and those are exactly the ones whose prompt route the current emitter drops. The installed-layer report records the delta. | Phase 1 — Repair, then measure |
| 2 | Deploying link targets grows the installed tree | product | Deploying `contexts/` or `guidelines/` adds files a consumer did not have. | 1.2 picks the option by measured standing cost; files under those directories are not instruction files unless linked from `rules/`. | Phase 1 — Repair, then measure |

## Acceptance Criteria

- [x] AC-1 — No rule with a non-path trigger is emitted with an exclusive
      `paths:` on Claude. Read from the emitter's own decision path:
      `rule_activation_census --json` reports `scoped_ids` =
      `design-review-after-ui-write`, `source-of-truth`, `ui-audit-gate`, and
      `mixed ∩ scoped` is empty.
- [ ] AC-2 — A link check over an installed rule directory reports zero
      unresolved links.
- [ ] AC-3 — The single-token, obligation-mechanism and per-spawn readings are
      committed as reports.
