---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
depends: road-to-delivery-for-every-host
depends_on: road-to-delivery-for-every-host
relates:
  - slug: road-to-delivery-for-every-host
    relation: depends
    note: >
      Predecessor. This file may not start before that one's Phase 1 has merged,
      because admitting a host means adding it to an axis that does not exist yet.
  - slug: road-to-host-enforcement-truth
    relation: extends
    note: >
      Archived. Its 2026-09-07 host table is the input to Phase 1; this file turns
      that table's slot counts into a measured injection verdict per host.
estate_growth_exempt: "Owner-delegated drain run 2026-09-08, THIRD CHARGE: +2 open_blockers, for two entries this file owed and did not carry. Three of its steps (1.1, 2.1, 4.2) record themselves BLOCKED in their own bodies while the file had no `## Blockers` section at all, so the dashboard read 0 blockers for it and `check_estate_count` — where `open_blockers` is a RATCHETED metric — was ratcheting on an undercount. This is a CORRECTION of a miscount rather than new estate: the blockages already existed, in prose, in this file. The gate has no field for that distinction, so it takes the claim path like any growth. SECOND CHARGE — Owner-instructed 2026-09-08: +1 concern_count for `chain-nudge`, the pre_tool_use carrier that delivers token-efficiency's one-command-per-Bash-call rule at tool-call time. It is charged HERE rather than against a new roadmap because this file is the one whose subject is exactly that — turning per-host slot counts into a measured injection verdict — and opening a roadmap to hold a claim would charge +1 active_roadmaps to avoid charging +1 concern_count. The concern is bound on the three platforms already carrying code-graph-nudge, never denies, and fires once per session, so it adds no refusal surface to any host. PRIOR CHARGE — Owner-instructed 2026-09-07. Charges +1 active roadmap against the origin/main `active_roadmaps` floor of 4 measured at 0918def55 — the floor is the base-ref measurement, not a stored number (ADR-243). Successor of road-to-delivery-for-every-host Phase 1; every step here can only make a non-Claude host cheaper while keeping its rule bodies reachable, and each step is gated on an observation the tree does not yet hold."
estate_offset_exempt: "Offsets nothing. It retires the L4 'no equivalent today' row at docs/enforcement-by-host.md:176, which is a sentence rather than a roadmap, so there is no archive move available to satisfy the one-in-one-out half in this change."
---

# Road to delivery on hook hosts

> **Source.** Owner instruction 2026-09-07 out of analysis round `inbox-2026-09-u`,
> consumed to `agents/tmp.old/inbox-2026-09-u/`. Re-measured at `0918def55` (v14.20.0)
> before authoring; corrections forced by that re-measurement carry
> `corrected-from-reproduction`. Owner ruling **E3** is decided in this file. Starts only
> after `road-to-delivery-for-every-host` Phase 1 has merged (host-scoped
> `lean_projection.hosts`).

## Goal

Every host other than Claude Code is measured for whether hook stdout on
`user_prompt_submit` reaches the model's context; hosts where it does join
`lean_projection.hosts` and pay the same standing tokens as Claude; hosts where it does not
keep their full rule bodies and lose nothing; and Cursor and Windsurf stop carrying `auto`
rules twice — witnessed by the per-host census from the predecessor's Phase 0, re-run after
each phase.

## Prerequisites

- [x] Predecessor Phase 1 merged (`lean_projection.hosts` exists, non-regression gate
      green).
      **MET 2026-09-09 — on `origin/main`, which is what the criterion asked for.**
      `lean_projection.hosts` exists in the shipped template
      (`src/config/agent-settings.template.yml:214`, `hosts: [claude-code]`) and resolves
      to `["claude-code"]` by default, and the non-regression half is green measured on
      `origin/main`: `check_host_tree_parity` reports *2 non-delivery host tree(s)
      byte-identical to eager-all · delivery hosts [claude-code]*, and
      `check_rule_projection_integrity` reports *140 rule projection entries complete and
      fresh across 3 host rule tree(s)*. Phase 2 is therefore no longer gated on a
      predecessor branch.
      The paragraph below is the 2026-09-08 reading, kept because it records what the
      criterion looked like while it was unmet rather than being rewritten to look like it
      was always fine:
      NOT MET 2026-09-08, and it is met on a branch rather than on `origin/main`.
      `road-to-delivery-for-every-host` Phase 1 is complete and green on
      `drain/delivery-for-every-host` — `lean_projection.hosts` exists, the stub write is
      host-gated, `check_rule_projection_integrity` carries the host axis and
      `check_host_tree_parity` asserts byte-identity for every non-delivery host — but that
      branch is unmerged, so `lean_projection.hosts` does not exist on this branch's base.
      This blocks Phase 2 entirely, since 2.1's whole action is adding a host to a list that
      is not there yet. It blocks nothing in Phase 1 or Phase 3, both of which measure and
      emit rather than project.
- [x] Read `docs/enforcement-by-host.md:18-28` (2026-09-07 host table),
      `src/scripts/hook_manifest.yaml:1266-1322` (per-host bindings),
      `src/scripts/hook_effect_doctor.ts` (the "is any of this taking effect" doctor), and
      `src/scripts/_lib/host_capability.ts:168,183` (the committed registry and its
      observation protocol).
      Done 2026-09-08. Two facts from the reading that the Context states and this run
      re-derived rather than trusted: `rule-inject` is absent from BOTH the Cursor
      (`:1300`) and Cline (`:1315`) `user_prompt_submit` lists, which are byte-identical to
      each other; and `host_capability.ts:180-188` requires a four-part citation per field —
      host, host version, transcript or artefact reference, date — with "a row without all
      four is not admissible, and no row may be filled from a host's documentation". That
      last clause is E3 one layer down, and it is what the new record enforces in code.
