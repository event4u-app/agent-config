---
complexity: lightweight
status: ready
execution:
  mode: autonomous
estate_growth_exempt: "Two blockers, +2 open_blockers, and both are decisions this run correctly did not take rather than work it failed to finish. `rule-link-targets-change-the-frozen-install-abi` records that the 1.2 repair — measured, decided, two lines — changes `GLOBAL_DEPLOY_SOURCES`, which is frozen install ABI: it owes an `install_layout_version` bump and a deprecation window shipping old and new shape side by side for a minor cycle, which is a release commitment and owner-reserved. `forty-seven-links-name-files-the-package-does-not-ship` records the links no deploy entry can reach. 22 of them were repaired on 2026-10-03 — the repo-tree link form, which the blocker's own recommendation named as the group to take first; a 23rd was repaired, caught by an independent review as a link augment actually resolves, and reverted. A further 21 were repaired on 2026-10-06 — the `docs/` group, after the council reopened the hold recorded against it and found its foreclosure claim unsound (D7). What is held is now three links: one `docs/` link and one climb-out, both in kernel rules, which owe their own PR and a 24 h soak, and that one augment-resolving `templates/` link, whose only correct repair is a deploy row — and which, as the remainder blocker's own `Resolved when` correction records, therefore routes through the ABI blocker's owner gate rather than closing independently of it. Each carries the exact edit, what it owes, a recommendation and a falsifiable `Resolved when`, so neither is a park wearing a blocker's clothes. The alternative to recording them was to execute an ABI change without its deprecation window, or to leave the measurement with no statement of what it implies — the first is forbidden, the second is the silence this estate ratchet exists to prevent."
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
      done 2026-10-02 — measured and decided; the execution is held for the
      owner. Full evidence (the measurement and two first-attempt defects)
      moved verbatim to
      `agents/evidence/analysis/rule-triggers-and-links-evidence-2026-10.md`
      (step 1.2), by `road-to-signals-that-mean-what-they-say` step 3.1.
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

- **Status:** open — owner chose the recommendation on 2026-10-06 via `/roadmap:resolve-blockers` (D8): take it in the next minor that already carries an install-layout change; closes when that minor lands the edit, which waits on a release, not a question
- **Owner:** maintainer
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** the execution half of 1.2, and AC-2 through it. The measurement,
  the instrument and the decision are delivered; 112 of the 115 unresolved
  links are one two-line edit away from resolving, and that edit is the thing
  held here. (113 of 160 when this was written; 112 of 158 on 2026-10-02 after
  the tree shed two links; 112 of 136 on 2026-10-03 after the remainder
  blocker's repo-tree group was repaired; 112 of 115 on 2026-10-06 after its
  `docs/` group was repaired. This blocker's own share has not moved from 112
  across four re-measurements — every change since has come out of the OTHER
  population, which is the split doing its job, and which is now visible as a
  near-pure reading: 112 of the 115 links a Claude install ships dead are this
  one decision, and the remaining 3 are the other blocker entire.)
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
  lands on nothing 115 times per Claude install (52 on augment, 214 on cursor,
  227 on windsurf, cline and kiro), silently — a dead link reads as a missing
  file rather than as a shipping decision. The number does not grow: the
  per-host ratchet in `tests/scripts/install_rule_links.test.ts` holds it — now
  at the measured reading rather than above it — so the cost is standing rather
  than compounding, and every other step on this roadmap is closed without it.
  (136 / 73 / 235 / 248 before 2026-10-06; the fall is the other blocker's
  `docs/` group being repaired, not this one getting smaller.)
