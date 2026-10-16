---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
depends: [road-to-a-setup-that-decides-itself]
estate_offset_exempt: "Round inbox-2026-10-c reproduced the host's 150k notice on a fresh install: 102 unconditional files and 338,225 chars under ~/.claude/rules, because install.ts has zero references to lean_projection and the delivery flip ADR-267 shipped thins only the project tree consumers do not get. The subject has arrived in at least 22 consumed rounds and no active roadmap owns the installed layer; this file is the only one whose done state removes the notice."
estate_growth_exempt: "+1 open_blockers for `arrival-record-needs-a-cancelled-observer`. Discovered 2026-10-10 while screening Phase 2, not a repaired undercount: step 2.1 named the carrier roadmap's step 0.2 as its data source, and that step was cancelled by owner answer D10 on 2026-10-06, moving the instruction-load observer into an unscheduled stub. The entry closes no box and changes no behaviour; it makes three steps read as blocked to run-continuation, which decides open-vs-blocked from the inline marker alone, and it records that the owner's already-given (a) on the default flip is stranded behind an instrument no scheduled file owns. The superseded claim it replaces was spent on `default-flip-of-the-installed-layer`, which is registered and still open."
relates:
  - slug: road-to-a-setup-that-decides-itself
    relation: depends
    note: Its 5.3 carries the default flip this file's 3.1 and 3.5 were re-cut to wait on (2026-10-12 note under 3.5).
  - slug: road-to-a-rule-carrier-that-works-outside-the-repo
    relation: extends
    note: Archived, every step closed. Phase 1 here waited on that file's Phase 1, which has merged.
  - slug: road-to-rule-laws-that-can-stand
    relation: extends
    note: Archived, every step closed. The stub-plus-law form and the consequence class came from that file's Phase 2.
  - slug: road-to-standing-rule-delivery-per-machine
    relation: extends
    note: Stub. Its AC-0 becomes dischargeable once Phase 3 here ships.
  - slug: road-to-delivery-on-hook-hosts
    relation: disjoint
    note: Later. Owns `host-injection-effect.json`; step 2.4 here only reads its row and records the new exposure state.
---
# Road to an installed layer that is thinned

> **Source:** `agents/tmp.old/inbox-2026-10-c/` — a round of four roadmap drafts
> and one transcript on the host's 150k instruction-budget notice, pinned to
> `main` @ `9bc8cd4f2` (16.2.0). Verified against `main` @ `a03f60c46` on
> 2026-10-01. Council record:
> `agents/evidence/council/inbox-2026-10-c-standing-form.md`.
>
> **Fold into `road-to-a-setup-that-decides-itself` declined 2026-10-16**
> (council 2/2, `agents/evidence/council/intake-folds-2026-10-16.md`): the
> rollback setting this file keeps and that file removes is an undecided fork.

## Goal

The layer a Claude install writes under `~/.claude/rules` is the thinned one,
first as an opt-in and then as the default, with one setting to roll back.
Done means: an opted-in install stands under 75,000 package-owned characters and
under the 65,000 target on the default scope; an arrival record from a real
session shows the stubs and standing laws loaded and every matched delivery
under the budget; and the default changes only after the owner decides it on
those records.

## Context

Reproduced on 2026-10-01:

- The global install step copies `dist/agent-src/rules` verbatim and rewrites
  frontmatter only (`src/scripts/install.ts:1806-1814`, `:3073-3100`);
  `grep -c lean_projection src/scripts/install.ts` returns 0. Thinning happens
  only in `generate_rule_symlinks`, the maintainer projection
  (`src/scripts/condense.ts:1118`, `:1182`).
- The round's real install into an empty `HOME` measured 102 unconditional
  files and 338,225 characters, the three largest being the three the host
  named. The maintainer machine's notice reported 120 files and 377.7k; the
  difference includes instruction files that are not this package's.
- The thin stub's body pointer is project-relative
  (`src/scripts/project_thin_rules.ts:309`) and resolves nowhere from
  `~/.claude/rules`.
- The shipped template sets `lean_projection.mode: delivery`
  (`src/config/agent-settings.template.yml:212-214`). Once the installer reads
  the mode through the shared resolver, the template value alone would thin
  every consumer — a default flip by side effect. Phase 1 therefore keys the
  installer on an explicitly set value, never on the template.
- ADR-267 decision 2 confines thinning to the projector; ADR-228 is `accepted`
  while `claudeRuleRewrite.ts:213` emits `paths:` on the global layer.

## Phase 1 — An opt-in thinned install

- [x] **1.1 The installer applies the projector's predicate when asked.** With
      `lean_projection.mode: delivery` set on a layer other than the shipped
      template, the global install step for `claude-code` writes the stub form —
      stub plus law for the consequence class, pointer stub for the rest;
      kernel, trigger-less and path-only rules stay full as `build_thin`
      decides. The body pointer is absolute. Ownership keys survive.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts` -> 0
- [x] **1.2 One rollback.** `lean_projection.mode: eager-all` plus a reinstall
      writes today's full layer again.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t rollback` -> 0
