---
complexity: structural
status: ready
tree_pin: 811cea61d6
execution:
  mode: autonomous
estate_growth_exempt: "Owner instruction of 2026-11-21 to plan and execute every measure of the session retrospective; this file carries P2 measure 23 plus three small retro findings (owner terms, attribution trailer, scope over-reading) and adds one active roadmap."
estate_offset_exempt: "road-to-resume-after-limit-hits is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
relates:
  - slug: road-to-a-language-pin-from-owner-prose
    relation: disjoint
    note: "Same-retro sibling (measure 2). It owns what sets the language pin (`ownerProse()`, owner-prose-only refusals); this file owns only the shared limit-stop classifier the pin imports (AC-2)."
  - slug: road-to-state-and-pins-across-compaction
    relation: extends
    note: "Same restore family, second re-arm event: it restores after a compaction and its council (1.1) refused injection keyed on session id alone; this file restores after a usage-limit stop inside one uncompacted session and settles its own injection authority in 2.1. No file of its concern is edited here."
  - slug: later/road-to-an-agent-the-owner-does-not-drive
    relation: extends
    note: "Its 4.1/4.2 own a persisted run state and an automatic resume on session_start and post-compaction; its 6.3 owns the commit-msg check for attribution lines. This file carries only the deltas: the limit stop that fires no session_start (Phase 2) and the gh body path plus the startup stub (Phase 4). Neither 4.x nor 6.3 is implemented here."
  - slug: stubs/road-to-a-limit-the-host-actually-signals
    relation: extends
    note: "1.2 here records the transcript shape of real plan- and spend-limit hits from the local store; the stub's hook-event questions (Notification matchers, StopFailure classes, status-line fields) stay its own."
  - slug: archive/road-to-quota-reset-watcher
    relation: disjoint
    note: "Owns run:supervise's quota-parked disposition and leaves unattended relaunch to the council; this file never relaunches, it reacts to the next prompt a human or the host sends."
  - slug: archive/road-to-an-arena-and-a-panel
    relation: extends
    note: "Shipped /arena (owner directive 2026-11-19, D1-D5). Phase 3 here makes the bare word reach that command; it changes nothing about the bracket."
# relates: probe — `agent-config roadmap:context --relates --roadmap road-to-resume-after-limit-hits`
# (2026-11-21) returned `relates: []   # scanned: 1313 roadmap file(s), 0 sibling hits`. The rows
# above come from the semantic half: grep over agents/roadmaps/{*,later,stubs} for 'usage limit',
# 'quota_parked', 'resume', 'co-authored', 'attribution', 'glossary', bodies read.
---
# Road to resume after limit hits

> **Source:** the owner's session retrospective of 2026-11-21 (~380 Claude Code
> sessions across seven repositories, 643 incidents, three audits), measure 23 of
> its P2 list — an automatic resume checkpoint when a usage limit hits, and owner
> terms such as "Arena" made findable as a command — plus three findings listed
> just below its top patterns: the Co-Authored-By trailer appearing despite the
> owner's rule (five dates), and scope read too widely (Workation, Laravel
> overlay). AI council round of the same day (members anthropic and openai, one
> round, analysis mode): it raised no objection to measure 23. Owner constraint
> of the same day: no hand-maintained or owner-written context file — every term
> index, checkpoint and census here is generated from the repository, the
> session transcripts or the hook ledgers.

## Goal

After a usage or spend limit stops a turn, a short `weiter` (or the host's own
reset sentence) is enough: the next prompt receives a generated checkpoint that
says the stop was a limit, names the open dispatches of that session, and tells
the agent to continue them rather than dispatch again. Owner terms that name a
command reach that command, the owner's no-attribution rule wins over the host
reminder on every path, and the scope finding ends in a mechanism or a published
null.

## Prerequisites

- [ ] Read `src/scripts/conformance_scan.ts:508-519`, `src/scripts/_lib/prompt_shape.ts:55-100`,
      `src/scripts/hooks/subagent_ledger_hook.ts:390-475` and
      `src/scripts/hooks/skill_route_hook.ts:1-80` in full before Phase 1.

## Context — verified at `main@811cea61d6` on 2026-11-21

