# Code-graph counterfactual review — 2026-11-06

Roadmap: `road-to-a-graph-that-wins` 3.5. Registration:
`internal/bench/code-graph/PREREGISTRATION-counterfactual-2026-11-06.md` (council-revised, addenda
A1–A3, all before any valid reviewer answer). Frozen set, payloads and every reviewer run:
`internal/bench/code-graph/counterfactual-2026-11-06/`. Runner:
`internal/bench/code-graph/counterfactual_review.ts`.

**Result: the Phase 5 checks stay advisory — bar (ii) failed (38 unsupported names against 3 allowed); bar (i) and the B1 > A direction passed.**

## What was measured

30 caller-bearing merged PRs: 15 from this repository (TypeScript), 11 from `unopim` and 4 from
`larasend` (PHP; `larasend` yielded 4 eligible PRs, so 3 came from `unopim` by the registered
shortfall rule). Truth per PR is oracle-only: the files outside the diff that reference a symbol
the diff changed, at the parent commit (scip-typescript / Psalm, `--network none`). One reviewer
model (`claude-sonnet-5-5`, tool-less, no repository, no instruction files), three runs per arm,
majority set; 270 calls, none invalid. Arm A sees the diff; B1 adds the check results and the read
list as structured lines; B2 adds the same payload as prose; G is the read list alone, no model.

The claim this supports is **assisted dependency retrieval**, not better review: a referencing
file is a dependency, not a defect (registration, first section).

## Reading

- **The graph packet carries the retrieval.** The plain reviewer finds 6.7 % of the referencing
  files; with the packet it finds 38.0 % (B1), and the packet alone, with no model, finds 34.5 %
  (G). Most of B1's gain is the read list being forwarded; the model adds a few points over G.
- **The form did not matter here.** B2 (prose) reads 40.0 % against B1's 38.0 %, with 2 discordant
  cases — underpowered, no direction. The prior finding that prose context degrades reviews is
  not reproduced on this task; the registered hypothesis B1 > A ≥ B2 holds in its first half only
  (B2 also beats A, 14 to 0).
- **Precision is what fails.** B1 names 38 files that are neither truth nor named by A: 18 are files
  the read list itself names, 20 appear nowhere in the packet and are the model's own additions. Bar (ii) allows 3.
  Part of this is the truth's narrowness — a read-list file can be a legitimate review target
  without referencing a changed symbol — which is why the claim is retrieval-only and why the bar
  stands as registered rather than being reinterpreted after the fact.
- **Per subject** (mean recall A / B1 / B2 / G; PRs with a B1 catch; B1 unsupported names):

| Subject | PRs | A | B1 | B2 | G | B1 catches | B1 unsupported |
|---|---:|---:|---:|---:|---:|---:|---:|
| self | 15 | 13.3 % | 48.2 % | 51.6 % | 40.7 % | 7 | 24 |
| unopim | 11 | 0.0 % | 19.7 % | 20.5 % | 20.5 % | 4 | 8 |
| larasend | 4 | 0.0 % | 50.0 % | 50.0 % | 50.0 % | 2 | 6 |

## Consequence

The checks keep `disposition: advisory` (`graph_check_findings.ts`), and the self-review gate
keeps reading them as advisory. The measured lever is the read list's precision, not the
rendering. Whether a read list restricted to regions that reference a changed symbol keeps G's
recall while dropping the 18 packet-borne extras is an untested hypothesis — a new registration,
not a repair of this one.

## Honest limits

- 30 PRs and 3 runs; one model, one provider.
- Truth is reference-level only; Psalm records no global-function call sites (2.6).
- The own-repository PRs are recent and agent-authored; the PHP PRs are third-party.
- Historical checkouts used the pin's `vendor/` / `node_modules`.

## Bars

- **(i)** PRs where B1 names a truth file A misses: **13** of 30 (needed 12) → **PASS**
- **(ii)** files B1 names that are neither truth nor named by A, summed: **38** (allowed 3) → **FAIL**
- **Direction** B1 vs A (paired_verdict on per-PR recall): **pass**
- **Advisory status lifted:** no

