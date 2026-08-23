---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to role-scoped spawn profiles

> **Source:** agents/tmp.old/40k — an external token-economy analysis pass.

## Goal

A subagent stops paying for the whole estate when it only needs part of it —
but only where a measurement says the trim is free. When this is finished:
the delivery question is answered with capture-grade, version-pinned evidence
rather than an assumption; a per-role manifest exists that composes the three
scoping axes the package already has, without adding a fourth; at least one
role runs scoped in production behind a published A/B with a measured
tokens-per-spawn saving; and every role whose A/B was not run, or ran without
clearing its pre-registered bar, stays unscoped. The default is unscoped and it
stays unscoped until a number moves it.

## Context / What is verified

Re-verified against the tree on 2026-08-22.

- **Subagent prompts are generated for exactly one host, and deliberately not
  condensed.** `src/scripts/condense.ts:1940` (`generate_claude_subagents`) is
  gated on `_tool_active('claude-code')` at `src/scripts/condense.ts:2405`. Its
  own doc comment (`src/scripts/condense.ts:1935-1937`) states the projection
  reads from `src/` directly because *"subagent prompts are not
  telegraph-condensed"*. So the payload a spawn carries is uncondensed by
  design, which is exactly why scoping is the available lever and compressing
  is not.
- **The other hosts get a passive reference, not a spawn.**
  `src/scripts/condense.ts:2025-2026` — *"Only Claude Code has native subagents
  … On the other rules-surface hosts a subagent projects to a loadable context
  file — a passive reference, honestly labelled"*. Everything this roadmap
  measures is therefore single-host by construction, and the published number
  must say so.
- **Three scoping axes already exist. There is no fourth, and this roadmap does
  not add one.**
  - `discipline_profile` (`src/config/agent-settings.template.yml:134`), four
    values — `off` / `essential` / `full` / `auto` — with measured lift recorded
    at lines 112-123: `essential` carries `+0.458, p=0.0135`, and `full`'s
    residual over it is *not* significant (`p=0.37`).
  - `rule_workspaces` (`src/config/agent-settings.template.yml:80`).
  - `rule_packs` (`src/config/agent-settings.template.yml:105`), which accepts
    `auto` to derive the id list from the active-pack set.
- **The template already forbids automation from choosing this family.**
  `src/config/agent-settings.template.yml:144-147` reads the marking as
  ABSOLUTE: *"it forbids an automated CHOICE of default for the family, not
  merely a script rewriting your file. No measurement, however clean, licenses
  an agent to flip it on your behalf."* Phase 1 is design-only for that reason,
  and Phase 2's flip is human-gated for the same one.
- **The trimming-costs-quality precedent is in-tree and measured.** The same
  template block records that the better-evidenced value was NOT shipped as the
  default, on two independent grounds. `docs/benchmark.md:91` carries the
  cost-factor sweep the lift numbers come from. A roadmap that assumes trimming
  is free is arguing against this package's own published evidence.
- **The delivery question is genuinely open, and its capture half is already
  transferred.** `agents/roadmaps/stubs/road-to-subagent-payload-capture.md`
  states the cut line verbatim: *"injecting `AGENT_HOOK_CAPTURE_DIR` into host
  settings is a host-environment modification and the resulting verbatim capture
  is an egress risk."* That is why the capture below is a maintainer errand with
  a containment protocol, never automation.
