<!-- evidence-type: analysis -->
# Wording baseline — 2026-08-25

Measured on `drain/road-to-redundancy-governance`. Companion to
`redundancy-baseline-2026-08-25.md`, which covers implementation and knowledge
duplication; this covers its **dual**: the same concept named differently.
Every row carries its command.

Scope for every count below, unless a row says otherwise:

```
grep -rioE '\b<pattern>\b' src/ docs/ agents/ --include='*.md' | wc -l
```

## Mechanical spelling pairs — one word, two spellings

These carry no semantic difference. Either side means the same thing, and the
split is measurable without judgement.

| Pair | count | count | split |
|---|---|---|---|
| `artifact` / `artefact` | 3369 | 3275 | 51 / 49 |
| `behaviour` / `behavior` | 1374 | 1034 | 57 / 43 |
| `subagent` / `sub-agent` | 2999 | 30 | 99 / 1 |
| `handoff` / `hand-off` | 1019 | 112 | 90 / 10 |
| `preflight` / `pre-flight` | 285 | 135 | 68 / 32 |
| `organize*` / `organise*` | 94 | 22 | 81 / 19 |
| `license` / `licence` | 451 | 73 | 86 / 14 |
| `gray` / `grey` | 34 | 2 | 94 / 6 |
| `canonicalize*` / `canonicalise*` | 13 | 4 | 76 / 24 |

### CORRECTION 2026-08-25 (later the same day) — the aggregate hides a scope effect, and three pairs FLIP

The table above sums `src/ docs/ agents/`. Decomposed by directory, **three of
the nine pairs point one way on the shipped surface and the other way in the
aggregate**, so the aggregate split is not a safe input to a canonicalisation
decision. Same command as the § Scope block, run once per directory:

```
grep -rioE '\b<pattern>' <dir> --include='*.md' | wc -l
```

| Pair | `src/` | `docs/` | `agents/` | aggregate above |
|---|---|---|---|---|
| `artifact` / `artefact` | **63/37** (n=965) | 47/53 (n=1445) | 49/51 (n=4374) | 51/49 |
| `behaviour` / `behavior` | **22/78** (n=600) | 62/38 (n=596) | 68/32 (n=1769) | 57/43 |
| `subagent` / `sub-agent` | 98/2 (n=558) | 99/1 (n=551) | 99/1 (n=2349) | 99/1 |
| `handoff` / `hand-off` | 84/16 (n=243) | 85/15 (n=294) | 95/5 (n=648) | 90/10 |
| `preflight` / `pre-flight` | **44/56** (n=25) | 62/38 (n=70) | 71/29 (n=338) | 68/32 |
| `organize*` / `organise*` | 100/0 (n=16) | 100/0 (n=5) | 53/47 (n=13) | 81/19 |
| `license` / `licence` | 94/6 (n=184) | 89/11 (n=123) | 79/21 (n=408) | 86/14 |
| `gray` / `grey` | 68/32 (n=25) | 54/46 (n=11) | 58/42 (n=29) | 94/6 |
| `canonicalize*` / `canonicalise*` | 100/0 (n=2) | 85/15 (n=14) | 70/30 (n=10) | 76/24 |

**The three that flip**, and why it matters:

- **`behaviour` / `behavior` — the sharpest.** The aggregate says 57/43 with the
  British side ahead. `src/` says **22/78 with the American side ahead**. The
  British majority is produced almost entirely by `agents/` (971 vs 419), which
  is roadmaps, evidence notes and archive — this repository's own working prose,
  much of it in archived files nobody will edit again. The shipped surface has
  no ambiguity at all.
- **`artifact` / `artefact`.** The aggregate is a coin-flip (51/49) and `agents/`
  is 49/51, but `src/` is **63/37**. A decision taken on the aggregate would call
  this the hardest pair; taken on `src/` it is decided.
- **`preflight` / `pre-flight`.** The aggregate says 68/32 for the closed form;
  `src/` says **44/56 for the hyphenated one**, on n=25. Small enough that the
  honest reading is *undecided on the shipped surface*, not *decided the other
  way*.

**What this does NOT change.** `subagent`, `handoff` and `license` point the same
direction in all three directories, so their majorities are real rather than
scope artifacts. `cancelled` / `canceled` at 946/0 is unaffected.

**Two counts in the aggregate row are also not reproducible** from the
per-directory sums, and are left standing rather than silently amended:
`gray`/`grey` sums to 65 across the three directories against 36 in the
aggregate row, and `organize*`/`organise*` to 34 against 116. The likely cause is
the trailing `*` in the original patterns (`organize*` matches `organizes`,
`organized`, `organizational`) against this pass's `\b<word>` prefix form. Recorded
as a discrepancy to resolve before either pair is swept, not as a refutation.

**Why this correction exists.** `road-to-canonical-terms` Phase 1.1 rests on the
`behaviour` row, describing it as a case where *"the majority rule and the
consistency rule point in opposite directions."* On the shipped surface they do
not point in opposite directions — they agree, and they agree on `behavior`.
That is a different decision from the one the roadmap poses.

