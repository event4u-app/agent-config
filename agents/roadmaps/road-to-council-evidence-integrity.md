---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---

# Road to council evidence integrity — attribution, parse outcomes, and the silent nulls between them

> **Source:** `agents/tmp.old/claude-lying.txt` and `agents/tmp.old/turbovec.txt`
> — two independent external analysis passes, drained 2026-08-22. They arrived
> separately and land here as one roadmap because they converge on one surface:
> `src/scripts/ai_council/`. Every `file:line` below was re-verified against the
> worktree on the drain date; two drifted from the source analyses and are
> written at their current lines with the drift noted.

## Goal

When this is finished, a council artefact cannot say something the run did not
establish. A peer-review quote is attributable to the member who wrote it; a
member who answered unparseably is reported as unparsed rather than as
"0 findings"; whether the seats agreed leaves a line in the event log instead of
only in rendered prose; one certainty vocabulary describes evidence quality
instead of four; and every CLI member is spawned under the same agency bound,
proven by a probe rather than by a flag being present in an argv array.

## Context

The five defects below share a shape and that is why they travel together: each
one makes the council's output **look more settled than the run was**. Two are
confirmed silent-null defects (Phases 1 and 2), one is an instrumentation gap
(Phase 3), one is a vocabulary split (Phase 4), and one is an enforcement
asymmetry (Phase 5). None of them errors. All of them are invisible from the
artefact a reader gets.

**The defect read as a feature, and the comment is why.** `orchestrator.ts:1540-1544`
states the label map is "the deterministic A/B mapping" — true of the *ordering*
of `by_source`, false of the *self-filter offset*, and the same block concedes
"Each member sees a different N-1 subset (self filtered)" two lines above the
claim it undercuts. A reader who trusted the comment had no reason to look
further. Correcting that comment is part of Phase 1, not a courtesy.

**Dropped from the source analyses, and why.** One pass proposed a
"unique-insight slot" in every decision lens, on the observation that only the
analysis lens carries `### Outliers` (`prompts.ts:316-319`, the sole hit for
that heading in the file). The observation is correct — `default`, `pr` and
`design`/`optimize` synthesis shapes have no slot for a lone finding, and
`prompt` / `roadmap` / `diff` / `files` all collapse into `default`
(`prompts.ts:358-361`). It is dropped anyway: it is purely additive, no
confirmed defect is attached to it, and adding a section to four prompt
templates on an aesthetic argument is exactly the change that costs paid runs to
evaluate and cannot be falsified from the tree. It belongs in a lens-design
roadmap with its own evidence, not smuggled in behind five real defects.

## Phase 1 — Per-reviewer attribution replaces the last-wins map

- [ ] **1.1 Land the red test first.** Add a `run_peer_review` case with three
      members asserting that each reviewer's `Response-A` maps to a *different*
      source, then run it against unmodified `orchestrator.ts` and record the
      failure text in the step's commit body. `tests/scripts/ai_council/orchestrator.test.ts:864`
      currently asserts only `expect(r.label_to_source.size).toBeGreaterThan(0)`,
      inside `it('each reviewer critiques others (self filtered)')` at `:853` —
      a size assertion cannot see a collision, which is why the defect survived.
      verify: `npx vitest run tests/scripts/ai_council/orchestrator.test.ts -t 'self filtered'`
      fails on the NEW case before 1.2 lands, and the failure names the label,
      not the size.
- [ ] **1.2 Key the map by reviewer.** `orchestrator.ts:1545` declares
      `let last_label_to_source = new Map<string, string>()` outside the
      `for (const reviewer of members)` loop at `:1547`, overwrites it
      unconditionally at `:1567`, and returns it once at `:1584`. Because
      `consensus.ts:437` restarts `let idx = 0` on every `anonymize_responses`
      call over the self-filtered `others_pairs` built at `:1552-1557`, each
      reviewer receives a different `Response-A`. Replace the single map with a
      per-reviewer structure, keeping the flat map as a derived compatibility
      view only if a consumer needs it.
      verify: the 1.1 test is green, and
      `grep -n 'last_label_to_source' src/scripts/ai_council/orchestrator.ts`
      returns no assignment inside the member loop.
- [ ] **1.3 Correct the determinism comment.** Rewrite `orchestrator.ts:1540-1544`
      so it states what is actually deterministic (the ordering of `by_source`)
      and what is not (the label→source mapping across reviewers), and names the
      new structure.
      verify: `git show HEAD:src/scripts/ai_council/orchestrator.ts | sed -n '1540,1544p'`
      shows the old claim; the working copy shows the corrected one, and neither
      contains the phrase "the deterministic A/B mapping" applied to the map.

