---
proposed_by: claude-opus-5/drain-hook-bundle-yaml-reader-20261001
implemented_by: claude-opus-5/drain-hook-bundle-yaml-reader-20261001
reviewed_by: ai-council/hook-bundle-yaml-reader-rounds-1-and-2
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — one YAML reader in the hook bundle, and a ceiling on it

Covers the branch closing `road-to-a-hook-bundle-with-one-yaml-reader`. Named
for the branch rather than a PR number, because the pre-push gate reads this
file before the PR exists.

## Why `confirmed-non-expanding` and not `ratified`

```
NOTHING HERE EXPANDS ANY AUTHORITY.
ONE GATE IS ADDED THAT CAN ONLY REFUSE.
ONE GUARD'S REFUSAL SET IS HELD EXACTLY WHERE IT WAS, PROVEN DIFFERENTIALLY.
NO CEILING, FLOOR OR BASELINE MOVES PERMISSIVELY.
NO ENFORCING SURFACE BECOMES NON-ENFORCING.
NO KERNEL RULE IS TOUCHED.
```

One seat voted `ratified` in round 2. That verdict is NOT taken: `ratified`
records approval of an authority-EXPANDING change, and nothing here expands one.
Taking the stronger-sounding label when the weaker one is accurate is how the
vocabulary stops meaning anything.

## The gated surfaces, one direction each

- **`src/scripts/hooks/block_config_weakening.ts`** — a blocking PreToolUse
  guard, which is why this file exists at all. Its parse moves from `js-yaml` to
  the `yaml` package the bundle already carries. The refusal set is held
  CONSTANT, and that is proven rather than asserted: a differential test imports
  both readers and runs one 51-entry corpus through each, asserting identical
  results, with a non-vacuity assertion that the corpus contains more than 8
  refused and more than 20 parsed entries so an all-refused corpus cannot pass
  it. Removing either constraint fails 3 cases.
- **`.github/workflows/consistency.yml`** — gains ONE step invoking a new gate.
  No existing step is removed, reordered or conditioned; the step invoking
  `check_kernel_edit_ratified` is untouched.
- **`src/config/gate-coverage.yml`** — gains ONE row,
  `check_hook_bundle_composition`, `status: enforced`, `min_scanned: 150`. No
  existing row is edited, no floor lowered, no status downgraded. The header
  denominators are RECOMPUTED on this tree (347 scripts, 109 rows) rather than
  incremented, per the file's own standing instruction.
- **`taskfiles/ci-fast.yml`** — gains ONE invocation of the same gate with the
  same argv, which is what keeps `check_ci_local_parity` green without a drift
  declaration.

Everything else in the diff is a new gate, a new budget file, two test files, a
census-measurement fix and the roadmap's archival.

## The review — two rounds, and the first one refused

Run via `council_cli` on 2026-10-01: `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds each, 2/2 quorum both times, $0.00 (both seats
subscription-authed). Neither seat could reach the branch and both said so; both
verdicts are bounded to a described delta, which is stated here rather than
implied away.

**Round 1 — both seats REQUEST_CHANGES, and they were right.** The shared
objection: characterizing the OLD reader proves the old behaviour, not that the
new one matches it. `openai/codex-default` then named the concrete hole —
default `yaml` resolves `!!timestamp`, `!!binary`, `!!set`, `!!omap`, `!!pairs`
and unknown custom tags, all of which `js-yaml` v5's CORE schema throws on. On a
fail-closed guard that is a weakening: the document used to be unparseable and
refused. Measured on this tree before acting on it — six inputs, six throws
against six values. Closed with `schema: 'core'` + `resolveKnownTags: false` and
by treating a WARNING as a refusal, since `yaml` warns where `js-yaml` throws.

`anthropic/claude-sonnet-4-5`'s round-1 finding — YAML merge keys — was measured
and REFUTED: both readers leave `<<` literal at these versions. That is `js-yaml`
v5 behaviour against the v3 behaviour the claim assumed.

**Round 2 — one `ratified`, one `rejected` with a second specific finding.**
`openai/codex-default` observed that `yaml` documents `merge` as defaulting to
the document's YAML VERSION, so a `%YAML 1.1` directive was proposed as a route
past the schema pin. Measured: it does NOT reproduce — under `schema: 'core'` a
`%YAML 1.1` document reads identically with and without `merge: false`, and
identically to `js-yaml`. `merge: false` is set anyway and four `%YAML` cases
joined the differential corpus, because the finding named a real documented
coupling between two options and the cost of pinning it is one word. The option
is documented in the source as pinned WITHOUT an observed failure behind it,
rather than presented as a fix.

**Why the second round's `rejected` does not block this.** Its blocking finding
was a prediction about a parser behaviour, and the prediction was tested and did
not hold. The remedy it asked for — `merge: false` plus `%YAML 1.1` differential
coverage — was implemented in full regardless. What is NOT claimed: that the
seat agreed afterwards. It was not asked a third time, and the honest reading is
that its requested change landed while its verdict stands unretracted.

**Provider diversity was not a formality.** The seat that refuted the other
seat's finding is the seat that found the real one, twice.

## What this ratification does not cover

Neither seat read the diff. Both bounded their verdicts to the description, and
the description above is what they had. A reviewer with the diff might find
something in the census change or the new gate that neither was positioned to
see.