- **Resolved when:** `GLOBAL_DEPLOY_SOURCES` carries the two directories,
  `npx vitest run tests/install/install_layout_contract.test.ts` is green
  against a golden for the bumped version, and the per-host baseline in
  `tests/scripts/install_rule_links.test.ts` has been lowered to the
  post-deploy reading — **claude-code 3, augment 2, cursor 102, windsurf 115,
  cline 115, kiro 115**, each the live unresolved count minus the directories
  that host's row gains (augment gains `guidelines/` only). Re-derived
  2026-10-06 from `report_installed_rule_links` by the same subtraction that
  produced the earlier 47 / 46 / 147 / 160 / 160, then 46 / 45 / 145 / 158 /
  158, then 24 / 23 / 123 / 136 / 136; the numbers fell each time because the
  links the OTHER blocker held were repaired, never because this one got
  easier — its own share has sat at 112 throughout. Re-derive again before
  executing, because these move whenever a rule body gains or loses a link.
  **What the latest fall changes is the reading, not the work:** at
  claude-code 3 the post-deploy remainder is now small enough to state
  exhaustively — one kernel `docs/` link, one kernel climb-out, one
  `templates/` link — so taking this blocker would leave a Claude install with
  three dead links, all three named, instead of twenty-four unenumerated ones.

### blocker: forty-seven-links-name-files-the-package-does-not-ship

- **Status:** open
- **Owner:** maintainer
- **Class:** 2
- **Blocks:** AC-2, together with the ABI blocker above. That one holds 112 of
  claude-code's 115 unresolved links; these are the other **3**. Both must close
  before AC-2 does. Every step on this roadmap is closed. (113 / 160 / 47 when
  this was written; 112 / 158 / 46 on 2026-10-02; 112 / 136 / 24 on 2026-10-03,
  after the repo-tree group below was repaired; 112 / 115 / 3 on 2026-10-06,
  after the `docs/` group was repaired per D7. The slug still says forty-seven and
  is deliberately not renamed — the frontmatter exemption and this roadmap's
  own prose cite it, and a slug that tracked its own count would break every
  reference each time the count moved. It is now off by a factor of fifteen,
  which is the strongest argument for the convention rather than against it:
  the name is an address, not a measurement.)
