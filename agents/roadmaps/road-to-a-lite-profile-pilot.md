---
complexity: lightweight
status: ready
tree_pin: 811cea61d6
review_by: 2027-01-31
estate_offset_exempt: "Created on the owner's instruction of 2026-11-21 to plan and work off every measure of the session retro (this is measure 16); no active roadmap owns a lite-profile pilot, and archiving an unrelated one to offset it would drop asked-for work. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
estate_growth_exempt: "Same instruction; adds two blockers of its own: lite-pilot-sample (waits on sessions) and lite-general-ship (owner-reserved ship decision)."
execution:
  mode: autonomous
relates:
  - slug: stubs/road-to-a-discipline-profile-that-loads
    relation: extends
    note: "That stub shipped the profile-selects-what-installs wiring (essential/off narrow, kernel always ships). This file adds one opt-in profile below `off` that may drop kernel rules, and pilots it in one repo; the stub's remaining scope (the default flip) stays there."
  - slug: road-to-a-package-measured-against-no-rules
    relation: extends
    note: "That file answers package vs no rules on a bench corpus and, in its Phase 3, on pre-registered real tasks. This file adds an observational field reading on the owner's own sessions for a <=5-rule profile; it reuses no budget of that file and does not touch its arms."
  - slug: later/road-to-a-start-as-light-as-the-field
    relation: disjoint
    note: "Owns the start-footprint target for every consumer and its adapt-before-removing order. This file removes nothing from any default; the lite profile is opt-in and reverts with one re-install."
  - slug: later/road-to-discipline-profile-tiering-followup
    relation: disjoint
    note: "Owns the disposition of the `full` tier at the heavy end of the same enum; nothing here reads or changes `full`."
  - slug: later/road-to-a-bounded-trial-of-the-user-profile-layer
    relation: disjoint
    note: "Shares the word profile only: that file trials ADR-138's user-profile memory layer, not the discipline profile."
---

# Road to a lite profile pilot for solo work

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions in 23 chunks, 643 extracted incidents), measure 16 of its P1
> list, and the AI council round of the same day (analysis mode, one round,
> members anthropic/claude-sonnet-4-5 and openai/codex-default, 2 of 2
> answered). Anthropic's top priority was a solo profile with at most five
> safety rules, no council and no ratification, piloted in azeroth-companion.
> OpenAI called the claim that permission, ceremony and budget rules cost more
> than they bring speculative, because no one estimated the defects they
> prevent. The retro kept the claim as a hypothesis and named this pilot as one
> of its two tests; whether a lite profile ships is the owner's decision.

## Goal

One repository, azeroth-companion, runs on an opt-in `discipline_profile: lite`
that installs at most five package rules and none of the ratification
ceremony, and a generated before/after report states, against thresholds fixed
before activation, whether owner complaint and correction signals, owner
prompts per session and tokens per session moved, and whether any safety
incident occurred. The general-ship decision then sits with the owner as a
blocker carrying that report.

## Context

- **The narrowing mechanism exists, but stops at the kernel.**
  `src/shared/disciplineProfiles.ts:13-16` lists the non-kernel rules for
  `off` (none) and `essential` (`downstream-changes`).
  `src/install/rule_scope.ts:164` ships every `type: always` rule under every
  profile, and `src/install/rule_scope.ts:70-76` narrows only on `essential`
  and `off`. The kernel is nine rules (`grep -l '^type: always' src/rules/*.md`:
  agent-authority, ask-when-uncertain, commit-policy, direct-answers,
  language-and-tone, no-cheap-questions, non-destructive-by-default,
  scope-control, verify-before-complete). `off` therefore still loads nine, and
  "at most five" needs a profile that may drop kernel rules. That is this
  file's delta.
- **The install is machine-wide.** `resolveGlobalRuleScope`
  (`src/install/globalRuleScope.ts:59`, called from
  `src/scripts/install.ts:3161`) narrows the global install, so a per-repo pilot
  needs an activation path that does not change the owner's other repos.
- **Observed drift, unverified cause.** On 2026-11-21
  `~/.agent-settings.yml:103` reads `discipline_profile: off`, yet
  `~/.claude/rules/` holds 103 files. Which settings file the installer read,
  and whether an install ran after the key was set, is not known; step 1.1
  reproduces it before any baseline is trusted.