- [x] **1.3 Upgrades converge.** An upgrade from a 16.2.0-shaped `HOME` ends at
      the thinned layer when opted in; user-modified rule files are preserved
      and reported, never overwritten; the receipt prints both standing totals.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t upgrade` -> 0
- [x] **1.4 A combined-total warning.** At install, the receipt reports
      package-owned and foreign instruction characters against the host's
      published limit, and warns when the combined total crosses 80 % of it.
      verify: `npx vitest run tests/scripts/installed_layer_report.test.ts -t combined` -> 0

> **Closed 2026-10-05.** A second obstacle sat under the stated one and is
> repaired in the same branch: `lean_projection.*` was absent from
> `MERGEABLE_KEYS`, so `load_agent_settings` read the user-global layer and threw
> the value away. On an ADR-020 global-only install that layer is the ONLY one
> that can carry the opt-in, so 1.1 was unsatisfiable on exactly the install
> shape it is about. Measured both directions on an isolated probe before and
> after the whitelist row. The stub body pointer is absolute now
> (`absoluteBodyLinkPrefix`); the shipped relative prefix resolved from an
> installed layer never, not merely imprecisely.

## Phase 2 — Records from opted-in machines

- [ ] **2.1 An arrival record per host version.** Input: the record of
      `road-to-a-setup-that-decides-itself` step 2.1 — run after it lands. From the instruction-load
      observer — step 3.0 of `stubs/road-to-instructions-loaded-observer.md`,
      NOT the carrier roadmap's step 0.2, which the owner cancelled on
      2026-10-06 (D10 there) and which moved the observer to that stub — one
      real session per supported
      host version: which stubs and standing laws loaded at start and after
      compaction; whether a user-layer `paths:` rule loads on `Read`, `Edit`, a
      `Write` that creates the file and a Bash-first edit; every matched
      delivery under the 8,000 budget and none replaced by a preview.
      verify: `grep -c 'host version' agents/evidence/analysis/installed-arrival-*.md` -> /^[1-9]/
- [x] **2.2 A standing-only fixture.** With the carrier disabled, the loaded
      text of an opted-in install contains every consequence-class law
      byte-equal to its source section.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t standing-only` -> 0
- [ ] **2.3 Does a stub get used?** Per session, reads of a rule body path that
      were not preceded by a delivery of that rule, from records the dispatcher
      already writes; and per rule, deliveries against the characters it stands
      at, zeros included. A rule never delivered and never read is a candidate
      for the owner, not an automatic removal.
      verify: `grep -c 'self-served' agents/evidence/analysis/stub-use-*.md` -> /^[1-9]/
- [ ] **2.4 The injection-effect row, on its own terms.** After the opt-in, the
      injected copy is the only copy for the thinned rules; record the new
      exposure state beside `src/config/host-injection-effect.json:8` without
      changing that file's verdict, which `road-to-delivery-on-hook-hosts` owns.
      verify: `grep -c 'thinned' agents/evidence/analysis/installed-arrival-*.md` -> /^[1-9]/
> **2.1, 2.3 and 2.4 need a real opted-in machine**, which this branch cannot
> produce: each one's verify greps an `agents/evidence/analysis/` record written
> from a live session after an install has actually been opted in. 2.2 is the
> exception and is closed — it is a fixture, not a session record.
>
> **Re-read 2026-10-10 — the gate is narrower than "a machine", and it strands
> an answer the owner has already given.** 2.1 named the carrier roadmap's step
> 0.2 as the source of its data. That step is `[-]` **cancelled**, by owner
> answer D10 of 2026-10-06, and the observer travels instead as step 3.0 of
> `stubs/road-to-instructions-loaded-observer.md` — a stub, so no active
> roadmap owns it and nothing schedules it. The tree says the same thing in
> code: `src/scripts/check_standing_rule_delivery.ts:289` calls the
> `InstructionsLoaded` hook "a host feature this suite does not yet bind", and
> `instructionsLoadedRecord()` exists only to report the record's absence.
>
> So the three steps are not waiting on someone opting a machine in. They are
> waiting on an instrument that an owner decision moved out of every scheduled
> file. That matters beyond Phase 2, because blocker
> `default-flip-of-the-installed-layer` is **already answered** — (a), 2026-10-06
> — and closes only "when the ADR of step 3.3 records (a) with the arrival
> record it relied on". The arrival record is 2.1. The owner's answer is
> therefore stranded behind the cancelled observer, and until this re-read
> nothing in the tree said so.
>
> The three steps now carry an inline `<!-- blocked-by: ... -->` marker. That is
> the same repair the carrier roadmap documented for its own 0.2: `run-continuation`
> decides open-vs-blocked from the inline annotation alone and never parses
> `## Blockers`, so without it an impossible step reads as runnable work to the
> one mechanism that acts on it, and every stop fire re-engages an agent into it.
>
> **Re-screened 2026-10-12 under `/roadmap:process-full`, and 2.3 has a SECOND
> reason that is not the cancelled observer.** The capability screen asks per
> step whether the agent can execute it at all, and a `## Blockers` entry is
> evidence rather than a verdict — so each of the three was re-tested against the
> tree rather than against its marker.
>
> 2.3 is the one that could have survived, because its own text names a source
> that does not need the host event: "from records the dispatcher already
> writes". Those records are real and the writer is in the tree —
> `recordArrival` / `arrivalPath` in `src/scripts/hooks/rule_inject_hook.ts`
> append one JSONL row per fire under the user-global
> `state/rule-inject/<project-key>/<session>.arrival.jsonl`. **The corpus on this
> machine is 16 files and every one of them is the fixture
> `injection-budget-dispatch-test.arrival.jsonl`, under 16 synthetic
> `injection-dispatch-*` project keys written by the hook's own test suite on
> 2026-10-03 to 2026-10-05. Zero rows come from a real session, and no project
> key corresponds to a real project.** So the instrument 2.3 names exists and is
> empty, which is a different finding from the instrument not existing and is
> worth separating: 2.3 needs sessions to have been recorded, not an observer to
> be scheduled, and it will stay unsatisfiable on this machine until one is.
> Its second half — correlating a body-path read with a preceding delivery —
> additionally needs a transcript reader that nothing here binds.
>
> 2.1 and 2.4 were re-tested and are unchanged: `agents/evidence/analysis/`
> matches no `installed-arrival-*.md`, and
> `src/scripts/check_standing_rule_delivery.ts:289` still calls
> `InstructionsLoaded` "a host feature this suite does not yet bind", with
> `instructionsLoadedRecord()` existing only to report the record's absence.
> Both remain externally impossible for the agent, which is the only blocker
> class ADR-237 leaves standing. The markers stay as written.