| Comparison | verdict | wins / losses | p | mean Δ recall (triage only) |
|---|---|---|---:|---:|
| B1 vs A | pass | 13 / 0 (13 discordant) | 0.0001 | 0.313 |
| A vs B2 | regression | 0 / 14 (14 discordant) | 0.0001 | -0.333 |
| B1 vs B2 | underpowered | 0 / 2 (2 discordant) | 1.0000 | -0.019 |

## Recall and extras per arm

| Arm | mean recall | mean recall, signature touched | mean recall, body only | extra files (sum) |
|---|---:|---:|---:|---:|
| A | 6.7 % | 6.7 % | 6.7 % | 15 |
| B1 | 38.0 % | 40.7 % | 35.3 % | 47 |
| B2 | 40.0 % | 40.7 % | 39.2 % | 67 |
| G | 34.5 % | 30.7 % | 38.3 % | 22 |

## Per case

| Case | |T| (prod / test) | A | B1 | B2 | G | B1 catches | B1 unsupported | invalid |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| larasend-16 | 1 (1 / 0) | 0.0 % | 100.0 % | 100.0 % | 100.0 % | 1 | 2 | — |
| larasend-18 | 1 (1 / 0) | 0.0 % | 100.0 % | 100.0 % | 100.0 % | 1 | 4 | — |
| larasend-2 | 4 (3 / 1) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 0 | — |
| larasend-4 | 1 (1 / 0) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 0 | — |
| self-2812 | 2 (1 / 1) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 1 | — |
| self-2822 | 1 (0 / 1) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 2 | — |
| self-2824 | 2 (1 / 1) | 100.0 % | 100.0 % | 100.0 % | 50.0 % | 0 | 0 | — |
| self-2833 | 1 (1 / 0) | 0.0 % | 100.0 % | 100.0 % | 100.0 % | 1 | 2 | — |
| self-2838 | 1 (1 / 0) | 0.0 % | 100.0 % | 100.0 % | 100.0 % | 1 | 0 | — |
| self-2841 | 2 (0 / 2) | 0.0 % | 0.0 % | 50.0 % | 50.0 % | 0 | 0 | — |
| self-2842 | 1 (1 / 0) | 100.0 % | 100.0 % | 100.0 % | 100.0 % | 0 | 3 | — |
| self-2847 | 2 (0 / 2) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 0 | — |
| self-2848 | 1 (1 / 0) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 3 | — |
| self-2849 | 1 (0 / 1) | 0.0 % | 100.0 % | 100.0 % | 0.0 % | 1 | 0 | — |
| self-2852 | 9 (5 / 4) | 0.0 % | 44.4 % | 44.4 % | 44.4 % | 4 | 3 | — |
| self-2853 | 3 (2 / 1) | 0.0 % | 66.7 % | 66.7 % | 66.7 % | 2 | 1 | — |
| self-2863 | 2 (2 / 0) | 0.0 % | 100.0 % | 100.0 % | 100.0 % | 2 | 2 | — |
| self-2874 | 2 (0 / 2) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 0 | — |
| self-2877 | 8 (4 / 4) | 0.0 % | 12.5 % | 12.5 % | 0.0 % | 1 | 7 | — |
| unopim-677 | 1 (1 / 0) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 0 | — |
| unopim-728 | 6 (1 / 5) | 0.0 % | 33.3 % | 33.3 % | 33.3 % | 2 | 0 | — |
| unopim-729 | 2 (2 / 0) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 1 | — |
| unopim-740 | 2 (2 / 0) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 1 | — |
| unopim-743 | 12 (9 / 3) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 2 | — |
| unopim-745 | 11 (11 / 0) | 0.0 % | 100.0 % | 100.0 % | 100.0 % | 11 | 0 | — |
| unopim-750 | 2 (0 / 2) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 1 | — |
| unopim-758 | 4 (2 / 2) | 0.0 % | 25.0 % | 25.0 % | 25.0 % | 1 | 1 | — |
| unopim-761 | 12 (12 / 0) | 0.0 % | 58.3 % | 66.7 % | 66.7 % | 7 | 0 | — |
| unopim-778 | 3 (2 / 1) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 0 | — |
| unopim-793 | 1 (0 / 1) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0 | 2 | — |