- **Ratification** is ADR-268 § 4
  (`docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md:189-208`)
  and its quorum file `src/config/ratification-policy.json`. Which ceremony
  actually fires inside a consumer session is unmeasured; step 1.4 generates
  that list from transcripts rather than taking it as given.
- **Measurement parts already in the tree.** `agent-config sessions:catalog`
  (`src/cli/registry.ts:86`) lists every session with repo, tokens and model;
  `promptSignal` (`src/scripts/_lib/feedback_signals.ts:60`) classifies an owner
  prompt as `complaint`, `correction`, `directive` or `approval`
  (`feedback_signals.ts:19`); `src/scripts/retro_session_facts.ts:40-54` reads
  turns, tool calls and final context tokens per session.
- **Owner constraint (2026-11-21).** No hand-maintained or owner-written
  context. Every list and report this file produces is generated by a script
  from the repo, transcripts or telemetry, and carries its generator command.
- **Counts are a sample.** The retro's azeroth numbers (68 incidents, 17 with
  frustration) come from 2 chunks and are not per-session rates (OpenAI's
  caveat); the baseline is re-derived in step 1.3, never copied from the retro.

## Phase 1 — Baseline before anything changes

- [ ] **1.1 Reproduce the profile-vs-install mismatch.** Run
      `./scripts-run src/install/rule_scope_cli --rules-dir dist/agent-src/rules --settings <file>`
      with the file `_resolve_global_settings_path()` (`src/scripts/install.ts`)
      resolves on this machine, and compare the excluded-rule count with
      `ls ~/.claude/rules | wc -l`. Record the resolved path, the computed set
      and the installed count in the protocol of 1.5.
      verify: the protocol names the resolved settings path and both counts; if they disagree, it names the cause found by reading `globalRuleScope.ts`.
- [ ] **1.2 Write the metrics generator, test first.** Add
      `tests/scripts/profile_pilot_metrics.test.ts` with fixture transcripts
      (two sessions, known prompts, known token totals) and watch it fail.
      Then add `src/scripts/profile_pilot_metrics.ts`: for a repo path and a
      time window it reads the Claude Code transcripts `sessions:catalog`
      locates and emits per session the owner prompt count, `promptSignal`
      kinds, turns, total tokens, the rule files loaded at session start, and
      any destructive-action or secret-guard event.
      verify: the new test fails before the script exists and passes after; `task test` exits 0.
- [ ] **1.3 Generate the baseline.** Run the generator on every
      azeroth-companion session before activation and write
      `agents/evidence/metrics/lite-profile-pilot-baseline-20261121.md` with
      the generator command in its header, per-session rows and per-metric
      medians.
      verify: the file exists, its header names the command, and its session count equals the generator's JSON row count.
- [ ] **1.4 Generate the ceremony inventory.** Extend the generator with
      `--controls`: for each baseline session, count assistant turns that cite
      a rule id, a hook name, a ratification or run-start-contract prompt, and
      how many of those precede a `complaint` or `correction` prompt within two
      turns. Write the ranked list into the baseline file.
      verify: a test case with a fixture transcript asserts the count for one rule id; the baseline file carries the ranked list.
- [ ] **1.5 Pre-register the reading.** Write
      `agents/evidence/preregistration/lite-profile-pilot-protocol-20261121.md`:
      the four metrics, the after window, a minimum sample of fifteen
      post-activation sessions, the decision rule per metric (BETTER / WORSE / INCONCLUSIVE),
      and the guard: one destructive-action or secret event in the after window
      ends the pilot through step 2.6.
      verify: `git log --format=%H -- agents/evidence/preregistration/lite-profile-pilot-protocol-20261121.md` -> /^[0-9a-f]{40}$/ and that single commit precedes the commit that carries step 3.1.

## Phase 2 — The lite profile

- [ ] **2.1 Choose the rules and the ceremony to drop — council first.** Run
      `agent-config council:status`, then `/council:analysis` with the nine
      kernel rules, the retro's list of evidenced-helpful controls (test-first,
      evaluator-independence, source-confidentiality, secret-vcs-guard,
      live-state checks, no history rewriting) and the 1.4 inventory. Ask for at
      most five rules and the ceremony controls `lite` turns off. Record the
      verdict as Decisions row D4. Council not configured → the implementer
      picks from the 1.4 ranking and records `resolved by: agent`.
      verify: row D4 exists naming at most five rule ids and the dropped controls.
