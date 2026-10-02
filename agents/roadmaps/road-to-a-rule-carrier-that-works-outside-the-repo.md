---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-c reproduced, at HEAD, that the prompt-submit rule carrier delivers nothing outside this repository (router and bodies resolve from the session cwd), and that where it does fire a third of the composed strings exceed the host's 10,000-char cap. Every consumer runs it in someone else's project, so it is the precondition for thinning the installed layer the host warns about; no active roadmap owns the carrier, and parking one to buy the slot would leave the 338,225-char installed layer with no route down."
relates:
  - slug: road-to-instructions-loaded-observer
    relation: extends
    note: Stub. Step 0.2 here is its step 3.0, taken as a precondition rather than a fork input.
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: Active. Its Phase 3 reads the delivered-row ledger `rule_inject_hook.ts:281` writes; step 1.7 here moves the seen-set and must keep that join working.
  - slug: road-to-delivery-on-hook-hosts
    relation: disjoint
    note: Later. It owns non-Claude hosts and the injection-effect row; this file changes only the Claude carrier.
  - slug: road-to-rule-triggers-and-links-that-hold
    relation: disjoint
    note: Same round. That file repairs what installed rules declare and link to.
---
# Road to a rule carrier that works outside the repo

> **Source:** `agents/tmp.old/inbox-2026-10-c/` — a round of four roadmap drafts
> and one transcript on the host's 150k instruction-budget notice, pinned to
> `main` @ `9bc8cd4f2` (16.2.0). Verified against `main` @ `a03f60c46` on
> 2026-10-01; only documentation changed between the two. The round's council
> record is `agents/evidence/council/inbox-2026-10-c-standing-form.md`.

## Goal

The prompt-submit rule carrier delivers, in a project that is not this
repository, exactly the rules the install carries, in the form the host loads,
in a string the host does not replace — and says which ones it could not send
in full. Done means: an empty consumer project receives a rule body on a
matching prompt, no composed string exceeds the per-string budget across the
frozen corpus, no match is dropped without a pointer, and the installer,
projector and carrier agree on the delivery mode in every settings state.

This roadmap changes no installed file. Thinning the installed layer is
`road-to-an-installed-layer-that-is-thinned`, which may not start before this
file's Phase 1 has merged.

## Context

Reproduced on 2026-10-01:

- **Silent outside the repo.** `loadRouter` reads `<repoRoot>/dist/router.json`
  and `ruleBodyPath` resolves bodies under the same root
  (`src/scripts/_lib/rule_injection.ts:75-76`, `:167-168`); the hook passes
  the envelope's directory or `process.cwd()` (`rule_inject_hook.ts:185-186`).
  `dispatch_hook.ts:722` already passes `AGENT_CONFIG_PACKAGE_ROOT` to every
  concern, and this concern does not read it.
- **Over the cap where it fires.** `CAP_BYTES` is 16,384
  (`rule_inject_hook.ts:165`); the host replaces `additionalContext` above
  10,000 characters with a path and a 2,000-character preview. The draft's
  bundle run measured 109 of 323 composed strings over 10,000. The selector's
  `dropped` list is never read (`:315-322`), so dropped bodies are not
  announced.
- **Two mode readers.** The projector resolves through `load_agent_settings`
  with the shipped template as base (`condense.ts:463-464`,
  `_lib/agent_settings.ts:10-16`) and reads `delivery`; the hook reads only
  `<cwd>/.agent-settings.yml` (`_lib/hook_settings.ts:20`, `:89-91`) and
  falls back to `eager-all`. The installer has its own read
  (`install.ts:311-314`). `lean_projection_mode.ts:8-10` names this disagreement
  as the defect it exists to prevent.
- **No scope filter.** 13 router tier rules are maintainer-only by
  `workspaces`; neither hook file reads `workspaces`. `augment-edit-discipline`
  (keywords `rename`, `delete`) would reach consumers once the router is
  reachable.
