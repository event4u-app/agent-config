<!-- evidence-type: analysis -->

# The body diet, per rule — before, after, and the misses

**Produced by** `road-to-standing-payload-diet` Phase 2 steps 2.1, 2.2 and 2.3.

**Measurement scope.** All `check_standing_rule_delivery` and
`check_rule_layer_partition` figures in this document are **machine-local
measurements from the maintainer's machine**, and each before/after comparison
uses the same checkout and projection state. They establish only the change for
that measured local installation; they do **not** establish a reduction on other
machines or installations. Any worktree reading is reported separately as a
projection-state sensitivity check, never as an independent replication. Recorded
per the unanimous council decision at blocker `b-colleague-machine-readings`
(`agents/runtime/council/responses/spd-colleague-machine-readings.md`, option b).

`check_preamble_payload_budget` figures are **not** machine-local: that gate reads
the in-repo projection `dist/agent-src/rules/`, which regenerates from
`src/rules/` via `task sync`, so its numbers reproduce in any checkout and in CI.

**Method, and it is two methods.** Per-rule figures are **exact BPE**
(`js-tiktoken`, `cl100k_base`) over the rule body **below the frontmatter** —
`gpt_tokens(strip_frontmatter(text))`, the same function `lint_rule_norm_pin`
enforces the `norm` pin with. Gate totals are quoted in **each gate's own
basis**: `check_preamble_payload_budget` is `chars/4` over the projected tree
(its own `metric.basis`), `check_standing_rule_delivery` is exact BPE. The two
are never mixed inside one subtraction, and every figure below says which it is.

---

## 1. Per-rule before / after (step 2.1)

Basis: exact BPE, body below frontmatter. `norm` is the pin declared on the rule.

| Rule | before | after | Δ | `norm` pin | where the remainder went |
|---|---:|---:|---:|---:|---|
| `evaluator-independence` | 2,294 | 1,497 | **−797** | 1,500 | `docs/guidelines/agent-infra/evaluator-independence-mechanics.md` (new) |
| `context-hygiene` | 2,470 | 1,979 | **−491** | 2,000 | `docs/guidelines/agent-infra/context-hygiene-mechanics.md` (existing) |
| `roadmap-progress-sync` | 2,479 | 2,391 | **−88** | 2,400 | `docs/guidelines/agent-infra/roadmap-progress-mechanics.md` (existing) |
| **total, 3 rules** | **7,243** | **5,867** | **−1,376** | | |

**How the pins were derived, because a guessed pin makes the lint enforce a
guess** (roadmap Risk 3): each pin is the **measured post-diet body rounded up
to the next multiple of 50**. So every pin has a measurement behind it and the
rounding is the only invented part, stated rather than hidden. The remaining
headroom is 21 / 3 / 9 tokens — deliberately tight, because the pin is a ratchet:
its job is that the next paragraph of rationale reds the gate instead of landing
silently.

**How the three were selected.** From the Phase 0 absolute ranking
(`standing-payload-inflow-attribution.md` § 3), taking the highest-token rules
that are (a) not in the exclusion manifest recorded at
`b-behavioural-bench-spend`, (b) not kernel rules — the nine in
`src/scripts/_lib/kernel_rules.ts:1-11` are unwritable by an agent
(`src/scripts/hooks/block_kernel_rule_writes.ts`) — and (c) **already carrying a
P4 guideline destination, or worth one new file**. Criterion (c) is a scope
decision and is stated so it can be argued with: creating a guideline bumps four
generated count surfaces (`README.md` badge, `docs/architecture.md`,
`agents/index.md`, `docs/catalog.md`), and three new guidelines would have put
unrelated regeneration churn into a pilot diff — the "unreviewable diff" the
roadmap's own step 1.3 warns against. One new guideline was accepted for
`evaluator-independence` because its yield was the largest in the corpus.

Selection is **not** by recency, per Phase 0 Finding B: a recency-ranked pilot
would have targeted `decision-revisit-gate` (196 of its 200-line cap) and two
rules created inside the measurement window that are already terse.