- **What to do:** these are not a smaller version of what the ABI blocker
  holds, and a deploy entry cannot reach any of them — read D5 and D6 before
  reaching for one. Three groups were named; two are done:
  1. **22 into `docs/`** — **21 repaired 2026-10-06, 1 open, and the open one
     is held by the kernel window rather than by the `docs/` question.**
     `dist/agent-src/` carries no `docs/` directory, and several rules say so
     in their own text. The hold recorded here was that repairing from the
     link side "would settle the first question by making the second
     irreversible in practice". That claim was reopened and did not survive
     (D7): a code span becomes a link again by the reverse of the same
     mechanical edit, and the option it was protecting — projecting
     `docs/contracts/` — needs a deploy row, which is the ABI blocker's own
     owner-reserved gate. So holding the links preserved no choice an agent
     run could make; it only deferred a repair. Routed to the council, which
     agreed (degraded, 1 of 2 seats), and executed for the 21 links in
     non-kernel rules. D6's safety check was run first rather than assumed:
     `docs` is unresolved on all 18 host rows, and `resolved` stayed at 387 on
     every host while total links fell 523 → 502, which is the arithmetic that
     caught the `templates/` mistake.
     The one left is in `ask-when-uncertain.md`, a kernel rule — same window
     as the climb-out in group 2, and the two should ride one kernel PR.
  2. **22 climbing out of the install root** into `../../tests/`,
     `../../src/scripts/`, `../../scripts/`, `../../docs/` and
     `agents/settings/policies/media/` — **21 repaired 2026-10-03**, 1 open.
     (`../../docs/` is listed here and not under group 1: from `rules/` it
     climbs OUT of the install root, where group 1's `../docs/contracts/`
     lands inside it as an undeployed directory. Same word, two verdicts.)
     These name the repository, not the package; no install has ever held
     them, and none ever will, so a code span was the only repair and it is
     made. The one left is `../../tests/golden/outcomes/direct_answers.json`
     in `direct-answers.md`: identical defect, but `direct-answers` is a
     kernel rule, so the edit ships in its own PR with a 24 h soak
     (`scope-control` § Kernel-rule edits). One link does not justify spending
     that window; the next kernel PR carries it.
     **Amended 2026-10-06: it is no longer one link.** Group 1's repair left a
     `docs/` link in `ask-when-uncertain.md`, also kernel, also held by nothing
     but the same window. The kernel-held remainder is now exactly two links in
     two kernel rules, and one PR with one soak discharges both — which is a
     materially better trade than the one this line declined. Both are
     mechanical one-line edits of the form already executed 43 times on this
     roadmap, so the kernel PR carries review risk from its process, not from
     its diff.
     **Correction 2026-10-06 (drain lane, write path probed rather than
     assumed): the kernel PR is NOT agent-executable.** This line, AC-2's note
     and the recommendation below all call it "an agent-executable change gated
     on a 24 h soak". The soak is real but it is not the gate. The
     `block-kernel-rule-writes` `pre_tool_use` concern
     (`src/scripts/hooks/block_kernel_rule_writes.ts`, bound in
     `src/scripts/hook_manifest.yaml`) refuses every agent write to a kernel
     rule in `src/rules/` and in every projection, and both `direct-answers`
     and `ask-when-uncertain` are kernel rules
     (`docs/contracts/kernel-membership.md`). Its only bypasses — the override
     exception registry, or removing the manifest entry — are human acts
     outside a session. So the two kernel links are **human-gated**, not
     agent-gated: a maintainer makes the two one-line edits (the target form
     is the code span already used 43 times on this roadmap), re-anchors
     `check_kernel_prefix_stability --update-baseline` in the same PR, and
     lowers the remainder pin from `docs 1` / one `outside-install-root` row
     to zero. Recorded here, not in AC-2's own text, because AC-2 is hashed by
     the risk-register freshness gate and this is a correction to the route,
     not to the criterion. The consequence for the roadmap: every open item is
     now behind a human act — D8's release timing for 112 links (plus the
     `templates` row), and a maintainer's kernel edit for 2 — so no agent run
     can move AC-2 until one of them happens.
  3. **2 one-off targets** — **1 repaired 2026-10-03, 1 reverted and OPEN,
     and the revert is the finding worth keeping.**
     `scripts/hooks/evidence_independence.ts` is in no projection, so nothing
     could resolve it; that one is a code span now, naming a path the
     repository actually has, which the old link did not.
     The `templates/` link in `ui-audit-gate.md` was repaired the same way and
     **the repair was wrong**. `GLOBAL_DEPLOY_SOURCES.augment` maps
     `dist/agent-src/templates` → `templates` beside `rules`, so on augment
     that link RESOLVES — it is a working link on one host and unresolved on
     the rest, not a repo-tree form. An independent review caught it from the
     arithmetic: 23 links removed, augment's unresolved fell only 22. It is
     restored, and the open question is unchanged from D4's shape but on a
     different axis: deploying `templates/` costs 1.7 MB for ONE link against
     1.6 MB for the 112 the ABI blocker covers. D4 decided on standing
     CHARACTERS, where deploying scores 0 whatever the directory; this one
     turns on MB per link resolved, and is stated as a different criterion.
     **The general lesson, which no gate here carries:** the ratchet bounds
     unresolved links and nothing bounds RESOLVED links from shrinking, so a
     link that reads as repo-tree must be checked against every host's deploy
     plan before it is repaired. `tests/scripts/install_rule_links.test.ts`
     now pins this one link in both directions so the mistake cannot be made
     twice.
  Run `./scripts-run src/scripts/report_installed_rule_links` for the current
  split before planning the rest; the per-host ratchet in
  `tests/scripts/install_rule_links.test.ts` holds the number from rising
  meanwhile, and a second pin there names this remainder directly, so a new
  `scripts`, `templates` or `outside-install-root` row cannot reappear
  unnoticed.