- **The parent roadmap answered its assertion halves and must not be reopened.**
  ~~`agents/roadmaps/archive/road-to-subagent-lifecycle-integrity.md` is active with three
  open steps — Phase 2 Step 2 (line 504), Phase 2 Step 3 (line 549), Phase 7
  Step 1 (line 843).~~ **CORRECTED 2026-08-23 — every clause of that was false,
  and the sentence contradicted itself by writing the `archive/` path and then
  calling the file active.** Measured on the branch: the file is **archived**
  (drain PR **#1532** merged 2026-08-22); `grep -c '^- \[ \]'` returns **0**, the
  ledger being 15 `[x]` and 8 `[-]`, so there are **no open steps at all**; and
  the three named steps sit at lines **521**, **587** and **772**, all `[-]`,
  all carrying a `transferred` disposition pointing at
  `agents/roadmaps/stubs/road-to-subagent-payload-capture.md`. The consumption
  below is therefore read-only against an archived, fully-dispositioned file —
  the correction is to this sentence, never to the dependency. Recorded as a
  finding in [`role-scoped-spawn-profiles.md § E`](../../evidence/investigations/role-scoped-spawn-profiles.md).
  Its findings are recorded in
  `agents/evidence/investigations/subagent-lifecycle-drain-close.md`:
  `agent_type` is null on **3,129 of 3,400** stop records (92.0 %, line 116);
  **307 of 307** `subagent_start` records read `depth_basis: "assumed-root"`
  with `parent_ref: null` (line 131); no payload has ever supplied a parent in
  632 observations (line 124). Phase 0 below CONSUMES those findings. It does
  not re-derive them and must not re-open them.
- **The transcript machinery for Phase 3 mostly exists.**
  `src/scripts/_lib/cc_transcript.ts` exports `scanTranscripts` (line 260),
  `aggregateByBucket` (line 317), `billableInputTokens` (line 124) and
  `weightedInputUnits` (line 134); `computeColdStarts` lives at
  `src/scripts/cache_realization_report.ts:145` and already filters
  `r.bucket === 'subagent'`. The delta for a token-sink ranking is small.
- **The re-read suppression surface is `src/scripts/hot_context_hook.ts`**, a
  `stop` + `session_start` hook with a 400-word hard cap writing
  `agents/runtime/state/hot-context.md` (module doc, lines 3-12). It is **not**
  under `src/scripts/hooks/` — that path does not hold it, and a change written
  against the wrong path silently edits nothing.

## Phase 0 — Answer what a Task-spawned subagent actually receives

Nothing downstream may proceed on an assumed answer. A per-role manifest that
trims a payload nobody has observed is trimming a guess, and the saving it
claims would be arithmetic over an unverified denominator.

- [x] **Step 1:** Consume the parent roadmap's answered assertions rather than
      re-deriving them. Read `agents/evidence/investigations/subagent-lifecycle-drain-close.md`
      sections B2, B3 and B4 and record, in this roadmap's own evidence file,
      which questions are already closed: `last_assistant_message` delivery on
      `subagent_stop`, `agent_type` nullity at 92.0 %, and the zero-parent-linkage
      result over 632 observations. Anything on that list is out of scope here.
      verify (discharged): the three findings are cited with their recorded
      counts in [`role-scoped-spawn-profiles.md § A`](../../evidence/investigations/role-scoped-spawn-profiles.md)
      — B2 (17 `fail` records, an existence proof), B3 (**3,129 of 3,400**
      stops null, **92.0 %**), B4 (**0 in 632** observations). `grep -c
      'subagent-lifecycle-drain-close' agents/evidence/investigations/role-scoped-spawn-profiles.md`
      returns **3**, above the required 1. Both caveats travel with the
      findings: B2 proves existence and neither a rate nor which key spelling,
      and B4 is explicitly **not** an absence proof. Nothing in the dependency
      was edited.

      **Defect found in this step's own premise.** The step said to consume from
      an *active* roadmap with three open steps; the dependency is **archived**
      with **zero** open steps and all three named steps `[-]`/`transferred`
      (PR #1532, merged 2026-08-22). The premise was falsified, not the task —
      recorded in § E and corrected in the Context above.

- [x] **Step 2:** Pin the host version before any capture, and record it as a
      literal string. A payload observation without a version pin cannot be
      re-checked after the host updates, and every conclusion this roadmap draws
      about delivery is conditional on that version.
      verify (discharged): recorded in
      [`role-scoped-spawn-profiles.md § B`](../../evidence/investigations/role-scoped-spawn-profiles.md)
      as the literal string **`2.1.241 (Claude Code)`** from `claude --version`,
      with the session date **2026-08-23**. A literal value, not a range.

      Recorded even though Step 3 was declined: it pins the host under which the
      decline and every Phase 3 figure were taken, which is what a later re-read
      needs in order to know what it is comparing against.

- [-] **Step 3:** Capture the inbound spawn payload under the containment
      protocol. This is the maintainer errand named in the blocker below. What
      the roadmap needs is the FIELD AND SECTION INVENTORY of what a
      Task-spawned subagent receives — which rule files, whether the skills
      catalog arrives, whether the CLAUDE.md hierarchy arrives, and at what
      size — never the content of any field.
      verify (discharged as CANCELLED): the capture is **declined** —
      `b-maintainer-run-capture` option **(b)**, council verdict convergent
      **2 of 2** (`anthropic/claude-sonnet-4-5`, `openai/codex-default`; 2
      rounds, blind peer review, \$0.0516). No agent action can perform it: the
      actor is the **host owner** on their own machine, the parent's Non-goals
      forbid automating it, and the cut line is a recorded security decision
      routed through `security-sensitive-stop` § self-modification. Decision and
      full rationale in
      [`role-scoped-spawn-profiles.md § C`](../../evidence/investigations/role-scoped-spawn-profiles.md);
      the work is preserved with a three-point integrity check in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 4:** Compute the trimmable fraction from the captured inventory,
      not from the projected tree. The projection is what the package emits; the
      inventory is what the spawn receives. Where the two disagree, the
      inventory wins and the disagreement is recorded as a finding.
      verify (discharged as CANCELLED): **no trimmable fraction is published.**
      Both the numerator and the denominator were required by this step's own
      text to come from the Step 3 inventory, and that inventory does not exist.
      Publishing a fraction from the projected tree instead is exactly the
      Risk-1 failure this roadmap names — *"a confident number measuring the
      wrong thing"* — so the honest output is the absence, stated. Cancelled
      with Step 3; preserved in the same stub.

- [x] **Step 5:** Stop here if the inventory says the payload is already small.
      A saving that is not there is not a saving, and the honest outcome of
      Phase 0 may be that the rest of this roadmap should not be built.
      verify (discharged): the continue-or-stop line is recorded verbatim in
      [`role-scoped-spawn-profiles.md § D`](../../evidence/investigations/role-scoped-spawn-profiles.md):
      **`STOP for Phases 1-2. CONTINUE for Phase 3.`**

      **The number it was taken on is zero — and that is the honest statement.**
      Not a small measured payload, but *no measurement at all*: the branch was
      reached via the Step 3 decline, not via a small denominator. This step
      pre-authorised exactly that outcome ("the honest outcome of Phase 0 may be
      that the rest of this roadmap should not be built"). Phase 3 is declared
      independent in both directions and proceeded.
## Phase 1 — The per-role manifest, composing the three existing axes

Design and generation only. No default changes, no flip, nothing armed. The
settings family this composes is marked do-not-set-from-automation, and that
marking is read as absolute.

- [-] **Step 1:** Define the manifest shape as a contract before generating one.
      Per role: which `discipline_profile` value, which `rule_workspaces` ids,
      which `rule_packs` ids, and — mandatorily — the evidence reference that
      justifies the trim. A role with no evidence reference is unscoped by
      construction; the field is not optional and has no default.
      verify (discharged as CANCELLED): cancelled with Phase 0 Steps 3-4 —
      the manifest would trim a payload nobody has observed. Council decision
      (b), 2 of 2. Criterion, dependent-step list, named producer and
      detection probe preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 2:** Enumerate the roles from the subagent sources already in the
      tree, not from an invented taxonomy. The generator at
      `src/scripts/condense.ts:1940` walks a source directory; the role list is
      whatever that directory holds.
      verify (discharged as CANCELLED): cancelled with Phase 0 Steps 3-4 —
      the manifest would trim a payload nobody has observed. Council decision
      (b), 2 of 2. Criterion, dependent-step list, named producer and
      detection probe preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 3:** Generate the manifest with every role UNSCOPED. The shipped
      state after Phase 1 is a manifest that changes nothing — same payload,
      same behaviour — so that Phase 2's A/B measures the scoping and not the
      manifest's arrival.
      verify (discharged as CANCELLED): cancelled with Phase 0 Steps 3-4 —
      the manifest would trim a payload nobody has observed. Council decision
      (b), 2 of 2. Criterion, dependent-step list, named producer and
      detection probe preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 4:** Compose the three axes; do not add a fourth. If a role's
      desired scope is inexpressible as a combination of `discipline_profile`,
      `rule_workspaces` and `rule_packs`, that is a finding to record, not a
      licence to introduce a new key.
      verify (discharged as CANCELLED): cancelled with Phase 0 Steps 3-4 —
      the manifest would trim a payload nobody has observed. Council decision
      (b), 2 of 2. Criterion, dependent-step list, named producer and
      detection probe preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 5:** Keep the flip human-gated in the manifest itself. The manifest
      records what a scoped role WOULD be; arming it is a separate, recorded
      act. The template's absolute marking on this settings family is the
      reason, and it is cited in the contract rather than paraphrased.
      verify (discharged as CANCELLED): cancelled with Phase 0 Steps 3-4 —
      the manifest would trim a payload nobody has observed. Council decision
      (b), 2 of 2. Criterion, dependent-step list, named producer and
      detection probe preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).
## Phase 2 — Pre-registered A/B as the only gate that arms a role

- [-] **Step 1:** Pre-register the A/B before any pair runs. Task corpus, the
      two arms (role scoped / role unscoped, everything else identical), pair
      count, the quality observable, and the pass bar — both the token saving
      required AND the maximum quality regression tolerated. Two bars, not one:
      a token saving bought with a quality loss is not a saving.
      verify (discharged as CANCELLED): cancelled with Phase 1 — an A/B needs
      the manifest it would measure. Council decision (b), 2 of 2. Preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 2:** Anchor the quality bar on the in-tree discipline-lift result,
      not on a fresh opinion. `src/config/agent-settings.template.yml:117-119`
      records `+0.458, p=0.0135` for `essential` — that is the measured cost of
      trimming in this package, and a scoping proposal that ignores it is
      arguing against published evidence with none of its own.
      verify (discharged as CANCELLED): cancelled with Phase 1 — an A/B needs
      the manifest it would measure. Council decision (b), 2 of 2. Preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 3:** Run the pairs and publish, whichever way it goes.
      `docs/benchmark.md` already carries a documented honesty-label vocabulary
      (`docs/benchmark.md:15`, `## Honesty labels (read first)`) and multiple
      published nulls, so the honest outcome has a shipped precedent and needs
      no new argument here.
      verify (discharged as CANCELLED): cancelled with Phase 1 — an A/B needs
      the manifest it would measure. Council decision (b), 2 of 2. Preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 4:** Honour the honest null — non-negotiable. If the A/B does not
      clear its pre-registered bar, the role stays UNSCOPED and the null is
      published as the finding. The bar is not lowered, the corpus is not
      extended to reach it, and no pair is excluded after the fact.
      verify (discharged as CANCELLED): cancelled with Phase 1 — an A/B needs
      the manifest it would measure. Council decision (b), 2 of 2. Preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 5:** Arm at most one role on a cleared bar, and leave every other
      role unscoped. One production role with a real number is worth more than
      six with an argument, and it bounds the blast radius of a wrong call to a
      single role.
      verify (discharged as CANCELLED): cancelled with Phase 1 — an A/B needs
      the manifest it would measure. Council decision (b), 2 of 2. Preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] **Step 6:** Record the reversal path in the same commit that arms the
      role. Unscoping is a manifest edit and a regeneration; write down the
      exact steps so a regression is reversible by someone who did not run the
      A/B.
      verify (discharged as CANCELLED): cancelled with Phase 1 — an A/B needs
      the manifest it would measure. Council decision (b), 2 of 2. Preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).
