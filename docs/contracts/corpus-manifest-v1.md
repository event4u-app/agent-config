---
stability: beta
keep-beta-until: 2026-11-30
roadmap_ref: road-to-governed-evidence-production.md
---

# Corpus manifest v1 — the equivalence-preserving subject pin

**Purpose.** Make the metered-proposer experiment's subject reproducible from a
recorded artefact, so two captures can be shown to have measured the same thing.
It exists because a recorded commit demonstrably does not pin that subject.

**Producer.** `./scripts-run src/scripts/corpus_manifest capture --out FILE`
**Checker.** `./scripts-run src/scripts/corpus_manifest verify --manifest FILE`
**Library.** `src/scripts/_lib/corpus_manifest.ts`

## Why a commit is not enough — measured, not argued

The experiment enumerates its corpus from `.claude/rules/`, and three facts
about that directory make a commit insufficient:

1. It is **gitignored in its entirety** (`.gitignore:157`; `git ls-files
   .claude` returns 0), so its contents are in no commit.
2. It is a **generated projection**, so its contents depend on the generator's
   bytes and configuration as well as on the source it reads.
3. The generator **withholds** rules on evidence read from the operator's home
   directory. Measured on a freshly generated tree at
   `56c333855`: the generator reported **101 rules skipped** and produced **13
   files**, while a stale projection of the same HEAD held 15.

## The skip mechanism is the per-host partition, not byte-identity

This is a correction to the shorthand the earlier record used. The generator's
own log line reads *"N rule(s) skipped — byte-identical twin already installed
at user scope"*, and that message attributes **all** skips to the byte-identity
dedup (`dedupableRules`). On the tree measured above the byte-identity
comparison accounts for **zero** of them, because `projection.scope_dedup` is
absent from every settings layer this repository carries and therefore off.

The live mechanism is `partitionRulesForDir` (ADR-236): when the partition is
active and this host's **global** rule layer is verified to carry the *names*
that would be withheld, the project projection is narrowed to the package-only
set. `hostLayerCarries` decides on **name presence**, never on content.

Consequence for this contract: the field a commit cannot supply is the global
layer's **name inventory**. A manifest that pinned only byte-identical twins
would have recorded zero explanation for every skip that actually happened.

## What the manifest records

| Group | Fields |
|---|---|
| Commit and generator | `commit`, `tree_dirty`, `package_version`, `generator[]` (path + sha256 of `condense.ts`, `ruleLayerPartition.ts`, `claudePathsPlan.ts`) |
| The subject | `enumeration_rule`, `included[]` (ordered: path, sha256, bytes, projection-source provenance and its hash), `excluded[]` with the reason |
| The projection decision | `projection.partition_active`, `tool_id`, `layer_dir`, `carries`, `reason`, `missing[]`, `package_only_count`, `layer_inventory[]` (name + sha256), `layer_digest` |
| The byte-identity dedup | `user_scope[]` (home-relative path, sha256, `causes_skip`) |
| Configuration and runtime | `generator_config` (a closed allowlist of non-secret keys plus the resolved `projection.scope_dedup`), `runtime` (node, platform, arch) |
| What was produced | `produced[]` (every `*.md` in the corpus directory, with hashes) |
| The comparison key | `subject_digest` |

## The equivalence contract

```
TWO CAPTURES DESCRIBE THE SAME EXPERIMENTAL SUBJECT IFF THEIR
`subject_digest` AND `enumeration_rule` MATCH. NOTHING WEAKER COUNTS.
```

`subject_digest` folds the **enumeration rule** and the **ordered subject
inventory with hashes**, and deliberately nothing else. The commit, the runtime,
the platform and the global-layer inventory are **explanations** of a
difference and are kept out of the value that detects one — a digest that moved
when the node version moved would report a subject change on every upgrade, and
a reader would stop believing it.

The enumeration rule is inside the digest on purpose: the same five files
selected by a different rule is a different experiment, and a digest blind to
that would let the selection semantics be amended without the pin noticing.

## `verify` and its exit codes

| Exit | Meaning |
|---|---|
| 0 | The subject is equivalent. Explanatory differences may still be printed, and are. |
| 1 | An error — unreadable manifest, missing corpus directory. |
| 2 | Usage. |
| 3 | **The subject differs.** A comparison captured against this manifest is not comparable to one captured here. |

`verify` reports **every** difference rather than the first. A check that
reveals its findings one per cycle trains the reader to believe the last one was
the last one.

There is deliberately **no `update` verb**. A pin that can be refreshed in place
is a pin that silently follows the tree, which is the property it exists not to
have.

## Privacy

User-scope and global-layer paths are recorded **home-relative**, so no account
name is captured; only file hashes are stored, never content. The environment
capture is a **closed allowlist** of non-secret keys rather than a filtered
dump, because a filter is a list of what somebody remembered to exclude. `HOME`
is deliberately absent even though it decides the projection — its value is an
account name, and the decision evidence is carried by the hash tables instead.
`tests/scripts/corpus_manifest.test.ts` asserts a captured manifest contains no
occurrence of the home path.

## What this does NOT do

- It is **not wired into the capture path**. `llm_propose` still writes no
  provenance, so an operator runs `capture` alongside a run by hand. Emitting
  provenance from inside the arm is a change to the frozen mechanism and belongs
  to whoever freezes the remaining protocol slot.
- It does **not** make the corpus reproducible; it makes non-reproduction
  **detectable and explained**. Reproducing the subject in a clean checkout
  requires regenerating there, which is what `verify` is run after.
- It does **not** decide what the experiment measures. That is the unfrozen
  slot, and it is unfrozen for a reason recorded in the roadmap.
- `package_only_count` is counted over the whole projection source, which is a
  superset of what the generator classifies (it filters by workspace scope and
  manual type first). Measured: 15 here against 13 files produced. `produced` is
  the authoritative inventory.

## Cross-references

- The protocol this pins the subject for:
  [`metered-proposer-protocol.md`](metered-proposer-protocol.md).
- The partition predicates it reads:
  [`ruleLayerPartition.ts`](../../src/install/ruleLayerPartition.ts),
  [`globalRuleLayers.ts`](../../src/install/globalRuleLayers.ts),
  [`partitionEligibility.ts`](../../src/install/partitionEligibility.ts).
- The pre-registered corpus size: `src/config/harness-evolution-budget.json`
  (`max_candidates`), read rather than restated.
