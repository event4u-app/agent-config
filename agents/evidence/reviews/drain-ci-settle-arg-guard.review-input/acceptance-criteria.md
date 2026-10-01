## Acceptance criteria

- No cell in `docs/enforcement-by-host.md`'s format column names a path no
  emitter in this tree writes, and a check fails when one does.
- The Windsurf and Cline format cells are byte-identical to what they were
  before this change.
- The table states, per slot, what happens when a bound hook exceeds the
  documented timeout, and each such statement carries a provenance marker
  distinguishing read-from-documentation from observed.
- `one_question_per_ask_hook.ts` makes no claim about what it fires on beyond
  what the tree has observed.
- The guard's runtime behaviour is byte-identical before and after.
