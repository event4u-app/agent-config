<!-- evidence-type: analysis -->

# Design decision, round 2 — the trigger cannot live in a kernel rule's `triggers:`

Round 1 (`shell-command-trigger-design-20261108.question.md`) split: anthropic `C` (park unless detection reaches < 1 % false negatives), openai `A` (kernel-frontmatter `shell_command` trigger, measure recognition first). The spike is done (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`): over 14,834 real agent Bash calls a heredoc-aware segmenting recogniser finds 991 `git commit`, 508 `git push`, 129 `gh pr create`, with at most 1 miss in 992 (≈ 0.1 % false negatives); a prefix match finds 17 % of commits. Coverage bounds stated there (no `eval`, aliases, wrappers, `bash -c`).

**New fact that rules option A out as written:** `src/scripts/schemas/rule.schema.json` and `docs/contracts/rule-router.md` (locked for the kernel/router phase) **forbid `triggers:` and `routes_to:` on kernel rules** — a kernel rule loads every session, so a router activation trigger on it has no meaning. `commit-policy`, `scope-control` and `non-destructive-by-default` are kernel rules. Their duty is not activation: they are always loaded; what the act needs is their `load_context` reference (e.g. `contexts/authority/commit-mechanics.md`, 5,631 chars) at the moment of `git commit`.

## Options

**A′ — a separate, non-router key on the rule.** A new optional frontmatter key, e.g. `act_references: [{ shell_command: "git commit" }]`, allowed on kernel and non-kernel rules, read only by the reference duty (requires table, hook observation, and later delivery/read-gate), never by the router or the activation emitter. One source of truth stays the rule; the router contract's prohibition stands untouched because this is not an activation trigger. Costs: a schema change, and edits to three kernel rules — two-provider ratification and an own PR with ≥ 24 h between kernel merges.

**B — a separate table.** `src/config/act-references.json` maps a shell-command prefix to rule ids; a lint keeps every id and its `load_context` real; kernel rules untouched, no soak. Two places now say when a rule's reference is due.

**C — park** with the wake condition "a carrier for act-time references is decided".

Delivery for 3.1's deliver arm under A′ or B would be a short factual pointer (rule id, one-line law, reference path) far below the 2,048 B `pre_tool_use` slot cap; the read-gate arm blocks once per reference per session; both independently switchable without a kernel merge; observation stays on.

## Answer

Recommend A′, B or C with reasons, the largest risk of your pick, and what would change it.

End with exactly one line in this form:
`STANCE: <A'|B|C> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`
