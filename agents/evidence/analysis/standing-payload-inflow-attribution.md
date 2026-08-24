<!-- evidence-type: analysis -->

# Standing-payload inflow attribution — re-derived from this tree

**Produced by** `road-to-standing-payload-diet` Phase 0 steps 0.1 and 0.2.
**Measured** 2026-08-23 on the maintainer's machine, branch
`drain/standing-payload-diet` at merge-base `c7e82087e`.
**Method** exact BPE (`js-tiktoken`, `cl100k_base`) via
`src/scripts/_lib/token_count.ts` for every per-rule figure; the gate's own
`chars/4` proxy is quoted only where the gate's own number is being reproduced,
and is labelled as the proxy each time. The two are never mixed inside one
subtraction.

**Scope of every figure below:** this machine, this checkout. Both gates that
motivate this analysis are machine-local by construction, and the one that is
CI-observable (`check_preamble_payload_budget`) reads the in-repo projection,
so its numbers reproduce anywhere the tree is checked out. The one that is not
(`check_standing_rule_delivery`) reads a home directory and is scoped
accordingly wherever it appears. See
`agents/roadmaps/road-to-standing-payload-diet.md` blocker
`b-colleague-machine-readings` for the recorded scope decision.

---

## 1. The two gate readings at the merge-base

Reproduced on 2026-08-23, both from the same checkout.

