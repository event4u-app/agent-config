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

- [ ] **1.1 Rewrite the projection-mode docstring** so it distinguishes the template default —
      `delivery`, for the one host the template names — from the parser fallback, `eager-all`,
      which applies when no value resolves. Two sentences, one for each.
      verify: `grep -rn "eager-all is the shipped default" src/` returns nothing, and the
      docstring names both meanings separately.
- [ ] **1.2 Reconcile every sibling assertion** elsewhere in the tree that names a shipped
      projection default.
      verify: `grep -rn "shipped default" src/ docs/ | grep -i projection` returns only
      statements consistent with the template.
- [ ] **1.3 Touch comments only in this phase.** A behaviour change here is the rollback trigger.
      verify: the phase's diff contains no executable line — `git diff` shows comment and
      documentation hunks only.

## Phase 2 — The path-trigger gap, enumerated and dispositioned

- [ ] **2.1 Enumerate every rule carrying both a path trigger and a prompt-shaped trigger**
      (keyword, phrase, or command). Under a delivery-mode projection the path side fires through
      a slot the flipped host may not carry, while the prompt side still fires.
      verify: the enumeration is a table in `agents/evidence/analysis/`, with one row per rule and
      its trigger kinds named.
- [ ] **2.2 Give each row one of three named dispositions** — keep it full-bodied with its byte
      cost stated, rebind the path side onto a slot that carries rule injection, or record that
      the prompt side is sufficient with a one-line reason.
      verify: every row carries exactly one disposition and none is blank.
- [ ] **2.3 No rule is left thinned with a path-only trigger.** A rule whose only trigger is
      path-shaped and whose body was reduced is unreachable on the flipped host.
      verify: the table has zero such rows, or each is named with its remediation.

## Phase 3 — Split the payload metric into the three things it measures

- [ ] **3.1 Report three labelled numbers** instead of one: source payload, delivered standing
      payload per host, and runtime activation payload.
      verify: the payload census prints all three with distinct labels, and no caller reads one as
      if it were another.
- [ ] **3.2 Leave the existing grace ceiling untouched.** It is the estate-growth ratchet and may
      only walk down; this phase adds reporting, never a second gate.
      verify: `git diff src/config/preamble-payload-budget.json` is empty.
- [ ] **3.3 Publish the activation charge beside any published saving.** One line giving p50, p90
      and max per-fire payload against the standing reduction.
      verify: no saving figure appears in the settings reference without its activation charge in
      the same table.

## Blockers

### blocker: path-trigger-slot-rebind
- **Status:** open
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 quietly undoes the flip | product | Restoring rules to full-bodied is the easiest disposition, and doing it across the table would reverse the saving the flip bought while looking like remediation | Full-bodied is permitted only as a named disposition with its byte cost stated in the row, so the aggregate cost of choosing it is visible in the table itself | Phase 2 — The path-trigger gap, enumerated and dispositioned |
| 2 | The three-number split becomes a third ratchet | implementation | A new metric attracts a gate, and a gate nobody acts on is a suppression target | Phase 3 adds reporting only; Phase 3.2 asserts the existing ceiling is untouched, and the diff proves it | Phase 3 — Split the payload metric into the three things it measures |
| 3 | The docstring rewrite is read as a behaviour change | implementation | A comment edit inside a mode resolver looks like a default change to a reviewer skimming the diff | Phase 1.3 makes comment-only the acceptance criterion and names a behaviour change as the rollback trigger | Phase 1 — The comment that contradicts the config |
| 4 | The enumeration goes stale before it is dispositioned | product | Rules are added and their triggers change while the table sits half-filled | The table lives in the evidence tree with its measurement date, and Phase 2.3's criterion is checkable against the live rule set rather than against the table | Phase 2 — The path-trigger gap, enumerated and dispositioned |

## Acceptance Criteria

- [ ] AC-1 — No statement in the tree calls the parser fallback the shipped default, and the
      template default and the fallback are described separately.
- [ ] AC-2 — Every rule carrying both a path trigger and a prompt-shaped trigger has exactly one
      named disposition, and none is blank.
- [ ] AC-3 — No rule remains whose only trigger is path-shaped while its body has been thinned.
- [ ] AC-4 — The payload census reports source, per-host delivered, and runtime activation as
      three labelled numbers.
- [ ] AC-5 — The existing payload grace ceiling is unchanged by this roadmap.
- [ ] AC-6 — No published saving figure stands without its activation charge in the same table.
- [ ] AC-7 — Phase 1 changed no executable line.