## Phase 3 — The default, decided

- [ ] <!-- blocked-by: default-flip-of-the-installed-layer | asked: no — the blocker is registered in this file, already answered (a) by the owner on 2026-10-06, and waits on the arrival record rather than on a new question --> **3.1 Flip the default.** Only after blocker
      `default-flip-of-the-installed-layer` is resolved: the installer thins by
      default for `claude-code`, the receipt announces both numbers, and the
      rollback of 1.2 stays one setting.
      **Form re-cut 2026-10-12:** the owner directive in round `inbox-2026-10-n`
      removes the setting; `road-to-a-setup-that-decides-itself` Phase 3 replaces
      the flip with a computed decision and an install-time brake, and its 5.3 is
      where the default changes. The owner's (a) of D5 still sets the condition.
      verify: `npx vitest run tests/scripts/install_thin_layer.test.ts -t default` -> 0

      **Re-screened 2026-10-12 — this step can no longer close in this file, and
      its verify line says so by accident.** `-t default` matches **no test** in
      `tests/scripts/install_thin_layer.test.ts`; the only occurrence of the word
      there is a comment at line 15 naming this very blocker. That is not a test
      somebody forgot to write — it is the shape of a step whose subject moved.
      After the re-cut, the code that would make such a test pass is built by
      `road-to-a-setup-that-decides-itself` Phase 3 (a decision function that
      reads no settings key) and switched on by its 5.3, so the test belongs
      beside the code that satisfies it. Left `[ ]` rather than `[~]` or `[-]` on
      purpose: `[~]` needs a receiver carrying `parent_roadmap:` and these two
      roadmaps are siblings (`relates: extends`), not parent and child, while
      `[-]` is cancellation and owner-reserved. Open with its producer named is
      the honest state; a glyph that laundered it into done or dropped is not.
