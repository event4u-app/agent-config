---
proposed_by: road-to-a-tick-the-shipped-path-earns steps 2.4, 5.7 and 3.3
implemented_by: claude-opus-5.5 session on drain/tick-shipped-path-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 4 of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: f4006e57052569be7d1cd044fe364cd48f36b41aa8e68ee8a12575cc8973fcc6
---

<!-- evidence-type: ratification -->

# Ratification — a constraint carrier for subagents that skip instruction files, and a host-version gate on StopFailure

`check_kernel_edit_ratified` gates four hook-plumbing files on this branch:
`src/scripts/hook_manifest.yaml`, its compiled `src/scripts/hook_manifest.json`,
`src/config/hook-bundle-budget.json` and `src/config/hook-token-budget.json`. The `subject:` digest
covers all four, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `2e2e415cd3`, the revision round 4 reviewed; no gated file changed after it. The header
is the output of `ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What was ratified

- **`subagent-constraints` (step 2.4), as authority-expanding.** Bound on `claude` `subagent_start`
  only. When the definition the host runs for the subagent parses `omitClaudeMd` as boolean `true`,
  it hands the subagent a bounded digest of the project's `CLAUDE.md`, `.claude/CLAUDE.md` and
  `CLAUDE.local.md` files: room to the nearest file first, an inventory naming every file with
  `full`, `cut`, `omitted` or `empty`, the whole serialized reply capped at 4,096 bytes (the
  registered budget row). It deliberately overrides part of `omitClaudeMd` for the project's own
  instruction files, and a project file can permit as well as forbid, so it changes what such a
  subagent may decide; it grants no tool, file or process permission. Both seats classified it
  that way and approved it. Lazy chunk under decision A9: chunk ceiling 12,500 B, the dispatch
  bundle grows by its `LAZY_CONCERNS` row and keeps its 1,554,000 ceiling. `subagent_start` leaves
  the parent's per-turn injection ceiling, because the bytes land in the subagent's context.
- **A host-version gate on `StopFailure` (step 5.7).** `native_event_min_host_version` records
  2.1.308. The generator writes a gated event only for a host whose `--version` parses and is at
  least that; an older or unreadable version, and the static plugin `hooks.json`, do not get it.
  The global install strips a managed entry an earlier install wrote for a withheld event.

## How it got here

Four rounds, CLI subscription seats (`anthropic/claude-sonnet-4-5`, `openai/codex-default`), USD
0.00. Questions committed verbatim as
`agents/evidence/council/tick-shipped-path-ratification-r{1,2,3,4}-20261024.question.md`, each
written before its run and not edited after it.

- **Round 1, refused 2/2:** a large root CLAUDE.md could push out a nearer file; the cap applied
  before JSON escaping; the frontmatter was matched by a regex; an unknown host version kept the
  gated event; `reach exempt:` matched anywhere in prose. All fixed, each with a test seen red.
- **Round 2, refused by the seat that answered (the other returned no text):** the header and
  inventory were unbounded; fence stripping did not follow fence rules; the static plugin kept the
  gated event. All fixed, each with a test seen red.
- **Round 3, refused 2/2 with no mechanical defect named:** both judged the concern
  authority-expanding and refused a neutral classification, and asked for the record to say so and
  for the digest to stop claiming it binds "as if loaded". Done.
- **Round 4, ratified 2/2.** Both named one non-blocking imprecision: a file empty once comments
  are removed was dropped from the inventory although the text said every file is named. Fixed
  after the round in `src/scripts/hooks/subagent_constraints_hook.ts` (not a gated file): such a
  file is listed as `empty`, with a test.

## Seat answers, pinned

SHA-256 of each seat's full answer text, as returned:

| Round | Seat | Verdict | SHA-256 |
|---|---|---|---|
| 1 | anthropic | refused | `c7dc792c9c7da3b63ff92b6b88730df3f9fbe3c9ae8697deae77fafc8a5089ff` |
| 1 | openai | refused | `e1053a89fe4d088abca6b5c648d4ce9bc11f4a3940c8f6380f7435a837c1656c` |
| 2 | anthropic | no answer | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty) |
| 2 | openai | refused | `5ca1fb6e305ca3215feb5d5871e3aacfa519dd860e0dd9bb291cf4a065d53487` |
| 3 | anthropic | refused | `bd617b9e62895a23aa690e1d1ef558d0fe4968e26ede7de061153af682f8a237` |
| 3 | openai | refused | `088bdd3ca12ee2f36cb64f3edd0ebdb97285c8838e35336b83f2a242a875ba4d` |
| 4 | anthropic | ratified | `faf9b7b60db582620a89d4072e6a058737fd8b28ddc522395b15f7bdce68785d` |
| 4 | openai | ratified | `a469110f5de26f466366bd8ec7828578c663d2c371ae49961ca194c0bd2b1940` |

## Residual both round-4 seats named

Nothing bounds how many qualifying subagents a turn may start, so the 4,096-byte cap is per
injection, not per turn. Both seats called it non-blocking and suggested telemetry or a separate
child-context budget. It is not built here.

## What would have changed the verdict

A digest that could exceed its registered cap, a definition read that disagreed with the host's
YAML, or the change recorded as authority-neutral — each was a refusal in an earlier round.