- **Recommendation:** taken, for the part that was actually unambiguous. Group
  2 was — no install can ever hold `../../tests/`, so the link was simply the
  wrong form — and the diff shrank the rule bodies rather than growing them,
  which `src/rules/` size budgets reward: the five pack token passports fell
  with it. Group 3 turned out to be two different things wearing one label,
  which is why "the repair is unambiguous" has to be checked per link and not
  per group. **Its second half has now been taken too, and reversed on
  evidence** (D7, 2026-10-06): "leave group 1 alone until someone decides
  whether `docs/contracts/` is projected" rested on a foreclosure claim that
  does not hold, and on a decision no agent run could take either way, so the
  21 non-kernel links were repaired and the owner's projection option is
  untouched.
  What remains is narrower and sharper than before. For the two kernel links —
  one `docs/`, one climb-out — open ONE kernel PR carrying both; the trade the
  old line declined ("one link does not justify that window") is a different
  trade at two links, and both diffs are one line each. For the `templates/`
  link, the decision is a deploy row or nothing — never a code span, which
  would un-resolve it on the one host where it works — and per the correction
  below that row belongs with the ABI blocker's table rather than here.
- **If you do nothing:** 3 of a Claude install's 115 dead rule links stay
  dead even after the ABI blocker above is taken — a dead link reads as a
  missing file rather than as a shipping decision, and the reader cannot tell
  which. The number does not grow: the per-host ratchet holds it, and the
  remainder pin beside it holds the shape as well as the count, so the cost is
  standing rather than compounding, and nothing else on this roadmap waits on
  it. (24 before 2026-10-06.) Two of the three are one kernel PR away; the
  third is the `templates/` link, which is the ABI blocker's shape on a
  different axis — see the correction in `Resolved when` below.
- **Resolved when:** `./scripts-run src/scripts/report_installed_rule_links`
  reports, for `claude-code`, no `docs` row, no `outside-install-root` row,
  **and** no `scripts` or `templates` row — i.e. all 24 that remain are gone,
  independently of whether the ABI blocker has closed the other 112 — and the
  ratchet baseline in `tests/scripts/install_rule_links.test.ts` has been
  lowered to match. All four conditions are kept, and two of them are already
  met: the `scripts` row is gone as of 2026-10-03, and the `outside-install-root`
  rows are down to one. They stay written because they are what stops the
  condition from being satisfiable by the `docs` and climb-out rows alone — a
  one-off `directory-not-deployed` row could otherwise reappear and this
  blocker could close with links still dead, leaving AC-2 false with every
  blocker on the roadmap shut. The `templates` row is the standing
  counter-example to reading this condition as "make the rows go away": it goes
  away correctly by a deploy row and incorrectly by a code span, and only one
  of those is a repair. The baseline has been lowered twice already — to
  136 / 73 / 235 / 248, then to **115 / 52 / 214 / 227** on 2026-10-06; it is
  lowered again when the rest goes.

  **Correction 2026-10-06 — this condition is NOT independent of the ABI
  blocker, and the word "independently" above is wrong.** Executing the
  condition against the tree is what surfaced it. Three rows must go. Two are
  one kernel PR away and are genuinely this blocker's own. The third is the
  `templates` row, and this blocker's own § What to do states that its only
  correct repair is a deploy row — "never a code span, which would un-resolve
  it on the one host where it works". A deploy row is a change to
  `GLOBAL_DEPLOY_SOURCES`, which is exactly the frozen install ABI the OTHER
  blocker holds, owing the same `INSTALL_LAYOUT_VERSION` bump and the same
  deprecation window. So as written this condition cannot be satisfied while
  the ABI blocker is open: it claims to close independently and routes its last
  row straight through the other blocker's owner gate.

  That is a defect in the condition, not a reason to weaken it. The honest
  reading is that AC-2 has **one** owner gate, not two — the ABI decision —
  plus one kernel-soak window that is an agent-executable PR rather than a
  decision. Left stated rather than rewritten, because changing a blocker's
  closing condition to make it reachable is how a criterion quietly stops
  describing the thing it was written to measure. The owner may prefer to
  fold the `templates` row into the ABI blocker's deploy table, which is where
  it would be executed anyway; that is a one-line merge of two conditions and
  it is their call, not this run's.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | The predicate is "not path-shaped", not a list of non-path kinds | A list missed `command` once; a negation cannot miss a kind added later | A trigger kind arrives that is neither path-shaped nor promptable |