## Phase 2 — A parse failure is reported as a parse failure

- [ ] **2.1 Land the red test first.** Feed `parse_findings_response` a
      non-empty, non-JSON member answer and assert the caller records a
      `parse_failed` outcome. `consensus.ts:284-285` documents the current
      contract — "extraction is best-effort, never raises" — with three silent
      exits at `:294`, `:301` and `:304`, and `orchestrator.ts:1697` spreads the
      result into `all_findings.push(` with no length branch (the only guard,
      `:1692`, is transport-level). So today the test cannot fail.
      verify: the new case fails against unmodified `consensus.ts`, and the
      failure text names the outcome field, not a count.
- [ ] **2.2 Classify the outcome and re-ask once.** Return a discriminated
      outcome (`parsed` / `empty` / `parse_failed`) alongside the findings, and
      on `parse_failed` issue exactly ONE bounded re-ask with the schema
      restated. One, not a loop: a re-ask is a paid call, and an unbounded
      retry turns one unparseable answer into an open-ended spend.
      verify: a fixture whose first answer is unparseable and whose second is
      valid produces one extra call and a `parsed` outcome; a fixture that is
      unparseable twice produces exactly two calls and a `parse_failed` outcome.
- [ ] **2.3 Correct the attendance wording.** `quorum_wiring.ts:170` counts
      attendance as `!r.error && r.text.trim() !== ''` — bytes, not usable
      content. The block at `:163-169` already argues that "An empty answer
      contributes nothing to a quorum by definition, whatever the transport
      thought of it"; extend that argument to a non-empty answer no parser can
      read, and render such a member as `present-unparsed` rather than folding
      it into `N/N present`.
      verify: a fixture with two members, one unparseable, renders a banner that
      does not read `2/2 present`, and the rendered string contains the
      `present-unparsed` token.
- [ ] **2.4 Ship the fixture corpus and the honest-gap row.** At least six
      recorded verbatim member responses — valid JSON, JSON in a fence, prose
      refusal, truncated array, empty body, JSON with missing required keys —
      committed as fixtures, plus a `parse_empty_rate` row that states what
      fraction of recorded answers reach `parse_failed` and states plainly that
      the denominator is the fixture corpus, not live traffic.
      verify: the fixture directory holds six or more files, the rate row cites
      the fixture count as its denominator, and the row is reproducible from a
      command named in the row itself.

## Phase 3 — Agreement becomes an additive field on `quorum_result`

- [ ] **3.1 Confirm the asymmetry, then close it additively.**
      `events_log.ts:382-448` (`appendQuorumEvent`) records attendance in
      sixteen fields — `threshold` `:400`, `total` `:402`, `present` `:403`,
      `solo` `:408`, `gate_class` `:410`, `verdict` `:396` among them — and
      `stance_tally.ts` records nothing: `grep -c appendEvent` on that file
      returns 0 across its 256 lines, and it has no import from `events_log.js`
      at all. Its result reaches the reader as rendered text only, via
      `orchestrator.ts:1990` and `:1995`. So the log can say who showed up and
      never whether they agreed.
      verify: `grep -c appendEvent src/scripts/ai_council/stance_tally.ts`
      returns 0 before the change, and the phase's own test asserts the new
      field is present on a `quorum_result` line.
- [ ] **3.2 Add the dimension as a FIELD, never a new action.** The file's own
      reasoning at `:411-418` is binding here and is not being re-derived: a new
      action "is invisible to every consumer filtering
      `action === 'quorum_result'`, which would split the attendance population
      in two and silently move the denominator of all four registered metrics.
      An additive boolean moves no existing bucket." Carry the agreement
      dimension on the existing line, bump the schema version, and record in
      `src/config/quorum-attendance-budget.json` that a rate computed over
      older-schema lines must exclude rather than assume the new field.
      verify: a replay over a fixture log containing pre-change lines computes
      the same four registered metrics as before, and the new field's rate
      excludes those lines rather than defaulting them.

## Phase 4 — One certainty vocabulary, or an honest declaration of prose

- [ ] **4.1 Inventory and collapse.** Four vocabularies describe the same
      property today: `prompts.ts:133-135` and `:307`
      (`confirmed | inferred | speculative`), `:319` (`unverified-by-council`),
      `:168` (`CONFIDENCE: high|med|low`, format line at `:167`), and
      `src/skills/ai-council/references/procedure.md:87` (`unverified:`, restated
      at `:95`). Pick one scale, migrate the prompt templates onto it, and state
      in the skill which property each surviving term describes — evidence
      quality is not the same property as a member's certainty in a pick, and
      collapsing those two would be a worse outcome than four vocabularies.
      verify: `grep -nE 'confirmed|inferred|speculative|unverified-by-council' src/scripts/ai_council/prompts.ts`
      returns terms from the chosen scale only, and the skill names the property
      each surviving term measures.