---

## 2. The misses (step 2.2)

### 2a. A near-miss that is the useful row: `roadmap-progress-sync`, −88

It yielded **3.6 %** against `context-hygiene`'s 19.9 % and
`evaluator-independence`'s 34.7 %, and the reason is structural rather than
effort: after the one provenance block moved out, **every remaining section is an
Iron Law or an operational checklist.** Measured section sizes:

| lines | section |
|---:|---|
| 8 | `## Iron Law 1 — dashboard sync, same response` |
| 10 | `## Iron Law 2 — real-time checkbox cadence` |
| 11 | `## Iron Law 3 — no silent archive with unresolved deferred items` |
| 38 | `### Who resolves it — the preservation test` |
| 17 | ``### `deferred_policy` — a declared contract removes the round`` |
| 9 | `## Later disposition` |
| 10 | `## PR-gate` |
| 26 | `## Pre-send self-check — MANDATORY` |

**This is where the lever stops working, and that is the finding.** A rule whose
body is an Iron Law plus a route table plus a mandatory checklist is
*irreducibly normative*: the diet has nothing to relocate that a reader could
still be expected to reach on demand, because every line of it binds at the
moment of action. The 38-line preservation-test section is the clearest case —
its route table decides who may resolve a deferred item, so it cannot become a
guideline lookup without the rule losing the thing it exists to say.

### 2b. Examined and NOT targeted: `active-remediation` (#15, 1,808 tok)

Measured, then dropped from the pilot before any edit. Its eleven sections are
3–12 lines each and every one is an Iron Law, a ladder tier, a fires/does-not-fire
clause, or the `enforced_by: none` honesty note. Expected yield was in the same
band as `roadmap-progress-sync`'s −88, at the cost of a third guideline edit.
Recorded because "we looked and there was nothing here" is a different claim from
"we did not look".

### 2c. The largest un-taken target, named rather than silently skipped

