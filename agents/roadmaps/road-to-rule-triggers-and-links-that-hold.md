---
complexity: lightweight
status: ready
execution:
  mode: autonomous
estate_growth_exempt: "Two blockers, +2 open_blockers, and both are decisions this run correctly did not take rather than work it failed to finish. `rule-link-targets-change-the-frozen-install-abi` records that the 1.2 repair — measured, decided, two lines — changes `GLOBAL_DEPLOY_SOURCES`, which is frozen install ABI: it owes an `install_layout_version` bump and a deprecation window shipping old and new shape side by side for a minor cycle, which is a release commitment and owner-reserved. `forty-seven-links-name-files-the-package-does-not-ship` records the 47 links no deploy entry can reach, whose repair is rule-prose authoring this roadmap's own scope section excludes. Each carries the exact edit, what it owes, a recommendation and a falsifiable `Resolved when`, so neither is a park wearing a blocker's clothes. The alternative to recording them was to execute an ABI change without its deprecation window, or to leave the measurement with no statement of what it implies — the first is forbidden, the second is the silence this estate ratchet exists to prevent."
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
      **The cost is paid and recorded, not hidden.** `check_rule_activation_census`
      is a ratchet over exactly this split and went red, which is the gate
      working: scoped 4 → 3, mixed 17 → 18, and the unconditional corpus
      113,699 → **116,633** exact-BPE tokens, +2,934 — `roadmap-progress-sync`
      now loading unconditionally instead of on a path match. That is risk
      register row 1 happening as written, and the trade this roadmap chose:
      2,934 tokens against a rule that fired on a file touch and never on the
      command that is its actual subject. Re-anchored in the same change with
      the reason in `baseline_history`, and a `revisit-if` naming the thinning
      work as the point where the total should fall below this anchor rather
      than be raised again.
- [x] **1.2 Links that resolve where the file lands.** When the installer writes a rule file, rewrite
      the 160 links of Context to absolute package paths, or have the installer also write the
      directories they point into — whichever adds less standing text, measured
      by the installed-layer report of
      `road-to-a-rule-carrier-that-works-outside-the-repo` step 0.1. Record the
      choice and the two numbers in Decisions.
      verify: `npx vitest run tests/scripts/install_rule_links.test.ts` -> 0
      done 2026-10-02 — **measured and decided; the execution is held for the
      owner, and that split is the honest outcome rather than a shortfall.**
      Step 0.1's report does not exist yet (that roadmap's Phase 0 is open), so
      D2's `revisit-if` fired and the measurement was taken directly from the
      deploy plan and the rule bodies, which is the same unit.
      New `src/install/installedRuleLinks.ts` audits every link in every rule a
      host installs and returns a verdict per link (`resolved`,
      `directory-not-deployed`, `file-missing`, `outside-install-root`);
      `src/scripts/report_installed_rule_links` prints it per host and prices
      the rewrite option. It reproduces Context's 160 exactly and splits it:
      113 into `contexts/` and `guidelines/`, 45 unreachable by any deploy
      entry, 2 one-off. **Deploy is the cheaper repair — 0 standing characters
      against 5,198** for rewriting those same 113 links at a 48-character
      install prefix. Recorded as D4, the remainder as D5.
      **It is not executed here.** The deploy table is part of the frozen
      install ABI, and `tests/install/install_layout_contract.test.ts` caught
      the first attempt: any change owes an `install_layout_version` bump plus
      a deprecation window — old and new shape side by side for a minor cycle,
      with in-place migration. That is a release commitment, so it is held as
      the `rule-link-targets-change-the-frozen-install-abi` blocker and the
      plan is back at its original 18 rows. 34 tests; the per-host ratchet
      carries the pre-repair numbers so the blocker's subject stays visible.
      **Two defects in this step's own first attempt, both found by review and
      fixed here.** (a) `auditLink` looked the first path segment up as a
      directory, so for a host that installs rules at the install ROOT
      (`cline`, dest `''`) a sibling link resolved to a bare filename and read
      as `directory-not-deployed` — 277 of cline's 550, every one of them fine.
      cline's reading goes 550 → **273** unresolved, and the old 550 was the
      maximum possible value, where no ratchet could ever have fired. (b)
      `GLOBAL_DEPLOY_SOURCES` was defined TWICE — `src/scripts/install.ts` for
      the CLI, `src/install/wizard-plan.ts` for the wizard — byte-identical
      across all 18 host rows, and the first attempt edited only one of them,
      so a wizard install would have diverged from a CLI install. `wizard-plan.ts`
      is now the only definition; `install.ts` imports and re-exports it, so no
      caller changed. That dedup is kept: it takes `install.ts` 5,231 → 5,175
      lines and let `check_source_size_budget` go 17,620 → 17,592, and it is
      what makes the held ABI change a one-place edit when the owner takes it.
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
      at least one; of the other 262, 37 do hit a foreign positive below the
      threshold and 225 hit nothing at all. And a clean negative worth the same
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

