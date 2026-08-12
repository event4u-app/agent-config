---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to inbox harvest 2026-08-b — dispatch safety

> Close four checkable gaps on the dispatch surface: a scoped `Bash(<prefix>:*)` grant
> becomes expressible and the one shipped subagent stops holding a full shell; a staged
> irreversible action gets a registry-level confirmation flag with exactly-once
> execution; the handoff envelope gains two validated fields plus one shape lint; and
> self-repair complaint creation gains a per-source rate cap. Zero new rules, zero new
> skills.

> Source (consumed inbox): `agents/tmp.old/ac-host-flag-compilation`,
> `agents/tmp.old/ac-orchestration-deltas`, `agents/tmp.old/better-handoff.txt`,
> `agents/tmp.old/ac-role-catalog`, `agents/tmp.old/ac-factory-mechanics` — part of the
> 2026-08-10 batch triaged by
> [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

**The tool grant is a build-time schema question, not a hook question.** The bundles
proposed a PreToolUse layer for per-agent tool scope; that layering is inverted.
`src/scripts/schemas/subagent.schema.json:46-55` enum-validates `tools` at build time
and `src/scripts/condense.ts:2045-2060` projects `{name, description, tools, model}`
verbatim into `.claude/agents/<name>.md`, so the host already enforces it. What is
broken is the enum — line 52 admits only the bare token `Bash`, making
`Bash(npm run:*)` inexpressible, while `src/rules/tool-safety.md:40` prescribes the
opposite ("Prefer scoped-grant syntax over bare tool names"). The one shipped subagent
therefore holds a shell: `.claude/agents/production-validator.md:4` reads
`tools: Read, Grep, Glob, Bash`. Precedent for both halves sits in the sibling schema —
`skill.schema.json:211-217` carries the scoped-grant guidance, `:218-224` carries
`disallowed_tools`. **The rule needs no edit**; ADR-109 gets an amendment note, not a
new record. And the detector that would catch this cannot see the file:
`src/scripts/lint_skill_frontmatter_safety.ts:39` carries a `_BARE_BASH` regex and
reports a bare grant as HIGH (`:220`), but its roots at `:261` are `src/skills`,
`src/agent-src`, `src/domains` — `src/subagents` is absent — and the key it reads is
`allowed_tools` / `allowed-tools` (`:48`, `:201`), not the subagent `tools:` key.

**The confirmation policy is complete; only the mechanism is missing.**
`src/rules/non-destructive-by-default.md` already states "Never act while asking", the
strictly-sequential ordering, and that the approval names the exact object.
`requires_confirmation` returns **0 hits** across `src/` and `docs/`, and no
exactly-once machinery exists. Extendable precedents: the `ask` / `ask_timeout` path in
`src/agent-src/templates/scripts/work_engine/hooks/builtin/decision_gate.ts:100-109`,
and `skill.schema.json:218` as the registry-flag shape. Host coverage bounds any guard:
`src/scripts/hook_manifest.yaml` binds `pre_tool_use` on 3 of 8 platform rows — augment
`:531`, claude `:539`, cowork `:578`; `agent-config hooks:status` is the per-install
check.

**The handoff test is presence, not effect.**
`agents/roadmaps/archive/road-to-cost-parity-3-handoff-envelope.md:229-231` (blocker
`handoff-content-adjudication`, resolved 2026-08-10): "A field whose presence is
checkable survives where a doctrine whose effect is unmeasured did not, and that is the
whole distinction." Against that bar: `do_not_touch` returns 0 hits in `src/`, nearest
is `constraints?` at `src/scripts/_lib/subagent_capsule.ts:238`; and while
`reversibility` appears 36 times in `src/` as prose, it appears **0 times** across the
four handoff surfaces (`_lib/subagent_capsule.ts`, `_cli/handoff_generate.ts`,
`_lib/envelope_grounding.ts`, `lint_handoffs.ts`) — the gap is field-absence, not
word-absence. `lint_handoffs.ts:342-360` validates required *headings* only.

**The turn-end primitive already ships, default OFF** —
`turn_end_gate_hook.ts:107` declares `DetectorId = 'promissory' | 'language'`,
`hook_manifest.yaml:445-449` carries `fail_closed: false`, and
`src/config/agent-settings.template.yml:1216-1219` keeps the master switch
`enabled: false` with both detectors on inside it, so the mechanism soaks before it
binds. Only a third detector is missing, and the soak stays.

## Phase 1 — Scoped tool grants

- [x] **1.1 Widen the subagent `tools` enum to admit a scoped grant.** Shipped as
      a `pattern` that keeps the base name closed — a typo still fails CI — while
      admitting an optional `(...)` suffix. Two pointer corrections worth
      recording: the field is `tools`, and `skill.schema.json`'s `allowed_tools`
      does **not** already model the syntax with a pattern — it permits it by
      validating nothing, which is a weaker thing and not a template to copy.
      The `curl` assertion still holds, but the test asserting it had pinned
      `rule === 'enum'` — the keyword rather than the subject — so it reddened
      on behaviour that had not changed. Rewritten keyword-agnostically and
      widened with the cases nothing covered: a scoped grant accepted,
      `Frobnicate(anything:*)` rejected, four malformed scopes rejected.
      <!-- verify: task test -- --filter=subagent_contract -->
- [ ] **1.2 Narrow `production-validator` to the prefixes it needs.** Edit
      `src/subagents/production-validator.md` so the shell grant becomes the command
      families the audit runs, then regenerate so
      `.claude/agents/production-validator.md:4` no longer carries a bare `Bash`.
      **Left OPEN deliberately, with the finding that argues against it.** 1.1
      made the narrowing expressible, which is all this step depended on. But the
      validator's own procedure step 3 is "find evidence the real path executed"
      — against whatever dependency and whatever runner the *consumer* project
      uses. A portable suite cannot enumerate those command families, and a scope
      that guesses wrong makes the validator report a missing run it was merely
      forbidden to attempt: the worst failure available to a gate whose output is
      a READY line. What shipped instead is the reason, written into the
      frontmatter so the bare `Bash` no longer reads as an oversight. Closing
      this needs a call on which is worse — an over-broad grant on a read-only
      auditor, or an auditor that cannot run the project's own tests. Maintainer
      decision, not an agent edit.
      <!-- verify: grep -n 'tools:' .claude/agents/production-validator.md -->
- [x] **1.3 Extend the existing safety linter to the subagent corpus and key.** Both
      halves were **already shipped** — `src/subagents` is the fourth scan root and
      `_RE_TOOLS_KEY` reads the top-level subagent `tools:` key, so the finding
      reaches the file and is disposed there by a committed `security-lint: allow`
      pragma rather than suppressed by blindness. **But verifying it with this
      step's own command read the opposite of the truth, and that was a live
      defect:** `security_lint.report` printed a hardcoded `DEFAULT_SCAN_ROOTS`
      note, so this gate announced `scanned src/skills, src/rules, src/agent-src,
      src/domains, dist/agent-src` — claiming two roots it never reads and omitting
      `src/subagents`, the one root the over-broad-grant check exists for. Fixed at
      the source: `report` takes an optional `scanned_roots` and the note names the
      corpus actually walked, the same contract `_lib/scan_scope.reportScanned`
      already holds. **Sibling search — the exact construct is `sl.report(...)`
      called by a gate whose real roots differ from `DEFAULT_SCAN_ROOTS`: 2 of 5
      callers matched** (`lint_skill_frontmatter_safety.ts:350` replaces the set,
      `lint_mcp_config_security.ts:242` appends `src/templates`); the other three
      (`lint_confusables`, `lint_hidden_unicode`, `lint_instruction_smuggling`) pass
      `DEFAULT_SCAN_ROOTS` verbatim and were already truthful. Both divergent sites
      now pass their real roots. Five specs pin the property "the note equals the
      roots passed, for any roots" plus the empty-list and no-argument fallbacks.
      <!-- verify: ./scripts-run src/scripts/lint_skill_frontmatter_safety -->
- [x] **1.4 Record the contract change as an ADR-109 amendment note** — landed as
      Amendment 4, in the shape the file's three existing amendments already use
      (additive, explicit "no `status: accepted` change"). It records three things
      rather than one: that the pattern is additive because every previously valid
      value still validates and the base token stays closed; that expressible is
      not mandatory, with 1.2's argument as the worked case; and which detector
      reads the field, so the contract names its own enforcement instead of
      implying it. Doc-only.
- [-] **1.5 Host-flag compiler (`--allowedTools` / `--max-turns` / `--model`) and an
      NDJSON `stream-json` driver — cancelled, no call site.**
      `src/scripts/_lib/subagent_spawn.ts:1-12` is declared "Pure, no-I/O" brief
      composition and the host spawns; the only `claude` subprocess is the council text
      client (`src/scripts/ai_council/clients.ts:1416,1447`,
      `--print --output-format json`, non-streaming). `stream-json`: 0 hits in `src/`.
- [-] **1.6 Spawn-env allowlist — cancelled, contradicts an accepted record.**
      `docs/decisions/ADR-123-runtime-security-scope-and-spawn-hardening.md:120-121`
      lists "Env allowlist instead of deny-by-family" as a **rejected** alternative and
      `:164-166` reaffirms "Deny-by-family stands unchanged";
      `src/scripts/_lib/spawn_env.ts:28-33` gives the reason. The proposed six-variable
      set omits the `ANTHROPIC_*` variants and config paths the council transport needs.

## Phase 2 — A confirmation primitive for staged irreversible actions

- [x] **2.1 Add `requires_confirmation` as a registry-level flag.** Shipped on the
      `disallowed_tools` shape (optional, additive, schema-backed) in **two**
      schemas, not one: `skill.schema.json`'s `execution` block, and
      `command.schema.json` **top-level** — the step says "a command or skill",
      and commands carry no `execution` block, so a single-schema edit would
      have left half the stated surface unable to declare it. Boolean rather
      than an object on purpose: the flag names the action CLASS, while
      `non-destructive-by-default`'s "names the exact object" clause is about an
      object that exists at stage time and cannot be in frontmatter — a richer
      shape here would invite authors to pre-name objects the mechanism must
      read at runtime. 436 artefacts validate, 0 failing; six specs pin
      accepted-true, accepted-false, omitted, and a non-boolean rejected on both
      schemas (a flag that accepted `"yes"` would read as set while being
      unreadable).
      <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [x] **2.2 Implement exactly-once confirmed execution.** Shipped as
      `staged_confirmation.ts` (pure: derived token, TTL, `confirmOnce`,
      `declineStage`, the non-interactive decision) plus
      `staged_confirmation_store.ts` (I/O) in the work_engine `hooks/builtin`
      tree, beside the gate the step points at.
      **The premise is right and one consequence is not: exactly-once cannot
      live in the pure half at all.** A `state:` field read-then-written is a
      check-then-act race — two callers both read `pending`, both conclude
      `execute`. So the pure module decides what a confirmation MEANS and the
      store makes the transition atomic with a **directory rename**
      (`pending/` → `resolved/`): the first caller wins, every later one gets
      `ENOENT` and reports `already-confirmed` without acting. The state lives
      in the path *because* a field cannot carry the guarantee.
      **Deviation, deliberate:** `decision_gate.ts` gains an *injected*
      `ConfirmationStager` (default `null`), not a direct call. Its `ask` branch
      only appends the confirmation surface when a stager is passed, so the
      shipped path stays byte-identical — 2.4 has not decided whether the
      primitive binds, and a mechanism that arrived bound with an upgrade would
      pre-empt exactly that decision. The `ask_timeout` fallback is untouched
      and `nonInteractiveDecision` mirrors its vocabulary: **both** `stop` and
      `warn` refuse, differing only in loudness — the permissive branch is
      absent on purpose and a test asserts its absence.
      **One risk the roadmap did not name, surfaced by the AI council on the
      pick and closed here:** a stage whose confirmation never comes. An
      approval that stays valid indefinitely IS a pre-approved irreversible
      action, so `STAGE_TTL_MS` (15 min) expires it and `stageStatus` derives
      expiry **from the clock, not from a sweep having run** — skipping the
      pruner changes what is listed, never what may execute. A test pins the
      case the naive fix gets wrong: after `pruneExpired` moves the record
      aside without rewriting `state`, a status read off the field would answer
      `already-confirmed` for a stage that never fired.
      **The surface names no confirming command.** An earlier draft printed
      `agent-config gates --confirm <token>`; that flag does not exist and which
      channel confirms is precisely what 2.4 defers, so shipping it would have
      put a false instruction into a shipped surface — the same defect class 1.4
      records. The channel is now a caller-supplied parameter, and a test
      asserts `--confirm` does NOT appear by default. 37 specs.
      <!-- verify: npx vitest run tests/scripts/staged_confirmation.test.ts tests/scripts/work_engine/hooks_builtin_decision_gate.test.ts -->
- [x] **2.3 Make pending confirmations enumerable through an existing verb** —
      shipped as `gates --pending` (+ `--json`), a flag on `gates`, no new
      command. **The host is `gates`, not `self-repair:status`:** that step named
      the latter as the *enumeration precedent* (its shape), and reading it as
      the host would have put staged actions under a verb whose subject is
      defect records. `gates` is defined as "open decisions that need you, as
      actions" — a staged irreversible action is the most literal instance of
      one, so this is the second source under an existing definition rather than
      a widened one.
      Two shape decisions: `--pending` is answered **before** the
      roadmaps-directory exit (a staged action is independent of whether the
      project plans in roadmaps at all, so "no roadmaps here" is not an answer),
      and expired stages are **counted, never listed** as actionable. It stays
      **out of `--reply`**: ADR-222 fixes that form at exactly ONE decision
      rendered in full, and folding a second source in would silently change
      which decision "the one" is — not this step's contract to move.
      Projection verified, not assumed: the cross-subtree import
      (`../templates/scripts/work_engine/...`) resolves in `src/` **and** in
      `dist/agent-src/` after `task sync`, and `.augment/scripts` symlinks into
      `dist/agent-src/scripts` so the sibling `templates/` is present on both
      paths. 10 specs.
      <!-- verify: ./scripts-run dist/agent-src/scripts/roadmap_gates --pending -->
- [~] **2.4 Decide whether the primitive binds, and what the other five hosts get.**
      Deferred behind `blocker: confirmation-degraded-host-semantics` — a host without a
      `pre_tool_use` slot (5 of 8, per `hook_manifest.yaml:531,539,578`) can only carry
      the obligation in prose, and shipping a mechanism that claims enforcement it does
      not have is the failure `src/rules/ui-audit-gate.md` already names.

## Phase 3 — Checkable handoff-envelope fields

- [x] **3.1 Add a validated `do_not_touch` envelope field.** Shipped on the
      `constraints` pattern — interface entry, `RECYCLE_ENVELOPE_KEYS`, and a
      `checkList` line — but on the **REF** budget rather than the prose one,
      since the entries are path refs. It is distinct from `constraints` on
      purpose: constraints carry decisions in prose, this carries paths, so "was
      this path off limits?" is answerable by comparison instead of by reading —
      the checkability bar the handoff-envelope adjudication set. The
      `--template` skeleton carries it EMPTY rather than with a `<placeholder>`,
      unlike the prose lists: a leftover placeholder path would be a fake ref
      instead of obvious filler.
      **One instruction not followed, with the reason:** the step also said to add
      the heading to `HANDOFF_ARTIFACT_REQUIRED`. That would make the section
      mandatory in every HANDOFF.md while the field itself is optional — and 3.3
      in this same phase just established that a required-but-empty section is the
      defect, so requiring a heading whose content is optional would manufacture
      the shape 3.3 exists to catch. The field is validated where it is written;
      the required-heading list is unchanged.
      <!-- verify: npx vitest run tests/scripts/session_recycle.test.ts -->
- [x] **3.2 Add `reversibility` to each decision line** — shipped as an OPTIONAL
      trailing tag (`[reversible]` / `[irreversible]`) on a `decisions` line, both
      writer contracts updated, and the no-resumption-claim carried into the field
      doc verbatim.
      **Optional had to stay checkable or the step would have shipped exactly what
      its own citation rejects** ("a field whose presence is checkable survives
      where a doctrine whose effect is unmeasured did not"). Requiring the tag
      would invalidate every committed envelope; documenting it and validating
      nothing would be the doctrine. So `decisionTagErrors` validates the tag
      **when a line is trying to carry one**: an exact tag passes, wrong case and a
      near-miss (`[reversble]`, `[irreversible!]`) are errors, and an unrelated
      bracket (`[ADR-109]`, `[see #1273]`) is left alone. That targets the only
      failure an optional tag really has — a misspelling reads as untagged and
      silently loses the distinction the tag exists to carry. 15 specs.
      <!-- verify: npx vitest run tests/scripts/session_recycle.test.ts -->
- [x] **3.3 Lint the Open-questions shape, not just the heading.** Shipped as
      `validate_handoff_open_questions` plus `handoff_section_body`, wired into the
      artifact mode beside the missing-heading report (its summary line now counts
      both problem kinds). **The step's "false-positive class is empty by
      construction" is false, and the counterexample already shipped in this
      repo:** `tests/scripts/lint_handoffs_artifact.test.ts` carries
      `## Open questions` / `- none`, so requiring a `?` would have reddened the
      gate's own acceptance fixture and, worse, taught authors to invent a fake
      question. So the check accepts EITHER a `?`-terminated line OR an explicit
      none-marker (closed set: `none`, `keine`, `n/a`, `nothing`) and fires only
      on a section that answers neither — blank, or only `TBD` / `TODO` / `...`.
      A declarative note is left alone: this is an emptiness check, not a
      phrasing gate. Section extraction strips fenced blocks first, so a `##`
      inside a quoted command cannot end the section early. 17 specs.
      Doc-Impact: `/agent-handoff`s template and its validation sentence now
      state the shape, since the artefact contract they describe got stricter.
      <!-- verify: npx vitest run tests/scripts/lint_handoffs_artifact.test.ts -->
- [ ] **3.4 Warn on a write against a `do_not_touch` path.** **Left open with a
      measurement, not with an omission.** Its stated precondition is met — 3.1
      shipped the field — but the field has **zero producers** today: the
      `--template` skeleton offers it empty, and no envelope in the tree carries
      an entry. A tenth `pre_tool_use` concern pays latency on every tool call
      (this step says so itself) to read a list that is currently always absent,
      which is the build-the-mechanism-before-measuring-the-premise pattern this
      package has recorded three times. Sequence it after the first envelopes
      actually carry paths; the guard is then reading real data instead of
      proving it can read none.
      Model on
      `block-kernel-rule-writes` (`hook_manifest.yaml:110`) and `reread-guard` (`:480`),
      register in `src/scripts/hooks/concern_registry.ts:98-108`, advisory and
      `fail_closed: false`. The `pre_tool_use` chain already runs nine concerns
      (`hook_manifest.yaml:531`) — a tenth pays latency on every tool call.
      <!-- verify: grep -rn 'do_not_touch' src/scripts/hooks/concern_registry.ts -->

## Phase 4 — Roles, lifecycles, and the two residues

- [x] **4.1 Rate-cap self-repair complaint creation per source.** Shipped as
      `creationCapReached` / `recentCreations` in the pure half (20 new records per
      source per rolling 24 h, counted on `first_seen` so folding an old record
      never consumes budget) with `upsertFinding` returning `DefectRecord | null`.
      **The step's premise was true and its consequence was not, so the cap's
      justification is re-derived rather than inherited.** "No creation cap
      exists" is correct; "therefore records grow unbounded" is much weaker than
      it reads, because `fingerprint` hashes a *shape* — digits → `#`, quotes and
      punctuation stripped, case-folded — so spans differing only in numbers or
      punctuation are already ONE record. Measured: twenty findings varying only a
      counter produced **one** record, and a first version of the cap's own test
      exercised nothing for exactly that reason. What genuinely mints records is
      distinct WORDS, so the real runaway is the `self-detected` path, where a
      detector quotes a fresh span from every offending turn and one underlying
      defect becomes dozens of records. That is the case the cap bounds; a
      user-reported complaint in genuinely different words is a different
      complaint and correctly gets its own record.
      **Deviation, deliberate:** the step said ~10 lines, and a bare cap would
      have been. A cap that discards a report and says nothing would break this
      loop's own Iron Law ("queued and fixed — never shrugged off") in the act of
      bounding it, so a refusal increments a per-source counter in a single
      `_overflow.json` — bounded by construction, not a `DefectRecord`, so it
      needs no `DefectClass` and no issue-form entry — and `self-repair:status`
      prints the tally whenever it is non-zero. Eight specs, including the
      digit-folding boundary the first version got wrong.
      <!-- verify: npx vitest run tests/scripts/self_repair.test.ts -->
- [x] **4.2 Quarantine a stale findings artefact before a revision re-dispatch.**
      The step's staleness signal is right and its **mechanism is forbidden by the
      contract it cites** — so the signal shipped and the quarantine did not.
      Built first as designed (classify by scope hash, rename the stale artefact
      aside), then removed on reading §2.7 rather than §5: a fix pass moves the
      review scope, so an artefact bound to the previous scope is the **normal
      in-place re-bind case**, and §2.7 says renaming there "would leave the
      shipping content with no review at all → `missing-artifact`". The archival
      rename is a later, separate step with a prescribed name
      (`<slug>.round<N>-review.md`) gated on every finding being terminal. Worse,
      the invented quarantine name would have missed
      `check_review_dispositions:64`, which recognises an archived record by
      `-review.md` — i.e. it would have created an archive path with no
      terminal-before-rename check on it. Two gates dodged by one convenience
      rename.
      **What shipped instead**, and it closes the real defect: the leftover-artefact
      refusal could not distinguish three states and offered one escape for all of
      them — `--force`, which overwrites, so the only exit destroyed the record of
      a review that happened. `artefactStaleness` classifies `current` / `stale` /
      `unreadable` off the single shared scope hash, and `leftoverArtefactRefusal`
      names the contract-conform step per state: the live review for `current`,
      §2.7s two paths for `stale`, and inspect-first for `unreadable` (refusing on
      an unidentified artefact rather than acting on a guess). 10 specs.
      <!-- verify: npx vitest run tests/scripts/dispatch_r2_reviewer.test.ts -->
- [x] **4.3 Add an edit-without-fresh-verification detector to the turn-end gate.**
      Shipped as `detector C` (`DetectorId` gains `'verification'`), inside the
      existing two-layer guard, with its own settings switch and **the master
      switch NOT flipped** — the soak stays exactly as the step requires.
      **The step was right that this is bigger than a third detector, and the
      reason is precise:** `_messageText` keeps `type === 'text'` blocks only, so
      tool activity is invisible to detectors A and B — the *reply* cannot say
      whether an edit was verified. `readTranscriptTail` therefore gained a
      `toolCalls` field, reduced to `{name, command?, path?}` and nothing else:
      the evidence span lands in a refusal a human reads, and a tool input can
      hold a whole file body, so the struct is shaped to be INCAPABLE of
      carrying one (`domain-safety-pii` § Surface 2's exclusion-by-construction,
      not a scrubber). Two ordering facts are load-bearing and each has its own
      test: the calls are read BEFORE the `text === null` guard (a tool-only
      assistant entry has no text, so the old order would drop exactly the
      entries the detector needs), and the list RESETS at every genuine user
      prompt — that reset is the word "fresh" in the step title, since a
      verification three turns ago must not vouch for an edit made now.
      **The detector reads the sequence, not two counts.** It fires only when no
      verification-shaped call follows the LAST edit: a test run before the final
      edit demonstrably did not exercise it, which is the same freshness clause
      `verify-before-complete` states about trusting an earlier run.
      **What counts as verification is a narrow positive list, deliberately.**
      Treating any `Bash` call as verification was rejected: `ls` would then
      clear an unverified edit, which is the partial-verification failure that
      rule names. The cost is a missed detection where a project verifies by some
      command not listed — the safe direction for a gate that can refuse a turn,
      since a false negative costs one unguarded turn while a false positive
      teaches the user to switch the gate off. Fourteen runner spellings and five
      non-verifying commands are pinned.
      **The severity probe ran and returned a null, which is the useful outcome:**
      this file emits only 0/1 internally, `concern_block_exit_parity` pins the 1,
      and the dispatcher translates a stop-slot block to host exit 2 — asserted
      by a spawned test that already existed. C is a refusal like A and B, so
      there is no advisory path here to put on the wrong code. Recorded in the
      file header so the next reader does not re-probe it.
      Downstream sweep: `GateSettings` and `TranscriptTail` have zero consumers
      outside this hook and its test; three existing settings assertions that
      pinned the exact two-detector object were updated in the same diff, and
      `hooks.turn_end_gate.verification` was added to the class-C table in
      `settings-classes.md` (a config key changed → the doc that describes it
      changed with it). 72 specs green.
      <!-- verify: npx vitest run tests/scripts/turn_end_gate_hook.test.ts -->
- [-] **4.4 Role-contract budget fields and an eight-role catalog behind a flag —
      cancelled by record.** `ADR-109-subagent-v1-contract.md:75-76` lists
      `max_iterations` / `anomaly_caps` / per-role budget as "Banned fields (would imply
      runtime we do not have)"; Gate A (`:152-155`) ships a unit only if its eval beats
      both baselines, and no such eval result is recorded in the tree today — a unit
      without one "stays in `src/` as a documented honest-null". Seven of the eight
      proposed roles already exist as skills (`src/skills/judge-*`, 7 directories).
- [-] **4.5 `role@version` in every dispatch trace, plus PreToolUse per-role tool scope —
      cancelled, precondition unpassable.** A resolved live probe
      (`archive/road-to-token-economy-dispatch.md:435-455`) established that a subagent's
      env is indistinguishable from the parent's (`CLAUDE_CODE_SESSION_ID` carries the
      parent id) and that upstream marked per-spawn identity NOT_PLANNED;
      `src/scripts/_lib/session_role.ts:20-26` fails open to `orchestrator` by contract.
      `reviewer` is already enum-reserved at `:33-36` and already scheduled as Phase 3.2
      of `later/road-to-token-economy-dispatch-followup.md:53-57` — unpark that rather
      than re-author it.
