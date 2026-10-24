<!-- evidence-type: analysis -->

# Contract-and-classification ledger for the 16 live-tree checks — provisional

Step 7.1 of `road-to-authority-routing-mechanism`, D30's owed item. A provisional
verdict per check, made under existing authority. This is the first of three
trust events D30 separates, **evidence ledger → classification verdict →
governed registry entry**. It is not a registry entry and claims no independent
approval. Promoting any row into a governed registry needs the second principal
`external-bootstrap-boundary-for-phases-2-3` names.

## How each row was built

The population is the 16 checks D14 classified, as listed in
`agents/evidence/analysis/live-tree-check-remeasure-20261017.md`. Each row was
read from the check's own source: its header contract, plus a grep for a
baseline, a clock, git or network access, and an allowlist. Observed red or
green is **not** an input. D14 refused to read class off a failure, and this
ledger keeps that refusal. Where the source states its own contract ("not a
build failure", "may only go down"), the row cites it.

Vocabulary, from D24 and D21:

- **invariant** — a property that must always hold. It has no baseline, or a
  shrink-only grandfather list. A time-qualified invariant names its clock and
  window.
- **snapshot** — compared against a recorded baseline that a governed act can
  move in the permissive direction.
- **tolerance** — a bounded range with a stated bound **and** a named party
  accepting the risk.
- **observation** — reported, never blocking, by its own contract.

Rows are per aspect, so one check can carry more than one class.

## The governing definition — revision 4

Both seats of the closure round on revision 3 (D33) asked for this before the
verdict is relied on. anthropic made it the condition of acceptance. It binds
every row below:

> **A classification attaches to one currently implemented assertion under one
> explicitly named invocation mode. It is semantic: it states what the
> assertion means, independent of the exit status the script happens to return
> today. Current enforcement is recorded separately, in the next section.
> Proposed behaviour is non-binding migration metadata and is excluded from the
> closure totals.**

The definition has three consequences:

- the two *target* rows of checks 9 and 12 are migration notes, not
  classifications;
- row 16's *store absent* is an observation by its own contract, while its
  current exit 1 is a recorded divergence, not part of the class;
- the mode-qualified rows of checks 8, 10 and 11 classify the assertion in that
  mode only.

**Which checks.** The population is the 16 checks the 2026-10-10 round measured
red or classified on a clean `origin/main` worktree. Its record is
`agents/evidence/council/live-tree-check-classification-20261010.md`, and the
same 16 are re-listed in
`agents/evidence/analysis/live-tree-check-remeasure-20261017.md`. That record is
the Phase 7 start inventory openai asked to have cited.

## Aggregation rule and mechanical reconciliation — revisions 5 and 6

The tenth round (D34) accepted the governing definition. It withheld closure
because the prompt showed neither the rows nor a check-to-row mapping. anthropic
also rejected *"at least one classified aspect per check"* as an invented
aggregation rule. Revision 5 replaces it:

> **A check is classified when every one of its binding aspects (every row
> that is not a migration note) carries one of the four classes. One
> classified aspect never covers a sibling.**

`agents/evidence/analysis/gate-ledger-reconcile.mjs` checks the rule
mechanically. It parses three things:

- the Phase 7 start inventory table in
  `agents/evidence/council/live-tree-check-classification-20261010.md`;
- this ledger's table;
- the invocation inventory.

It exits 1 unless all of these hold:

- the three name the same 16 checks;
- every binding aspect carries a class;
- every target row sits beside its current-scope row.

It was shown to fail: with one class removed from a row it printed
`unclassified binding aspect: check_knowledge_cards / C4 trust tag`.


**Revision 6** answers the eleventh round (D35). Both seats found the
row population was the ledger's own, so the parser could not see an omitted
mode. They named `check_composite_arming --self-test` as the missing row and
challenged the *store malformed* row. The reconciler now also extracts every
`--flag` literal from each check's **source**. Each one must be either:

- declared as changing no assertion (presentation, input, write mode, or a
  string that is not a flag), or
- named by a binding row of that check.

An unknown flag fails the run. The population is mechanical, and the category
list is visible in the script. It was seen to fail: with the `--global` row
removed it printed
`unclassified invocation mode: check_knowledge_cards --global`.

The source scan surfaced eight rows revision 5 lacked:

- the self-test modes of checks 2, 3, 7 and 16;
- `--global` on check 10;
- the legacy-entry warning in check 12, in default mode and in `--strict`;
- row 16's partial malformation.

The *store malformed* row was wrong and is corrected. The code exits 1 only
when malformed lines leave no usable record.

**Representative executions** of the contested check, against `--store` files
in a temporary directory:

| Store | Exit | Ledger row |
|---|---|---|
| absent | 1 | *store absent*: observation, with the exit-1 divergence recorded |
| every line malformed | 1 | *store yields a usable record*: invariant |
| one malformed line, one usable | 0, and the dropped line is named as `precondition_unmet` | *partial malformation*: observation |
| one usable line | 0 | arming verdict: observation (not armable) |

Output on revision 6 (`node agents/evidence/analysis/gate-ledger-reconcile.mjs`, exit 0):

```text
check | binding aspects | all classified | classes | migration notes
check_gate_completeness | 3 | yes | invariant 3 | 0
lint_ticked_unmet_criteria | 2 | yes | invariant 2 | 0
check_rule_invariants | 2 | yes | invariant 2 | 0
check_augment_description_cap | 1 | yes | invariant 1 | 0
check_trigger_evals | 2 | yes | invariant 2 | 0
lint_subagent_determinism | 1 | yes | invariant 1 | 0
lint_rule_enforcement_declaration | 2 | yes | invariant 2 | 0
check_token_quality_golden | 3 | yes | invariant 2, observation 1 | 0
check_council_layout | 1 | yes | invariant 1 | 1
check_knowledge_cards | 9 | yes | invariant 7, observation 2 | 0
check_public_links | 6 | yes | invariant 5, observation 1 | 0
lint_agents_layout | 3 | yes | invariant 2, observation 1 | 1
lint_eval_freshness | 1 | yes | invariant 1 | 0
lint_readme_jargon | 1 | yes | invariant 1 | 0
lint_readme_serial_comma | 1 | yes | invariant 1 | 0
check_composite_arming | 5 | yes | invariant 2, observation 3 | 0

check | flags in source | assertion-changing flags | each named by a binding row
check_gate_completeness | --quiet | — | yes
lint_ticked_unmet_criteria | --root --self-test | --self-test | yes
check_rule_invariants | --help --mutation-selftest --root | --mutation-selftest | yes
check_augment_description_cap | --root | — | yes
check_trigger_evals | --help --quiet --today | — | yes
lint_subagent_determinism | --quiet | — | yes
lint_rule_enforcement_declaration | --quiet --root --self-test --write-baseline | --self-test | yes
check_token_quality_golden | --help --json --require-complete --scope | --require-complete | yes
check_council_layout | --quiet | — | yes
check_knowledge_cards | --check-urls --dir --freshness-days --global --help --is-ancestor --strict | --check-urls --freshness-days --global --strict | yes
check_public_links | --help --json --list --strict | --strict | yes
lint_agents_layout | --quiet --strict | --strict | yes
lint_eval_freshness | --help --quiet | — | yes
lint_readme_jargon | --quiet | — | yes
lint_readme_serial_comma | --quiet | — | yes
check_composite_arming | --publish --record-composite --self-test --store | --self-test | yes

rows 45 · binding 43 · migration 2 · {"invariant":35,"snapshot":0,"tolerance":0,"observation":8}

OK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row; every assertion-changing flag in each check's source is named by a binding row.
```

What it does not establish: that row 16 is the only divergence between class
and current exit behaviour. That finding comes from reading the inventory, not
from running each check per mode. anthropic asks for a per-row schema with
`expected_exit`, `current_exit`, `divergence` and `last_verified`, maintained
by CI. That is a 7.2 item and is carried there.

## Row ids and invalidation — revision 7

**Row ids.** Every row carries a stable id `R<check>.<letter>`. Ids are never
reassigned. A new row takes the next unused letter of its check, and a removed
row's id is not reused. The reconciler fails on a missing or duplicate id.

**Invalidation.** The verdict holds only for the source and wiring it was built
against. The reconciler compares each pinned file's current git blob with the
pin below. A mismatch makes it fail with the verdict **stale** until the ledger
is reviewed against the change and the pins are renewed. This is the
kill-switch both seats asked for: if a check's code, flags or wiring changes
without a matching ledger update, 7.1 reopens. It is a measurement, not a CI
gate. Nothing runs it automatically, and 7.2 has to run it before relying on
any row.

**Phase 7 start manifest (revision 10).** openai, round 14: closure over the
current set is not closure over the historical one. Phase 7 start manifest: measured at `bbe5b73be4f06faa528d494a271d2c8b21e28bb2`, recorded in `7a7a55b2d8947d2c2e26ff59862bc8e9fac3f573`.

The 2026-10-10 round measured the population on a clean `origin/main`
worktree at the first commit, and its record landed in the second, unchanged
since. The reconciler checks three things against git, not against this file:

- the record equals the version that landed;
- every one of its 16 checks existed at the measured commit;
- every one still exists under the same path today, so none was renamed,
  merged or removed.

`R1.c` was counted as a binding row from revision 3 to revision 8 and withdrawn
in revision 9. The withdrawal and its reason sit on the row itself.

**Ledger table, pinned (revision 10).** A row edited after the independent
review would otherwise pass silently. The reconciler hashes the table rows. The
recorded value is the ledger table: sha256 `a36ea7fffc461b6c22ef98b663c7d7f97ba82b165e3c7e67412bd13d3f2d27a1`.

**Helpers, pinned as a closure (revision 9).** openai, round 13: the checks
import helpers, and the per-file pins below covered none of them. The
reconciler recomputes the transitive closure of relative imports from the 16
checks on every run, and hashes the sorted list of path and git blob pairs. The
recorded value is the helper closure: 51 files, sha256 `9243c1a7c1881c00581a25e5290d6eb8eaa0ecf8a2ea619209c69ae9137eae87`. Renewed once, on 2026-10-24, after a trunk merge changed `_lib/settings_removed_keys.ts` and `_lib/settings_renamed_keys.ts`. The re-attestation round answered 2/2 *no change* to any classified assertion: `agents/evidence/council/gate-ledger-pin-reattest-20261024.md`. The previous value was `a47d2a77…3b48`.

Any changed, added or removed helper on the closure marks the verdict stale.

**The pins as one attested set (revision 19).** Round 24 asked that the inputs
be attested as one immutable unit, not pin by pin. The reconciler hashes the
recorded pin lines, the recorded table digest and the recorded closure digest.
The recorded value is the attested set: sha256 `107500cc38617cd83381a283324b593ed5be0c28729e71731fe9f750ccbfc38c`.

A pin line changed without this line is refused as a broken set, not as a stale
pin. A renewal therefore replaces the whole set in one diff, and rollback
restores the last attested set, never selected pins. This value covers the pins
as they stand: the revision-16 attested values, plus the two new pins of
revision 18. Round 25 attests that set's renewal.

A new dependency is caught as well, because the closure is recomputed rather
than listed.

| Pinned file | git blob |
|---|---|
| `src/scripts/check_gate_completeness.ts` | `bc78db7a0c5504c3fc62aa3cd1bcad89b5a798f9` |
| `src/scripts/lint_ticked_unmet_criteria.ts` | `a76509077375541f45c2b97ed5082875206ba538` |
| `src/scripts/check_rule_invariants.ts` | `be18948528d6db67e5c32e9433e95303e0cf28db` |
| `src/scripts/check_augment_description_cap.ts` | `fcb99809b15f46a1d7e922e007ead14b1eab90ec` |
| `src/scripts/check_trigger_evals.ts` | `708f44ee039768315e7e1dc3621efb38018e4c42` |
| `src/scripts/lint_subagent_determinism.ts` | `eb3a64d19aab5ddf89e15f7e43ef7281eddf8660` |
| `src/scripts/lint_rule_enforcement_declaration.ts` | `4595dd8e8255d10e6bd1ddbf645dce0913d191a0` |
| `src/scripts/check_token_quality_golden.ts` | `cac8368a811fee4deb566fd714292968d1caa4bb` |
| `src/scripts/check_council_layout.ts` | `1ddc4bff01118f6077365a168f0c415e6d77d265` |
| `src/scripts/check_knowledge_cards.ts` | `ceb804c2938856b00dd18235f0129902661572d9` |
| `src/scripts/check_public_links.ts` | `d0fda1f358b52e9c089ad0c7bc3099af75d04262` |
| `src/scripts/lint_agents_layout.ts` | `6faa5027d9c3d34d1b54c2d10ff2472d4d1a720e` |
| `src/scripts/lint_eval_freshness.ts` | `4321c87b3b20a3253118c913560a6b9baaf595a7` |
| `src/scripts/lint_readme_jargon.ts` | `d0ffe1974b02cceea8cc0d0961e598fbd5e6c9b2` |
| `src/scripts/lint_readme_serial_comma.ts` | `825b1fe415522c322af4436355348f17d05655a2` |
| `src/scripts/check_composite_arming.ts` | `899e5d1fa56011a583aca46a846b2c26451e288f` |
| `agents/evidence/analysis/gate-branch-inventory-20261024.json` | `119214ea142393c7254cae40e080153728e10fb0` |
| `agents/evidence/analysis/gate-branch-mapping-20261024.json` | `c296fd9f02c1f0e83688da3f596cbb19e079665e` |
| `agents/evidence/analysis/gate-branch-mapping-review-20261024.json` | `46227ecdae464df420e5aec60910a1b7a497e686` |
| `agents/evidence/analysis/gate-ledger-reconcile.mjs` | `906f66045927abfba9889d382ed123db5fe35f81` |
| `agents/evidence/analysis/gate-ledger-executions.mjs` | `b330f3e9671d4d9e58baf9e1a59e32bc473b3756` |
| `agents/evidence/analysis/gate-branch-reconciliation-20261024.md` | `d25580a37bfe75418f0aa652fc9b31155f6c4356` |
| `agents/evidence/analysis/gate-ledger-rerun-20261024.md` | `fc0c90dfbb56c2820e2669ad67fac1a969bd9782` |
| `agents/evidence/analysis/gate-branch-site-dispositions-20261024.json` | `67a43f237b7be386b9630fac5396af31fb53eae2` |
| `agents/evidence/analysis/gate-branch-sites.mjs` | `d926f34aa02b93f428b5a5f521f56317167047f7` |
| `agents/evidence/analysis/gate-phase7-harness.mjs` | `672ce60e22f56fd483b31ed84b13266a90b821c0` |
| `agents/evidence/analysis/gate-invocation-inventory-20261024.md` | `1f3ff61036ccbd9ba42f9acd4eec5b5c2697b4f9` |
| `agents/evidence/analysis/gate-class-grounds-20261024.json` | `3ae580599ebaa4d88a1aa7145c7c9364165f61a1` |
| `Taskfile.yml` | `42fb51998a3069fd9d78af2e0b94e016b9778372` |
| `taskfiles/bench-ab.yml` | `4d4aee8eaba288f2ff2ecfd9f6afdb39c684a5c0` |
| `taskfiles/bench-ui.yml` | `07c2a71d5e3568f760f9ec1da66f40b141008d30` |
| `taskfiles/ci-fast.yml` | `aedb0b222ef39622a6dc66abe6d94f95eaad46b7` |
| `taskfiles/content.yml` | `2c8f8c7528cef2d24f4085bb00757d90f9d85e99` |
| `taskfiles/dev.yml` | `ecde3261b4c09b48991f1c3bd4fcdb28c272c92c` |
| `taskfiles/engine.yml` | `be2c6e7b78ca288fd5f137037d29a83c04487786` |
| `taskfiles/mcp.yml` | `8285c13dde4339de534a06cf080807d5e52046ee` |
| `taskfiles/release.yml` | `598ff67a23516fd3daf73238dd93657e0e2bfc78` |
| `taskfiles/value.yml` | `cd2ece6e510d1bad1e03bb54b1bafbb436587d1d` |
| `.github/workflows/standing-payload-delta.yml` | `82eb039cd82226e642c24df634c7ee7ec3ad0cf5` |
| `.github/workflows/rule-backstops.yml` | `015473465df2afb82e32ada7fce9d458d6c17055` |
| `.github/workflows/tests.yml` | `0e1e0c9882919e10ff783780315a84b5e5f5dea3` |
| `agents/evidence/analysis/gate-wiring-review-20261024.md` | `bcb96b497545a23bee48a25bc23ec6d388b418d6` |

**Wiring, pinned as whole files (revision 24).** Round 28 rejected the
step-scoped pins of revision 23 as heuristic. Round 29 (D49, A5) converged on
whole-file pins. Those pins cover `Taskfile.yml`, every taskfile it includes and
the three Phase 7 workflows, all at revision 16. A hashed review record covers
every change since then:
`agents/evidence/analysis/gate-wiring-review-20261024.md`.



## Independent branch inventory — revision 8

The twelfth round (D36) asked for an inventory of assertion-producing
**branches**, not flags, *"reproduced independently of the ledger author"*. A
separate agent session produced it. It was told to read only the 16 scripts and
the helpers they import, to open nothing under `agents/`, and to enumerate
without classifying. It never saw this ledger. The result is
`agents/evidence/analysis/gate-branch-inventory-20261024.json`: 198 branches,
each with its file and line, effect, exit code, and controlling predicates
(flags, environment variables, file state, network, git, clock). The level of
independence is another session of the same model. It is not another provider.

The ledger author then mapped each branch, in
`agents/evidence/analysis/gate-branch-mapping-20261024.json`, either to a
binding row or to one of eight declared non-assertion categories:

- usage;
- could-not-run;
- aggregate exit;
- informational;
- write mode;
- presentation;
- silent pass;
- unreachable.

The reconciler checks both directions. Every branch must land on a binding
row of its own check or on a declared category. Every binding row must be
reached by at least one branch, so the ledger has no phantom rows. It was seen
red when the E1 row was removed.

**What the inventory changed in the ledger:**

- **New rows.**
  - `R10.j`: E1, the required keys of an experience card.
  - `R11.g`: no public link into `agents/contexts/`.
- **`--global` made atomic.** The helper `R10.i` named is split into G1 to G6
  (`R10.i`, `R10.k` to `R10.o`), as openai required.
- **Rows corrected.**
  - `R12.c` and `R12.d`: the warnings exist only in consumer mode, so in this
    repository `--strict` changes nothing.
  - `R1.a`: the ratchet fails on three verdicts, including staleness after 56
    days.
  - `R16.b`: an empty store also fails. Executed: a store of valid JSON lines
    that are not usable readings exits 1 and is counted as malformed, so the
    gap round 12 suspected does not exist.
- **Self-tests executed.** The four self-test and mutation-test modes were run,
  and each passed: 7/7, 7/7, 7/7, and the mutation test.

**Defects the inventory found in the checks themselves.** None of these is a
classification. They are recorded so they are not lost, and they are carried to
7.2:

- *Silent passes*:
  - `check_augment_description_cap` exits 0 with zero rules scanned (no
    dead-scope guard);
  - `check_knowledge_cards` exits 0 with no card directory or no cards, and
    skips C5 when git is missing;
  - `check_public_links` skips a link that resolves outside the repository.
- *Promised exit codes with no path*:
  - `check_knowledge_cards` promises exit 3 for internal errors;
  - `lint_rule_enforcement_declaration` promises exit 2 for usage errors and
    ignores unknown flags.
- *Working-directory scope*: checks 9, 12, 14 and 15 resolve their scope
  against the working directory, not the repository root.

Result:

```text
branches 198 · mapped to rows 106 · {"op:could-not-run":48,"op:informational":7,"op:usage":21,"op:unreachable":1,"op:silent-pass":5,"op:aggregate":7,"op:write":2,"op:presentation":1} · binding rows reached 50/50
rows 52 · binding 50 · migration 2 · {"invariant":42,"snapshot":0,"tolerance":0,"observation":8}
OK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row; every assertion-changing flag in each check's source is named by a binding row; every row has a unique id; 22 pinned files are unchanged; every branch of the independent inventory maps to a binding row or a declared category, and every binding row is reached.
```

## Independent mapping review — revision 9

The thirteenth round (D37) answered at one seat in two attempts, because the
anthropic seat returned nothing both times. So it is a single-seat reading,
not convergence. openai accepted the branch inventory as closing the
*discovery* part, and named the remaining gap: **the assertion versus
non-assertion mapping was self-certified.** It asked for an independent
semantic review of all 198 mappings, with decisions by branch id. It also
asked for helper pins, revision binding of the proof artifacts, corrected
applicability on `R10.f` and `R11.a`, and a fail-closed entry condition for
7.2.

A separate agent session reviewed every mapping against a written definition
of an assertion-producing branch:
`agents/evidence/analysis/gate-branch-mapping-review-20261024.json`. It found
182 agree, 12 disagree and 4 unsure. **All 12 disagreements are adopted**, and
the reconciler now fails on any disagreement that is not.

- The ledger author had **swapped** `R16.c` and `R16.d` for three composite
  branches.
- Seven dead-scope and precondition branches are `op:could-not-run`, not
  assertions. One of them removed the only branch behind `R1.c`, so **`R1.c`
  (scan scope) is withdrawn**: a dead scope is the check unable to measure,
  not a finding about the repository. Its id is not reused.
- `R16.b` no longer claims the empty store.

Of the four unsure verdicts:

- the duplicate exemption key is now named in `R2.a`'s property;
- the outside-root link skip gets its own category, `op:scope-exclusion`;
- the two read-or-parse conflations stay on their rows (`R5.b`, `R13.a`),
  noted here.

**Applicability corrected:**

- `R10.f` holds only when git is runnable;
- `R11.a` holds only for links that resolve inside the repository;
- `R4.a` holds only when its scan finds at least one auto rule, with the
  zero-rule silent pass carried to 7.2.

**Helpers and proof artifacts pinned.**

- The transitive helper closure, 51 files, is pinned as one digest and
  recomputed on every run.
- The branch inventory, the mapping, the review, the reconciler and the
  execution script are pinned by blob.

A change to any of them marks the verdict stale.

**Executions, reproducible.** `agents/evidence/analysis/gate-ledger-executions.mjs`
writes its own fixtures and prints each command with its exit code:

```text
R16.a–d | --store absent.jsonl | exit 1 | which is NOT the same as "armable".
R16.a–d | --store all-malformed.jsonl | exit 1 | ❌  ../../../../../../..<tmp>/all-malformed.jsonl: 2 malformed line(s) and no usable record. A store that parses to nothing must not read as "no readings yet".
R16.a–d | --store valid-json-not-usable.jsonl | exit 1 | ❌  ../../../../../../..<tmp>/valid-json-not-usable.jsonl: 2 malformed line(s) and no usable record. A store that parses to nothing must not read as "no readings
R16.a–d | --store partial.jsonl | exit 0 | · sessions: 1 distinct of 2 required (short by 1) — the floor exists because the instability it excludes was measured on ONE machine, so N readings from one ses
R16.a–d | --store valid.jsonl | exit 0 | · sessions: 1 distinct of 2 required (short by 1) — the floor exists because the instability it excludes was measured on ONE machine, so N readings from one ses
R16.e | check_composite_arming --self-test | exit 0 | check_composite_arming --self-test: 7/7 case(s) behaved (2 rejecting, floor 5)
R2.b | lint_ticked_unmet_criteria --self-test | exit 0 | lint_ticked_unmet_criteria --self-test: 7/7 case(s) behaved (4 rejecting, floor 6)
R7.b | lint_rule_enforcement_declaration --self-test | exit 0 | lint_rule_enforcement_declaration --self-test: 7/7 case(s) behaved (5 rejecting, floor 6)
R3.b | check_rule_invariants --mutation-selftest | exit 0 | ✅  mutation-selftest passed: removing "Hard Floor wins, always — autonomy / roadmap / standing instruction never lift." from src/rules/agent-authority.md is det
```

**7.2's entry condition, fail-closed.** 7.2 may rely on this ledger only
when `node agents/evidence/analysis/gate-ledger-reconcile.mjs` exits 0 at
the revision 7.2 changes. A stale, failed or absent reconciliation blocks
reliance. That condition is written into step 7.2 itself, and 7.2's own test
runs the reconciler first.

## The closure standard and its eight items — revision 15

On 2026-10-24 the owner chose **Option A** for 7.1's closure standard, by
answering "1" (`agents/evidence/owner-directives/2026-10-24-7-1-closure-standard.md`,
D44). Under it, the classification ledger, a fail-closed consumption gate and
reopening triggers close 7.1. Round-20 items 2 and 3, the 330-row manifest and
the 330→16 re-derivation, are not required. Items 1 and 4–8 are, and this
section discharges each one with its test.

**Item 1 — the execution universe and the red predicate, recorded and
executable.** `agents/evidence/analysis/gate-phase7-harness.mjs`:

- **Discovery.** Every `src/scripts/check_*.ts` and `lint_*.ts` at a
  revision. `--universe bbe5b73be` lists **330**, the Phase 7 count.
- **Invocation.** `./scripts-run src/scripts/<id>`, no arguments, from the
  repository root, with a 240 s timeout.
- **Predicate.** Decision order, first match wins:
  1. no exit code (spawn failure or timeout) → `not-run`, never green;
  2. exit 0 → `green`;
  3. exit 2 with a usage line → `needs-argument`;
  4. a missing generated projection (`dist/`, `.claude/`, `.augment/`) →
     `needs-build`;
  5. otherwise → `red`.
- **Prerequisite.** Projections built, as in the Phase 7 measurement.

Exercised on three checks today: `lint_readme_serial_comma` green,
`check_composite_arming` red, `lint_subagent_determinism` green. The two
exclusion branches of the predicate were not exercised in this run.

**Item 4 — class predicates, mutually exclusive by decision order.** For one
aspect under one mode, the first rule that holds gives the class:

1. **observation.** The aspect's own contract leaves the run non-blocking:
   exit 0, *"not a failure"*, *"never a build failure"*.
2. **tolerance.** A stated bound, a named risk owner and an expiry.
3. **snapshot.** Compared against a recorded baseline that a governed act
   may move in the permissive direction.
4. **invariant.** None of the above: the property must hold whenever the
   aspect applies.

The reconciler checks each row's own evidence cell against its class: an
observation must state its non-blocking contract, a tolerance its bound, owner
and expiry, a snapshot its baseline. Ambiguity fails the run and never
defaults to a class (self-test case: an observation row with the exit-0
contract removed is refused).

Formalising the predicates found one misclassification. **`R10.d`, C3 live
URL, was an observation; it is now an invariant in `--check-urls` mode.** With
the flag, an unreachable URL is an error and the run exits 1. Network
dependence is an environment property (assurance: environment-dependent), not
a non-blocking contract.

**Item 5 — a bounded emission inventory over a declared surface.**
`gate-branch-sites.mjs` declares:

- **Surface.** The 16 checks' own source text.
- **Vocabulary.** A non-zero `return`, `process.exit(n)`,
  `process.exitCode = n`, `throw`, and `push` into a reported list.
- **Excluded surfaces.** Imported helpers: each helper failure a check can
  surface is an inventoried branch naming the helper, and the closure is
  pinned. Spawned subprocesses (`git`, `node`): their failures reach a check
  only through the branches that handle them.

Result: 159 sites, 132 inside inventoried branches, 27 disposed, 0
undisposed. `--self-test` plants one site of each of the five types and
requires each to be refused (6/6). `process.exitCode = main()` in
`check_gate_completeness` is not a literal, and its values are the `return`
sites of `main`, which are covered.

**Item 6 — provenance: what was derived independently, and what was rerun.**

| Artefact | Produced by | Independent of the ledger author? |
|---|---|---|
| Phase 7 population (16 of 330) | the 2026-10-10 measurement and council record, landed in `7a7a55b2` | yes, an earlier round; checked against git |
| branch inventory (198 branches) | a separate session, without sight of the ledger | yes (same model, not another provider) |
| mapping review (182/12/4) | a separate session | yes (same model) |
| site scan (159 sites) | `gate-branch-sites.mjs`, no model | mechanical; vocabulary chosen by the ledger author |
| ledger, mapping, dispositions, reconciler, harness | the ledger author | no |
| two clean-checkout reruns | a separate session | *reruns*: they prove determinism, not independent derivation |

**Item 7 — validity, quarantine and reopening.** `gate-ledger-reconcile.mjs`
returns one of three states:

- **valid** (exit 0): every check passes.
- **quarantined** (exit 3): the only failures are stale pins. A source,
  helper, wiring file, artefact or ledger-table change was not yet
  re-attested. The record is not consumable, and 7.1 is not reopened.
- **invalid** (exit 1): any other failure, such as an omitted or unmapped
  branch, a review verdict not honoured, a class predicate violated, or an
  undisposed site. **7.1 reopens.**

A demonstrated misclassification, omission or coverage defect in the
declared surface reopens 7.1. Proposing another analysis technique does
neither. Self-test: a stale pin yields `quarantined`; a laundered mapping
yields `invalid`.

**Item 8 — the 7.1 consumption contract.**
`node agents/evidence/analysis/gate-ledger-reconcile.mjs --status` prints
JSON. The fields are the record path, the ledger blob, the artefact, the scope
(Phase 7 commit, checks, binding aspects, branches, classes), `state`,
`reasons` and `consumable`. Its exit code is 0, 3 or 1. 7.2 consumes the
ledger **only** when the run on the candidate merge result reports
`consumable: true`. Gate membership stays outside 7.1.

## Item 4 per aspect — revision 16

The twenty-first round (`agents/evidence/council/gate-classification-items-20261024.md`)
split on item 4. The anthropic seat ruled it not met because the evidence offered
only a summary verdict, with no record that each of the 49 binding aspects was
checked. The openai seat ruled it met. The stricter reading is taken.

Two changes close the shortfall.

**The predicates now derive a class instead of vetoing one.** Before revision
16, the reconciler checked only the non-invariant classes against their own
predicates, and checked nothing on an invariant row. It now applies the
predicates to every binding aspect's evidence cell in decision order:

1. observation, a stated non-blocking contract;
2. tolerance, a bound, a risk owner and an expiry;
3. snapshot, a permissive baseline;
4. invariant, the remainder.

The first predicate that holds is the derived class, and it must equal the
recorded class. The classes are therefore mutually exclusive by construction.
An invariant now also proves that no earlier predicate holds.

**What the first run found.** The first run flagged three invariants, `R2.b`,
`R3.a` and `R7.b`, as deriving snapshot.

- `R2.b` and `R3.a` say *"no baseline"*. That is a negated mention, and the
  snapshot predicate now discounts it.
- `R7.b` described a different mode, `--write-baseline`, in words that read as a
  positive baseline claim. That mode asserts nothing and is dispositioned as
  `op:write`. Its sentence now says only that, so the evidence cell describes R7.b
  alone. The ledger-table pin is renewed for that one cell.

A new self-test case plants a permissive baseline in an invariant's evidence and
requires the refusal: 17/17. The reconciler pin is renewed for the code change.

**The per-aspect record** is now the one in revision 17 below.

## Item 4, a positive invariant predicate — revision 17

The twenty-second round (`agents/evidence/council/gate-classification-item4-20261024.md`)
re-attested both pin renewals of revision 16 **2/2** (*renew*). It split on item 4
again, this time the other way:

- **openai: not met.** `invariant` had no predicate and was an unconditional
  fallback.
- **anthropic: met.** It named the same weakness: *"deriving invariant by
  absence … inverts the fail-safe direction."*

The stricter reading is taken.

`invariant` now has a positive predicate, `INVARIANT_EVIDENCE`. The evidence
must name its fixed contract (fixed, frozen, no baseline, contract, equality,
may only go down or shrink) or the failing outcome that enforces it (error,
fail, exit 1, returns 1).

An aspect where no predicate holds now derives `unclassifiable`, and the
reconciler refuses it. It is never an invariant by default.

The first run found three invariant cells that stated no enforcing fact:

- `R10.l` said *"errors"*, and the predicate is now plural-aware.
- `R3.b` and `R14.a` each gained the verified fact:
  - `check_rule_invariants.ts:204-208` returns 1 on an undetected removal;
  - `lint_readme_jargon.ts:172-188` returns 1 above `MAX_HITS = 3`.

No class changed. A new self-test case removes an invariant's stated contract
and requires the refusal: 18/18. Reverting the fallback in a scratch run turns
that case red. Both pins are renewed for this diff, and that renewal goes to
round 23 per D38.

Revision 18 below supersedes that predicate. Its table is the current one.

## Item 4 from structured fields, not prose — revision 18

The twenty-third round (`agents/evidence/council/gate-classification-item4-r2-20261024.md`)
ruled item 4 **not met, 2/2**. A keyword predicate over evidence prose cannot
tell *"does not fail"* from *"fails"*. It shows that the ledger and its
classifier agree, not that each aspect satisfies its class.

Re-attestation of the revision-17 pins split: anthropic said *do not renew*,
openai said *renew*. Under D38 a split renews nothing, so both pins stay at
their revision-16 values. The record therefore reads **quarantined** until a
round attests the cumulative diff.

openai named the evidence that would change its verdict: *"structured fields
… asserted contract, enforcement mechanism, and failing outcome"*. Revision 18
removes every prose predicate. The classes now derive from structured fields
that the ledger author did not write.

- **invariant / observation.** These come from the `effect` of each branch that
  reaches the row.
  - The branch inventory was produced without sight of the ledger, and its
    branch-to-row mapping was independently reviewed.
  - Effects `error-exit-nonzero`, `throw` and `exit-code-only` block.
    `warning-exit-zero` does not.
  - `warning-exit-nonzero-only-with-flag` blocks only for a row the ledger marks
    *"in that mode"*.
  - Blocking-only derives invariant and non-blocking-only derives observation.
    Both, neither, or an unknown effect is refused.
- **snapshot / tolerance.** These need structured fields in
  `agents/evidence/analysis/gate-class-grounds-20261024.json`: a baseline, or a
  bound, a risk owner and an expiry. No such row exists, so a future one fails
  closed until it carries them.
- **A semantic class that differs from the behaviour.** This passes only as a
  structured divergence owed to 7.2. There is exactly one, `R16.d`. Its contract
  says *"never a build failure"*, but `check_composite_arming.ts:286-293` exits
  1. Reconciling that exit is already a 7.2 entry condition. A divergence record
  for a row that does not diverge is refused as stale.

Prose is no longer the interface. A self-test case rewrites R4.a's evidence
cell to *"does not fail; errors are informational; no contract"* and requires
that **no** class-predicate failure follows. Six further cases require
refusals:

- an observation reached by a blocking branch;
- an invariant reached only by a non-blocking branch;
- a flag-mode row that loses its mode;
- the divergence record removed;
- a false divergence;
- a snapshot without its baseline.

All 21 non-baseline cases behave. The baseline case is red only because of the
two unattested pins.

A new input-coverage check requires a pin on every structured input. Its first
run found the invocation inventory had **never been pinned**. That input and
the new grounds file are pinned now, as new pins, not renewals.

Revision 19 below supersedes that table.

## Item 4: modes, waivers and the attested set — revision 19

The twenty-fourth round (`agents/evidence/council/gate-classification-item4-r3-20261024.md`)
ruled item 4 **not met, 2/2**, and *do not renew*, 2/2. It gave seven
must-fixes.

| # | Must-fix | Revision 19 |
|---|---|---|
| 1 | Mode is read from prose (`/in that mode/`) | A structured `modes` map in `gate-class-grounds-20261024.json` (11 rows) |
| 2 | R16.d passes as a "divergence", which is not satisfaction | **Owner-reserved.** Both seats: fix R16.d's behaviour, or the owner amends item 4 to allow governed waivers. Routed to the owner as gate `7-1-r16d-waiver`. |
| 3 | A waiver must read `waived`, never derived | Reported as `waived`, and counted apart |
| 4 | No waiver for `mixed`, `unreached` or an unknown effect | Refused; self-test case |
| 5 | A waiver needs an approver, an issue, an expiry and a milestone | Refused without approver `owner`, an existing directive, an issue and an unexpired ISO expiry |
| 6 | Snapshot/tolerance metadata replaces behaviour | Now required in addition: such a row must also derive blocking behaviour |
| 7 | Attest the inputs atomically | One attested-set digest over all recorded pin lines, the table and the closure |

Must-fix 1 is checked in three ways:

- each structured mode must occur as a literal in the check's source;
- it must be named in the predicates of **every** branch that reaches the row,
  which is independent text;
- it must agree with the class cell.

All 11 modes pass all three.

On must-fix 7, a pin line changed without the set line is refused as a broken
set, so rollback restores whole sets.

The record is **invalid** until gate `7-1-r16d-waiver` is answered. R16.d's
waiver has no approver, so it is refused. That is the fail-closed state.

Self-test 28/29. The one red case is the clean baseline, which needs both the
owner's answer and the attested renewal. The renewal is not made here (D38).

Revision 21 below supersedes that table.

## Must-fix 5 closed, and the one residue — revision 20

The twenty-fifth round (`agents/evidence/council/gate-classification-item4-r4-20261024.md`)
found must-fixes 1, 3, 4, 6 and 7 **closed, 2/2**. It found must-fix 5
**open, 2/2**:

- `owed_to` was never read;
- the issue check was a length test;
- `2026-99-99` passed as an expiry.

It refused renewal until must-fix 5 is closed and the owner has answered.

Revision 20 closes must-fix 5. A waiver is now refused unless all four of these
hold.

1. **Milestone.** It names a roadmap that exists and a step that is open there.
   Ticking the step lapses the waiver.
2. **Issue.** Its issue text occurs verbatim in the named file. For R16.d that is
   the 7.2 entry condition, *"row 16's exit-1 divergence reconciled"*, in
   `gate-7-2-reliance-rules-20261024.md`.
3. **Approver.** It is `owner`, with a directive that is tracked in git at `HEAD`
   and names the row.
4. **Expiry.** It is a real calendar date that has not passed.

Six self-test cases cover the refusals. Self-test: 32/33. The one red case is
the clean baseline, red for the two reasons below.

**What no field can establish.** openai's strongest objection stands: *"a
literal `owner` value"* in repository content cannot prove that the owner
approved. Anyone with write access can author it. Binding approval to
independently verifiable provenance, such as a protected or signed directive,
is the second principal. It stays owner-reserved under
`external-bootstrap-boundary-for-phases-2-3`. A waiver is therefore only as
trustworthy as the directive's provenance, and the record says so.

**The residue.**

- **R16.d**, gate `7-1-r16d-waiver`: both seats route it to the owner. Both
  recommend correcting the behaviour, so that an absent store is *"not measured
  yet"* and exits 0 as the contract says, over a time-bounded waiver.
- **The attested-set renewal.** It is one council round after the owner
  answers. D38 forbids it before then.
- **Two more stale wiring pins.** The trunk merge of `5fac452056` changed
  `taskfiles/ci-fast.yml` and `.github/workflows/rule-backstops.yml`. Both diffs
  only switch `check_step_production_reach` to `--enforce`, and that script is
  not one of the 16 Phase 7 checks. They join the same set renewal and move no
  row.

## R16.d corrected, 49 of 49 derived — revision 21

The owner answered D46 with option **1**: correct the behaviour
(`agents/evidence/owner-directives/2026-10-24-7-1-r16d-behaviour.md`).

**The fix.** `check_composite_arming` now exits 0 when no store exists, as
*"not measured yet"*. A store that exists but cannot be read, a malformed store
and an empty store still exit 1.

`tests/scripts/composite_arming.test.ts` pins both halves:

- the absent-store test was seen red before the fix;
- the three present-but-failing tests go red when those branches are weakened
  to exit 0, which shows the gate was corrected, not weakened.

The script's self-test swaps its missing-store reject case for an accept case,
and adds a reject case for an unreadable path. That keeps it at two reject cases.

**The inventory, kept independent.** The fix changed check 16's branches and
moved its line numbers. A separate session re-inventoried
`check_composite_arming` from the source alone, without reading `agents/`:

- `c16-store-absent` is new (`warning-exit-zero`);
- `c16-store-unreadable` now means present but unreadable (`error-exit-nonzero`);
- `c16-armable` is new: the positive arming outcome, exit 0.

The mapping is:

- `c16-store-absent` → R16.d;
- `c16-store-unreadable` → `op:could-not-run`;
- `c16-armable` → R16.a.

A second separate session reviewed the three mappings: **3/3 agree**, recorded in
the mapping review. The two not-armable branches keep the `evaluate` lines their
own findings name in their ranges, and the site scanner is OK again (6/6).

**A reconciler defect found on the way.** It counted `exit-code-only` as
blocking even at exit 0, so the positive R16.a branch made R16.a read `mixed`.
`exit-code-only` now blocks only with a non-zero exit code. A self-test case
covers this, and it went red when the fix was reverted.

**The waiver path.** R16.d's waiver is removed. The waiver self-tests now run on
a synthetic divergence (R10.h, made blocking in the test inputs only). The 7.2
entry condition *"row 16's exit-1 divergence reconciled"* is marked done.

**State.** 49 of 49 aspects derive their class, with 0 waived and 0 refused.
The record is **quarantined** only by stale pins. Ten inputs have moved since
the revision-16 attested set. The one renewal round D38 allows attests them
together.

`node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects`:

| Row | Check | Recorded | Mode | Blocking branches | Non-blocking branches | Derived | Verdict |
|---|---|---|---|---|---|---|---|
| R1.a | `check_gate_completeness` | invariant | default | c1-ratchet-regressed, c1-ratchet-stale, c1-ratchet-unbaselined | — | invariant | derived |
| R1.b | `check_gate_completeness` | invariant | default | c1-ledger-fail-malformed, c1-malformed | — | invariant | derived |
| R2.a | `lint_ticked_unmet_criteria` | invariant | default | c2-duplicate-historical, c2-hit, c2-stale-historical | — | invariant | derived |
| R2.b | `lint_ticked_unmet_criteria` | invariant | default | c2-selftest | — | invariant | derived |
| R3.a | `check_rule_invariants` | invariant | default | c3-missing-file, c3-missing-string | — | invariant | derived |
| R3.b | `check_rule_invariants` | invariant | default | c3-selftest-undetected | — | invariant | derived |
| R4.a | `check_augment_description_cap` | invariant | default | c4-over-cap | — | invariant | derived |
| R5.a | `check_trigger_evals` | invariant | default | c6-last-eval-missing, c6-last-eval-stale | — | invariant | derived |
| R5.b | `check_trigger_evals` | invariant | default | c6-unreadable-json, c6-queries-empty, c6-query-no-q, c6-query-trigger-type, c6-split-list-empty, c6-split-item-empty, c6-no-shape, c6-one-class | — | invariant | derived |
| R6.a | `lint_subagent_determinism` | invariant | default | c5-no-frontmatter, c5-schema-version, c5-visible, c5-tools-dupes, c5-name-stem, c5-name-dup | — | invariant | derived |
| R7.a | `lint_rule_enforcement_declaration` | invariant | default | c7-undeclared-new, c7-gap-not-in-body, c7-baseline-stale, c7-baseline-shrink | — | invariant | derived |
| R7.b | `lint_rule_enforcement_declaration` | invariant | default | c7-selftest | — | invariant | derived |
| R8.a | `check_token_quality_golden` | invariant | default | c8-corpus-id, c8-id-format, c8-id-duplicate, c8-rules-empty, c8-rule-unknown, c8-nofire-kernel, c8-nofire-fires, c8-tag-not-fired, c8-scenario, c8-prompt, c8-label-status, c8-labelled-todo-rubric, c8-labelled-no-anchor | — | invariant | derived |
| R8.b | `check_token_quality_golden` | observation | default | — | c8-uncovered-warn, c8-missing-scenario-warn, c8-scaffold-notice | observation | derived |
| R8.c | `check_token_quality_golden` | invariant | --require-complete | c8-require-complete | — | invariant | derived |
| R9.a | `check_council_layout` | invariant | default | c9-root-stray, c9-noncanonical | — | invariant | derived |
| R10.a | `check_knowledge_cards` | invariant | default | c10-C1-size | — | invariant | derived |
| R10.b | `check_knowledge_cards` | invariant | default | c10-C2-pointer | — | invariant | derived |
| R10.c | `check_knowledge_cards` | invariant | default | c10-C3-local | — | invariant | derived |
| R10.d | `check_knowledge_cards` | invariant | --check-urls | c10-C3-url-status, c10-C3-url-unreachable | — | invariant | derived |
| R10.e | `check_knowledge_cards` | invariant | default | c10-C4-trust, c10-C4-type-wrong, c10-C4-type-missing | — | invariant | derived |
| R10.f | `check_knowledge_cards` | invariant | default | c10-C5-ancestry, c10-C5-span | — | invariant | derived |
| R10.g | `check_knowledge_cards` | invariant | --strict | c10-C6-source | — | invariant | derived |
| R10.h | `check_knowledge_cards` | observation | default | — | c10-freshness-warn | observation | derived |
| R10.i | `check_knowledge_cards` | invariant | --global | c10-G1-tier-missing, c10-G1-tier-invalid | — | invariant | derived |
| R10.k | `check_knowledge_cards` | invariant | --global | c10-G2-no-footer, c10-G2-field | — | invariant | derived |
| R10.l | `check_knowledge_cards` | invariant | --global | c10-G3-redaction | — | invariant | derived |
| R10.m | `check_knowledge_cards` | invariant | --global | c10-G4-sens-missing, c10-G4-sens-invalid | — | invariant | derived |
| R10.n | `check_knowledge_cards` | invariant | --global | c10-G5-field | — | invariant | derived |
| R10.o | `check_knowledge_cards` | invariant | --global | c10-G6-prohibited | — | invariant | derived |
| R10.j | `check_knowledge_cards` | invariant | default | c10-E1-required | — | invariant | derived |
| R11.a | `check_public_links` | invariant | default | c11-target-not-found | — | invariant | derived |
| R11.b | `check_public_links` | invariant | default | c11-target-no-stability | — | invariant | derived |
| R11.c | `check_public_links` | invariant | default | c11-experimental | — | invariant | derived |
| R11.d | `check_public_links` | invariant | default | c11-self-no-stability | — | invariant | derived |
| R11.e | `check_public_links` | observation | default | — | c11-beta-marker | observation | derived |
| R11.f | `check_public_links` | invariant | --strict | c11-beta-marker | — | invariant | derived |
| R11.g | `check_public_links` | invariant | default | c11-contexts-link | — | invariant | derived |
| R12.a | `lint_agents_layout` | invariant | default | c12-flat-file, c12-unknown-dir | — | invariant | derived |
| R12.c | `lint_agents_layout` | observation | default | — | c12-consumer-warning | observation | derived |
| R12.d | `lint_agents_layout` | invariant | --strict | c12-consumer-warning | — | invariant | derived |
| R13.a | `lint_eval_freshness` | invariant | default | c13-manifest-unreadable, c13-no-last-eval, c13-sha-mismatch | — | invariant | derived |
| R14.a | `lint_readme_jargon` | invariant | default | c14-over-budget | — | invariant | derived |
| R15.a | `lint_readme_serial_comma` | invariant | default | c15-serial-comma | — | invariant | derived |
| R16.a | `check_composite_arming` | observation | default | — | c16-armable, c16-not-armable-readings, c16-not-armable-sessions, c16-unusable-dropped | observation | derived |
| R16.b | `check_composite_arming` | invariant | default | c16-all-malformed | — | invariant | derived |
| R16.c | `check_composite_arming` | observation | default | — | c16-ledger-skip, c16-malformed-warn | observation | derived |
| R16.d | `check_composite_arming` | observation | default | — | c16-store-absent | observation | derived |
| R16.e | `check_composite_arming` | invariant | default | c16-selftest | — | invariant | derived |

aspects 49 · derived 49 · waived 0 · refused 0

## Round 26's findings — revision 22

Round 26 was the renewal round D38 allows
(`agents/evidence/council/gate-classification-renewal-20261024.md`). It returned
**do not renew** and **item 4 not met**, both 2/2. Revision 22 answers each
named defect.

| Finding | Revision 22 |
|---|---|
| Mode matched as a substring (`preds.includes(mode)`) and as any flag (`/--[a-z]/`) | Flags are compared as exact tokens. Each flag-only branch carries one structured flag in `flag_branches` (3 branches). The flag must be a token of its predicates and a literal in the check's source. The branch blocks only for a row whose mode is that flag. Three self-test cases cover a substring, a missing flag and a foreign flag; the substring case was seen red. |
| Effects are trusted, not derived from code | The site scanner now refuses a hard exit site (non-zero return, exit or exit code) that lies only in branches declaring a non-blocking effect. There are 0 such contradictions, and a self-test case was seen red. It also reports how far the effects are code-confirmed: **63 of 167** blocking branches contain a hard exit or throw site. The other 104 report through an aggregated exit, which no syntactic scan can attribute. They rest on the independent session's reading, and the record says so rather than claiming a derivation. |
| No operational state or rollback for D46 | The `⏳ NOT MEASURED YET` state is distinct, and two revert triggers are written into `gate-7-2-reliance-rules-20261024.md`. The `tests.yml` comment that still described exit 1 is corrected. |
| The renewal unit carries the `--enforce` wiring change unexamined | The scope of those two wiring pins is stated: they attest that no Phase 7 invocation moved, and nothing about `check_step_production_reach`. |

The pins are not renewed. That needs another council round on the cumulative
diff.

## Round 27's findings — revision 23

Round 27 was the second renewal round on this target
(`agents/evidence/council/gate-classification-renewal-r2-20261024.md`). It
returned **do not renew** and **item 4 not met**, both 2/2. Attempt 3 changes
the strategy: it re-cuts the renewal unit rather than defending it.

| Finding | Revision 23 |
|---|---|
| Whole-file wiring hashes attest an unexamined change (`--enforce`) | The wiring files are pinned by the **digest of their Phase 7 steps only**. These are YAML blocks around a line that names one of the 16 checks, or names a task whose block names one. `Taskfile.yml` is added, because it orders the Phase 7 tasks and was never pinned. The `--enforce` line lies in no Phase 7 step, so it is outside the unit. Since revision 16 only one Phase 7 step changed: the `tests.yml` arming comment. Three self-test cases cover a change outside a step, a change inside one, and a dropped Taskfile task. The first was seen red. |
| Item 4: label exclusivity shown, but not runtime mode exclusivity; no precedence for overlapping modes | A **precedence table** (`overlaps`) is required for every branch that reaches rows in more than one mode, or whose predicates name a flag other than its rows' modes. It names the row each mode selects, the excluded flags and the tuning parameters. A run with the flag is in the flag's mode. The table must cover the branch's rows, modes and flag tokens exactly. There are 6 entries. Three self-test cases (missing, swapped, undeclared flag) were seen red. |
| (found by that check) Self-test rows were not modes | R2.b, R3.b, R7.b and R16.e name `--self-test` or `--mutation-selftest` in their aspect, and R10.h names `--freshness-days` in its applicability. None of the five had a structured mode. A row's mode is now read from its aspect, applicability or class cell, and must equal the structured mode. There are now 16 structured modes, and two self-test cases cover it. |
| The scanner misses a contradiction when a wider blocking branch also covers the site | The contradiction rule reads the **narrowest** covering branch. A self-test case was seen red under the old every-branch rule. |
| Independence asserted, not shown | The two sessions' prompts are committed in `gate-check16-reinventory-prompts-20261024.md`. The record states what that shows (each session's input boundary) and what it cannot (obedience; both are on the same provider). |