`./scripts-run src/scripts/check_preamble_payload_budget` (chars/4 proxy, the
gate's own basis; in-repo, CI-observable):

| Bucket | tokens (proxy) |
|---|---:|
| project-scope rules (`dist/agent-src/rules/*.md`, 119 files) | 122,476 |
| preloaded skills catalog (name + description, 294 skills) | 14,486 |
| CLAUDE.md hierarchy (project only) | 746 |
| **measured total** | **137,708** |
| baseline (`src/config/preamble-payload-budget.json`) | 102,520 |
| derived ceiling (baseline + 5 % headroom) | 107,646 |
| **over ceiling** | **+30,062** |
| **over baseline** | **+35,188** |

`./scripts-run src/scripts/check_standing_rule_delivery` (exact BPE; home
directory + project projection, machine-local):

| Layer | files | tokens (exact BPE) |
|---|---:|---:|
| global (`~/.claude/rules/`) | 103 | 108,978 |
| project (`.claude/rules/`) | 15 | 11,968 |
| **TOTAL** | **118** | **120,946** / 110,000 cap (110.0 %) |

The roadmap's Context recorded 135,436 / 120,857 on 2026-08-22. Both have
moved by a day of commits: the preamble total is **+2,272** and the standing
total **+89** against those readings. Recorded as drift rather than corrected
in place, because a roadmap that silently re-writes its own Context cannot be
checked against it later.

---

## 2. The re-derived inflow attribution (step 0.1)

### 2a. Lines, over the window the source pass named

    git log --since=2026-08-15 --numstat --pretty=format: -- src/rules/ \
      | awk 'NF==3 {a+=$1; d+=$2} END {print a, d}'
    → 1225 408

45 commits touched `src/rules/` in that window. `cat src/rules/*.md | wc -l`
is **9,880** lines today, so the window's net inflow is **+817 lines, 8.3 % of
the current corpus.**

### 2b. Tokens, which is what the gates actually measure

Lines are not the gated unit, so the same window was re-measured in exact BPE
by reading every `src/rules/*.md` blob at both ends of the window
(`git ls-tree` + `git show`, script recorded in § 5):

| | files | exact-BPE tokens |
|---|---:|---:|
| `4e041c1db` (last commit ≤ 2026-08-15) | 116 | 110,119 |
| `c7e82087e` (this branch's merge-base) | 120 | 121,898 |
| **delta** | **+4** | **+11,779** |

Per-file, ranked by token delta — the top contributors, which is what step 0.1
asks for by name:

| Δ tokens | before | after | rule |
|---:|---:|---:|---|
| +1,914 | 744 | 2,658 | `decision-revisit-gate.md` |
| +1,412 | 0 | 1,412 | `recurring-criticism.md` *(new file)* |
| +1,300 | 0 | 1,300 | `fix-what-you-see.md` *(new file)* |
| +1,108 | 1,500 | 2,608 | `evaluator-independence.md` |
| +1,062 | 0 | 1,062 | `playbook-precedence.md` *(new file)* |
| +1,055 | 1,608 | 2,663 | `roadmap-progress-sync.md` |
| +972 | 0 | 972 | `missing-skill-recovery.md` *(new file)* |
| +540 | 1,098 | 1,638 | `source-confidentiality.md` |
| +432 | 1,556 | 1,988 | `ui-audit-gate.md` |
| +428 | 2,156 | 2,584 | `design-review-after-ui-write.md` |
| +411 | 433 | 844 | `command-suggestion-policy.md` |
| +326 | 2,560 | 2,886 | `design-fidelity.md` |
| +271 | 1,163 | 1,434 | `git-history-discipline.md` |
| +269 | 1,188 | 1,457 | `self-repair-loop.md` |
| +158 | 1,641 | 1,799 | `autonomous-execution.md` |
| … | | | |
| −12 | 206 | 194 | `rule-type-governance.md` |
| −13 | 217 | 204 | `skill-quality.md` |
| −52 | 887 | 835 | `no-roadmap-references.md` |

**Finding A — 40 % of the window's inflow is four NEW rules, not body growth.**
`recurring-criticism` + `fix-what-you-see` + `playbook-precedence` +
`missing-skill-recovery` = **4,746 tok of the +11,779**. A body diet cannot
reverse a new obligation; it can only shorten the rationale attached to one.
This matters for Phase 1's target selection: three of those four are already
short (972–1,412 tok) and near the floor of what a rule needs to state its
obligation.

**Finding B — and it is the finding step 0.1 explicitly invited: there is no
burst that explains the overrun.** The gate is **+35,188 over baseline** and
the whole window contributed **+11,779**, i.e. **33 %**. Two-thirds of the
overrun predates 2026-08-15 entirely. The budget file's own
`target_schedule.measured_at_registration` corroborates this from the other
side: it recorded **125,593 measured on 2026-08-15**, already ~23 k above the
102,520 baseline registered 2026-07-31, and says so in as many words ("the
gate is red on the tree as it stands").

So the baseline is **stale by construction, not by neglect** — it was
registered on 2026-07-31 against a tree that has since acquired both new
obligations and new prose, and the ratchet's own design (fail-on-growth,
never re-baseline) means the gap is cumulative and will not self-heal.

**What that changes for Phase 1, stated because 0.1 requires it:** the pilot
must NOT be selected by recency. A recency-ranked pilot would target
`decision-revisit-gate`, `recurring-criticism` and `fix-what-you-see` — the
first of which is 196 of its 200-line cap and the other two of which are new
and already terse. The pilot is therefore driven by the **absolute token
ranking** of the corpus, which is § 3.

---

## 3. The absolute per-rule ranking (Phase 1's actual target list)

`src/rules/*.md`, 120 files, **121,898 exact-BPE tokens**. Top 20, which carry
**43,146 tok = 35.4 %** of the corpus:

| # | tokens | lines | rule | in exclusion manifest? |
|---:|---:|---:|---|---|
| 1 | 2,886 | 201 | `design-fidelity` | **excluded** (mixed) |
| 2 | 2,663 | 167 | `roadmap-progress-sync` | eligible |
| 3 | 2,658 | 199 | `decision-revisit-gate` | eligible |
| 4 | 2,624 | 155 | `context-hygiene` | eligible |
| 5 | 2,608 | 195 | `evaluator-independence` | eligible |
| 6 | 2,584 | 190 | `design-review-after-ui-write` | eligible |
| 7 | 2,317 | 187 | `settings-ask-protocol` | **excluded** (mixed) |
| 8 | 2,303 | 168 | `session-canary` | eligible |
| 9 | 2,288 | 174 | `code-provenance` | eligible |
| 10 | 2,186 | 170 | `domain-safety-pii` | eligible |
| 11 | 2,037 | 172 | `token-budget-discipline` | eligible |
| 12 | 1,988 | 157 | `ui-audit-gate` | eligible |
| 13 | 1,867 | 123 | `domain-safety-disclaimer` | eligible |
| 14 | 1,816 | 144 | `delegation-policy` | eligible |
| 15 | 1,808 | 122 | `active-remediation` | eligible |
| 16 | 1,799 | 84 | `autonomous-execution` | eligible |
| 17 | 1,725 | 149 | `downstream-changes` | eligible |
| 18 | 1,706 | 140 | `legal-safety-floor` | eligible |
| 19 | 1,638 | 134 | `source-confidentiality` | eligible |
| 20 | 1,634 | 89 | `senior-engineering-discipline` | eligible |

Nine of the nine kernel rules (`src/scripts/_lib/kernel_rules.ts:1-11`) are
absent from this top-20 and are unwritable by an agent
(`src/scripts/hooks/block_kernel_rule_writes.ts`), so the diet cannot reach
them and does not try.

---

## 4. The source-pass divergence, recorded as a finding (step 0.2)

The source draft attributed the overrun to **+19,679 / −300 lines in
`src/rules` since 2026-08-15**. The measurement in § 2a over the same path and
the same window returns **+1,225 / −408**. The roadmap's own Context recorded
**+1,036 / −382** on 2026-08-22; the difference between that and +1,225/−408 is
one day of commits on the same branch, and the two agree to within it.

| Figure | Command that produced it | Result |
|---|---|---|
| source pass, added | *not stated in the source* | +19,679 |
| source pass, deleted | *not stated in the source* | −300 |
| this tree, 2026-08-22 (roadmap Context) | `git log --since=2026-08-15 --numstat --pretty=format: -- src/rules/ \| awk 'NF==3 {a+=$1; d+=$2} END {print a, d}'` | +1,036 / −382 |
| this tree, 2026-08-23 (this analysis) | same command, one day later | +1,225 / −408 |

**Which environment could have produced +19,679/−300?** The honest answer is
**none that measures `src/rules/` on any commit reachable from this history**,
and the argument is arithmetic rather than a judgement of the source:

- `src/rules/*.md` totals **9,880 lines** today. An inflow of 19,679 added
  lines inside one week would mean the corpus was rewritten roughly twice over
  in that window while only 300 lines were removed — i.e. it would have had to
  END at least ~19,379 lines larger than it started. It is 9,880 lines.
- The deleted side is inverted in the same direction. Every real window in this
  history that adds ~1.2 k lines to `src/rules/` also deletes ~0.4 k, because
  the P4 migration pattern this tree uses *moves* prose (add here, delete
  there). A near-zero deletion count against a five-figure addition count is
  not the shape this corpus produces under any window.

Two candidate explanations survive, both stated as candidates because neither
is verifiable from inside this tree:

1. **A wider path.** `git log --since=2026-08-15 --numstat --pretty=format: --`
   over the WHOLE tree (no path filter) is the only scope in this repo large
   enough to plausibly reach five figures in a week, and a path filter dropped
   from the command line would produce exactly that. This is the most likely
   candidate: the figure's magnitude is a whole-tree magnitude wearing a
   `src/rules` label.
2. **A different unit.** 19,679 is within an order of magnitude of the *token*
   deltas in this domain (§ 2b measures +11,779 exact-BPE), so a line/token
   unit confusion would put the figure in the right neighbourhood while the
   `−300` remained unexplained.

Recorded, not corrected. The source figure stays quoted verbatim above so that
a later reader can re-run both commands and see which one reproduces.

---

## 4b. The pre-state step 0.3 replaces, and the credit side step 0.5 books

### The pre-state, recorded here because 0.3's verify points at this file

Before this change, **no workflow in this repository computed a merge-base
delta of anything**:

    grep -rln "merge-base\|merge_base" .github/workflows/
    → (no output, exit 1)

29 workflow files were present. Sticky-comment machinery already existed
(`bench-drift.yml`, `skill-lint.yml`, `self-review-gate.yml`,
`release.yml`), so the mechanism was not novel here — only its application to
this number was missing. That is the whole gap: the ratchet fired *after* growth
was committed, and nothing put the number in front of a reviewer *while* the
change was reviewable.

### Two defects the new reporter found in its own first run

Both are recorded because both produced a plausible-looking number that was
false, and a reader who trusts the comment needs to know they were closed.

1. **`CLAUDE.md` is a symlink** to `AGENTS.md` (mode `120000`, confirmed via
   `git ls-tree origin/main CLAUDE.md`). `git show <ref>:CLAUDE.md` returns the
   nine-byte link TARGET, not the file, so the base side measured 2 tokens
   against a real 746 and the comment reported:

       | CLAUDE.md hierarchy (project only) (1 → 1 files) | 2 | 746 | +744 | — |

   A **+744 debit fabricated out of a file nobody touched.** `readBlob` now
   follows the link, bounded to two hops.

2. **`git archive` honours `export-ignore`,** and `.gitattributes:26` carries
   `/CLAUDE.md export-ignore` — so the tarball omitted the file *silently*. An
   omitted bucket and a genuinely small bucket print identically, which is what
   makes this class expensive. The file is now fetched by blob, not by tarball.

A third, and it is a property rather than a defect: diffing against
`origin/main` rather than the **merge-base** attributed four other people's
merges to the branch under review (measured: `origin/main` had moved to
`2a7a8e221` while the branch point was `c7e82087e`). The workflow resolves
`git merge-base origin/<base_ref> HEAD`, and needs `fetch-depth: 0` to do it.

### The credit booking (step 0.5)

`check_rule_layer_partition`, run on the maintainer's main checkout
2026-08-23 — machine-local, per the scope decision at
`b-colleague-machine-readings`:

| project directory | tool | files | package-only | DUPLICATED | sole-carrier | global |
|---|---|---:|---:|---:|---:|---:|
| `.claude/rules` | claude-code | 15 | 15 | 0 | 0 | 103 |
| `.cursor/rules` | cursor | 16 | 16 | 0 | 0 | 103 |
| `.clinerules` | cline | 15 | 15 | 0 | 0 | 103 |
| `.windsurf/rules` | windsurf | 16 | 16 | 0 | 0 | 103 |
| `.augment/rules` | augment | 119 | 15 | **103** | 1 | 103 |

`projection mode: dual-layer/partitioned — host layer verified at 14.10.0
(fingerprint f1fc4a4ce8d5)`.

**The credit:** on the four partitioned hosts the project layer withholds the
103 global-owned rules instead of re-emitting them. Measured on this machine
those 103 files are **108,978 exact-BPE tokens** (`check_standing_rule_delivery`,
global layer), so the partition is worth that much per session per host that
would otherwise load them twice. `check_standing_payload_delta` books it from the
live projection rather than from this figure, and reports **unavailable** — never
zero — where no projection exists to read, which is the normal case in CI.

**The control, and it is what makes the number a partition effect rather than a
counting artefact:** `.augment/rules` on the same machine still carries all 103
in BOTH layers and the gate reds on it. Same corpus, same run, one emitter that
consults the partition and one that does not. A counting artefact would show in
both.

The roadmap's step 0.5 quoted a different split (`.cursor/rules` 126 / 26 / 100,
`.windsurf/rules` 113 / 13 / 100, `.claude/rules` 13 / 13 / 0, `.clinerules`
14 / 13 / 0) measured 2026-08-22 in a freshly generated worktree. The shape it
was cited for — global-only nonzero on the partitioned hosts, zero on the symlink
trees — does not survive this reading: on this machine **every** host reports
`global 103`, and the two trees that read `0` in the roadmap's version now read
`15` and `16` package-only. Recorded as a divergence rather than reconciled: the
two readings were taken in different projection states (fresh worktree vs main
checkout) and the gate is machine-local by construction, so neither is wrong and
neither generalises. The control above is chosen so it does not depend on which
of the two readings holds.

---

## 5. Reproduction

Every figure above re-derives from these five commands, run from a checkout of
this branch:

```bash
# § 1 — both gate readings
./scripts-run src/scripts/check_preamble_payload_budget
./scripts-run src/scripts/check_standing_rule_delivery      # main checkout only

# § 2a — the line window the source pass named
git log --since=2026-08-15 --numstat --pretty=format: -- src/rules/ \
  | awk 'NF==3 {a+=$1; d+=$2} END {print a, d}'

# § 2b + § 3 — exact-BPE per-rule ranking and window delta
./scripts-run src/scripts/check_standing_payload_delta --base 4e041c1db --rank

# § 3 — the exclusion manifest column
./scripts-run src/scripts/rule_activation_census
```

`check_standing_payload_delta` is the gate step 0.3 introduces; it carries the
window-delta and per-rule-ranking measurement so the numbers in § 2b and § 3
are reproducible from a registered gate rather than from a throwaway script.