- [-] **4.6 Typed lifecycle state machines, a per-role-branch lint, and an asyncio
      in-flight lint — cancelled.** There is one two-state runtime store
      (`src/scripts/_lib/self_repair.ts:71`, `'open' | 'released'`); the other three
      claimed lifecycles are static frontmatter enums and a grep for `transition` over
      `src/scripts/` returns only CSS rule text. A per-role-branch lint would fire on the
      dispatcher's own deliberate fail-open branch at
      `src/scripts/hooks/dispatch_hook.ts:315-322` on day one. An asyncio lint would scan
      nothing — zero authored Python remains under `src/` (`find src -name '*.py'`
      returns 0) — and the doctrine already ships at
      `src/skills/async-python-patterns/SKILL.md:63-65`.
- [-] **4.7 Programmatic tool calling (executing model-authored scripts against a tool
      RPC) — cancelled.** The largest novel mechanism in the batch and the wrong shape
      here: ADR-123 holds behavioural enforcement out of scope, and the gate-equivalence
      precondition presumes guards that bind on 3 of 8 hosts.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Confirmation primitive claims enforcement it lacks | product | On 5 of 8 hosts there is no `pre_tool_use` slot, so a staged-action guard degrades to prose while the flag reads like a control. | 2.4 stays deferred behind the blocker; the flag ships unbound until the degraded semantics are decided. | Phase 2 — A confirmation primitive for staged irreversible actions |
