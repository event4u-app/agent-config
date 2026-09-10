## Acceptance Criteria

- [x] AC-1 — A session ending at a bound slot leaves a continuity record without
      model spend, and a session that did nothing substantive leaves none. The
      count comes from the concern's own state, never from file presence.
      Carried from the predecessor's AC-5.
      Measured 2026-09-08 through the real dispatcher, under
      `continuity.auto_record: on`: one authoritative record and no temp litter
      (`tests/hooks/continuity_writer_dispatch.test.ts`), none for a session
      that crosses the recycle threshold but not the substantive floor, and none
      for a session with no claimed roadmap. The threshold-crossed-but-not-
      substantive fixture is the one that separates the two: it proves the
      decision comes from the counters and not from the threshold, and a
      further fixture shows an existing record in the slot does not change the
      transformation. No provider, network or child-process import reaches the
      writer, asserted statically over its own import list.
      The default stays `off` per 1.2, so this criterion describes a capability
      the tree HAS and does not exercise by default — stated here rather than
      left for a reader to infer from a green box.
- [-] AC-2 — `./scripts-run src/scripts/check_continuity_surface` reports
      exactly `0 / 0 / 1 / 1 / 0`, and no exclusion in its inventory represents
      a normal-path continuity mechanism that would change the vector if
      counted. Carried from the predecessor's AC-7b; the vector read
      `1 / 2 / 5 / 1 / 1` when this roadmap was written.
      **Still `1 / 2 / 5 / 1 / 1`, measured 2026-09-08 after Phase 1 closed** —
      unchanged, and unchanged on purpose. Phase 1 adds a producer for the
      artifact that is already counted (`recycle-envelope.json`), so it moves no
      axis; Phase 3 is where every axis moves, and none of its four steps is
      done. This is Risk 1 of this roadmap holding exactly as written: the
      writer landed, the retirements did not, and the gate's own output is what
      makes that impossible to narrate past.

      **CANCELLED 2026-09-10 under the owner's written delegation to the AI
      council. NOT ACHIEVED, NOT RE-SCOPED, NOT SATISFIED — and the criterion
      above stands verbatim.** The required vector remains `0 / 0 / 1 / 1 / 0`.
      The observed post-decision vector is `1 / 1 / 4 / 1 / 0`.

      Reaching the required vector would mean reversing retained contracts held
      by **three different authorities**, which is why no lane and no single
      council can close it:
      - **Axis 1 (`verb:session:recycle`)** — retained by this roadmap's own
        step 3.2 council decision of 2026-09-10.
      - **Axis 2 (`picker:agent-handoff`) and two of axis 3's four rows
        (`handoff-context.md`, `session-eol`)** — held by the OWNER's
        2026-09-06 preservation of `handoff` / `/agent-handoff`, which no
        council has been asked to revisit.
      - **One of axis 3's rows (`context-fill.json`)** — retained by the AI
        council of 2026-09-09, recorded in the blocker
        `context-fill-retirement-has-a-parked-consumer`.

      The contradiction is older than this roadmap and was recorded rather than
      resolved when the inventory was written: the `verb:handoff` exclusion note
      in `src/config/continuity-surface.json` already says *"read as a bare
      count of existing public commands, the parent's target of 0 is unreachable
      while its own resolution keeps this verb alive"*, and the
      `picker:agent-handoff` row says the tension is *"recorded here so it is
      visible in the count rather than argued away"*.

      **How this disposition was reached, because the lane must not pick its own
      completion.** The first council of 2026-09-10 SPLIT on this criterion —
      anthropic for re-scoping it to the observed vector and ticking the box,
      openai for leaving it open at 10/11 on the ground that *"replacing its
      target with the current reachable state and then checking the box is
      retrospective redefinition by the body seeking roadmap completion"*. A
      split is an escalation condition here, so it was escalated rather than
      resolved by the lane: a second council (2 seats, two rounds, peer review,
      $0.0000, quorum 2/2) ruled **convergently for a third disposition neither
      seat had proposed** — preserve AC-2 verbatim, mark it `[-]`, archive as
      *10 satisfied + 1 cancelled*. openai: *"A terminal `[-]` is neither an
      open criterion nor a successful one."* anthropic: *"Cancellation with full
      documentation addresses [Risk 1] by being honest about non-achievement
      while providing proper closure."*

      **The glyph's owner-reservation** is discharged by the owner's written
      delegation of this run to the council and by that council's explicit
      ruling on the glyph — the same basis step 2.1 carries, cited rather than
      assumed.

      **What this cancellation does NOT do**, as both seats required:
      it does not amend `targets` in `src/config/continuity-surface.json`
      (unchanged at `0 / 0 / 1 / 1 / 0`); it does not claim AC-2 satisfied; it
      does not claim 11/11 or 100 % acceptance; and it does not relax the
      ratchet, which still fails a branch that GROWS any axis.

      **Terminal accounting for this roadmap: 10 criteria satisfied, 1 criterion
      cancelled under delegated owner authority. It did not achieve AC-2.** The
      dashboard's completion percentage counts checkboxes and excludes `[-]`, so
      it will read 100 %; that number is a checkbox count and is not an
      acceptance claim, and this paragraph is here so no reader mistakes one for
      the other.

      **Revisit-if:** reconsideration is routed to the authority governing each
      affected retained contract, not to whoever reads this next — a council for
      axis 1 and for `context-fill.json`, the OWNER for the `/agent-handoff`
      preservation that holds axis 2 and two of axis 3.
