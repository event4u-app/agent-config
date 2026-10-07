---
proposed_by: claude-opus-5/git-convention-roadmaps
implemented_by: claude-opus-5/git-convention-roadmaps
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-07
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the class-C fence guards the committed git convention

Covers branch `docs/git-convention-roadmaps` (stacked on `feat/git-convention-settings`), which implements
`road-to-a-git-convention-that-reaches-every-checkout` and its two siblings. Named for the branch because the pre-push
gate reads this file before every push.

## The one governance surface in the diff

`check_kernel_edit_ratified` names exactly one gated surface:
`src/scripts/hooks/block_config_weakening.ts`. The change adds one basename, `.git-convention.yml`, to
`CLASS_C_BASENAMES` — the files whose class-C keys an agent may not write. The new file carries
`git.commit_format`, `git.branch_pattern` and `git.update_strategy`, all class C, as the committed team convention
decided in ADR-282.

```
ONE ENTRY IS ADDED TO A REFUSAL LIST. NONE IS REMOVED OR ALTERED.
THE AGENT CAN WRITE TO FEWER FILES AFTER THIS CHANGE THAN BEFORE IT.
NO PARSER, MATCHER, CEILING, FLOOR OR BASELINE MOVES. NO KERNEL RULE IS TOUCHED.
```

Verified by `git diff origin/feat/git-convention-settings -- src/scripts/hooks/block_config_weakening.ts`: one list
entry and the comment above it. The regression test
`tests/scripts/hooks/block_config_weakening.test.ts` asserts the new basename classifies as `class-c`.

## Independent review

The AI council reviewed the diff on 2026-10-07 with two providers present after the run (2/2):
`anthropic/claude-sonnet-4-5` and `openai/codex-default`. Neither seat is the implementing session. Both returned
`confirmed-non-expanding`:

- **Both seats:** the change makes the guard more restrictive by adding a distinct basename to a flat membership list.
  No entry is removed, and a basename collision cannot displace an existing one.
- **One seat (openai):** the new basename now enters the existing class-C parse path. A parse failure could affect
  protection of the newly added file only. It cannot weaken coverage that existed before. The seat asked for a
  regression test, which exists (line 154 of the test above).
- **One seat (anthropic):** `.agent-settings.yml` is guarded in both spellings, and the new entry has only `.yml`.
  ADR-282 names `.git-convention.yml` alone and the carrier reader reads no other spelling, so a `.yaml` variant is
  never honoured as a declaration and needs no fence.

Neither seat found a weakening vector.