**A citation defect found alongside it.** `road-to-canonical-terms` says *"Every
number below is in `agents/evidence/analysis/redundancy-baseline-2026-08-25.md`
with the command that produced it."* That file contains **zero** dialect
content — it covers implementation and knowledge duplication. The dialect numbers
are in **this** file. Corrected at the roadmap.

`hand off` as two words adds a further 62 to the handoff cluster.
`cancelled` / `canceled` is **946 / 0** — already canonical, recorded so a
later sweep does not spend a pass on it.

**`behaviour` / `behavior` is the finding this pass added.** At 57/43 it is the
second-largest near-even split in the tree and was absent from the source
analysis, which reported only the artifact, handoff and subagent clusters. A
near-even split is the expensive kind: neither side reads as a typo, so both
survive review indefinitely.

`license` / `licence` needs care rather than a sweep: in American English
`license` is both noun and verb, in British English `licence` is the noun, and
several occurrences sit inside quoted licence names. It is listed as measured,
not as a sweep candidate.

## The split is in filenames too — and that is a different change

The prose layer is cheap to sweep. The **identifier** layer is not, and the two
were conflated in the source proposal:

| Layer | `artefact` | `artifact` |
|---|---|---|
| `src/scripts/*.ts` | `check_artefact_checksums`, `check_artefact_count_messaging`, `check_generated_artefact_headers`, `lint_artefact_frontmatter`, `move_artefact` | `lint_evidence_artifacts` |
| `tests/scripts/*.test.ts` | 5 matching test files | — |
| `docs/contracts/*.md` | — | `design-artifact-lifecycle`, `design-artifact-verification`, `evidence-artifact-types` |
| taskfile references | 4 | — |

Reproduce with:

```
ls src/scripts/ | grep -iE 'arte?fact'
ls docs/contracts/ | grep -iE 'arte?fact'
grep -rhoE '(check|lint|move)_arte?fact[a-z_]*' Taskfile.yml taskfiles/*.yml | sort -u
```

So the canonical spelling is already **structurally committed on both sides**:
the script family says `artefact`, the contract family says `artifact`.
Renaming either is ~14 file renames plus their taskfile and test references —
a rename refactor with its own blast radius, not a text substitution.

Measured mitigation: `grep -rloE "from './(check|lint|move)_arte?fact" src/
--include='*.ts'` returns **0**, so nothing imports across the split and the
divergence costs nothing at runtime. Under the taxonomy the identifier layer is
therefore `keep-duplicated` today and the prose layer is `canonicalize-term`.
Splitting them is the correction this pass makes to the source proposal, which
treated the whole cluster as one deterministic sweep.

## Concept synonyms — measured, and an honest null

The original ask named a concept cluster: never *weitergeleitet* in one place
and *delegiert* or *abgegeben* in another for the same thing. Measured over
`src/ docs/`:

| Term | count | what it denotes **here** |
|---|---|---|
| `route` | 1872 | the rule router selecting which rule loads |
| `dispatch` | 764 | the hook dispatcher, and council dispatch |
| `spawn` | 379 | creating a subagent or a worktree |
| `delegate` | 260 | handing a task slice to a subagent |
| `forward` | 198 | passing hook output onward |
| `hand off` | 62 | ending a session into a fresh one |
| `fan out` | 9 | one-to-many parallel dispatch |

**No defect found, and that is the result rather than a gap in the search.**
These read as synonyms in translation and denote different mechanisms in this
tree: a router does not spawn, a dispatcher does not delegate, and
`/agent-handoff` is a specific session boundary. The same holds for the
gate cluster — `gate` 4606, `check` 3090, `guard` 718, `linter` 604,
`validator` 343 — where `check_*` and `lint_*` are literal filename prefixes
carrying a real distinction.

The consequence for enforcement: the concept layer has **no mechanical pair to
gate**, and any term map over it would be a human judgement per cluster. A
linter driven by the mechanical pairs above is a different instrument from one
that would need such a map, and only the first is buildable from this baseline.

## What already exists

Three vocabulary linters ship, so a canonical-term linter would extend a
family rather than introduce a mechanism:

| Script | What it pins |
|---|---|
| `src/scripts/lint_provenance_vocabulary.ts` | the provenance ledger's verdict vocabulary |
| `src/scripts/lint_discovery_vocabulary.ts` | discovery-frontmatter terms |
| `src/scripts/lint_hedge_words.ts` | hedge words in authored prose |

`check_md_language.ts` already carries the skip machinery any such linter needs
— frontmatter, fenced code, ignore markers — which is where the false-positive
risk in a text sweep actually lives.

## Sources

External evidence for the underlying claim is recorded in
`provenance/harvests.jsonl`; the ids are cited at the point of use in
`docs/guidelines/redundancy-taxonomy.md`.
