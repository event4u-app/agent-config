# Does a `scoped` projection stop a stripping host from stripping?

**Measured 2026-08-16. The answer is no, and the step that asked expected yes.**

`road-to-inbox-harvest-2026-08-d-runtime-skill-routing` step 1.2 asked for an
end-to-end verification that a `scoped` install "delivers skill descriptions
un-stripped on at least one host that strips them today". The verification ran
against the one host that publishes its own truncation. It stripped every
description in both arms.

## What was run

Two `codex exec --json` runs against **one** isolated `CODEX_HOME`, built as a
copy-on-write clone of the live host root so that plugins, commands, config and
auth were byte-identical across the arms. The only variable was the skill set.

| Arm | skills in the root | host dropped | descriptions |
|---|---:|---:|---|
| `legacy-all` | 297 | 402 | all stripped |
| `scoped` | 226 | 330 | all stripped |

Both rows are in `agents/evidence/metrics/skill-catalogue.jsonl`, carrying the
new `projection_mode` field. The prune was the installer's own predicate
(`is_pruned_under_scoped` over `iter_skills`), not a hand-picked list, so the
arm is the projection a `scoped` install actually deploys — 71 skills removed,
matching the package-side `scoped` / `legacy-all` split of 218 / 289.

## What it shows, and what it does not

**Shows.** Scoping moves the host's dropped count roughly one-for-one with the
skills removed: −71 skills produced −72 dropped. The relationship is linear in
the region measured, which is the useful half of a negative result — it means
the lever works, and says by how much.

**Shows.** That lever is far too short for this host. Clearing the budget from
here would take a reduction an order of magnitude larger than the pack scope
provides, and this roadmap's scope section rules out getting there by deleting
skills.

**Does not show** anything about another host. One host was measured; nothing
here is extrapolated to `claude`, whose observed mode is `per-entry` and whose
mechanism is a different one entirely.

**Does not show** a delivered or survivor count. The host's denominator is
still not ours: 330 dropped against 226 projected skills plus 36 plugin skills
plus 200 commands. Subtracting across the two would invent a number, which
`skill_catalogue.ts` already refuses to do twice over.

## Why this is recorded as a null rather than a fix

The step's premise — that `scoped` is sufficient to end stripping — was
falsifiable and is false. The honest close is the reading, not a checkbox
argued into place: over-shipping stays the safe direction per this roadmap's own
scope section, and the recovery path for what the host drops is Phase 4, which
does not depend on the answer being yes.

The two arms also give Phase 4 its concrete case: on a host in its default
state, a large majority of the catalogue is not model-visible, so an agent that
needs a skill by name has no way to reach it. That is the gap
`suggest_skill_for_task` and the recovery route close.

## Reproducing it

The isolated home carried a copy of the host's `auth.json` and was deleted
immediately after the runs. Rebuild it rather than reusing one: a credential
copy that outlives its probe is the leak this note will not leave behind.

```bash
# package-side counts, no host needed
tsx src/scripts/capture_skill_catalogue.ts --projection-modes --host-root ~/.codex

# one arm, against an isolated CODEX_HOME (see the table above for the other)
CODEX_HOME="$TMP" codex exec --json --skip-git-repo-check "reply with exactly: OK" < /dev/null > arm.jsonl
tsx src/scripts/capture_skill_catalogue.ts --host-event arm.jsonl --host codex \
    --host-root "$TMP" --projection-mode scoped --observed-at <ISO> --record
```

`codex exec` reads stdin when it is a terminal and will hang without
`< /dev/null` — the first attempt at this measurement burned five minutes on it.