Not changed, with reasons:

- Code confirmation stays at 63 of 167 blocking branches, which is a stated
  limit of syntactic scanning.
- The absent-store exit 0 is the owner's choice (D46). anthropic's
  *"misclassified as non-blocking"* reopens an owner decision, which this lane
  does not do.

`--aspects`: 49 derived, 0 waived, 0 refused. Self-test 43/44. The one red case
is the clean baseline, which reports the unrenewed pins.

## The closed bar A1–A8 implemented — revision 24

Round 29 (D49) fixed a closed bar of eight items. All eight are implemented,
and each new check was seen red under sabotage:

| Item | What implements it |
|---|---|
| A1 | `gate-renewal-suite.mjs --manifest`: 43 pinned inputs, each assigned to unit A, B or C, with the exact ledger-row diff since revision 16 |
| A2 | The reconciler evaluates every class predicate without the recorded class and takes exactly one winner by the declared precedence; 49 of 49 |
| A3 | `--provenance`: every structured field changed since revision 16 links to its ledger row and source line, or to its review verdict |
| A4 | `tests/scripts/gate_multimode_truth_table.test.ts`: 19 runtime cases across both multi-mode branches |
| A5 | Whole-file wiring pins: `Taskfile.yml`, its 9 included taskfiles and 3 workflows; the review record is `gate-wiring-review-20261024.md` |
| A6 | `--candidate <rev>` runs the suite on a clean HEAD. `--status` is consumable only with a promotion line, and an input changed after promotion breaks it |
| A7 | `--matrix`: six isolated mutations, each must fail a gate that is green unmutated |
| A8 | `--rollback-check`: one checkout restores all pinned inputs to revision 16, and the base reconciler then reports valid |

