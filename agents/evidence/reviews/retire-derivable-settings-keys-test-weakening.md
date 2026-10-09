# Test-weakening review — retire 47 derivable settings keys

<!-- evidence-type: original-review -->

Independent review of every test file in branch `feat/retire-derivable-settings-keys`
that asserts less than before, as `check_test_weakening` requires
(`evaluator-independence` § Tests are evaluators). Reviewer: AI council,
2026-10-09, anthropic + openai, 2/2 present, $0.00 (subscription transport), two
rounds with peer review. Subject: the diff of these five files between
`origin/main` and `e98578280`.

## Prompt (verbatim, sent with the diff)

> Repository: event4u/agent-config. A change retires settings keys whose shipped
> default becomes fixed behavior: the key is removed from the settings template,
> its readers are rewritten to the old default, and a removed-keys registry warns a
> consumer whose settings file still carries it. The diff below is every test file
> in that change that now asserts less than before (net-removed assertions).
>
> For each file, judge every removed or changed assertion:
> 1. **obsolete** — it tested behavior that only existed through the retired key
>    (e.g. "setting X to a non-default value changes Y"), which no longer exists; or
> 2. **weakening** — it tested behavior the code still has, and removing it reduces
>    coverage of live behavior.
> For each `weakening` finding, name the assertion and what should replace it.
> End with a per-file verdict: `obsolete-only` or `weakening-found`.

## Verdict

| File | anthropic | openai | Disposition |
|---|---|---|---|
| `tests/lib/removed_zero_settings_keys.test.ts` | obsolete-only | obsolete-only | accepted as obsolete |
| `tests/scripts/_cli/cmd_explain_disabled.test.ts` | weakening-found | weakening-found | fixed: `captured.trim().length > 0` replaced by the trace header `# explain last — run run-success-001`, so a warning or error text can no longer pass |
| `tests/scripts/command_suggester.test.ts` | obsolete-only | weakening-found | fixed on the dissent: a partial `commands.suggestion` section is tested to keep every unset field at its default, restoring the loader coverage the removed test carried |
| `tests/scripts/compile_router.test.ts` | obsolete-only | obsolete-only | accepted as obsolete (the fixed-false invariant replaces the opt-in assertions) |
| `tests/scripts/install.test.ts` | obsolete-only | obsolete-only | accepted as obsolete (conditional rendering on a retired suppression key) |

The split on `command_suggester` was resolved by adopting the stricter reading:
the added test costs nothing and covers live behavior either way.

Also found while driving CI, and fixed in the same branch: `tests/scripts/condense.test.ts`
asserted that `telegraph.speak: true` emits the rule. With the key retired that
opt-in no longer exists (D1, Risk 2); the assertion now pins the inverse — a
leftover `speak: true` is ignored — keeping the assertion count.
