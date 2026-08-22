---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to review independence

> **Source:** `agents/tmp.old/better-review` — an external analysis dropped into
> the inbox on 2026-08-22, re-verified claim-by-claim against this worktree
> before anything below was written. Where the source's `file:line` had drifted,
> the current line is written here and the drift is noted inline. Where the
> source proposed something the tree already ships, the item was **deleted**
> rather than carried — those deletions are listed under *What this roadmap
> deliberately does not build*, so a later reader does not re-propose them.

## Goal

A review of this package's own work carries an **independence property that a
reader can check**, and the two places where the tree currently *claims* more
independence than it delivers stop claiming it. Concretely, when this is
finished: the default `/review:changes` path runs through the fresh-context
reviewer dispatcher that already exists rather than through a same-session
self-read; a review of record records who reviewed it and how that reviewer
relates to the author; and `evaluator-independence` describes the enforcement
it actually has — no more, and no less.

The constraint that makes this affordable is stated up front and is an
acceptance criterion: **0 new skills, 0 new rules, 0 new spawn shapes.** Every
phase below extends something that already exists.

## Context — what already ships, and why most of the source was cut

The source read the tree as having no independent-reviewer mechanism. That is
wrong, and building against it would have produced a second dispatcher beside
the one already in `src/scripts/`. Re-verified:

- **A fresh-context, scope-bound, prompt-recorded reviewer already ships.**
  `src/scripts/dispatch_r2_reviewer.ts` builds the prompt at
  `:701` (`reviewerPrompt`), and that prompt tells the reviewer verbatim
  *"You are a FRESH reviewer subagent. You have no implementation context and
  you must not acquire any"* (`:732-733`).
- **Its scope is derived, never chosen by the party under review.**
  `computeReviewScope` (`:309-318`) resolves the review scope in one git call
  for both the dispatcher and the validator, over a fixed exclude list
  (`REVIEW_SCOPE_EXCLUDES`, `:113-116`). There is no per-file selector.
- **The prompt is persisted verbatim and bound to the verdict.** The dispatcher
  writes it to `<slug>.review-input/prompt.md` (`:1221`) and stamps a
  `prompt_hash` into the findings marker (`:832`);
  `src/scripts/check_review_prompt_binding.ts` is an enforced gate over that
  pair, reading the prompt file at `:208`.

So the independence *mechanism* exists. What is missing is **routing** (the
default review path does not use it), **recording** (a review of record says
nothing about how the reviewer relates to the author), and **honesty** (one
always-loaded rule mis-states its own enforcement in both directions).

### What this roadmap deliberately does not build

| Source proposal | Why it is cut |
|---|---|
| A second fresh-reviewer spawn shape | `dispatch_r2_reviewer.ts` already is one — see Context. Building a sibling would create two definitions of "what a review is bound to". |
| Blinding the council chairman | **Already shipped and pinned.** `blind_chairman: true` is the default (`src/scripts/council_cli.ts:3561`), the opt-out is `--no-blind-chairman` (`:3630`), the contract records the adoption basis and the mandatory de-anonymization map (`docs/contracts/ai-council-config.md:813`), and reverting the default fails `tests/scripts/ai_council_blind_review.test.ts:286-288`. |
| A new `review-independence` rule | The obligation belongs on the rule that already owns it (`src/rules/evaluator-independence.md`, 144 lines, well under the 200-line cap). |

### Coordination constraint — `judge-synthesis` is not this roadmap's file

Phase 2 below wants to record a **consensus-confidence** signal, and the
natural home for it is `src/skills/judge-synthesis/SKILL.md`. That file is
**owned by `road-to-spec-axis-in-review`**, whose own work rewrites the same
sections (`:46` and `:54`, where the three verdict vocabularies are fused onto
one ordered severity axis, and `:138`, the overall recommendation). This
roadmap **references** that file and must not edit it. If both roadmaps are
live at once, the consensus-confidence item waits for the sibling to land, or
is handed to it. This is written down because two roadmaps silently editing
one 222-line skill is how a merge conflict becomes a lost obligation.

## Phase 0 — stop mis-stating the enforcement that exists