- [ ] **4.2 Give `unverified:` a parser or declare it prose.** A repo-wide grep
      for a reader of that marker finds none: `procedure.md:87` and `:95` are
      prose, and the only other hits are an unrelated object key in
      `check_branch_freshness.ts:300` and an English sentence in
      `src/skills/subagent-orchestration/evals/evals.json:19`. The machinery to
      validate a section exists and is simply not pointed at any certainty
      marker — `prompts.ts:461-495` already enforces `### Kill criteria` and
      `### Concrete next step`. Either point it at the marker and give the
      marker a render consequence, or write in `procedure.md` that it is an
      authoring convention with no reader.
      verify: either a test asserts a council artefact missing the marker is
      rejected, or `procedure.md` carries the no-reader sentence and
      `grep -rn 'unverified:' src/scripts/` still returns no parser.

## Phase 5 — CLI least-agency parity, proven by a canary

- [ ] **5.1 Record the asymmetry as measured.** One CLI member is spawned with
      `--tools ''` (`clients.ts:1724-1725`, in the class at `:1667`) behind a
      26-line justification at `:1698-1723` that argues Least Agency in general
      terms — and the same file constructs four further CLI members with no
      equivalent bound. `grep -nE -- "--sandbox|--approval-mode|read-only" src/scripts/ai_council/clients.ts`
      returns 0. One of the four passes `--skip-git-repo-check`, a guard
      *removal*, with no counterpart. Same role, three enforcement levels.
      verify: the grep above returns 0 at the start of the phase, and the phase
      note records the argv each of the five CLI classes builds.
- [ ] **5.2 Apply one bound per member against a RECORDED CLI version.** For
      each CLI member, determine the vendor's own agency flag and apply it. Pin
      the CLI version the determination was made against in the same note — a
      flag that exists in one release and not the next is a claim with a
      shelf life, and an unpinned one cannot be re-checked.
      verify: each CLI class's argv carries an agency bound, and the note names
      one CLI version string per member, obtained from that CLI's own
      `--version`.
- [ ] **5.3 Prove effect, not presence — a canary.** Flag-present is not
      flag-effective; `clients.ts:1706-1715` concedes the existing flag was
      found by a live context-window overflow rather than by a security pass,
      which is exactly the failure a presence assertion cannot catch. Ship a
      canary that asks each CLI member to perform a bounded, harmless action it
      should be unable to perform, and assert refusal.
      verify: the canary fails when the bound is removed from a member's argv
      and passes when restored — demonstrate both directions in the same run.

## Blockers

### blocker: b-cli-flag-probe

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5 Steps 5.2 and 5.3. Phase 5 Step 5.1 is not blocked — it
  reads the argv arrays out of `clients.ts` and needs nothing external.
- **What to do:** pick exactly one —
  (a) put the four remaining CLI binaries on `PATH` in one session, run each
  one's `--help` and `--version`, and record the agency flag plus the version
  string per member in the Phase 5 note; or
  (b) declare the binaries unavailable in this environment and record an honest
  null for `5.2`/`5.3` naming the members that could not be probed, leaving
  `5.1` closed and the phase open.
  An absent binary is an honest null for that member, never a silent skip: a
  member whose bound was never determined must not be rendered as bounded.
- **Why it is not an agent step:** the flags are properties of external binaries
  whose behaviour cannot be read out of this tree, and installing vendor CLIs
  changes the machine rather than the repository.
- **Recommendation:** (a). The four binaries are already the transport for a
  configured council on any machine that runs one, so putting them on `PATH`
  for one session is an errand rather than a build, and it is the only route
  that lets Phase 5 claim parity instead of claiming intent.
- **If you do nothing:** Step 5.1 still closes — it reads argv out of
  `clients.ts` — and Phase 5 stops there. Four of five CLI members keep an
  unstated agency bound, `AC-5` cannot be met, and the asymmetry stays a
  recorded finding rather than a fixed one.
- **Resolved when:** the Phase 5 note carries, per CLI member, either an agency
  flag with the CLI version string it was read from, or an explicit
  `not-probed: <member> — binary absent` line.

### blocker: b-probe-channel-decision

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5 Step 5.3 — the canary needs a decision about where it runs
  before it can be written.