| 2 | Narrowing the shipped subagent weakens its audit | implementation | `production-validator` uses the shell for real probes; a too-narrow prefix set makes the audit quietly weaker rather than failing loudly. | 1.2 lands after 1.1 and is verified by regenerating and reading the projected frontmatter, not by inspecting the source. | Phase 1 — Scoped tool grants |
| 3 | Envelope-field additions inflate the payload | implementation | Two new fields plus a heading push against `RECYCLE_ENVELOPE_MAX_BYTES = 6144` (`_lib/recycle_envelope_paths.ts:35`, enforced at `_cli/cmd_session_recycle.ts:162`) and the required-heading list existing fixtures pin. | Both fields are single lines under the existing `MAX_LINE_CHARS = 240` limit (`subagent_capsule.ts:51`); fixture pins are part of 3.1 and 3.2. | Phase 3 — Checkable handoff-envelope fields |
| 4 | The third turn-end detector lands on the wrong exit code | implementation | `EXIT_WARN = 2` sits beside `EXIT_BLOCK = 1` (`dispatch_hook.ts:76-78`), so an advisory finding delivered on the wrong path becomes a hard deny. | 4.3 re-confirms the mapping as a probe and leaves the master switch off, so a mistake soaks before it binds. | Phase 4 — Roles, lifecycles, and the two residues |

## Blockers

### blocker: confirmation-degraded-host-semantics
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 2.4 only. Steps 2.1-2.3 are unblocked and land default-unbound;
  Phases 1, 3 and 4 are not blocked at all.
- **What to do:** decide what a host without a `pre_tool_use` slot gets when a
  `requires_confirmation` action is staged — a model-carried obligation stated as such,
  or a refusal to stage at all — and whether the primitive is default-on or default-off
  where the slot does exist.
- **Resolved when:** the decision is recorded (an ADR, or the ADR-109 amendment note
  from 1.4) and names both the degraded-host behaviour and the default.