| # | Fact | Where |
|---|---|---|
| F1 | The transcript scan already recognises the spend-limit banner as harness text (`You've hit your`, `Credit balance is too low`), exported for reuse. | `src/scripts/conformance_scan.ts:518-519` |
| F2 | The host's reset sentence `Your claude.ai usage limit has reset. Continue the task…` is classified as a synthetic prompt for the language pin only. | `src/scripts/_lib/prompt_shape.ts:55-70,98` |
| F3 | A `StopFailure` with class `rate_limit` writes a `quota_parked` marker and acts on nothing; that class has not been observed on this machine. | `src/scripts/hooks/host_rate_marker_hook.ts:1-14,33`; `stubs/road-to-a-limit-the-host-actually-signals.md` |
| F4 | Nothing injects anything on the prompt after a limit stop: `quota_parked` is read only by `run_supervise`, `council_cli`, `billing_grant_cli` and `spawn_guard_shadow_hook`. | `grep -rln quota_parked src/scripts` |
| F5 | Open subagent dispatches are on disk per session (`readOpenRecords`), without agent ids by design. | `src/scripts/hooks/subagent_ledger_hook.ts:129,450` |
| F6 | `skill-route` ranks skills only; no command is a routing target. `/arena` exists and `arena` is a discovery verb. | `src/scripts/hooks/skill_route_hook.ts:144`; `src/domains/engineering-base/arena/command.md`; `src/config/discovery/command-verbs.yml:48` |
| F7 | `no-attribution-footers` is tier 3, keyword-triggered, and has no startup contract, so the thinned stub carries no Never line while the host's attribution reminder is always present. | `src/rules/no-attribution-footers.md:1-12`; `grep -c no-attribution-footers src/config/startup-contract-clauses.json` → 0; `src/scripts/_lib/thin_rules.ts:725-745` |
| F8 | The Laravel-overlay half of the scope finding is closed: the code graph moved to a provider registry with 25 providers. | `src/scripts/code_graph/providers/`; commit `fdd1f69ab4` (2026-10-23) |

**Retro evidence (transcript-level, not tree facts):** the resume sentence
"mach weiter wo du warst, genau an den stellen, mit den subagents, so dass weder <!-- md-language-check: ignore -->
du noch die subagents neu beginnen" appears on 55 user lines across five
condensed chunks (21 in one; the synthesis counts about 25 distinct pastes), often right after `You've hit your org's monthly
spend limit`. Co-Authored-By trailers reached commits on 10-11, 10-25, 11-01,
11-04 and 11-08; one PR branch needed a 24-commit message rewrite. The Workation
case (11-18): "offen lassen, nicht anbieten" was implemented as an explicit offer. <!-- md-language-check: ignore -->

**Scope.** Out: unattended relaunch after a reset (`archive/road-to-quota-reset-watcher`),
coupling fan-out to the budget (the `metered-spawn-ask` concern), resume across a
new session (`later/road-to-an-agent-the-owner-does-not-drive` 4.2), and the
`commit-msg` check (its 6.3).

## Phase 1 — One limit classifier, and a baseline

- [ ] **1.1 Pin the classifier.** Add `tests/scripts/limit_stop.test.ts` against a
      stub `src/scripts/_lib/limit_stop.ts` exporting `limitStopOf(tail)` →
      `{kind: 'spend'|'plan'|'reset-prompt'|null}`. Cases: last assistant record
      `You've hit your org's monthly spend limit …` → `spend`; the reset sentence as
      the user record → `reset-prompt`; `API Error: 529` → null; a human prompt
      quoting the banner mid-sentence → null; a banner followed by a human prompt
      already answered → null.
      verify: `npx vitest run tests/scripts/limit_stop.test.ts` fails on the stub.
- [ ] **1.2 Implement it and reuse it in the scan.** Implement `limitStopOf` from
      `HARNESS_TEXT` (F1) and the reset prefix (F2), moving both literals into
      `limit_stop.ts` and importing them back into `conformance_scan.ts` and
      `prompt_shape.ts`. Add a `limit-resume` report to `conformance_scan` (not a
      gate): limit stops, chars of the next human prompt, and `Agent`/`Task`
      dispatches after the stop whose description equals one before it.
      verify: 1.1 passes; `npx vitest run tests/scripts/conformance_scan.test.ts` exits 0.
- [ ] **1.3 Record the baseline.** Run the scan over the local store; write
      counts only to `agents/evidence/analysis/limit-resume-baseline-2026-11.md`
      with pre-registered targets for 5.x: re-dispatches after a stop = 0, a
      checkpoint on ≥ 95 % of prompts that follow a stop.
      verify: the file holds three numbers with their denominators and no prompt text.

## Phase 2 — A checkpoint on the next prompt

- [ ] **2.1 Settle authority and cost.** First action: run the council on two
      questions with 1.3's numbers — does a limit banner as the last assistant
      record of `transcript_path` authorise injection on `user_prompt_submit`
      (contrast: the compaction verdict refused session-id keying), and is a
      bounded tail read per prompt affordable against the slot's p95 budget or
      must a `stop`-time marker gate it. Record D4 and D5.
      verify: D4 and D5 rows present in `## Decisions`.
      uses: ai-council
