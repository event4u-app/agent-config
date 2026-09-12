---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  A shipped default whose own code comment contradicts it, plus the two consumer-visible gaps the
  flip opened. Verified 2026-09-11: `src/config/agent-settings.template.yml:212-214` ships
  `lean_projection.mode: delivery` for `claude-code`, `src/scripts/_lib/lean_projection_mode.ts:21`
  keeps `eager-all` as the parser fallback, and the docstring at `:18` still calls `eager-all`
  "the shipped default" — which is now false for the one host the template names. No active
  roadmap owns the projection surface. Also grows open_blockers by one.
estate_offset_exempt: >-
  No offset exists in the active estate. The two delivery roadmaps
  (`road-to-delivery-for-every-host`, `road-to-delivery-on-hook-hosts`) own host CARRIAGE — which
  slot fires where — and not projection MODE, which is what shipped and what the tree says about
  it; folding this into either would put a documentation correction inside a carriage-evidence
  plan and bury it. Archiving an unrelated roadmap would dispose of open work to buy a slot for a
  three-phase prose fix.
---
# Road to the delivery flip that tells the truth

> **Source:** `agents/tmp.old/inbox-2026-09-y/t3-cross-corpus-parity/` — a release-review series,
> sixteenth iteration, analysed 2026-09-11. Claim verification at HEAD: 30 of 38 claims still
> true, 4 overtaken by the 208-commit gap since its pin, **0 never true at drafting**. The
> zero is itself the finding — this source made no claim that was wrong when written.

## Goal

The tree's description of its own projection default matches what it ships, and the two
consumer-visible gaps the flip opened are closed or explicitly dispositioned: rules whose only
trigger is path-shaped no longer lose their bodies silently, and the standing-payload figure
stops measuring a corpus no user of the flipped host actually carries.

Three numbers, not one. A single "standing payload" figure conflates what the source tree could
deliver, what one host actually receives, and what activation charges at runtime — and after a
per-host flip those three diverge by construction. Reporting one of them as if it were all three
is how a saving gets published without its cost.

## Phase 1 — The comment that contradicts the config

- [x] **1.1 Rewrite the projection-mode docstring** so it distinguishes the template default —
      `delivery`, for the one host the template names — from the parser fallback, `eager-all`,
      which applies when no value resolves. Two sentences, one for each.
      verify: `grep -rn "eager-all is the shipped default" src/` returns nothing, and the
      docstring names both meanings separately.
      All three premises verified with `file:line` rather than inherited, and all three hold.
      **The distinction was not invented here — ADR-267 decision 4 already states it in as many
      words** ("the template is what a consumer is given, the constant is what happens when the
      value cannot be read"). The docstring simply never followed the ADR that authorised the flip,
      which makes this a two-month-old documentation lag rather than a design question.
- [x] **1.2 Reconcile every sibling assertion** elsewhere in the tree that names a shipped
      projection default.
      verify: `grep -rn "shipped default" src/ docs/ | grep -i projection` returns only
      statements consistent with the template.
      **Ten sites, not the three the roadmap named.** The false claim had propagated well past the
      docstring: `rule-router.md` carried it three times, including in its own *Read this first*
      section; `hook_manifest.yaml:870-874` was the stale twin of a paragraph already corrected in
      `rule_inject_hook.ts`; `check_rule_projection_integrity.ts` rested part of its stated
      rationale on it; and `settings-classes.md:477` listed the wrong value in a column that
      carries template values elsewhere. One further site — `rule-router.md:49-56` — claimed "there
      is no measured emission yet", refuted by the hook's own header, and now carries the measured
      distribution.
      Sites that were already correct (`schemas/agent-settings.schema.json`, `server/schemas/
      settings.ts`, `docs/settings-reference.md`) were left untouched.
- [x] **1.3 Touch comments only in this phase.** A behaviour change here is the rollback trigger.
      verify: the phase's diff contains no executable line — `git diff` shows comment and
      documentation hunks only.
      Verified independently: filtering the three `.ts` diffs to lines that are neither blank nor
      comment-opening returns **zero**. 156 changed lines inspected across six files.
      **One correction was refused on exactly this constraint and is reported instead.**
      `src/scripts/_lib/value_ladder.ts:477` emits "(default `eager-all` — hence NOT in the default
      NET)" into the generated `docs/value.md`. The statement is now false, but it sits on an
      **executable** template-literal line, so fixing it here would have broken 1.3. Left for a
      change that is allowed to touch code.