- [x] Run `agent-config roadmap:context --roadmap road-to-delivery-on-hook-hosts` and record
      the probe's `scanned:` line against the `relates:` block above.
      Done 2026-09-08. `scanned:` lines: **3 PRs · 901 roadmap file(s) across
      active/later/stubs/archive · 433 remote branch(es) · 2 live session record(s) · 0
      inbox file name(s)**. Fingerprint `d47387413ee6e2e1` (base `d327ef947`). Against the
      `relates:` block: no remote branch carries either declared slug, no sibling roadmap on
      the topic, and none of the three open PRs (#1919, #1920, #1921) overlaps a file this
      roadmap touches. The `depends` edge on `road-to-delivery-for-every-host` is real and
      is exactly what prerequisite 1 records as unmet.

## Context

The 2026-09-07 host table replaced "static only" with slot bindings: Claude Code (plugin) 9
and the only host that refuses on a deny; Cowork 8; Augment 5; Cursor 5; Cline 5; Gemini 5;
Windsurf 3; Copilot 0 (`fallback_only`); Codex 0, no platform key
(`docs/enforcement-by-host.md:18-28`, the table's own correction note at `:21-23`).

Cursor (`beforeSubmitPrompt → user_prompt_submit`, `src/scripts/hook_manifest.yaml:1300`,
alias at `:1407`) and Cline (`:1315`) bind the slot the `rule-inject` concern needs — but the
concern is **not** in either host's list, which reads
`[chat-history, verify-before-complete, minimal-safe-diff, language-mirror,
git-authorization, session-canary, self-repair, session-register]` for both. And **whether
those hosts add hook stdout to the model's context is unmeasured**; Cowork is measured to
discard dispatcher output and `exit 0` (`docs/enforcement-by-host.md:21` —
`corrected-from-reproduction`: the draft cited `:20`). That is the one fact that decides
whether a host can get delivery.

Cursor and Windsurf already have a native lazy form for `auto` rules: `_emit_cursor_mdc`
writes `alwaysApply: false` plus globs (`src/scripts/condense.ts:1293,1304`) and
`_emit_windsurf_rule` writes `trigger: model_decision` when a rule has neither
`always_apply` nor globs (`:1313,1323`).

**How large the description-gated gap actually is — `corrected-from-reproduction`.** The
draft said "only 5 of 119 rules carry path-shaped triggers". Re-derived over
`dist/agent-src/rules/*.md` frontmatter: **21 of 119** carry a path-shaped trigger — 41
`path_prefix` entries plus 13 `file_pattern` entries across those 21 files — alongside 491
keyword and 212 phrase triggers (both exact as drafted) and 7 `command` triggers. No reading
yields 5: zero rules carry a host-native top-level `paths:` key. The gap is therefore
**98 of 119 rules**, not 114 — smaller than the draft argued and still the majority of the
corpus, so Phase 3 survives on a corrected number rather than on the one that was written
down. A step sized against 114 would have over-claimed its own win by 16 rules.

Whether Cursor additionally loads the `.cursor/rules/*.md` symlink tree alongside `*.mdc`
(double carry) is unmeasured.

**Owner ruling E3 (final):** the rule for admitting a host to `lean_projection.hosts` is one
observed transcript in which a body delivered by `rule-inject` on `user_prompt_submit` is
visibly acted on by the model in that host. Documentation of the host's hook API is not
admission. Cowork is excluded by the existing measurement.

## Phase 1: Measure context injection per host

- [ ] **1.1 Add an `injection_effect` dimension to `src/scripts/hook_effect_doctor.ts`:**
      with `rule-inject` gate-open on the doctor's own probe rule, does the model's next turn
      reflect the delivered body? Record `observed-true | observed-false | unobserved` per
      host under the host-capability observation protocol
      (`src/scripts/_lib/host_capability.ts:183`), with a transcript pointer.
      verify: doctor output shows the dimension for the current host; a run on Claude Code
      records `observed-true` with a transcript.
      **First limb DONE, second limb NOT MET — left unticked. 2026-09-08.**
      The dimension exists and prints: `hooks:effect --host claude` now renders an
      `injection_effect` block with two lines that are deliberately different axes —
      `rule-inject bound on user_prompt_submit  yes  [computed]` and
      `body observed reaching the model  unobserved  [observed]` — plus the citation and the
      reason. `src/scripts/_lib/injection_effect.ts` owns the states, the loader and the
      citation check; `src/config/host-injection-effect.json` is the record; 16 unit tests
      in `tests/scripts/injection_effect.test.ts`.
      **The design decision, because the step's wording invites the opposite one.** The
      doctor is an in-process probe. It CANNOT see the model's next turn, so it cannot
      compute whether a delivered body was acted on — and a dimension that quietly reported
      the binding under an "effect" heading would be the exact conflation E3 and K1 forbid.
      So the module has no code path from the computed axis to the observed one:
      `stateFor` reads the record and nothing else, `concernBound` reads the manifest and
      nothing else, and their names are chosen so the two cannot be confused at a call site.
      **The second limb fails honestly: Claude Code is `unobserved`, not `observed-true`.**
      E3 wants one transcript in which a model VISIBLY ACTS on a delivered body. What exists
      is delivery EQUIVALENCE (616/616 byte-equal) and cost, which is a different claim, and
      no such transcript exists at all: `lean_projection.mode` resolved to `eager-all`
      across the whole recorded history, so the concern emitted zero bytes in every session
      on record. Writing `observed-true` from the byte-equality measurement is K1 one layer
      in, and refusing to do that is the point of the mechanism.
      What closes it: one Claude Code session with `delivery` live, a prompt that trips a
      labelled rule, and a transcript reference showing the next turn reflecting the body.
      The record has the slot waiting and the citation check will refuse a partial one.
      **2026-09-09 — the second limb is still NOT met, and the reason it has never been met
      is now measured rather than assumed. It is not that the bar is unreachable.**
      Four facts, each reproducible from a command:
      1. **The gate is OPEN in this repository.** `gateOpen`
         (`hooks/rule_inject_hook.ts:314-320`) returns true when the mode delivers bodies
         and `hosts` includes `claude-code`; `lean_projection.mode` resolves to `delivery`
         and `lean_projection.hosts` to `["claude-code"]` from the shipped defaults, with
         nothing set in any settings file.
      2. **The concern DELIVERS when it is invoked.** Fed a `user_prompt_submit` envelope
         carrying a prompt that trips a labelled rule, it returns
         `{"decision":"warn","reason":"rule-inject: 1 rule body/bodies on
         user_prompt_submit (5346 B)"}` with the full body in `additional_context`, exit 2
         — the warn path that is how context reaches the model. Verified in three shapes:
         a raw host payload, the same payload with the dispatcher's own envelope keys, and
         both repository roots.
      3. **The SOURCE dispatcher delivers it too.** `npx tsx
         src/scripts/hooks/dispatch_hook.ts --platform claude --event user_prompt_submit`
         over the same payload emits 6,458 B of output containing the matched rule id. So
         nothing in the dispatcher's own logic drops it.
      4. **The BUILT bundle does not.** `node dist/hooks/dispatch.js --platform claude
         --event user_prompt_submit` over the identical payload emits 826 B — the
         language-mirror pin and nothing else. `dist/hooks/dispatch.js` is UNTRACKED
         (`git ls-files dist/hooks/` returns nothing) and is produced by
         `npm run build:hooks`, so this is a stale LOCAL build, not a defect in the
         repository. It is also the file the installed hook actually runs, resolved through
         `$CLAUDE_PROJECT_DIR/dist/hooks/dispatch.js` in `~/.claude/settings.json`.
      **The consequence for this step.** No `rule-inject` session state exists anywhere on
      this machine — `agents/runtime/state/rule-inject/` did not exist in either the
      worktree or the parent checkout before this investigation created a probe file — so
      the concern has never delivered a body in a live session here. Every session that
      could have produced the E3 transcript was running a bundle that had the carrier
      missing, and `check_installed_hooks_fresh` said so at session start: *".git/hooks does
      not match this checkout"*.
      **What is deliberately NOT claimed.** No `observed-true` row is written. Everything
      above is the COMPUTED axis one step closer to the observed one — it shows the carrier
      delivers, not that a model visibly acted on a delivered body, and those are the two
      axes this step exists to keep apart. Writing `observed-true` off a dispatcher probe
      would be K1 one layer in, exactly as writing it off byte-equivalence would be. There
      is a second reason to refuse: the only session available to observe is this one, so
      the observer and the subject would be the same agent, which is the self-review shape
      `evaluator-independence` exists to reject.
      **What closes it, sharpened.** Refresh the local bundle (`npm run build:hooks`),
      confirm `node dist/hooks/dispatch.js --platform claude --event user_prompt_submit`
      now carries a rule body, then run a session and have a SECOND party read the
      transcript for the turn that reflects the body. The bar was never the problem; the
      carrier the sessions were running was.
      **UPDATE 2026-09-10 — THE 2026-09-09 DIAGNOSIS IS WRONG, and the prescribed fix
      closes nothing. Reproduced at `09d9bc760` on a bundle rebuilt the same day.**
      `npm run build:hooks` was run, and `task preflight` independently verified the bundle
      byte-identical to a rebuild from source (`sha256 72a0909d356d`). The built dispatcher
      still emits **826 B** for the payload the source emits 17,823 B for. The bundle is
      neither stale nor broken.
      **Four measurements, one payload, one root:**

      | invocation | bytes | rule bodies |
      |---|---:|---|
      | `npx tsx src/scripts/hooks/dispatch_hook.ts` | 17,823 | 3 (16,378 B) |
      | the same, `AGENT_CONFIG_REPLAY=1` | **826** | none |
      | `node dist/hooks/dispatch.js`, freshly built | **826** | none |
      | the same bundle, `lean_projection.mode: delivery` set | **17,823** | 3 |

      **Rows 2 and 3 being the same number is the finding.** Source and bundle agree exactly
      once the probe branch is off, and 826 B is the language-mirror pin alone.
      **Row 1 is the PROBE branch, which `gateOpen` documents as such in its own prose** —
      *"A DIRECT CLI invocation is a probe by definition … so there the gate defaults to
      open"* (`rule_inject_hook.ts:314-320`). `_isCliEntry()` at `:388` returns false
      unconditionally under `__AGENT_CONFIG_BUNDLE__`, which is the whole of why the bundle
      differs, and `AGENT_CONFIG_REPLAY=1` re-imposes the gate on the source path — row 2.
      **Row 4 is the real cause: the gate is CLOSED BY CONFIGURATION.** `deliversBodies`
      (`_lib/lean_projection_mode.ts:42-44`) is true for exactly `'delivery'`, and
      `DEFAULT_LEAN_PROJECTION_MODE` at `:21` is **`eager-all`**. There is no
      `.agent-settings.yml` here — gitignored at `.gitignore:317`, and absent IS the CI
      shape — so the mode normalises to `eager-all` and both of `gateOpen`'s clauses are
      false in every real session.
      **So two claims this step and its blocker both carried are corrected.** That
      *"`lean_projection.mode` resolves to `delivery` … from the shipped defaults"* — the
      hosts half is right, the mode half is not. And that *"`gateOpen` therefore returns
      true here"* — it returns true under a probe. **Every measurement offered as proof the
      carrier works (5,346 B, 6,458 B, and row 1) was taken on the probe path.** That is
      this file's own K1 conflation one layer further in: the round that rightly refused to
      write `observed-true` off byte-equivalence then diagnosed the carrier off a probe.
      **What actually closes the second limb**, unchanged in its independence requirement
      and changed in every other part: write `.agent-settings.yml` with
      `lean_projection.mode: delivery` and `hosts: [claude-code]`, run one live session with
      a prompt that trips a labelled rule, and have a SECOND party read the transcript. The
      config edit is local and gitignored, so it reaches no consumer — and it is not free:
      row 4 measures 17,823 B of injected context on one prompt.
      **Still open, and this run could not close it:** the transcript needs a live user
      prompt after delivery is enabled, which no autonomous run produces for itself. The
      observer also may not be the session that produced the turn.
      Full reproduction, with the commands:
      `agents/evidence/analysis/e3-gate-closed-not-stale-bundle-2026-09-10.md`.
      **UPDATE 2026-09-10 (later) — DELIVERY IS NOW LIVE ON THIS MACHINE, so the limb is
      one live prompt away rather than one diagnosis away.** Owner chose to enable it.
      `.agent-settings.yml` at the repository root now carries `lean_projection.mode:
      delivery` and `hosts: [claude-code]`; the file is gitignored (`.gitignore:317`) so it
      reaches no consumer and no commit. Verified through the INSTALLED carrier, not a
      probe: `node dist/hooks/dispatch.js --platform claude --event user_prompt_submit`
      over a prompt that trips three labelled rules now reports
      `rule-inject: 3 rule body/bodies on user_prompt_submit (16378 B)`, where the same
      command returned 826 B an hour earlier.
      **What is still missing is the transcript, and it cannot be produced by the session
      that would read it.** Two independent reasons, both unchanged: a live USER prompt is
      needed and no autonomous run produces one for itself, and the observer may not be the
      subject. The next session on this machine whose prompt trips a labelled rule is the
      candidate; a second party then reads that turn and fills the waiting slot in
      `src/config/host-injection-effect.json`, whose citation check refuses a partial row.

      **UPDATE 2026-09-10 (later still) — THE DELIVERY HAPPENED, A SECOND PARTY READ IT,
      AND THE ROW STAYS `unobserved`. That is the result, not a failure to get one.**
      With `mode: delivery` live, a user prompt tripped two labelled rules and the concern
      delivered **2 bodies / 7,685 B** into a live Claude Code context (2.1.268); later in
      the same session a further **4 bodies / 16,314 B**. Delivery into a live model
      context is therefore no longer the open question, and the reason this row carried
      since 2026-09-08 — *"the concern emitted zero bytes in every session on record"* — is
      now false.
      **The independent read.** A fresh context that did not produce the turn was given the
      transcript and a neutral three-way question (ACTED / COINCIDENT / NONE) with no
      expectation stated in either direction. It returned **ACTED** — and qualified its own
      verdict unprompted, which is the sentence this step turns on:
      *"the ACTED verdict rests on 'referring to its substance', not on 'doing something it
      asks for'."*
      It confirmed the reference is demonstrable rather than reconstructible: the model
      quoted the injection's byte count, and that string appears nowhere else in the
      transcript. And on the two delivered rules' actual OBLIGATIONS it returned **NONE** —
      no point in the turn surfaces a source discrepancy (`cross-source-consistency`) or
      classifies the prompt continuation-vs-interrupt (`user-interrupt-priority`).
      **Why that is not `observed-true`, stated so the next round does not relitigate it.**
      E3 asks for a transcript in which the model VISIBLY ACTS ON a delivered body. Citing
      that a body arrived is a different act, and it is a cheap one precisely here: the
      observed turn was one that had been WAITING for the delivery for two rounds, so the
      model had every reason to remark on it regardless of what it contained. Recording
      `observed-true` off that is the K1 conflation one layer further in than the
      byte-equivalence version this file already refused.
      **A STRUCTURAL LIMIT THE READER FOUND, and it bounds every future attempt.** Thinking
      blocks are recorded with length 0 in the transcript, so an internal application of a
      delivered rule is invisible **by construction**. Only externally visible behaviour
      can ever satisfy E3 on this host — which means the qualifying transcript is one where
      a delivered rule changes what the model DOES in a way a reader can point at, not one
      where the model is thinking about rules.
      **A third finding, on cost rather than effect.** The 16,314-byte delivery landed on a
      turn whose `user_prompt_submit` was a BACKGROUND TASK NOTIFICATION, not a human
      prompt. The concern does not distinguish them, so every notification-driven turn in a
      long autonomous run pays the full injection. That is a real cost input for the
      `hosts` default and it is not measured anywhere; recorded here rather than acted on.
      **THE E3 QUALIFICATION CRITERION, WRITTEN DOWN BEFORE THE NEXT ATTEMPT.** AI council
      2/2 convergent, 2026-09-10 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, blind peer
      review, api rung), on the question of whether the ACTED read above admits this host.
      **Q1 — does demonstrable reference satisfy "VISIBLY ACTS ON"? NO, both seats.**
      anthropic put the reductio on it: *"you create a standard where a model that logs
      'Received 4 rules' and then ignores all four would qualify as `observed-true`. The gap
      E3 exists to close is 'do injected rules change model behavior during tasks', not 'do
      models notice files were read'."*
      **It also named the risk in refusing, and the refusal is only legitimate because the
      criterion below now exists:** *"you're at risk of moving the goalposts after seeing a
      result you didn't design for … If you reject this, you need a PROSPECTIVE criterion
      for what would qualify, not post-hoc reasoning. Otherwise you're running an
      unfalsifiable standard: every observation can be dismissed as 'too cheap'."* That is
      why this paragraph is in the tree rather than in a response file, and why it is dated
      ahead of any further attempt.

      **A transcript qualifies under E3 when ALL FOUR hold:**
      1. A delivered rule's OWN STATED OBLIGATION is discharged in the observed turn — a
         surfaced discrepancy, a refused step, a stated classification, a check performed.
         Quoting the rule, its id, its size or its arrival is explicitly NOT this.
      2. The behaviour is **not explainable by the prompt alone**. A reader names the
         counterfactual: what the turn would plausibly have looked like without the body.
      3. The turn is **not about the delivery mechanism**. A session measuring injection has
         every reason to mention injection; that turn cannot be its own evidence.
      4. The reader is a **fresh context that did not produce the turn**, given a neutral
         question with no expectation stated in either direction.
      Conditions 1 and 2 are anthropic's, near verbatim: *"the model's output contains
      behavior explicitly required by a delivered rule's stated obligation, AND that
      behavior is absent in the prompt/context alone."* 3 answers Q3 and 4 restates the
      independence this round already applied.

      **Q3 — must the SUBJECT be blind? NO, and the reason is a bootstrap.** Enabling
      delivery is itself a deliberate act, so an unwitting subject is unobtainable by
      construction. Both seats accepted a knowing subject; anthropic drew the line at
      condition 3 instead — *"the reader was independent … the behavior is routine, not
      performed-for-the-observer"* — which is what makes the criterion satisfiable in
      ordinary work and unsatisfiable by staging.
      **A paired A/B (same prompt, gate open and closed) was considered and NOT adopted as
      the primary path** — anthropic: a tiebreaker only, because it manufactures the
      observation, which this repository has refused in a neighbouring case.

      **Q4 — the background-notification cost is a TRIGGER DEFECT, both seats.** The
      16,314-byte delivery landed on a turn whose `user_prompt_submit` was a task
      notification, and the concern does not distinguish it from a human prompt. Both
      recommended separating the two.
      **Not implemented here, and the reason is measurement rather than effort.** The
      concern reads the prompt string out of the envelope
      (`rule_inject_hook.ts:221-223`) and nothing in this tree establishes that a
      notification-driven `user_prompt_submit` envelope carries a field distinguishing it
      from a typed one. Guessing a discriminator — matching on a marker in the prompt text,
      say — is a host-shaped guess of exactly the kind three rounds of this step have now
      been corrected for. **What closes it:** capture one real envelope of each kind and
      compare them; then the discriminator is read rather than invented.

      **THREE PROPOSED SURFACES CHECKED AGAINST THE TREE AND ABSENT**, continuing this
      step's own record: `src/concerns/rule-inject/` (the concern lives at
      `src/scripts/hooks/rule_inject_hook.ts`), a `triggerScope` configuration field, and a
      `deliversBodies` config key of the shape proposed. All three are proposals wearing
      the grammar of references.
