---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-c reproduced, at HEAD, that the prompt-submit rule carrier delivers nothing outside this repository (router and bodies resolve from the session cwd), and that where it does fire a third of the composed strings exceed the host's 10,000-char cap. Every consumer runs it in someone else's project, so it is the precondition for thinning the installed layer the host warns about; no active roadmap owns the carrier, and parking one to buy the slot would leave the 338,225-char installed layer with no route down."
estate_growth_exempt: "open_blockers 60 -> 61: this change records hook-bundle-ceiling-exhausted, and the blocker is a discovery rather than a deferral. The composed hook bundle measured 1,549,697 B against a 1,550,000 B ceiling on main, and step 1.4 of this file - two lines reusing the parser the thin projector already calls - was written, built and measured at +396 B, 357 B over. The lane paid 2,822 -> 1,628 B on its own resolution, tree-shook 2,122 B of superseded readers, and gave back a further 148 B after merging main, which is every byte it had; the remaining five steps need runtime code and there is none to spend. Raising the ceiling is an owner call on a shrink-only ratchet, so the finding cannot be closed from here and recording it is the honest alternative to shipping five steps as silently unstarted. It is also not a private cost: main went from 303 to 170 bytes of headroom in one day when #2179 landed, so the next lane to touch any concern meets the same wall and this row is where it will look."
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

- [x] **0.1 An installed-layer report in the host's unit.** Install into a
      temporary `HOME` and report per host rule directory: files,
      unconditional files, characters after frontmatter and block-comment
      strip, the 20 largest files, package-owned against foreign files, scope
      and host version. One library behind the report, CI, `doctor` and the
      upgrade receipt. Report-only here; the header of
      `check_standing_rule_delivery` is corrected in the same change. A fixture
      that adds one unscoped 5,000-character rule must move both the file and
      the character count.
      verify: `npx vitest run tests/scripts/installed_layer_report.test.ts` -> 0

      **Done 2026-10-05, and the number it produces is comparable with nothing
      that was already here.** `_lib/installed_layer.ts` reads every host rule
      directory in both scopes — the five in `GLOBAL_RULE_DIRS` and the five in
      `PROJECT_RULE_DIRS` — and reports files, unconditional files, characters
      after the strip, the 20 largest, package-owned against foreign, scope and
      host version. `installed_layer_report.ts` is the CLI; `--home` and
      `--project` point it anywhere.

      **The measurement did not exist in this tree before.** Every published
      figure for the installed layer counts raw bytes of whole files:
      `censusRuleDir` sums `statSync().size`, `charsAtRoot` does the same for a
      directory, and `check_preamble_payload_budget` reads both. A host loads
      neither the frontmatter (the routing surface the router already read) nor
      the HTML comments (authoring scaffolding nothing renders), so the strip
      this uses — `rule_law_section.ruleBody`, the projector's and the carrier's
      own — produces a number strictly smaller than every baseline in
      `budgets.yml` or the payload ratchet, by a margin that is whatever that
      corpus spends on frontmatter. The library says so in its own header rather
      than leaving a reader to discover it holding the two side by side.

      **Reading on the maintainer machine, 2026-10-05:** 593 files, 590
      unconditional, 1,960,380 characters across five hosts in two scopes.
      `claude-code (global)` is the one layer where unconditional is not equal
      to files — 105 files, 102 unconditional — which is ADR-228's successor
      note made visible: `claudeRuleRewrite.ts:213` emits `paths:` on the global
      layer for three rules.

      **The step's own fixture, both halves.** One unscoped 5,000-character rule
      moves files by 1 and characters by 5,000; the negative half — a SCOPED
      5,000-character rule — moves characters by 5,000 and the unconditional
      count by 0, which is what stops `unconditional` being satisfied by a
      counter that returns the file count. Sensitivity checked: replacing the
      strip with the raw file length reds 9 of 17 cases.

      **The header of `check_standing_rule_delivery` is corrected, and so are
      its two copies.** It said "no CI workflow performs a user-scope install"
      and concluded that CI-observability "needs the `InstructionsLoaded` record
      committed from a real session". The first is a workflow inventory; the
      second turns it into a capability claim, and
      `tests/install/global_install_hooks_smoke.test.ts` already drives the real
      installer against a `mkdtemp` HOME. What survives is narrower and true:
      the gate measures a MACHINE rather than a commit, so a CI run would report
      the runner. `taskfiles/dev.yml` and the test's own comment carried the same
      claim and are corrected with it.

      **Two things this deliberately does NOT do.** It is not named `check_*` —
      `_lib/gate_population.ts` enters any such script into the gate population
      and the ledger then owes it a per-target accounting, which is the wrong
      contract for an instrument and is `rule_activation_census`'s own stated
      reason for the same choice. And `.mdc` files read as zero, which is the
      blind spot every other census here has; fixing it in one reader would
      produce two counts that disagree.
- [ ] **0.2 Bind the host's instruction-load event as an observer.** Step 3.0 of
      `stubs/road-to-instructions-loaded-observer.md`, non-blocking, recording
      path, scope and load reason only — never file content. Its first session
      record answers: does a user-layer rule with `paths:` load on a path match;
      does it load on `Read`, `Edit`, a `Write` that creates the file, and a
      Bash-first edit; which files reload after compaction; does the count
      equal 0.1's.
      verify: `npx vitest run tests/scripts/instructions_loaded_observer.test.ts` -> 0

      **BLOCKED on an owner decision, 2026-10-05 — and the block is a recorded
      council refusal, not a missing capability.** The bundle ceiling that held
      Phase 1 is NOT what stops this: measured this run with the gate's own
      command, `origin/main` @ `24d6d5b0d` reads **1,508,987 B / 1,550,000**,
      which is **41,013 B** of headroom. A concern for this slot fits many times
      over.

      What stops it is `standing-context-40k-disposition.md:94-96`, which
      refuses disposition **D** (execute the binding now) on Rule-3 grounds:
      *"registration emits install settings, so it changes what the installer
      writes into a consumer's `.claude/settings.json`."* That is a
      shipped-default change, and the record calls Rule 3 categorical
      (`:46`).

      **Mechanically confirmed rather than taken on the label.**
      `build_claude_hook_matrix` (`src/scripts/_lib/claude_settings_hooks.ts:92`)
      iterates `native_event_aliases.claude` and emits a row only where
      `platforms.claude[<event>]` carries concerns, and
      `claude_settings_hooks.ts` writes that matrix into the consumer's
      settings file. A probe adding both halves to a copy of the manifest moved
      the matrix from **10 native events to 11**, the added key being
      `InstructionsLoaded`. The probe was removed with `rm`.

      **The baselines the stub pins, re-read this run with controls, because a
      zero that is really a broken grep is the failure this step would inherit:**

      ```
      grep -c '"instructions_loaded"' src/scripts/hooks/dispatch_hook.ts   # 0
      grep -c '"user_prompt_submit"'  src/scripts/hooks/dispatch_hook.ts   # 1  (control)
      grep -c 'InstructionsLoaded'    src/scripts/hook_manifest.yaml       # 0
      grep -c 'UserPromptSubmit'      src/scripts/hook_manifest.yaml       # 4  (control)
      ```

      Both zeroes are real: the controls return non-zero on the same files with
      the same tool.

      **The second obstacle, measured rather than assumed, because the first one
      lifting would not be enough.** Two more things stand behind the Rule-3
      refusal, and an owner answering only the settings question would meet them
      next:

      1. **The exit condition needs a LATER session, and no repository
         automation can supply one.** The step reads *"Its first session record
         answers …"*; binding takes effect at session start, so a session cannot
         observe its own registration — the stub states this as its own reason
         for not splitting 3.0. A `vitest` file can hold the recorder's shape;
         it cannot hold a fire. This is the capability-gated shape
         `stubs/README.md` describes, and it is why the `verify:` above can go
         green on a build that has never received the event.
      2. **The test surface is larger than the stub's estimate.** The stub sized
         it at "a ~24-file test surface on `hook_manifest.yaml`";
         `grep -rl "hook_manifest" tests/ | wc -l` reads **57** this run. The
         estimate is not wrong so much as stale, and the cost of the binding
         should be re-sized against 57 before it is scheduled.

      **The exact edits, so an owner who says yes does not have to re-derive
      them.** Anchors by `grep -n` rather than by line number, because four
      stale anchors have been found in this round:

      - `grep -n '^  claude:' src/scripts/hook_manifest.yaml` → two hits; the
        FIRST is `platforms.claude`, the SECOND is
        `native_event_aliases.claude`. Under the first, beside the existing
        `session_start:` row, add the concern list:

        ```yaml
            instructions_loaded: [rule-inject-observer]
        ```

        Under the second, beside `UserPromptSubmit:  user_prompt_submit`, add:

        ```yaml
            InstructionsLoaded: instructions_loaded
        ```

      - `grep -n 'EVENT_VOCABULARY' src/scripts/hooks/dispatch_hook.ts` → add
        `"instructions_loaded"` to that set.

      - The kill switch the council made non-optional
        (`standing-context-40k-disposition.md:98-100`): the binding must be
        independently removable and rolled back on hook failures, duplicate
        events, a material session-start regression, or unexplained downstream
        test breakage.

      **The command that flips the condition** is not a command — it is the
      owner answering one question: may a Phase-0 instrument change what the
      installer writes into a consumer's `.claude/settings.json`? Yes → the
      edits above, then re-size against the 57-file surface, then a live session
      to fill the record. No → 0.2 stays open and AC-4 is unaffected, because
      AC-4 names the installed-layer report and the arrival record and not this
      observer.