## Phase 2 — The path-trigger gap, enumerated and dispositioned

- [x] **2.1 Enumerate every rule carrying both a path trigger and a prompt-shaped trigger**
      (keyword, phrase, or command). Under a delivery-mode projection the path side fires through
      a slot the flipped host may not carry, while the prompt side still fires.
      verify: the enumeration is a table in `agents/evidence/analysis/`, with one row per rule and
      its trigger kinds named.
      `agents/evidence/analysis/path-trigger-disposition-table.md`. **Population 18**, read three
      independent ways that agree exactly: rule frontmatter (120 files), `dist/router.json` (105
      entries), and the projector's own output.
      **The fourth angle disagreed, and the disagreement is a finding about the tool rather than
      about the population.** `check_host_tree_parity` lists 17: `roadmap-progress-sync` is absent
      from the maintainer-scoped `.claude/rules/` tree it walks. Anyone using that gate's output as
      the enumeration would have been one rule short — which is exactly how a path-only rule goes
      unnoticed.
- [x] **2.2 Give each row one of three named dispositions** — keep it full-bodied with its byte
      cost stated, rebind the path side onto a slot that carries rule injection, or record that
      the prompt side is sufficient with a one-line reason.
      verify: every row carries exactly one disposition and none is blank.
      **7 / 9 / 2, none blank.** `keep full-bodied` totals **9,751 B measured**, not estimated —
      15.3 % of the 63,692 B of restorable bodies. The token share was deliberately *not* derived
      from the byte share.
      Every one of the 9 `prompt side sufficient` rows carries its own specific reason, and two
      lean on a deterministic CI backstop rather than on the prompt triggers alone
      (`lint_framework_leakage`, `lint_roadmap_ci_steps`). One names its residual out loud: a
      fourth adoption track would match no trigger. **No row proposes a trigger extension** — the
      council's condition 5 forbids converting a path trigger into a keyword, and every reason is
      a statement about triggers already written.
- [x] **2.3 No rule is left thinned with a path-only trigger.** A rule whose only trigger is
      path-shaped and whose body was reduced is unreachable on the flipped host.
      verify: the table has zero such rows, or each is named with its remediation.
      **Population 3, zero of them thinned — and both properties were checked separately rather
      than trusting the parity gate's own "kept full-bodied" message.** Path-only was established
      twice from sources the projector does not share; not-thinned by calling `build_thin` at full
      scope and testing with the projector's own `is_thin_entry` (10,689 / 3,752 / 9,075 B, all
      full). Structurally visible at `project_thin_rules.ts:352` — `full = kernel || noTrigger ||
      pathOnly` — so it is not a side effect of the diagnostic.
      Full run: 119 entries, 103 thinned, 16 full (9 kernel, 4 trigger-less, 3 path-only).
      **An honest bound on that zero:** it holds for the projector at this HEAD. Adding a single
      keyword to `ui-audit-gate` moves it into the mixed class and thins it correctly — so this is
      a measurement, not an invariant.

## Phase 3 — Split the payload metric into the three things it measures

- [x] **3.1 Report three labelled numbers** instead of one: source payload, delivered standing
      payload per host, and runtime activation payload.
      verify: the payload census prints all three with distinct labels, and no caller reads one as
      if it were another.
      `source_corpus` 138,360 tok/session · `host_payload` 24,537 tok/session on a thinned host
      (rules bucket 122,769 → 24,537, −80.0 %, like-for-like over the same 119 files) ·
      `activation_payload` p50 6,728 B / p90 14,016 B / max 16,297 B **per fire**.
      **Nothing is unmeasured, and the two denominators are never summed** — bytes-per-fire and
      tokens-per-session are different units, which is the conflation the step exists to end.
      Extended the existing census rather than starting a second one; ADR-270 had already given it
      two of the three as structurally separate fields and the third was simply missing. The
      sampler was *moved* into `_lib/activation_payload.ts`, not copied, so one implementation
      remains.
      Two bounds recorded rather than smoothed: `pre_compact` is 0 **by construction, not by
      measurement**, and `pre_tool_use` is measured but **not bound**, so its row prices a
      mechanism the shipped configuration does not fire.