- [x] **1.2 Run 1.1 on Cursor and Cline** (the two hosts binding `user_prompt_submit` with a
      `.md` rule tree). Record Windsurf, Gemini and Augment as `unobserved` unless a session
      exists.
      verify: the census artefact carries one line per host; no `observed-*` value without a
      transcript pointer.
      Done 2026-09-08 for what is observable from here, which is the census and one row.
      `agents/evidence/analysis/host-injection-effect-2026-09.md`, generated by
      `report_host_injection_effect.ts`, pinned and byte-identical on re-run at the same pin.
      Nine hosts, one line each: **1 `observed-false` (cowork), 8 `unobserved`**. No
      `observed-*` value carries an absent pointer — enforced rather than reviewed, since
      `recordProblems` refuses an `observed-*` row missing host version, transcript or date,
      and the generator exits 1 before writing anything if any row is inadmissible.
      Cursor and Cline are `unobserved` and cannot be otherwise from a Claude Code session.
      Windsurf, Gemini and Augment likewise, as the step anticipates. Augment additionally
      has no `user_prompt_submit` slot at all — a declared gap in the manifest — so the
      delivery path being measured does not exist there today; recorded in its row.
      **Cowork is the one substantive row and it is `observed-false`,** carried across from
      the existing measurement at `docs/enforcement-by-host.md:21`. Its citation is
      deliberately incomplete and says so: the host version was not captured when that
      observation was made, so `host_version` records that fact rather than inventing one.
      **A one-row disagreement with the host table was found and fixed while generating
      this.** The slot column first read `copilot: 1` against the table's 0, because the
      count included the `fallback_only` marker, which is not a lifecycle slot. Excluded,
      named in the code, and pinned by a test. Every other count now matches the table
      exactly: claude 9, cowork 8, augment/cursor/cline/gemini 5, windsurf 3, codex 0.