Two defects in one always-loaded rule, in **opposite** directions. This is
precisely the failure `evaluator-independence` exists to prevent, which is why
it goes first and why it is cheap: the rule is prose, it is not a kernel rule
(the nine are listed in `src/scripts/hooks/block_kernel_rule_writes.ts:10-12`
and this is not among them), and it sits at 144 lines.

- [ ] **0.1 Correct the over-claim.** `src/rules/evaluator-independence.md:88-92`
      says the concern *"**blocks** a dispatch whose prompt carries a pre-loaded
      verdict, and **blocks** a second self-scoped evaluation dispatch in the
      same turn; it **warns** on the first"*, and concludes *"items 1 and 4
      above are mechanically enforced"*. The code does not do that. In
      `src/scripts/hooks/evidence_independence.ts` only the pre-loaded-verdict
      branch returns `EXIT_BLOCK` (`:253`); the second-evaluation branch returns
      `EXIT_ALLOW` with `decision: "warn"` (`:301-317`), and so does the first
      (`:319-324`) — with an inline comment at `:296-300` explaining that exit 2
      would read as a hard deny on this host's contract, which is a defect it
      already suffered once. Rewrite the paragraph to say: item 1 blocks; item 4
      warns and does not block.
      verify: `grep -c 'blocks a second' src/rules/evaluator-independence.md`
      returns `0`, and the rewritten paragraph names `EXIT_ALLOW`.
- [ ] **0.2 Correct the under-claim.** The same rule at `:127-129` says
      *"Items 2 and 3 … are **not** enforced by anything"*. Item 3 — recording
      the prompt with the verdict — **has** been enforced since
      `check_review_prompt_binding.ts` shipped. Narrow the sentence to item 2
      only, and cite the gate for item 3, including the gate's own stated limit
      (its header records that omitting the package drops the round out of the
      checkable set with no signal).
      verify: `grep -n 'check_review_prompt_binding' src/rules/evaluator-independence.md`
      returns at least one hit, and `grep -c 'Items 2 and 3' src/rules/evaluator-independence.md`
      returns `0`.
- [ ] **0.3 Note the manifest's third reading.** `src/scripts/hook_manifest.yaml:380-385`
      declares `severity: blocking` for `evidence-independence`, which is true
      of the item-1 path and false of the item-4 path. Add one sentence to the
      rule's enforcement section stating that the manifest severity describes
      the concern, not every branch inside it.
      verify: the sentence exists, and `sed -n '380,385p' src/scripts/hook_manifest.yaml`
      still shows `severity: blocking` (this step changes prose, not the manifest).
- [ ] **0.4 Widen the spawn-payload gate to the shipped templates.**
      `src/scripts/lint_spawn_payload.ts` makes the *"NEVER BULK-DUMP CONTEXT
      INTO A SUBAGENT"* Iron Law deterministic, but its header (`:7-11`) scans
      exactly two surfaces: `tests/fixtures/**/*spawn*.json` and
      `tests/reasoning-layer-eval/golden-transcripts/*.md`. The **shipped**
      prompt templates are outside it. There are 8 diff-payload placeholder
      sites across 5 files under `src/skills/subagent-orchestration/prompts/`:
      `do-in-steps.md:43` (`{{prior_diffs}}`) and `:69`, `judge-with-debate.md:44`
      and `:70`, `adversarial-verification-council.md:56`,
      `do-and-judge-two-stage.md:70` and `:102`, `do-and-judge.md:69` — plus two
      further placeholder shapes in two more files in the same directory
      (`do-competitively.md:68` `{{diffs_array}}`, `do-in-parallel.md:70`
      `{{merged_diff}}`). Add the templates directory to the scan surface,
      reusing the file-binding shape at `check_review_prompt_binding.ts:208`.
      Keep the gate warn-only, exactly as its header specifies.
      verify: `./scripts-run src/scripts/lint_spawn_payload --quiet` reports a
      scanned count strictly greater than the count recorded in the step's
      own note before the change landed, and exits `0`.

## Phase 1 — route the default review path into the dispatcher that exists