- [x] **3.2 Leave the existing grace ceiling untouched.** It is the estate-growth ratchet and may
      only walk down; this phase adds reporting, never a second gate.
      verify: `git diff src/config/preamble-payload-budget.json` is empty.
      Both `git diff` and `git status --porcelain` return empty on that path. No gate was
      registered either: the activation reading never reaches an exit code, and a test pins that
      the gated total equals the source reading alone, so folding the fire distribution into it
      turns that test red. Its ceiling already lives in `hook-token-budget.json`; a second gate
      here would put one obligation behind two that can disagree.
- [x] **3.3 Publish the activation charge beside any published saving.** One line giving p50, p90
      and max per-fire payload against the standing reduction.
      verify: no saving figure appears in the settings reference without its activation charge in
      the same table.
      Published at `docs/settings-reference.md:182`, generated from the schema rather than
      hand-written. A pre-existing exact-BPE figure in the same file was tagged as such so it is
      not compared against the chars/4 pair. Of the two other rows publishing a saving, one gained
      an activation note whose per-fire distribution is **stated as unmeasured rather than
      estimated**; the other was left alone with its reason given — it fires nothing, and its
      saving is a third-party output-token claim rather than a standing-payload reduction.

## Blockers

### blocker: path-trigger-slot-rebind
- **Status:** resolved 2026-09-12 by council — rebind allowed, but only per verified tuple
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the rebind disposition in Phase 2.2 only. Enumerating and dispositioning proceed
  without it; only the act of moving a trigger onto a different slot is held.
- **What to do:** decide whether a path trigger may be rebound onto a slot that carries rule
  injection. That is a delivery-surface change and it needs the host-carriage evidence the two
  active delivery roadmaps own — run `agent-config hooks:status` to see which slots are bound on
  the host in front of you before assuming any of them is available.
- **Recommendation:** hold the rebind and let Phase 2 finish with the other two dispositions. The
  enumeration is the valuable half and it is unblocked; rebinding without carriage evidence would
  move a trigger onto a slot that may not fire, which is the same defect one layer over.
- **If you do nothing:** Phase 2 completes with rules dispositioned as full-bodied or
  prompt-sufficient, and the rebind rows stay named and open. That is a usable outcome.
- **Resolved when:** either the carriage evidence exists and the rebind is authorised, or the
  table records the rebind rows as deferred with a pointer to the roadmap that owns the evidence.
- **Resolution:** **authorised, conditionally** — and the council rejected *both* options this
  blocker offered. Two seats, quorum concluded, converged 2/2 on a third: rebind is permitted, but
  only for a verified tuple of `host × tier/version × install mode × target slot × required
  semantics`. Everything else is deferred or takes a safe fallback.
  Five conditions, all binding on Phase 2.2:
  1. **`hooks:status` is NOT sufficient evidence.** It proves a slot is *bound*, never that
     anything is injected or honoured. This repository already carries the failure it would miss —
     a concern that dispatches on a host which discards the verdict.
  2. **Negative controls are required**, not only a positive test: a sentinel observable through
     the target slot during a real host invocation, *absent* when the binding is disabled, and —
     where enforcement is claimed — a rejecting sentinel that actually blocks.
  3. **Context carriage and verdict enforcement are separate capabilities.** An advisory rule needs
     proven injection; a hard gate additionally needs the host to honour the result. Conflating
     them is how "appears delivered" happens.
  4. **A deferred row carries a falsifiable revisit condition**, never a roadmap pointer. Both
     seats independently noted that "deferred with a pointer" has already become the indefinite
     state in this estate.
  5. **Prompt-conversion is not a general substitute.** One seat proposed it as the preferred fix;
     the other's rebuttal held and is adopted — touching a migration file without naming it would
     not activate the rule, and the keyword over-activates on unrelated discussion. That is trigger
     expansion, not carriage-independent preservation.
  Both seats also held that the enumeration must come first, because a disposition cannot be
  chosen before the population is known. Phase 2.1 is that enumeration and was unblocked anyway.
- **Note:** owner-classified Class 3, routed to the council under this run's standing delegation
  and recorded rather than silently reclassified. The blocker's own recommendation — hold the
  rebind entirely — was considered and rejected as the weaker of the two it offered.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 quietly undoes the flip | product | Restoring rules to full-bodied is the easiest disposition, and doing it across the table would reverse the saving the flip bought while looking like remediation | Full-bodied is permitted only as a named disposition with its byte cost stated in the row, so the aggregate cost of choosing it is visible in the table itself | Phase 2 — The path-trigger gap, enumerated and dispositioned |