- [ ] **3.2 The ceiling becomes required.** The installed-layer report fails CI
      above the measured thinned total plus 10 %, never above 75,000, and moves
      down only.
      verify: `npx vitest run tests/scripts/installed_layer_report.test.ts -t ceiling` -> 0

      **Measured 2026-10-06, and left OPEN because of what the number says.**
      A real opt-in install (`lean_projection.mode: delivery`) against the
      current corpus reads **111,197 characters**, not under 75,000 — 89 thinned
      stubs (52,925 chars) plus 16 rules `project_thin_rules` keeps full by its
      own predicate (kernel, path-only, trigger-less; 58,272 chars). Full
      method, per-file breakdown and a reproduce block:
      `agents/evidence/analysis/installed-layer-ceiling-measurement-2026-10-06.md`.
      A hard-failing CI gate at 75,000 would be red on `main` the moment it
      merged, over a corpus this roadmap's own "What this roadmap deliberately
      does not do" excludes (no kernel-plus-index layer; ADR-267 decision 5's
      file set stays protected). Landing the gate here would break every
      subsequent PR on a problem outside this file's scope; the step stays open
      until the full-bodied set is small enough for a hard ceiling to mean
      something.
      **Deliberately NOT marked blocked, 2026-10-10.** Every other open Phase 3 step
      now carries `default-flip-of-the-installed-layer`'s inline marker, and this one
      does not belong with them: it waits on the FULL-BODIED SET SHRINKING, which no
      registered blocker in this file gates and which the flip would not change. A
      marker naming the flip would misstate what this step is waiting for.

      **Re-opened and put to the council on 2026-10-12 — verdict REQUEST_CHANGES,
      and this step now has a second reason that is better than D6's.** The
      proposal was not D6's rejected mechanism: not a hard gate at 75,000, but a
      **shrink-only ratchet seeded at the measured total plus 10 %**, green on
      `main` the day it lands, with 75,000 recorded as the destination — the
      shape `src/config/preamble-payload-budget.json` already uses for the same
      tension. Council, 2026-10-12, convened on the two-seat configuration and
      **concluded with one seat present**: the anthropic seat answered, the
      openai seat failed to exchange (`os_error: ENOBUFS`). A one-seat reading is
      recorded as a one-seat reading — it is not provider-diverse and it is not a
      2/2 convergence.
      - **Q1, the lock:** D6 does **not** bar the ratchet under a strict
        mechanism-match reading, because D6 tested a hard 75,000 gate and this is
        a different mechanism. The seat added that D6's own wording — "stays a
        reported finding, not a hard CI gate, until the real total is reachable"
        — admits a narrow reading (not *that* gate) and a broad one (not *any*
        hard gate), and should be amended to say which. D6 is amended below.
      - **Q2, the mechanism:** **UNSOUND as proposed.** A *stored* baseline
        cannot ship over a measurement that moves with the environment: the stub
        body pointer is absolute, so the total moves by 89 characters per
        character of package-root prefix, and a ratchet over a drifting number
        locks at the shortest path any runner ever had. The seat named the
        in-repo precedent for exactly this — `estate-count-budget.json`, deleted
        because its stored number moved on nearly every merge — and recommended
        **base-ref comparison instead**: measure both revisions in one fixed-length
        path, require `head <= base`, store nothing.
      - **One seat finding is wrong, and correcting it does not rescue the
        proposal.** The seat read an unexplained 4,139-character environment
        variance out of the evidence page. It is not environment variance: 4,139
        is the predicted effect of the **stub-form change** (111,197 -> 107,058),
        and the environment term is the separate, documented 3,738 = 42 x 89. So
        the arithmetic reconciles. What survives is the structural half, which was
        never in doubt and is the half that decides: the figure is
        environment-dependent by construction, so a stored baseline measures the
        runner as much as the corpus.
      **Disposition: the step stays open, and the reason is now the mechanism
      rather than only the corpus.** Closing it needs a measurement that is
      environment-independent before any ratchet over it means anything — a
      normaliser that strips or substitutes every absolute-path occurrence, with
      tests over different root lengths, or the base-ref form the seat preferred,
      which costs two real installs per CI run. Neither exists. Noted rather than
      built, because the council was asked whether to build it and said not in
      this shape.
- [x] **3.3 The decision record.** An ADR extends ADR-267 decision 2 from the
      projector to the installer, records why the template value is not a
      consent, and marks ADR-228's global-layer statement superseded.
      verify: `./scripts-run src/scripts/check_adr_frontmatter` -> 0

      **Closed 2026-10-12 — and the blocked marker it carried was wrong, not
      merely stale.** The step has three stated clauses and the blocker added a
      fourth from outside: `default-flip-of-the-installed-layer` resolves "when
      the ADR of step 3.3 records (a) with the arrival record it relied on". No
      clause of 3.3 mentions the flip. Reading the blocker's clause back onto the
      step made an ADR that was fully writable today look impossible, which is the
      `## Blockers`-entry-as-verdict failure the capability screen exists to
      refuse. The marker is removed rather than re-dated.
      [ADR-284](../../docs/decisions/ADR-284-installer-honours-the-host-axis-on-an-explicit-opt-in.md)
      discharges all three clauses: decision 1 extends ADR-267 decision 2 to the
      installer, decision 2 records D3, and the record performs a **scoped**
      supersession of ADR-228 — the verbatim-copy limb only, with the `paths:`
      limb and its compaction objection named in `## Not reopened` and left to
      `road-to-a-rule-carrier-that-works-outside-the-repo`. ADR-228 carries the
      reciprocal `superseded_by` + `superseded_scope` and stays `accepted` for
      the limb it is titled after.
      **It deliberately does NOT discharge the flip blocker.** Decision 6 states
      the owner's (a), states its condition, and states that the condition is
      unmet — a record of the decision, never the decision taken. The blocker's
      `Resolved when:` is repaired below to name a producer that is still open,
      because a resolution clause pointing at a closed step cannot fire.