### blocker: rule-link-targets-change-the-frozen-install-abi

- **Status:** open
- **Owner:** maintainer
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** the execution half of 1.2, and AC-2 through it. The measurement,
  the instrument and the decision are delivered; 113 of the 160 unresolved
  links are one two-line edit away from resolving, and that edit is the thing
  held here.
- **What to do:** `GLOBAL_DEPLOY_SOURCES` in `src/install/wizard-plan.ts` is
  part of the frozen install ABI (`docs/contracts/install-layout.md`), and
  `tests/install/install_layout_contract.test.ts` fails on any change to it
  that is not paired with a version bump. The repair is adding
  `['dist/agent-src/contexts', 'contexts']` and
  `['dist/agent-src/guidelines', 'guidelines']` to `CLAUDE_SKILL_BUNDLE` and to
  the `augment` (guidelines only), `cursor`, `windsurf` and `kiro` rows —
  **not** `cline`, whose rules install at the root. Since the dedup landed,
  that is one table in one file.
  What it owes, per `BREAKING_CHANGES.md` § Install-ABI deprecation window:
  1. bump `INSTALL_LAYOUT_VERSION` in `src/scripts/_lib/install_layout.ts`;
  2. add `tests/fixtures/install_layout_v<N>.json` from the new descriptor;
  3. ship old + new shape side by side for one minor cycle, with the
     installer migrating an older tree in place;
  4. drop the old shape only after that cycle, with a `### Breaking` entry.
  Steps 3 and 4 are the release commitment — they decide what a consumer's
  next two minor upgrades do — which is why this is not an agent call.
  Before deciding, run `./scripts-run src/scripts/report_installed_rule_links`
  for the current per-host split; `--prefix-chars N` re-prices the rewrite
  alternative at a different install root.
- **Recommendation:** take it, in the next minor that already carries an
  install-layout change, so the deprecation window is paid once rather than
  twice. The change is purely additive — no consumer loses a directory, and an
  install that predates it simply gains two on the next run — so the migration
  step is a copy rather than a rewrite. If no such minor is near, the honest
  alternative is to leave it: 160 dead links in installed rules is a real cost
  but a static one, and D4's own `revisit-if` would reopen the comparison
  anyway if the host ever starts counting non-`rules/` files.
- **If you do nothing:** a consumer following a link in an installed rule
  lands on nothing 160 times per Claude install (97 on augment, 260 on cursor,
  273 on windsurf and kiro), silently — a dead link reads as a missing file
  rather than as a shipping decision. The number does not grow: the per-host
  ratchet in `tests/scripts/install_rule_links.test.ts` holds it, so the cost
  is standing rather than compounding, and every other step on this roadmap is
  closed without it.
