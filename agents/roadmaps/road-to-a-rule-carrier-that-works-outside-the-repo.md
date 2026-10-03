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
- [ ] **1.3 Deliver only what the install carries.** A rule with no file in the
      host's installed rule directory is not delivered. One source of truth for
      scope.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t scope` -> 0

      **Not started 2026-10-02 — blocked on `hook-bundle-ceiling-exhausted`
      below, not on design.** The scope is known and was established while
      sizing the step: Claude Code loads `~/.claude/rules/` and
      `<project>/.claude/rules/` BOTH (`install.ts:1991`, `:2031-2032`), so the
      scope is their union and the body still comes from the package — the
      installed layer declares what is in scope, the package supplies the text.
      In `delivery` mode those files are thin stubs, which is exactly why the
      two halves cannot be the same read.

      The step needs a directory read plus a filter in the carrier, and the
      bundle has 75 bytes of headroom. Pinned so the work has a red to turn
      green: `rule_inject_foreign_matrix.test.ts`'s last case asserts that a
      consumer `.claude/rules` directory is NOT yet the scope.

      **What shipping 1.1 without 1.3 actually costs, stated plainly.** 13
      router tier rules are maintainer-only by `workspaces` and neither hook
      file reads that key, so a consumer can now receive a body for a rule the
      install never meant for them. The register's risk 1 bounds the harm —
      the installed layer is still eager, so a wrong delivery duplicates rather
      than loses — and that bound is real but it is not a reason to call this
      done. It is the first thing the next run should close.
- [ ] **1.4 The host form.** Delivered text has frontmatter and block comments
      stripped, by the same parser the thin projector uses.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t host-form` -> 0

      **Not started 2026-10-02 — blocked on `hook-bundle-ceiling-exhausted`,
      and MEASURED rather than estimated.** The implementation is two lines:
      `project_thin_rules.ts` already reads `ruleBody` from
      `_lib/rule_law_section.ts`, which strips frontmatter and HTML comments and
      is therefore literally "the same parser the thin projector uses". Importing
      it into the carrier and calling it at the one emission site was written,
      built and measured: **+396 B, putting the bundle 357 B over the ceiling.**
      Reverted rather than shipped.

      This is the cheapest of the five remaining steps, and it is the number
      that makes the blocker below concrete: a two-line change reusing a module
      that already exists does not fit.
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

      **Not started 2026-10-02 — blocked on `hook-bundle-ceiling-exhausted`.
      One premise of the step has changed and should not be re-derived.** It
      says the high-consequence class is "empty until it lands". It has landed:
      `road-to-rule-laws-that-can-stand` merged as #2177, and
      `src/config/rule-consequence-class.json` now carries **28 members** with
      five declared `no_stub`. `_lib/rule_consequence_class.ts` reads it and
      `_lib/rule_law_section.ts::lawText` produces the law form, so D1's
      ordering has both inputs it was waiting for and the step is implementable
      the moment there are bytes for it.

      Of the five open steps this is the one with the most user-visible cost:
      the draft's bundle run measured 109 of 323 composed strings over the
      host's 10,000-character replacement threshold, so roughly a third of
      fires are currently replaced by a path and a 2,000-character preview.
- [ ] **1.6 Re-deliver after compaction.** On the session-start slot with source
      `compact`, emit the law section of each rule in the pre-compaction
      seen-set, under the same budget. The seen-set keeps rule ids, never body
      copies.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t compact` -> 0

      **Not started 2026-10-02 — blocked on `hook-bundle-ceiling-exhausted`.**
      Needs a third binding: the manifest binds `rule-inject` on
      `user_prompt_submit` and `pre_compact` for `claude` and not on
      `session_start`, so the slot the step emits on does not currently reach
      this concern. That binding is free; the handler and the law-form emission
      behind it are not.
- [ ] **1.7 State leaves the consumer's tree.** The seen-set moves under the
      global root, keyed by project; the delivered-row ledger that
      `road-to-a-stop-that-holds` reads keeps its join. The installer writes the
      package's ignore block on the `--no-ui` path so dispatcher state under
      `agents/` does not appear as untracked files.
      verify: `npx vitest run tests/scripts/rule_inject_hook.test.ts -t state-location` -> 0

      **Not started 2026-10-02 — blocked on `hook-bundle-ceiling-exhausted`.**
      The seen-set is still written under `<workspace>/agents/runtime/state/rule-inject/`
      (`statePath`), so every consumer session leaves state in its own tree.
      `road-to-a-stop-that-holds` Phase 3 reads the delivered-row ledger this
      concern writes beside it, and the two are keyed on the same session id, so
      the join is intact for now and the move must keep it.
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

- **Status:** open
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
- **Recommendation:** raise it, with the `raise_log` entry naming this phase
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
  the scope assertion 1.3 owes.

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
- [x] AC-3 — Installer, projector and carrier return the same mode in every
      fixture of 1.2.
- [ ] AC-4 — The installed-layer report and the arrival record exist and every
      truth surface in 0.5 names the scope it was measured on.
