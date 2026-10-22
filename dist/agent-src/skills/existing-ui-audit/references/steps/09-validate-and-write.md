# 9. Validate and write findings

1. Verify every key in the `SKILL.md` **Output format** is present in `state.ui_audit` (empty arrays/objects allowed; `null` only for `shadcn_inventory` outside the react-shadcn stack).
2. Verify `state.ui_audit.greenfield == true` implies `state.ui_audit.greenfield_decision` is set.
3. Write the full object back to the state-file. The audit ends `done` — the dispatcher's audit gate passes.
