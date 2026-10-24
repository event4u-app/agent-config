<!-- evidence-type: analysis -->

# Independent rerun of a91350838a72e555d569036fc4152e0b541344a1

Worktree: `<scratchpad>` (created with `git -C .../agent-config-lane-r3 worktree add --detach <tmpdir> a91350838a…`).
Outputs were captured to `<scratchpad>` (outside the worktree, so the worktree stayed clean; `regenerated.md` was written there rather than inside the worktree for the same reason).

## Step 2 — pre-checks
```
status:[]
a91350838a72e555d569036fc4152e0b541344a1
v26.7.0
```
`git status --porcelain` empty: yes. HEAD matches: yes. Node: v26.7.0.

## Step 3 — commands and exit codes
```
a=0
b=0
c=0
d=0
cmp=0
hash=0
```
### a. `node agents/evidence/analysis/gate-ledger-reconcile.mjs` — exit 0
```
Phase 7 manifest: 16 checks, record and paths verified against git
independent mapping review: {"disagree":12,"agree":182,"unsure":4}
branches 198 · mapped to rows 97 · {"op:could-not-run":56,"op:informational":7,"op:usage":22,"op:unreachable":1,"op:silent-pass":4,"op:aggregate":7,"op:write":2,"op:presentation":1,"op:scope-exclusion":1} · binding rows reached 49/49
rows 52 · binding 49 · non-binding 3 (migration notes and withdrawn rows) · {"invariant":41,"snapshot":0,"tolerance":0,"observation":8}
pins: 28 files, 51-file helper closure, ledger table

OK: the Phase 7 manifest matches its landed record and git history; the ledger, the invocation inventory and the manifest name the same 16 checks; every binding aspect carries one of the four classes; every assertion-changing flag is named; every branch of the independent inventory maps to a binding row or a declared category and every binding row is reached; every independent review verdict is honoured; every pin is current.
```
### b. `--matrix` — exit 0
```
revision: HEAD a91350838a72e555d569036fc4152e0b541344a1
input: agents/evidence/council/live-tree-check-classification-20261010.md blob 3363cd91745a7bdd5370693a4e0a0129802bd620
input: agents/evidence/analysis/gate-classification-ledger-20261024.md blob af887b95e10f485c18a42b9cbd2c6fad0ef68c85
input: agents/evidence/analysis/gate-invocation-inventory-20261024.md blob 1f3ff61036ccbd9ba42f9acd4eec5b5c2697b4f9
input: agents/evidence/analysis/gate-branch-inventory-20261024.json blob 119214ea142393c7254cae40e080153728e10fb0
input: agents/evidence/analysis/gate-branch-mapping-20261024.json blob c296fd9f02c1f0e83688da3f596cbb19e079665e
input: agents/evidence/analysis/gate-branch-mapping-review-20261024.json blob 46227ecdae464df420e5aec60910a1b7a497e686

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

reconciliation: OK
```
### c. `--self-test` — exit 0
```
ok   baseline is clean
ok   a Phase 7 check is dropped from the ledger
ok   the Phase 7 record is altered
ok   an unsure review verdict loses its resolution
ok   a reviewed row branch is laundered into a category
ok   a review disagreement is reverted
ok   a pinned source changes
ok   a helper on the closure changes
ok   a row's applicability is edited after review
ok   a branch is mapped to the withdrawn row
ok   a line of the committed branch reconciliation is edited
ok   an unknown flag appears in a check

self-test: 12/12 case(s) behaved
```
### d. `--branches > regenerated.md` — exit 0, stderr empty (0 bytes)
`cmp out/regenerated.md agents/evidence/analysis/gate-branch-reconciliation-20261024.md` → exit 0, no output: **byte-identical** (27224 bytes, 211 lines).
```
fd3ea76218352a8f325bf841b740ff986e822cebd73225461381446712ac2109  ../out/regenerated.md
fd3ea76218352a8f325bf841b740ff986e822cebd73225461381446712ac2109  agents/evidence/analysis/gate-branch-reconciliation-20261024.md
```
### e. `git hash-object` — exit 0
```
b834ff3aba3229a9a768bd76b951471eb99413e9 gate-ledger-reconcile.mjs
aa8f785bfe9573a17b3b9bb734fc6b680db118d1 gate-branch-reconciliation-20261024.md
119214ea142393c7254cae40e080153728e10fb0 gate-branch-inventory-20261024.json
c296fd9f02c1f0e83688da3f596cbb19e079665e gate-branch-mapping-20261024.json
46227ecdae464df420e5aec60910a1b7a497e686 gate-branch-mapping-review-20261024.json
```
The three JSON blobs match the `input:` lines printed by `--matrix`.

## Step 4 — independent recount from the committed artefact

Command (table rows are lines starting with ``| ` ``; destination is pipe-field 6):
```
awk -F'|' '/^\| `/{n++; d=$6; gsub(/^ +| +$/,"",d); if(NF!=8)bad++;
  if(d~/^R/){r++; split(d,a," "); ids[a[1]]=1; split(a[1],b,"."); rows[b[1]]=1}
  else if(d~/^op:/){o++; ops[d]++} else other++}
  END{print "rows",n,"R",r,"op",o,"other",other+0,"badNF",bad+0; ...}' \
  agents/evidence/analysis/gate-branch-reconciliation-20261024.md
```
Output:
```
rows 198 R 97 op 101 other 0 badNF 0
distinct aspect ids 47
distinct row numbers (R<n>) 16
op:could-not-run 56, op:usage 22, op:informational 7, op:aggregate 7,
op:silent-pass 4, op:write 2, op:unreachable 1, op:presentation 1, op:scope-exclusion 1
```
My first pass found 47 distinct aspect ids, not 49. Diffing against the 49 binding aspects listed by `--matrix` showed `R11.f` and `R12.d` missing. Cause: two rows have compound destinations that my first awk truncated at the first space:
- line 175 `c11-beta-marker` → `R11.e observation + R11.f invariant`
- line 182 `c12-consumer-warning` → `R12.c observation + R12.d invariant`

Recount splitting on ` + `:
```
awk -F'|' '/^\| `/{d=$6; gsub(/^ +| +$/,"",d); if(d~/^R/){m=split(d,p," \\+ "); if(m>1)comp++;
  for(i=1;i<=m;i++){split(p[i],a," "); ids[a[1]]=1}}} END{...}' <artefact>
→ compound rows 2 distinct aspect ids incl. compound 49
```

| Quantity | My recount | Reconciler / artefact header |
|---|---|---|
| Branch rows | 198 | 198 |
| Destination starts `R` | 97 | 97 |
| Destination starts `op:` | 101 | 101 |
| Other | 0 | — |
| Distinct aspect ids (R<n>.<x>) as destinations | 49 (2 only via compound rows) | 49/49 binding reached |
| Distinct row numbers (R1–R16) | 16 | 16 checks |
| op: category breakdown | identical to reconciler JSON | — |

Note: of the 97 `R` rows, 2 carry two aspects each, so the 97 counts branches, not aspect hits.

## Step 5 — cleanup
`git -C <repository> worktree remove --force <tmpdir>` — see result appended below.

## Discrepancies
None in the reconciler results. The only surprise was my own first recount (47) caused by compound destinations; corrected to 49.
Worktree remove exit code: 0; `git worktree list` no longer contains rerun-wt: yes
