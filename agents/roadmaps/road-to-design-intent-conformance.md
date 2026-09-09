---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Receiver for a round whose subject has arrived six times and closed on a fixture five of them; the count half is unmoved (`active_roadmaps` 5 at floor 5, `open_blockers` 43 at floor 43 — `status: draft` excludes it from collect()), and only the file-based one-in-one-out half fires. Nothing here is offsettable: the five predecessors are already archived, parking it would grow later_roadmaps instead, and folding it into a live roadmap would put a design-fidelity programme with four owner-reserved blockers inside a roadmap that owns a different axis."
relates:
  - slug: road-to-the-packed-payload-cap
    relation: disjoint
    note: >-
      owns the always-payload axis; Phase 2 adds a projection lane and must
      leave that axis alone — separate concerns, deliberately not folded
---
# Road to design-intent conformance — the contract exists, it is contradicted in one skill and unreachable in every consumer install

> **Source:** `agents/tmp.old/inbox-2026-09-x/` — a transcript carrying two
> owner directives, one external root-cause analysis, and a four-file plan
> revision set, two members authored by a different model. Round intake note
> holds the encrypted origin.

> **Arrivals:** 6 — latest `inbox-2026-09-x` (2026-09-09). Five archived
> predecessors closed on this same ground: `road-to-provided-artifact-honesty`,
> `road-to-source-first-frontend`, `road-to-frontend-fidelity-calibration`,
> `road-to-design-artifact-fidelity`, `road-to-design-system-extraction-contract`.
> What broke is not that they were wrong — `road-to-source-first-frontend` wrote
> its own limit down (*"Not claimed: that the operator's symptom is fixed …
> needs a consumer repo"*) and closed 16 of 18 steps on a fixture with 3
> handlers and 1 keyframe. The disposition was accurate and its reopening
> condition then fired unread: `b-page-capture-primitive` is recorded FIRED
> 2026-08-23 in `agents/roadmaps/archive/road-to-frontend-fidelity-calibration.md`
> and nothing acted on it. This round is the consumer measurement those
> roadmaps said they lacked, and it is red. Counter lives here rather than in
> the round's evidence file so a seventh arrival meets a number instead of a
> fresh argument.

## Goal

A consumer agent that is handed a finished design artifact reads the same
contract this repository already wrote, and nothing shipped tells it to do the
opposite. Concretely: `tailwind-engineer` stops instructing the agent to
replace an artifact's exact value with a nearest token; `brand-source-of-truth`
carries the artifact-versus-brand split instead of pointing one way only; the
inbox guard stops refusing read commands; and the procedure
`design-fidelity` delegates to exists in a consumer install rather than only in
this checkout. What is *not* claimed: that the reported symptom is fixed. That
needs a measurement, and Phase 4 is where it becomes one.

## Context — what the round established, verified at `origin/main@4be5f59`

The round's own diagnosis is that the policy is missing. Four independent
verification passes over this tree found the opposite, and the correction is the
reason this roadmap is shaped the way it is: **the policy is written, and it is
contradicted or unreachable.**

- **The maturity axis already exists, twice.** `src/scripts/_lib/ui_authority.ts:36-42`
  carries `ReferenceMaturity`, and `docs/guidelines/design-fidelity-mechanics.md:157-168`
  carries the low-fidelity-versus-finished table. That table *is* the first
  owner directive ("a wireframe is not a finished design"), already decided.
- **And it is unreachable.** `src/rules/design-fidelity.md:33-34` declares
  `routes_to: guideline:design-fidelity-mechanics`. `dist/agent-src/` carries no
  `guidelines/` directory, and `.augment/guidelines` therefore does not exist —
  although `AUGMENT_SYMLINK_DIRS` in `src/scripts/condense.ts:2461` already
  lists it. The lane is declared and dead. 31 rules share the shape.
- **One shipped skill teaches the failure the rule forbids.**
  `src/skills/tailwind-engineer/SKILL.md:47-52` said: map every requested
  colour to a configured token, "if the design hands you `#3B82F6`, use
  `bg-blue-500`", arbitrary values "are a smell" — with no artifact-bound
  carve-out, against `src/rules/design-fidelity.md:56-66`, which forbids
  swapping colour or spacing. Two verification passes ranked this first
  independently.
- **`brand-source-of-truth` pointed nowhere back.** `design-fidelity.md:47`
  and `:197` reference it; the 146-line brand rule carried zero `fidelity`
  hits, so a brand-first entry path never met the structure obligation.
- **The inbox guard refuses reads.** `src/scripts/hook_manifest.yaml:235-240`
  registers it `severity: blocking` with no `tools:` filter, `_PATH_KEYS`
  covers a read tool's `file_path`, and the command scan offered every
  whitespace token to the same verdict without ever inspecting the verb.
  Reproduced live twice while running this very round: `ls -d agents/tmp/<glob>`
  — the command the naming rule tells an operator to run — was refused.
  A third defect, found by verification rather than by symptom: the
  existence probe anchored its capture at `agents/`, discarding any path
  prefix, so a module-nested round could never hit the already-exists
  carve-out and was refused forever instead of once.
- **`design.*` never cascades from the user-global layer.**
  `MERGEABLE_KEYS` (`src/scripts/_lib/agent_settings.ts:265-296`) lists no
  `design.` key, so `design.fidelity_mode` set user-globally is filtered out.
  The round's diagnosis ("the resolver does not see the layer") is wrong — the
  layer is read and then whitelisted — and the correction matters because it
  changes the fix. A second, independent half: `userGlobalDrop()` probes only
  the flat `agent-settings.yml`, never the canonical
  `settings/.agent-settings.yml` the wizard writes, so the warning that would
  announce the drop cannot fire for exactly these keys.
- **`strict` literally forbids the second owner directive.**
  `design-fidelity.md:119` reads "EVERY visible deviation … requires explicit
  confirmation", and the directive asks for an unprompted approximation within
  tolerance. `grep -cE 'reconcil|tolerance|approximat|nearest'` over the rule
  and its guideline returns 0 / 0.

- **The 1:1 Iron Law ships without its counterweight, and that is why the
  "take it 1:1" reading is the honest description of a default install.**
  `design-fidelity` is `packs: [engineering-base, frontend-design]`;
  `brand-source-of-truth` is `packs: [brand]`; `ui-audit-gate` and
  `icon-consistency` are `[frontend-design]`. Language packs only `suggests:`
  frontend-design, and `suggests` is "advisory, never auto-installed". So a plain
  engineering install receives the fidelity obligation and **not** the rule
  requiring every colour, type and spacing value to trace to a brand token — and
  the arbitration between them sits in the unprojected guideline. Widening pack
  reach is not available: **ADR-245** is `reopen_policy: owner` and states that
  a preference for wider default reach "with no number behind it" is explicitly
  **not** a reopen trigger.
- **And the rule reaches the model on prompt words alone.**
  `src/scripts/project_thin_rules.ts:102-121` records `design-fidelity` as one of
  18 thinned mixed-trigger rules whose path-shaped half has **no carrier at
  all**: "a session that touches a matching file and says nothing that matches
  gets nothing." Restoring the path route costs a measured **+16,329 GPT tokens
  (+69 % of the thin rule layer)** or a raised hook-slot cap — both
  owner-reserved. This is why 1.5 lands the arbitration inside the rule body
  rather than behind another pointer.

Three constraints bound every phase below, all measured on this branch:
`design-fidelity.md` is at **exactly 200 lines** against `skill_linter`'s
`rule_too_large` ceiling, so no sentence lands there without one leaving;
`check_estate_count` reports **0 growth allowance** on active roadmaps, skills
and hook concerns; and `condense.ts` sits at 2712 lines against a 1500 ceiling
under a shrink-only ratchet, so Phase 2 must be net-zero there.

## Council record — three rounds, 2026-09-09

Two claims were raised against this roadmap's position: that a provided design
should be taken **1:1 including its literal values**, and that the best build
order is **Storybook first, then components, then the page**. Both were put to
the AI council over three rounds, each round attacking the plan the previous one
produced. Members `anthropic` + `openai`, **2/2 present and concluded on every
round** (verdict read from the after-run quorum line, not the pre-run presence
check), $0.23 total. Each round's artefact carried an internal blind
cross-review.

**Round 1 → Round 2 → Round 3 changed the answer twice, which is why the loops
were run.** Recorded because a single round would have shipped two wrong things:

| Item | Round 1 | Round 3 (final) |
|---|---|---|
| icons | flip to reconcilable, 2/2 | **delete the clause.** One measured practice cannot reverse a shipped obligation — and the shipped obligation was itself unsourced, so "keep it" was never the conservative option |
| arbitration destination | move it into the projected tier | same direction; **all three rounds proposed a destination that does not work** — two named protected or non-existent lines, the third named a skill file that does not exist. The destination in 1.5 is this repository's own finding |

Standing on the two claims, after three rounds:

- **1:1 dissolves per dimension, and the field made the split first.** Colour,
  spacing, radius and shadow reconcile — unanimous, at error severity, across
  Primer, Polaris and Spectrum S2, with 540 token usages to 0 raw colour
  literals measured across 61 shadcn components. Sizing, position and type
  micro-values are genuinely contested and the 1:1 side is winning there —
  Polaris grades them `warning`, Spectrum **opened** arbitrary px in v0.5.0 with
  a codemod. Structure, controls, layout, breakpoints and behaviour are not a
  value question at all.
- **The field's invariant is "no *silent* literal", not "no literal."** Every
  enforcing system ships an escape hatch and the good ones make it accountable —
  Polaris requires a written reason for each suppression. That is the shape this
  roadmap's report-the-distance duty already has.
- **Snap-to-nearest with a declared tolerance is shipped production behaviour.**
  Primer's spacing plugin widens each token's accepted set by **±1px** and
  autofixes. It is the one real number in the evidence set, and it belongs to
  `blocker: approximation-tolerance` rather than to any step here.
- **No build order is prescribable from the evidence.** No primary source states
  the claimed order; Storybook's own tutorial writes the component before the
  story; Atomic Design's author calls it "not a linear process"; no repository
  inspected gates on story-per-component, and two of the largest component
  ecosystems ship zero stories. Where UI already exists the prescribed first
  move is inventory, not construction. **Measured evidence comparing build
  orders: none** — absent, not weak.
- **Reconciliation's benefit is unmeasured and the case for it is structural.**
  Zero of seven design-to-code benchmarks score token conformance; pixel
  deviation is instrumented by default. Argued as empirical, the case loses.

Three figures the council produced are **not** carried into this roadmap because
no source in the evidence set supports them: a "73-branch" corpus count, "4px /
2px" tolerance values, and a reading of Salesforce's `hasReplacement` as
evidence about icons — that rule governs numeric values, and the icon grading is
Adobe's `react-spectrum` audit.

## Phase 1 — Remove the contradiction and the false positives

Nothing here needs a decision, a new artefact, or a default change. All three
are defects with a verified wrong behaviour and a verified right one.

- [x] **1.1 Teach the inbox guard that reading is not creating.** Three fixes in
      `src/scripts/hooks/block_speaking_inbox_dir.ts`: a read-tool deny-list so a
      `Read`/`Grep`/`Glob` `file_path` is not judged as a write target; a
      per-segment verb allowlist reusing `git_command_classifier`'s segmenter so
      `ls`/`cat`/`grep` are not judged as `mkdir`, with redirect targets still
      judged separately; and an existence probe that carries the path's own
      prefix so a module-nested round resolves. The narrowing is a **glob over
      an acceptable name**, not a classification of the command: two review
      rounds took the verb axis apart from both ends, and the measured defect
      never needed it — a glob cannot be created as written, and the one form
      that could (`mkdir 'inbox-2026-09-*'`) produces a name that is opaque
      anyway. Every writing form is judged by the unchanged token scan.
      verify: `npx vitest run tests/hooks/block_speaking_inbox_dir.test.ts` —
      45 assertions green, including the two commands that were refused in this
      round; and with `isGlobOverAcceptableInboxDir` forced false, exactly the
      two glob allow-cases go red while every block-case stays green.
- [x] **1.2 Give `tailwind-engineer` the artifact-bound branch it never had.**
      Step 1 keeps the greenfield default and gains three obligations: do not
      snap (replacing the artifact's value with a nearest token is the Iron
      Law's deviation); translate a literal **once** into a named project token
      carrying that exact value, not per call site — the first owner
      directive's token duty; and reconcile as a **proposal**, reporting each
      value's distance on a named output line. An artifact-derived exact value
      stops being "a smell" in that mode. What it deliberately does NOT ship
      is the autonomous approximation the directive eventually wants: that
      needs a tolerance to exist, and both the threshold and the default are
      owner decisions (3.2, 3.4). A first draft did ship it, bought with a
      reading of `strict`/`structural` the rule does not carry, and a review
      round caught the pre-emption. Structure, controls, icons, grid and
      breakpoints are named as not this skill's to adjust. A
      second `Gotcha` bullet states the carrier-versus-value split the second
      owner directive asked to be made clearer: static presentation belongs in
      CSS or classes, `style=` is for what only the runtime knows, and porting
      an inline style into classes is expected as long as the resolved value is
      identical.
      verify: `./scripts-run src/scripts/skill_linter --all` warn count
      unchanged at 1, and the file stays under the 400-line skill ceiling.
- [ ] **1.3 Make the brand rule carry the split instead of pointing one way.**
      `src/rules/brand-source-of-truth.md` gains the artifact-versus-brand
      invariant — values to the brand token with the distance reported,
      structure to the artifact and never adjusted to suit a token — plus the
      reciprocal `design-fidelity` see-also. `design-fidelity.md:47` and `:197`
      already point at the brand rule; the brand rule carried zero `fidelity`
      hits, so a brand-first entry path never met the structure obligation.
      **Attempted and reverted in the Phase 1 PR** — see
      `blocker: standing-payload-headroom`. The invariant is written and the
      surface will not take it; it lands once the blocker is decided.
      verify: `grep -c design-fidelity src/rules/brand-source-of-truth.md`
      greater than 0, the rule under the 200-line ceiling, **and**
      `./scripts-run src/scripts/check_preamble_payload_budget` still at or
      under the ratchet.
- [ ] **1.4 Delete the unsourced icon obligation instead of defending it.**
      `src/skills/tailwind-engineer/SKILL.md:86` asserts that icons "stay 1:1
      with the artifact" — a single clause, added in the Phase 1 PR, with **no
      citation of any kind** (`grep -i icon` over that file returns that one
      line). The same sentence declares icons "belong to the rule, not to a
      utility-class decision", so the skill asserts an obligation it
      simultaneously puts outside its own scope. The rule that owns icons,
      `src/rules/icon-consistency.md`, carries **zero** occurrences of
      `artifact` / `artefact` / `provided`, so no surface handles a handed-over
      artifact today. Replace the clause with a scope boundary that defers to
      the owning rule, and record the contrary evidence with its reopening
      condition rather than acting on it (see the council note below).
      verify: `grep -ci icon src/skills/tailwind-engineer/SKILL.md` returns the
      scope-boundary line and no obligation; `skill_linter --all` warn count
      unchanged.
- [ ] **1.5 Swap an unfollowable instruction for the arbitration it points at.**
      `src/rules/design-fidelity.md:78-83` tells the reader *"Read that scope
      line before acting on either rule"* — and that line lives in
      `docs/guidelines/design-fidelity-mechanics.md`, which does not exist in a
      consumer install (`ls dist/agent-src/guidelines` → no such directory). In
      every consumer install the rule therefore issues an instruction nobody can
      follow. Replace those lines with the artifact-versus-brand arbitration
      itself — values reconcile onto the brand token with the distance reported,
      structure stays the artifact's and is never adjusted to suit a token,
      conflicts are surfaced and never merged — keeping the one clause that
      names the `code-provenance` collision boundary, which is real.
      **This is the destination three council rounds asked for and none
      located.** It is the projected rule tier, it reaches every consumer
      including non-Tailwind ones, and it is **net-negative on lines**, which is
      the only way anything lands in a file at 200 of 200.
      verify: the rule stays at or under 200 lines, `check_condensation` passes,
      `check_preamble_payload_budget --ceiling <ci value>` does not rise, and no
      remaining sentence in the projected rule instructs the reader to open an
      unprojected path.
- [ ] **1.6 State that no build order is prescribed, positively.**
      `src/skills/ui-component-architect/SKILL.md` (`packs: [engineering-base]`,
      same reach as the fidelity rule) gains the observed pattern rather than a
      bare negative: when porting existing UI, inventory first — the lifecycle
      excludes Plan by definition — stories concurrent with the component work,
      never a phase gate before or after it, **and an explicit note that this
      describes common practice, not a size-based requirement**. Fix two tree
      defects in the same edit: `:72-78` calls the workshop unconditional "on
      every React lane" while
      `docs/guidelines/component-oriented-and-oop-development.md:87-95` calls it
      size-conditional and "never a generic mandate"; and `:75` cites "the
      state-coverage matrix **below**", which `react-shadcn-ui/SKILL.md:345`
      deliberately keeps React-specific — so a Blade, Vue or Livewire consumer
      is routed nowhere.
      verify: the skill names no required sequence, the contradiction with the
      guideline is gone, and the matrix pointer resolves or is removed.

## Phase 2 — Make the delegated procedure exist where it is read

`design-fidelity` routes its operative detail to a guideline that no consumer
install contains. Until that is true, every later phase writes policy into a
file the reading agent cannot open.

- [ ] **2.1 Project `docs/guidelines/` into `dist/agent-src/guidelines/`.** The
      consumer-side plumbing is already there — `AUGMENT_SYMLINK_DIRS` lists
      `guidelines` and the symlink is simply never created. The lane goes in a
      new module under `src/scripts/_lib/`, and `condense.ts` spends net zero
      lines by extending an existing import and replacing a statement rather
      than adding either.
      verify: after `task sync`, `ls dist/agent-src/guidelines/design-fidelity-mechanics.md`
      resolves and `.augment/guidelines` is a live symlink; and
      `./scripts-run src/scripts/check_source_size_budget` reports no rise.
- [ ] **2.2 Gate the route rather than trusting it.** A check that every
      `routes_to: guideline:` target and every relative `../docs/` link in a
      **projected** rule resolves inside the projection. Today's 31 rules and 43
      distinct targets are the floor; the ratchet then only moves down.
      verify: the gate red on a deliberately unprojected target, green on the
      tree, and registered with its coverage row and self-test.
- [ ] **2.3 Whitelist `design.*` and repair the drop warning.** Add the
      `design.fidelity_mode` key to `MERGEABLE_KEYS` with the ADR its docstring
      requires, and widen `userGlobalDrop()` to probe the canonical
      `settings/.agent-settings.yml` as well as the flat file.
      verify: a user-global `design.fidelity_mode` resolves through
      `agent-config settings:get design.fidelity_mode` and names the layer it
      came from; and a non-whitelisted user-global key reports the drop instead
      of a bare "not set".
- [ ] **2.4 Give the read budget an artifact carve-out.** `token-efficiency.md:99`
      sets a probe-then-slice threshold at 800 lines with no artifact exception,
      and `context-hygiene.md:113` raises the read-only abort only for a
      "mandated analysis/audit/review protocol" — a design *implementation* is
      none of the three. A handed-over artifact is routinely thousands of lines
      across a bundle, so the agent that reads it properly trips the loop
      detector and the agent that does not is the reported failure. Both rules
      are standing surfaces, so this obeys the same payload constraint as 1.3.
      verify: a declared artifact port states its expected read count and does
      not trip the abort; an undeclared read loop still does.
- [ ] **2.5 Route the artifact file shapes the trigger set cannot match.**
      `*design.html` compiles to `^(?:.*design\.html)$` and cannot match
      `ToDo.dc.html`; `.dc.html` appears zero times in the rule and zero times
      in `ROUTING_MATRIX`, so the class is an untested gap rather than a decided
      exclusion. The rule's own contract at `design-fidelity.md:171-192` requires
      the near-miss row **first** — write the row that would catch an
      over-broad trigger before writing the trigger.
      verify: a `.dc.html` handover routes, and the near-miss row for the
      direction the new trigger opens stays silent.
- [ ] **2.6 Wire the artifact-read predicate its own module never calls.**
      `ui_route_nudge_hook.ts:162` exports `isArtifactRead`; `report_consultation_rate.ts:204`
      consumes it and `decide` in the same module does not. The concern is
      default-OFF, so wiring it changes nothing for a consumer and makes the
      shadow record honest.
      verify: an artifact-read event reaches `decide`, and the concern's
      default stays off.
- [ ] **2.7 Add a provided-artifact carve-out to `icon-consistency`.** Its
      "When NOT to fire" lists three exceptions and none is a provided
      artifact, while "ad-hoc inline SVGs alongside a chosen set" is exactly
      what porting an artifact's own icons produces. Iconography rung 1 is
      already a brand token, so the fix is a new rung, not a re-ordering.
      verify: an artifact-sourced inline SVG does not read as a violation, and
      an untraceable one still does.

## Phase 3 — Maturity and approximation as data, not prose

Gated on `blocker: approximation-tolerance` and `blocker: rule-body-cap`.

- [ ] **3.1 Promote the maturity table to a field.** `spec.maturity` on the
      existing `design-system.json` contract, resolved from the artifact with
      provenance, with a user signal beating any inference. The two-row prose
      table becomes the data behind it rather than a second copy.
      verify: a wireframe fixture resolves `low` and a runnable-artifact fixture
      resolves `finished`, both with the signal that decided it.
- [ ] **3.2 Add the approximation semantics as a setting beside `fidelity_mode`.**
      Within tolerance the project token wins and the outcome is reported;
      outside it the artifact value is preserved and the project gap is
      reported; a per-run signal switches it off. `hard-floor` disables it.
      verify: three fixtures — inside tolerance, outside tolerance, switched
      off — produce the three distinct verdicts, and every value row carries a
      distance to the nearest project token even when preserved.
- [ ] **3.3 Gate reuse on conformity, and decide it after the read.**
      `ui-audit-gate` gates on the audit *existing*, and `existing-ui-audit`
      scores candidates by fuzzy similarity **to the input** — so nothing
      anywhere checks a reuse candidate against a provided artifact's
      constraints, while `ui-audit-gate:126` carries "reuse beats duplication"
      as unqualified prose. Reuse becomes conditional on the candidate's own
      conformance verdict, and the reuse decision moves after extraction rather
      than before it. Found by the read-back pass rather than by any first
      reading of the round, which is why it is recorded as its own step.
      verify: a candidate whose subtree reds the conformance report is refused
      with the dimension that refused it named; a conforming one is reused.
- [ ] **3.4 Re-frame `strict` instead of adding a fourth mode.** A value inside
      tolerance stops being an unconfirmed deviation and becomes a reported
      reconciliation; everything outside stays confirmation-bound. Requires the
      rule-body cap to be resolved first.
      verify: the rule states it, the mode enum is unchanged, and no consumer
      default moved.
- [ ] **3.5 Give ADR-213 the artifact clause, with both guards and an honest
      enforcement line.** ADR-213 authorises extraction on repetition "already
      present in the diff". A handed-over runnable artifact makes repetition
      observable before any code exists, which is a **different mechanism** than
      the one the threshold tested — `adr_cite_check ADR-213` reports it LIVE
      with an **indeterminate** review trigger and `reopen_policy: unclassified`,
      so investigation is permitted. Two guards, both required, because the
      first alone is insufficient: (a) a **runnable** artifact, not a design
      comp; (b) repetition **of the element itself, not of its compositional
      context** — four `<Card>` instances show Card is used four times, they do
      not show a `CardGrid` is needed unless the diff carries multiple distinct
      contexts each arranging several cards. The numbers 2 / 3+ / ~4+ are
      unchanged. State plainly that guard (b) is **model-carried and
      audit-enforced**: nothing mechanical separates "I saw four Cards" from "I
      saw a CardGrid pattern", and claiming otherwise would be the coverage
      inflation this tree forbids elsewhere.
      verify: the clause names both guards and the enforcement class; the
      threshold numbers are byte-identical to today's.

## Phase 4 — Turn the claim into a measurement

Gated on `blocker: fidelity-default-flip` for anything that would refuse.

- [ ] **4.1 Report the dimensions separately.** Structure, values with their
      distance, behaviour, responsive semantics, icons and carrier, each row
      citing the artifact and the implementation. A green pixel diff alone
      cannot produce a pass.
      verify: a deliberately corrupted port reds the dimension that was
      corrupted and no other.
- [ ] **4.2 Run it in shadow and derive the threshold from what it records.**
      Extend the existing shadow gate rather than adding a concern — the
      allowance is zero. The flip to a refusing state is pre-registered with
      its own reverse trigger, and the tolerance start values are re-derived
      from the shadow distribution rather than kept.
      verify: shadow records exist, carry no self-reported verdict, and the
      flip criterion is written before the window opens.
- [ ] **4.3 Record why the polish-loop measurement is NOT the way to discharge
      its lock.** A 2026-07-31 council lock names its own reopening condition as
      *"a measured run showing the polish loop still edits away from a provided
      artifact"*, and no such run exists — so running it looks like the cheap way
      to close or reopen it. The third loop examined that and found the run
      cannot discharge the lock in the useful direction: the mechanism is
      structural, not probabilistic. `polish.ts:135-167` drops findings flagged
      `artifact_covered: true`, `src/skills/design-tokens/SKILL.md:82-88` wires
      `token_violation` findings into the same loop **without** setting that
      flag, and `design-fidelity-mechanics.md:222-229` states that "an unmarked
      finding is treated as actionable". A green run would mean "this did not
      trigger in the sample", never "this cannot trigger". The executable work
      is therefore to write that argument into the lock's own record, so the
      next reader meets the reasoning instead of re-deriving it and spending the
      run. The structural fix is gated on
      `blocker: findings-actionability-default`.
      verify: the lock's record carries the falsifiability argument and names
      the blocker; no measurement is scheduled against it.

## Blockers

### blocker: findings-actionability-default

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 4.3
- **What to do:** pick exactly one — (a) invert the default in
  `docs/guidelines/design-fidelity-mechanics.md:222-229` so a finding is
  **non-actionable unless explicitly escalated**, and set the escalation flag at
  the one call site that needs it; or (b) set `artifact_covered` on the
  `token_violation` path in `src/skills/design-tokens/SKILL.md:82-88` and leave
  the default alone; or (c) record that the pathway stays open and that the
  2026-07-31 lock is therefore undischargeable as written.
- **Resolved when:** a finding wired into the polish round from a
  token-violation detector no longer reaches an actionable state without an
  explicit flag, or option (c) is recorded in the lock's own record.
- **Recommendation:** (b). It is one call site and it changes no default, where
  (a) inverts the meaning of every existing unmarked finding across the
  package — a consumer-facing behaviour flip that is owner-reserved and far
  wider than the defect. (c) leaves a lock that cannot be closed.
- **If you do nothing:** 4.3 records the argument and the lock stays open
  forever, because the only measurement that would discharge it cannot
  distinguish "did not happen" from "cannot happen".

### blocker: standing-payload-headroom

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.3, 2.4
- **What to do:** pick exactly one — (a) pay for the addition inside the same
  standing rule, cutting an equal weight of existing prose in
  `src/rules/brand-source-of-truth.md` and naming what was cut and why; or
  (b) land the invariant in `docs/guidelines/design-fidelity-mechanics.md`
  instead, which is only honest after 2.1 makes that file reachable, and leave
  a one-clause pointer in the rule; or (c) accept that the artifact-versus-brand
  split stays unwritten on a projected surface and record that as the decision.
- **Resolved when:** `./scripts-run src/scripts/check_preamble_payload_budget`
  is at or under its ratchet with the invariant present somewhere a consumer
  agent reads, or option (c) is recorded.
- **Recommendation:** (b) after 2.1. The measured cost was +339 tok on a
  surface re-written on every subagent spawn against a ceiling with no
  headroom, so (a) buys 33 lines by deleting 33 lines somebody else wrote —
  a drive-by edit — and (c) leaves the gap this roadmap opened with.
- **If you do nothing:** 1.3 stays reverted, so `design-fidelity` keeps
  pointing at a brand rule that points nowhere back, and a brand-first entry
  path keeps missing the structure obligation entirely.

### blocker: approximation-tolerance

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 3.2, 3.4, 4.2
- **What to do:** pick exactly one — (a) accept provisional start values and
  record them in `src/config/agent-settings.template.yml` under `design:`,
  flagged as unmeasured and re-derived after Phase 4.2's window; or (b) name
  the values yourself in that file; or (c) hold Phase 3.2 until Phase 4.2 has
  a distribution to read them off, which orders 4 before 3.
- **Resolved when:** the `design:` block in
  `src/config/agent-settings.template.yml` carries a colour tolerance and a
  length tolerance with a one-line note on where the number came from.
- **Recommendation:** (a). The mechanism is worth more than the constant, the
  distance is reported on every row either way, and (c) inverts a dependency
  for a number that is provisional in all three branches.
- **If you do nothing:** Phase 3.2 cannot ship a setting, so Phase 3.4 cannot
  re-frame `strict`, and the second owner directive stays unimplementable in
  the rule text.

### blocker: fidelity-default-flip

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 3.2, 4.2
- **What to do:** pick exactly one — (a) ship the approximation mechanism
  disabled by default, so no consumer behaviour changes and the directive
  applies to whoever switches it on; or (b) ship it enabled, which is a
  shipped-default flip and is owner-reserved, recorded as such in an ADR; or
  (c) route it to `agents/roadmaps/stubs/road-to-frontend-power-default-flip.md`,
  which already exists for this exact class.
- **Resolved when:** the default is recorded in an ADR or in that stub, naming
  which of the three was chosen.
- **Recommendation:** (b), because the directive that motivates this roadmap
  states the approximation *is* the intended default — but the decision is
  owner-reserved and the agent may not take it, which is why this is a blocker
  and not a step.
- **If you do nothing:** the mechanism can be built and cannot be turned on,
  so Phase 4.2's shadow window has nothing to record.

### blocker: rule-body-cap

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 3.4
- **What to do:** pick exactly one — (a) migrate an existing passage out of
  `src/rules/design-fidelity.md` into
  `docs/guidelines/design-fidelity-mechanics.md`, which is legitimate only
  after Phase 2.1 makes it reachable; or (b) raise the `rule_too_large`
  ceiling in `src/scripts/skill_linter.ts` with the reason in the same commit;
  or (c) accept that the tolerance clause lives only in the guideline and the
  rule keeps a one-clause pointer.
- **Resolved when:** `wc -l src/rules/design-fidelity.md` leaves room for the
  clause, or option (c) is recorded.
- **Recommendation:** (c) after Phase 2.1, then (a) if the clause proves too
  load-bearing to sit behind a pointer. The rule is at 200 of 200 lines and the
  guideline has no cap.
- **If you do nothing:** Phase 3.4 has nowhere to put the sentence, and
  `strict` keeps contradicting the directive in the projected text.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The read carve-out opens a write bypass | implementation | A creating command slips a speaking directory past a blocking guard because the guard decided it was a read. Two review rounds falsified the first two mitigations here: a verb allowlist missed `sed -i`, `find -exec` and `awk system()`, and the deny-list that replaced it missed `sed`'s `s///w`, awk's output pipe, `sort -o` and `yq -i` | The carve-out no longer classifies commands at all. It judges the NAME: a glob cannot be created as written, and a glob over a speaking stem is still refused. Every writing form is judged by the unchanged token scan, and the sensitivity probe reds only the two glob allow-cases | Phase 1 — Remove the contradiction and the false positives |
| 2 | The projection lane reds the byte-exactness invariant | implementation | `dist == rewrite(src)` is asserted byte-for-byte, and a new lane is a new population for it to walk | Land 2.1 alone, with the invariant's own check run before anything else in the phase; the lane copies verbatim and rewrites paths through the mechanism already used for every other lane | Phase 2 — Make the delegated procedure exist where it is read |
| 3 | The approximation becomes a licence to drift | product | Many individually-legal small reconciliations compose into a result nobody approved | Every value row carries its distance even when preserved, so the drift is visible per row before it is cumulative; a cumulative bound is Phase 4's, and the tolerance is re-derived from shadow data rather than kept | Phase 3 — Maturity and approximation as data, not prose |
| 4 | Phase 3 writes policy into an unreachable file | implementation | The tolerance clause lands in the guideline while the guideline still reaches no consumer install, reproducing the exact defect this roadmap opens with | Phase 2 is ordered before Phase 3 and `blocker: rule-body-cap` names the dependency explicitly in its option (a) | Phase 2 — Make the delegated procedure exist where it is read |
| 5 | A skill re-writes a rule from underneath it | product | Phase 1.2's first draft granted the autonomous approximation by asserting that `strict` and `structural` scope their confirmation to a *visible* deviation. The rule carries no such qualifier, so the skill was shipping step 3.4's re-framing ahead of two open owner blockers — and its only safety branch read a setting that never cascades from the layer the rule points at | Row 3 of 1.2 is now a proposal, not an action: the distance is reported and the human decides, so the skill claims no autonomy the rule has not granted. The autonomous form waits for 3.2 and 3.4. Caught by review, not by a gate — nothing mechanical compares a skill's claim against a rule's text | Phase 3 — Maturity and approximation as data, not prose |
| 6 | Every remaining fix wants a standing rule with no room in it | implementation | The reach problem's natural fix is prose in a rule, and the per-spawn preamble ratchet has zero headroom — measured at +339 tok for 33 lines, which reverted step 1.3 out of the Phase 1 PR. Steps 2.4 and 3.4 both want the same surface | Phase 2.1 is ordered first so the guideline becomes a legitimate destination, and `blocker: standing-payload-headroom` forces the choice to be recorded rather than paid for by deleting somebody else's prose | Phase 2 — Make the delegated procedure exist where it is read |
| 7 | A council verdict is adopted without its destination being checked | implementation | Three rounds converged 2/2 on direction and proposed three destinations that do not work — two named protected Iron-Law lines or load-bearing prose as "redundant", the third named a skill file that does not exist. A plan that had executed any of them would have failed at the gate or violated `preservation-guard` | Every council-sourced step in this roadmap names the file and line it edits, and the destination in 1.5 was located and verified in this repository rather than taken from the verdict. Adopt direction from the council; verify placement in the tree | Phase 1 — Remove the contradiction and the false positives |
| 8 | An unsourced claim is defended because it already shipped | product | The icon obligation set an evidentiary bar for its own reversal that it never met itself. The same asymmetry can protect any clause that reached the tree first, and the more confidently a clause is written the more it looks like a decision rather than an assertion | 1.4 deletes rather than defends, and records the contrary evidence with a reopening condition instead of acting on it. The general form — a claim's provenance is checked before its authority is granted — belongs to `code-provenance`'s knowledge layer and is not re-litigated here | Phase 1 — Remove the contradiction and the false positives |

## Acceptance Criteria

- [x] AC-1 — A read command naming a not-yet-existing inbox directory is not
      refused, a creating command naming the same directory still is, and both
      are pinned by assertions that go red when the mechanism is removed.
- [x] AC-2 — `tailwind-engineer` names the artifact-bound branch explicitly,
      forbids the snap, requires the translate-once token duty, keeps the
      reconciliation a proposal, and carries a named output field the reported
      distance lands in — while claiming no autonomy that 3.2 and 3.4 have not
      yet earned. Scoped to that skill on purpose: the corpus-wide version of
      this claim ("no shipped skill instructs …") is not checkable from a diff
      that changes one skill, and a neutral review flagged the earlier wording
      as unbacked. The sweep across the other design-adjacent skills is Phase
      3's, via the same branch.
- [ ] AC-3 — `brand-source-of-truth` and `design-fidelity` each carry the
      split between them, in both directions, on a projected surface, without
      the per-spawn payload ratchet moving.
- [ ] AC-4 — `docs/guidelines/design-fidelity-mechanics.md` resolves inside
      `dist/agent-src/` and a gate fails when a projected rule routes to a
      target that does not.
- [ ] AC-5 — `design.fidelity_mode` set on the user-global layer resolves, and
      a non-whitelisted key there reports the drop rather than reading as unset.
- [ ] AC-6 — The artifact's maturity and the reconciliation outcome are fields
      with provenance, not prose, and a preserved value still carries its
      distance to the nearest project token.
- [ ] AC-7 — A corrupted port reds exactly the dimension that was corrupted,
      the record carries no self-reported verdict, and the flip criterion was
      written before the shadow window opened.
- [ ] AC-8 — No shipped surface asserts an obligation about icons on a provided
      artifact without a citation. The contrary evidence is recorded with the
      condition that would reverse it, and the skill that declares icons outside
      its own scope no longer legislates them.
- [ ] AC-9 — A consumer install that receives the fidelity rule and **not** the
      brand rule reads the artifact-versus-brand split inside the rule it did
      receive, and no sentence in a projected rule instructs the reader to open
      a path the projection does not contain.
- [ ] AC-10 — No shipped surface prescribes an order among stories, components
      and the page. Where a sequence is described it is labelled as observed
      practice, and the two contradictions about the workshop's conditionality
      and its state-coverage pointer are gone.