- [x] AC-3 — Disabling any one of the three lifecycle switches restores
      pre-change behaviour for that handler and leaves the other two firing,
      proven by a test rather than by the rollback note that describes it.
      Measured 2026-09-08: `tests/hooks/continuity_switches.test.ts` drives the
      real dispatcher on both slots with an all-armed baseline and then one case
      per switch, each asserting ALL THREE outcomes so an entanglement fails
      rather than passes. Sensitivity: forcing `continuity.auto_record` on reds
      2 cases, forcing `continuity.run_checkpoints` on reds 1, inverting the
      checkpoint guard reds 5.
      One limit, named rather than papered over: for `memory.session_index` the
      case proves the OFF direction and the independence (the stop handlers are
      byte-for-byte identical either way), NOT the ON injection — with the
      switch armed a scratch workspace emits no `memory-index` block, because
      it carries no curated corpus. The injection half is covered by
      `tests/scripts/session_memory_index.test.ts`.

### blocker: chat-history-settings-description-needs-the-main-checkout

- **Status:** resolved 2026-09-10
- **Owner:** implementer
- **Asked:** 2026-09-09, while executing step 3.4. Found beyond the audit's
  checklist, attempted, and rolled back rather than shipped half-done.
- **Blocks:** nothing in this roadmap. Recorded because one of its three stale
  clauses went stale in THIS change, so it is partly our doc-drift and not purely
  inherited debt.
- **What is wrong.** `src/server/schemas/settings.ts:176` describes
  `chat_history.enabled` as *"Persist a structured log … so `/chat-history:show`,
  `:import`, and `:learn` can replay sessions"*. All three verbs are now gone —
  `:show` and `:learn` were retired earlier, `:import` by step 3.4 — and the path
  it names is not the real one either. The string is mirrored into
  `docs/settings-reference.md` and into `dist/install/install.mjs`.
- **Why it is not fixed here, and this is a worktree fact rather than a
  judgement.** The fix is three lines, but landing it requires
  `npm run build:install-bundle`, and in a worktree that resolves the symlinked
  `node_modules` as `../../../node_modules/…` and rewrote **190 lines** of the
  bundle with worktree-relative paths. CI rebuilds the bundle and asserts
  `git diff --exit-code -- dist/install/`, so a stale committed bundle reds and a
  path-poisoned one is worse. The attempt was reverted; the three files are
  byte-clean.
- **If you do nothing:** a consumer reading the settings reference is told three
  retired commands can replay their sessions. Nothing breaks; the documentation
  lies.
- **What to do:** from the **main checkout**, not a worktree — rewrite the
  description to name only recording, run
  `./scripts-run src/scripts/generate_settings_reference` and
  `npm run build:install-bundle`, and commit all three together.
- **Resolved when:** `grep -n 'chat-history:show' src/server/schemas/settings.ts`
  returns nothing, `docs/settings-reference.md` matches the regenerated output,
  and `git diff --exit-code -- dist/install/` is clean after a bundle rebuild.