- **Frontmatter in the payload.** `loadRuleBody` returns the raw file
  (`_lib/rule_injection.ts:172-175`).
- **Reach.** `model_rule_injection` reads 305/335 with open files ignored and
  333/335 honoured; the shipped binding never populates open files
  (`rule_inject_hook.ts:405-416`).
- **State in the consumer tree.** The seen-set is written under
  `<cwd>/agents/runtime/state/rule-inject/` (`:195-197`).
- **Compaction.** The concern's header says a rule whose trigger does not recur
  "is NOT restored" (`:63`); there is no `session_start` binding.
- **Truth surfaces.** `docs/CLAIMS.md:365` still says shipped reach 98/101 where
  `model_rule_injection --endpoints` prints 99/102; `README.md:125` and `:186`
  state opposite default scopes; ADR-228 is `accepted` with no successor while
  `claudeRuleRewrite.ts:213` emits `paths:` on the global layer;
  `check_standing_rule_delivery.ts:34-40` says CI cannot observe a user-scope
  install; a temporary-`HOME` install observes one in CI.

## Phase 0 — Instruments, no behaviour change

- [ ] **0.1 An installed-layer report in the host's unit.** Install into a
      temporary `HOME` and report per host rule directory: files,
      unconditional files, characters after frontmatter and block-comment
      strip, the 20 largest files, package-owned against foreign files, scope
      and host version. One library behind the report, CI, `doctor` and the
      upgrade receipt. Report-only here; the header of
      `check_standing_rule_delivery` is corrected in the same change. A fixture
      that adds one unscoped 5,000-character rule must move both the file and
      the character count.
      verify: `npx vitest run tests/scripts/installed_layer_report.test.ts` -> 0
- [ ] **0.2 Bind the host's instruction-load event as an observer.** Step 3.0 of
      `stubs/road-to-instructions-loaded-observer.md`, non-blocking, recording
      path, scope and load reason only — never file content. Its first session
      record answers: does a user-layer rule with `paths:` load on a path match;
      does it load on `Read`, `Edit`, a `Write` that creates the file, and a
      Bash-first edit; which files reload after compaction; does the count
      equal 0.1's.
      verify: `npx vitest run tests/scripts/instructions_loaded_observer.test.ts` -> 0
