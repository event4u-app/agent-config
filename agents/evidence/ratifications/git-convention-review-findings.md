---
proposed_by: claude-opus-5/git-convention-review-findings
implemented_by: claude-opus-5/git-convention-review-findings
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-07
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the class-C fence models MultiEdit

Covers branch `fix/git-convention-review-findings` (into `feat/git-convention-settings`, PR #2235). Named for the
branch because the pre-push gate reads this file before every push.

## The one governance surface in the diff

`check_kernel_edit_ratified` names `src/scripts/hooks/block_config_weakening.ts`, the class-C fence. MultiEdit was
already in the guard's edit-tool list, but the class-C check read only `content` and `old_string`, so every MultiEdit
of a settings file passed unchecked. The change:

- applies a MultiEdit's `edits` in order to the file on disk, as the host does, and checks the result;
- replaces `new_string` literally — `String.replace` expanded `$&` and `$$`, so the guard could evaluate a text the
  host never writes (this also closed the same gap on the single-Edit path);
- refuses an `edits` value that is not a list, an edit it cannot interpret, and a payload that carries more than one
  edit form at once;
- checks an Edit or MultiEdit that creates a settings or carrier file that does not exist yet (an empty
  `old_string` creates it): the missing file is treated as empty text.

```
NO ENTRY IS REMOVED FROM ANY REFUSAL. A WRITE PATH THAT WAS UNCHECKED IS NOW CHECKED.
THE AGENT CAN CHANGE FEWER CLASS-C VALUES AFTER THIS CHANGE THAN BEFORE IT.
NO PARSER CONTRACT, CEILING, FLOOR OR BASELINE MOVES. NO KERNEL RULE IS TOUCHED.
```

## Independent review — five rounds, stated as they happened

1. **Round 1** (CLI seats, earlier version): `anthropic/claude-sonnet-4-5` and `openai/codex-default` both returned
   `confirmed-non-expanding`. The openai seat named three simulation gaps: literal replacement, a non-list `edits`,
   and the unreadable-file path.
2. **Round 2** (after fixing the first two gaps): anthropic `confirmed-non-expanding`; openai `rejected`. It
   named a concrete bypass: a MultiEdit payload carrying a decoy `content` or `old_string` would be checked as a
   Write or Edit while the host ran the edits. Fixed: such a payload is refused, with a test that was red first.
3. **Round 3** (third version): the CLI quota of both seats was exhausted and the anthropic API account had no credit.
   Only `openai/gpt-4o` answered on the metered rung: `confirmed-non-expanding`, no weakening path.
4. **Round 4** (final diff, after a completion review found the file-creation gap): CLI quota of both seats still
   exhausted (50/50 on the council's own counter), anthropic API account without credit. `openai/gpt-4o` on the
   metered rung: `confirmed-non-expanding`.

5. **Round 5** (final diff, both CLI seats; the owner directed council runs through the CLI and the council's local
   quota counter was reset for that): `anthropic/claude-sonnet-4-5` `confirmed-non-expanding`; `openai/codex-default`
   `ratified`. Its reason: replacing `new_string` literally also lets through safe literal writes that the old
   `String.replace` simulation refused by mistake. That is a narrow widening of the accepted request set, justified
   because it matches what the host writes, and no path newly permits a class-C weakening.

The header is derived by `ratification_header` from the final verdict each seat gave on the final diff. Both seats
asked for one more regression test: a first edit that would clear a class-C value followed by a second that misses,
where the host applies none. That test is a named follow-up candidate.

A file that cannot be read for a reason other than its absence is unchanged: the guard does not check it, as on the
pre-existing Edit path.
