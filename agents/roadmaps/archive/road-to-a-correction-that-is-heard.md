---
complexity: lightweight
status: ready
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Pulled active by the owner's own invocation (/analyze:inbox inbox-2026-10-bi, then /roadmap:process-full in the same run) -- the one exception the WIP-5 directive names. Owner search (grep -rlF for self_repair COMPLAINT_PATTERNS, recurring-criticism triggers, agents-md-anatomy, lint_agents_md over agents/roadmaps, later, stubs) found no owner of the detector vocabulary, the @AGENTS.md stub or the consumer lint target. Closed and archived in the same PR, so the active estate returns to its floor."
relates:
  - slug: road-to-a-noted-that-is-a-write
    relation: extends
    note: "Parked sibling in later/: the owner-gated half of the same source (persistence-claim detector, write paths in the turn snapshot, shadow detector, the project-edit consent question)."
---
# Road to a correction that is heard

> **Source:** `agents/tmp.old/inbox-2026-10-bi/` (topic T1, correction durability).
> Claims verified at `58d43073b7`; the source was drafted against an older trunk.

## Goal

A user who repeats a correction ("for the third time: tabs!") is recognised by
the self-repair detector in both languages the inbox is written in, the rule
that names the trigger phrases and the detector cannot drift apart silently,
the record carries what the correction was about, and the instruction-file
surface tells the truth about how Claude Code reaches `AGENTS.md`. Measured at
the pin: 8 of the 10 trigger phrases `recurring-criticism.md` lists do not fire
`detectUserReport`, and the canonical "Zum dritten Mal: Tabs!" misses.

## Phase 1 — The detector hears the repeat

- [x] **1.1 Extend `COMPLAINT_PATTERNS` with ordinal and repeat markers.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/self_repair.ts -->
      `src/scripts/_lib/self_repair.ts`: an ordinal marker followed by
      punctuation (`zum zweiten…fünften Mal` / `for the second…fifth time`), `wie oft noch`,
      bare `how many times`, `as I mentioned/said before|earlier`,
      `told you this|that`, `immer noch nicht`; `schon wieder` fires only with a
      second-person clause near it, so "schon wieder Montag" stays silent.
      verify: `tests/fixtures/self-repair-detector-corpus.yml` gains the fire
      rows "Claude. Zum dritten Mal: Wir nutzen Tabs!" and "For the third time:
      we use tabs!" and the must-not-fire rows "Wir haben zum dritten Mal
      gewonnen" and "schon wieder Montag"; the corpus test is red before the
      pattern change and green after.
- [x] **1.2 Pin the rule's trigger vocabulary to the detector.** New <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      `tests/scripts/recurring_criticism_trigger_drift.test.ts` parses the
      trigger list of `src/rules/recurring-criticism.md` and asserts each phrase,
      embedded in a complaint sentence, fires `detectUserReport` — or sits in an
      in-test allowlist with a reason.
      verify: red at the pin (8 of 10 miss), green after 1.1.
- [x] **1.3 Record what the correction was about.** Optional `subject` on the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/self_repair.ts -->
      user-report finding: the backticked token, else the clause after the
      recurrence marker's colon; lower-cased, sanitized, capped at 40 chars.
      Local-only like `mechanism` — excluded from the fingerprint and from every
      upstream renderer, so the privacy clause of `self-repair-loop` holds.
      verify: a test where three phrasings about tabs yield `subject: "tabs"`,
      and a test that the upstream issue body carries no `subject`.

## Phase 2 — The instruction-file surface tells the truth

- [x] **2.1 The CLAUDE.md stub imports `AGENTS.md`.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `src/agent-src/contexts/contracts/agents-md-anatomy.md` documents the
      Claude stub as `@AGENTS.md` (a link sentence is opened only at the
      agent's discretion); `src/domains/meta/agents/init/command.md` stops
      claiming Claude Code reads `AGENTS.md` unconditionally.
      verify: a test asserting the anatomy's Claude stub contains `@AGENTS.md`
      and the init command names the import or symlink.
- [x] **2.2 `lint_agents_md --target <file>` lints a consumer file.** Today the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_agents_md.ts -->
      linter resolves its targets from its own location, so `/agents audit`
      step 4 can only ever lint the package. `--target` lints the named file
      with the template thresholds; the audit command uses it.
      verify: a test running `--target` on a fixture reports the fixture, not
      the package root.
- [x] **2.3 Skill text routes a convention to its strongest carrier.** <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      `learning-to-rule-or-skill` gains a "config / check (consumer
      convention): propose as a diff" row above Rule; `standards-from-config`
      names instruction-file prose as a conflict source and says that a repeat
      that contradicts the config is asked, never capitulated to.
      verify: `lint-skills` green on both skills.

## Decisions

| # | Question | Verdict |
|---|---|---|
| C1 | Is 1.2's verify falsifiable? | Yes — the test is red at the pin (8 of 10 phrases miss) and must turn green after 1.1. |
| C2 | Does "ask, never capitulate" contradict "route to the strongest carrier"? | No — the carrier is proposed; a repeat that contradicts the project's config is asked about, never silently adopted. |
| C3 | Fire or allowlist (AC-1)? | Fire is the default; an allowlist row needs a reason a reviewer can check (e.g. a phrase that is a question, not a complaint). |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Detector false positives | implementation | Broader patterns queue ordinary prompts ("zum dritten Mal gewonnen") as defects and flood the self-repair queue | Must-not-fire corpus rows land in the same step; the ordinal pattern requires trailing punctuation and `schon wieder` a second-person clause | Phase 1 — The detector hears the repeat |
| 2 | Subject leaks prompt text upstream | implementation | A free-text subject is exactly the field the privacy floor forbids on a published record | Local-only, excluded from fingerprint and renderers, asserted by a test | Phase 1 — The detector hears the repeat |

## Acceptance Criteria

- [x] AC-1 — Every trigger phrase `recurring-criticism` lists either fires the
      detector or is allowlisted with a stated reason, enforced by a test.
- [x] AC-2 — The canonical repeat "Zum dritten Mal: Tabs!" produces a record
      whose local subject reads `tabs`, and nothing about the subject leaves
      the machine.
- [x] AC-3 — The documented Claude stub imports `AGENTS.md`, and `/agents audit`
      can lint the consumer's own file.