| D2 | reversible-technical | agent | 1.2's two options are decided by measured standing cost, not by preference | Both resolve every link; the difference is characters on the shared host budget | The installed-layer report is not available when 1.2 runs |
| D3 | reversible-technical | agent | 1.3's 5 % threshold is a stated default for a report, not a gate | Nothing acts on the figure automatically | The report's top rows are not the known common words |
| D4 | reversible-technical | agent | 1.2's two options are decided: **deploy**, not rewrite. The decision is agent-owned; **executing it is not**, because the deploy table is frozen install ABI | Measured by `report_installed_rule_links` at the same commit, both repairing the same 113 links: deploy adds **0** characters of standing text and 184 files / 1.6 MB of link targets; rewrite adds **5,198** characters at a 48-character install prefix, every one of them inside a rule body, which is the text the host loads as instructions. (The 7,285 first recorded here was the cost over all 160 unresolved links, including 45 a rewrite cannot reach either — not like-for-like, and it overstated the losing option by ~40 %. Direction unchanged: 0 < 5,198.) Files under `contexts/` and `guidelines/` are not instruction files. The installed-layer report D2 names was not available — `road-to-a-rule-carrier-that-works-outside-the-repo` step 0.1 is still open — so the figure was taken from the deploy plan and the rule bodies directly, which is the same unit | The host begins counting non-`rules/` files in an install toward its instruction budget, which would make the two options trade on one axis instead of two |
| D5 | reversible-technical | agent | The 47 links left unresolved on Claude are a named remainder, not a smaller version of the same defect | 22 point into `docs/`, which the projection does not produce at all; 23 climb out of the install root into the repository (`../../tests/`, `../../src/`, `agents/settings/policies/`); 2 are one-off targets, one of them also unprojected. None is reachable by a deploy entry — closing them is an authoring change in rule prose, which this roadmap's "deliberately does not do" section keeps out of scope. *Amended 2026-10-03: the final clause does not hold — see D6. The classification itself stands.* | A future projection ships `docs/`, or the rule bodies are re-authored to carry code spans where the target is not shipped |
| D6 | reversible-technical | agent | The repo-tree group of D5's remainder is repaired HERE, not deferred to a roadmap of its own | Three things had to hold together, and did. (1) The deferral rested on a scope exclusion this roadmap does not contain — checked line by line against § What this roadmap deliberately does not do. (2) The blocker's own Recommendation already named group 2 as the one to take first, on the ground that it is the only unambiguous group; executing a recorded recommendation is not reopening it. (3) The repair prejudges nothing — group 1 is left untouched precisely so the `docs/` projection question stays open, which is the same recommendation's second half. Measured outcome: 22 links, 9 non-kernel rules, claude-code 158 → 136 unresolved, five pack token passports smaller, and the ratchet lowered from a deliberately loose 160 to the measured 136 with every pin seen red under a probe. A 23rd link was repaired and REVERTED after an independent review showed it resolves on augment — recorded in the blocker's group 3, because the lesson belongs where the next person looks | A `docs/` projection decision lands, which would make group 1 executable on the same terms — or a kernel PR opens for another reason, which is when the one remaining climb-out rides along |
| D7 | reversible-technical | council:2026-10-06-docs-links-degraded-1of2 | The `docs/` group of D5's remainder is repaired too — 21 of 22 links become code spans; the 22nd is kernel-held, not held by the question | The hold this reopens rested on one claim — that repairing from the link side makes projecting `docs/` "irreversible in practice". The council found that claim unsound and nothing in the tree supports it: a code span becomes a link again by the same mechanical edit that produced it, so the owner's option survives the repair intact. Two further things had to hold and did. (1) **The option the hold was protecting is not one this run could take anyway** — projecting `docs/contracts/` means a deploy row, which is frozen install ABI and owner-reserved, so holding the links preserved nothing an agent could decide; it only deferred a repair. (2) **D6's hard-won safety check passes cleanly here, and was run rather than assumed**: the `templates/` revert taught that a link reading as repo-tree must be checked against every host's deploy plan first, so `report_installed_rule_links` was read for all 18 host rows and `docs` is unresolved on every one of them. The arithmetic confirms it rather than the intent: total links 523 → 502 (−21) with `resolved` unchanged at **387 on every host** — the exact signal that caught the `templates/` mistake, where 23 links left and augment's unresolved fell only 22. Measured outcome: claude-code 136 → **115** unresolved, augment 73 → 52, cursor 235 → 214, windsurf / cline / kiro 248 → 227; seven pack token passports smaller; the ratchet lowered to the measured reading and probed red at 114 before restoring. Council seat 2 (anthropic) failed on API credit, not on judgement — recorded as degraded, which is a reading and not convergence | A `docs/` projection decision lands, which turns each code span back into a link by the reverse of this edit — or the kernel PR named in the remainder blocker opens, which is when the 22nd link rides along |
| D8 | product-owned | owner | the two deploy entries (`contexts/`, `guidelines/`; augment `guidelines/` only, not `cline`) land in the next minor that already carries an install-layout change, so the deprecation window is paid once; until then the ratchet holds the unresolved links | owner answer 2026-10-06 to blocker `rule-link-targets-change-the-frozen-install-abi`, options: next layout-changing minor / next minor regardless / not at all | no layout-changing minor is in sight after two minors, or the host starts counting non-`rules/` files |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/drain-rule-triggers-links-hold -->