- **RESOLVED 2026-09-10, in the worktree — and this entry's own reason for
  deferring it turned out to be avoidable, which is worth more than the fix.**
  All three criteria are met by execution, not by re-scoping:
  1. `grep -c 'chat-history:show' src/server/schemas/settings.ts` → **0**. The
     description at `src/server/schemas/settings.ts:176` now reads
     *"Persist a structured log of every chat turn to
     `agents/runtime/.agent-chat-history` (JSONL). Recording only — no command
     in this package replays a session from the file…"*. It names no verb at
     all, which is what makes the grep pass rather than a rephrasing that still
     mentions them; and it names the REAL path, which this entry noted was also
     wrong (`DEFAULT_FILE` at `src/scripts/chat_history.ts:51`), not
     `.agent-config/chat-history/`.
  2. `docs/settings-reference.md:48` regenerated via
     `./scripts-run src/scripts/generate_settings_reference`.
  3. `dist/install/install.mjs` rebuilt.
  **How the worktree obstacle was cleared, measured rather than worked around.**
  This entry recorded that `npm run build:install-bundle` in a worktree rewrites
  ~190 lines with worktree-relative paths, and that is exactly what happened:
  **189 occurrences** of `../agent-config/node_modules/` where a clean checkout
  emits `node_modules/`. But the poisoning is a **pure string prefix** in esbuild's
  module comments and registry keys — nothing semantic — so reversing it
  reproduces the clean build. After
  `s.replace('../agent-config/node_modules/', 'node_modules/')`,
  `git diff -- dist/install/` contains **3 changed lines and nothing else**: the
  `chat_history.enabled` description and the two `continuity.auto_record` lines
  from step 3.2. Zero `/Users/` and zero `../agent-config` remain in the file,
  and a second rebuild-plus-normalise is byte-identical to the first, so the
  step is deterministic rather than a lucky pass.
  That diff IS the proof: it is taken against the committed bundle, which was
  built in a clean checkout. An unfaithful normalisation would have left extra
  lines; none appeared. `npm run build:cli` was then run separately — the second
  CI gate over this tree (`.github/workflows/tests.yml:319`) — and reported no
  drift under `dist/install/`.
  **Revisit-if:** esbuild changes how it renders module keys, or the bundle grows
  a path that is worktree-dependent in a way a prefix swap cannot reverse. Then
  the main checkout is the only route and this entry's original instruction
  stands.

### blocker: auto-record-fail-closed-was-carried-by-the-default

- **Status:** resolved 2026-09-10
- **Owner:** implementer
- **Asked:** 2026-09-10, while executing step 3.2. Found by a fixture going red,
  routed to the council before anything was committed, and repaired in the same
  change rather than recorded for later.
- **Blocks:** nothing. It is recorded because a documented safety property that
  no code carries is worse than an undocumented one, and because the mechanism
  that produced it is shared with at least one sibling reader.
