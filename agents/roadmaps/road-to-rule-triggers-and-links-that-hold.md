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
      **AC-1 is discharged by this step**: the census's `scoped_ids` are
      `design-review-after-ui-write`, `source-of-truth` and `ui-audit-gate`,
      and `mixed ∩ scoped` is empty — no rule with a non-path trigger carries
      an exclusive `paths:`.
- [x] **1.2 Links that resolve where the file lands.** When the installer writes a rule file, rewrite
      the 160 links of Context to absolute package paths, or have the installer also write the
      directories they point into — whichever adds less standing text, measured
      by the installed-layer report of
      `road-to-a-rule-carrier-that-works-outside-the-repo` step 0.1. Record the
      choice and the two numbers in Decisions.
      verify: `npx vitest run tests/scripts/install_rule_links.test.ts` -> 0
      done 2026-10-02: step 0.1's report does not exist yet — that roadmap's
      Phase 0 is open — so D2's `revisit-if` fired and the measurement was taken
      directly from the deploy plan and the rule bodies, which is the same unit.
      New `src/install/installedRuleLinks.ts` audits every link in every rule a
      host installs and returns a verdict per link (`resolved`,
      `directory-not-deployed`, `file-missing`, `outside-install-root`);
      `src/scripts/report_installed_rule_links` prints it per host and prices
      the rewrite option. It reproduces Context's 160 exactly, and splits it:
      113 into `contexts/` and `guidelines/`, 45 unreachable by any deploy
      entry, 2 one-off. **Deploy won, 0 standing characters against 7,285** —
      recorded as D4, with the remainder as D5. `contexts/` + `guidelines/`
      added to the Claude bundle (13 hosts), augment, cursor, windsurf and
      kiro; claude-code goes 160 → **47** unresolved, augment 97 → 46.
      28 tests, the two load-bearing ones seen red first and re-proven by
      removing the `guidelines` entry and watching both fail (98 > 47, and the
      undeployed-directory assertion), then restoring it.
      **A second defect, found while fixing the first and fixed with it.**
      `GLOBAL_DEPLOY_SOURCES` was defined TWICE — once in `src/scripts/install.ts`
      for the CLI, once in `src/install/wizard-plan.ts` for the wizard — and the
      two were byte-identical across all 18 host rows, verified by diffing the
      live objects. The first version of this step edited only the install.ts
      copy, so the wizard would have kept installing without the two
      directories: same install, two answers, depending which path a user took.
      `wizard-plan.ts` is now the only definition and carries them once behind a
      named `RULE_LINK_TARGETS` constant; `install.ts` imports and re-exports
      it, so no caller changed. That is the shared path repaired rather than the
      reported call site patched, and it takes `install.ts` 5,231 → 5,175 lines,
      which let `check_source_size_budget`'s baseline go 17,620 → 17,592.