- **What to do:** pick exactly one —
  (a) run the canary as a local-only script under `src/scripts/ai_council/`,
  invoked deliberately, spending real vendor calls and never wired into a CI
  workflow; or
  (b) run it against recorded transcripts only, which costs nothing and proves
  less — it shows the argv was built correctly, not that the vendor honoured it.
  Option (b) does not satisfy `5.3` on its own and must be recorded as a
  partial if chosen.
- **Why it is not an agent step:** (a) spends money on external calls and (b)
  changes what the acceptance criterion is allowed to claim; both are decisions
  about cost and about the strength of a claim this roadmap makes.
- **Recommendation:** (a), run deliberately and never wired into CI. The
  finding this phase rests on — `clients.ts:1706-1715` — records that the one
  existing bound was discovered by a live failure, so a channel that cannot
  observe live behaviour cannot falsify the next one either.
- **If you do nothing:** Step 5.3 cannot be written at all, because the
  canary's assertion depends on where it runs. Phase 5 then ends at a bound
  that is present in an argv array and unproven in effect, which is exactly
  the claim `AC-5` was phrased to refuse.
- **Resolved when:** the choice is written into Phase 5 Step 5.3 as a named
  channel, and — if (b) — `AC-5` is amended in the same change to claim only
  argv correctness.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A green test that was never red | implementation | Every phase here fixes a defect that produces NO error, so a test written after the fix passes against the broken code too — the exact shape of `orchestrator.test.ts:864`, which asserts `size > 0` over a map whose contents are wrong | Each phase's first step lands the test and records its failure text against unmodified code before the fix; a phase whose test was never observed red is not closed | Context |
| 2 | The bounded re-ask becomes a loop | implementation | A `parse_failed` outcome invites a retry, and a retry that is not hard-bounded turns one unparseable answer into open-ended paid calls on every run | Step 2.2 fixes the bound at exactly one and its verify asserts the call count in both the recovering and the twice-failing fixture | Phase 2 — A parse failure is reported as a parse failure |
| 3 | The agreement field silently moves an existing denominator | implementation | Adding a dimension to `quorum_result` can change what a consumer filtering that action sees, which is the failure `events_log.ts:411-418` already names for a new action and which an additive field only avoids if older lines are excluded rather than defaulted | Step 3.2 bumps the schema version and requires a replay over a fixture log with pre-change lines to reproduce the four registered metrics unchanged | Phase 3 — Agreement becomes an additive field on `quorum_result` |
| 4 | Vocabulary collapse loses a real distinction | product | Evidence quality and a member's certainty in a pick are different properties; folding `CONFIDENCE` into `confirmed / inferred / speculative` would read as tidying and would destroy information the stance line exists to carry | Step 4.1 requires the skill to name the property each surviving term measures, so a collapse that merges two properties cannot pass its own verify | Phase 4 — One certainty vocabulary, or an honest declaration of prose |
| 5 | Parity is claimed from an argv array | implementation | A flag present in a constructed argv proves the flag was passed, not that the vendor CLI honoured it — and the one existing bound was found by a live overflow, not by inspection | Step 5.3 requires a canary that fails with the bound removed and passes with it restored, in the same run; `b-probe-channel-decision` forces the strength of the claim to be chosen explicitly | Phase 5 — CLI least-agency parity, proven by a canary |

## Acceptance Criteria

- [ ] AC-1 — A peer-review quote in a council artefact resolves to the member
      who wrote it, for every reviewer in the run, and a test asserting a
      per-reviewer label mapping was observed failing against the pre-change
      code.
- [ ] AC-2 — An unparseable member answer is distinguishable in the artefact
      from a member that found nothing, and the rendered attendance line does
      not count it toward `N/N present`.
- [ ] AC-3 — Whether the seats agreed is recoverable from
      `agents/runtime/council/events.log` alone, as a field on the existing
      `quorum_result` line, with the four registered metrics reproducing
      unchanged over a fixture log that spans the schema bump.
- [ ] AC-4 — One scale describes evidence quality across `prompts.ts` and the
      ai-council skill, and `unverified:` either has a parser with a render
      consequence or a written statement in `procedure.md` that nothing reads
      it.
- [ ] AC-5 — Every CLI council member is spawned under a stated agency bound
      recorded against a pinned CLI version, and either the canary demonstrated
      both directions or `b-probe-channel-decision` chose option (b) and this
      criterion was amended in the same change to claim argv correctness only.
- [ ] AC-6 — No phase in this roadmap is closed on a test that was green the
      first time it ran; each phase's note carries the recorded failure text
      from its own red run, or states which drift made a red run impossible.
