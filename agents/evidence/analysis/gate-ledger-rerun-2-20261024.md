<!-- evidence-type: analysis -->

# Independent rerun of 907b83bd6678e4a6a03ae81591dc4f0e84da5cef

Worktree `<scratchpad>` (detached, via `git -C .../agent-config-lane-r3 worktree add --detach`, exit 0). Raw outputs in `<scratchpad>`.

## Pre-checks
```
status:[]
907b83bd6678e4a6a03ae81591dc4f0e84da5cef
v26.7.0
```
Clean: yes. HEAD matches: yes. Status still empty after all runs: yes.

## Exit codes
```
a=0
b=0
c=0
d_pipestatus=0 0 0
hash=0
list=0
post-status:[]
```
(d: pipestatus of reconciler | tee | cmp — all 0; reconciler stderr empty.)

### a. reconcile — exit 0
```
Phase 7 manifest: 16 checks, record and paths verified against git
independent mapping review: {"disagree":12,"agree":182,"unsure":4}
branches 198 · mapped to rows 97 · {"op:could-not-run":56,"op:informational":7,"op:usage":22,"op:unreachable":1,"op:silent-pass":4,"op:aggregate":7,"op:write":2,"op:presentation":1,"op:scope-exclusion":1} · binding rows reached 49/49
rows 52 · binding 49 · non-binding 3 (migration notes and withdrawn rows) · {"invariant":41,"snapshot":0,"tolerance":0,"observation":8}
pins: 31 files, 51-file helper closure, ledger table

OK: the Phase 7 manifest matches its landed record and git history; the ledger, the invocation inventory and the manifest name the same 16 checks; every binding aspect carries one of the four classes; every assertion-changing flag is named; every branch of the independent inventory maps to a binding row or a declared category and every binding row is reached; every independent review verdict is honoured; every pin is current.
```
### b. --self-test — exit 0
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
ok   the mechanical site scanner finds an undisposed site
ok   an unknown flag appears in a check

self-test: 13/13 case(s) behaved
```
### c. gate-branch-sites.mjs — exit 0
```
sites 159 · inside an inventoried branch 134 · outside, with a disposition 25 {"collector":9,"aggregate":10,"usage":3,"could-not-run":2,"silent-pass":1}
OK: every syntactic finding or non-zero site in the 16 checks lies inside an inventoried branch or carries a disposition naming one; no site is a branch the inventory lacks.
```
### d. --branches | cmp - committed — exit 0, no output: **byte-identical** (29775 bytes, 226 lines)
```
6d6304585942c8b84cd05a5c0f388471c08f2c8462ed100f0c4076ca2e1e39ce  <scratchpad>  agents/evidence/analysis/gate-branch-reconciliation-20261024.md
```
### e. git hash-object — exit 0
```
a3977560739862ee16a043fe884655c8e3f8eb79 gate-ledger-reconcile.mjs
9fcb55761625706068156579e69c12d59e68bc9b gate-branch-reconciliation-20261024.md
234eb91b758bb2e5d500621c7b17de1e8ad1b1cd gate-branch-sites.mjs
668181e7f5c563f1064a0b824f28f03c0239b8ad gate-branch-site-dispositions-20261024.json
fc0c90dfbb56c2820e2669ad67fac1a969bd9782 gate-ledger-rerun-20261024.md
```

## Independent recount of the committed artefact
```
awk -F'|' '/^\| `/{n++; b=$3; gsub(/^ +| +$/,"",b); br[b]++; d=$6; gsub(/^ +| +$/,"",d);
  if(d~/^R/){r++; m=split(d,p," \\+ "); for(i=1;i<=m;i++){split(p[i],a," "); ids[a[1]]=1; split(a[1],q,"."); rows[q[1]]=1}}
  else if(d~/^op:/){o++} else oth++} END{...}' gate-branch-reconciliation-20261024.md
→ rows 200 distinct branch ids 198 dup ids 2 R 99 op 101 other 0 badNF 0 compound 0 distinct aspect ids 49 distinct R<n> 16
```
| Quantity | Recount | Artefact header (line 16) |
|---|---|---|
| Table rows | 200 | "198 branches (200 rows)" |
| Distinct branch ids | 198 | 198 |
| Rows with destination `R…` | 99 | — |
| Branches with an `R…` destination | 97 (99 rows − 2 repeated branches) | 97 |
| Rows with destination `op:` | 101 | 101 |
| Other | 0 | — |
| Distinct aspect ids (R<n>.<x>) | 49 | 49 binding aspects |
| Distinct row numbers (R1–R16) | 16 | — |

Change from the previous commit: the two compound destinations are now split into separate rows. `c11-beta-marker` appears twice (lines 188–189: default → R11.e observation; --strict → R11.f invariant). `c12-consumer-warning` also appears twice (lines 196–197: R12.c observation / R12.d invariant). That accounts for 200 rows vs 198 branches and 99 vs 97.

## UNCOVERED sites vs dispositions
`node gate-branch-sites.mjs --list` (exit 0) prints 159 lines. 25 of them are marked `UNCOVERED` (third ` | ` field). A node one-liner checked them against `gate-branch-site-dispositions-20261024.json` `.dispositions`:
```
UNCOVERED 25 keys in dispositions 25 missing [] extra []
kinds {"collector":9,"aggregate":10,"usage":3,"could-not-run":2,"silent-pass":1}
branch refs not found in inventory json []
```
Every UNCOVERED site has a key, and the file has no extra keys. Every branch id named after a `kind:` colon occurs in `gate-branch-inventory-20261024.json`. The kind tally matches the scanner's summary line. Observation, not a failure: dispositions for `check_trigger_evals` cite `c6-*` branch ids (for example `c6-unknown-arg`). The matrix numbers check_trigger_evals 5, but those ids do exist in the inventory, so the inventory's c-numbering evidently differs from the matrix row numbers. I did not investigate further.

## Discrepancies
None. All exit codes are 0, cmp is byte-identical, and the recount matches the header.
Cleanup: worktree remove exit 0; still listed: 0