- [x] **0.3 Count what the host sees.** At the dispatcher, on the composed
      string, in characters: over-budget count, and per delivered rule its
      form (`body`, `law`, `pointer`) and arrival level. Arrival levels are
      A0 discoverable (a file or pointer exists), A1 routed (a trigger
      matched), A2 arrived (the obligation text is in context, observed), A3
      enforced (a gate blocks the forbidden outcome). A pointer is never
      recorded above A1.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t arrival` -> 0

      **Done 2026-10-05, and A1 turned out to be reachable two ways.** The
      record is written at `emit()` — the one place a delivery reaches the host,
      shared by the fire and the compaction restore — and carries, per fire:
      `chars` (the composed string in CHARACTERS, the unit the host's own
      replacement threshold is stated in), an `over_budget` column whose sum is
      the count this step asks for, the slot, and one row per matched rule with
      its form and its arrival level.

      **The forms are three where the manifest has four, deliberately.**
      `omitted_budget` and `source_unavailable` are different REASONS for the
      same outcome — an id and no text — so `arrivalForm` collapses them to
      `pointer`. The manifest keeps the distinction because a consumer
      diagnosing a broken install needs the reason; a reader counting arrivals
      does not.

      **The two ways to stay at A1 are the finding.** One is the step's own
      sentence taken literally: a pointer never carried text. The other is not
      in the step and this run settled it — a composed string over
      `HOST_REPLACE_CHARS` (10,000) carried text that the host then substituted
      with a path and a 2,000-character preview, so every row in that fire is A1
      however good its form looks. Recording those as A2 would be the instrument
      reporting its own intent instead of the outcome, which is the one thing a
      measurement of arrival must not do. 1.5 means `compose` cannot produce
      such a string today, so that case is driven through `arrivalRecord`
      directly; a fixture that went through `compose` would be asserting the
      branch is unreachable rather than that it is right. The boundary is
      asserted on both sides — exactly 10,000 is A2, 10,001 is A1.

      **A0 and A3 are never written, and both omissions are asserted rather than
      commented.** A0 is the level of a rule that never routed, and this concern
      only ever sees rules that did; writing A0 rows would mean a per-turn sweep
      of the router to record the absence of an event. A3 belongs to whatever
      gate refuses the outcome — a carrier recording its own delivery as
      `enforced` would be the emitter-record-read-as-compliance mistake the
      delivered-row ledger carries a council lock against.

      **Where it lands.** Beside the seen-set under the user-global root, keyed
      by project, for the reason 1.7 moved that one: a measurement about a
      session is not state about the project. JSONL and append-only, so a torn
      last line costs that line and not the rows before it (asserted). The
      delivered-row ledger stays where `road-to-a-stop-that-holds` Phase 3 joins
      on it, untouched.

      **Cost and sensitivity.** 1,156 B of hook bundle, measured with the gate's
      own command: 1,508,987 → 1,510,143 against a 1,550,000 ceiling. Removing
      the pointer cap reds "a pointer is never recorded above A1" and nothing
      else.
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

> **Phase 0 state after the 2026-10-05 run: 0.1, 0.3, 0.4 and 0.5 closed; 0.2
> open on an owner decision.** The two instruments this run built are the two
> that could be built: the installed-layer report and the arrival record are
> both measurements over things this repository already has, so a fixture can
> drive them end to end. 0.2 is the one that cannot, and for a reason that is
> recorded rather than discovered — `standing-context-40k-disposition.md`
> refuses the binding on Rule-3 grounds because registration changes what the
> installer writes into a consumer's `.claude/settings.json`, which this run
> confirmed by probe (the emitted matrix goes 10 native events to 11). The
> earlier note's reason for leaving all three untouched — a half-wired
> measurement reads as coverage — is why 0.2 is left with a hand-over rather
> than a stub concern and a green test that has never seen the event.
>
> **The bundle ceiling is no longer the constraint anywhere in this file.**
> Measured this run against the gate's own command on `origin/main` @
> `24d6d5b0d`: **1,508,987 B / 1,550,000**, i.e. **41,013 B** of headroom, where
> the blocker's resolution left 44,351 B. The trunk has consumed 3,338 B of it
> since 2026-10-03 and the blocker's standing finding is intact; what changed is
> that a Phase-0 concern is no longer competing for the last hundred bytes.

## Phase 1 — A carrier that works where consumers are

- [x] **1.1 Resolve from the package.** Router and bodies resolve from
      `AGENT_CONFIG_PACKAGE_ROOT`, with `agents/overrides/` keeping precedence;
      no root found → fail closed with one diagnostic line, never a silent
      empty delivery.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t foreign-project` -> 0

      **Done 2026-10-02.** `ruleSources(repoRoot)` in `_lib/rule_injection.ts`
      resolves the body directories, the router path and the gap wording in one
      filesystem pass, in the order `agents/overrides/` → `<workspace>/dist/
      agent-src/rules/` → `<packageRoot>/dist/agent-src/rules/`. `loadRouter`
      and `loadRuleBody` keep their single-root signatures and consult the chain
      internally, so the nine call sites across the model, the shortlist, the
      arm experiment and the two hooks are untouched. Five fixtures cover it: a
      foreign project with no corpus of its own, the override winning over the
      package copy, the unset-variable diagnostic, a package root deleted after
      install, and the maintainer checkout still answering from its own tree.

      **Two things were measured rather than assumed, and both changed the
      shape of the change.**

      The first is a correction to this file's own Context. It cites
      `rule_injection.ts:75-76` and `:167-168` as resolving under one root,
      which is right, and it implies a bare env read would finish the job. It
      would not: `selectForInjection` sizes every candidate body with the same
      reader, so in a consumer project every body measured ZERO and the byte cap
      admitted all of them. A cap that cannot bind is worse than no cap, because
      the budget still reports a number. Fixing the reader fixes the cap with
      it, which is why the resolution went into the shared functions rather than
      into the carrier.

      The second is the reason there is no `_lib/rule_sources.ts`. The first
      implementation was exactly that — a `RuleSources` object threaded through
      `buildInjection`, `recordDelivered` and `selectForInjection`. It worked and
      it cost 2,822 B in the composed hook bundle, against 303 B of headroom
      (`src/config/hook-bundle-budget.json`, ceiling 1,550,000, main measured
      1,549,697). Folding the same resolution into the functions that already
      existed costs 1,628 B and threads nothing. The explicit object was the
      better code and the bundle could not afford it; that is stated here rather
      than silently resolved, because the next lane to touch this concern meets
      the same ceiling.

      **One pre-existing behaviour surfaced and is noted, not changed.**
      `tests/hooks/injection_budget_dispatch.test.ts` asserted that two
      identical prompts spend identical bytes. They no longer do — the carrier
      delivers three rule bodies on the opening turn and none on the next,
      because delivery is once per session per rule. The assertion was sound
      only while the concern was silent in a temp workspace, so it now seeds the
      counter above the ceiling and asserts the turn-start slot discards the
      seed, which is what that test is actually for and does not depend on any
      concern being stateless. Worth recording separately: in that path the
      concern is spawned as its own tsx process, so `_isCliEntry()` is true and
      `gateOpen`'s probe branch opens the gate whatever the settings say. That
      is unchanged from before this step and does not reach a real install,
      where the bundle defines `__AGENT_CONFIG_BUNDLE__` and the branch is dead.