The default is a same-session self-read. `src/domains/engineering-base/review/changes/command.md:12`
describes itself as *"Self-review local changes before creating a PR"*, `:86`
makes sequential in-session dispatch the default, and `:89-95` reaches parallel
subagents only when `subagents.max_parallel` is `≥ 5`. So on the common path,
the party that wrote the diff also reads it, with the whole implementation
context in scope.

- [ ] **1.1 Add a fresh-reviewer route to `/review:changes`.** Not a new
      mechanism — a call into `dispatch_r2_reviewer.ts` with the scope it
      already derives. The five in-session judges stay; the fresh reviewer is a
      sixth input whose distinguishing property is that it has no
      implementation context.
      verify: `grep -n 'dispatch_r2_reviewer' src/domains/engineering-base/review/changes/command.md`
      returns at least one hit; `git show HEAD:src/domains/engineering-base/review/changes/command.md | grep -c dispatch_r2_reviewer`
      returns `0` (the pre-state assertion).
- [ ] **1.2 State when the route is taken and when it is not.** A fresh
      reviewer costs a dispatch. Name the condition in the command body rather
      than leaving it to judgement, and name what happens when dispatch is
      unavailable — the honest degraded answer, not a silent fallback to
      self-review presented as a review.
      verify: the command body contains both the condition and the
      unavailable-path sentence; `./scripts-run src/scripts/check_references`
      exits `0`.
- [ ] **1.3 Do not let the implementer envelope reach the fresh reviewer.**
      The existing judge prompts hand it over deliberately —
      `src/skills/subagent-orchestration/prompts/do-and-judge.md:70` is
      `IMPLEMENTER ENVELOPE: {{envelope}}`, and the two-stage spec judge does
      the same at `do-and-judge-two-stage.md:72`. That is correct for a judge
      that is validating a claim. It is wrong for a reviewer whose whole value
      is not having the author's framing. State the asymmetry in
      `prompts/README.md` so the next prompt author does not copy the envelope
      line into a fresh-reviewer template.
      verify: `grep -n -i 'envelope' src/skills/subagent-orchestration/prompts/README.md`
      returns the new paragraph, and the fresh-reviewer route contains no
      `{{envelope}}` placeholder.

## Phase 2 — record how the reviewer relates to the author

`src/scripts/_lib/review_independence.ts:27` types `ReviewIndependence` as
`'cross-family' | 'same-family' | 'single-member' | 'unknown'` — a **model
family** axis only. There is no author-relation axis: `context_relation`
returns zero hits across `src/` and `tests/`. And the type has exactly one
producer today: `src/scripts/self_review_gate.ts:471` hardcodes
`independenceFields(['anthropic'])`, so `./scripts-run src/scripts/check_review_schema`
reports `scanned: 1`.

Model family and author relation are different questions. A cross-family pair
that both read the implementer's envelope is not independent in the sense that
matters here.

- [ ] **2.1 Add an author-relation axis to the existing type.** Extend
      `ReviewIndependence` (or add a sibling field on the same record) to
      record whether the reviewer shared the author's session and context.
      Preserve the file's own design rule, stated in its header at `:10-13`:
      the derived field follows from the recorded one, so an inconsistent pair
      is unrepresentable rather than merely forbidden.
      verify: `npx tsx --test tests/scripts/review_independence*.test.ts` passes,
      and a fixture asserting a same-session cross-family reviewer does **not**
      derive `accepted` is present and was seen red before the change landed.
- [ ] **2.2 Give the type a second producer.** One producer is why
      `check_review_schema` reports `scanned: 1`. Make the finding verifier emit
      the same record, so the schema gate has more than one thing to check.
      verify: `./scripts-run src/scripts/check_review_schema` reports
      `scanned: 2` or more and exits `0`.
- [ ] **2.3 Consensus confidence — REFERENCE ONLY, do not edit the file.**
      The natural home is `src/skills/judge-synthesis/SKILL.md`, which
      `road-to-spec-axis-in-review` owns. Record here what the field should
      carry and leave the edit to that roadmap, or hand this item to it.
      verify: this roadmap's diff touches no path under
      `src/skills/judge-synthesis/` — `git diff --name-only origin/main...HEAD -- src/skills/judge-synthesis/`
      is empty.

## Phase 3 — rotation, gated on the spike

