<!-- evidence-type: original-review -->

# Independent test review — 53 assertions removed on PR #2532

`check_test_weakening` refuses this diff: five test files assert less than
before, with no independent-verdict artefact. The rule behind it is
`evaluator-independence` § Tests are evaluators — the implementer may not
weaken a test silently, and may not clear their own removal. So this is put to
you, and the artefact that comes out of it is whatever you say, including
"restore them".

**I am not telling you what I think the answer is.** What follows is the
evidence and the question. A refusal is a useful answer and will be recorded
as the verdict; do not approve this to be agreeable.

## The numbers, measured after merging the current base

| File | Net assertions removed |
|---|---|
| `tests/scripts/tiered_projection.test.ts` | 35 |
| `tests/scripts/lean_projection_mode_parity.test.ts` | 12 |
| `tests/scripts/rule_inject_hook.test.ts` | 4 |
| `tests/scripts/rule_inject_foreign_matrix.test.ts` | 1 |
| `tests/scripts/_lib/lean_projection_shipped_default.test.ts` | 1 |

Re-measured deliberately: the first reading was taken against a base that has
since moved twice, and a count against a stale base is not a count against the
tree. It came back the same, so the 53 are real.

## What the removed cases were about

**`tiered_projection.test.ts`, 35.** Whole describe-blocks:
`_resolve_tier_b — absent is null, never an empty prune set` (returns null
with no split, returns null on malformed content, returns the names when well
formed), `_prune_tier_b_modules — no Tier B SKILL.md survives the projection`,
and `the tiered claim — every Tier B skill is still reachable over MCP` (the
two tiers partition the catalogue exactly; `read_skill` resolves every Tier B
name with a body, and every Tier A name too).

**`lean_projection_mode_parity.test.ts`, 12.** Settings-layer resolution
cases: `the template ships delivery on claude-code — asserted on the FILE, not
on a constant`, and `resolveLeanProjection — one answer per layer state`
including `no settings file anywhere resolves to the TEMPLATE value, not the
parser fallback`.

**`rule_inject_hook.test.ts`, 4.** Diagnostic-reason cases: `no package root
resolves — one diagnostic reason, and no rule body`, `a package root moved
after install names both trees it looked in`.

## What changed underneath them

- `src/scripts/_lib/lean_projection_mode.ts` lost roughly 160 of its ~193
  changed lines.
- Three settings keys are gone from the template, and their rows were removed
  from `docs/contracts/settings-classes.md` in this same change:
  `projection.rule_workspaces`, `lean_projection.mode`, `lean_projection.hosts`.
- `src/install/rule_scope.ts` and `src/scripts/hooks/rule_inject_hook.ts`
  changed.
- No module named `tiered_projection` or `lean_projection` exists in the tree
  any more under those paths.

## What the implementer says drove it

An owner direction of **2026-10-12** to remove the keys, and two council
rounds on 2026-10-20 recorded beside this file —
`setup-key-removal-release-class-20261020.md` (convergent) and
`setup-project-tree-form-source-20261020.md`. **Note what those rounds were
about: the release class of removing the keys, and the form of the project
tree. Neither was asked about the tests.** That is precisely why
`check_test_weakening` is not satisfied by them and why this round exists.

## The question

For each of the five files: are these assertions that tested **behaviour the
tree no longer has**, or assertions that tested **behaviour that still exists
and is now unasserted**?

Three things I would want checked rather than taken on trust:

1. **`tiered_projection`'s MCP-reachability claim.** If any form of tiering or
   per-tier skill delivery survives, the claim "every Tier B skill is still
   reachable over MCP" is a property of the shipped product, and dropping its
   assertion leaves a live claim unasserted regardless of which module holds
   it now.
2. **The parser-fallback case.** `no settings file anywhere resolves to the
   TEMPLATE value, not the parser fallback` is the kind of assertion that
   survives a rewrite: if resolution still has a template layer and a fallback,
   that distinction is still worth pinning even if the function was renamed.
3. **The two diagnostic cases in `rule_inject_hook`.** A hook that cannot find
   its package root still has to say something; if it does, the removed cases
   may describe behaviour that is still there.

If some are legitimate removals and others are not, say which. A split answer
is more useful here than a single verdict, and partial restoration is an
acceptable outcome.
