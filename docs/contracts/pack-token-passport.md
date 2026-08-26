---
stability: beta
keep-beta-until: 2026-11-24
---

# Pack token passport — what a pack costs a session

A pack is accountable for what it costs. The tree-wide payload budget answers
*"is the estate growing"*; it has no per-pack dimension, so it cannot answer
*"which pack is the growth"*. The passport is that dimension.

**The shape is defined here before any passport is generated**, and that
ordering is the point: a number whose derivation is undocumented becomes a
figure people quote without being able to reproduce.

## The numbers, and how each is derived

Every passport lives inside the pack's own generated `pack.yaml`, under
`token_passport:`. It is written by `src/scripts/generate_pack_manifests.ts` —
the generator that already writes `artefact_count` — and never by a second tool.
A second generator writing a second file is how two disagreeing figures start
circulating, which `src/config/pack-size-budget.json` records happening already
for the packed-size metric.

| field | derivation |
|---|---|
| `rules_tokens` | Σ byte length of every `rule`-category artefact file in the pack, `chars/4` |
| `catalog_tokens` | Σ `- <name>: <description>\n`.length over every `skill`-category artefact, `chars/4` — the **same construction** `censusSkillsCatalog` uses, not an approximation of it |
| `commands_tokens` | Σ byte length of every `command`-category artefact file, `chars/4` |
| `other_tokens` | Σ byte length of every other claimed artefact — contexts, personas, presets, profiles, user-types |
| `total_tokens` | the sum of the four |
| `basis` | the literal string `chars/4`, carried in-band |

**`other_tokens` exists because the first shape produced a misleading zero.**
With only the three named buckets, `core` reported **0 tokens while claiming 47
artefacts** — `src/agent-src/` carries no `rules/` or `skills/` subtree, so none
of its artefacts fell into a counted category. A pack that claims 47 artefacts
and reports zero reads as *"this pack is free"* when it means *"the named buckets
do not cover what this pack holds"*. After the remainder bucket: **0 of 17 packs
report zero.**

## Tokenizer

**`chars/4`, and it is a PROXY, not an exact count.**

It is the basis `src/config/preamble-payload-budget.json` declares for itself and
the one `preamble_byte_census.ts` uses (`:362`, `:370`, `:380`). The passport
inherits it deliberately: a passport measured with an exact BPE tokenizer could
not be reconciled against a census measured with `chars/4` without the gap
between the two methods being read as a discrepancy in the packs.

Consequence, stated rather than left implicit: **a passport figure and an
exact-tokenizer figure are not comparable**, and publishing one beside the other
would be the false delta this tree has already had to correct once.

## Reconciliation target

The per-pack sums must add up to the tree-wide buckets the census already
produces:

* `rules_tokens` → `project-scope rules (dist/agent-src/rules/*.md)`
* `catalog_tokens` → `preloaded skills catalog (name + description, dist/agent-src/skills)`

**The ±10 % band this was specified with rested on a false premise, and the
first measurement refuted it.**

The band assumed packs roughly **partition** the tree, so per-pack sums should
approach the tree-wide census. Measured 2026-08-22, across all 17 packs:
`dependencies` claims **4 skills and 0 rules**, against **291 skills and 118
rules** in the projection. Packs claim on the order of **1 %** of what the census
counts, and the observed gaps are 84 % and above.

So the two numbers are **not a reconciliation pair**:

* **census** — the projected tree, everything that ships;
* **passport** — what a pack *claims*, a small and deliberate subset.

`check_pack_passport_reconciliation` therefore **reports coverage and exits 0**.
A gate failing on an 84 % gap would be failing on a property of the tree rather
than on a defect, and a gate that is red by construction gets disabled rather
than fixed.

**What would make it a gate:** pack coverage approaching the tree. Then the band
becomes meaningful and the exit code can follow it. Until then the useful output
is the **ranking** plus the coverage figure, and this paragraph is the "say what,
in-band" the step required of a passport that does not reconcile.

## The honest limit — what a passport does NOT measure

**The residual bucket is out of scope and always will be.**
`src/scripts/preamble_byte_census.ts:410` names it *"tool definitions + dispatch
prompt (residual)"* — the part of a session's payload no local file carries. It
is not attributable to a pack because it is not attributable to the repository:
it is what the host and the transport add.

So a passport is a floor on a pack's session cost, never the whole of it. A
reader comparing `total_tokens` against a measured session payload will find the
session larger, and that difference is the residual rather than a passport
error.

**Also out of scope:** anything a pack costs at *runtime* — a skill body loaded
on invocation, a context pulled by `load_context`. The passport measures the
**standing** contribution, which is the part that is paid whether or not the
pack is used. Those two are different questions and one number cannot answer
both.

## Regeneration

`./scripts-run src/scripts/generate_pack_manifests` — the same command that
writes the rest of `pack.yaml`. Regenerating on an unchanged tree is a fixpoint:
`git diff --exit-code -- src/packs/` must stay clean, or a number is drifting
against its own inputs.