- [x] **1.2 One answer to "which mode".** Installer, projector and hook call one
      resolver over the same layers in the same order — template base,
      canonical `agents/settings/`, project root, user-global. With no settings
      file anywhere the resolver returns the template's value, and the
      template's value is stated in the test.
      verify: `npx vitest run tests/scripts/lean_projection_mode_parity.test.ts` -> 0

      **Done 2026-10-02.** `resolveLeanProjection` in `_lib/lean_projection_mode.ts`
      is the one resolver, per D3. The projector calls it with the file it
      already pinned, the carrier calls it with the project root and the package
      root. Ten fixtures state the expected answer per layer state before any
      code is consulted.

      **The disagreement was about WHICH FILE, not about normalisation, and that
      is sharper than the Context had it.** This file's Context describes two
      mode readers differing in parser. Measured, the carrier read
      `<root>/.agent-settings.yml` — the LEGACY location — while `install.ts`
      writes `<root>/agents/settings/.agent-settings.yml`, which is
      `agent_settings.ts`'s canonical write target. On a normal install the
      carrier opened a file that does not exist, got `''`, normalised that to
      `eager-all` and closed its own gate, while the projector had already
      written thin stubs. That is the pointer arm reached by configuration, and
      it is a SECOND independent cause of the silence 1.1 repaired: a consumer
      with only 1.1 would still have received nothing. The user-global layer was
      invisible for the same reason, which matters more than it sounds — ADR-020
      installs are global-only, so for those consumers the only layer carrying a
      mode was one the carrier never opened. The defect is now pinned, not
      merely described: the canonical-file fixture also asserts
      `leanProjectionModeRaw(root) === ''` on the tree the installer produces.

      **The installer turned out not to be a third mode reader.** The Context
      cites `install.ts:311-314` as "its own read"; those lines are
      `_resolve_settings_read`, a settings-FILE-location read. A grep for
      `lean_projection` across `install.ts` returns nothing — the installer
      never resolves the mode at all. So the parity this step asks for is
      between two readers, not three, and the third was a misreading rather than
      a defect. Recorded rather than quietly dropped.

      **`project_settings_path` is deliberately not used.** `load_agent_settings`
      expands whatever path it is given into `[the file, <its dir>/agents/
      settings/.agent-settings.yml, <its dir>/agents/settings/.agent-settings.local.yml]`
      and merges deepest-wins, so handing it the legacy root path reads BOTH
      locations — strictly more than `project_settings_path`'s either-or pick,
      which is the right answer for a tree carrying both. A fixture pins
      canonical-beats-legacy.

      **The template is located from the package root, because inside the bundle
      nothing else can.** `agent_settings.default_template_path()` derives the
      package from `import.meta.url` three directories up, which is correct for
      a module at `<pkg>/src/scripts/_lib/` and resolves to the PARENT of the
      package once esbuild has inlined it into `<pkg>/dist/hooks/dispatch.js`.
      Verified in the built bundle rather than inferred. Unfixed, the base layer
      would be `{}` and an unconfigured consumer would resolve `eager-all` — the
      silence again, one layer lower. The carrier therefore passes the root the
      dispatcher already gives it, and a fixture covers the no-package-root case.

      **Risk 2 of the register — "one mode resolver changes the projector's
      answer" — is discharged by measurement, not by argument.** The projector's
      INPUT is unchanged (it still passes `MODULE_STATE.SETTINGS_FILE`); only
      the interpreting code is now shared. `task sync` followed by
      `task generate-tools` produced zero changes to the tracked projection
      under `dist/agent-src/`, and `check_rule_projection_integrity` reports 39
      entries complete and fresh across three host trees.

      **Byte cost, because it bounds what follows.** Replacing the two
      hand-rolled readers let esbuild tree-shake `leanProjectionModeRaw` and
      `leanProjectionHostsRaw` out of the composed hook bundle, recovering
      2,122 B — more than the 719 B the cascade resolver adds. The cheaper
      option and the correct one were the same one here, which is worth
      recording because the opposite was assumed when D3 was taken.
- [x] **1.3 Deliver only what the install carries.** A rule with no file in the
      host's installed rule directory is not delivered. One source of truth for
      scope.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t scope` -> 0

      **Done 2026-10-03, on the design the 2026-10-02 run had already
      established.** `hostRuleLayerDirs` and `hostRuleLayerIds` in
      `_lib/rule_layer_overlap.ts` are the one source of truth: the installer's
      overlap gate now calls the first instead of spelling the pair out inline,
      and `buildInjection` filters its matches through the second. The body
      still comes from the package corpus `ruleSources` resolves, and one
      fixture asserts exactly that — a consumer whose host layer carries
      `prompt-rule.md` with the text `INSTALLED STUB` receives `PROMPT RULE
      BODY` and never the stub, which is the half that stops the filter from
      quietly becoming a second body source.

      **`null` is a third answer, and it is the one that keeps 1.1 repaired.**
      `hostRuleLayerIds` returns `null` when NEITHER directory exists, and the
      carrier applies no filter on `null`. An empty set means the install wrote
      a rule layer carrying nothing, so nothing is in scope; `null` means
      nothing exists to declare a scope at all — a maintainer checkout, or a
      host this install writes no rules directory for. Scoping to the empty set
      there would make the carrier silent again in precisely the tree step 1.1
      taught it to speak in. Both readings have their own fixture so the
      distinction cannot be collapsed by accident.

      **Two fixtures had to stop reading the developer's machine before any of
      this could be measured.** `os.homedir()` reads `$HOME` on POSIX, so the
      moment the scope filter existed, `rule_inject_hook.test.ts` resolved the
      maintainer's own 105-file `~/.claude/rules` and nine cases went red
      locally while staying green in CI. Both that file and the foreign matrix
      now stage a `HOME` of their own — the matrix passes it into the spawned
      bundle's env — so every column is a statement about the fixture rather
      than about one laptop. This was a pre-existing exposure that only the new
      filter made visible; it is recorded rather than quietly fixed.

      The matrix's pinned column is rewritten from "a consumer `.claude/rules`
      directory is NOT yet the delivery scope" to the scope assertion the step
      owes, and a twelfth column covers the user layer on its own. Both run the
      BUILT bundle through the dispatcher, so what is proven is that the
      dispatcher reaches the filter — not that the function works when called
      directly.

      Bundle cost: **+780 B** (1,497,769 -> 1,498,549 on the gate's probe
      build).
- [x] **1.4 The host form.** Delivered text has frontmatter and block comments
      stripped, by the same parser the thin projector uses.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t host-form` -> 0

      **Done 2026-10-03, and it was the two lines the 2026-10-02 run said it
      was.** `buildInjection` emits `rule_law_section.ruleBody(raw)` instead of
      `raw.trim()`, which is literally the function `project_thin_rules.ts`
      calls, so "what a stub carries" and "what a delivery carries" cannot drift
      into two spellings. One fixture asserts the emitted inner text is
      byte-identical to `ruleBody(RAW)` rather than merely free of the strings it
      should not contain — a `not.toContain` suite passes against any number of
      wrong parsers.

      **One behaviour the step did not specify, decided here and recorded.** A
      file with nothing left after the strip — frontmatter plus comments and no
      prose — is now not delivered at all, where before it would have been
      emitted as its raw frontmatter. An empty `<rule>` element is framing with
      no content inside it, and it would be charged against 1.5's budget.

      **Measured cost: +435 B** (1,498,549 -> 1,498,984 on the gate's probe
      build), against the +396 B the previous run measured on a tree without
      1.3. The number was the whole argument of the blocker below; what changed
      is not the number but the headroom it is spent against.