- [x] **1.3 Resolve Cursor double carry by observation:** does Cursor load
      `.cursor/rules/*.md` alongside `*.mdc`?
      verify: census line `cursor.md_tree_loaded: observed-true | observed-false |
      unobserved` with a pointer.
      Done 2026-09-08, and the answer is `unobserved`. The census carries the line under its
      own § `cursor.md_tree_loaded` with the reason: both trees ARE written today —
      `condense` writes the `.cursor/rules` symlink tree in the `TOOL_DIRS` loop and
      `_emit_cursor_mdc` writes the `.mdc` companions — so a double carry is possible by
      construction and unmeasured in fact. It cannot be observed from a Claude Code session.
      Recorded under an underscore key rather than in the host namespace, because it is a
      property of a TREE and putting it on `cursor` would make one row answer two different
      questions.
      K4 is therefore live and nothing was removed. 3.2 is gated on this and says so below.

## Phase 2: Admit hosts that pass (E3)

- [ ] **2.1 For each host with `injection_effect: observed-true`:** add `rule-inject` to
      that host's `user_prompt_submit` and `pre_compact` concern lists in
      `hook_manifest.yaml`, add the host to the default `lean_projection.hosts`, and extend
      the predecessor's non-regression fixture so the host's stubs plus deliveries are
      byte-equal to the eager body on the routing corpus.
      verify: `./scripts-run src/scripts/model_rule_injection --endpoints` passes on the
      host's binding; census shows the host's rules bucket ≤ 20,000 tok.
      BLOCKED 2026-09-08, on both of its inputs, and neither is a scheduling excuse.
      (a) **No host qualifies.** The census records 8 `unobserved` and 1 `observed-false`;
      `admissibleUnderE3` returns true for nothing, which a test pins. There is no host to
      add, and adding one anyway is K1.
      (b) **The list does not exist on this branch.** `lean_projection.hosts` lives on
      `drain/delivery-for-every-host`, unmerged, so 2.1's action has no target here.
      Closes when a host has an `observed-true` row with a full citation AND the predecessor
      is merged. The record has the slot and the citation check will refuse a partial one.
      **CORRECTED 2026-09-10, on both limbs, and the step is much closer than its own text
      says.**
      (b) is dead: `lean_projection.hosts: [claude-code]` is at
      `src/config/agent-settings.template.yml:214` on `main`, so 2.1's action has a target
      here. The blocker below already recorded that on 2026-09-09; the step kept the
      superseded sentence, which is where a reader lands first.
      **And the two manifest edits 2.1 asks for are ALREADY DONE for this host.**
      `src/scripts/hook_manifest.yaml:1289` binds `rule-inject` on `claude`'s
      `user_prompt_submit` and `:1323` binds it on `pre_compact` — the exact pair the step
      prescribes. So what 2.1 actually still owes is limb (a), the fixture extension, and
      the host-bucket census reading; not the bindings and not a merge.
      **Its first verify half already passes, and so does the fixture limb:**
      `model_rule_injection --endpoints` reports `4/4 hold` at this commit — endpoint (a)
      is *"592 deliveries byte-equal, 0 not"*, which IS the non-regression fixture 2.1 asks
      to extend, already holding for this host; (b) 101/101 rules reachable; (c) 0 of 212
      near-miss prompts fired; (d) delivery 0.7040 USD against eager 4.0482 USD.
      So of 2.1's four actions, three are done for `claude-code` — both manifest bindings,
      the hosts entry, and the fixture — and what remains is limb (a) plus the host-bucket
      census reading.
      **WHERE THE `delivery`-IS-LIVE BELIEF CAME FROM, since it misled two rounds and the
      answer is one line.** `src/config/agent-settings.template.yml:213` says
      `mode: delivery` — that is what a CONSUMER receives from `agent-config setup`. The
      CODE default for a checkout with no settings file is `eager-all`
      (`_lib/lean_projection_mode.ts:21`, with its own docstring: *"a mode nobody can spell
      must never silently thin the standing corpus"*). Both are deliberate and they are
      different facts. Reading the template as "the shipped default" is what produced
      *"`lean_projection.mode` resolves to `delivery` … with nothing set in any settings
      file"*, and this repository ships no `.agent-settings.yml` — so the one tree where
      the transcript had to be produced was the one tree running `eager-all`.
- [x] **2.2 For each host `observed-false` or `unobserved`:** nothing changes in projection;
      write the result into the host table with an expiry per the table's own discipline.
      verify: the host's rule tree is byte-identical to `eager-all` (predecessor 1.4 gate
      green).
      Done 2026-09-08 — and the honest form of "done" here is that NOTHING CHANGED, which is
      exactly what this step asks for. Every host is `observed-false` or `unobserved`, so the
      whole estate falls under this step and no projection was touched: no host was added to
      any list, no tree was thinned, no body was removed.
      The result is written into the host table by 4.1 below, with an expiry of 2026-12-08 —
      the table's own discipline, since this is a snapshot of an observation state that is
      expected to change.
      The byte-identity limb is asserted by `check_host_tree_parity`, which lives on the
      unmerged predecessor branch. Naming that honestly: on THIS branch the assertion is not
      running, because the gate is not here. It is green there, over the same corpus, and it
      will cover these hosts the moment the two branches meet.

## Phase 3: Native lazy forms get the triggers they need

