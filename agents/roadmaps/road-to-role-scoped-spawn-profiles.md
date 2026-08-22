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
  `agents/roadmaps/archive/road-to-subagent-lifecycle-integrity.md` is active with three
  open steps — Phase 2 Step 2 (line 504), Phase 2 Step 3 (line 549), Phase 7
  Step 1 (line 843). Its findings are recorded in
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

- [ ] **Step 1:** Consume the parent roadmap's answered assertions rather than
      re-deriving them. Read `agents/evidence/investigations/subagent-lifecycle-drain-close.md`
      sections B2, B3 and B4 and record, in this roadmap's own evidence file,
      which questions are already closed: `last_assistant_message` delivery on
      `subagent_stop`, `agent_type` nullity at 92.0 %, and the zero-parent-linkage
      result over 632 observations. Anything on that list is out of scope here.
      verify: the evidence file cites all three findings with their recorded
      counts, and `grep -c 'subagent-lifecycle-drain-close' ` over this
      roadmap's evidence file returns at least 1.

- [ ] **Step 2:** Pin the host version before any capture, and record it as a
      literal string. A payload observation without a version pin cannot be
      re-checked after the host updates, and every conclusion this roadmap draws
      about delivery is conditional on that version.
      verify: the evidence file records the exact host version string and the
      date of the capture session; the pin is a literal value, not a range.

- [ ] **Step 3:** Capture the inbound spawn payload under the containment
      protocol. This is the maintainer errand named in the blocker below. What
      the roadmap needs is the FIELD AND SECTION INVENTORY of what a
      Task-spawned subagent receives — which rule files, whether the skills
      catalog arrives, whether the CLAUDE.md hierarchy arrives, and at what
      size — never the content of any field.
      verify: the recorded inventory names each delivered section and its byte
      size, and the capture directory is empty afterwards.

- [ ] **Step 4:** Compute the trimmable fraction from the captured inventory,
      not from the projected tree. The projection is what the package emits; the
      inventory is what the spawn receives. Where the two disagree, the
      inventory wins and the disagreement is recorded as a finding.
      verify: the trimmable fraction is stated with its numerator and
      denominator both taken from the Step 3 inventory, and any projection /
      inventory disagreement is written down rather than reconciled silently.

- [ ] **Step 5:** Stop here if the inventory says the payload is already small.
      A saving that is not there is not a saving, and the honest outcome of
      Phase 0 may be that the rest of this roadmap should not be built.
      verify: the evidence file carries an explicit continue-or-stop line naming
      which branch was taken and the number it was taken on.

## Phase 1 — The per-role manifest, composing the three existing axes

Design and generation only. No default changes, no flip, nothing armed. The
settings family this composes is marked do-not-set-from-automation, and that
marking is read as absolute.

- [ ] **Step 1:** Define the manifest shape as a contract before generating one.
      Per role: which `discipline_profile` value, which `rule_workspaces` ids,
      which `rule_packs` ids, and — mandatorily — the evidence reference that
      justifies the trim. A role with no evidence reference is unscoped by
      construction; the field is not optional and has no default.
      verify: the contract file exists, and a manifest entry lacking the
      evidence reference fails its schema check.

- [ ] **Step 2:** Enumerate the roles from the subagent sources already in the
      tree, not from an invented taxonomy. The generator at
      `src/scripts/condense.ts:1940` walks a source directory; the role list is
      whatever that directory holds.
      verify: the manifest's role list matches the generated
      `.claude/agents/` file stems one-for-one, with no extra and no missing
      entry.

- [ ] **Step 3:** Generate the manifest with every role UNSCOPED. The shipped
      state after Phase 1 is a manifest that changes nothing — same payload,
      same behaviour — so that Phase 2's A/B measures the scoping and not the
      manifest's arrival.
      verify: applying the generated manifest produces no change in the emitted
      subagent payloads; a byte comparison of the emitted files before and after
      is identical.

- [ ] **Step 4:** Compose the three axes; do not add a fourth. If a role's
      desired scope is inexpressible as a combination of `discipline_profile`,
      `rule_workspaces` and `rule_packs`, that is a finding to record, not a
      licence to introduce a new key.
      verify: the manifest schema admits exactly those three axis fields plus
      the evidence reference; a schema check rejects any additional axis key.

- [ ] **Step 5:** Keep the flip human-gated in the manifest itself. The manifest
      records what a scoped role WOULD be; arming it is a separate, recorded
      act. The template's absolute marking on this settings family is the
      reason, and it is cited in the contract rather than paraphrased.
      verify: `grep -n 'do not set this from automation' src/config/agent-settings.template.yml`
      resolves, and the manifest contract cites that line.

## Phase 2 — Pre-registered A/B as the only gate that arms a role

- [ ] **Step 1:** Pre-register the A/B before any pair runs. Task corpus, the
      two arms (role scoped / role unscoped, everything else identical), pair
      count, the quality observable, and the pass bar — both the token saving
      required AND the maximum quality regression tolerated. Two bars, not one:
      a token saving bought with a quality loss is not a saving.
      verify: the pre-registration file is committed and its commit is strictly
      earlier than the first run artefact.