- [x] **3.4 A new routed rule declares its cost.** A routed rule added after
      the flip fails CI without a law section under 2,000 characters and at
      least one trigger a prompt can fire.
      verify: `npx vitest run tests/scripts/lint_rule_law_section.test.ts -t new-rule` -> 0

      **Closed 2026-10-06, independently of the flip.** `lint_rule_law_section`
      already refused a lawless or over-ceiling rule (`missing` baseline,
      `LAW_HARD_CHARS`); it had no opinion on a TRIGGERLESS one. A new `trigger`
      axis closes that gap the same shrink-only way: a routed rule with zero
      triggers in `dist/router.json` fails unless it is named in a new
      `no_trigger` baseline, which — same discipline as `missing` — an id may
      only leave, never join. The baseline seeds the four rules that read zero
      triggers today (`no-roadmap-references`, `rule-type-governance`,
      `skill-quality`, `source-confidentiality`), each a deliberate
      `collision_ok`-or-unconditional delivery recorded in its own frontmatter,
      not an oversight. `lint(root, 'all')` now refuses a rule failing on EITHER
      axis at once, which a rule passing one axis with zero triggers (or vice
      versa) could otherwise slip past — the `new-rule` describe block proves
      both directions plus the ceiling still refusing with a trigger present.
      Scoped to the gate itself: no CI runner wires it as a standalone
      `check_`/`lint_` step today, same as before this change — its enforcement
      is the `is clean over the real tree` vitest case, already part of
      `task ci`.
- [ ] <!-- blocked-by: default-flip-of-the-installed-layer | asked: no — the blocker is registered in this file, already answered (a) by the owner on 2026-10-06, and waits on the arrival record rather than on a new question --> **3.5 No other host worse.** `check_host_tree_parity` is unchanged, and
      the installed-layer report adds one row per host with a published limit.
      verify: `./scripts-run src/scripts/check_host_tree_parity` -> 0
      > Both limbs already hold as of 2026-10-05 — `check_host_tree_parity`
      > exits 0 (`2 non-delivery host tree(s) byte-identical to eager-all`) and
      > the report carries one row per host with its limit. Left OPEN anyway:
      > the step asks whether the FLIP made another host worse, and there has
      > been no flip, so closing it now would assert a guarantee about a state
      > that does not exist. It closes with 3.1, on a re-run, not on this note.
      >
      > **Re-verified 2026-10-12, and the last sentence above is now wrong.**
      > `check_host_tree_parity` still exits 0 — `2 non-delivery host tree(s)
      > byte-identical to eager-all · delivery hosts [claude-code]` — so both
      > limbs continue to hold. What changed is the referent: 3.1 was re-cut the
      > same day, and the flip it names now happens in
      > `road-to-a-setup-that-decides-itself` 5.3. "It closes with 3.1" therefore
      > points at a step that can no longer close here. This criterion is gated
      > on that file's 5.3 and on a re-run of the command above against the tree
      > as it stands after it — not on any work left in this roadmap. Recorded
      > rather than closed, because the guarantee it asks for is still about an
      > event that has not happened; what is corrected is where the event will
      > happen, which until now this file named wrongly.

## Phase 4 — The host that is delivered to and may not be reading it

Added by round `inbox-2026-10-t`. It is one defect on the surface this file
already owns — what the install puts where — so it lands here as a phase
rather than as a ninth roadmap.

- [ ] **4.1 Establish what the host actually reads, before changing the
      delivery.** `src/install/wizard-plan.ts:48` anchors this host at
      `~/.codex/` and `:150` sends it the full skill bundle;
      `docs/contracts/install-layout.md:152` records the delivered set as
      `rules/, skills/, commands/, personas/`; `README.md:349` carries a ✅ for
      it. What none of those establishes is that the host reads a markdown file
      under that namespace as instructions rather than as execution policy, and
      no `AGENTS.md` is written at the root it documents. Probe the real host
      and record the answer.
      verify: the finding lands under `agents/evidence/analysis/` with an
      `evidence-type` marker, naming the host build it was taken against.
- [ ] **4.2 Make the delivery match the reading, or make the claim match the
      delivery.** If 4.1 shows the namespace is not read as instructions, write
      what the host does read; if it shows the delivery is fine, correct the
      round's finding in the same change. One of the two ships — a probe whose
      outcome changes nothing was not worth taking.
      verify: `README.md:349` and `docs/contracts/install-layout.md:152` agree
      with the 4.1 record, asserted by a fixture over the two files.
- [ ] **4.3 Do not generalise from one host.** The check added in 4.2 asserts
      agreement between the claim and the delivery for this host only. Whether
      other hosts have the same gap is a separate measurement and is not
      assumed here.
      verify: the fixture names the host it covers.

## What this roadmap deliberately does not do

- No thinning of any other host (ADR-267).
- No kernel-plus-index layer in place of stubs: it changes the file set ADR-267
  decision 5 protects, and 2.3 is the record that would justify proposing it.
- No `rule_packs` default change in the same window, so the two movements stay
  attributable.
- No behavioural judge as an exit condition (ADR-202 closed it); the gates are
  arrival, standing-only presence and stub use.

## Blockers

### blocker: arrival-record-needs-a-cancelled-observer