**Five rules each carry a bespoke 10–20 line correction paragraph stating the
same fact** — which hosts bind `pre_tool_use`, which honour a deny, and what was
corrected on 2026-08-17:

    grep -ln "2026-08-17" src/rules/*.md
    → autonomous-execution.md · design-review-after-ui-write.md
      evaluator-independence.md · git-history-discipline.md · ui-audit-gate.md

All five link the same tabulation (`docs/contracts/hook-architecture-v1.md`), so
the fact is already single-sourced and only the *prose about it* is duplicated
five ways. One of the five (`evaluator-independence`) was dieted here; the other
four are the highest-yield remaining target in the corpus and were **left out of
this pilot deliberately**, because migrating four more rules in the same change
is the corpus-wide rewrite step 1.3 forbids. Named here so the next pass meets a
target rather than a search.

### 2d. Rules that were targeted and did not shrink: none

All three targeted rules shrank. The honest qualifier is that the pilot targeted
three, so "0 misses out of 3" says less than 2a–2c do about where the lever
stops.

---

## 3. Reconciliation against both gates, and the residual (step 2.3)

### 3a. `check_preamble_payload_budget` — observable, and it moved

The gate's own `chars/4` basis, in-repo, reproducible in CI:

| | tokens |
|---|---:|
| merge-base `c7e82087e` | 137,708 |
| after the diet | **136,348** |
| **delta** | **−1,360** |
| ceiling (baseline 102,520 + 5 %) | 107,646 |
| **residual over ceiling** | **+28,702** |

`baseline_tokens` is **unchanged at 102,520** — `git diff` over
`src/config/preamble-payload-budget.json` is empty for this branch, per AC-6. The
residual is recorded, not absorbed.

**The mechanism that would close the residual**, named because a residual with no
mechanism is a shrug:

1. **The 2c tranche** — four rules × ~10–20 lines of duplicated host-enforcement
   prose. At `evaluator-independence`'s realised rate that is roughly −2 k to
   −3 k tokens, and it is a single-concern diff.
2. **`norm` adoption across the ranked top-20**, which carry 43,146 exact-BPE
   tokens = 35.4 % of the corpus. At the pilot's realised 19 % mean reduction
   that tranche is worth ≈ −8 k.
3. **The exclusion manifest's 17 rules**, once `b-behavioural-bench-spend` is
   settled by the parked sibling. `design-fidelity` alone is the corpus's largest
   rule at 2,886 tokens.
4. **The skills catalog bucket** (14,486 tok) and the description cap, which this
   roadmap does not touch at all.

None of the four is claimed as sufficient. Together they are the same order of
magnitude as the residual, which is the honest statement: the lever is real, the
pilot proves it, and closing 28,702 needs several more tranches — not one.

### 3b. `check_standing_rule_delivery` — CANNOT observe this diet, and that is a finding

This is a defect in the criterion's premise, discovered by executing it, and it
is recorded rather than worked around.

The gate sums two layers. Measured on the maintainer's machine:

| layer | what it is | files | tokens (exact BPE) |
|---|---|---:|---:|
| global `~/.claude/rules/` | a snapshot of a **past `agent-config install`** — not generated from any working tree | 103 | 108,978 |
| project `<repo>/.claude/rules/` | generated from the tree, but under ADR-236 carries only the **package-only** rules | 15 | 11,968 |
| **TOTAL at the merge-base** | | **118** | **120,946** |

**All three dieted rules live in the global layer and none in the project layer.**
Verified: `ls ~/.claude/rules/` contains all three; the main checkout's
`.claude/rules/` contains exactly 15 files and none of the three. The global
copies still carry pre-diet bodies — `context-hygiene` reads **2,470** there and
`roadmap-progress-sync` **2,479**, matching the pre-diet measurements exactly.
`evaluator-independence` reads **1,580** there, a *different and older* revision
again, so the snapshot is stale in its own right and not merely one commit behind.

So this gate becomes able to see the diet only after someone runs
`agent-config install` to rewrite the developer's home directory. That is a
mutation of an environment outside this repository, and an autonomous run does
not make it.

**Projection-state sensitivity check, reported separately and NOT as a
replication.** Running `task generate-tools` inside a git worktree emits the
**unpartitioned** 114-file projection, because the ADR-236 partition needs
`installed.lock` fingerprinting and that is checkout-local. The gate then reads
**204,392 tok over 217 files with "100 rules in both layers (0 duplicate, 100
divergent)"**. That number measures the worktree's projection state, not the
diet; comparing it to 120,946 would compare two different projection states,
which the council decision at `b-colleague-machine-readings` explicitly forbids.
It is recorded because the trap is invisible — a wrong number here looks exactly
like a real regression.

**Consequence for AC-5, and the descope.** AC-5 asked this gate for a lower
total. It cannot supply one without the global reinstall above, and re-scoping it
to the sibling gate is a criterion-weakening that needed a council decision the
run could not obtain — the council returned **INCONCLUSIVE (0/2 present, quota
exhausted: anthropic 53/50, openai 50/50)**. AC-5 is therefore **descoped to
`agents/roadmaps/stubs/standing-rule-delivery-observability.md`** with the
measurement above and the mechanism that closes it, rather than marked satisfied
on a number that does not exist. The substantive reduction is not lost — it is
recorded in § 3a against the gate that can observe it.

---

## 4. Reproduction

```bash
# § 1 — per-rule bodies, exact BPE, the same function the pin is enforced with
./scripts-run src/scripts/lint_rule_norm_pin            # pins + the un-pinned count

# § 3a — the observable gate, and the two-sided delta
./scripts-run src/scripts/check_preamble_payload_budget
./scripts-run src/scripts/check_standing_payload_delta --base "$(git merge-base origin/main HEAD)"

# § 3b — the unobservable gate, main checkout only
./scripts-run src/scripts/check_standing_rule_delivery
ls ~/.claude/rules/ | wc -l ; ls .claude/rules/ | wc -l

# § 2c — the largest un-taken target
grep -ln "2026-08-17" src/rules/*.md
```