- **Resolved when:** `GLOBAL_DEPLOY_SOURCES` carries the two directories,
  `npx vitest run tests/install/install_layout_contract.test.ts` is green
  against a golden for the bumped version, and the per-host baseline in
  `tests/scripts/install_rule_links.test.ts` has been lowered to the
  post-deploy reading (claude-code 47, augment 46, cursor 147, windsurf 160,
  kiro 160).

### blocker: forty-seven-links-name-files-the-package-does-not-ship

- **Status:** open
- **Owner:** maintainer
- **Class:** 2
- **Blocks:** AC-2, together with the ABI blocker above. That one holds 113 of
  claude-code's 160 unresolved links; these are the other 47. Both must close
  before AC-2 does. Every step on this roadmap is closed.
- **What to do:** these 47 are not a smaller version of what the ABI blocker
  holds, and a deploy entry cannot reach any of them — read D5 before
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
     the projection either, so nothing can resolve it. The single `templates/`
     link could be resolved by deploying that directory — 1.7 MB for ONE link,
     against 1.6 MB for the 113 the ABI blocker covers. Note what the test is
     here, because D4's is not it: D4 decided on standing CHARACTERS, where
     deploying scores 0 whatever the directory. This one turns on MB per link
     resolved, which is a different criterion and is stated as one.
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
- **If you do nothing:** 47 of a Claude install's 160 dead rule links stay
  dead even after the ABI blocker above is taken — a dead link reads as a
  missing file rather than as a shipping decision, and the reader cannot tell
  which. The number does not grow: the per-host ratchet holds it, so the cost
  is standing rather than compounding, and nothing else on this roadmap waits
  on it.
- **Resolved when:** `./scripts-run src/scripts/report_installed_rule_links`
  reports, for `claude-code`, no `docs` row, no `outside-install-root` row,
  **and** no `scripts` or `templates` row — i.e. all 47 are gone,
  independently of whether the ABI blocker has closed the other 113 — and the
  ratchet baseline in `tests/scripts/install_rule_links.test.ts` has been
  lowered to match. The last two rows are named explicitly because the first
  two conditions cover only 45: group 3's one-offs are
  `directory-not-deployed` rows, so a condition phrased on `docs` and the
  climb-outs alone would let this blocker close with 2 links still dead, and
  AC-2 would stay false with every blocker on the roadmap shut.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The predicate is "not path-shaped", not a list of non-path kinds | A list missed `command` once; a negation cannot miss a kind added later | A trigger kind arrives that is neither path-shaped nor promptable |
| D2 | reversible-technical | agent | 1.2's two options are decided by measured standing cost, not by preference | Both resolve every link; the difference is characters on the shared host budget | The installed-layer report is not available when 1.2 runs |
| D3 | reversible-technical | agent | 1.3's 5 % threshold is a stated default for a report, not a gate | Nothing acts on the figure automatically | The report's top rows are not the known common words |
| D4 | reversible-technical | agent | 1.2's two options are decided: **deploy**, not rewrite. The decision is agent-owned; **executing it is not**, because the deploy table is frozen install ABI | Measured by `report_installed_rule_links` at the same commit, both repairing the same 113 links: deploy adds **0** characters of standing text and 184 files / 1.6 MB of link targets; rewrite adds **5,198** characters at a 48-character install prefix, every one of them inside a rule body, which is the text the host loads as instructions. (The 7,285 first recorded here was the cost over all 160 unresolved links, including 45 a rewrite cannot reach either — not like-for-like, and it overstated the losing option by ~40 %. Direction unchanged: 0 < 5,198.) Files under `contexts/` and `guidelines/` are not instruction files. The installed-layer report D2 names was not available — `road-to-a-rule-carrier-that-works-outside-the-repo` step 0.1 is still open — so the figure was taken from the deploy plan and the rule bodies directly, which is the same unit | The host begins counting non-`rules/` files in an install toward its instruction budget, which would make the two options trade on one axis instead of two |
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