## Phase 3 — Transcript token-sink ranking and re-read suppression

Independent of Phases 0-2 in both directions: it needs no capture and arms
nothing. It can land first if Phase 0's blocker stays open.

- [x] **Step 1:** Build the token-sink ranking over the transcript store. The
      machinery exists — `scanTranscripts` (`src/scripts/_lib/cc_transcript.ts:260`),
      `aggregateByBucket` (line 317) and `billableInputTokens` (line 124) — and
      `computeColdStarts` (`src/scripts/cache_realization_report.ts:145`)
      already filters `r.bucket === 'subagent'`. The delta is a ranking over
      what those already return.
      verify (discharged): the ranking runs — `./scripts-run
      src/scripts/token_sink_report --max-age-days 90 --top 12`, new instrument
      [`src/scripts/token_sink_report.ts`](../../../src/scripts/token_sink_report.ts),
      built on the four existing exports (`_lib/cc_transcript.ts:260`, `:317`,
      `:124`, `:134`) rather than re-deriving any of them. Run of 2026-08-23
      reports the per-sink ordering over **132,410 deduped records** across
      **2,167 legs**: `main/claude-opus-5` **66.3 %**, `subagent/claude-opus-5`
      15.6 %, `main/claude-fable-5` 8.4 %. Full table in
      [`role-scoped-spawn-profiles.md § F`](../../evidence/investigations/role-scoped-spawn-profiles.md).

      **The ranking argues against this roadmap's own premise, so it is stated
      rather than buried.** The subagent bucket is **22.1 %** of weighted input
      and the orchestrator's own main-bucket traffic is the largest single sink
      at 66.3 % — a perfect trim of every subagent payload is bounded by roughly
      a fifth of weighted input, before any quality cost.

