---
adr: 228
status: accepted
date: 2026-08-13
decision: global-install-does-not-emit-paths
supersedes: —
superseded_by: —
phase: road-to-inbox-harvest-2026-08-b-release-integrity
type: structural
review_trigger: >-
  Revisit when either (a) the host begins re-injecting path-scoped rules after
  `/compact`, which removes the correctness objection this record rests on and
  turns the 24 into a pure delivery win, or (b) the diverging set stops being
  dominated by safety-floor and Iron-Law rules — i.e. a re-run of
  `report_carrier_divergence` shows the `paths:` disagreements confined to
  rules whose obligations do not need to survive compaction, at which point
  emitting for that subset is a different and much cheaper decision than the
  one rejected here. Neither trigger is a date: both are observable by re-running
  the report and re-reading the host's compaction contract.
---

# ADR-228 — The global install does not emit `paths:`; the 24 scope disagreements stay as over-delivery

## Status

**Accepted** · 2026-08-13. Resolves `carrier-install-paths-decision`, the blocker
recorded in `road-to-inbox-harvest-2026-08-b-release-integrity` that had held
that roadmap unarchivable at 12/12 steps done.

## Context

Two writers produce Claude Code rule trees and they do not agree on frontmatter.

The **project** carrier goes through `_emit_claude_rule`
(`src/scripts/condense.ts:1508`, called at `:1229`), which emits `paths:` where a
rule is path-scoped and nothing otherwise — the plan comes from
`_claude_paths_plan` (`:1466`), which deliberately returns an empty list for
`alwaysApply` and kernel rules.

The **global** carrier copies `dist/agent-src/rules` verbatim
(`GLOBAL_DEPLOY_SOURCES['claude-code']`, `src/scripts/install.ts:1916`, copied at
`:3205`). `install.ts` contains **zero** references to `_emit_claude_rule`
(verified by grep; the only call sites tree-wide are `condense.ts:1229` and a
test), so the global tree carries agent-config's own vocabulary — `type`, `tier`,
`triggers` — none of which this host reads.

`report_carrier_divergence`, re-run on this machine at `26bd1463f`:

```
  shared rule names                    109
    byte-identical                     0
    differ ONLY in frontmatter         109
      of which disagree on `paths:`    24  ← ACTIONABLE
    differ in PROSE                    0
```

Zero prose divergence, so no rule's governed text differs between carriers. What
differs is **when** 24 rules load: on a machine carrying both layers, the global
copy lacking `paths:` defeats the project copy's scoping, and a rule a maintainer
deliberately scoped is delivered unconditionally.

Direction matters and is stated once: the defect is **over**-delivery. No
obligation is missing on any machine; 24 arrive more often than their author
intended.

### What changed the question on 2026-08-13

The blocker as written says the fix "lives in `road-to-carrier-layer-convergence`
Phase 3". Two records accepted the same day make that false in both directions:

- [`ADR-226`](ADR-226-package-repo-keeps-both-rule-layers.md) **declines** Phase
  3's remedy for this repository — `--layer` suppression buys tokens by dropping
  `source-of-truth.md`, the one rule only the project layer carries. So layer
  suppression is a consumer remedy and cannot be this repo's answer to the 24.
- [`ADR-227`](ADR-227-paths-scoping-is-saturated-not-a-corpus-lever.md) confirms
  `paths:` is host-read and non-inert, and records from a probed fixture that
  **path-scoped rules are not re-injected after `/compact`** (`:79-80`).

Together they leave install-time emission as the only remaining lever on the 24 —
which is why this record decides it rather than deferring again.

## Decision

**The global install continues to copy `dist/agent-src/rules` verbatim and does
not emit `paths:`. The 24 scope disagreements are accepted as over-delivery.**

The reason is not cost and not the two-writers problem. It is correctness, and it
is the same objection ADR-227 used to reject bulk conversion — applied to the set
that actually diverges.

**The diverging 24, listed because the decision turns on their identity and not
on their count:**

```
augment-edit-discipline · design-fidelity · design-review-after-ui-write
doc-screenshot-hygiene · domain-adoption-policy
framework-neutrality-in-generic-skills · image-likeness-and-rights
laravel-translations · lethal-trifecta-guard · linked-projects-onboarding-gate
low-impact-corpus-privacy-floor · markdown-safe-codeblocks
no-roadmap-references · onboarding-gate · persona-governance · php-coding
provider-lifecycle-discipline · roadmap-ci-steps-policy · roadmap-progress-sync
rule-type-governance · settings-ask-protocol · skill-quality
source-confidentiality · ui-audit-gate
```

