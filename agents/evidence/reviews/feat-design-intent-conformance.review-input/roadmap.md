<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
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
  although `AUGMENT_SYMLINK_DIRS` in `src/scripts/condense.ts:2464` already
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
- **The inbox guard refuses reads.** `src/scripts/hooks/hook_manifest.yaml:235-240`
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

Three constraints bound every phase below, all measured on this branch:
`design-fidelity.md` is at **exactly 200 lines** against `skill_linter`'s
`rule_too_large` ceiling, so no sentence lands there without one leaving;
`check_estate_count` reports **0 growth allowance** on active roadmaps, skills
and hook concerns; and `condense.ts` sits at 2735 lines against a 1500 ceiling
under a shrink-only ratchet, so Phase 2 must be net-zero there.

## Phase 1 — Remove the contradiction and the false positives

Nothing here needs a decision, a new artefact, or a default change. All three
are defects with a verified wrong behaviour and a verified right one.

- [x] **1.1 Teach the inbox guard that reading is not creating.** Three fixes in
      `src/scripts/hooks/block_speaking_inbox_dir.ts`: a read-tool deny-list so a
      `Read`/`Grep`/`Glob` `file_path` is not judged as a write target; a
      per-segment verb allowlist reusing `git_command_classifier`'s segmenter so
      `ls`/`cat`/`grep` are not judged as `mkdir`, with redirect targets still
      judged separately; and an existence probe that carries the path's own
      prefix so a module-nested round resolves. The docstring's `Write/Edit/
      NotebookEdit` scope becomes what the code implements.
      verify: `npx vitest run tests/hooks/block_speaking_inbox_dir.test.ts` —
      35 assertions green, including the two commands that were refused in this
      round; and with both allowlists emptied exactly the five new allow-cases
      go red while every block-case stays green.
- [x] **1.2 Give `tailwind-engineer` the artifact-bound branch it never had.**
      Step 1 keeps the greenfield default and gains a distance table: same value
      to the nearest project token means write the token, an invisible
      difference means write the token and report it, a visible difference means
      keep the artifact's value and report the project gap. An artifact-derived
      exact value stops being "a smell" in that mode. A literal is translated
      once into a named project token instead of snapped per call site — the
      first owner directive's token duty, as written. Structure, controls,
      icons, grid and breakpoints are named as not this skill's to adjust. A
      second `Gotcha` bullet states the carrier-versus-value split the second
      owner directive asked to be made clearer: static presentation belongs in
      CSS or classes, `style=` is for what only the runtime knows, and porting
      an inline style into classes is expected as long as the resolved value is
      identical.
      verify: `./scripts-run src/scripts/skill_linter --all` warn count
      unchanged at 1, and the file stays under the 400-line skill ceiling.
- [x] **1.3 Make the brand rule carry the split instead of pointing one way.**
      `src/rules/brand-source-of-truth.md` gains the artifact-versus-brand
      invariant as a table — values to the brand token with the distance
      reported, structure to the artifact and never adjusted to suit a token —
      plus the reciprocal `design-fidelity` see-also. This also puts the
      invariant on a **projected** surface, which is the one piece of Phase 2's
      reach problem that does not need Phase 2.
      verify: `grep -c design-fidelity src/rules/brand-source-of-truth.md`
      greater than 0, and the rule stays under the 200-line ceiling.

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
- [ ] **3.3 Re-frame `strict` instead of adding a fourth mode.** A value inside
      tolerance stops being an unconfirmed deviation and becomes a reported
      reconciliation; everything outside stays confirmation-bound. Requires the
      rule-body cap to be resolved first.
      verify: the rule states it, the mode enum is unchanged, and no consumer
      default moved.

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

## Blockers

### blocker: approximation-tolerance

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 3.2, 3.3, 4.2
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
- **If you do nothing:** Phase 3.2 cannot ship a setting, so Phase 3.3 cannot
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
- **Blocks:** 3.3
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
- **If you do nothing:** Phase 3.3 has nowhere to put the sentence, and
  `strict` keeps contradicting the directive in the projected text.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The read carve-out opens a write bypass | implementation | A creating command wearing a read verb, or a tool name nobody recognised, slips a speaking directory past a blocking guard | Both allowlists are deny-by-default: an unknown verb and an unknown tool are still judged, redirect targets are judged whatever the verb, and the sensitivity probe in 1.1 shows the block-cases stay green when the allowlists are emptied | Phase 1 — Remove the contradiction and the false positives |
| 2 | The projection lane reds the byte-exactness invariant | implementation | `dist == rewrite(src)` is asserted byte-for-byte, and a new lane is a new population for it to walk | Land 2.1 alone, with the invariant's own check run before anything else in the phase; the lane copies verbatim and rewrites paths through the mechanism already used for every other lane | Phase 2 — Make the delegated procedure exist where it is read |
| 3 | The approximation becomes a licence to drift | product | Many individually-legal small reconciliations compose into a result nobody approved | Every value row carries its distance even when preserved, so the drift is visible per row before it is cumulative; a cumulative bound is Phase 4's, and the tolerance is re-derived from shadow data rather than kept | Phase 3 — Maturity and approximation as data, not prose |
| 4 | Phase 3 writes policy into an unreachable file | implementation | The tolerance clause lands in the guideline while the guideline still reaches no consumer install, reproducing the exact defect this roadmap opens with | Phase 2 is ordered before Phase 3 and `blocker: rule-body-cap` names the dependency explicitly in its option (a) | Phase 2 — Make the delegated procedure exist where it is read |
| 5 | The distance table is judgement, not measurement | product | Phase 1.2 asks whether a difference is visible side by side, which two readers can answer differently | Accepted deliberately for Phase 1: inventing a threshold there would pre-empt `blocker: approximation-tolerance`. Phase 3.2 replaces the judgement with the recorded number | Phase 1 — Remove the contradiction and the false positives |

## Acceptance Criteria

- [x] AC-1 — A read command naming a not-yet-existing inbox directory is not
      refused, a creating command naming the same directory still is, and both
      are pinned by assertions that go red when the mechanism is removed.
- [x] AC-2 — No shipped skill instructs the agent to replace a provided
      artifact's exact value with a nearest project token without reporting the
      distance; `tailwind-engineer` names the artifact-bound branch explicitly.
- [x] AC-3 — `brand-source-of-truth` and `design-fidelity` each carry the
      split between them, in both directions, on a projected surface.
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
