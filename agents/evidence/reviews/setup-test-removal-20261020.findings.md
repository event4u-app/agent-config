<!-- evidence-type: original-review -->

# Independent test review — the 53 removed assertions on #2532

Round of 2026-10-20, AI council, two provider-diverse seats, both present
before and after the run. Prompt committed verbatim at
`agents/evidence/council/setup-test-removal-20261020.md`; it carried the
per-file counts, the named cases and the evidence, and explicitly invited a
refusal.

## Verdict — a split, as both seats asked for

**Blanket clearance refused, 2/2 convergent.** Neither seat would clear all 53
on the owner direction alone.

`anthropic`: *"Reject blanket approval … The burden of proof is on
demonstrating behavioral deletion, not just module deletion."* Its sharpest
point, recorded because it is the one that changed what was done here: *"The
strongest signal of a silent weakening is the absence of a council round
specifically evaluating 'should skill tiering exist as a product feature?'
The rounds that occurred addressed configuration and project structure."*

`openai`: *"Do not clear the blanket 53-assertion removal. Conditionally
accept key-bound lean-projection deletions, separately trace tier invariants
and hook diagnostics, and withhold judgment on the two undescribed
single-assertion removals."*

## What the trace found, per the seats' three questions

**1. Does tiering survive? YES — and this is the finding that mattered.**
`src/scripts/compute_skill_tiers.ts` exists; `src/scripts/install.ts` calls
`tierBAdvisory` at `:4879`; `src/cli/mcp/dispatch.ts` serves `read_skill`.
This branch does not touch any of them — `git diff origin/main` over those
paths is empty. The 35 `tiered_projection.test.ts` assertions therefore did
not all test deleted behaviour.

**Restored, and now passing: 8 assertions.** The whole
`the tiered claim — every Tier B skill is still reachable over MCP` block (4)
— including `the two tiers partition the projected catalogue exactly` and
`read_skill resolves EVERY Tier B name, with a body` — plus 4 advisory cases.
These are live product properties and were unasserted for the length of this
branch.

**Legitimately removed, because the subject is gone and that was measured
rather than argued:**

| Subject | Why |
|---|---|
| `_resolve_tier_b` (3 cases) | helper removed from the tree; `TypeError: _resolve_tier_b is not a function` |
| `_prune_tier_b_modules` (2) | same |
| `applyTieredPrune` (2) | no longer exported by `src/scripts/_lib/mcp_bridge.ts` |
| `reports already-tiered` (1) | `migrationEligibility` can no longer return that verdict — `skill_catalogue.ts` says so in its own comment, *"There were three modes until 2026-10-20"* |

**One assertion followed a rename rather than being dropped.** `names BOTH
levers when Tier B is non-empty` asserted `projection.mode: tiered`, a key
this change removes. The advisory still offers two levers and still takes
neither; the assertion now names the surviving second one (the MCP server).
The invariant the case is named for is intact.

**2. The parser-fallback case.** The three `lean_projection` files assert
against `lean_projection.mode`, `lean_projection.hosts` and
`projection.rule_workspaces` — keys removed from the template in this same
change, with their rows removed from `docs/contracts/settings-classes.md`.
Restoring main's versions fails on every one of them for that reason. These
removals are accepted as key-bound.

**3. The two `rule_inject_hook` diagnostic cases — the seats' premise was
wrong, and checking beat assuming.** They were **not deleted**. The file
rewrites them under a 20-line note stating exactly what changed: the
diagnostic asserted that a consumer whose *settings* said `delivery` while the
package was unreachable got a reason naming the missing root; the settings
statement is gone and the form now lives in the package, so the thing that
would say "deliver" is unreachable with it.

The note's load-bearing claim was verified rather than taken on trust:
`installerThinsHost` at `src/scripts/_lib/lean_projection_mode.ts:310`
returns a literal `false`, so the installer never thins and a consumer in that
state already holds every rule body. There is nothing withheld to warn about,
which is why the absent diagnostic is not the silence the carrier roadmap
forbids.

## Net effect

8 assertions restored and green. 8 removals confirmed against the tree. The
remaining ~37 are key-bound to three settings keys removed under the owner
direction of 2026-10-12.

## What this review does NOT establish

The seat quotations are transcribed by the party whose change they clear;
council responses are gitignored, so no reader can verify from the tree that
these two seats said these things. `openai` also asked for a full
53-assertion disposition mapping each assertion to a deleted path or a
surviving behaviour with its replacement test. **That mapping was not
produced** — what is above is a per-subject trace, which is coarser. Said
plainly rather than presented as the thing that was asked for.
