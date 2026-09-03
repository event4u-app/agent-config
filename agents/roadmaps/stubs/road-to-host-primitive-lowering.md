---
complexity: lightweight
review_by: 2026-12-03
---

# Stub: road to host-primitive lowering

> **Stub — not active work.** Transferred here by the 2026-09-a inbox round from
> `agents/tmp.old/inbox-2026-09-a/s04/` and `.../s12/`. It is a stub rather than
> a ready roadmap because its first step is a per-skill judgement across 31
> files with no automated discriminator, and because a wrong lowering silently
> narrows what a skill may do.

## What moved here

The residue of a thesis that was otherwise entirely overtaken: *this package
simulates in prose what the host now offers as deterministic frontmatter.*
Roughly 85 % of the source unit is already shipped or parked with a named owner.
Three items are verified-open and held by nothing.

### 1. The emitter drops AC's own tool scoping

Verified against `c6b4f6407`:

- host-spelling `allowed-tools` in `src/skills/*/SKILL.md`: **0**
- host-spelling `allowed-tools` in the emitted `.claude/skills/*/SKILL.md`: **0**
- skills carrying AC-internal `execution.allowed_tools`: **31**, of which roughly
  four are non-empty

The emitter passes `execution.allowed_tools` through verbatim as a nested block
the host does not read. So the declaration is not merely unused — it is written
into a field that enforces nothing, while `lint_skill_frontmatter_safety.ts`
already reads the *host* spelling. A reader can reasonably believe a scope is
enforced when it is inert.

The source unit reported this as "1 of 299 use `allowed-tools`". The real number
is 0, and the correction strengthens rather than weakens the finding.

### 2. `ci_settle` has no background form

`ci_settle.ts:26-46` now defaults to a nine-minute foreground ceiling and
`:155-162` refuses a longer `--timeout-min` **while pointing at background
execution** — which does not exist as a flag. `grep -rn run_in_background src`
returns nothing. The refusal names a remedy the tree does not provide.

### 3. `context-hygiene.md:89` pins the deprecated form

The rule tells the reader to use `ci_settle <pr>` rather than a hand-written
loop. That is still right, and it names no background form, so the rule pins the
shape the script has since capped by default.

## Why this is a stub and not a roadmap

Item 1 is the substantial one and it is **not** a mechanical migration. Each of
the 31 declarations is either a lowering candidate or a deliberately
host-neutral statement, and the difference is a judgement about what the skill
is for. The tree already carries the precedent for the second case:
`src/subagents/production-validator.md` leaves `Bash` unscoped **with a written
reason**. A batch lowering with no per-skill reason would replace an inert
declaration with an enforced one that may be wrong.

Items 2 and 3 are small and could ride with any roadmap touching the waiter
path; they are recorded here so they are not rediscovered a fourth time.

## Promotion criterion

Promote when **either** holds:

- a maintainer decides that the 31 declarations should be adjudicated, and is
  willing to spend the per-skill judgement; **or**
- one of the 31 inert declarations is found to have misled a reader in a real
  run — which converts the item from tidiness into a defect with a witness.

## What this stub does NOT hold

- The subagent-schema extension (`skills`, `maxTurns`, `disallowedTools`,
  `isolation`, `background`). `additionalProperties: false` is deliberate and
  changing it is an ADR-109 amendment, not a lowering. `memory` stays out per
  ADR-094.
- An `enforced_by: host-frontmatter` vocabulary value. It is the natural
  follow-on to item 1 and it is a contract change to a field 39 rules already
  declare; it belongs to whoever adjudicates the 31, not to this stub.
- Everything else from the source unit: waves covering payload economy, command
  surface, requirements traceability, review independence, runtime doctrine and
  install ownership are all shipped or parked, and the source's own kill register
  correctly rejects an ecosystem registry, a tmux worker runtime, an
  external-executor SPI, a workflow IR and vector memory.