- [ ] **2.2 Pin the concern.** Add `tests/hooks/limit_resume_hook.test.ts`: a
      transcript fixture ending in a spend banner plus prompt `weiter` → one context
      block naming the limit and the session's open dispatch count from
      `readOpenRecords`; the same prompt without a banner → no output; a second
      prompt → no output (consume-once by banner record id); kill switch
      `AGENT_CONFIG_NO_LIMIT_RESUME=1` → no output.
      verify: the test fails before 2.3.
- [ ] **2.3 Ship `limit-resume`.** Implement `src/scripts/hooks/limit_resume_hook.ts`
      per D4/D5, register it in `src/scripts/hook_manifest.yaml` on
      `user_prompt_submit` (claude first, lazy chunk), effect `context`,
      `fail_closed: false`. The block says: the stop was a limit, not a choice;
      continue the interrupted step; open dispatches continue through their ids,
      never a fresh dispatch. Then `npm run build:hooks`.
      verify: 2.2 passes; `./scripts-run src/scripts/check_hook_bundle_composition`
      exits 0; the byte delta is recorded in `src/config/hook-bundle-budget.json`.

## Phase 3 — Owner terms reach their command

- [ ] **3.1 Pin the miss.** Add a case to `tests/hooks/skill_route_hook.test.ts`:
      prompt "starte eine Arena für die drei Entwürfe" → output names `/arena`.
      verify: the case fails today (F6).
- [ ] **3.2 Choose the carrier.** First action: run the council — commands as
      targets inside `skill-route`'s ranker versus a sibling `command-route`
      concern — with the measured cost of each on the routing-matrix corpus.
      Record D6. Either way the index is generated at build time from command
      frontmatter (`name`, `cluster`, `intent`) and `command-verbs.yml`; no
      hand-written glossary.
      verify: D6 present.
      uses: ai-council
- [ ] **3.3 Implement per D6.** Make 3.1 green and add a test that a command added
      to a fixture tree enters the index without any other edit.
      verify: `npx vitest run tests/hooks/skill_route_hook.test.ts` exits 0;
      `./scripts-run src/scripts/check_hook_bundle_composition` exits 0.
- [ ] **3.4 Generated term census.** Add `src/scripts/owner_term_census.ts`: over the
      local transcript store, count human prompts containing a command name or
      cluster as a bare word and whether the route fired; output counts per term,
      never prompt text. Write `agents/evidence/analysis/owner-term-census-2026-11.md`.
      verify: `npx vitest run tests/scripts/owner_term_census.test.ts` exits 0 and the
      file lists `arena` with a count.

## Phase 4 — The owner's attribution rule wins on every path

- [ ] **4.1 Pin the gh path.** Add `tests/scripts/attribution_lines.test.ts` for
      `attributionLines(text)` in `src/scripts/_lib/attribution_lines.ts`:
      `Co-Authored-By: Claude …`, `🤖 Generated with [Claude Code]`, an
      `augmentcode.com` footer → hits; a human `Co-authored-by: <person>` → no hit.
      verify: fails against the stub.
- [ ] **4.2 Decide the reaction.** First action: run the council on the
      `pre_tool_use` reaction to `gh pr create|edit|comment` and `git commit -m`
      bodies carrying a hit — refuse with the stripped body as the retry, or
      advise — weighing retro measure 10 (gates that trap the agent). Record D7.
      Implement per D7 with a dispatcher test per branch; the `commit-msg` hook
      stays with 6.3 of the relates row.
      verify: tests pass; `check_hook_bundle_composition` exits 0.
      uses: ai-council
- [ ] **4.3 Give the rule a startup contract.** Add `no-attribution-footers` to
      `src/config/startup-contract-clauses.json` with its Iron Law clauses, then
      `task sync` and `task generate-tools`.
      verify: `./scripts-run src/scripts/check_startup_contracts` exits 0; a
      `build_thin` test shows the stub carries a Never line; `bash src/scripts/condense.sh --changed` lists nothing.

## Phase 5 — Outcome and the scope finding

- [ ] **5.1 Scope over-reading: mechanism or null.** First action: run the council
      on the Workation case and the extra-folders case (F8 closes the Laravel
      half) — is "leave open / do not offer" read as an offer detectable from a
      diff or a reply, or is it a published null. Record D8 in
      `agents/evidence/analysis/scope-over-reading-2026-11.md`.
      verify: the evidence file names the verdict and its reason.
      uses: ai-council