At least six are safety or governance floors carrying an Iron Law — verified by
grep, one `Iron Law` heading each in `lethal-trifecta-guard`,
`low-impact-corpus-privacy-floor`, `source-confidentiality`, `ui-audit-gate`, plus
`doc-screenshot-hygiene` and `image-likeness-and-rights` on the media surface, and
`roadmap-progress-sync` carries three.

Emitting `paths:` for that set on the global carrier would mean those obligations
**stop applying after `/compact`** on every machine — which is precisely the shape
ADR-227 rejected in its own § Alternatives: *"an Iron-Law obligation that silently
stops applying after `/compact`"*. Scoping them at the global layer would trade a
known, safe over-delivery for a silent under-delivery in exactly the rules where
silence is most expensive.

**The corollary, so this is not read as "the divergence is fine":** the report is
right that the 24 are actionable, and the action this record chooses is to fix the
*claim*, not the delivery. A rule scoped at project level and unscoped globally is
not a maintainer's intent being defeated by an installer bug; it is two carriers
with different compaction guarantees, and the project-level scoping is the one
that gives something up.

## Consequences

- `install.ts` is unchanged. No consumer-visible install behaviour changes on any
  machine, and no installed base is touched.
- `report_carrier_divergence` will keep reporting 24 as ACTIONABLE. That is now a
  **recorded acceptance rather than an open finding**, and this ADR is the answer
  a reader should reach; the report's own tail already says the reading is
  transient and must be re-run rather than cited.
- `check_standing_rule_delivery` stays red on dual-carrier machines
  (196,959 / 110,000 at ADR-227's measurement). This record does not improve it
  and does not claim to — the 24 were never going to be the lever there, since
  scoping them removes them from *some* sessions, not from the corpus.
- Nothing is enforced by CI. There is no gate that could distinguish "decided to
  over-deliver" from "forgot to scope", and inventing one would be the
  satisfiable-by-assertion shape [`ADR-221`](ADR-221-host-native-first-ladder.md)
  § Alternatives rejects.
- The second half of the blocker's `Resolved when` is discharged by a citation
  added to `road-to-carrier-layer-convergence` § Non-goals, where that roadmap
  already declines to decide this.

## Alternatives considered

- **Emit `paths:` at global install by wiring `_emit_claude_rule` (or a Claude arm
  on `src/install/emit_host_rules_cli.ts`) into the global rules copy.** Rejected
  on the compaction argument above. Secondary cost, recorded because it would have
  been the reason absent the first: two emitters would have to stay in agreement,
  which is the keep-in-sync artefact this tree refuses elsewhere. Note that
  `emit_host_rules_cli.ts` already establishes the precedent for install-time
  emission — but only for Cursor and Windsurf, and only into consumer project
  directories, never `~/.claude/rules`.
- **Emit for the non-safety subset only.** Not rejected on merit — it is the
  option the review trigger above pre-registers. It is not taken *now* because it
  requires a per-rule compaction-survival judgement across 24 rules, which is a
  different unit of work than the yes/no this blocker asked for, and doing it
  badly produces exactly the silent under-delivery the main decision avoids.
- **Declare the question not decidable and park the roadmap in `later/`.** This
  was available (`road-to-local-only-gate-reds`'s blocker menu offers it) and is
  rejected: the question *is* decidable, the two ADRs accepted the same day supply
  the missing premise, and parking it would have held a 12/12 roadmap unarchived
  on a question that had an answer.

## References

- `src/scripts/condense.ts:1466-1530` — `_claude_paths_plan` / `_emit_claude_rule`, the project-side emitter.
- `src/scripts/install.ts:1909-1916, 3205-3211` — the global verbatim copy.
- `src/scripts/report_carrier_divergence.ts` — the measurement and its transience caveat.
- [`ADR-226`](ADR-226-package-repo-keeps-both-rule-layers.md) — why layer suppression is not this repo's remedy.
- [`ADR-227`](ADR-227-paths-scoping-is-saturated-not-a-corpus-lever.md) — `paths:` is host-read; path-scoped rules are not re-injected after `/compact`.
- [`ADR-221`](ADR-221-host-native-first-ladder.md) — the ordering this decision follows in choosing not to add a second package-side writer.