- [x] **Step 2:** Report the ranking with its denominator visible. A sink's
      share is only meaningful against the total it was measured from, and the
      store is one machine's history — the report says so rather than reading as
      a property of the package.
      verify (discharged): the report leads with its denominator and cannot be
      read without it — **132,410** deduped of 255,895 seen (dedup 48.3 %),
      **2,167** legs, range `2026-07-20T00:27:53.712Z` ..
      `2026-08-23T13:47:04.865Z`, 90-day window. The single-store caveat is
      carried as **data**, not as rendering: `Report.provenance` states *"one
      machine's ~/.claude/projects transcripts … not a property of the
      package"*, so a JSON consumer that keeps the numbers and drops the prose
      still keeps it. Two tests assert the caveat's presence, and both go red
      when it is removed.

- [x] **Step 3:** Measure re-reads before suppressing any. Identify files read
      more than once within a session leg and rank them by wasted tokens. A
      suppression built without this measurement is suppressing whatever the
      author happened to notice.
      verify (discharged): the measurement ran **before** the suppression was
      written — new instrument
      [`src/scripts/_lib/transcript_reads.ts`](../../../src/scripts/_lib/transcript_reads.ts).
      Over the same window: **9,601** read-shaped calls, **2,163** duplicate
      reads within a leg (**22.5 %**), **889** distinct files re-read at least
      once, wasted **3,077,169** tokens as a stated `chars / 4` **proxy** (the
      transcript carries no per-tool-result token count, so the field is named
      `wasted_tokens_proxy` in both renderers).

      A **leg** is one `.jsonl` file — one context window. Legs are never
      joined, so a file read once in the main leg and once inside a subagent is
      **not** a re-read; a test sabotaging that boundary goes red. Four of the
      top five sinks are large single artefacts re-read inside one leg (review
      diffs, one big component), which is the population § H targets — the
      suppression is aimed at a measured pattern, not at what an author
      happened to notice.