- **What was wrong.** `auto_record_enabled`
  (`src/scripts/_lib/continuity_writer.ts`) is documented in three places —
  its own docblock, `docs/contracts/continuity-rollback.md`, and step 1.4 above
  — as failing CLOSED: a settings cascade the user has broken must leave the
  producer disarmed. Its shape is `try { …read… } catch { } return false`.
  Measured 2026-09-10 with a project `.agent-settings.yml` containing
  `:\n  - [\n`: `load_agent_settings` does **not** throw. It skips the broken
  layer and returns the shipped template's value. So the `catch` never ran for
  that case, the property was carried by the template saying `off`, and step
  3.2's flip to `on` removed it. The fixture written to pin it
  (`tests/hooks/continuity_switches.test.ts`, *"fails CLOSED on the sibling
  switch"*) went red — which is the test doing its job, and is how this was
  found rather than shipped.
- **If you do nothing:** a class-C `consent` key documented as fail-closed arms
  an automatic producer whenever a user's YAML has a typo, and three documents
  keep claiming otherwise. Nothing breaks loudly; the promise is just false.
- **What to do:** it is done — but the route matters and is recorded because the
  cheap alternative was available and refused. An AI council of 2026-09-10
  (2 seats, anthropic/claude-sonnet-4-5 + openai/codex-default, subscription
  transport, $0.0000, quorum 2/2, two rounds with peer review) was given three
  options: (A) make fail-closed real, (B) flip the documented polarity to
  fail-open to match `run_checkpoints_enabled`, whose stated rule — *"governs
  behaviour the tree already had"* — now describes `auto_record` too, or (C)
  change no behaviour and correct the documentation to say the polarity is the
  template's. **Both seats chose (A)**, and both classified (B) as owner-reserved.
  openai: *"The defective implementation is grounds to repair the protection,
  not authority to repeal it."* And directly on the binding condition attached
  to step 3.2's own verdict — *does changing a documented failure polarity on a
  class-C consent key count as weakening a class-C protection?* — openai:
  *"**Yes.** … It may be a defensible policy change, but it requires explicit
  owner authorization."* anthropic reached (A) too and added the timing
  argument: *"we are not in a post-flip cleanup … ensure the documented property
  is real before the flip happens"*, which is what happened.
  **Executed:** `settings_layer_states` in `src/scripts/_lib/agent_settings.ts`
  reports per-layer validity (`absent` · `valid` · `malformed`) for the layers a
  human edits, so no reader has to infer validity from a resolved value;
  `auto_record_enabled` consults it BEFORE reading the value and returns `false`
  on any malformed layer, with a best-effort stderr diagnostic naming the file.
  The template is excluded from the probe on purpose: a malformed template is a
  package defect that already resolves every key to absent, so reporting it
  would blame a user who did nothing wrong.
  **The diagnostic is a required attempt with non-guaranteed delivery**, per the
  council's fourth answer: the Stop slot never blocks and the dispatcher does
  not forward a concern's stderr on every host. Documented that way rather than
  as a warning the operator will see.
  **Tests, five cases per openai's matrix** in
  `tests/scripts/continuity_writer.test.ts`: absent project layer → template
  `on`; explicit `on` → enabled; explicit `off` → disabled; malformed layer →
  disabled; and the one that carries the repair — malformed layer **while the
  template says `on`** → disabled, which is `false` only if the verdict no
  longer comes from the resolved value. Plus a bound case (a VALID layer that
  omits the key still resolves the template), so the fix cannot creep into
  disarming on any project file at all. The switches fixture is restored under
  its original name and now tests the mechanism the name claims, with a second
  case asserting both polarities disagree on the SAME broken cascade.
- **The audit the council asked for, and its one honest finding.**
  *"Audit other documented fail-open/fail-closed readers for the same
  loader-semantic mistake."* Two share the shape:
  `run_checkpoints_enabled` (same file) and `session_index_enabled`
  (`src/scripts/session_memory_index.ts:55`, comment *"fail-closed: unreadable
  settings → default off"*). **Both claims are currently TRUE and both are
  accidental** — `run_checkpoints` ships `on` and claims fail-open;
  `memory.session_index` ships `off` and claims fail-closed; in each case the
  template value happens to equal the claimed failure state. Neither is changed
  here: hardening a reader whose claim is correct changes no behaviour, and the
  diff belongs to the key whose default actually moved. What the audit leaves
  behind instead is a notice in each place that the claim rides on the default,
  so the next default flip cannot repeat this quietly.
- **Resolved when:** `auto_record_enabled` returns `false` for a malformed
  project settings layer while the shipped template says `on`, proven by a
  fixture that fails if the verdict comes from the resolved value, and the three
  documents claiming fail-closed name the mechanism that carries it.
- **Revisit-if:** `memory.session_index` or `continuity.run_checkpoints` changes
  its shipped default, at which point that reader needs the same repair; or
  `load_agent_settings` starts distinguishing the two cases itself, at which
  point `settings_layer_states` becomes redundant rather than load-bearing.

### blocker: loss-class-corpus-is-empty-after-hot-context

- **Status:** resolved 2026-09-10
- **Owner:** implementer
- **Asked:** 2026-09-09, while executing step 3.1. Not a governance question — a
  measured hole the step's own change opened.
- **Blocks:** nothing in this roadmap. Recorded because a gate that stopped
  seeing a real transform is worse than one that never saw it, and the change
  that emptied its corpus is the right place to say so.
- **What happened.** `check_loss_class_declared` matches a concern script only
  when its text carries both an emit pattern and a lossy pattern (`\bredact`,
  `\btruncat`, `(WORD|CHAR|MAX)_(CAP|CHARS|LEN|WORDS)`). Before 3.1 exactly ONE of 58 hook
  scripts matched — `hot_context_hook.ts`, on `_redact_lines` and `WORD_CAP`.
  Both left with the cache. Measured after the change: 58 scanned, 0 matched,
  gate green.
- **Why that is a hole and not bookkeeping.** The memory index still applies a
  30-row cap (`SESSION_INDEX_ROW_CAP` / `capRows` in
  `src/scripts/_lib/session_index_trust.ts`), which is a lossy, model-facing
  transform by the contract's own definition. It sits in a `_lib` module rather
  than a concern script, and the detector reads concern scripts only — so the
  transform survives and the gate can no longer see it. A gate that scans
  nothing exits green.
- **If you do nothing:** the gate stays green over an empty corpus and stops
  being evidence of anything. Nothing breaks; the guarantee quietly stops
  applying.
- **What to do:** widen `check_loss_class_declared` past concern scripts to the
  `_lib` modules a concern reaches, or declare `loss_class` on
  `session_index_trust.ts` and teach the detector to read it. Either way the
  three surfaces that record "1 module qualifies" —
  `src/scripts/check_loss_class_declared.ts`, `docs/contracts/loss-classes.md`
  and the `src/config/gate-coverage.yml` row — move together with it.
- **Resolved when:** `check_loss_class_declared` reports at least one matching
  module again AND that module is the one applying the surviving cap, with
  `tests/scripts/_lib/loss_class.test.ts` asserting it.
- **RESOLVED 2026-09-10 — and the FIRST of the two routes this entry offered
  does not work. That is the finding, and it was measured before being
  believed.**
  `check_loss_class_declared` now reports **1 model-facing module**, and it
  names `src/scripts/_lib/session_index_trust.ts` on its own green line.
  **Why not route (a), "widen past concern scripts to the `_lib` modules a
  concern reaches".** Measured on this tree: a transitive static-import closure
  over all 58 concern scripts yields **11** applied-lossy modules, of which
  **9 match on an identifier rather than on a transform** — a `truncated:
  boolean` field naming file rotation (`_lib/session_eol.ts`), a settings key
  called `knowledge.global_sharing.redaction.enabled` (`_lib/agent_settings.ts`),
  a regex literal that DETECTS `truncate table` in someone else's command
  (`_lib/subagent_capsule.ts:613`). That is the pro-forma-corpus failure this
  gate's own comment-stripping exists to prevent, one layer up — and it is the
  broad-allowlist backlog the 2026-08-28 council rejected option (a) for.
  Decisively, the closure **does not contain `session_index_trust.ts` at all**:
  the only concern that reaches it, `hot-context`, loads it through
  `createRequire` for bundle safety (`src/scripts/hot_context_hook.ts:117`), so
  no static walk sees the edge. A widening that misses the module it was written
  for, while adding nine it was not, is not a widening.
  **A second measured fact this entry did not have.** Even inside the corpus the
  module would not have matched: the lossy pattern set is
  `\bredact` · `\btruncat` · `(WORD|CHAR|MAX)_(CAP|CHARS|LEN|WORDS)`, and the
  surviving cap is `SESSION_INDEX_ROW_CAP` / `capRows`, which matches none of
  them. So route (a) had two independent failure modes, not one.
  **Route (b), executed: `loss_module:`.** A concern script names the module
  carrying its lossy transform in its own docblock —
  `src/scripts/hot_context_hook.ts` now carries
  `loss_module: src/scripts/_lib/session_index_trust.ts` — and the gate then
  REQUIRES that module to declare. The polarity is the opposite of an allowlist:
  a pointer at an undeclared, absent, or out-of-tree module FAILS, so the
  pointer adds to the gate rather than removing from it.
  `src/scripts/_lib/session_index_trust.ts` declares
  `loss_class: recoverable-lossy` with
  `loss_recovery: agents/memory/` — recoverable rather than ephemeral because
  the rows `capRows` drops stay in the curated corpus, addressable by entry id,
  and P4's declared total order is what makes "the rows below the cap" a stable
  set rather than whatever the store returned.
  **Parser + gate:** `parseLossModulePointers` in
  `src/scripts/_lib/loss_class.ts`; the pointer loop in
  `src/scripts/check_loss_class_declared.ts`. **Self-test: 13/13, 7 rejecting**
  (floor raised 7 → 12 cases, 3 → 7 rejects), the five new cases being a pointer
  at an undeclared module, at a declared one, at a `recoverable-lossy` with no
  locator, at an absent path, and at a path escaping the tree.
  **Sensitivity, run rather than reasoned:** replacing `loss_class:` with
  `loss_klass:` in the pointed module turns the gate red with
  *"hot-context → src/scripts/_lib/session_index_trust.ts, pointed at by
  src/scripts/hot_context_hook.ts shortens content on a model-facing path and
  declares no loss_class"*; restoring it returns green.
  **The three surfaces that recorded "1 module qualifies" moved together with
  it**, as this entry required: the gate's own docblock, `docs/contracts/loss-classes.md`
  (new § `loss_module:`, carrying the 11-versus-2 measurement so a future lane
  does not re-attempt route (a)), and the `check_loss_class_declared` row in
  `src/config/gate-coverage.yml`.
  **What this still does NOT catch, stated rather than implied:** an UNPOINTED
  lossy transform in a module a concern reaches. The gap is strictly narrower
  than the one it replaces — that was every non-concern module, with an empty
  corpus to show for it — and closing it needs a detector matching an APPLIED
  transform rather than an identifier. The 11-versus-2 measurement above is the
  evidence for what building that has to clear, and it is recorded in the
  contract rather than left for the next lane to re-derive.
  **Revisit-if:** a lossy `_lib` transform is found that no concern points at,
  or the applied-transform detector becomes cheap enough to build.
