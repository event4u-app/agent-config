# Deterministic time in gates — the evidence pin

<!-- evidence-type: analysis -->

Produced 2026-08-23 by the autonomous drain run that closed
[`road-to-deterministic-time-in-gates.md`](../../roadmaps/road-to-deterministic-time-in-gates.md).
Its Phase 0 asks for exactly this file: the three surviving defects with
`file:line`, the anonymised source table, the parity list, and a reproduction
command for every number the roadmap tagged `corrected-from-reproduction`.

Every figure below was read from a command in this checkout, and the command is
printed next to it. Where a figure did **not** reproduce, the measured value and
the method are both stated — including the two cases where the roadmap's own
correction was wrong and the source it corrected was right.

## 1. The three surviving defects

### D1 — a gate's verdict was a function of the hour it ran

Reproduced exactly as the roadmap states it.

```
grep -lE 'Date\.now\(\)|new Date\(\)' src/scripts/check_*.ts src/scripts/lint_*.ts
```

→ **17 files** at `c7e82087e` (the branch point):
`check_always_budget` · `check_augmentignore` · `check_beta_review_markers` ·
`check_corpus_staleness` · `check_council_pin_staleness` · `check_gate_coverage` ·
`check_knowledge_cards` · `check_knowledge_pages` · `check_memory` ·
`check_proposal` · `check_reach_staleness` · `check_release_adjacent_health` ·
`check_source_size_budget` · `check_trigger_evals` · `lint_budget_ownership` ·
`lint_one_off_age` · `lint_symptom_intake`.

`src/scripts/_lib/as_of.ts` did not exist, and no `--as-of` / `AC_AS_OF` / `asOf`
CLI surface existed anywhere in `src/scripts/` — the only `asOf` grep hit was the
substring inside `hasOffset` at `src/scripts/ai_council/budget_guard.ts:158`.

**18 sites, not 17, and the extra one matters.** The gate written for this defect
reports `check_knowledge_pages.ts` twice (`:75` and `:148`, two exported
functions each defaulting a parameter to the clock) and finds
`check_gate_coverage.ts:982`, which the roadmap's own grep list omits because the
read sits inside a template substitution:

```
const cycleId = `gate-surface-${new Date().toISOString().slice(0, 10)}`;
```

Every one of the 18 is an **age or staleness** judgement, which is why the defect
is not cosmetic: an earlier "now" makes every one of those gates strictly more
permissive, so the same tree greens on Monday and reds on Friday and neither
verdict is recoverable from the commit.

### D2 — five figures for one property

The roadmap's framing is right and its own re-count is not the point. Measured at
the branch point:

| Reading | Command | Value |
|---|---|---|
| frontmatter-strict `enforced_by` declarers | frontmatter block parse over `src/rules/*.md` | 34 |
| any-line grep for `enforced_by:` | `grep -l 'enforced_by:' src/rules/*.md` | 37 |
| `enforced_by: ["none"]` in frontmatter | frontmatter block parse | **10** |
| any-line grep for `` `enforced_by: none` `` | `grep -n 'enforced_by: *"\?none' src/rules/*.md` | 12 (all in PROSE) |
| rule total | `ls src/rules/*.md \| wc -l` | 120 |

**The roadmap's `corrected-from-reproduction` "14 that currently say `none`" does
not reproduce; the source's 10 does.** The 12 any-line hits are all prose
sentences of the form "this rule ships `enforced_by: none`" inside rule bodies,
not declarations — so a grep that counts them is counting the tree's own
discussion of the value. That is the same class of defect as the plurality it was
measuring.

The published plurality itself reproduced: `docs/proof.md` carried **86** and
**89** for "rules that declare no backstop" in two places at once, under one
heading, plus a hand-written snapshot at `docs/CLAIMS.md:203`. The cause was
never arithmetic — it was that no figure said which population it was taken
over.

### D3 — no skill declared where it may write

```
grep -l '^scope:\|^write_scope:\|^writes:' src/skills/*/SKILL.md | wc -l   → 0
ls src/skills/*/SKILL.md | wc -l                                          → 292
```

**0 of 292** (the roadmap says 0/291 — the count moved with the tree, the defect
did not). `execution:` carries `type` / `handler` / `timeout_seconds` /
`allowed_tools`; `trust:` carries `level` / `removable` / `default`. Neither
answers *where*.

**A premise defect worth recording, because it changed how Phase 3 was
executed.** The roadmap says "declare it for the skills that shell out — the
`execution:` cohort", equating the two. They are not the same set:

```
grep -l '^execution:' src/skills/*/SKILL.md | wc -l   → 52
```