- [x] **Step 4:** Extend the hot-context surface rather than adding a second
      one. `src/scripts/hot_context_hook.ts` already owns the survives-a-boundary
      artefact, with a 400-word hard cap and a privacy floor that DROPS rather
      than rewrites violating lines. Any re-read suppression rides that
      contract; note the path, because `src/scripts/hooks/` does not hold this
      file and an edit written against that path changes nothing.
      verify (discharged): the change is in
      [`src/scripts/hot_context_hook.ts`](../../../src/scripts/hot_context_hook.ts)
      — **the step's path warning was real and was honoured**;
      `src/scripts/hooks/` does not hold this file and an edit written there
      would have changed nothing. `_reread_lines()` plus a `## Re-Read Advisory`
      section, populated from `payload.transcript_path`.

      Both invariants hold **and were proved sensitive by sabotage** — a test
      never seen red has unknown sensitivity. 400-word cap: the advisory is
      registered **last** in `trimOrder`, so it is the first section dropped
      when the cap bites; removing it from `trimOrder` reds the test. Privacy
      floor: every line goes through `_redact_lines` → `redact_low_impact_entry`
      and a violating line is **dropped whole**, counted in the `Privacy floor:
      N line(s) dropped` stamp; bypassing the floor reds the test. 23 tests
      green in `tests/scripts/hot_context_hook.test.ts`.

      **Two authoring defects this step's own verification caught**, recorded
      because the mechanism only exists because they were caught: the first cap
      test was **insensitive** (the 3-line cap alone holds 400 words, so the
      test passed with the advisory removed from `trimOrder` entirely), and its
      replacement then **failed against correct code** because the record
      sections are snippet-capped in *chars*, so long filler words never reach
      the word cap. Both are documented at
      [`role-scoped-spawn-profiles.md § H`](../../evidence/investigations/role-scoped-spawn-profiles.md).

- [x] **Step 5:** Keep suppression advisory in this roadmap. Emitting a "you
      already read this" note is cheap and reversible; refusing a read is
      neither, and the two must not arrive in one change.
      verify (discharged): **no refuse branch exists**, verified by grep rather
      than asserted. The only occurrence of the token `deny` in
      `src/scripts/hot_context_hook.ts` is inside the doc comment stating there
      is none (`hot_context_hook.ts:176`); the file contains no `block`, no
      `permissionDecision`, no `exit(2)` and no `return 2`, and `main()` returns
      `0` on every path (`:442`, `:490`). A test asserts the write slot's stdout
      is **empty** — the hook emits no decision at all on this surface. The
      output is three lines in a markdown cache that a later leg may ignore.

## Blockers

### blocker: b-maintainer-run-capture

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 0 — Answer what a Task-spawned subagent actually receives
- **What to do:** pick exactly one — (a) the maintainer performs one time-boxed
  capture session on their own machine under the full containment protocol
  recorded in `agents/roadmaps/stubs/road-to-subagent-payload-capture.md`
  (dedicated empty directory, `chmod 700`, one declared-duration session,
  extract field and section NAMES only, delete the files in the same sitting,
  remove the environment entry, then prove capture stopped with a fresh-session
  negative probe, and abort outright on any unexpected content class); or
  (b) the capture is declined, in which case Phase 0 Steps 3 and 4 are marked
  `[-]` and Phases 1 and 2 are cancelled with them — Phase 3 is independent and
  proceeds either way.
- **Recommendation:** (a), but only if the capture can be time-boxed to a single
  session that same day. The containment protocol is longer than the errand on
  purpose, and a capture left half-done is a standing egress surface with no
  owner watching it. If it cannot be time-boxed now, take (b) and re-open later
  rather than starting and pausing.
- **If you do nothing:** Phases 0, 1 and 2 stay open against an unmeasured
  denominator. Nothing breaks, but the scoping question stays permanently
  unanswerable and any saving anyone quotes for it is arithmetic over a guess.