The pins are not renewed. The record reads **quarantined** until a candidate
with renewed pins passes `--candidate` and is promoted.

## Source-to-record completeness, mechanically — revision 14

Round 18 (D42) was 2/2 and convergent. Both seats said the rerun proves that
the generated record matches its inputs, and not that the inputs represent the
source completely. What they named as missing:

- a mechanically separate, source-derived enumeration compared against the
  records with zero difference;
- atomic rows for the two compound branches;
- the four `unsure` rationales inside the package;
- the exact clean-checkout command;
- an immutable id for the rerun report;
- an explicit invalidation rule.

**The mechanical enumeration.** `agents/evidence/analysis/gate-branch-sites.mjs`
uses no model. It scans the 16 check scripts by syntax alone for every line
that can turn a run into a finding or a non-zero end:

- a non-zero `return`;
- a `process.exit`;
- a `throw`;
- a `push` into a reported list.

Each such site must lie inside the `where` of a branch the independent
inventory recorded, or it needs a disposition that names one. At this
revision there are **159 sites**:

- 134 lie inside inventoried branches;
- 25 lie outside, each with a disposition in
  `agents/evidence/analysis/gate-branch-site-dispositions-20261024.json`:
  - 9 collectors (file and value lists that report nothing);
  - 10 aggregates (spreads or exits over findings inventoried elsewhere);
  - 3 usage helpers whose call sites are inventoried;
  - 2 could-not-run throws;
  - 1 silent pass.