and of those 52, by `type`/`handler` pair: **22** `type: manual` with no handler
at all, **21** `assisted` + `internal`, **9** `assisted` + `shell`. Only the 9
shell out. `runtime-safety` is explicit that a skill without a handler is
instructional only, so 43 of the 52 have no write path of their own — and for
those the accurate declaration is an empty `write` list with a stated reason, not
an invented glob. All 52 are declared (the roadmap's criterion), and the
derivation per class is recorded in the schema's own `scope` description.

## 2. The sources — anonymised, per `source-confidentiality`

The harvest note this roadmap was drafted from lives in the gitignored
`agents/tmp.old/` archive; its path is retained as an `ENC1:` token in the
roadmap's own `> **Source:**` block because both the directory segment and the
filename carry a third-party product name. The sources it cited are recorded here
by **role only** — no name, no domain, no repository:

| Id | What it is | What survived scrutiny |
|---|---|---|
| A | An external governance/rule suite used as the comparison baseline | The deterministic-time observation (D1) — reproduced here in full |
| B | An external reference for enforcement declaration | The plurality framing (D2); its own re-count did not reproduce |
| C | An external reference for skill metadata | The write-scope gap (D3); the count moved, the gap held |
| D | An external reference for per-invocation payload | Routed out to the standing-payload-diet roadmap; its distribution figures did not reproduce (§ 3) |
| E | An SEO-only organisation whose name is near-identical to a widely used tool's, whose download button points at a third-party page, and which ships no code | Nothing adoptable. It became a `## Known pitfalls` entry on `supply-chain-intake` — *name-similarity is not provenance* |

No source name appears in this file, and none is needed to check any claim above:
every one of them is a command over this tree.

## 3. Reproduction for every `corrected-from-reproduction` figure

| Roadmap claim | Command | Measured | Verdict on the roadmap's correction |
|---|---|---|---|
| 17 scripts read the clock | `grep -lE 'Date\.now\(\)\|new Date\(\)' src/scripts/check_*.ts src/scripts/lint_*.ts \| wc -l` | 17 files / 18 sites | **holds** (file count); the site count is higher, see D1 |
| no `--as-of` surface exists | `grep -rn 'as-of\|AC_AS_OF\|asOf' src/scripts/` | one `hasOffset` substring | **holds** |
| 37 / 32 / 14 / 119 enforcement readings | see the D2 table | 37 / 34 / **10** / 120 | **`none` count is wrong** — the source's 10 was right |
| `docs/proof.md` publishes 86 and 89 | `grep -n 'undeclared' docs/proof.md` | both present, one heading | **holds** |
| 0 of 291 skills declare write scope | `grep -l '^scope:\|^writes:' src/skills/*/SKILL.md \| wc -l` | 0 of **292** | **holds**; denominator moved |
| 14 of 291 skills have `references/` | `ls -d src/skills/*/references \| wc -l` | **14** of 292 | **holds** |
| SKILL.md p50 165 · p90 271 · sum 52,798 | `git ls-tree -r --name-only origin/main src/skills/` + line count | p50 **166** · p90 **275** · sum **53,432** over 294 files | **wrong on p50 and p90** — the source's 166/275 reproduce exactly; no reading of the sum matches, because none of the three states its corpus definition (292 one-level vs 294 recursive) or its percentile method |
| the six-hour `LEDGER_MAX_AGE_MS` widening was never committed | `git show HEAD:src/scripts/hooks/block_unauthorized_git.ts` | `30 * 60 * 1000` at `:527` — the VALUE is correct | **the value claim holds, the history claim is wrong**: the guard's own docstring at `:506-525` records that the widening *was* committed to the trunk and left there before being restored |

Two of the roadmap's eight corrections are themselves wrong, and in both cases
the source it was correcting was right. That is the reason this table prints the
command rather than the conclusion.

## 4. Parity — verified already-shipped, deliberately absent

Each row was checked in this tree rather than accepted from the roadmap.

| Claim | Check | Verdict |
|---|---|---|
| Orchestrator-only apply | existing doctrine, `delegation-policy` | already shipped |
| Hooks never mutate tracked knowledge or git | `roadmap_progress_hook.ts` regenerates only `agents/roadmaps-progress.md`, untracked since ADR-243 | already shipped |
| Release-artifact self-audit | `check_pack_size` content classes + `check_publish_surface` | already shipped |
| Honest capability boundary | the Claims Ledger's `resolved-null` | already shipped |
| Bundle freshness by content hash (Phase 1.5) | **`check_hook_bundle_content.ts` already does it**, landed 2026-08-21, wired in `taskfiles/ci-fast.yml:168` immediately after the mtime gate | already shipped — see § 5 |

**Unverified residual, recorded rather than assumed** (carried forward from the
roadmap unchanged): whether `check_pack_size`'s content classes cover personal
e-mail addresses, absolute private paths, and symlink entries. Not checked here;
out of this roadmap's scope.

## 5. Phase 1.5 was already shipped, and the probe is recorded anyway

The roadmap asks `check_hook_bundle_freshness.ts` to compare a content hash.
Implementing that literally would duplicate `check_hook_bundle_content.ts`, whose
own docstring already names `touch` on the bundle as the case mtime cannot see.
So the step closed as an honest null on new code plus a one-line honesty fix to
the mtime gate's success message — and the two halves of its `verify` were
demonstrated against the existing pair rather than asserted:

```
npm run build:hooks                      # baseline sha256 ce21579b7c14
sed -i '' 's/LEDGER_MAX_AGE_MS = 30 \* 60 \* 1000/LEDGER_MAX_AGE_MS = 31 * 60 * 1000/' \
  src/scripts/hooks/block_unauthorized_git.ts
touch dist/hooks/dispatch.js
./scripts-run src/scripts/check_hook_bundle_freshness   # exit 0  ← the false green
./scripts-run src/scripts/check_hook_bundle_content     # exit 1
#   executing: sha256 ce21579b7c14  (1155415 bytes)
#   rebuilt:   sha256 ac83e2f51118  (1155415 bytes)
```

Identical byte count, different bytes — the mtime gate cannot see it and the
digest gate cannot miss it. Reverting the constant and rebuilding returns
`ce21579b7c14` and exit 0, which is the second half ("a rebuilt but
byte-identical bundle still passes").

**A weaker first probe is recorded because it looked like a result.** Appending a
comment line to a hook source left the digest gate GREEN — correctly, since
esbuild strips comments and the executing bytes were unchanged. A probe that does
not go red has proven nothing about the guard, only about the probe.

## 5b. The pin fixes the instant, not the calendar — measured

AC-2 asks for byte-identical output "on two different machines". One agent on one
host cannot run that, so the nearest thing that IS runnable was run instead: hold
the pin and the tree, vary the machine-local input most likely to reach a date
gate.

```
AC_AS_OF=2026-11-30T23:30:00Z TZ=<zone> LANG=C LC_ALL=C ./scripts-run src/scripts/<gate>
```

over all 17, at `TZ=UTC`, `Pacific/Kiritimati` (+14) and `Pacific/Honolulu` (-10),
with a warm-up pass first so `check_always_budget`'s history line is stable.

| Comparison | Gates whose output changes |
|---|---|
| `UTC` vs `+14` | **`check_memory`** (85 lines — every age shifts one day) and **`check_trigger_evals`** (69 lines, likewise) |
| `UTC` vs `-10` | `check_gate_coverage` only, and only in a sub-probe count (`check_references: scanned 1535` vs `1536`) — a probe wobble, **not** a timezone finding |

**Why.** Both gates convert the pinned instant to a LOCAL calendar date:

```
src/scripts/check_memory.ts:281        now.getFullYear(), now.getMonth() + 1, now.getDate()
src/scripts/check_trigger_evals.ts:104 now.getFullYear(), now.getMonth() + 1, now.getDate()
```

A `+14` offset carries `23:30Z` into the next local day, so every age computed
from that date moves by one. Two further gates read the calendar the same way and
happened not to differ at this instant, which makes them latent rather than clean:
`check_beta_review_markers.ts:190` and `check_proposal.ts:369`.

**This is a defect the pin EXPOSED, not one it introduced** — all four used
`new Date()` plus the same local getters before the seam existed, so their
verdicts were already TZ-dependent and nothing could see it. It is left unfixed
deliberately: step 1.2's contract is "mechanical substitution only — no threshold,
no message, and no exit code changes", and swapping `getFullYear` for
`getUTCFullYear` flips a verdict at a day boundary by construction. Four one-line
changes, recorded on AC-2, which stays `[~]`.

## 6. What the roadmap's own premise got wrong, in one list

1. `none` declarers: 14 claimed, **10** measured (the source's figure).
2. SKILL.md p50/p90: 165/271 claimed, **166/275** measured (the source's figures).
3. The `execution:` cohort is not the shell-out cohort: 52 vs **9**.
4. The 17-file grep misses a site inside a template substitution: **18** sites.
5. The six-hour ledger widening **was** committed, contrary to the routed item's
   "uncommitted only" reading; the constant's current value is nevertheless
   correct.
6. Step 1.1's "merge-base commit date when running in CI" would have **weakened
   every gate it touched** — the merge-base is `<=` HEAD, and all 17 callers are
   age gates, so pinning to it hands a long-lived branch a free extension on
   every staleness budget in the tree. The seam pins to the HEAD commit date
   instead: same reproducibility, tightest committed clock. Recorded in
   `src/scripts/_lib/as_of.ts`'s own docstring.
7. Step 2.3's `grep -c 'enforced_by: *"\?none' src/rules/*.md` matches **prose**,
   not frontmatter — the tree uses the list form `enforced_by:\n  - "none"`, so
   that grep returned 0 on frontmatter and 12 on rule bodies discussing the
   value.
8. Step 3.1's nested `verification: {command | reason}` is unreadable by this
   repo's frontmatter parser, which flattens map → map → scalar (it handles
   map → list → map, which is how `triggers[].keyword` works). Declared as two
   mutually-exclusive sibling keys instead, with the exclusivity enforced by a
   `skill_linter` check.