Re-read again 2026-10-06 against the tree, and this time **re-stamped** — the
2026-10-03 note below explains why it could not be, and that reason does not
apply to this round. The gate dates freshness from the commit that INTRODUCED
the current `reviewed:` value and compares that blob's Acceptance Criteria
against the working text, so the thing it cannot express is an AC that moves
*twice* after one stamp. The 2026-10-03 round was exactly that case and
correctly left the stamp alone. This round moves AC-2 once, in the same change
that re-stamps, so the introducing commit carries the AC text the stamp
describes and the two agree by construction. Verified rather than assumed: the
gate was run before the stamp and reported `stale_review` on this file, and run
again after it and reported clean — the red was the instrument working, and
it is recorded here because a stamp nobody saw fail is a stamp nobody tested.

Both rows still describe the plan.
Row 1 remains discharged at step 1.1. Row 2 is unchanged in shape and smaller
in size: the `docs/` repair (D7) removed 21 links from the population row 2
does NOT cover, so the deployable share it is about is still 112. The repair
carried no risk this register is missing — it removed link syntax, added no
instruction text, and the seven pack token passports fell rather than grew,
which is the same direction the 2026-10-03 repair moved them.

Re-read 2026-10-03 against the tree, and deliberately NOT re-stamped: both rows
still describe it, nothing was added and nothing retired, so there is no review
to record. Row 1 has HAPPENED and is recorded where it happened — step 1.1's
note carries the measured +2,934 tokens and the re-anchored ratchet, which is
the mitigation discharging rather than the risk going away. Row 2 is still live
and still unexecuted; it is what the ABI blocker holds, and neither
re-measurement moved its shape — 113 links to 112 on 2026-10-02, and 112 still
on 2026-10-03, because the 22 repaired that day came out of the other
population entirely. The repo-tree repair carried no risk this register was
missing: it removed link syntax and added no instruction text, and the five
pack token passports fell rather than grew.

**Why the stamp stayed at 2026-10-02 through the 2026-10-03 round** — kept as
the record of that round's reasoning, which was right for it; the stamp now
reads 2026-10-06 for the reason given above. Stated rather than left to look
like an
oversight.** `lint_plan_risk_register` dates freshness from the commit that
INTRODUCED the current `reviewed:` value and compares that blob's Acceptance
Criteria against the working text, and `MARKER_RE` accepts only a bare date —
so a plan whose AC text moves twice in one day cannot be given a recorded
re-review for the second move. Re-stamping and then editing AC-2 again after an
independent review reds the gate; editing AC-2 to match a stamp it no longer
describes would ship a number this run knows is wrong. So the stamped surfaces
are left exactly as `main` carries them, and everything measured on 2026-10-03
lives in the two blockers and in D6 — sections the gate does not hash, and the
ones a reader of this roadmap reaches first.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | 1.1 changes which rules load unconditionally | implementation | A rule that gains `paths:`-less emission becomes standing text on every session. | Only rules with a non-path trigger change, and those are exactly the ones whose prompt route the current emitter drops. The installed-layer report records the delta. | Phase 1 — Repair, then measure |
| 2 | Deploying link targets grows the installed tree | product | Deploying `contexts/` or `guidelines/` adds files a consumer did not have. | 1.2 picks the option by measured standing cost; files under those directories are not instruction files unless linked from `rules/`. | Phase 1 — Repair, then measure |