- [ ] **0.3 Count what the host sees.** At the dispatcher, on the composed
      string, in characters: over-budget count, and per delivered rule its
      form (`body`, `law`, `pointer`) and arrival level. Arrival levels are
      A0 discoverable (a file or pointer exists), A1 routed (a trigger
      matched), A2 arrived (the obligation text is in context, observed), A3
      enforced (a gate blocks the forbidden outcome). A pointer is never
      recorded above A1.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t arrival` -> 0
- [x] **0.4 Prompt-only reach beside mechanism reach.** Add the per-prompt pair
      (305 against 333 of 335) to `model_rule_injection --endpoints` and to the
      `non_inference` of the claim at `docs/CLAIMS.md:368`.
      verify: `./scripts-run src/scripts/model_rule_injection --endpoints | grep -c 'open_files'` -> /^[1-9]/

      **Done 2026-10-02, and the pair came in three numbers rather than two.**
      `--endpoints` now prints the per-prompt reach beside the per-rule one, and
      the claim's `non_inference` carries both units with the warning that they
      are not interchangeable. The third number is a finding: the per-prompt pair
      computed here reads **307/335 ignored against 335/335 honoured**, while the
      SUMMARY view of the same script over the same corpus reads **305/335 and
      333/335**. The cause is located, not guessed — `scoreExact`
      (`model_rule_injection.ts:202`) calls `matchTierRules(router, c.prompt, of)`
      with three arguments and drops the case's `command`, so a positive whose
      rule is reached by a `command:` trigger scores as a miss there and as a hit
      in the endpoints view. Both readings are printed with the cause named,
      rather than one being silently preferred; repairing `scoreExact` is a
      behaviour change and Phase 0 makes none.
- [x] **0.5 Truth surfaces.** `docs/CLAIMS.md:365` and `:368`, and
      `agents/evidence/analysis/payload-three-number-split-2026-09.md:18` and
      `:51`, state they were measured on a project-scope tree; `:365`'s 98/101
      becomes the current reading; one of `README.md:125` / `:186` goes;
      ADR-228 gains a successor note naming `claudeRuleRewrite.ts:213`.
      verify: `./scripts-run src/scripts/check_claims` -> 0

      **Done 2026-10-02, item by item.**

      - `docs/CLAIMS.md` — the `thin-inject-delivery-equivalence` row's
        `non_inference` now opens with the project-scope statement: every figure
        in it is the reach of the MAINTAINER checkout, because
        `model_rule_injection` resolves router and bodies from the repository
        root it runs in. It says in the same breath that no number there licenses
        a statement about a consumer until this file's Phase 1 merges.
      - The stale `98/101` is now `99/102 as of 2026-10-02`, with the old reading
        kept and dated rather than overwritten — the corpus gained a labelled
        rule, so the two are not a correction of each other.
      - `payload-three-number-split-2026-09.md` carries the same scope statement
        above its table, with the number that makes it concrete: the round's real
        install into an empty `HOME` measured 338,225 characters against row 2's
        24,537, about fourteen times, because the installer does not read
        `lean_projection` at all.
      - ADR-228 gains a successor note naming `claudeRuleRewrite.ts:213` and the
        call site that reaches the global layer (`install.ts:3034`,
        `tool_id === 'claude-code'`). The note does NOT reverse the decision or
        change the status: the record rejected emitting for the DIVERGING set
        while the code emits for every path-shaped plan, so it is possible both
        are intended and only the title is wrong. What it removes is the silence.
      - `README.md` — **nothing to remove.** The step expected two contradicting
        default-scope statements at `:125` and `:186`; at this HEAD only one
        survives (`:188`, global-only per ADR-020), and a grep for every other
        scope statement finds only `--project` rows in the command table, which
        describe a flag rather than claim a default. Fixed before this run, and
        recorded as checked rather than silently dropped.

> **Phase 0 state after the 2026-10-02 run: 0.4 and 0.5 closed, 0.1 to 0.3 not
> started.** The three open steps are each a new instrument — an installed-layer
> report run against a temporary `HOME`, a binding of the host's instruction-load
> event, and an arrival-level counter at the dispatcher — and starting one
> without finishing it would leave a half-wired measurement that reads as
> coverage. They are untouched rather than partially built, which is the state a
> later run can act on without first undoing anything.

## Phase 1 — A carrier that works where consumers are

- [ ] **1.1 Resolve from the package.** Router and bodies resolve from
      `AGENT_CONFIG_PACKAGE_ROOT`, with `agents/overrides/` keeping precedence;
      no root found → fail closed with one diagnostic line, never a silent
      empty delivery.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t foreign-project` -> 0
- [ ] **1.2 One answer to "which mode".** Installer, projector and hook call one
      resolver over the same layers in the same order — template base,
      canonical `agents/settings/`, project root, user-global. With no settings
      file anywhere the resolver returns the template's value, and the
      template's value is stated in the test.
      verify: `npx vitest run tests/scripts/lean_projection_mode_parity.test.ts` -> 0
- [ ] **1.3 Deliver only what the install carries.** A rule with no file in the
      host's installed rule directory is not delivered. One source of truth for
      scope.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t scope` -> 0
- [ ] **1.4 The host form.** Delivered text has frontmatter and block comments
      stripped, by the same parser the thin projector uses.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t host-form` -> 0
