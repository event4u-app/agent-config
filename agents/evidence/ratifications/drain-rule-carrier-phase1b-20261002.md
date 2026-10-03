---
proposed_by: claude-opus-5/worktree-agent-a2f2558c9c4303d4d
implemented_by: claude-opus-5/worktree-agent-a2f2558c9c4303d4d
reviewed_by: ai-council/ratify-phase1b-2026-10-03
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — a third slot for an advisory concern, and a budget in a second unit

Covers `drain/rule-carrier-phase1b-20261002`, which implements steps 1.3 through
1.7 of `road-to-a-rule-carrier-that-works-outside-the-repo`. Three of its files
sit on the gated-surface list; the other fourteen are runtime code, tests and the
roadmap. Named for the branch rather than a PR number, because the pre-push gate
reads this file before the pull request exists.

## Why `ratified` and not `confirmed-non-expanding`

```
THE session_start BINDING IS AN AUTHORITY EXPANSION. IT IS NOT A LARGE ONE.
A CONCERN GAINS A LIFECYCLE POINT AT WHICH IT MAY RUN AND EMIT CONTEXT.
NARROW IS NOT THE SAME AS NON-EXPANDING, AND THE LABEL IS NOT AN ESCAPE HATCH.
```

This is the finding both reviewers converged on and it is worth stating plainly,
because the first instinct here was the wrong one. Adding `rule-inject` to the
`claude` host's `session_start` list does not add a capability — the concern
already injects rule bodies on `user_prompt_submit` and already runs on
`pre_compact`. It adds an **execution surface**: a lifecycle point at which the
concern may run and emit `additionalContext` where it previously could do
neither. Authority is *when and where* a concern may act, not only what it may
do when it acts, so this expands it.

The anthropic seat put the governance point directly: "the distinction between
'narrow scope' and 'non-expanding' is crucial here — this IS expanding (adds a
slot), but the expansion is acceptable." The openai seat independently reached
the same classification and named the condition on which a
`confirmed-non-expanding` label would have been correct: only if the binding
already existed, or if ADR-268 defined a host-wide grant covering new slots,
"which the artefact does not establish."

So the expansion is recorded as one.

## What is expanded, and what bounds it

| File | Classification | What it does |
|---|---|---|
| `src/scripts/hook_manifest.yaml` | **expanding** | adds `rule-inject` to `claude.session_start` |
| `src/scripts/hook_manifest.json` | non-expanding | the regenerated fingerprint over the YAML above |
| `src/config/hook-token-budget.json` | non-expanding | adds a tighter constraint; raises no ceiling |

The bounds on the expansion, each checkable:

- The concern stays `fail_closed: false`, `severity: advisory`, `effect: context`.
  It cannot deny a tool call, block a turn, or modify anything. Its declaration
  block is byte-identical to before.
- On `session_start` it returns before reading any state unless the envelope's
  `source` is `compact`. Five fixtures drive the other sources — `startup`,
  `resume`, `clear`, `fork` and an unrecognised one — and assert exit 0 with
  empty output.
- What it emits there is the Iron-Law section of rules it ALREADY delivered in
  that session, by id, read back from the package corpus. It cannot reach a rule
  the session was not already under.
- The emission is bounded by 8,000 characters and, independently, by the
  unchanged 16,384-byte row.

**The reviewers' caveat on that third bullet is recorded rather than argued
away.** Both noted that the `source === 'compact'` guard lives in runtime code
outside the three gated files, so the manifest grants execution on every
`session_start` and the narrowing is a property of the handler. That is true.
The guard is covered by the fixtures named above and by a dispatcher-level
column in `rule_inject_foreign_matrix.test.ts` that drives the BUILT bundle; it
is not covered by the manifest, and a manifest cannot cover it.

## What the reviewers found, and what changed because of it

Both seats returned `ratified`; the openai seat attached `REQUEST_CHANGES` on
evidence rather than on the classification. Three findings, all acted on in this
branch before this artifact was written:

1. **The margin was stated ambiguously** (openai, Medium). The registered reason
   said 8,000 "leaves roughly 2,000 under the 10,000-character threshold beside
   the 1,272 characters of non-rule text" — which is two readings wearing one
   sentence. If the host measures the assembled `additionalContext`, the margin
   is 10,000 − 8,000 − 1,272 = **728**. Both readings are now stated, in the
   constant's header and in the registered row, with the smaller named as the
   one to plan against and the open question named as open.
2. **The corpus ratio is evidence, not an invariant** (openai, Medium). The
   measured 1.0346 bytes-per-character maximum describes today's 121 files. One
   BMP code point is one character and three UTF-8 bytes, so a 6,000-character
   payload can be 18,000 bytes — under the character budget and over the byte
   row. `compose` now enforces **both units independently** at emission, and a
   fixture emits exactly that payload and asserts it is reported rather than
   sent. Sensitivity checked: removing the byte check reds that fixture alone.
3. **A boundary test** (openai, highest-leverage). One fixture sizes a body so
   the composed string lands exactly ON the budget and asserts `full`, then adds
   one character and asserts the same rule returns `omitted_budget` — reported,
   never shortened.

The openai seat's third, Low finding — possible duplication between the 8,000
constant and the registered row — was already covered: a fixture reads
`per_concern_caps_chars['rule-inject']` and asserts equality with
`COMPOSED_CHARS`, which is the explicit equality test it asked for.

## What was checked on the budget file

- No number in the file is raised. `per_concern_caps_bytes.rule-inject` keeps
  `16384`; the only edit to it is prose saying the byte row is now the outer
  envelope the selection stays inside.
- The new `per_concern_caps_chars` section does not route around a ceiling: at
  8,000 characters it is strictly tighter than the byte row under every ratio
  this corpus produces, and since finding 2 the byte row is enforced anyway.
- No slot sum, no `per_turn_aggregate_bytes` value, and no other concern row is
  touched.
- No kernel rule, no `gate-coverage.yml` row, no workflow step, and no
  enforcing surface downgraded to non-enforcing anywhere in the branch.

## What would have changed the verdict

`refused` if: any non-`compact` session source read persisted state or emitted
context; the character cap had been set above the byte row's equivalent; the
byte row had been removed when the character row was added; the concern had
become `fail_closed: true`; or the compiled fingerprint could not be reproduced
by `compile_hook_manifest` (it was, and `check_generator_sync` is green).

`confirmed-non-expanding` only if the `session_start` binding had already
existed — it did not.

## Independence

The council was run through `council_cli run` with a neutral prompt: it names
the scope, inlines the diff verbatim, states the closed verdict vocabulary, and
asks what the reviewer checked and what would have changed their verdict. It
carries no expectation of the outcome in either direction, which is the
`evaluator-independence` condition for a review the implementer commissioned on
its own work. The prompt is
`agents/runtime/council/questions-ratify.md` and the responses
`agents/runtime/council/responses/ratify-phase1b.md` — both gitignored and
auto-pruned, which is why the findings and the verdicts are quoted here in full
rather than cited by path.

Two distinct providers answered, which is the count
`src/config/ratification-policy.json` requires. Neither is the implementer.