## Acceptance Criteria

- [x] AC-1 — No rule with a non-path trigger is emitted with an exclusive
      `paths:` on Claude.
- [ ] AC-2 — A link check over an installed rule directory reports zero
      unresolved links.

      **Re-measured 2026-10-06, and it stays false — on evidence, not on the
      absence of an attempt.** `./scripts-run src/scripts/report_installed_rule_links`
      reads **115** unresolved for `claude-code` against 502 links: **112** into
      `contexts/` and `guidelines/`, which the ABI blocker holds, and **3** the
      remainder blocker holds. Zero is reachable only when both close, which the
      remainder blocker already states ("Both must close before AC-2 does").

      **What changed this round, and what did not.** The remainder fell 46 → 24
      → **3** as its two executable groups were taken; the deployable share has
      not moved from 112 across four measurements. So the criterion is now
      almost entirely one decision: 112 of the 115 links a Claude install ships
      dead are the ABI deploy row, and that is a release commitment — an
      `INSTALL_LAYOUT_VERSION` bump plus a deprecation window deciding what a
      consumer's next two minor upgrades do — which is owner-reserved and not
      an agent call.

      **The last clause of the old note is withdrawn.** It read that the
      remainder "is rule-prose authoring this roadmap's own § What this roadmap
      deliberately does not do keeps out of scope". Checked line by line, that
      section excludes three things — a trigger rewrite from 1.3, an obligation
      moved into a hook from 1.5, and a change to which rules are path-scoped
      beyond the 1.1 predicate fix. None of them is link prose. D6 already made
      this correction for the repo-tree group and the same reading applies to
      the `docs/` group; the clause survived because it was never re-read, which
      is the failure mode a `revisit-if` exists to catch.

      Of the 3 that remain, 2 are one kernel PR away — an agent-executable
      change gated on a 24 h soak, not on a decision — and the 3rd routes
      through the ABI blocker's own owner gate (see that blocker's § Resolved
      when correction). AC-2 therefore has exactly **one** open owner decision
      behind it, and this is recorded here rather than left to be re-derived.

      **The tree moved under the criterion, so the figures in both blockers were
      refreshed rather than left to read as current.** Across three rounds:
      160 → 158 → 136 → **115**, the deployable share 113 → 112 and then flat,
      the remainder 47 → 46 → 24 → **3**, and the per-host post-deploy targets
      with them.

      **`UNRESOLVED_BASELINE` IS lowered this round, to 115 / 52 / 214 / 227,
      and the earlier refusal to lower it was right for its own round.** The
      distinction is what moved the number. On 2026-10-02 the tree had merely
      shed two links on its own, so tightening would have pinned a drift reading
      and bought nothing. This round the fall is a repair this change makes, so
      the baseline is the thing that stops it regressing — and the reading is
      structural rather than environmental: every unresolved link is
      `directory-not-deployed` or `outside-install-root`, verdicts decided from
      the deploy plan alone, with `file-missing` at 0, so a worktree and CI read
      the same number. That is what makes it safe to sit at the exact reading.
      Proven rather than asserted: the claude-code row was probed at 114, seen
      red with `expected 115 to be less than or equal to 114`, and restored — a
      baseline never seen red has unknown sensitivity.
      The exact-split pin beside it still reads 62 / 50 and needed no change;
      the remainder pin moved from `docs 22` to `docs 1` and is the assertion
      that would catch this repair being silently undone.
- [x] AC-3 — The single-token, obligation-mechanism and per-spawn readings are
      committed as reports.