- [ ] **Step 2:** Anchor the quality bar on the in-tree discipline-lift result,
      not on a fresh opinion. `src/config/agent-settings.template.yml:117-119`
      records `+0.458, p=0.0135` for `essential` — that is the measured cost of
      trimming in this package, and a scoping proposal that ignores it is
      arguing against published evidence with none of its own.
      verify: the pre-registration cites the recorded lift figures and states
      how its own bar relates to them.

- [ ] **Step 3:** Run the pairs and publish, whichever way it goes.
      `docs/benchmark.md` already carries a documented honesty-label vocabulary
      (`docs/benchmark.md:15`, `## Honesty labels (read first)`) and multiple
      published nulls, so the honest outcome has a shipped precedent and needs
      no new argument here.
      verify: a new benchmark section exists under one of the existing honesty
      labels, with the pair count, the host, and the single-host limitation
      stated in-band.

- [ ] **Step 4:** Honour the honest null — non-negotiable. If the A/B does not
      clear its pre-registered bar, the role stays UNSCOPED and the null is
      published as the finding. The bar is not lowered, the corpus is not
      extended to reach it, and no pair is excluded after the fact.
      verify: the published section reports the pair count equal to the
      pre-registered one; where the bar was missed, the role's manifest entry
      remains unscoped and cites the null.

- [ ] **Step 5:** Arm at most one role on a cleared bar, and leave every other
      role unscoped. One production role with a real number is worth more than
      six with an argument, and it bounds the blast radius of a wrong call to a
      single role.
      verify: the manifest reports exactly one scoped role, whose entry cites
      the published benchmark section; every other entry is unscoped.

- [ ] **Step 6:** Record the reversal path in the same commit that arms the
      role. Unscoping is a manifest edit and a regeneration; write down the
      exact steps so a regression is reversible by someone who did not run the
      A/B.
      verify: the reversal steps are recorded and, executed on a scratch
      checkout, return the emitted payload to a byte-identical unscoped state.

## Phase 3 — Transcript token-sink ranking and re-read suppression

Independent of Phases 0-2 in both directions: it needs no capture and arms
nothing. It can land first if Phase 0's blocker stays open.

- [ ] **Step 1:** Build the token-sink ranking over the transcript store. The
      machinery exists — `scanTranscripts` (`src/scripts/_lib/cc_transcript.ts:260`),
      `aggregateByBucket` (line 317) and `billableInputTokens` (line 124) — and
      `computeColdStarts` (`src/scripts/cache_realization_report.ts:145`)
      already filters `r.bucket === 'subagent'`. The delta is a ranking over
      what those already return.
      verify: the ranking runs against the local transcript store and reports a
      per-sink ordering with the record count it was computed over.

- [ ] **Step 2:** Report the ranking with its denominator visible. A sink's
      share is only meaningful against the total it was measured from, and the
      store is one machine's history — the report says so rather than reading as
      a property of the package.
      verify: the report states the record count, the date range, and that the
      figures are local-store-derived.

- [ ] **Step 3:** Measure re-reads before suppressing any. Identify files read
      more than once within a session leg and rank them by wasted tokens. A
      suppression built without this measurement is suppressing whatever the
      author happened to notice.
      verify: the measurement reports the re-read count and wasted-token total
      per file over the local store.

- [ ] **Step 4:** Extend the hot-context surface rather than adding a second
      one. `src/scripts/hot_context_hook.ts` already owns the survives-a-boundary
      artefact, with a 400-word hard cap and a privacy floor that DROPS rather
      than rewrites violating lines. Any re-read suppression rides that
      contract; note the path, because `src/scripts/hooks/` does not hold this
      file and an edit written against that path changes nothing.
      verify: the change is in `src/scripts/hot_context_hook.ts`, the 400-word
      cap still holds, and the privacy floor still drops rather than rewrites.

- [ ] **Step 5:** Keep suppression advisory in this roadmap. Emitting a "you
      already read this" note is cheap and reversible; refusing a read is
      neither, and the two must not arrive in one change.
      verify: the suppression path has no refuse branch — no code path returns a
      deny decision on a re-read condition.

## Blockers

### blocker: b-maintainer-run-capture

- **Status:** open
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

### blocker: b-lifecycle-integrity-open-steps

- **Status:** open
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

- [ ] AC-1 — The delivery question is answered with a version-pinned section
      inventory recorded in this roadmap's evidence file, or Phase 0 Steps 3-4
      are cancelled with the decline recorded.
- [ ] AC-2 — The three consumed findings are cited by their recorded counts, and
      this roadmap contains no edit to the parent roadmap.
- [ ] AC-3 — A per-role manifest exists whose schema admits exactly the three
      existing axes plus a mandatory evidence reference, and whose generated
      unscoped state produces byte-identical subagent payloads.
- [ ] AC-4 — A pre-registration naming corpus, arms, pair count and two bars is
      committed strictly before the first run artefact.
- [ ] AC-5 — At least one role is scoped in production, its manifest entry cites
      a published benchmark section, and that section states pair count, host
      and the single-host limitation; every role without a cleared bar is
      unscoped.
- [ ] AC-6 — When the A/B misses its bar, the null is published under an
      existing honesty label and the role remains unscoped.
- [ ] AC-7 — A token-sink ranking and a re-read measurement are published with
      their record count and date range, and any suppression rides
      `src/scripts/hot_context_hook.ts` with its 400-word cap and drop-not-rewrite
      privacy floor intact, and has no refuse branch.