`src/skills/code-review/SKILL.md:107-110` specifies an ordering-bias control:
*"when N reviewers/lenses get the same file set … give each an independently
shuffled file order (deterministic seed per session, logged for replay)"*. It
is **prose only** — no consumer in `src/scripts/` implements a reviewer file
shuffle (the `shuffle` hits there belong to council blind-review and to the
trigger evaluator, which are different mechanisms). There is no rotation state
and no streak state anywhere in the tree.

- [ ] **3.1 Run the pre-registered independence spike BEFORE building rotation.**
      Register the threshold and the honest-null exit in writing before the
      measurement runs. The question: does rotating or shuffling reviewer order
      change the finding set on a frozen corpus of past reviews, by more than
      the pre-registered margin?
      verify: a pre-registration note exists under `agents/evidence/` with a
      threshold and a date **earlier than** the measurement artefact's date.
- [ ] **3.2 If the spike passes, implement the shuffle its own prose specifies.**
      Deterministic seed per session, logged for replay, single-reviewer → no
      shuffle. Not a new mechanism — `src/scripts/ai_council/blind_review.ts:42`
      already exports `deterministic_shuffle_indices`.
      verify: the same seed produces the same order across two runs, asserted by
      a test; `grep -n 'deterministic_shuffle_indices' src/` shows the reuse.
- [ ] **3.3 If the spike returns a null, say so and stop.** Write the null into
      `src/skills/code-review/SKILL.md` beside the prose, so the next reader
      knows the control was measured and not merely unimplemented.
      verify: the null is recorded at the prose it qualifies, with the artefact
      path; Phase 3.2 stays `[-]`.

## Phase 4 — the orchestrator's own pre-judging

An orchestrator that already believes the diff is fine can pre-judge in the
prompt it writes — *"this looks right, do not flag anything but real defects"* —
and the judge returns the answer it was handed. Nothing in the tree addresses
this: a grep for `do not flag|at most minor|pre-judg|prejudg` across
`src/skills/subagent-orchestration/` and `src/agent-src/contexts/execution/`
returns **0**.

- [ ] **4.1 One paragraph on the rule that already owns it.** A stop-rule on
      `src/rules/evaluator-independence.md`: the orchestrator states no
      expectation of the outcome in a prompt it writes for a judge of its own
      work. The rule's existing Iron Law already forbids authoring the verdict;
      this names the softer form that evades it.
      verify: the paragraph exists and the rule is still `≤ 200` lines —
      `wc -l < src/rules/evaluator-independence.md` prints a number under `200`.
- [ ] **4.2 A `not_contains` check over captured judge prompts.** The prompts
      are already persisted (`dispatch_r2_reviewer.ts:1221`), so the check reads
      an artefact that exists rather than requiring a new capture path. Warn
      only. State in the gate header what it cannot see — a paraphrase — exactly
      as `evidence_independence.ts` states its own phrase-list limit.
      verify: the check flags a fixture prompt carrying a pre-loaded expectation
      and stays silent on a neutral one; both fixtures are committed.

## Blockers

### blocker: sibling-ownership

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 in full; Phase 2.3
- **What to do:** pick exactly one — (a) this roadmap owns the shared rotation
  and streak state, and the sibling roadmap that also wants it defers to this
  one, or (b) the rotation half of Phase 3 is dropped from this roadmap
  entirely and only the spike (3.1) and the honest-null record (3.3) remain.
- **Resolved when:** the choice is written into this file at Phase 3 with a
  one-line rationale, and the losing option is struck through rather than
  deleted.
- **Recommendation:** (a). The rotation state has exactly one plausible home
  and this roadmap is the one that measures whether rotation does anything at
  all — a roadmap that owns the state without owning the spike would be
  building against an unmeasured control.
- **If you do nothing:** Phase 3 stays authored and unstartable. Two roadmaps
  each assume the other owns the state, the spike never runs, and the shuffle
  prose at `code-review/SKILL.md:107-110` stays a specified control with no
  consumer — which is exactly the state it is in today.

### blocker: second-ci-provider-key

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2.2
- **What to do:** pick exactly one — (a) provision a second provider credential
  so `self_review_gate.ts` can emit something other than
  `independenceFields(['anthropic'])` at `:471`, or (b) accept that the gate
  stays single-member and scope Phase 2.2 to a second producer that does not
  need a second key.