- **Status:** resolved — owner chose (a) in substance on 2026-10-15 (PR #2373 report, answer to `instruction-load-observer-has-no-scheduled-owner`): stub step 3.0 is now scheduled as steps 1.1–2.2 of the active `road-to-a-setup-that-decides-itself`, so steps 2.1, 2.3, 2.4 and AC-2 read that file's step 2.1 record and run once it lands. Was: discovered 2026-10-10. The instrument steps 2.1, 2.3 and 2.4 read from was cancelled by owner answer D10 of `road-to-a-rule-carrier-that-works-outside-the-repo` on 2026-10-06 and now travels only as step 3.0 of `stubs/road-to-instructions-loaded-observer.md`, which no active roadmap owns
- **Owner:** owner — scheduling a stub is an estate decision, and the stub's own text records that the host observation does not close its 3.0
- **Class:** 3
- **Ownership:** product-owned
- **Blocks:** steps 2.1, 2.3 and 2.4 — and, through 2.1, the closing condition of `default-flip-of-the-installed-layer`, whose answer the owner has already given
- **What to do:** pick exactly one — (a) promote `stubs/road-to-instructions-loaded-observer.md` to an active roadmap so its step 3.0 can land the observer, accepting the estate cost; (b) re-scope 2.1 to a record obtainable WITHOUT the host event, naming in the same change which of its five claims — stubs loaded at start, laws loaded at start, both after compaction, the `paths:` rule on four edit shapes, every matched delivery under 8,000 — survive that narrowing and which are dropped; or (c) accept that Phase 2 and the already-answered default flip wait indefinitely, and record that beside D4 so the owner's (a) is not read as pending work.
- **Resolved when:** the stub is an active roadmap with step 3.0 open, or steps 2.1 / 2.3 / 2.4 carry re-scoped text naming what is no longer claimed, or a line beside D4 records that the flip waits on an unscheduled stub.
- **Recommendation:** (b) — but only for the part that is genuinely reachable, and the recommendation is deliberately weaker than it looks. `check_standing_rule_delivery.ts` already produces a filesystem-projection reading and labels it "not host-confirmed", so a narrowed 2.1 could be satisfied today for the delivery-budget claim and the `paths:` claim. What it cannot produce is "loaded at start and after compaction" — those are the host's own event, and dropping them silently would turn a projection into a claim about arrival, which is the exact substitution the stub refuses. (a) is the only option that keeps all five claims, and it costs an active roadmap.
- **If you do nothing:** 2.1, 2.3 and 2.4 stay open and now read as blocked rather than as runnable, so an autonomous run stops re-entering them. The default flip stays opt-in indefinitely, every non-opted-in install keeps loading 338,225 characters, and the owner's (a) answer of 2026-10-06 keeps looking like a pending decision when it is in fact a decision waiting on an instrument.

### blocker: default-flip-of-the-installed-layer
- **Status:** open — owner answered (a) on 2026-10-06 via `/roadmap:resolve-blockers` (D5); closes when the ADR of step 3.3 records (a) with the arrival record it relied on, which waits on that record and the step 2.2 fixture, not on a question. **Re-read 2026-10-10:** that arrival record is step 2.1, and 2.1's instrument was cancelled by owner answer D10 elsewhere on the same day this one was answered — see `arrival-record-needs-a-cancelled-observer`. The answer is given; what it waits on is not obtainable in any scheduled file.
- **Owner:** owner
- **Blocks:** 3.1
- **What to do:** pick exactly one — (a) flip the default for `claude-code`
  once `agents/evidence/analysis/installed-arrival-*.md` exists for the current
  host version and the step 2.2 fixture is green, or (b) keep the thinned layer
  opt-in and record in the ADR of step 3.3 that consumers choose it.
- **Resolved when:** an ADR names (a) or (b) **with the arrival record it relied
  on**. **Re-pointed 2026-10-12:** this clause used to name "the ADR of step
  3.3", and step 3.3 is now closed by ADR-284, which records the owner's (a) and
  its unmet condition without discharging either. A resolution clause whose named
  producer is closed can never fire, so the clause names the condition instead of
  a step. Two files can supply it today: a successor ADR here once
  `agents/evidence/analysis/installed-arrival-*.md` exists, or step 4.1 of
  `road-to-a-setup-that-decides-itself`, whose "One ADR" already supersedes
  ADR-267 decision 3, ADR-278 and this file's D3 — and whose Phase 5.3 is where
  the default now actually changes.
- **Recommendation:** (a) — every default install otherwise keeps tripping the
  host notice at 2.25 times its limit, and the opt-in records are the evidence
  the council asked for before an irreversible-looking change.
- **If you do nothing:** opted-in machines stand under the limit, every other
  install keeps loading 338,225 characters, and the notice keeps arriving as an
  inbox round.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:inbox-2026-10-c-standing-form | Opt-in first, default only after records | Both seats, 2/2, rejected a default flip before measurement | The opt-in records are not obtainable on any machine this repository observes |
| D2 | contested-technical | council:inbox-2026-10-c-standing-form | Target 65,000, hard 75,000 package-owned standing characters | Both seats; the host limit is shared with the user's own files | The host publishes a different limit or a per-file rule |
| D3 | reversible-technical | agent | The template value is not consent to thin | The template already says `delivery`; reading it would flip every consumer as a side effect of the resolver fix | — |
| D4 | product-owned | owner | Whether the default flips | Consumer-facing default change; blocker `default-flip-of-the-installed-layer` | — |
| D5 | product-owned | owner | the default flips for `claude-code` under option (a): once `agents/evidence/analysis/installed-arrival-*.md` exists for the current host version and the step 2.2 fixture is green, the thinned layer becomes the default; until then it stays opt-in | owner answer 2026-10-06 to blocker `default-flip-of-the-installed-layer`; no `installed-arrival-*.md` existed that day | an arrival record shows the thinned layer losing content a consumer relies on, or the host lifts or moves its limit |
| D6 | reversible-technical | agent | 3.2's ceiling stays a reported finding, not a hard CI gate, until the real total is reachable. **Amended 2026-10-12, on the council's Q1 finding that the original wording admitted two readings.** The intended reading is the NARROW one: D6 settles the mechanism it tested — a hard gate at 75,000 — and does not bar every hard gate forever. A different mechanism is not governed by it and may be proposed. What governs a different mechanism is D7 | `installed-layer-ceiling-measurement-2026-10-06.md`: a real opt-in install reads 111,197 chars, 48 % over the 75,000 hard target this step would enforce; a hard gate at that number would be red on `main` on landing, over a corpus (16 full-bodied kernel/path-only/trigger-less rules) this roadmap does not touch | the full-bodied set shrinks enough that 111,197 (or its current re-measurement) sits at or under 75,000 |
| D7 | reversible-technical | council:installed-layer-ceiling-mechanism-2026-10-12 | a ceiling over the installed layer may not rest on a STORED baseline, in any shape, until the measurement is environment-independent; the acceptable forms are a normalised total (every absolute-path occurrence stripped or substituted, with tests over differing root lengths) or a base-ref comparison that stores nothing and requires `head <= base` | the stub body pointer is absolute, so the total moves by 89 chars per char of package-root prefix (3,738 = 42 x 89 between two real readings), and a ratchet over a drifting number locks at the shortest path any runner ever had; `estate-count-budget.json` was deleted from this repository for exactly that failure. Reading degraded: 1 of 2 seats present, openai seat `os_error: ENOBUFS`. The seat's separate claim of a 4,139-char unexplained variance is WRONG — that figure is the stub-form change (111,197 -> 107,058) and reconciles; the structural half it does not touch is what this decision rests on | a normaliser exists and is shown environment-independent across at least two differing root lengths, or the base-ref form is built; either reopens 3.2 without reopening D6 |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A missed trigger leaves a pointer where a body was | product | Prompt-only reach is 305/335; after thinning a miss costs the rule's mechanics in that session. | The consequence class keeps its law standing; 2.3 counts self-served reads; the rollback stays one setting. | Phase 2 — Records from opted-in machines |
| 2 | The upgrade overwrites a consumer's edited rule | implementation | Converging an existing install rewrites files in place. | 1.3 preserves and reports user-modified files and fails its test if one is overwritten. | Phase 1 — An opt-in thinned install |
| 3 | The host stops honouring user-layer files the way 2.1 recorded | implementation | Host versions change load semantics without notice. | 2.1 is per host version, and 3.2's report names the host version it read. | Phase 3 — The default, decided |
| 4 | The 4.1 probe is taken once and read as a standing fact | implementation | One host build's reading of a namespace becomes a claim about the host. | 4.1 records the build it was taken against; 4.3 scopes the resulting check to that host by name and forbids generalising to others without their own measurement. | Phase 4 — The host that is delivered to and may not be reading it |
| 5 | Changing the delivery breaks an install that works today | product | If 4.1 shows the namespace is read after all, a well-meant relocation would move files a host currently finds. | 4.2 is conditional on 4.1's outcome and ships whichever side is wrong — the claim or the delivery. Nothing moves before the probe. | Phase 4 — The host that is delivered to and may not be reading it |

## Acceptance Criteria

- [ ] AC-1 — An opted-in install into an empty `HOME` stands under 75,000
      package-owned characters, read by the installed-layer report.
      **NOT MET, and deliberately NOT marked blocked, 2026-10-10.** The figure was
      measured on 2026-10-06 against a real opt-in install: **111,197** characters —
      89 thinned stubs (52,925) plus 16 rules `project_thin_rules` keeps full by its
      own predicate (58,272). Not re-measured today: an isolated-`HOME` install is the
      only honest way to read it and nothing in this change moves the corpus. Like 3.2,
      this waits on the full-bodied set shrinking rather than on the flip, so no marker
      is written — the gate it needs is not one this file registers.
- [ ] AC-2 — One committed arrival record per supported host version.
      **Measured 2026-10-10: zero records exist.** `ls agents/evidence/analysis/installed-arrival-*.md`
      matches nothing. Its producer is step 2.1, whose instrument the owner cancelled on
      2026-10-06 — see `arrival-record-needs-a-cancelled-observer`.
- [x] AC-3 — The standing-only fixture shows every consequence-class law loaded
      with the carrier off. Closed by step 2.2, re-verified 2026-10-06:
      `npx vitest run tests/scripts/install_thin_layer.test.ts -t standing-only`
      -> 0, both cases (byte-equal law; no law leaks into an out-of-class stub).
- [ ] <!-- blocked-by: default-flip-of-the-installed-layer | asked: no — the blocker is registered in this file, already answered (a) by the owner on 2026-10-06, and waits on the arrival record rather than on a new question --> AC-4 — The default changed only through the resolved blocker, and every
      non-Claude host tree is unchanged.
      **Second limb measured 2026-10-10 and already holds**: `check_host_tree_parity`
      exits 0 (2 non-delivery host trees byte-identical to eager-all). The first limb
      cannot be evaluated because no flip has happened, so the criterion waits on 3.1
      rather than on work of its own.

## Dated readings

> Added 2026-10-06 by `road-to-a-thinned-layer-measured-in-one-unit` step 3.3.
> It names the figure **AC-1** asks for and edits neither that criterion, nor
> its blocker, nor any decision of this roadmap. It sits in its own section
> rather than under AC-1 itself because the risk-register gate hashes the
> Acceptance Criteria body: a note placed inside it reads as a substantial
> change to the plan and demands a re-review that a same-day stamp cannot
> express.

**AC-1, measured 2026-10-06** — source:
`agents/evidence/analysis/thinned-layer-composition-2026-10.md`.

A real opted-in install into a fresh `HOME`, read by the installed-layer
report, with ownership resolving through the global deploy inventory because a
global-only install writes no project manifest:

| Reading | Before the stub form change | After |
|---|---|---|
| package-owned, all | 111,197 | 107,058 |
| unconditional | 97,496 | 93,357 |
| path-scoped | 13,701 | 13,701 |

Measured at a 139-character body-link prefix. Every figure moves by 89 per
character of package-root prefix, so at a 97-character root the later reading
is 103,320 / 89,619 / 13,701.

**AC-1 does not hold today, on either reading.** The page prices every
remaining move with who it is permitted by, and states what they add up to:

- **75,000, unconditional reading** — reachable, but only with every priced row
  taken, including one reserved to the owner (`legal-safety-floor`, whose law
  is already over this repository's hard law ceiling) and one behind the open
  install-layout blocker. Neither is the council's to take and neither is an
  agent's.
- **The headroom-adjusted 68,181** — not reachable at any realistic package-root
  prefix; the only combination that closes needs a prefix no path can have.
- **75,000, all-characters reading** — not reachable, by at least 6,315 even at
  that unreachable prefix.

An earlier version of this note said instead that "none of them, taken
together, reaches the ceiling". That was the pre-correction claim a
provider-diverse council recorded as materially false, and it was left standing
here after the page itself was fixed — on the surface an owner actually reads.
It is replaced rather than deleted so the correction is visible from this side
too.

**Re-screened 2026-10-16 at `main` @ `5fa963cec` — no open step is executable
here, and the layer grew rather than shrank.** Every open step was re-tested
against the tree instead of against its marker:

- **2.1, 2.3, 2.4 and AC-2** read the record of
  `road-to-a-setup-that-decides-itself` step 2.1, and that step is still `[ ]`
  together with its producers 1.1 and 1.2 (binding `InstructionsLoaded` and its
  negative controls). `agents/evidence/analysis/` still matches no
  `installed-arrival-*.md` and no `stub-use-*.md`, so every verify line greps
  an empty set.
- **3.1, 3.5 and AC-4** wait on that file's 5.3. `check_host_tree_parity` was
  re-run and exits 0 (`2 non-delivery host tree(s) byte-identical to eager-all
  · delivery hosts [claude-code]`); both limbs still hold, and the step still
  asks about a flip that has not happened.
- **3.2 and AC-1** were re-measured with this page's reproduce block (opt-in
  install into an empty `HOME`, `installed_layer_report`), at the same
  139-character body-link prefix as the 2026-10-06 "after" reading:

| Reading | 2026-10-06 (after) | 2026-10-16 | Delta |
|---|---|---|---|
| files | 105 | 106 | +1 |
| package-owned, all | 107,058 | 107,460 | +402 |
| unconditional | 93,357 | 93,759 | +402 |
| path-scoped | 13,701 | 13,701 | 0 |

  D6's revisit condition — the full-bodied set shrinking until the total sits at
  or under 75,000 — is further from firing than it was ten days ago, and D7's
  precondition (an environment-independent measurement) is still unbuilt. A
  ceiling at "measured plus 10 %, never above 75,000" would be red on `main` on
  landing, so 3.2 stays open for the reason already recorded under it.
