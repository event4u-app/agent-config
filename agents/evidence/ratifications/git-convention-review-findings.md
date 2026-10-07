---
proposed_by: claude-opus-5/git-convention-review-findings
implemented_by: claude-opus-5/git-convention-review-findings
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default+openai-gpt-4o-2026-10-07
providers: [openai]
verdict: confirmed-non-expanding
seats:
  openai: confirmed-non-expanding
  anthropic: no-final-verdict
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

## Independent review — three rounds, stated as they happened

1. **Round 1** (CLI seats, earlier version): `anthropic/claude-sonnet-4-5` and `openai/codex-default` both returned
   `confirmed-non-expanding`. The openai seat named three simulation gaps: literal replacement, a non-list `edits`,
   and the unreadable-file path.
2. **Round 2** (after fixing the first two gaps): anthropic `confirmed-non-expanding`; openai `rejected`. It
   named a concrete bypass: a MultiEdit payload carrying a decoy `content` or `old_string` would be checked as a
   Write or Edit while the host ran the edits. Fixed: such a payload is refused, with a test that was red first.
3. **Round 3** (final diff): the CLI quota of both seats was exhausted and the anthropic API account had no credit.
   Only `openai/gpt-4o` answered on the metered rung: `confirmed-non-expanding`, no weakening path.

4. **Round 4** (final diff, after a completion review found the file-creation gap): CLI quota of both seats still
   exhausted (50/50 on the council's own counter), anthropic API account without credit. `openai/gpt-4o` on the
   metered rung: `confirmed-non-expanding`.

The council's quota counter was not reset to obtain a second seat: it is the run's own budget control, and resetting
it is the owner's call. A two-provider verdict on the final diff is open residue, named in the PR description.

The header is derived by `ratification_header` from the final verdict each seat gave **on the final diff**. That is
why it carries one provider: anthropic's last verdict is on the round-2 diff, which lacked only the refusal of
ambiguous payloads. It is recorded here and not counted.

The unreadable-file path is unchanged and matches the pre-existing Edit path. The host cannot apply an Edit or
MultiEdit to a file that does not exist.