- **Resolved when:** the decision is recorded at Phase 2.2 and
  `./scripts-run src/scripts/check_review_schema` reports the resulting scanned
  count, whatever it is.
- **Recommendation:** (b). A second producer that needs no second key is
  reachable now; a credential decision is a cost the maintainer may not want
  to pay for a schema gate, and `check_review_schema` gains its second row
  either way.
- **If you do nothing:** `check_review_schema` keeps reporting `scanned: 1`,
  so the gate cannot distinguish a conforming corpus from a corpus of one, and
  the single-member state stays a side effect nobody chose rather than a
  recorded decision.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fresh-reviewer route becomes a second dispatcher | implementation | Phase 1 is a routing change. Implemented as "write a reviewer spawn", it duplicates `dispatch_r2_reviewer.ts` and creates two definitions of review scope, which is the failure `computeReviewScope` was extracted to prevent. | Phase 1.1's verify asserts the call into the existing dispatcher by name; the Context table records the cut explicitly. | Phase 1 — route the default review path into the dispatcher that exists |
| 2 | Two roadmaps edit `judge-synthesis/SKILL.md` and one obligation is lost in the merge | implementation | The consensus-confidence item and the sibling roadmap's severity-axis item touch the same three anchors in a 222-line file. | Phase 2.3 is reference-only and its verify asserts an empty diff over that path; the coordination constraint is stated in Context. | Phase 2 — record how the reviewer relates to the author |
| 3 | The spike is skipped and rotation ships on intuition | implementation | Rotation is the most build-shaped item here and the least evidenced — the existing shuffle prose has never had a consumer, so nobody knows whether the control does anything. | Phase 3.1 gates 3.2 and 3.3; its verify requires the pre-registration to predate the measurement, which a retrofit cannot satisfy. | Phase 3 — rotation, gated on the spike |
| 4 | Correcting the rule's enforcement text makes the rule read as weaker and the obligation is dropped | product | Phase 0.1 removes a "blocks" claim. A reader may take "warns only" as permission to ignore item 4. | 0.1's rewrite keeps the obligation and changes only the enforcement description; Phase 4.1 adds the stop-rule on the same page, so the section gains an obligation as it loses a claim. | Phase 0 — stop mis-stating the enforcement that exists |
| 5 | Widening the spawn-payload gate reds a ratchet on unrelated work | implementation | `lint_spawn_payload` currently scans two test surfaces; adding a shipped-template surface changes its scanned count and may surface pre-existing findings in templates nobody intended to touch. | The gate stays warn-only per its own header; 0.4's verify asserts exit `0` and a strictly larger scanned count, not a zero-finding count. | Phase 0 — stop mis-stating the enforcement that exists |

## Acceptance Criteria

- [ ] AC-1 — `src/rules/evaluator-independence.md` describes its enforcement
      accurately in both directions: no claim that item 4 blocks, and no claim
      that item 3 is unenforced. Checkable by reading the two paragraphs against
      `evidence_independence.ts` and `check_review_prompt_binding.ts`.
- [ ] AC-2 — the default `/review:changes` path reaches a reviewer that has no
      implementation context, and the command body says what happens when that
      dispatch is unavailable. A self-read presented as a review is no longer a
      silent outcome.
- [ ] AC-3 — a review of record carries an author-relation property, and
      `check_review_schema` has more than one producer to check, or the
      single-producer state is recorded as a decision rather than left as a
      side effect.
- [ ] AC-4 — rotation either ships with a pre-registered measurement behind it,
      or is recorded as a measured null beside the prose that specified it.
      Neither outcome leaves the prose silently unimplemented.
- [ ] AC-5 — the diff adds **0 new skills and 0 new rules**. Verifiable as
      `git diff --name-only --diff-filter=A origin/main...HEAD -- src/skills/ src/rules/`
      being empty.
- [ ] AC-6 — no path under `src/skills/judge-synthesis/` is modified by this
      roadmap, so the sibling roadmap's ownership of that file is intact and no
      obligation is lost to a merge.