- [x] **1.3 Single-word triggers, reported.** A report over the routing matrix:
      tier rules with a one-token keyword that fires on more than 5 % of the
      corpus's prompts labelled against another rule. `rename` and `delete`
      (`augment-edit-discipline`) are the first expected rows. Report only; a
      trigger change is a separate decision per rule.
      verify: `grep -c 'augment-edit-discipline' agents/evidence/analysis/single-token-triggers-*.md` -> /^[1-9]/
      done 2026-10-02: `src/scripts/report_single_token_triggers` + the report
      at `agents/evidence/analysis/single-token-triggers-2026-10.md`.
      **D3's `revisit-if` fired and is reported rather than worked around.**
      Nothing clears 5 %: the maximum share of foreign positives is 3.9 %
      (`commit`, `secret-vcs-guard`), and `rename` / `delete` score 0.0 %. The
      instrument is the reason — all 335 positives are written for the rule
      whose file holds them, so a curated per-rule corpus has almost no supply
      of accidental cross-firing. The matrix's 253 **near-misses** are the
      population that does: ordinary developer sentences belonging to no rule.
      Measured there, the step's prediction lands — `rename` is the single
      highest row in the corpus at 7 foreign near-misses, every "Rename" in the
      matrix sitting in a `near_misses` block. 79 of 341 one-token keywords hit
      at least one; 249 hit nothing at all. And a clean negative worth the same
      space: **zero** keywords fire on a near-miss their own rule's fixture
      declares. The threshold stays 5 % and stays a stated default; the report
      filters on either axis so the rows that exist are not hidden by it.
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
- [x] **1.5 Which obligations are already mechanical.** A report joining each
      rule's obligation marker with `report_obligation_carriers` and
      `lint_rule_enforcement_declaration`: per rule, whether a hook or gate
      already enforces the obligation, and whether the obligation is
      deterministic enough that one could. Report only — moving an obligation
      out of prose is a per-rule change with its own review.
      verify: `grep -c '^| ' agents/evidence/analysis/obligation-mechanism-audit-*.md` -> /^[1-9]/
      done 2026-10-02: `src/scripts/report_obligation_mechanism` + the report at
      `agents/evidence/analysis/obligation-mechanism-audit-2026-10.md`, 121 rows.
      The join reads `check_enforcement_coverage --json` for the declaration
      side — it is the one place `enforced_by` and `obligation_frequency` are
      already resolved per rule, so `lint_rule_enforcement_declaration`'s own
      baseline is reached through it rather than re-parsed — plus
      `report_obligation_carriers` for restatement counts, plus the
      `# obligation: line N` marker, whose first reader this is. Reading:
      **16** rules carried by a gate that can refuse, **10** by an observer,
      **15** declared gaps where the rule's body says `instruction-only` with a
      reason, **80** with no declaration at all. The second column is labelled
      `slot_exists` and is explicitly necessary-never-sufficient: 91 ungated
      rules sit at a frequency a host event fires at, which bounds what binding
      a carrier could reach and does not claim any of them is decidable from
      what that event sees. Two things the report says out loud: a declared gap
      is the discipline working, not a backlog item, and the marker itself has
      no producer and no other reader, so a line number in it is a claim rather
      than a measurement.
- [x] **1.6 Per-spawn cost.** The host loads the instruction hierarchy into
      every non-built-in subagent. Record the per-spawn standing characters next
      to the session reading, before and after the installed-layer flip.
      verify: `grep -c 'per-spawn' agents/evidence/analysis/per-spawn-standing-*.md` -> /^[1-9]/
      done 2026-10-02: `agents/evidence/analysis/per-spawn-standing-2026-10.md`.
      The per-spawn figure is not a second measurement — it is the SAME standing
      payload charged again, because there is no smaller bundle for a subagent.
      What had to be measured is the multiplier. Four figures, two of them
      machine-local and marked as such: the projected corpus upper bound
      485,282 characters / 121,321 chars-4 tokens; the installed layer on this
      machine 375,874 across 105 files; and the number that actually recurs,
      **351,894 characters over the 102 installed rules carrying no `paths:`**,
      i.e. loading unconditionally. Multiplier, from the transcript store: 647
      distinct subagent spawns across 741 transcript files in 12 project
      directories — so spawning roughly **doubles** the standing-instruction
      bill (≈228 M characters against ≈261 M), invisibly, since no spawn is
      shown the bundle it was charged for. The **after-flip row is empty and
      stays empty**: the installed-layer flip has not happened, its roadmap may
      not start before the carrier roadmap's Phase 1 merges, and that phase is
      open. The report carries the commands to fill it at the flip commit.

## What this roadmap deliberately does not do

- No trigger rewrite from the 1.3 report. A common-word trigger can be correct;
  the report sizes the question.
- No obligation moved into a hook from the 1.5 report.
- No change to which rules are path-scoped beyond the 1.1 predicate fix.

## Blockers

### blocker: forty-seven-links-name-files-the-package-does-not-ship

- **Status:** open
- **Owner:** maintainer
- **Class:** 2
- **Blocks:** AC-2 only. Step 1.2 is closed, and every other step and
  criterion on this roadmap is closed.
- **What to do:** the remaining 47 are not a smaller version of what 1.2
  fixed, and a deploy entry cannot reach any of them — read D5 before
  reaching for one. Three groups, each with a different answer:
  1. **22 into `docs/`.** `dist/agent-src/` carries no `docs/` directory, and
     several rules say so in their own text. Either the projection starts
     shipping `docs/contracts/` — a scope decision this roadmap does not own —
     or the 22 links become code spans in `src/rules/`.
  2. **23 climbing out of the install root** into `../../tests/`,
     `../../src/scripts/`, `../../scripts/` and
     `agents/settings/policies/media/`. These name the repository, not the
     package; no install has ever held them, and none ever will. Code spans
     are the only repair.
  3. **2 one-off targets.** `scripts/hooks/evidence_independence.ts` is not in
     the projection either; the single `templates/` link would cost 1.7 MB of
     deployed files to resolve, which fails the same standing-cost test D4
     applied to the other directories.
  All three are authoring changes in rule prose, which this roadmap's "What
  this roadmap deliberately does not do" keeps out of scope and which
  `src/rules/` size budgets make a per-rule review rather than a sweep. Run
  `./scripts-run src/scripts/report_installed_rule_links` for the current
  split before planning any of it; the per-host ratchet in
  `tests/scripts/install_rule_links.test.ts` holds the number from rising
  meanwhile.
