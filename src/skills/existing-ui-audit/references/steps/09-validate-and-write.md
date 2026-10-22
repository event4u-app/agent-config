# 9. Validate and write findings

1. Verify every key in the [Output format](../../SKILL.md#output-format) of `SKILL.md` is present in `state.ui_audit` (empty arrays/objects allowed; `null` only for `shadcn_inventory` outside the react-shadcn stack).
2. Verify `state.ui_audit.greenfield == true` implies `state.ui_audit.greenfield_decision` is set.
3. Write the full object back into the state-file. Audit completes with outcome `done` — the dispatcher's audit gate now passes.