**No site is a branch the inventory lacks.** A disposition that names an
unknown branch fails the scan, and so does a disposition with no site behind
it. Seen red: an inserted `return 7` was refused as an undisposed site. The
reconciler now requires this scan to pass (self-test case 13).

**Atomic rows.** `c11-beta-marker` and `c12-consumer-warning` each serve two
aspects in two modes. The artefact now writes them as two rows apiece, so it
has 200 rows for 198 branches, and every row is one assertion under one mode.

**Inside the package.** The artefact itself now carries:

- the four `unsure` decisions with their reasons;
- the exact clean-checkout command;
- the invalidation rule.

The rerun report is pinned by blob.

## The branch-level reconciliation — revision 13

Round 17 (D41) was 2/2 and convergent: the matrix above is an aggregate. Both
seats asked for **every branch** to be inspectable, each with its mode, its
exact destination (an aspect with its class, or a category) and its review
verdict. They also asked for the reconciler's own blob, a clean-checkout
reproduction command, and an independent rerun.

- **The artefact.**
  `agents/evidence/analysis/gate-branch-reconciliation-20261024.md` has 198
  rows. Each row gives the check, the branch id, the source location, the mode
  its destination aspect is classified under, the destination with its class
  or category, and the independent review verdict. A branch whose destination
  spans two aspects shows both, as with `c11-beta-marker`: default mode to
  `R11.e` observation, and `--strict` to `R11.f` invariant.