| 2 | The three-number split becomes a third ratchet | implementation | A new metric attracts a gate, and a gate nobody acts on is a suppression target | Phase 3 adds reporting only; Phase 3.2 asserts the existing ceiling is untouched, and the diff proves it | Phase 3 — Split the payload metric into the three things it measures |
| 3 | The docstring rewrite is read as a behaviour change | implementation | A comment edit inside a mode resolver looks like a default change to a reviewer skimming the diff | Phase 1.3 makes comment-only the acceptance criterion and names a behaviour change as the rollback trigger | Phase 1 — The comment that contradicts the config |
| 4 | The enumeration goes stale before it is dispositioned | product | Rules are added and their triggers change while the table sits half-filled | The table lives in the evidence tree with its measurement date, and Phase 2.3's criterion is checkable against the live rule set rather than against the table | Phase 2 — The path-trigger gap, enumerated and dispositioned |

## Acceptance Criteria

- [x] AC-1 — No statement in the tree calls the parser fallback the shipped default, and the
      template default and the fallback are described separately.
      `grep -rn "eager-all is the shipped default" src/` returns nothing. Ten sites reconciled,
      not the three the roadmap named. The distinction itself comes from ADR-267 decision 4, which
      predates this roadmap by two months — the docstring never followed the ADR that authorised
      the flip.
- [x] AC-2 — Every rule carrying both a path trigger and a prompt-shaped trigger has exactly one
      named disposition, and none is blank.
      18 rules, 7 / 9 / 2, none blank. The population was read three independent ways that agree;
      a fourth source, `check_host_tree_parity`, reports 17 because one rule is absent from the
      maintainer-scoped tree it walks — recorded as a finding about that gate.
- [x] AC-3 — No rule remains whose only trigger is path-shaped while its body has been thinned.
      Population 3, zero thinned. Both properties checked separately from sources the projector
      does not share, rather than trusting the parity gate's own "kept full-bodied" message.
      **Bounded honestly: this is a measurement at this HEAD, not an invariant** — one added
      keyword moves a rule into the mixed class and thins it correctly.
- [x] AC-4 — The payload census reports source, per-host delivered, and runtime activation as
      three labelled numbers.
      138,360 tok/session · 24,537 tok/session · p50 6,728 / p90 14,016 / max 16,297 B per fire.
      One census, extended; the sampler moved rather than copied so one implementation remains.
- [x] AC-5 — The existing payload grace ceiling is unchanged by this roadmap.
      `git diff` and `git status --porcelain` both empty on that path, and no new gate registered.
- [x] AC-6 — No published saving figure stands without its activation charge in the same table.
      Met at `docs/settings-reference.md:182`, generated from the schema. One further row's
      activation charge is published as **unmeasured**, stated rather than estimated; one row was
      deliberately left out with its reason.
- [x] AC-7 — Phase 1 changed no executable line.
      Verified by filtering the three `.ts` diffs: zero non-comment lines over 156 changed lines.
      **The constraint bit, and the refusal is recorded rather than quietly waived** —
      `value_ladder.ts:477` emits a now-false parenthetical into a generated doc, sits on an
      executable line, and was left for a change permitted to touch code. Phase 3 re-confirmed it
      independently and also left it.

**A number this roadmap carried forward was itself stale, and Phase 3 caught it.** The deferral
condition written in Phase 2 quoted a p90 of 16,188 B from `hook-token-budget.json:40`. That is the
pre-lowering figure, measured when the cap was 20,480 — its own recorded `max` of 20,406 B gives it
away — and the cap moved to 16,384 on 2026-09-08. Re-measured: **p90 14,016 B, max 16,297 B**; the
verdict is unchanged at 6.8× rather than 7.9×. The figure was wrong because it was copied forward
from a registered note instead of re-derived, which is the exact failure this roadmap was written
to correct. Corrected in the evidence table rather than left standing on the grounds that the
conclusion survived it.

**A third figure exists and disagrees with both, and is deliberately not edited.** The `rule-inject`
budget row records p90 14,507 / max 16,348 over **330** fires "with the command path included" —
a different denominator rather than a wrong number, which is the same conflation this roadmap
addresses, one layer down. It is a registered budget derivation with an owner, so it is reported
here and left to that owner.