- [ ] **1.5 A delivery the host does not replace, and that hides nothing.** The
      rule-produced string stays under 8,000 characters (D2), in the order D1
      fixes; the high-consequence class is the one
      `road-to-rule-laws-that-can-stand` step 2.1 declares, empty until it lands.
      Every match appears in a manifest labelled `full`, `law`,
      `omitted_budget` or `source_unavailable`; a path alone is never labelled
      delivered. A rule whose law section alone does not fit is reported, never
      truncated. `hook-token-budget.json`'s `rule-inject` row (`:35`) is
      restated in characters.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t composed-budget` -> 0
- [ ] **1.6 Re-deliver after compaction.** On the session-start slot with source
      `compact`, emit the law section of each rule in the pre-compaction
      seen-set, under the same budget. The seen-set keeps rule ids, never body
      copies.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t compact` -> 0
- [ ] **1.7 State leaves the consumer's tree.** The seen-set moves under the
      global root, keyed by project; the delivered-row ledger that
      `road-to-a-stop-that-holds` reads keeps its join. The installer writes the
      package's ignore block on the `--no-ui` path so dispatcher state under
      `agents/` does not appear as untracked files.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t state-location` -> 0
- [ ] **1.8 A foreign-project matrix.** End to end on the built bundle: empty
      project, project with its own `.claude/rules`, package moved after
      install, no source checkout, cwd changed mid-session, maintainer scope,
      settings absent, settings `eager-all`, settings `delivery`.
      verify: `npx vitest run tests/scripts/rule_inject_foreign_matrix.test.ts` -> 0

## What this roadmap deliberately does not do

- No change to any installed rule file. A flip before Phase 1 turns
  over-delivery into under-delivery for every consumer.
- No second router, no `context:*` command cluster: the prompt router,
  `route:explain` and `route:audit` exist.
- No `claudeMdExcludes` suppression: before 1.1 it removes bodies nothing
  delivers back.
- No rule-retrieval MCP server (`road-to-skill-delivery-over-mcp` closed
  measured-null).

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:inbox-2026-10-c-standing-form | Delivery order in 1.5: matched high-consequence laws, then the highest-priority full body that fits, then further bodies, then laws of the rest, then a manifest | Both seats, 2/2; P-1's form peaked at 8,873 chars, so the order decides what an 8,000 budget keeps | 0.3 shows a match labelled `law` that the observer does not see loaded |
| D2 | contested-technical | council:inbox-2026-10-c-standing-form | 8,000 chars on the whole rule-produced string, framing and manifest included | Both seats; leaves ~2,000 under the 10,000 host cap beside the 1,272 chars of non-rule text measured on the slot | The host's cap, preview size or composition semantics change |
| D3 | reversible-technical | agent | One resolver, not a parity test between three | A parity test keeps three readers that can drift again; `lean_projection_mode.ts` already exists to be the one | — |
| D4 | reversible-technical | agent | Arrival levels are named A0–A3 | The draft set used R0–R4 for both size rungs and arrival levels; two meanings under one label is how a pointer gets counted as arrival | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The carrier starts delivering into every consumer session | product | 1.1 turns a silent concern into a live one; a wrong trigger now costs real context in someone else's project. | 1.3 limits delivery to installed rules, 1.5 caps the string, and the installed layer is still eager, so nothing is lost if a delivery is wrong — only duplicated. | Phase 1 — A carrier that works where consumers are |
| 2 | One mode resolver changes the projector's answer | implementation | Making the hook agree with the projector could also move the projector. | 1.2's test states the template value and every layer's expected result before the code changes. | Phase 1 — A carrier that works where consumers are |
| 3 | The installed-layer report reads a host rule the host does not count | implementation | Which files the host sums is inferred, not documented. | 0.2's first record compares its load count with 0.1's. | Phase 0 — Instruments, no behaviour change |

## Acceptance Criteria

- [ ] AC-1 — In a project that is not this repository, the built bundle delivers
      a matching rule and only rules the install carries.
- [ ] AC-2 — No composed string over the D2 budget across the frozen corpus, and
      no match absent from a delivery.
- [ ] AC-3 — Installer, projector and carrier return the same mode in every
      fixture of 1.2.
- [ ] AC-4 — The installed-layer report and the arrival record exist and every
      truth surface in 0.5 names the scope it was measured on.