- **Recommendation:** group 2, the 23 repo-tree links, first and on its own —
  they are the only group where the repair is unambiguous (no install can ever
  hold `../../tests/`, so a link is simply the wrong form) and the diff shrinks
  the rule bodies rather than growing them, which `src/rules/` size budgets
  reward. Leave group 1 alone until someone decides whether `docs/contracts/`
  is projected at all, because entering it from the link side would prejudge
  that. Group 3 is two lines and can ride with group 2.
- **If you do nothing:** a consumer following a link in an installed rule
  lands on nothing 47 times, silently — a dead link reads as a missing file
  rather than as a shipping decision, and the reader cannot tell which. The
  number does not grow: the per-host ratchet holds it, so the cost is standing
  rather than compounding, and nothing else on this roadmap waits on it.
- **Resolved when:** `./scripts-run src/scripts/report_installed_rule_links`
  reports 0 unresolved for `claude-code`, and the ratchet baseline in
  `tests/scripts/install_rule_links.test.ts` has been lowered to match.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The predicate is "not path-shaped", not a list of non-path kinds | A list missed `command` once; a negation cannot miss a kind added later | A trigger kind arrives that is neither path-shaped nor promptable |
| D2 | reversible-technical | agent | 1.2's two options are decided by measured standing cost, not by preference | Both resolve every link; the difference is characters on the shared host budget | The installed-layer report is not available when 1.2 runs |
| D3 | reversible-technical | agent | 1.3's 5 % threshold is a stated default for a report, not a gate | Nothing acts on the figure automatically | The report's top rows are not the known common words |
| D4 | reversible-technical | agent | 1.2 resolves by **deploying** the directories, not by rewriting the links to absolute package paths | Measured by `report_installed_rule_links` at the same commit, both repairing the same 113 links: deploy adds **0** characters of standing text and 184 files / 1.6 MB of link targets; rewrite adds **7,285** characters, every one of them inside a rule body, which is the text the host loads as instructions. Files under `contexts/` and `guidelines/` are not instruction files. The installed-layer report D2 names was not available — `road-to-a-rule-carrier-that-works-outside-the-repo` step 0.1 is still open — so the figure was taken from the deploy plan and the rule bodies directly, which is the same unit | The host begins counting non-`rules/` files in an install toward its instruction budget, which would make the two options trade on one axis instead of two |
| D5 | reversible-technical | agent | The 47 links left unresolved on Claude are a named remainder, not a smaller version of the same defect | 22 point into `docs/`, which the projection does not produce at all; 23 climb out of the install root into the repository (`../../tests/`, `../../src/`, `agents/settings/policies/`); 2 are one-off targets, one of them also unprojected. None is reachable by a deploy entry — closing them is an authoring change in rule prose, which this roadmap's "deliberately does not do" section keeps out of scope | A future projection ships `docs/`, or the rule bodies are re-authored to carry code spans where the target is not shipped |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | 1.1 changes which rules load unconditionally | implementation | A rule that gains `paths:`-less emission becomes standing text on every session. | Only rules with a non-path trigger change, and those are exactly the ones whose prompt route the current emitter drops. The installed-layer report records the delta. | Phase 1 — Repair, then measure |
| 2 | Deploying link targets grows the installed tree | product | Deploying `contexts/` or `guidelines/` adds files a consumer did not have. | 1.2 picks the option by measured standing cost; files under those directories are not instruction files unless linked from `rules/`. | Phase 1 — Repair, then measure |

## Acceptance Criteria

- [x] AC-1 — No rule with a non-path trigger is emitted with an exclusive
      `paths:` on Claude.
- [ ] AC-2 — A link check over an installed rule directory reports zero
      unresolved links.
- [x] AC-3 — The single-token, obligation-mechanism and per-spawn readings are
      committed as reports.