- [x] **1.5 A delivery the host does not replace, and that hides nothing.** The
      rule-produced string stays under 8,000 characters (D2), in the order D1
      fixes; the high-consequence class is the one
      `road-to-rule-laws-that-can-stand` step 2.1 declares, empty until it lands.
      Every match appears in a manifest labelled `full`, `law`,
      `omitted_budget` or `source_unavailable`; a path alone is never labelled
      delivered. A rule whose law section alone does not fit is reported, never
      truncated. `hook-token-budget.json`'s `rule-inject` row (`:35`) is
      restated in characters.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t composed-budget` -> 0

      **Done 2026-10-03.** `compose` in `rule_inject_hook.ts` fills the string in
      D1's order — high-consequence laws, then the highest-priority full body
      that fits, then further bodies, then the laws of the rest, then the
      manifest — under `COMPOSED_CHARS = 8000`. The high-consequence class is
      read from `src/config/rule-consequence-class.json` through
      `_lib/rule_consequence_class.ts`, never re-derived; an unreachable config
      degrades to "no rule is high-consequence", which costs those rules their
      guaranteed slot and costs nobody a delivery.

      **The manifest is inside the budget, not beside it.** Its worst-case
      length — every matched id at the longest label — is reserved before any
      text is admitted, so the report can never be the thing that pushes the
      string over. Four labels, and the distinction between them is the step:
      `omitted_budget` blames a budget decision, `source_unavailable` blames the
      install, and one fixture asserts a rule whose source IS readable gets the
      first, because the fallback label would have silently blamed the wrong
      thing.

      **`selectForInjection`'s `dropped` list is now read**, which the Context
      called out and which no amount of budgeting would have fixed on its own.
      Before this, a body the byte cap discarded left no trace, so a consumer
      could not tell a rule that did not match from one that matched and was
      thrown away.

      **The budget is registered in its own unit rather than converted.**
      `hook-token-budget.json` gains a `per_concern_caps_chars` section carrying
      `rule-inject: 8000`; the bytes row stays at 16,384 and its reason now says
      it is the outer envelope the SELECTION stays inside rather than the bound
      that binds at emission. Converting would have needed a bytes-per-character
      ratio that drifts with the corpus. The claim that the two cannot breach
      each other is measured, not asserted: over the 121 projected rule files the
      mean is 1.0088 B/char and the per-file maximum 1.0346, so 8,000 characters
      is at most 8,277 bytes — a composed string would have to average 2.05
      B/char to reach the byte row. A fixture re-measures that maximum over the
      real corpus rather than quoting it, so a corpus that did start producing
      such a string fails a test instead of silently having a path substituted
      for its obligations.

      **One behaviour changed outside what the step asked for, and is recorded
      rather than folded in.** A fire where every match is `source_unavailable`
      now emits a manifest where it previously emitted nothing at all. That is
      AC-2's "no match absent from a delivery" taken literally, and it is what
      makes a broken install visible from the model's side; the cost is one short
      line per turn for as long as it stays broken. The 1.4 fixture that asserted
      total silence in that state is updated in this change and says so.

      Bundle cost: **+3,845 B** (1,498,984 -> 1,502,829 on the gate's probe
      build), the composer plus the consequence-class reader.

      **Three things changed after the ratification council read the diff
      (2026-10-03, anthropic + openai, both `ratified`), and they are the
      council's findings rather than this lane's second thoughts.**

      - **The margin was stated ambiguously, and D2's own wording is where it
        came from.** "Leaves roughly 2,000 under the 10,000-character
        threshold" is true only if the host measures THIS concern's payload
        alone. If it measures the `additionalContext` it assembles, the 1,272
        characters of non-rule text on this slot make the real margin **728**.
        Both readings are now stated, in the constant's own header and in the
        registered row, and the smaller one is named as the one to plan
        against. Which reading is right is not established here.
      - **The corpus ratio is evidence, not an invariant — so the byte row is
        enforced too.** The 1.0346 bytes-per-character maximum describes
        today's 121 files; one BMP code point is one character and three UTF-8
        bytes, so a 6,000-character payload can be 18,000 bytes, under the
        character budget and over the 16,384-byte row. `compose` now checks
        both units independently at emission and a fixture emits exactly that
        payload. The ratio is what makes the second check almost never bind,
        not what makes it unnecessary. **+150 B.**
      - **A boundary fixture, because a reserve-then-fill loop is wrong at the
        edge or nowhere.** One case sizes a body so the composed string lands
        exactly ON `COMPOSED_CHARS` and asserts it is delivered `full`, then
        adds one character and asserts the same rule comes back
        `omitted_budget` — reported, never shortened.

      The council's third finding, possible duplication between the constant
      and the registered row, was already covered: the fixture that reads
      `per_concern_caps_chars['rule-inject']` asserts equality with
      `COMPOSED_CHARS`, which is the explicit equality test it asked for.
- [x] **1.6 Re-deliver after compaction.** On the session-start slot with source
      `compact`, emit the law section of each rule in the pre-compaction
      seen-set, under the same budget. The seen-set keeps rule ids, never body
      copies.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t compact` -> 0

      **Done 2026-10-03, and the third binding was indeed the free part.**
      `rule-inject` is now in `claude`'s `session_start` list, and the concern
      returns on every source but `compact` — `startup`, `resume`, `clear` and
      `fork` either begin a session that never had a seen-set or hand back a
      transcript the host already restored, and an unknown source emits nothing
      rather than guessing, which is the stance `handoff-context`'s `sourceGate`
      already takes.

      **`pre_compact` stops deleting the state file.** It empties `rules`, which
      is what "re-armed" always meant, and moves the ids to `pending`, which is
      what the restore slot reads. The reason `pre_compact` cannot do the
      delivery itself is worth stating because it looks like the obvious place:
      the host is about to discard the context it would emit into.

      **Ids, never text.** The restore re-reads each rule's law from the corpus
      and gets the tier and router order from the router, so nothing about a
      rule's CONTENT is cached in a consumer's state directory where it would go
      stale on the next upgrade. One fixture reads the state file and asserts
      both halves: the shape, and that no law text is in it.

      **Laws and not bodies, and a rule with no law is reported.** Re-sending
      every body would re-spend the whole budget on rules the session may never
      touch again; the law is the part that cannot be inferred from the rest.
      `compose` grew one `lawOnly` flag rather than a second composer, so the
      budget, the order and the manifest are the same code on both paths — a
      restore that reported differently from a fire would be two contracts.

      **The binding is proven at the dispatcher, not at the function.** The 1.8
      matrix gains a column that drives `pre_compact` and then
      `session_start source=compact` through the BUILT bundle and asserts the law
      arrives. That column was written because the sibling failure mode is
      live: a concern can be bound in a manifest the dispatcher never routes to
      it, and every `main()` fixture stays green over it. Sensitivity checked by
      removing the binding — the column goes red while all twelve others stay
      green.

      Bundle cost: **+1,843 B** (1,502,829 -> 1,504,672 on the gate's probe
      build).
