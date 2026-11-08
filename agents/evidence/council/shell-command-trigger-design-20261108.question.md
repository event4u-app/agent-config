<!-- evidence-type: analysis -->

# Design decision — where a shell-command trigger lives, so the reference duty can reach `git commit`

You advise on a design choice in the `event4u/agent-config` repository. Answer with the option you recommend and why, then the risks of your pick.

## Context, verified in the tree

- `road-to-a-reference-that-arrives-before-the-act` observes, at a file act, which `load_context` references the act's rules require and whether they were read (merged, observe-only, in the `reread-guard` hook concern, which is already bound on claude `pre_tool_use` for Read/Edit/Write/Bash).
- Step 2.4 found that the three rules whose duty matters most at an act — `commit-policy`, `scope-control`, `non-destructive-by-default` — are reached by no act, because no trigger kind names a shell command (`git commit`, `gh pr create`, `git push`). Every existing `command:` trigger names a slash command.
- Its last step, 3.1, compares four arms (deliver at the act, read-gate once, nothing, full layer) and is blocked on that missing trigger kind.
- The roadmap that owned the act-time carrier, `road-to-mixed-trigger-activation-cost` step 2.3, depends on two prerequisites that are both archived as **abandoned**: host-level `matcher`/`if` splitting of the hook registration (`road-to-per-turn-hook-economy` 5.1, declined for its zero-dispatch goal) and per-rule `norm:` lines (`road-to-cost-parity-1-rule-payload-diet` Phase 3, abandoned because the Claude rule emitter delivers only `paths:`). So 2.3's resume condition can never fire as written.
- The three rules are **kernel** rules. Editing their frontmatter needs a two-provider ratification and an own PR with ≥ 24 h between kernel merges.
- Hook constraints: `pre_tool_use` additional context is capped at 2,048 B per slot (owner ruling E2 unbound the earlier file-path delivery when gate-open p90 reached 19,649 B); the referenced files are 5–16 KB. The hook bundle has about 2 KB of headroom.

## Options

**A — Kernel frontmatter.** Add a `shell_command:` trigger kind to the rule schema and router, and add `shell_command` triggers to the three kernel rules (ratification + 24 h soak). The duty and any delivery read the triggers from the rule itself: one source of truth.

**B — A separate action-reference table.** A committed config (e.g. `src/config/act-references.json`) maps a shell-command prefix to rule ids; the requires table and the hook read it; kernel rules stay untouched. A lint keeps every listed rule id and its `load_context` real. Two places now say when a rule applies.

**C — Park.** Record that 3.1 has no carrier because its owner's prerequisites were abandoned; move the roadmap to `later/` with that as its wake condition; do nothing else now.

For A or B, delivery at the act would carry a short factual pointer (rule id, the one-line law, the reference path) well under 2,048 B — never the reference body — and the read-gate arm would block once per reference per session.

## Answer

Recommend one of A, B, C, with your reasons, the risk you consider largest, and what would make you change your pick.

End with exactly one line in this form:
`STANCE: <A|B|C> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`