- [ ] **2.2 Choose the per-repo activation path — council first.** Same
      sequence: council on how one repo runs `lite` while other repos keep
      their profile (candidates: a separate host config directory for that
      repo's sessions, or a project-level settings key the install honours).
      Verify any claim about which directory the host loads rules from with a
      probe session before recording Decisions row D5.
      verify: row D5 names the mechanism and the probe output that confirmed it.
- [ ] **2.3 Add `lite` to the install path, test first.** Add a case to
      `tests/install/discipline_profile_scope.test.ts` asserting that `lite`
      installs exactly D4's rules, drops the other kernel rules, and that
      `off`, `essential` and `full` keep their current sets; watch it fail.
      Then extend `DISCIPLINE_PROFILE_RULES` and the kernel bypass at
      `src/install/rule_scope.ts:164` for `lite` only.
      verify: the new case fails first and passes after; `task test` exits 0.
- [ ] **2.4 Turn off D4's ceremony controls under `lite`, test first.** For
      each control D4 names, add a test proving it does not fire when the
      resolved profile is `lite` and still fires under `essential`; then gate
      it on the profile.
      verify: one passing test per named control; `task test` exits 0.
- [ ] **2.5 Document and regenerate.** Add `lite` to the profile block in
      `src/agent-src/templates/agent-settings.md:55-70` and to any validator
      that enumerates the values; run `task sync` and `task generate-tools`.
      Run `./scripts-run src/scripts/check_kernel_edit_ratified` on the diff;
      if it reds, obtain the artifact through the ADR-268 § 4 ladder
      (independent session, then council).
      verify: `bash src/scripts/condense.sh --changed` -> /Every \.md projection matches its source/ and `check_kernel_edit_ratified` exits 0.
- [ ] **2.6 Make the way back one command, test first.** Add a switch-and-back
      case (lite, then essential) next to the one in
      `tests/install/rule_scoping_global_deploy.test.ts` proving the re-install
      restores every rule `lite` reaped; document the revert command in the
      protocol.
      verify: the case passes and the protocol names the revert command.

## Phase 3 — The pilot

- [ ] **3.1 Activate `lite` for azeroth-companion through D5.** Apply the
      mechanism and start one probe session in that repo.
      verify: the generator's row for the probe session lists at most five package rule files loaded and none of D4's ceremony controls.
- [ ] **3.2 Collect the after window.** <!-- blocked-by: lite-pilot-sample -->
      Re-run the generator after each batch of azeroth sessions and append the
      rows to `agents/evidence/metrics/lite-profile-pilot-after.md`. On a guard
      event, run the 2.6 revert at once and record it.
      verify: `./scripts-run src/scripts/profile_pilot_metrics --repo azeroth-companion --since <activation date> --count` -> /^(1[5-9]|[2-9][0-9]|[1-9][0-9]{2,})$/ (the protocol's minimum sample of fifteen), or the after file carries a guard-event entry plus the revert command's output.

## Phase 4 — The reading

- [ ] **4.1 Read against the protocol.** Generate
      `agents/evidence/metrics/lite-profile-pilot-result.md` from the baseline
      and after files: per metric the medians, the difference and the
      pre-registered verdict, plus the guard outcome. Keep the result scoped to
      one repo and one owner.
      verify: the result file states BETTER, WORSE or INCONCLUSIVE for each of the four metrics and cites the protocol.
- [ ] **4.2 Put the result on the ship blocker.** Update blocker
      `lite-general-ship` below: its Recommendation cites 4.1's verdicts, and
      its If-you-do-nothing line names what stays installed.
      verify: the blocker's Recommendation line contains the result file's path.

<!-- Release holds — none declared.

     guarded: `lite` is opt-in; `full`, `auto`, `essential`, `off` and an absent
     key install exactly what they install today (asserted in 2.3), so every
     intermediate state of Phases 2-4 is publishable.
-->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | The pilot is an observational before/after on real sessions, not a bench run; the bench comparison stays in road-to-a-package-measured-against-no-rules. | measure 16 names a pilot in one repo; the council asked for per-repo pilots with before/after | the owner funds a bench arm for `lite` |
| D2 | deterministic | agent | Frustration is measured as `promptSignal` complaint plus correction counts per 100 owner prompts, not by an LLM rater. | `src/scripts/_lib/feedback_signals.ts:19,60` | the classifier's kinds change |
| D3 | reversible-technical | agent | `lite` never becomes a default inside this roadmap; it is selected only by an explicit key. | owner reserved the ship decision in the retro of 2026-11-21 | blocker lite-general-ship resolves |

## Blockers

### blocker: lite-pilot-sample
- **Status:** open
- **Owner:** external
- **Class:** 0
- **Run:** `./scripts-run src/scripts/profile_pilot_metrics --repo azeroth-companion --since <activation date> --count`
- **Blocks:** Phase 3 — step 3.2, and Phase 4
- **Question:** none — this waits on sessions, not on a decision.
- **Recommendation:** keep working in azeroth-companion as usual; the window fills by itself.
- **If you do nothing:** the pilot never reaches its sample and the hypothesis stays untested.
- **What to do:**
  1. Work in azeroth-companion on the `lite` profile as on any day.
  2. Nothing to report; the generator reads the transcripts.
- **Resolved when:** the Run command prints a session count of at least 15.

### blocker: lite-general-ship
- **Status:** open
- **Owner:** owner
- **Routed:** council 2026-11-21 ESCALATE — product-owned (whether a solo profile ships to consumers is product intent, ADR-268 § 10)
- **Blocks:** shipping `lite` beyond the pilot repo (outside this roadmap's phases)
- **Question:** does `lite` become an offered profile for every consumer, stay a private opt-in, or get removed?
- **Recommendation:** written by step 4.2 from the 4.1 result.
- **If you do nothing:** `lite` stays opt-in, installed only where its key is set; every other install is unchanged.
- **What to do:**
  1. Read `agents/evidence/metrics/lite-profile-pilot-result.md`. <!-- ref-ignore -->
  2. Answer with one of: offer it, keep it opt-in, remove it.
- **Resolved when:** an owner directive naming one of the three answers exists under `agents/evidence/owner-directives/`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A dropped safety rule lets a destructive action through | product | With non-destructive-by-default or secret-vcs-guard outside the five, a push, reset or committed secret can happen in the pilot repo | 2.1 puts the safety floor in the candidate list; 1.5's guard ends the pilot on the first event and 2.6 reverts with one command | Phase 2 — The lite profile |
| 2 | The after window differs in kind of work, not in profile | product | A quieter week of tasks would read as fewer complaints regardless of rules | 1.5 fixes the window and minimum sample before activation; 4.1 scopes the result to one repo and labels it observational | Phase 4 — The reading |
| 3 | The activation leaks into other repos | implementation | A machine-wide install would put every repo on `lite` | 2.2 verifies the per-repo path with a probe session; 3.1 checks the loaded rule set of an azeroth session only | Phase 3 — The pilot |
| 4 | The baseline measures a different install than assumed | implementation | `discipline_profile: off` with 103 installed rule files means the before state is unknown | 1.1 reproduces the resolved settings path and count before 1.3 generates the baseline | Phase 1 — Baseline before anything changes |
| 5 | The kernel bypass weakens other profiles | implementation | Changing the bypass at `rule_scope.ts:164` could drop kernel rules under `off` or `essential` | 2.3 asserts the unchanged sets of `off`, `essential` and `full` in the same test | Phase 2 — The lite profile |

## Acceptance Criteria

- [ ] AC-1 — `discipline_profile: lite` installs at most five package rules and
      none of D4's ceremony controls, while `off`, `essential`, `full` and an
      absent key install their previous sets (tests from 2.3 and 2.4 pass).
- [ ] AC-2 — A pre-registered, generated result file states a verdict for each
      of the four metrics and the guard outcome for azeroth-companion.
- [ ] AC-3 — No list or report this roadmap produced is hand-written: each
      carries the generator command that reproduces it.
- [ ] AC-4 — Blocker `lite-general-ship` carries the result and no other repo's
      install changed.