- [ ] **5.2 Act on D8.** On "mechanism": add the detector's failing fixture under
      `tests/hooks/`, then the advisory concern D8 specifies, registered like 2.3.
      On "null": append the reopen condition to the 5.1 file and change nothing else.
      verify: mechanism → `npx vitest run tests/hooks` exits 0 and
      `check_hook_bundle_composition` exits 0; null → `grep -c '^## Reopen if' agents/evidence/analysis/scope-over-reading-2026-11.md` -> 1
- [ ] **5.3 Read the outcome.** After the window in `## Blockers`, rerun the
      `limit-resume` report and `owner_term_census`; append `## Reading after
      landing` to both evidence files against the 1.3 targets.
      verify: `grep -c '^## Reading after landing' agents/evidence/analysis/limit-resume-baseline-2026-11.md` -> 1

<!-- Release holds — none. No intermediate tree state of this roadmap is unpublishable.

     guarded: the classifier (1.2) only reports; limit-resume (2.3) emits context
     only, has a kill switch and lands with its test; routing (3.3) adds a pointer
     line; the attribution reaction (4.2) lands with its tests in one step. Each
     phase leaves the tree releasable.
-->

## Blockers

### blocker: limit-hits-after-landing
- **Status:** open
- **Owner:** implementer
- **Blocks:** 5.3
- **Recommendation:** read 5.3 once the local store holds at least 10 limit stops after 2.3 merged; nothing else waits on it.
- **If you do nothing:** the checkpoint works but its effect on re-dispatches stays unmeasured.
- **What to do:** run `./scripts-run src/scripts/conformance_scan --json` and `./scripts-run src/scripts/owner_term_census`, then append the readings.
- **Resolved when:** the local store holds ≥ 10 limit stops dated after the 2.3 merge.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Every term index, checkpoint and census is generated from repo, transcripts or ledgers; no hand-written glossary or context file. | owner constraint 2026-11-21 | the owner lifts the constraint |
| D2 | reversible-technical | agent | The checkpoint never relaunches and never dispatches; it only informs the next prompt's turn. | `archive/road-to-quota-reset-watcher` left unattended relaunch to the council | the council authorises unattended relaunch |
| D3 | deterministic | evidence | The Laravel-overlay half of the scope finding needs no work. | F8 | a framework-specific module reappears outside `providers/` |

D4-D8 are written by steps 2.1, 3.2, 4.2 and 5.1 from their council verdicts.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The checkpoint fires on a quoted banner | implementation | A human pasting a limit message would get a resume block and the agent would continue work it was told to stop. | Anchored match on the last assistant record only, consume-once, a human-quote case in 1.1, kill switch in 2.2. | Phase 2 — A checkpoint on the next prompt |
| 2 | A per-prompt transcript read slows every turn | implementation | Reading the tail on each `user_prompt_submit` costs latency in the busiest slot. | 2.1 measures the read against the p95 budget and may gate it on a `stop`-time marker. | Phase 2 — A checkpoint on the next prompt |
| 3 | A host rewording silently disables detection | product | The banner and reset strings are fixed host text; a change makes the classifier miss every stop. | Under-detection falls back to today's behaviour; 5.3's census shows a zero-count drift. | Phase 1 — One limit classifier, and a baseline |
| 4 | Command routing adds noise | implementation | Commands as targets could fire on ordinary words and hand the agent wrong pointers. | 3.2 measures fire rate on the routing-matrix corpus before choosing; pointers only, never bodies. | Phase 3 — Owner terms reach their command |
| 5 | An attribution refusal traps the agent | product | A blocking check on `gh` bodies repeats the friction retro measure 10 removes. | 4.2 puts refuse versus advise to the council; a refusal ships the stripped body as its retry. | Phase 4 — The owner's attribution rule wins on every path |

## Acceptance Criteria

- [ ] AC-1 — On a fixture session stopped by a spend limit, the prompt `weiter` receives one checkpoint naming the limit and the open dispatch count, and a second prompt receives none (2.2).
- [ ] AC-2 — One classifier serves the hook, the scan and the language pin; no second copy of the banner or reset literal exists in `src/scripts` (1.2; `grep -rn "You've hit your" src/scripts` hits only `limit_stop.ts`).
- [ ] AC-3 — "starte eine Arena …" routes to `/arena`, and a new command enters the index without a hand edit (3.3).
- [ ] AC-4 — A `gh pr create` body or `git commit -m` message with an AI attribution line is handled per D7, and the installed `no-attribution-footers` stub carries its Never line (4.2, 4.3).
- [ ] AC-5 — The scope finding is closed by a mechanism with its test or by a published null (5.1).
- [ ] AC-6 — `task ci` exits 0 on the branch carrying each phase.