- [x] **1.7 State leaves the consumer's tree.** The seen-set moves under the
      global root, keyed by project; the delivered-row ledger that
      `road-to-a-stop-that-holds` reads keeps its join. The installer writes the
      package's ignore block on the `--no-ui` path so dispatcher state under
      `agents/` does not appear as untracked files.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t state-location` -> 0

      **Done 2026-10-03, both halves.** `statePath` resolves through
      `user_global_paths.write_target('state/rule-inject/<projectKey>')`, where
      the key is the project's basename plus a 12-hex digest of its absolute
      path. Both halves earn their place: the basename alone collides — a
      developer with `~/work/api` and `~/clients/api` would share one seen-set
      and lose deliveries in both — and the digest alone is unreadable in a
      directory a human opens when a delivery looks wrong. A fixture asserts two
      roots with the SAME session id do not share state.

      **How the ledger join was verified, because "nothing else changed" is what
      a broken join says right up until it is found.** `recordDelivered` writes
      through `_lib/obligations.ts`, which resolves under the PROJECT root
      (`path.join(root, statePathFor(session_id))`) and is joined on the session
      id. The seen-set and the ledger were never keyed on each other, so moving
      one cannot move the other — but that is an argument, and the step asked
      for the join. So there is a fixture: after a fire it reads
      `readDelivered(root, session)` back by project root plus session id — the
      same two arguments the reader on the other side of the join uses — gets
      the delivered row, and gets an empty list for a different session id. A
      sixth fixture drives a compaction restore afterwards, so the moved state
      and the unmoved ledger are exercised in one session.

      **One fixture had gone vacuous and was repointed rather than left green.**
      "An unwritable state directory still delivers" blocked
      `<root>/agents/runtime/state/rule-inject`, which after the move is a path
      nothing writes: the case would have passed over a mechanism it no longer
      touched. It now derives the directory from `statePath` itself, so the next
      move cannot leave it asserting nothing.

      **The installer half needed a module extraction the gate asked for.**
      `_write_gitignore_block` runs on the path where the wizard will NOT
      launch, append-only so a consumer's own lines inside the block survive,
      and best-effort throughout — an installer that failed because it could not
      tidy a listing would be worse than the listing. Importing `sync_gitignore.ts`
      for it was refused by `check_installer_import_purity`: that file ends in a
      module-level `process.exit()` behind a CLI-entry guard, and inside
      `dist/install/install.mjs` the guard is TRUE because the bundle IS argv[1],
      so a consumer install would exit after writing its payload. The pure half
      moved to `_lib/gitignore_block.ts` with no entry and no exit, and
      `sync_gitignore.ts` re-exports every name it owned — the CLI contract and
      the ported pytest call sites are unchanged, and its 28 fixtures are green
      on the re-export.

      **One cost, stated.** An upgrade mid-session orphans the old state file and
      the seen-set reads empty, re-injecting each matched rule once more. Session
      state is per session and cheap to rebuild; a migration step would be more
      code than the duplicate it prevents.

      Bundle cost: **+342 B** (1,505,307 -> 1,505,649 as the gate reads it).

## What an independent review found after Phase 1 closed

A fresh reviewer read the whole branch delta against this file's Goal, Context,
steps and Acceptance Criteria on 2026-10-03, with a prompt that stated the scope
and the question and no expectation of the outcome. It returned 17 findings. The
two it rated **high** were one defect seen from two sides, and it was a real
delivery regression that every fixture on the branch had passed over.

**Phase 1 was a ceiling where D1 says floor.** A high-consequence rule's law was
emitted in phase 1 and its form set to `law`; phase 2 then skipped anything not
still `omitted_budget`, so a class member could never receive its whole body
however empty the budget was. Its id entered the seen-set on the way out, so the
body did not come back on a later turn either. Measured by the reviewer against
the real config and corpus: 23 of the 28 class members have a law section, and
`security-sensitive-stop` would have dropped from 5,687 characters to 429 on
every fire — 92.5 % withheld, from the rules the class exists to protect. D1's
"then the highest-priority full body that fits" reads as a floor and now behaves
like one: `put` replaces a part in place and charges only the delta, so a law is
upgraded to its body when the budget has room.

**And the class was read with the wrong reader.** `highConsequenceIds` used
`Object.keys(members)`, which includes the `no_stub` subset — the members whose
law was DECLARED unable to stand alone, which is why the projector ships those
full-bodied. `_lib/rule_consequence_class.ts` exports `stubLawIds` for exactly
this distinction and it is now what the carrier calls, so the one module that
owns the class has one reader again.

Neither had a fixture that could have caught it: the D1 ordering case sized both
bodies so only one fit, which cannot distinguish a floor from a ceiling. Four
cases now do, each checked by neutralising the mechanism.

**Three more defects, fixed:**

- A matched class member the BYTE cap dropped never reached phase 1 at all,
  because `ranked` was built from `sel.selected` alone and `selectForInjection`
  knows nothing about the class. D1 says "every matched"; the text for a dropped
  member is loaded now.
- `takePending` cleared the pending set BEFORE the restore was built, so a build
  that failed — the package moved mid-session, or an upgrade renamed the pending
  rules out of the router — lost the set permanently and silently, on the one
  slot that does not come round again. Split into `readPending` and
  `clearPending`, with the clear last.
- The byte budget did not reserve the manifest while the character budget did,
  so the emitted bytes could exceed the registered row by the manifest's length.
  Both units reserve it now.

**Two labels were untrue of the rule they named**, which matters because the
four-value vocabulary is the step's contract:

- A restore labelled a law-less rule `omitted_budget`, which by 1.5's own
  wording blames a budget decision nobody made. Those compete for their body
  instead, so every label on a restore is true. The matrix column is updated.
- The manifest truncation dropped rows in router order, which could in principle
  report a DELIVERED rule as omitted — the one thing AC-2 forbids outright.
  Undelivered rows are dropped first now.

**Three fixtures were vacuous or machine-dependent, and are repaired:**

- "The restore obeys the same character budget" used bodies whose LAWS were
  forty characters, so it asserted a 400-character string against an 8,000 cap
  and would have stayed green with the budget code deleted.
- "Two projects with the same session id do not share a seen-set" built both
  roots with `mkdtemp`, so their basenames already differed and the digest half
  of `projectKey` — the half that does the work — was never exercised. The new
  case gives both roots the basename `api`.
- `EVENT4U_CONFIG_HOME` is honoured AHEAD of `$HOME` by `event4u_root` and is
  deliberately not neutralised by `hermetic-env.ts`, so a developer carrying it
  would red the state-location cases. The same machine-dependence class step 1.3
  found in `$HOME`, one variable over. Stubbed.

**Five findings are recorded and NOT fixed, each with the reason:**

- **The scope filter narrows this checkout to 13 rules.** `<repo>/.claude/rules`
  carries only what `~/.claude` lacks (the complement projection `generate-tools`
  writes), so on a maintainer machine with no global install the union is 13 of
  ~120. That is the filter being RIGHT: the scope is what the host actually
  loads, and a host that loads 13 files has the agent under 13 rules. It reads
  as a regression only against the step's framing, not against its contract.
- **The dispatcher prepends this concern's own `reason` line** to the payload
  (`_parse_concern_stdout` joins `stated` and `extra`), adding ~60-70 characters
  outside this concern's own budget — against the 728-character margin under the
  conservative reading. Noted in risk-register row 5 rather than absorbed,
  because which string the host measures is precisely what that row is for.
- **A readable file that strips to empty is labelled `source_unavailable`.**
  There is no usable source text, which is what that label says; the alternative
  blames a budget decision nobody made. Recorded as a choice between two
  imperfect labels in a closed four-value vocabulary.
- **The seen-set has no retention.** It accumulates one file per (project,
  session) under the user-global root forever, and `janitor.ts` is
  project-scoped and never swept `rule-inject` even at the old location. A real
  gap, and a janitor change is a different surface from this phase.
- **`per_slot_sum_caps_bytes.session_start` was not re-checked** when 1.6 added
  an emitter to that slot. The slot sums are an authoring-time control read by
  `bench_hook_injection`, and re-deriving one is a measurement this phase did
  not take.

**What the reviewer checked and could not fault** is recorded because coverage
and silence are different things: the reserve-then-fill arithmetic (hand-computed
at the boundary), the byte-check fixture's sensitivity, the D1 ordering
fixture's sensitivity, the manifest-truncation property, `statePath` and the
absence of any other reader of the old location, the ledger join, the `$HOME`
fix, the completeness of the `gitignore_block` extraction, `write_managed_block`'s
append-only behaviour, the `ai_council` import split, the manifest/compiled-JSON
consistency, and `emitFor`'s landing place.

One infrastructure observation, pre-existing and not this diff's:
`tests/_lib/ensure-build-artefacts.ts` builds `dist/` only when ABSENT, so the
foreign matrix exercises whatever `dist/hooks/dispatch.js` is on disk. A stale
local build would make those 13 columns a statement about older code.
- [x] **1.8 A foreign-project matrix.** End to end on the built bundle: empty
      project, project with its own `.claude/rules`, package moved after
      install, no source checkout, cwd changed mid-session, maintainer scope,
      settings absent, settings `eager-all`, settings `delivery`.
      verify: `npx vitest run tests/scripts/rule_inject_foreign_matrix.test.ts` -> 0

      **Done 2026-10-02, eleven columns, and it earned its place twice over.**
      Each case copies the BUILT bundle, the manifest, the shipped config and a
      small router into a temp directory and runs that, so the tree under test
      carries no `src/scripts/**/*.ts` at all — the "no source checkout" column
      is a property of the fixture rather than an assertion about it, and one
      case checks that property directly so the fixture cannot quietly stop
      testing what it claims.

      **Why nothing smaller would do.** Two things that actually broke in
      consumers are invisible from inside the module: the bundle's own idea of
      where the package is (`dispatch_hook` computes `REPO_ROOT` with a
      `__AGENT_CONFIG_BUNDLE__` sentinel picking two levels instead of three, so
      the answer is right only in a real build), and the dispatcher's env
      handling. On the second, the matrix corrected a belief this lane had been
      working from: `_run_concern_inproc` REPLACES `process.env` with
      `hardenedSpawnEnv({ AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT })` before
      calling a concern, so an externally-supplied package root is scrubbed. A
      consumer cannot spoof it and a test cannot inject one — which is why the
      fixture stages a tree that IS an install.

      **It found a real defect in 1.1, which is the whole reason to write it.**
      Step 1.1 shipped its diagnostic as `process.stderr.write`. That line is
      never seen: `_run_concern_inproc` captures a concern's stderr and
      `dispatch_hook` re-emits it only at `rc >= 3`, so a concern exiting allow
      is silent BY CONSTRUCTION — the exact failure the diagnostic exists to
      end, reproduced one layer up. No in-process fixture could have caught it.
      The concern now warns with a `reason`, and the measured landing place is
      recorded rather than assumed: `emitFor` translates an advisory warn on
      this slot into `hookSpecificOutput.additionalContext` at exit 0, so the
      line reaches the MODEL, not the operator's terminal. That is the host's
      translation, not a choice: `reason` alone has no terminal-facing path on
      this slot. It is the right landing anyway — the agent is what the user is
      talking to, so an agent told its corpus is missing can say so.

      Two consequences are stated rather than left implicit. The cost is one
      short line per turn for as long as the install stays broken; bounding it
      to once per session needs a state write the bundle ceiling cannot afford
      at this commit (75 bytes of headroom), so it is deferred here rather than
      silently skipped. And `rule_inject_hook.test.ts`'s "a tree with no router
      returns allow" changed meaning: a tree configured for delivery that cannot
      find a corpus now reports instead of being silent. The host exit is still
      0 — an advisory concern never blocks, which the matrix asserts through the
      dispatcher rather than taking on trust.

      **Sensitivity was checked, not assumed.** Disabling the package-root
      branch turns 5 of the 11 columns red — exactly the delivery-dependent
      ones — while the six that do not depend on it stay green.

      One column is pinned rather than satisfied: a consumer `.claude/rules`
      directory is NOT yet the delivery scope, because 1.3 is not built. The
      case asserts what the carrier does TODAY, so implementing 1.3 has a red to
      turn green rather than a behaviour to discover.

## What this roadmap deliberately does not do

- No change to any installed rule file. A flip before Phase 1 turns
  over-delivery into under-delivery for every consumer.
- No second router, no `context:*` command cluster: the prompt router,
  `route:explain` and `route:audit` exist.
- No `claudeMdExcludes` suppression: before 1.1 it removes bodies nothing
  delivers back.
- No rule-retrieval MCP server (`road-to-skill-delivery-over-mcp` closed
  measured-null).

## Blockers

### blocker: hook-bundle-ceiling-exhausted

- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** steps 1.3, 1.4, 1.5, 1.6 and 1.7, and AC-1's "only rules the
  install carries" clause and AC-2 through them. 1.1, 1.2 and 1.8 are closed
  and merged; everything still open on this phase is open for this one reason
  and not for a design one.
- **What to do:** `src/config/hook-bundle-budget.json` caps the composed hook
  bundle at `max_bytes: 1550000`. Every concern is inlined into
  `dist/hooks/dispatch.js`, so this is not a rule-inject budget; it is the
  budget for any runtime code added anywhere in the hook estate.

  Three readings, all taken with the gate's own command on 2026-10-02:
  `main` at `9e2fe189e` measured **1,549,697 B** — 303 bytes, 0.02 % of the
  ceiling. `main` after #2179 merged, measured by restoring this branch's three
  bundled files to their `origin/main` versions, is **1,549,830 B** — 170 bytes.
  This branch, with 1.1, 1.2 and 1.8 landed, is **1,549,925 B** — **75 bytes**.

  **The exhaustion is not hypothetical and it was watched happening.** This lane
  reached green at 1,549,970 B with 30 bytes to spare, then merged `origin/main`
  for the pre-push check and went **103 bytes RED** — #2179 had landed
  `_lib/neighbour_tool_use.ts` in the meantime, +133 B, and it was green on its
  own branch. Two lanes, each under the ceiling alone, over it together, within
  one day. That is precisely the failure mode the existing `raise_log` entry
  names in its own `what_would_have_caught_it`: a ceiling derived on a branch is
  a statement about that branch, and the trunk is what the gate defends. The
  branch was brought back under by removing a further 148 B of its own cost
  (folding the orphaned `ruleBodyPath` into `loadRuleBody`, and resolving the
  package root once instead of twice), which is real but is the last of it.

  The number is measured, not estimated. Step 1.4 — the cheapest of the five,
  two lines reusing `_lib/rule_law_section.ts::ruleBody`, the parser the thin
  projector already calls — was written, built and measured at **+396 B**,
  landing the bundle 357 B over. It was reverted rather than shipped.

  This lane paid for 1.1 and 1.2 out of its own cost rather than asking, which
  is the precedent set by the lane that landed #2178. The explicit
  `_lib/rule_sources.ts` module that 1.1 was first written against cost
  2,822 B; folding the same resolution into the functions that already existed
  cost 1,628 B. Replacing the two hand-rolled settings readers let esbuild
  tree-shake 2,122 B out. Both were real reductions and both are spent.

  There is nothing left to reclaim inside this concern's dependency closure.
  Every module in it — `rule_injection`, `obligations`, `obligation_frequency`,
  `router_match`, `hook_settings`, `agent_settings` — is shared with at least
  one other concern, and the six heaviest modules in the bundle
  (`chat_history` 55,899 B, `ai_council/config` 42,037 B, `ai_council/clients`
  37,732 B, `memory_lookup` 34,757 B, `work_engine/stack/runner` 26,952 B,
  `lint_code_comments` 18,787 B) each reach the bundle through exactly one
  importer which is the concern that needs it. Trimming any of them removes a
  capability rather than a redundancy.

  So the decision is one of: raise `max_bytes` with a `raise_log` entry naming
  what was added; or lower the estate's cost deliberately somewhere that is not
  this phase. The file's own `shrink_only_note` says a raise needs a recorded
  reason and that "the enforcement is review reading `raise_log`" — a raise is
  therefore permitted with a record, and it is an owner call because the
  ceiling is a ratchet and the previous raise (2026-10-01, 1,500,000 ->
  1,550,000) was itself a response to the trunk outrunning a number derived on
  a branch. Its own `what_would_have_caught_it` names the cause: a ceiling
  derived against a base that no longer exists. The same thing has now happened
  again within one day, which is the fact worth deciding on rather than the
  bytes.
- **Resolution 2026-10-03 — the second option, and the ceiling was not
  touched.** The blocker's own `What to do` offered two: raise `max_bytes` with
  a `raise_log` entry, or "lower the estate's cost deliberately somewhere that
  is not this phase". The second was taken. `ai_council/config.ts` imported ONE
  string, `OPENAI_CLI_VENDOR_DEFAULT`, from `clients.js`, and `config.ts` is
  reachable from `council-availability` on `session_start` — so that one edge
  charged every hook dispatch on every slot for the whole council transport
  layer. Measured with the gate's own command: **51,523 B**. The constant moved
  to a dependency-free `ai_council/vendor_defaults.ts` and `clients.ts`
  re-exports it, so every existing importer resolves unchanged and no capability
  is removed — every entry point that talks to a vendor CLI still imports
  `clients.ts` directly.

  Readings, same command throughout: `origin/main` **1,549,925 B** (75 B of
  headroom), after the split **1,498,404 B** (51,596 B), with 1.3 through 1.7
  landed **1,505,649 B** (44,351 B). The five steps cost 780 + 435 + 3,845 +
  1,843 + 342 = **7,245 B**, against the ~6 KB the blocker estimated.

  **What this does NOT settle.** The blocker's standing finding is intact: the
  trunk gained 133 B from one unrelated lane in a single day, and a ceiling
  derived on a branch is still a statement about that branch. This resolution
  bought one phase its headroom; it did not change the ratchet, the derivation
  doctrine, or the fact that the next lane to touch any concern measures against
  whatever the trunk is at that moment. The raise remains available and
  undecided — it was not needed here, which is a different thing from being
  refused.
- **Re-read 2026-10-05, because `resolved` is a recording and this one is about
  a number that moves.** Same command, `check_hook_bundle_composition`:
  `origin/main` @ `24d6d5b0d` reads **1,508,987 B / 1,550,000**, i.e. **41,013 B**
  of headroom against the 44,351 B the resolution recorded. The trunk has taken
  **3,338 B** in two days, which is the standing finding continuing to hold
  rather than a new one.

  The resolution stands, and Phase 0 was sized against the live number rather
  than against the recorded one: step 0.3 cost 1,156 B (1,508,987 → 1,510,143)
  and step 0.1 cost 0 B, because `_lib/installed_layer.ts` is reached by no
  concern. 39,857 B remain. The number worth carrying forward is the RATE, not
  the balance: at 3,338 B per two days the resolution's 51,596 B is roughly a
  month of trunk, and the next lane that needs a concern should re-read before
  sizing rather than quoting this line.
- **Earlier recommendation (not taken):** raise it, with the `raise_log` entry naming this phase
  and the five steps, and re-derive the headroom against the MERGE result
  rather than a branch — the lesson the existing entry already wrote down and
  which a second exhaustion in a day confirms. Roughly 6 KB would carry 1.3
  through 1.7 at the shapes sized above. The honest alternative is to leave the
  ceiling and accept that the phase stops here, in which case
  `road-to-an-installed-layer-that-is-thinned` stays blocked, because its
  `relates:` note gates on this phase having merged and three of eight steps is
  not that.
- **If you do nothing:** the carrier works outside the repo — that is 1.1 and
  1.2, merged — but it delivers more than the install carries (13 router tier
  rules are maintainer-only by `workspaces` and neither hook file reads that
  key), it delivers raw files with frontmatter, and roughly a third of composed
  strings stay over the host's 10,000-character replacement threshold, where
  the host substitutes a path and a 2,000-character preview. The register's
  risk 1 bounds the first of those: the installed layer is still eager, so a
  wrong delivery duplicates rather than loses. The third is not bounded by
  anything and is the standing cost.
- **Resolved when:** `./scripts-run src/scripts/check_hook_bundle_composition`
  is green with 1.3 through 1.7 implemented, and
  `npx vitest run tests/scripts/rule_inject_foreign_matrix.test.ts` is green
  with its `.claude/rules` case rewritten from "NOT yet the delivery scope" to
  the scope assertion 1.3 owes. Both executed 2026-10-03: the gate reads
  1,505,649 B / 1,550,000 with 1.3-1.7 landed, and the matrix is green at 13
  columns with that case rewritten to the scope assertion plus a twelfth column
  for the user layer and a thirteenth for the compaction restore.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:inbox-2026-10-c-standing-form | Delivery order in 1.5: matched high-consequence laws, then the highest-priority full body that fits, then further bodies, then laws of the rest, then a manifest | Both seats, 2/2; P-1's form peaked at 8,873 chars, so the order decides what an 8,000 budget keeps | 0.3 shows a match labelled `law` that the observer does not see loaded |
| D2 | contested-technical | council:inbox-2026-10-c-standing-form | 8,000 chars on the whole rule-produced string, framing and manifest included | Both seats; leaves ~2,000 under the 10,000 host cap beside the 1,272 chars of non-rule text measured on the slot | The host's cap, preview size or composition semantics change |
| D3 | reversible-technical | agent | One resolver, not a parity test between three | A parity test keeps three readers that can drift again; `lean_projection_mode.ts` already exists to be the one | — |
| D4 | reversible-technical | agent | Arrival levels are named A0–A3 | The draft set used R0–R4 for both size rungs and arrival levels; two meanings under one label is how a pointer gets counted as arrival | — |
| D5 | reversible-technical | agent | Pay for Phase 1's runtime code by breaking one import edge in `ai_council`, rather than raising `max_bytes` | The blocker's own second option. `config.ts` took one string from `clients.js` and was charged 51,523 B of composed hook bundle for it; the split removes no capability and the ceiling is untouched | A future lane needs more than the 44,351 B this leaves, or the trunk consumes it first |
| D6 | reversible-technical | agent | No host rule layer anywhere → no scope filter, which is a different answer from an empty layer | Scoping to the empty set in a tree that declares no layer re-creates the silence 1.1 repaired; an empty layer IS a declaration and scopes to nothing | A host is found that writes a rules directory only sometimes, making absence ambiguous |
| D7 | reversible-technical | agent | Register the composed budget in characters in its own `per_concern_caps_chars` section, leaving the bytes row at 16,384 | Converting needs a bytes-per-character ratio that drifts with the corpus; measured mean 1.0088 and per-file max 1.0346, so 8,000 chars is at most 8,277 B and the two cannot breach each other | The corpus starts producing text dense enough to close that gap — a fixture re-measures the maximum and reds first |
| D8 | reversible-technical | agent | A fire where every match is unsendable emits a manifest, where it previously emitted nothing | AC-2's "no match absent from a delivery" taken literally; it is what makes a broken install visible from the model's side | The per-turn cost of a persistent broken install is measured and judged worse than the silence |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-05 | reviewer: claude/host -->

Re-reviewed 2026-10-05 after Phase 0 closed 0.1 and 0.3, against measured
numbers rather than against the plan. Row 3 moves for the first time: its
mitigation named 0.2's first record as the thing that would discharge it, and
0.2 is now blocked on a recorded council refusal, so the row says what the
unmitigated state costs instead of pointing at work that is not coming. Row 5 is
unchanged in substance and gains the one new fact this run produced about it —
the arrival record now measures the rule-produced string in the host's own unit,
which makes the 728-against-2,000 question answerable by a later reading rather
than only arguable. Rows 1, 2 and 4 are untouched: nothing this run built
touches delivery behaviour.

Earlier review 2026-10-03, after Phase 1 closed 1.3 through 1.7: rows 1 and 2
had their mitigations SHIP rather than remain planned, and the mitigation column
says which fixture holds each one; rows 4 and 5 were new then.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The carrier starts delivering into every consumer session | product | 1.1 turns a silent concern into a live one; a wrong trigger now costs real context in someone else's project. | DISCHARGED 2026-10-03. 1.3 scopes delivery to the host's own rule layers and 1.5 caps the string at 8,000 characters; both are held by fixtures that drive the BUILT bundle through the dispatcher. The installed layer is still eager, so a wrong delivery duplicates rather than loses. | Phase 1 — A carrier that works where consumers are |
| 2 | One mode resolver changes the projector's answer | implementation | Making the hook agree with the projector could also move the projector. | DISCHARGED 2026-10-02 by measurement, not argument: `task sync` + `task generate-tools` produced zero changes to the tracked projection, and `check_rule_projection_integrity` reports 39 entries complete across three host trees. | Phase 1 — A carrier that works where consumers are |
| 3 | The installed-layer report reads a host rule the host does not count | implementation | Which files the host sums is inferred, not documented. | UNMITIGATED 2026-10-05, and the mitigation is not coming soon: it named 0.2's first record, and 0.2 is blocked on a recorded Rule-3 refusal. What the report does instead is state its own inference — `.md` only, `paths:` as the unconditional test, both scopes unioned — so a reader can check the assumption against a host rather than against a number. The exposure is bounded by the report being report-only: a wrong count misinforms, it gates nothing. | Phase 0 — Instruments, no behaviour change |
| 4 | A broken install reports once per turn, forever | product | 1.5 emits a manifest whenever a match cannot be sent, and a match labelled `source_unavailable` is not added to the seen-set, so a consumer whose corpus is missing a routed rule gets one manifest line per matching turn for as long as it stays missing. | The line is short and it is the signal that makes the breakage visible from the model's side, which is the half that was silent before. Bounding it to once per session needs a state write; measure the real per-turn cost before adding one, because a bound that hides a broken install is worse than the line. | Phase 1 — A carrier that works where consumers are |
| 5 | The host measures a larger string than this budget bounds | implementation | 8,000 characters bounds the RULE-PRODUCED string. If the host's 10,000-character threshold applies to the assembled `additionalContext`, the margin is 728 rather than 2,000, and a future concern added to this slot consumes it. | Both readings are stated at the constant and in the registered row, with 728 named as the one to plan against. Raised by the openai seat of the 2026-10-03 ratification council; which reading is right is not established and is the thing to settle before any concern is added to `user_prompt_submit`. 2026-10-05: 0.3's arrival record now carries `chars` per fire in the host's own unit, so the rule-produced half is a reading rather than an argument — and the record says in its own header that it measures that half and does not settle which string the host counts. | Phase 1 — A carrier that works where consumers are |

## Acceptance Criteria

- [x] AC-1 — In a project that is not this repository, the built bundle delivers
      a matching rule and only rules the install carries.

      Both halves on the BUILT bundle through the dispatcher
      (`rule_inject_foreign_matrix.test.ts`): a consumer carrying no corpus of
      its own receives `prompt-rule`, and a consumer whose `.claude/rules`
      carries only `prompt-rule.md` receives that rule and not `second-rule`,
      whose body exists in the package corpus and routes on the same prompt.
- [x] AC-2 — No composed string over the D2 budget across the frozen corpus, and
      no match absent from a delivery.

      Measured 2026-10-03 rather than argued, because a reserve-then-fill loop
      is exactly the shape that is wrong in the one case nobody wrote down. The
      sweep routes every prompt in `tests/eval/routing-matrix` against this
      repository's real router and real bodies, from an empty workspace with the
      repository as the package root so the scope filter does not narrow it:
      **444 fires over 588 prompts, worst composed string 7,943 characters** —
      under the 8,000 budget and under the host's 10,000-character replacement
      threshold. The draft's run measured 109 of 323 over that threshold. The
      second half is structural: every matched rule is a manifest row, including
      the ones `selectForInjection` dropped, which nothing read before.
- [x] AC-3 — Installer, projector and carrier return the same mode in every
      fixture of 1.2.
- [x] AC-4 — The installed-layer report and the arrival record exist and every
      truth surface in 0.5 names the scope it was measured on.

      All three clauses executed 2026-10-05. The installed-layer report is
      `src/scripts/installed_layer_report.ts` over `_lib/installed_layer.ts`;
      run on the maintainer machine it reads 593 files and 1,960,380 characters
      across five hosts in two scopes. The arrival record is written at the
      carrier's `emit()` and read back by `readArrival`; 11 cases hold its
      shape, its two paths to A1, and the levels it refuses to write. The third
      clause is 0.5's, re-executed rather than read off its note:
      `./scripts-run src/scripts/check_claims` exits 0 at this head.

      **What this criterion does NOT say, stated because the adjacent reading is
      tempting.** It asks that the two instruments EXIST and that the truth
      surfaces name their scope. It does not say the host has been observed
      loading anything — that is 0.2, which is open, and the arrival record is
      an emitter record by construction: it says the text left for the host, in
      the host's unit, and whether the host's own threshold would have replaced
      it. An independent observation of the loading end is the thing 0.2 buys
      and nothing here substitutes for it.