- **Generated, never hand-edited.**
  `node agents/evidence/analysis/gate-ledger-reconcile.mjs --branches` writes
  it, and the normal run fails if the committed copy differs byte for byte
  from a fresh regeneration (self-test case 12).
- **Revision ids.** The reconciler, the artefact and every input are in the
  pin table above by git blob. `--matrix` prints HEAD and the input blobs.
- **Reproduction.** In a fresh `git worktree add <dir> <commit>`, run
  `node agents/evidence/analysis/gate-ledger-reconcile.mjs`, `--branches` and
  `--self-test`. These need node and git only, with no install step. The
  `--branches` output must equal the committed artefact.
- **Modes made visible.** Each branch row names its mode. The mode comes from
  the destination aspect's own row: a flag named in the aspect, *default
  mode*, an *only with* flag, or *consumer mode*.

## The complete reconciliation, as a matrix — revision 12

Round 16 (D40): both seats said no, and named the same single missing item. A
sample of six rows, of which one matched and five were inconclusive without
helper code, cannot prove a universal criterion. What closes it is **a
complete, independently reproducible inventory-to-ledger reconciliation**
with revision identifiers and machine-produced totals, and with no `op:*`
substitution left unexplained.

`node agents/evidence/analysis/gate-ledger-reconcile.mjs --matrix` prints
exactly that. Its header shows the HEAD revision and the git blob of every
input. It then prints one row per Phase 7 check, and exits 0 only when the full
reconciliation passes. The output at this revision:

| # | Phase 7 check | Binding aspects and class | Not binding | Branches | → rows | → non-assertion categories | Review: agree / disagree adopted / unsure resolved |
|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | R1.a invariant, R1.b invariant | R1.c | 13 | 5 | could-not-run 5, informational 3 | 12 / 1 adopted / 0 resolved |
| 2 | `lint_ticked_unmet_criteria` | R2.a invariant, R2.b invariant | — | 9 | 4 | usage 3, informational 1, unreachable 1 | 7 / 1 adopted / 1 resolved |
| 3 | `check_rule_invariants` | R3.a invariant, R3.b invariant | — | 15 | 3 | usage 3, could-not-run 9 | 10 / 5 adopted / 0 resolved |
| 4 | `check_augment_description_cap` | R4.a invariant | — | 3 | 1 | could-not-run 1, silent-pass 1 | 3 / 0 adopted / 0 resolved |
| 5 | `check_trigger_evals` | R5.a invariant, R5.b invariant | — | 19 | 10 | usage 4, could-not-run 3, informational 1, aggregate 1 | 18 / 0 adopted / 1 resolved |
| 6 | `lint_subagent_determinism` | R6.a invariant | — | 10 | 6 | could-not-run 3, aggregate 1 | 10 / 0 adopted / 0 resolved |
| 7 | `lint_rule_enforcement_declaration` | R7.a invariant, R7.b invariant | — | 13 | 5 | could-not-run 6, write 1, informational 1 | 13 / 0 adopted / 0 resolved |
| 8 | `check_token_quality_golden` | R8.a invariant, R8.b observation, R8.c invariant | — | 28 | 17 | usage 3, could-not-run 7, aggregate 1 | 27 / 1 adopted / 0 resolved |
| 9 | `check_council_layout` | R9.a invariant | R9.b | 5 | 2 | could-not-run 2, aggregate 1 | 5 / 0 adopted / 0 resolved |
| 10 | `check_knowledge_cards` | R10.a invariant, R10.b invariant, R10.c invariant, R10.d observation, R10.e invariant, R10.f invariant, R10.g invariant, R10.h observation, R10.i invariant, R10.k invariant, R10.l invariant, R10.m invariant, R10.n invariant, R10.o invariant, R10.j invariant | — | 35 | 22 | usage 4, silent-pass 3, could-not-run 4, informational 1, aggregate 1 | 35 / 0 adopted / 0 resolved |
| 11 | `check_public_links` | R11.a invariant, R11.b invariant, R11.c invariant, R11.d invariant, R11.e observation, R11.f invariant, R11.g invariant | — | 14 | 6 | usage 2, could-not-run 3, presentation 1, scope-exclusion 1, aggregate 1 | 13 / 0 adopted / 1 resolved |
| 12 | `lint_agents_layout` | R12.a invariant, R12.c observation, R12.d invariant | R12.b | 5 | 3 | could-not-run 2 | 5 / 0 adopted / 0 resolved |
| 13 | `lint_eval_freshness` | R13.a invariant | — | 8 | 3 | usage 2, could-not-run 2, aggregate 1 | 7 / 0 adopted / 1 resolved |
| 14 | `lint_readme_jargon` | R14.a invariant | — | 3 | 1 | could-not-run 2 | 3 / 0 adopted / 0 resolved |
| 15 | `lint_readme_serial_comma` | R15.a invariant | — | 3 | 1 | could-not-run 2 | 3 / 0 adopted / 0 resolved |
| 16 | `check_composite_arming` | R16.a observation, R16.b invariant, R16.c observation, R16.d observation, R16.e invariant | — | 15 | 8 | usage 1, could-not-run 5, write 1 | 11 / 4 adopted / 0 resolved |

How to read it:

- **Classes attach to aspects, never to branches.** Every binding aspect
  listed carries exactly one of the four classes. The `op:*` categories apply
  to *branches*, the code paths the independent inventory found, and say why a
  branch asserts nothing: usage, could-not-run, aggregate exit,
  informational, write, presentation, silent pass, scope exclusion,
  unreachable. An `op:*` value never stands in for an aspect's class.
- **No `op:*` assignment is the author's alone.** The last column counts the
  independent review per check. Every branch, including every one in an
  `op:*` category, was either agreed by the separate reviewer or moved to the
  reviewer's suggestion. The four `unsure` verdicts carry recorded decisions.
  The reconciler fails if any of this is undone (self-test: 11 of 11 cases
  refused).
- **Totals are machine-produced:**
  - 16 checks, which match the Phase 7 manifest at `bbe5b73be`;
  - 49 binding aspects;
  - 198 branches, of which 97 map to aspects and 101 to declared
    non-assertion categories;
  - every binding aspect reached by at least one branch.
- **Full reviewer rationales** are in
  `agents/evidence/analysis/gate-branch-mapping-review-20261024.json`, the
  reviewer's own artefact, unedited. The table below truncates them at 170
  characters.

**The round-16 spot-check, recorded as it came out:** R4.a matched; R1.a,
R5.a, R10.l, R12.c and R16.c could not be told from the excerpts, because the
helpers that decide applicability (`checkRatchet`, `_days_between`, the
`--global` wiring, consumer-mode detection, per-line ledger naming) were not
shown. The sample is superseded as evidence by the complete reconciliation
above. It is not counted as a 6/6 match.

## The twelve review disagreements, disposed — revision 11

Round 15 (D39): anthropic would not accept *"honours every review verdict"*
without seeing the disagreements and how each one ended. Here is all of them.
The reviewer is the separate session, and its suggestion was adopted in
**12 of 12**. Not one was resolved in favour of the ledger author's original
mapping. The reconciler enforces this: an adopted disagreement that is
reverted fails the run (self-test case *a review disagreement is reverted*).