- **Resolved when:** this roadmap's evidence file records the version-pinned
  section inventory from Step 3 and the negative probe from the containment
  protocol reports the capture directory empty, OR Phase 0 Steps 3-4 and
  Phases 1-2 are marked `[-]` in this file with the decline recorded.
- **Resolution (2026-08-23):** the **second** branch of the criterion above.
  Option **(b)** — the capture is declined. Phase 0 Steps 3-4 and all eleven
  steps of Phases 1-2 are `[-]` in this file, and the decline is recorded.

  **Mechanism: AI council, convergent 2 of 2** — `anthropic/claude-sonnet-4-5`
  and `openai/codex-default`, 2 rounds, blind peer review, actual cost
  \$0.0516. Response artefact
  `agents/runtime/council/responses/q-spawn-capture-blocker.md` is **gitignored
  runtime state** and machine-local; the verdict, both seats' reasoning and the
  divergence are transcribed into
  [`role-scoped-spawn-profiles.md § C`](../../evidence/investigations/role-scoped-spawn-profiles.md)
  and the PR body, which are the durable copies.

  **Why (b) and not (a).** Option (a) is not executable by an autonomous run on
  three independent grounds, each recorded in the tree rather than argued here:
  the actor is named as *"the **host owner**, performing a fresh-session capture
  on the machine whose `~/.claude/settings.json` the host reads. Not a
  maintainer role and not a CI job"*; this roadmap's own Non-goals forbid
  *"Automating the capture"*; and the cut line is a **security** decision —
  `AGENT_HOOK_CAPTURE_DIR` is a host-environment modification and the resulting
  verbatim capture is an egress risk — routed through
  `security-sensitive-stop` § self-modification.

  **Divergence, recorded rather than smoothed over.** Both seats picked (b) and
  both required a lossless stub. They split on AC-1: one read AC-1's own `OR`
  clause as *satisfied by design* via the decline path, the other marked it
  `[-]`. This file takes the first reading — the criterion's text admits the
  decline explicitly — and says so at AC-1 so a reader sees the call that was
  made rather than inheriting it silently.

  **Kill criteria (both seats, converged).** A host owner commits to completing
  the full containment protocol in one uninterrupted same-day session and
  produces both the version-pinned section inventory and a successful
  fresh-session negative probe. *Autonomous capture becoming technically
  possible is explicitly insufficient* — the recorded security cut line and the
  non-goal would each have to be revised separately, by their owners.

  Preserved work:
  [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

### blocker: b-lifecycle-integrity-open-steps

- **Status:** resolved
- **Owner:** whoever owns `road-to-subagent-lifecycle-integrity`
- **Blocks:** Phase 0 — Answer what a Task-spawned subagent actually receives
- **What to do:** pick exactly one — (a) treat that roadmap's recorded findings
  as closed input and consume them read-only per Phase 0 Step 1, touching none
  of its three open steps (Phase 2 Step 2 at line 504, Phase 2 Step 3 at line
  549, Phase 7 Step 1 at line 843); or (b) if a Phase 0 finding here contradicts
  one of its recorded results, stop and route the contradiction to that
  roadmap's owner as a finding against it — never silently re-derive or amend it
  from this file.
- **Recommendation:** (a). The three findings this roadmap consumes are already
  measured at n=3,400 and n=632 and are not the subject of its open steps, so
  consuming them costs nothing and re-deriving them would spend a capture
  session re-answering a closed question.
- **If you do nothing:** Phase 0 risks re-deriving a measured result and
  publishing a second figure for the same question — the disagreeing-numbers
  failure this tree already documents for its own size metrics.
- **Resolved when:** Phase 0 Step 1 is complete with the three findings cited by
  their recorded counts, and this file contains no edit to
  `road-to-subagent-lifecycle-integrity`.
- **Resolution (2026-08-23):** **resolved by execution**, option **(a)** —
  read-only consumption. Phase 0 Step 1 is `[x]` with all three findings cited
  at their recorded counts (B2: 17 `fail` records; B3: **3,129 of 3,400**,
  **92.0 %**; B4: **0 in 632**) in
  [`role-scoped-spawn-profiles.md § A`](../../evidence/investigations/role-scoped-spawn-profiles.md),
  and this drain edited nothing in the dependency.

  **This blocker's premise was falsified, which is what resolved it.** It
  guarded against interfering with three *open* steps. Measured on the branch:
  the dependency is **archived** (drain PR **#1532** merged 2026-08-22),
  `grep -c '^- \[ \]'` over it returns **0**, and the three named steps sit at
  lines **521**, **587** and **772** — not 504/549/843 — all `[-]` and all
  carrying a `transferred` disposition. There is no in-progress work to touch,
  so the read-only constraint is satisfied **structurally**, not merely
  vacuously. Option (b)'s contradiction branch did **not** fire: nothing
  measured here contradicts B2, B3 or B4.

  **Mechanism: AI council, 1 of 2 present — DEGRADED, stated as such.** The
  second seat failed in round 2 on a transport error (`os_error: ENOBUFS`), so
  round 2 is **not** convergence. The surviving seat
  (`anthropic/claude-sonnet-4-5`) reports both round-1 reviewers agreeing on
  "resolved by execution" and on AC-2 unchanged; that is a **report**, not an
  independently verifiable quorum, and it is labelled that way here rather than
  quoted as 2/2. The run was not repeated because the question is a **fact
  check** — archived, zero open steps, PR merged — and all three facts are
  re-checkable from the tree by any reader. Response artefact
  `agents/runtime/council/responses/q-spawn-lifecycle-dep-blocker.md`
  (gitignored, machine-local); actual cost \$0.0450.

  **Kill criteria.** Future evidence contradicting B2, B3 or B4 at their
  recorded counts; or the transferred capture stub producing a finding that
  contradicts them; or discovery that the three `[-]` steps were cancelled with
  an unresolved contradiction rather than cleanly transferred.

  **Side finding:** this roadmap's own Context sentence asserted the false
  premise. Corrected in place (see Context above and § E) — the correction is to
  the describing sentence, never to the archived dependency.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The trim ships on an assumed payload | implementation | Every saving this roadmap can claim is a fraction of a denominator nobody has observed. Building the manifest against the projected tree instead of the received payload produces a confident number measuring the wrong thing. | Phase 0 gates everything downstream, Step 4 requires both numerator and denominator to come from the capture, and Step 5 permits an explicit stop when the payload turns out to be small. | Phase 0 — Answer what a Task-spawned subagent actually receives |
| 2 | Trimming buys tokens and costs quality | product | The package's own measurement says discipline rules carry a significant lift. A scoping change that only counts tokens will look like a win and be a regression, and the regression is invisible in the metric being watched. | Phase 2 Step 1 pre-registers TWO bars, and Step 2 anchors the quality bar on the recorded lift figures rather than on a fresh judgement. | Phase 2 — Pre-registered A/B as the only gate that arms a role |
| 3 | A fourth scoping axis is introduced | implementation | When a role's desired scope does not compose from the three existing axes, adding a key is the path of least resistance — and a fourth axis permanently raises the cost of reasoning about which rules load. | Phase 1 Step 4 makes inexpressibility a recorded finding rather than a licence, and the manifest schema admits exactly three axis fields plus the evidence reference. | Phase 1 — The per-role manifest, composing the three existing axes |
| 4 | The capture becomes a standing egress surface | implementation | The environment entry that enables capture survives an interruption, a crashed session and a forgotten cleanup step, and the capture is fail-silent by design — nothing complains while it keeps writing. | The blocker's option (a) carries the full containment protocol including the fresh-session negative probe, and its Resolved-when requires that probe to report empty. Option (b) is a legitimate decline, not a failure. | Phase 0 — Answer what a Task-spawned subagent actually receives |
| 5 | The parent roadmap is reopened by accident | implementation | This roadmap reads findings from an active roadmap with three open steps. Consuming and amending look similar from inside a single edit session. | The second blocker makes read-only consumption an explicit disposition and routes any contradiction to that roadmap's owner rather than resolving it here. | Phase 0 — Answer what a Task-spawned subagent actually receives |
| 6 | A single-host result is generalised | product | Only one host has native subagents. Every number this roadmap produces is a fact about that host, and a benchmark section that omits the limitation invites a reader to treat it as a property of the package. | Phase 2 Step 3 requires the single-host limitation to be stated in-band in the published section, alongside the pair count and the host. | Phase 2 — Pre-registered A/B as the only gate that arms a role |

## Non-goals

- **Adding a fourth scoping axis.** Three exist and compose. See Risk 3.
- **Changing any shipped default in the discipline-profile family.** The
  template marks it do-not-set-from-automation and reads that as absolute.
- **Reopening `road-to-subagent-lifecycle-integrity` or its transferred stub.**
  Findings are consumed read-only; contradictions are routed, not resolved here.
- **Automating the capture.** The cut line is recorded and is not this roadmap's
  to move.
- **Refusing a re-read.** Phase 3 emits advice. A refusal is a separate decision
  with its own owner.
- **Scoping more than one role on the first cleared bar.** See Phase 2 Step 5.

## Acceptance Criteria

- [x] AC-1 — The delivery question is answered with a version-pinned section
      inventory recorded in this roadmap's evidence file, or Phase 0 Steps 3-4
      are cancelled with the decline recorded.
      → Satisfied via the criterion's **second** branch, which was written for
      exactly this case: Phase 0 Steps 3-4 are `[-]` and the decline is recorded
      in [`role-scoped-spawn-profiles.md § C`](../../evidence/investigations/role-scoped-spawn-profiles.md).
      **No inventory exists** and none is claimed. The council split on this one
      criterion — one seat read the `OR` as satisfied-by-design, the other marked
      it `[-]`; this file takes the first reading because the criterion's own
      text admits the decline, and records the split at
      `blocker: b-maintainer-run-capture` § Resolution so the call is visible
      rather than inherited.

- [x] AC-2 — The three consumed findings are cited by their recorded counts, and
      this roadmap contains no edit to the parent roadmap.
      → Unchanged wording (both council seats: "unchanged"). B2 (17 `fail`
      records), B3 (**3,129 of 3,400**, **92.0 %**), B4 (**0 in 632**) cited in
      § A with their caveats attached; `git diff --stat` touches no file under
      `agents/roadmaps/archive/`.

- [-] AC-3 — ~~A per-role manifest exists whose schema admits exactly the three
      existing axes plus a mandatory evidence reference, and whose generated
      unscoped state produces byte-identical subagent payloads.~~
      → **CANCELLED** because the version-pinned section inventory required to
      design and verify the per-role manifest was not captured; the original
      criterion and all dependent work are preserved in
      [`stubs/road-to-role-scoped-spawn-manifest.md`](../stubs/road-to-role-scoped-spawn-manifest.md).

- [-] AC-4 — ~~A pre-registration naming corpus, arms, pair count and two bars is
      committed strictly before the first run artefact.~~
      → **CANCELLED** because pre-registration depends on the cancelled
      scoped-manifest work; the original criterion and dependent work are
      preserved in the cancellation stub.

- [-] AC-5 — ~~At least one role is scoped in production, its manifest entry cites
      a published benchmark section, and that section states pair count, host
      and the single-host limitation; every role without a cleared bar is
      unscoped.~~
      → **CANCELLED** because production role scoping depends on the cancelled
      manifest and pre-registered A/B. **Every role remains unscoped**, which is
      this roadmap's declared default and requires no action to hold. The
      original criterion and dependent work are preserved in the cancellation
      stub.

- [-] AC-6 — ~~When the A/B misses its bar, the null is published under an
      existing honesty label and the role remains unscoped.~~
      → **CANCELLED** because the A/B will not run; the original
      null-publication criterion and dependent work are preserved in the
      cancellation stub. Note the distinction: this is not an unpublished null,
      it is an unrun experiment, and § C states which.

- [x] AC-7 — A token-sink ranking and a re-read measurement are published with
      their record count and date range, and any suppression rides
      `src/scripts/hot_context_hook.ts` with its 400-word cap and drop-not-rewrite
      privacy floor intact, and has no refuse branch.
      → Ranking and measurement published in
      [`role-scoped-spawn-profiles.md §§ F-G`](../../evidence/investigations/role-scoped-spawn-profiles.md)
      with **132,410** deduped records over **2,167** legs, range
      `2026-07-20` .. `2026-08-23`, and the single-store caveat carried as data.
      Suppression rides `src/scripts/hot_context_hook.ts` (**not**
      `src/scripts/hooks/`); the 400-word cap and the drop-not-rewrite floor are
      each asserted by a test **proved red under sabotage**; no refuse branch
      exists (grep: no `block` / `permissionDecision` / `exit(2)` / `return 2`;
      `main()` returns `0` on every path).

## Council decisions — the durable record

Both blocker dispositions were decided by the AI council. The response
artefacts live under `agents/runtime/council/responses/`, which is **gitignored
runtime state** and therefore machine-local and absent from a clean clone — so
the verdicts are transcribed at each blocker's § Resolution and in
[`role-scoped-spawn-profiles.md`](../../evidence/investigations/role-scoped-spawn-profiles.md),
which are the copies that survive.

| Blocker | Verdict | Quorum | Cost |
|---|---|---|---|
| `b-maintainer-run-capture` | **(b)** — decline the capture; cancel Phase 0 Steps 3-4 and Phases 1-2 into a lossless stub | **2 of 2**, convergent, 2 rounds, blind peer review | \$0.0516 |
| `b-lifecycle-integrity-open-steps` | **resolved by execution**, option (a) — read-only consumption; premise falsified (archived, 0 open steps, PR #1532 merged) | **1 of 2 — DEGRADED**, second seat lost to `os_error: ENOBUFS` in round 2 | \$0.0450 |

The second row is **not** convergence and is not presented as such. It is a
fact check whose three facts are re-checkable from the tree by any reader, which
is why the degraded run was accepted rather than repeated.
