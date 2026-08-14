# The settings deletion queue — standing work, deliberately not a roadmap step

Durable home for the `derivable` settings queue: the template leaves whose
answer the situation already carries, and which should therefore stop being
keys. It lives here rather than inside a roadmap because it is **standing
work** — a queue that is drained one row at a time, indefinitely — and a
roadmap is the wrong container for that shape.

**The direction, in the maintainer's words (2026-08-12):** *"das package soll
immer weniger settings erhalten, bis es bald keine mehr gibt."*
<!-- md-language-check: ignore -->

It does not promise zero. A settings surface has a floor: a value nothing in
the environment can derive — the user's name, the user's chosen language — is
not a flag, it is an input. The target is every key that encodes a decision the
situation already answers, which is a strictly smaller and fully checkable set.

## Why this is not a roadmap step

Recorded 2026-08-14 on an outside opinion (1 seat, 2 rounds; the second seat
failed to start, so a single-model judgement admitted on its checkable merit
and **not** a convergence). Three reasons, in ascending order of how much they
matter:

1. **The step admitted it itself.** Its own text called the work "a DELETION
   QUEUE, not 83 deletions" — an artifact stating that it is the wrong kind of
   artifact.
2. **It made the dashboard unreadable.** A step that cannot close mixes standing
   work into a completion percentage, and every reader learns to discount the
   number. That defeats the point of tracking progress at all.
3. **It created a perverse incentive, and this is the one that decided it.**
   Draining a row moves the count from 83 to 82 and closes nothing — so under a
   completion percentage, doing the work moves the number the *wrong way*. An
   artifact that penalises progress on its own subject will not be drained.

## The mechanism already exists — the queue is CI-carried, not prose-carried

The queue is not a list somebody has to remember to update. It is a ratchet:

- **`lint_settings_classes:derivable-surface`** in
  `src/config/gate-violation-baselines.json` pins the count. It is
  **shrink-only**: a new key classified `derivable` raises the number and reds,
  so a key whose answer the situation already carries cannot be added at all.
  That anti-regrowth half is what makes the direction enforceable rather than
  aspirational.
- **The 56-day non-stagnation clause** is the other half, and it is wanted here
  rather than tolerated: a queue that never drains is a stated direction nobody
  is walking.
- **`lint_settings_classes`** rejects a bare `derivable` label — each row must
  name the replacement that would decide instead. That is what stops the class
  from becoming a synonym for "inconvenient to keep".
- **`REMOVED_KEYS`** in `src/scripts/_lib/agent_settings.ts` makes the deletion
  itself a solved mechanical problem: a deleted key is ignored with one stderr
  warning per process, the exit code never changes, and an older install keeps
  booting.

Re-derive the current numbers with `task lint-settings-classes` rather than
trusting any figure written down here or anywhere else.

## The ordering rule — mechanism first, key second

**A key deleted ahead of its mechanism is a silently-changed default, not a
simplification.** For every `derivable` row whose replacement does not yet
exist, write the replacement first; the deletion commit must be later than its
mechanism's commit.

The batch already drained honoured this by construction: it was precisely the
subset that needs **no** replacement mechanism — six keys with no reader
whatsoever. An unread key is the only deletion that cannot silently change a
default, which is why that batch went first.

## Scouted next drains (2026-08-13) — ranked, so the next run does not re-search

**The method matters more than the ranking.** Run an un-dotted last-segment grep
*on top of* the dotted-path grep: several keys are read via a YAML parse that
never mentions the dotted form (`subagents.downshift` looks unread by dotted
path and is read by `hooks/delegation_nudge_hook.ts`). Every candidate below
survived that check.

- **`project.pr_template`** — zero CODE readers, and the cheapest drain
  available. **Not "zero readers of any kind"**: the authored template at
  `src/agent-src/templates/agent-settings.md` carries a directive row — *"Path
  to PR template file. Read this instead of searching for it."* — which is a
  **model-carried reader**, not a description of a default. That file is
  authored rather than generated and is a surface the enumeration below does not
  otherwise name. The distinction is the same one that applies to
  `commands.create_pr.*`; applying it unevenly is how a "free" drain turns into
  a silent behaviour change.
- **`commands.create_pr.{detail_level,api_examples,ui_paths,api_paths}`** — four
  rows in one drain, zero CODE readers; five prose files describe them as
  defaults without gating on them.
- **`reasoning.*`** — eleven rows, the largest single drain available, and
  **not** a free one: `contexts/execution/rdp-gate.md` signal 1 reads the block,
  so the gate's first signal has to be rewritten before the keys go. That
  rewrite **is** the mechanism-first ordering above, which makes this the honest
  test case rather than the cheap one.

## Downstream surfaces a single-key drain touches

Seven, plus one conditional. Missing any of them is how a drain half-lands:

1. `src/config/agent-settings.template.yml`
2. `src/server/schemas/settings.ts`
3. `docs/contracts/settings-classes.md` — the contract row **and both** count
   tables (Counts and Dispositions)
4. A `REMOVED_KEYS` entry in `src/scripts/_lib/agent_settings.ts` naming the
   replacement
5. The ratchet in `src/config/gate-violation-baselines.json`
6. The regenerated `docs/settings-reference.md` plus its site mirror
7. The authored `src/agent-src/templates/agent-settings.md`, where a directive
   row exists

Conditional: drop the key's `LEGACY_RENAME_MAP` alias in `install.ts` (an alias
table, not a reader).

**A schema edit reds Install-Aux and Static-Checks until the install bundle is
rebuilt in the same commit.**

## See also

- [`settings-classes`](../../../docs/contracts/settings-classes.md) — the A/B/C
  class contract and the disposition axis this queue is the `derivable` half of.
- [`buried-roadmap-blockers`](buried-roadmap-blockers.md) — the sibling case of
  work that needed a durable home because a roadmap was the wrong container.