| Check | Branch | Author mapped | Reviewer suggested | Now | Reviewer reason |
|---|---|---|---|---|---|
| `check_gate_completeness` | `c1-dead-scope` | `R1.c` | `op:could-not-run` | `op:could-not-run` | Dead scope (no registered gate script found) is the tool being unable to measure, which the definition excludes; every other dead-scope branch (c5,c6,c7,c9,c11,c12,c13) i… |
| `lint_ticked_unmet_criteria` | `c2-selftest-recurse` | `R2.b` | `op:usage` | `op:usage` | Refusing to recurse when GATE_SELF_TEST_CHILD=1 is an invocation guard (exit 2), not a finding about the fixture table that R2.b describes. |
| `check_rule_invariants` | `c3-selftest-empty` | `R3.b` | `op:could-not-run` | `op:could-not-run` | No invariant to mutate means the self-test cannot run; it says nothing about whether removal is detected (the R3.b property). |
| `check_rule_invariants` | `c3-selftest-baseline-broken` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Precondition failure: first invariant absent from src, so the mutation cannot be performed. The repo fact itself (string missing) is R3.a's property, not R3.b's. |
| `check_rule_invariants` | `c3-selftest-src-unreadable` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Unreadable src file, exit 3 internal error — identical in nature to c3-json-read-or-parse which is mapped op:could-not-run. |
| `check_rule_invariants` | `c3-selftest-mutation-noop` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Defensive "mutation did not apply" guard: the self-test could not set up its mutation; it does not measure detection. (op:unreachable is also defensible.) |
| `check_rule_invariants` | `c3-selftest-load-errors` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Same invariants.json load/parse/malformed errors as c3-json-not-array/-malformed-entry/-read-or-parse (all op:could-not-run), exit 3; mapping the selftest-path copy to R3… |
| `check_token_quality_golden` | `c8-tasks-not-list` | `R8.a` | `op:could-not-run` | `op:could-not-run` | validate() records the structural error but task_count is then 0, so assertScanned throws first and main returns 2 with the dead-scope message (check_token_quality_golden… |
| `check_composite_arming` | `c16-store-unreadable` | `R16.c` | `R16.d` | `R16.d` | Store absent/unreadable is exactly row R16.d ("store absent"). R16.c is partial malformation. Mapping swapped with c16-ledger-skip / c16-malformed-warn. (By the definitio… |
| `check_composite_arming` | `c16-ledger-skip` | `R16.d` | `R16.c` | `R16.c` | Malformed lines recorded as precondition_unmet in the ledger is verbatim R16.c's evidence ("the gate ledger records each dropped line as precondition_unmet"). R16.d is st… |
| `check_composite_arming` | `c16-dead-scope` | `R16.b` | `op:could-not-run` | `op:could-not-run` | Empty store (zero records, zero malformed lines) is dead scope / evidence-missing, not malformation; the definition excludes it. R16.b's row text folds "empty store also … |
| `check_composite_arming` | `c16-malformed-warn` | `R16.d` | `R16.c` | `R16.c` | Malformed lines ignored while usable records exist = R16.c "partial malformation". R16.d is store absent. |

Four of the twelve corrected author errors that changed a row's meaning:

- the swapped composite rows (`R16.c` and `R16.d`), three branches;
- the dead-scope branch behind `R1.c`, which led to `R1.c`'s withdrawal.

The other eight moved precondition and invocation-guard branches out of rows
and into `op:could-not-run` or `op:usage`.

## Current enforcement, recorded separately

From `agents/evidence/analysis/gate-invocation-inventory-20261024.md`:

- eight checks block the required `Standing payload delta + budget gate` context
  in their default mode (rows 4, 6, 8, 9, 10, 11, 14, 15);
- seven block only the local `task ci` chain or the non-required
  `Rule backstops` (rows 1, 2, 3, 5, 7, 12, 13);
- `check_composite_arming` blocks nothing, because its store run is
  `continue-on-error: true`.

No observation aspect blocks at any caller found. Semantic class and current
exit behaviour diverge in **one** place: row 16, *store absent*, exits 1. The
divergence is recorded here and is not a reclassification.

## Assurance level of each invariant

The four classes do not change, but *invariant* covers three different
guarantees (openai), so each invariant row carries one of these qualifiers:

- **repository-consistency**: the check compares the tree against an
  expectation the same authority can edit in the same change. These are row 1's
  ratchet, row 2, row 3 and row 7. They are consistency checks, not
  independently anchored invariants (anthropic).
- **environment-dependent**:
  - row 5 freshness (runner clock and time zone);
  - the current-scope rows of checks 9 and 12 (the disk, read relative to the working directory);
  - rows 14 and 15 (`README.md` relative to the working directory);
  - row 10 C5 (git history depth, skipped without git);
  - row 10 C3 live URL in `--check-urls` mode (network).
- **fixed-policy**: every other invariant row.

## The ledger — revision 3

Revision 3 applies the 2026-10-24 round on revision 2 (D32). That round left exactly one closure blocker: the absent composite store carried a fifth value instead of a class. It is now an observation, and the missing-evidence state is runtime metadata only. Revision 3 also applies five refinements:

- the stale snapshot reference is removed;
- row 5 states the property as computed;
- row 11 enumerates every error-severity rule;
- rows 9 and 12 separate the scope measured today from the target index scope, with an operational definition;
- row 16 separates current behaviour from a future transition.

Revision 2 applied the 2026-10-24 ledger round (D31). Both seats rejected
closure of revision 1 and agreed on five corrections, all applied here:

- row 1's ratchet is an invariant, not a snapshot;
- row 10 is split per check, C1 to C6;
- row 11's warning property is named;
- row 16 separates missing, malformed and insufficient evidence;
- rows 9 and 12 record a canonical measurement scope.

Revision 2 also dropped revision 1's *proves or asserts* column. Every row's
script **computes** its property from files the same repository authority
controls, and no independent party verifies it (openai's hardest pushback).

| # | Check | Aspect | Property measured (from source) | Inputs / trust dependencies | Applicability / invocation mode | What makes it vary | Class | Evidence for the class | Row id |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | adoption ratchet | un-adopted gate count ≤ the recorded count, the recorded count exists, and it was landed or reaffirmed within `STALE_AFTER_DAYS` (56); three verdicts fail: regressed, unbaselined, stale | `src/config/gate-violation-baselines.json` (governed input), gate sources | always | new gates, adoption | **invariant** (shrink-only) | header: the count "may only go down". No authorised upward refresh is documented, and an edit's technical ability to raise the number is not authorisation | `R1.a` |
| 1 | | exemption marker | every `// ledger-exempt:` carries a reason of minimum length | gate sources | always | gate edits | **invariant** | "an empty or near-empty reason is a hard failure"; form only, the header says truth is a human read | `R1.b` |
| 1 | | scan scope | the gate scanned a non-dead scope (the CI-registered gate estate) | `assertScanned` | always | tree layout | — **withdrawn in revision 9** | dead scope is the check being unable to measure (`op:could-not-run`), not an assertion about the repository (independent mapping review). The id is not reused | `R1.c` |
| 2 | `lint_ticked_unmet_criteria` | ticked-vs-NOT-met | no `[x] AC` whose own text says `NOT met`, and the in-source exemption list is well formed (no duplicate key, no entry that matches nothing) | roadmaps, frozen digest list in source (governed input) | always | roadmap edits | **invariant** | frozen, digest-pinned exemptions; an unmatched entry is an error, so the list only shrinks | `R2.a` |
| 2 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | a fixed fixture table, no baseline (fixed-policy) | `R2.b` |
| 3 | `check_rule_invariants` | kernel strings present | each string of `tests/golden/invariants.json` is in the kernel rule's source and its `dist/` projection | `tests/golden/invariants.json` (governed input), `src/rules/`, `dist/agent-src/rules/` | needs the projection built | a rule reworded; the expectation file edited | **invariant** | no baseline; the expectation file is the contract and shares edit authority with the rules (weak independence) | `R3.a` |
| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-consistency); an undetected removal returns 1 (`check_rule_invariants.ts:204-208`) | `R3.b` |
| 4 | `check_augment_description_cap` | description length | every `type: auto` rule description ≤ `DESC_CAP` | `src/rules/*.md` | when the scan root contains at least one `type: auto` rule; with none the check exits 0 having scanned nothing (`op:silent-pass`, a defect carried to 7.2) | rule edits | **invariant** | fixed cap | `R4.a` |
| 5 | `check_trigger_evals` | freshness | `last_eval` present and not more than 90 days before the run date (a future date computes a negative age and is accepted) | `triggers.json`; clock `asOf()` (pinnable through `AC_AS_OF` or `--today`), local calendar date of the runner | always | the calendar | **invariant, time-qualified** | D24. Window 90 d. Day 90 passes, day 91 fails (`age > 90`). No grace. The runner's local time zone decides the date. The class covers the property as computed. Rejecting future dates is a possible tightening, recorded and not assumed | `R5.a` |
| 5 | | structure | non-empty queries, each `q` and boolean `trigger`, both classes present | same | always | edits | **invariant** | fixed rule | `R5.b` |
| 6 | `lint_subagent_determinism` | schema consts | five determinism rules on `src/subagents/*.md` | same | always | edits | **invariant** | fixed rules | `R6.a` |
| 7 | `lint_rule_enforcement_declaration` | declaration | a rule outside the legacy list declares `enforced_by:`; `none` states its gap in the body | `src/rules/`, `src/config/rule-enforcement-baseline.json` (governed input) | always | rule additions | **invariant** (shrink-only list) | list "may only shrink"; a stale entry must leave in the same change; declaration only, not that the backstop works | `R7.a` |
| 7 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--write-baseline` is a write mode (`op:write`) that asserts nothing, so it carries no class | `R7.b` |
| 8 | `check_token_quality_golden` | structure | unknown rule ids, bad scenarios, a labelled task without anchors | golden YAML, `dist/router.json` | always, every mode | edits | **invariant** | "Structural errors … always fail" | `R8.a` |
| 8 | | coverage and stubs — default mode | uncovered rules and stub tasks | same | invocation without `--require-complete` | labelling work | **observation** | "REPORTED, not a failure, by default" | `R8.b` |
| 8 | | coverage and stubs — `--require-complete` | no stub, no uncovered rule, required scenarios present, for the given `--scope` | same | invocation with `--require-complete` (the operator-completion gate) | labelling work | **invariant** in that mode | the header names it the completion gate, which fails on any remaining stub | `R8.c` |
| 9 | `check_council_layout` | placement — current | council artefacts only in canonical or allowlisted directories, over **every path on disk** under `agents/` (`fs.readdirSync`), untracked files included | `agents/` on disk | always | untracked local files as well as edits | **invariant** over the disk scope it measures today | fixed rule. This is the row 7.2 may rely on until the scope fix lands | `R9.a` |
| 9 | | placement — target | the same property over the **index**: the paths `git ls-files -- agents/` lists, so a staged addition is in, a staged deletion is out, and a rename counts at its new path. Only path names are checked, so partially staged content cannot change the result | git index | after the scope fix | edits | **invariant** | the canonical scope both seats asked for. No enforcement decision may rely on this row before the fix is verified | `R9.b` |
| 10 | `check_knowledge_cards` | C1 size | a card ≤ 150 lines | `agents/knowledge/*.md` (external arm) | always | card edits | **invariant** | error | `R10.a` |
| 10 | | C2 pointer present | `links.authoritative` in frontmatter | same | always | card edits | **invariant** | error | `R10.b` |
| 10 | | C3 local pointer | a local pointer path exists | same + the tree | always | card or tree edits | **invariant** | error | `R10.c` |
| 10 | | C3 live URL | the URL answers | same + network | only with `--check-urls` | the remote site | **invariant** in that mode | with `--check-urls` an unreachable or failing URL is an error (`C3: URL returned …` / `unreachable`) and the run exits 1. Reclassified in revision 15 from observation: network dependence is an environment property, not a non-blocking contract (class predicate 4, D45) | `R10.d` |
| 10 | | C4 trust tag | `trust` present; `type: anti-hallucination` | same | always | card edits | **invariant** | error | `R10.e` |
| 10 | | C5 evidence consistency | distinct `source_version`s form a git-ancestry chain; `observed_at` span ≤ 7 days | same + git history | when git is runnable; without git the ancestry half is skipped silently (`op:silent-pass`) | card edits, history | **invariant** | error. The span compares recorded timestamps, not the clock | `R10.f` |
| 10 | | C6 strict sources | `source=<path:line>` references exist and are non-empty | same + the tree | only with `--strict` | tree edits | **invariant** in that mode | error when enabled | `R10.g` |
| 10 | | freshness | newest `observed_at` older than `--freshness-days` | same + clock | only with `--freshness-days` > 0; default 0 = off | the calendar | **observation** | "Honest freshness signal (NOT a failure)" | `R10.h` |
| 10 | | G1 tier — `--global` | a global-store card carries a valid `tier` | the user-global card store | only with `--global`; no caller found | card edits | **invariant** in that mode | `_check_global_card` error | `R10.i` |
| 10 | | G2 provenance footer — `--global` | the provenance footer is present and carries `first_seen`, `promoted_at`, `last_verified`, `tier`, `seen_in` | same | only with `--global` | card edits | **invariant** in that mode | error per missing field | `R10.k` |
| 10 | | G3 redaction — `--global` | no confidential pattern (secret, email, internal host, external-source name, hidden Unicode) in a global card | same | only with `--global` | card edits | **invariant** in that mode | `redaction_scan` violations are errors | `R10.l` |
| 10 | | G4 sensitivity — `--global` | a global card carries a valid `sensitivity` | same | only with `--global` | card edits | **invariant** in that mode | error | `R10.m` |
| 10 | | G5 ownership fields — `--global` | the footer carries `source_repo`, `owner`, `review_after`, `promotion_reason` | same | only with `--global` | card edits | **invariant** in that mode | error per missing field | `R10.n` |
| 10 | | G6 no prohibited card — `--global` | no card with `sensitivity: prohibited` is in the global store | same | only with `--global` | card edits | **invariant** in that mode | error | `R10.o` |
| 10 | | E1 experience-card keys | a card with `kind: experience` carries every key of `REQUIRED_CARD_FIELDS` | `agents/knowledge/*.md` (experience arm) | always, for experience cards | card edits | **invariant** | error; C1–C6 apply to the external arm only | `R10.j` |
| 11 | `check_public_links` | link target exists | a link from the public surface into `docs/contracts/` resolves to a file | README, AGENTS.md, architecture doc, contract frontmatter | for links that resolve inside the repository; a link resolving outside it is skipped (`op:scope-exclusion`) | doc edits | **invariant** | error severity, exit 1 | `R11.a` |
| 11 | | target declares stability | the linked contract carries `stability:` frontmatter | same | always | contract edits | **invariant** | error severity, exit 1 | `R11.b` |
| 11 | | no experimental link | the public surface never links to an `experimental` contract | same | always | doc edits | **invariant** | error severity, exit 1 | `R11.c` |
| 11 | | contract file declares stability | a contract file itself carries `stability:` frontmatter, as `STABILITY.md` requires | `docs/contracts/` | always | contract edits | **invariant** | error severity, exit 1 | `R11.d` |
| 11 | | beta marker — default mode | a link to a `beta` contract carries a visible `(beta)` or `[beta]` marker | same | invocation without `--strict` | doc edits | **observation** | warning severity, exit 0 | `R11.e` |
| 11 | | beta marker — `--strict` | same property | same | invocation with `--strict` | doc edits | **invariant** in that mode | warnings fail with `--strict` | `R11.f` |
| 11 | | no link into agents contexts | the public surface does not link to an `agents/contexts/*.md` target | README, AGENTS.md, architecture doc | always | doc edits | **invariant** | error severity, exit 1 | `R11.g` |
| 12 | `lint_agents_layout` | top-level allowlist — current | every regular file at the `agents/` root is in `ALLOWED_FLAT_FILES` (both modes), and in source-repo mode every top-level directory is in `ALLOWED_SOURCE_DIRS`; read from disk (`fs.readdirSync`), untracked entries included | `agents/` on disk, `ALLOWED_SOURCE_DIRS` in source | always | untracked local entries as well as edits | **invariant** over the disk scope it measures today | fixed allowlist; the row 7.2 may rely on until the fix | `R12.a` |
| 12 | | top-level allowlist — target | the same property over the top-level entries of the paths `git ls-files -- agents/` lists (index scope, as row 9) | git index | after the scope fix | edits | **invariant** | no enforcement decision relies on it before the fix is verified | `R12.b` |
| 12 | | consumer shape — default mode | in **consumer mode only** (no source-repo markers in the working directory), entries outside the consumer-target shape are reported as warnings | `agents/` on disk | consumer mode, invocation without `--strict`; never in this repository, which is in source-repo mode | consumer layout | **observation** | warnings exit 0 without `--strict`. Corrected in revision 8: revision 6 described these as entries scheduled for migration in this repository | `R12.c` |
| 12 | | consumer shape — `--strict` | no entry outside the consumer-target shape remains | same | consumer mode with `--strict`; in this repository's source-repo mode `--strict` changes nothing | consumer layout | **invariant** in that mode | `if (strict) return 1` after the consumer warnings | `R12.d` |
| 13 | `lint_eval_freshness` | eval attached | `upstream.last_eval` present with `sha_at_eval == upstream.sha` | manifests | in scope when a skill ships triggers and a pinned corpus | corpus SHA bumps | **invariant** | SHA equality, no clock | `R13.a` |
| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | fixed cap `MAX_HITS = 3`, more hits return 1 (`lint_readme_jargon.ts:172-188`); no named risk owner, so not a tolerance | `R14.a` |
| 15 | `lint_readme_serial_comma` | serial comma | no serial comma in README prose | README.md | always | README edits | **invariant** | fixed rule | `R15.a` |
| 16 | `check_composite_arming` | arming verdict | ≥ 10 usable composite readings from ≥ 2 sessions | the composite store | a valid store exists | new readings | **observation** | "'not yet' is a successful measurement, never a build failure" | `R16.a` |
| 16 | | store yields a usable record | a store with content parses to at least one usable reading (an empty store is `op:could-not-run`, not this row) (a line with a string `session` and a `composite_ms` key) | the composite store | the store exists | a corrupt append | **invariant** | exit 1 when malformed lines leave no usable record (`malformed > 0 && readings.length === 0`). Corrected in revision 6: revision 3 said "every line parses", which the code does not require | `R16.b` |
| 16 | | partial malformation | malformed lines next to usable ones are counted and named per line | same | the store exists | a corrupt append | **observation** | the gate ledger records each dropped line as `precondition_unmet`, the run continues, and with at least one usable record it exits 0 | `R16.c` |
| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Behaviour matches since D46 (owner, 2026-10-24): an absent store exits 0 as "not measured yet"; a store that exists but cannot be read still exits 1. A future transition to invariant after a bootstrap deadline needs that deadline first (D31) and is not part of this verdict | `R16.d` |
| 16 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | `taskfiles/content.yml:386`, `rule-backstops.yml:321` | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--publish` is a write mode that writes a distribution report and asserts nothing, so it carries no class | `R16.e` |

## Totals — revision 15

52 aspect rows over 16 checks. Two target-scope rows are migration notes and
one row (`R1.c`) is withdrawn, so there are **49 classified aspects**, each in one of the four classes:

- **invariant 42**:
  - four self-test or mutation-test modes;
  - eleven hold only in a named invocation mode: `--require-complete`, `--strict` on three checks (one only in consumer mode), `--check-urls`, and `--global` for G1 to G6;
  - one is time-qualified (trigger freshness);
  - the adoption ratchet carries a staleness window.
  - `R4.a`, `R10.f` and `R11.a` carry a narrowed applicability.
- **observation 7**:
  - token-golden default coverage;
  - card freshness;
  - the beta marker in default mode;
  - the consumer-mode shape warning in default mode;
  - composite arming;
  - composite partial malformation;
  - composite store absent.
- **snapshot 0**.
- **tolerance 0**.

Checked mechanically:

- every binding aspect of every one of the 16 checks carries a class;
- every assertion-changing flag in each check's source is named by a binding
  row;
- every one of the 198 independently inventoried branches maps to a binding row
  of its check or to a declared non-assertion category;
- every binding row is reached by at least one branch.

## What this ledger does not decide

- **Gate membership.** Classification is not gate membership (D14, D22). An
  observation row says what the check's own contract claims. It does not demote
  anything. Demotion is 7.2, and its own rule says every demotion is recorded
  with its reason.
- **Refresh authority.** No row is a snapshot any more. Whether any
  shrink-only list may ever be raised, and by whom, is owner-reserved (D31).
- **Truthfulness.** For every row the script computes the property from
  files the same repository authority controls. No independent party verifies
  the computation.

## Unresolved, and who decides

| Question | Needs |
|---|---|
| Which object rows 9 and 12 should inspect: the index, the checked-out commit, or the synthetic merge result. Moving from the disk to tracked paths stops detecting untracked entries, which is a reduction of detectable states (openai) and needs a justification | council, before 7.2 changes either check |
| The bootstrap deadline after which an absent composite store fails | council (a reversible value) |
| Any authority to raise the `check_gate_completeness` baseline, or any exception to a shrink-only list | owner-reserved second principal (`external-bootstrap-boundary-for-phases-2-3`); until then the lists are shrink-only invariants |
| Demoting an observation aspect to non-blocking (7.2) | council, after the invocation-mode and consumer inventory; each demotion carries old behaviour, new behaviour, reason, consumers and a rollback condition |
| Promotion of any row into a governed registry | owner-reserved second principal |