- [x] **3.1 Lower keyword and phrase triggers into the Cursor and Windsurf description
      field.** Append `Applies when: <up to N trigger terms>` to the emitted description in
      `_emit_cursor_mdc` and `_emit_windsurf_rule`, capped by the host's description length;
      measure by string match on the routing corpus — no LLM judge. The population is the
      **98 of 119** rules with no path-shaped trigger (21 already carry one); state that
      number in the commit so the win is not re-derived from the draft's 114.
      verify: for 102 `auto` rules the emitted description contains ≥ 1 of the rule's own
      triggers; string-match recall over corpus positives ≥ pre-change.
      Done 2026-09-08. `applies_when` / `trigger_terms` in
      `src/install/claudePathsPlan.ts`, called by both `_emit_cursor_mdc` and
      `_emit_windsurf_rule`. 9 unit tests in `tests/scripts/applies_when.test.ts`.
      **The population is 97 of 105, not 102 of 102, and the correction is arithmetic rather
      than a re-scope.** 105 rules carry `type: auto` (102 quoted + 3 bare, the same split
      the predecessor's 0.2 corrected). Of those, **8 carry no keyword or phrase trigger at
      all**, so there is nothing to lower: four are the trigger-less rules
      (`no-roadmap-references`, `rule-type-governance`, `skill-quality`,
      `source-confidentiality`) and four are path-only
      (`design-review-after-ui-write`, `roadmap-progress-sync`, `source-of-truth`,
      `ui-audit-gate`), which Cursor and Windsurf already route natively through `globs` —
      the better mechanism, not a gap. 97 is therefore the whole of the lowerable set, and
      every member of it now carries at least one of its own terms.
      **Second limb, measured by string match on the frozen corpus as K2 requires and with
      no LLM judge anywhere near it:** over the 309 corpus positives belonging to `auto`
      rules, description-only string match rises **179 → 284, i.e. 57.9 % → 91.9 %,
      +105 prompts**. The bar was "≥ pre-change" and the result is a 34-point gain.
      **The cap is a PACKAGE number and says so.** Nothing in this tree records what Cursor
      or Windsurf truncate at, so a cap claiming to be theirs would be invented.
      `APPLIES_WHEN_CAP` is 400, chosen against the corpus it applies to — the 119 projected
      descriptions measure max 187 and mean 115 — so no existing description is touched and
      the clause gets roughly twice the mean to work in. 4 rules land within 20 characters
      of it. Revisit-if is stated at the constant.
      Three failure modes are asserted in the failing direction: the clause is dropped WHOLE
      rather than truncating the original sentence (a description can only gain), terms are
      added whole or not at all (a half phrase routes on nothing and reads as a typo), and
      the function is idempotent so a re-run cannot stack clauses.
      `condense.ts` is NET-ZERO in lines again — 2,712, unchanged — because the logic lives
      in a file under the source-size ceiling and only the two emitter call sites changed.
- [x] **3.2 If 1.3 observed double carry:** make `.cursor/rules` mdc-only for `auto` rules;
      `always` and `manual` keep the `.md` body. Otherwise skip and say so.
      verify: census shows Cursor standing bytes down by at least the removed bodies; every
      `auto` rule present exactly once.
      SKIPPED 2026-09-08, which is this step's own instruction and not an omission: "If 1.3
      observed double carry ... Otherwise skip and say so." 1.3 is `unobserved`, so the
      condition did not fire and K4 forbids removing the `.md` bodies before it does.
      Nothing was removed from `.cursor/rules`. Both trees are still written, which is the
      state 1.3 records as possibly-double and unmeasured.

## Phase 4: Truth surfaces

- [x] **4.1 Replace the L4 row** at `docs/enforcement-by-host.md:176` with per-host facts
      (Claude: hook delivery; admitted hosts: hook delivery; Cursor/Windsurf:
      description-gated native form; Cline/Copilot/Gemini/Augment/Codex: full corpus), each
      cell citing the emitter or binding `file:line`, with an expiry.
      verify: `grep -c 'no equivalent today' docs/enforcement-by-host.md` returns 0.
      Done 2026-09-08. `grep -c 'no equivalent today' docs/enforcement-by-host.md` returns
      **0**. The L4 cell now points at a per-host table with a citation per cell: Claude Code
      hook delivery (`rule_inject_hook.ts`, `hook_manifest.yaml:1221`); Cursor and Windsurf
      the description-gated native form (`_emit_cursor_mdc` / `_emit_windsurf_rule` plus
      `applies_when`); Cowork none, with its `observed-false`; Cline, Gemini, Augment,
      Copilot and Codex none, full corpus projected.
      **The table leads with the negative result rather than burying it:** no host is
      measured as receiving a just-in-time constraint yet, Claude Code included. The
      mechanism exists and its byte-equivalence is measured; what is unmeasured is a model
      visibly acting on a delivered body, which is E3's bar.
      Expiry 2026-12-08, per the table's own discipline — it is a snapshot of an observation
      state expected to change.
      **A first attempt at this failed its own verify and is worth recording:** the
      replacement prose quoted the retired phrase while explaining what it replaced, so the
      grep still returned 1. Reworded to describe the old cell without reproducing its
      literal. A verify expressed as a grep counts the fix's own prose too.
- [x] **4.2 One sentence** in the same file and in the predecessor's ADR: hosts without a
      measured injection path receive the full corpus; this is the cost of the host, not a
      defect.
      verify: sentence present; predecessor 1.4 gate green.
      HALF DONE 2026-09-08. The sentence is in `docs/enforcement-by-host.md`, in the L4
      section, in as many words: a host without a measured injection path receives the full
      corpus, and that is the cost of the host rather than a defect — with the reason it is
      not a withholding (every rule body is written, and `check_host_tree_parity` asserts
      byte-identity per PR).
      **The predecessor's ADR half is not done and cannot be from here.** ADR-262 lives on
      `drain/delivery-for-every-host`, unmerged, so this branch has no file to add the
      sentence to. Editing it would mean recreating the ADR on a second branch, which is how
      one decision record becomes two. Closes with one edit to ADR-262 § Consequences after
      the branches meet.
      The second verify limb has the same shape as 2.2's: the 1.4 gate is green on the
      predecessor branch and is not running on this one, because it is not here.
      **ADR-262 IS CONTESTED — do not follow this number blindly. Found 2026-09-08.** Two
      open PRs each ship a different ADR numbered 262, and neither is merged:
      `drain/delivery-for-every-host` (PR #1923) has
      `docs/decisions/ADR-262-delivery-default-for-claude-code.md` <!-- ref-ignore -->, which is the one this
      step means (it is `ADR-267-…` today — see the DONE note above), and `drain/abolish-carrier-gate` (PR #1926) has
      `docs/decisions/ADR-262-carrier-status-deleted-no-repo-authored-human-gate.md`, a
      decision on an unrelated subject. Both branches carry an identical ADR-260 and
      ADR-261, so 262 was simply the first free number each lane took independently.
      Consequence for this step specifically: if #1926 merges first, "the predecessor's ADR"
      resolves by number to the carrier-status record, and a reader who trusted the number
      would add this sentence to the wrong decision. Match on the **filename and the
      subject**, never on the number, until one of the two is renumbered. This lane owns
      neither PR and renumbered nothing.
      **RESOLVED 2026-09-08, in the direction this block anticipated.** #1926 merged first,
      so the carrier-status record keeps 262 on `main` and the delivery-default record was
      renumbered to `docs/decisions/ADR-267-delivery-default-for-claude-code.md` on
      `drain/delivery-for-every-host` — by the PR-drain run that hit the collision when
      `regenerate_index` refused the duplicate. **It renumbered FOUR times, all on
      2026-09-08: 262 → 263 → 265 → 266 → 267, because `main` took 263, 264, then its own
      265 and its own 266 while the branch sat open — the last two inside one merge session,
      minutes apart. The number below reads 263 because that is what the council was told;
      the record's live number is 267.** The match-on-filename instruction above is
      no longer needed for these two, and is kept because the reasoning generalises: the
      number is a lane's first free pick, not an identity.
      **Nothing in the repository catches this, measured rather than assumed.** The two
      filenames differ, so git produces no conflict and both files would simply coexist on
      `main`. Both were materialised into one tree and `./scripts-run
      src/scripts/check_adr_frontmatter` was run over it: **exit 0, "no errors"**, with both
      files declaring `adr: 262`. The gate builds a number index and its own source comments
      discuss collisions, but it does not fail on two records sharing a number. The probe
      files were removed and neither lane's ADR is committed here.
      **Recommended owner action, AI council 2 seats (anthropic + openai) 2026-09-08,
      subscription transport, $0.0000, quorum 2/2 after the run, unanimous option B
      (record + propose a tie-break):** the **earlier-opened PR keeps the number**, because
      it is deterministic and readable from GitHub metadata and does not leave the citation
      unstable until merge time. So **#1923 keeps ADR-262 and #1926 renumbers to ADR-263**,
      applied by the owner of #1926 before merge. ADR-263 was checked rather than guessed:
      across `origin/main` and all five open-PR branches the union of records at 260 and
      above is exactly ADR-260, ADR-261, ADR-262, so 263 is genuinely free as of this run —
      re-check at renumber time, since another lane may claim it in between.
      **Why this lane did not comment on the two PRs, which both seats asked for.**
      `agent-config settings:get personal.pr_progress_comments` reports *not set in any
      settings file, default false*, and `no-pr-progress-comments` says an unsolicited
      comment is gated and that an author unsure whether a comment qualifies must treat it
      as gated. An ADR numbering collision does not clear that rule's safety carve-out,
      which is for security, data-loss or production-impact findings. The council
      anticipated exactly this and stated the fallback itself: *if commenting on the PRs is
      also outside the lane's delegated authority, choose A operationally while recording B
      as the recommended owner action.* That is what this note is.


      **DONE 2026-09-09 — the branches met, and the number moved four times on the way.**
      PR #1923 merged on 2026-09-08. The predecessor's ADR is
      `docs/decisions/ADR-267-delivery-default-for-claude-code.md` — NOT 262, and not 263,
      265 or 266 either: the record was renumbered four times against collisions with
      records that merged first, which is exactly the hazard the paragraph above predicted
      arriving from a third direction. The full collision record is
      `agents/roadmaps/stubs/road-to-adr-number-uniqueness.md`. Resolving this step by the
      contested number rather than by re-reading it live would have edited the wrong
      decision.
      The sentence now sits in ADR-267 § Consequences, immediately before § What this does
      NOT reopen, and it carries the two things the bare sentence does not: WHY it is not a
      withholding (every rule body is written and shipped, and `check_host_tree_parity`
      asserts byte-identity against `eager-all` for every host outside
      `lean_projection.hosts` on every PR) and WHY thinning is earned rather than granted (a
      host that binds no slot has nowhere to put the body back, so removing it would delete
      a rule and put nothing in its place). It names `docs/enforcement-by-host.md` § L4 as
      its reciprocal half, so the pair is navigable from either side.
      Verify: both limbs met. The sentence is present in both files, and the second limb —
      the predecessor's 1.4 gate — now runs HERE rather than only on the predecessor branch,
      because the predecessor is merged: `check_host_tree_parity` reports
      `2 non-delivery host tree(s) byte-identical to eager-all · delivery hosts
      [claude-code]`, exit 0.
## Blockers

> **Added 2026-09-08 by the owner-delegated drain run, as a correction rather than as news.**
> Steps 1.1, 2.1 and 4.2 each recorded themselves BLOCKED in their own bodies, and this file
> carried no `## Blockers` section, so `update_roadmap_progress` parsed zero blockers for it
> and the dashboard printed `0`. `lint_roadmap_blockers` passed the file vacuously — it
> validates the blockers it parses, so a file with none is clean by construction — and
> `check_estate_count`, where `open_blockers` is a ratcheted metric, was ratcheting on the
> undercount. Nothing below is a new blockage. The two entries are the two distinct root
> causes the three steps actually have.

### blocker: predecessor-delivery-for-every-host-unmerged

- **Status:** resolved 2026-09-09. PR #1923 (`drain/delivery-for-every-host`) merged on
  2026-09-08 at `5f2f2171f`, and the `Resolved when` below is met on its own terms rather
  than by a generous reading: `lean_projection.hosts: [claude-code]` is in
  `src/config/agent-settings.template.yml:212-214` on a merged ref, and the predecessor ADR
  is a real file this repository has — `ADR-267-delivery-default-for-claude-code.md`, which
  is where the number landed after four renumberings, not the ADR-262 the entry names.
  Its `What to do` step 1 is now FALSE and is left standing rather than edited: it says
  `origin/main` carries 0 of 6 of the predecessor's Phase 4, and `origin/main` carries 4 of
  6 (4.0, 4.1, 4.3, 4.5 done; 4.2 and 4.4 open on the predecessor with their own recorded
  reasons). The durable half of that claim was the 0-of-6, and it is the half that changed.
  What this unblocks, and what it does not: step 4.2 is CLOSED by this change, and the
  second verify limb of 2.2 and 4.2 now runs here. Step 1.1's second limb and step 2.1
  limb (a) stay blocked on `no-host-observed-true-injection`, which is a different blocker
  needing a live transcript, and step 2.1 limb (b) needs a host admitted under that one.
  The review trigger fired in the merged direction; the abandoned case nobody was watching
  for did not happen.
- **Owner:** maintainer
- **Asked:** 2026-09-08, owner-delegated drain run.
- **Blocks:** step 2.1 limb (b), step 4.2 second half, and step 1.1 second limb by way of its precondition. Steps 1.2, 1.3, 2.2, 3.1, 3.2 and 4.1 are done and unaffected.
- **Recommendation:** none from this lane — it does not own PR #1923 and will not push to another lane branch. The three steps below stay open and honest until the branches meet.
- **If you do nothing:** three steps stay blocked and the two verify limbs that name gates living on the predecessor branch (`check_host_tree_parity`, the 1.4 gate) keep asserting nothing here, as steps 2.2 and 4.2 already say in their own bodies.
- **What to do:**
  1. Resolve PR #1923 (`drain/delivery-for-every-host`), which carries 4 of 6 of its own Phase 4 while at `origin/main` that Phase is 0 of 6, so nothing it provides is available here yet. Its mergeability is volatile and is therefore dated rather than asserted: `mergeable: CONFLICTING` / `mergeStateStatus: DIRTY` when this blocker was written, and `MERGEABLE` / `BLOCKED` about ninety minutes later in the same run — someone resolved the conflicts while this change was in flight. Read it live with `gh pr view 1923 --json mergeable,mergeStateStatus` rather than from this line; the durable half of the claim is the 0-of-6 on `main`, which a `grep` of the predecessor's Phase 4 checkboxes re-derives.
  2. Then add the missing sentence to `docs/decisions/ADR-267-delivery-default-for-claude-code.md` <!-- ref-ignore --> § Consequences, which closes step 4.2 with one edit — but read the ADR-262 collision note under step 4.2 first, because that filename may not survive the merge. The marker is there because the path deliberately does not resolve here: the file lives on the unmerged predecessor branch, and `check_references` flagged it as broken on the first run, which is the collision finding arriving from a third direction.
  3. Or, if the predecessor is being abandoned rather than merged, say so, and this roadmap needs re-scoping rather than unblocking: `lean_projection.hosts` is the axis step 2.1 adds a host to, and it exists on no merged ref.
- **Resolved when:** `road-to-delivery-for-every-host` Phase 4 is merged to `main`, so `lean_projection.hosts` exists on a merged ref and the predecessor ADR is a file this repository has.
- **Review trigger:** re-read when PR #1923 closes in either direction, merged or abandoned. Its being abandoned is the case that changes this roadmap most and is the one nobody is watching for.

### blocker: no-host-observed-true-injection

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-08, owner-delegated drain run.
- **Blocks:** step 1.1 second limb, step 2.1 limb (a), and acceptance criteria depending on an admitted host.
- **Recommendation:** attempt option 1, not option 3 — and not from the session that
  measured this. UPDATED 2026-09-09; the 2026-09-08 reading was *none on the substance*
  and is superseded, with what it established kept below.
  The re-scope option exists because the E3 bar looked unreachable. It is not. The carrier
  works, and the reason no session ever produced a transcript is a **stale local hook
  bundle** — measured and reproducible: the concern delivers a 5,346-byte rule body when
  invoked, the SOURCE dispatcher delivers it (6,458 B carrying the matched rule id), and
  the built `dist/hooks/dispatch.js` that `~/.claude/settings.json` actually runs emits
  826 B for the identical payload. No `rule-inject` session state existed anywhere on the
  machine, which is exactly what that predicts. So the cheap move is `npm run build:hooks`
  and one session, not re-scoping Phase 2 around an empty set.
  Not from this session, stated rather than left implicit: the only session available to
  observe is the one doing the observing, so observer and subject would be the same agent —
  the self-review shape `evaluator-independence` rejects — and a dispatcher probe is the
  COMPUTED axis, which is the conflation K1 forbids. The row needs a session whose
  transcript a second party reads.
  What the 2026-09-08 reading established, and it still holds: the gap is real and is not
  an artefact of missing effort. `agents/evidence/analysis/host-injection-effect-2026-09.md`
  records 1 `observed-false` and 8 `unobserved` across nine hosts, and `admissibleUnderE3`
  returns true for nothing, which a test pins. What this lane can say is that the gap is real and is not an artefact of missing effort: `agents/evidence/analysis/host-injection-effect-2026-09.md` records 1 `observed-false` and 8 `unobserved` across nine hosts, and `admissibleUnderE3` returns true for nothing, which a test pins.
- **If you do nothing:** Phase 2 has an empty input set forever, and the temptation the roadmap names in K1 stays live — writing `observed-true` off the byte-equivalence measurement, which is a different claim.
- **What to do:**
  1. Produce the transcript step 1.1 asks for: one Claude Code session with `delivery` live in `.agent-settings.yml`, a prompt that trips a labelled rule, and a transcript reference showing the next turn reflecting the delivered body. Then fill the waiting slot in `src/config/host-injection-effect.json`; the citation check in `src/scripts/_lib/injection_effect.ts` refuses a partial row.
  2. **The ordering trap is GONE, and a different one replaced it — measured 2026-09-09.**
     This step used to read: *`delivery` going live in this repository is the predecessor
     Phase 4.2 flip, so this blocker cannot be discharged before the one above it.* That is
     no longer true in either direction. `delivery` IS live — `lean_projection.mode`
     resolves to `delivery` and `hosts` to `["claude-code"]` from the shipped defaults, with
     nothing set in any settings file — and `gateOpen` in
     `hooks/rule_inject_hook.ts:314-320` therefore returns true here. So the precondition
     this step waited for has been satisfied for some time.
     What actually blocked every session that could have produced the transcript is a
     **stale local hook bundle**. The concern delivers a 5,346-byte rule body when invoked,
     and the SOURCE dispatcher delivers it too (6,458 B of output carrying the matched rule
     id). The BUILT `dist/hooks/dispatch.js` — untracked, produced by
     `npm run build:hooks`, and the file `~/.claude/settings.json` actually runs — emits
     826 B for the identical payload: the language-mirror pin and nothing else. No
     `rule-inject` session state existed anywhere on the machine, which is what that
     predicts. So the E3 bar was never the obstacle; the carrier the sessions were running
     was, and it is a local install-freshness problem rather than a defect in the tree.
     Concretely: run `npm run build:hooks`, confirm
     `node dist/hooks/dispatch.js --platform claude --event user_prompt_submit` now carries
     a rule body for a prompt that trips a labelled rule, and only then attempt the
     session. Full evidence, including what is deliberately not claimed, is recorded at
     step 1.1.
     **CORRECTED 2026-09-10, and the correction is the whole of step 1 above.** The
     stale-bundle diagnosis is false and `npm run build:hooks` closes nothing. It was run,
     and `task preflight` independently verified the bundle byte-identical to a rebuild
     from source; the built dispatcher still emits 826 B where the source emits 17,823 B.
     The two numbers agree exactly once `AGENT_CONFIG_REPLAY=1` re-imposes the gate on the
     source path — because the source measurements were taken on the **probe branch**,
     which `gateOpen` documents as opening for a direct CLI invocation, and which
     `_isCliEntry()` hard-disables under `__AGENT_CONFIG_BUNDLE__`. The 5,346 B and 6,458 B
     figures quoted just above are probe-path figures and say nothing about the configured
     tree.
     The gate is closed **by configuration**: `deliversBodies` accepts only `'delivery'`,
     the shipped default is `eager-all`, and there is no `.agent-settings.yml` here — so
     both of `gateOpen`'s clauses are false in every real session, which is exactly why no
     `rule-inject` session state has ever existed on this machine.
     **What to do instead:** write `.agent-settings.yml` with `lean_projection.mode:
     delivery` and `hosts: [claude-code]` (local, gitignored, reaches no consumer), then
     attempt the session. Costs 17,823 B of injected context on a prompt that trips three
     labelled rules, which is worth knowing before enabling it. Reproduction with commands:
     `agents/evidence/analysis/e3-gate-closed-not-stale-bundle-2026-09-10.md`.
     **DONE 2026-09-10, and the blocker does NOT resolve on it.** Delivery was enabled,
     the concern delivered into a live session (2 bodies / 7,685 B, then 4 / 16,314 B), and
     an independent reader returned ACTED **while qualifying that the verdict rests on the
     model REFERRING to the payload rather than acting on what it asks for**. On the rules'
     own obligations the reader returned NONE. So the `Resolved when` condition — an
     `observed-true` row with a full citation — is still unmet, and step 1.1 records why in
     full. What changed is the shape of the remaining gap: it is no longer "the carrier
     never fires", it is "a delivered rule has not yet visibly changed what the model does".
  3. Or decide that E3's bar is not reachable for any host this year and re-scope Phase 2 rather than leaving it waiting on an empty set — an owner decision, since E3 is an owner ruling.
- **Resolved when:** at least one host carries an `observed-true` row in `src/config/host-injection-effect.json` with a full citation (host version, transcript pointer, date), and `report_host_injection_effect` regenerates the census with that row admissible.
- **Review trigger:** re-read when the blocker above resolves, since `delivery` going live is its precondition; otherwise 2026-12-08, matching the expiry the host table already carries for this observation state.
- **UPDATE 2026-09-10 — this roadmap's two open steps reduce to ONE obstacle, and the
  arithmetic is better than the file previously implied.** Recorded by an owner-delegated drain
  run under an AI council verdict (anthropic/claude-sonnet-4-5 + openai/codex-default, 2/2
  convergent, 2 rounds, blind peer review) that decided this roadmap **stays open** rather than
  being descoped.

  **A premise the run carried into the council was wrong, and is corrected rather than left to
  read as true.** The run reported that step 2.1 had no target because `lean_projection.hosts`
  lived only on the unmerged predecessor branch. That was step 2.1's own text of 2026-09-08,
  which the blocker above superseded on 2026-09-09 and which is false at `origin/main` today:
  `hosts: [claude-code]` is at `src/config/agent-settings.template.yml:214`, and
  `docs/decisions/ADR-267-delivery-default-for-claude-code.md` <!-- ref-ignore --> is a file
  this repository has. Verified on `f92a4d4ee`, not asserted.

  So 2.1 is NOT waiting on a merge. It is waiting on limb (a) alone — no host is admissible —
  and limb (a) is 1.1's second limb. Measured in
  `src/config/host-injection-effect.json` at the same pin: `claude` is `unobserved`, `cowork`
  is `observed-false`, and the other nine rows are `unobserved`. Nothing is `observed-true`, so
  `admissibleUnderE3` returns true for nothing, which a test pins.

  **Why the run did not produce the E3 transcript, stated as a declined action rather than as a
  difficulty.** The recipe is known and is in `What to do` step 2: the concern and the SOURCE
  dispatcher both deliver a body, while the BUILT `dist/hooks/dispatch.js` that the host
  actually executes emits only the language pin. The fix is `npm run build:hooks`. But a
  worktree-isolated session's `CLAUDE_PROJECT_DIR` resolves to the PARENT checkout, so the host
  runs the parent's bundle — and the parent checkout had another session live in it, editing
  files. Rebuilding a shared runtime artifact underneath another session's running work, to
  satisfy a step, is a side effect on someone else's work. The run declined it and says so
  here rather than doing it quietly. Both council seats endorsed the refusal; openai:
  *"Mutating the runtime used by another live session is not justified by pressure to close a
  roadmap."*

  **Three ways this closes, and the third is the cheap one nobody had named.** (i) The other
  session finishes, then rebuild in that checkout and observe. (ii) Coordinate with that
  session's owner. (iii) **A standalone, non-worktree session** — its `CLAUDE_PROJECT_DIR` is
  its own checkout, so the rebuild has no shared-tree side effect at all. anthropic added (iii)
  explicitly: *"a standalone (non-worktree) session would have `$CLAUDE_PROJECT_DIR` pointing
  to its own checkout, eliminating the side-effect concern entirely."*

  **The closing criterion, in words a later reader can check** (openai's phrasing, adopted):
  in an isolated or coordinated checkout, rebuild the hooks, confirm the host executes that
  rebuilt artifact, trigger a labelled delivery rule, and capture a transcript in which the
  following turn demonstrably reflects the delivered body. Then the `observed-true` row and its
  citation land, `admissibleUnderE3` returns true for `claude-code`, and 2.1 executes against
  the list that already exists.

  **Neither obligation was descoped, and that was the decision rather than the default.** Both
  seats held that the terminal descope rule does not reach work whose only obstacle is
  operational: openai — *"do not convert unmet obligations into completed stubs merely to make
  the drain appear empty"*; anthropic — *"the terminal rule's descoping clause applies only
  when work is impossible or deliberately abandoned; here, all work remains valid."*

## Disposition, 2026-09-08 — K6 is honoured; this roadmap stays active

An autonomous drain run instructed to carry every roadmap to completion reached
this file, found both blockers undischargeable by any action available to it, and
put the disposition to an AI council under the maintainer's written delegation.
The council was **`⚠️ DEGRADED`, 1 of 2 seats** — the anthropic seat returned
`exit_1` and did not answer — so what follows is a considered single-seat opinion,
not convergence, and is recorded at that strength.

**Verdict: Q2-a — honour K6.** The affected lines stay `[ ]`, both blockers stay
open and accurate, and this roadmap does **not** move to `later/` and is **not**
re-scoped so it can close. The active directory does not empty, and that is the
correct outcome rather than a missed step.

Three things the seat said that this file did not already say:

1. **"PR #1923 merged" is an insufficient wake condition.** The real ordering is
   `compatible predecessor merged` → `lean_projection.hosts` available →
   `delivery` enabled → qualifying live session → admissible observation →
   host-dependent acceptance criteria evaluated. A merge does not prove the merged
   revision carries the expected schema, that Phase 4.2 is live, or that any
   qualifying observation has occurred.
2. **Q2-c (re-scope so the roadmap can close) is rejected outright.** Rewriting
   the acceptance criteria to exclude the missing implementation and evidence
   *"would convert an unfinished delivery obligation into a completed
   documentation exercise. That is precisely the false closure K6 guards
   against."*
3. **A fourth revisit condition, which this file was missing.** If repeated
   qualifying sessions produce no `observed-true` result, that calls the
   acceptance premise itself into question — requiring an `observed-true` outcome
   makes closure depend on obtaining a *desired empirical result* rather than on
   conducting a valid observation. The roadmap must be able to distinguish
   "feature assumption falsified" from "evidence still missing". It cannot today,
   and that is now on the record rather than latent.

**What a kill-register entry is worth, answered generally because the shape
recurs:** it is a **binding local decision constraint, defeasible through explicit
supersession** — more than advice, since ordinary roadmap execution must obey it;
less than absolute, since a council holding delegated disposition authority can
overrule it. But *authority alone is not a rationale*. A valid override must
record the original failure mode, the changed or disproven premise, the
replacement safeguard, rollback criteria, and a falsifier. Here no premise behind
K6 has changed, so overruling it merely to empty a directory would be arbitrary.

**Falsifier for this disposition:** an equivalent, stable implementation of
`lean_projection.hosts` already exists independently of PR #1923, or repository
history shows K6 addressed a former dependency shape that no longer exists.

**Live state at the time of writing, read rather than recalled:** PR #1923
(`drain/delivery-for-every-host`) is `OPEN`, `mergeable: CONFLICTING`,
`mergeStateStatus: DIRTY`, last updated `2026-09-08T06:51:58Z`. Its mergeability
has been observed to flip within the same run, so read it live rather than from
this line.

## Kill register

- **K1** Admitting a host from documentation or by analogy to Claude.
- **K2** Any LLM-judged recall measurement — string match on the frozen corpus only.
- **K3** Thinning a host that is `observed-false` or `unobserved`.
- **K4** Removing `.cursor/rules/*.md` bodies before 1.3 observed double carry.
- **K5** New top-level CLI verb; a daemon; a retriever.
- **K6** Moving this file to `later/` or descoping to a carrier. Unobserved hosts are
  recorded as unobserved and the file stays active with those lines `[ ]` and the observation
  protocol named.

## Provenance

- **Source:** an owner-directed external LLM ideation round, consumed to
  `agents/tmp.old/inbox-2026-09-u/`. No third-party repository, product or vendor is a
  source of this plan; the host names are this package's own delivery targets.
- **Gap table:** `KEEP` — the host table's slot counts (all nine verified), the Cursor and
  Cline `user_prompt_submit` bindings, `rule-inject`'s absence from both concern lists, the
  two native lazy emitters, the keyword (491) and phrase (212) trigger totals, and E3's
  admission rule. `KEEP, corrected` — the path-shaped trigger count (21 of 119, not 5, so
  the addressable population is 98 rather than 114) and the Cowork row's line
  (`enforcement-by-host.md:21`, not `:20`). `CUT` — nothing; every drafted step survived,
  two on corrected numbers.
- **Council:** none. E3 is an owner ruling.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | A host is admitted on a plausible reading rather than an observation | product | Cursor and Cline bind the right slot, which makes "it must work" the cheapest conclusion available. Cowork binds eight slots and discards dispatcher output — the same shape, measured false. Admitting on the binding would thin a host whose rules then reach nobody. | E3 requires one observed transcript in which the model visibly acts on a delivered body, K1 forbids admission by documentation or analogy, and 1.2 refuses to write an `observed-*` value without a transcript pointer. **Re-reviewed 2026-09-08: held, and it was EXERCISED rather than merely present.** Claude Code is recorded `unobserved`, not `observed-true` — no transcript exists because the mode has been `eager-all` for the whole history — and `_lib/injection_effect.ts` was deliberately built with NO code path from the computed axis to the observed one. Cowork remains the standing proof the two diverge: eight slots bound, dispatcher output discarded, exit 0. | Phase 2: Admit hosts that pass (E3) |
| 2 | The census fills with `unobserved` and the file reads as stalled | implementation | Most hosts cannot be observed from a Claude session, so several lines will stay open for a long time and a reader may treat the roadmap as abandoned. | K6 makes `unobserved` an outcome rather than a deferral: the line stays `[]`, the file stays active, and 2.2 keeps the host's tree byte-identical to `eager-all` in the meantime so nothing is lost while it waits | Phase 1: Measure context injection per host |
| 3 | Description-lowering leaks trigger terms into a user-visible field | product | The emitted description is the host's routing surface and a reader's first line about the rule. Appending up to N raw trigger terms can turn a sentence into a keyword list. | 3.1 caps by the host's own description length and measures recall by string match on the frozen corpus, so a change that reads worse and routes no better is visible before it lands | Phase 3: Native lazy forms get the triggers they need |
| 4 | The corrected 98-rule population is itself re-derived wrongly later | implementation | The draft's 5 became 21 on one re-measurement. A later run summing only `path_prefix` or only `file_pattern` lands on a third number and re-scopes Phase 3 silently. | The Context states the derivation (41 `path_prefix` + 13 `file_pattern` across 21 files) and 3.1 requires the population figure in the commit message, so a divergent count is a visible contradiction rather than a quiet re-scope. **Re-reviewed 2026-09-08: this risk FIRED, and the mitigation caught it — which is the outcome the row was written for.** The population was re-derived a third time and came out different again: **97, not 102**, because 8 of the 105 `auto` rules carry no keyword or phrase trigger at all. The figure is in the commit message as the row requires, so the divergence surfaced as a contradiction to resolve rather than as a silent re-scope. 3.1's measured result is stated against the corrected denominator: 179 → 284 of 309 auto-rule positives, 57.9 % → 91.9 %. | Phase 3: Native lazy forms get the triggers they need |
| 5 | The resolved predecessor blocker is read as unblocking the roadmap | product | Added 2026-09-09 with the re-review, because the change that prompted it creates the risk. `predecessor-delivery-for-every-host-unmerged` closing is the loudest event on this file in a week, and it closed exactly one step. A later reader who sees one blocker resolved and the predecessor merged can conclude the roadmap is runnable, start step 1.1, and find its second limb still gated on a live transcript nobody has produced. | The blocker's resolution text names, in its own body, what stays blocked and on which other blocker: 1.1's second limb and 2.1 limb (a) on `no-host-observed-true-injection`, 2.1 limb (b) on a host admitted under it. Its `What to do` step 1 is left standing with the correction beside it rather than edited away, so a reader meets the superseded reasoning and its answer together instead of a clean page that hides the transition. | Phase 4: Truth surfaces |

## Acceptance Criteria

- [x] Every host has an `injection_effect` line with provenance in the census.
      Met 2026-09-08. Nine hosts, nine lines, in
      `agents/evidence/analysis/host-injection-effect-2026-09.md`. Provenance is enforced
      rather than reviewed: `recordProblems` refuses an `observed-*` row missing host
      version, transcript or date, and the generator exits 1 before writing anything if any
      row is inadmissible. 1 `observed-false`, 8 `unobserved` — and `unobserved` is the
      result K6 makes it, not a blank.
- [ ] Every admitted host measures rules ≤ 20,000 tok; every other host is byte-identical to
      `eager-all`.
      OPEN 2026-09-08, first limb VACUOUS and second limb not assertable here. No host is
      admitted, so there is no host to measure — recorded as open rather than ticked on the
      empty set, because a tick would read as "we measured the admitted hosts" when the
      honest statement is "there are none". The byte-identity limb is
      `check_host_tree_parity`, which is green on the unmerged predecessor branch and is not
      present on this one.
- [ ] 102/102 `auto` rules carry ≥ 1 trigger term in their Cursor and Windsurf descriptions.
      OPEN 2026-09-08 as literally written, and it is UNREACHABLE rather than unfinished.
      The corpus holds 105 `auto` rules, of which 8 carry no keyword or phrase trigger to
      lower — four trigger-less, four path-only and already routed natively through `globs`.
      97 of 105 is the whole of the lowerable set and every member of it is covered. Left
      unticked rather than re-scoped in place, because rewriting an acceptance criterion to
      match the result is the goalpost-move this repository forbids; the corrected number
      and its derivation are in 3.1 for whoever revises it.
- [ ] L4 row replaced; all quality gates green.
      HALF MET 2026-09-08. The L4 row IS replaced —
      `grep -c 'no equivalent today' docs/enforcement-by-host.md` returns 0 — and every
      quality gate this branch can run is green. The AC stays open because 4.2's ADR half
      cannot be done from this branch: ADR-262 lives on the unmerged predecessor, and
      recreating it here would turn one decision record into two.
