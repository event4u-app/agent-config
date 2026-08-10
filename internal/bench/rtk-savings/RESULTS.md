# rtk savings — agent-config's own measurement

> Scope: ONE repo (agent-config), ONE machine (macOS, Apple Silicon),
> rtk 0.43.0, 8-command corpus, single run 2026-07-28. This is a scoped
> spot-measurement, not a general benchmark — published per
> `road-to-rtk-onboarding-correctness` Phase 2 (council 2026-07-28, Q3(a):
> publish clearly scoped rather than keep attribution-only).

## Method

`corpus.sh` runs each command raw and wrapped (`rtk <cmd>`), counting
combined stdout+stderr bytes. Savings = `1 - rtk_bytes / raw_bytes`.
Bytes are a proxy for tokens (≈ chars/4 for typical CLI output); the
comparison is like-for-like so the ratio is token-representative.

## Result (2026-07-28)

| command | raw bytes | rtk bytes | saving |
|---|---:|---:|---:|
| `git status` | 711 | 321 | 54.9% |
| `git log --oneline -50` | 4,365 | 4,365 | 0.0% |
| `git log -10` | 6,720 | 3,057 | 54.5% |
| `git diff --stat HEAD~5..HEAD` | 15,785 | 15,784 | 0.0% |
| `git branch -a` | 25,135 | 19,745 | 21.4% |
| `ls -la src/scripts` | 38,006 | 16,458 | 56.7% |
| `npm ls --depth=0` | 1,003 | 1,002 | 0.1% |
| `git show --stat HEAD` | 1,334 | 1,334 | 0.0% |
| **TOTAL** | **93,059** | **62,066** | **33.3%** |

## Honest reading

- **Overall 33.3% on this corpus — clearly below upstream's 60–90%
  estimate.** Upstream's figure is their own estimate on their corpora
  (explicitly labelled "actual savings vary"); this run neither confirms
  nor refutes it — it bounds what ONE real repo saw on a mixed corpus.
- Savings are **highly command-dependent**: already-compact output
  (`git log --oneline`, `--stat` views) passes through at ~0%; verbose
  output (`git status`, `git log`, `ls -la`) lands at ~55%.
- Consequence for agent-config's own copy: every user-facing savings
  figure is **attributed to upstream** ("upstream reports 60–90% — their
  estimate"), and this measurement is cited where agent-config speaks in
  its own voice.

## Result (2026-08-10) — extended corpus (token-economy-cache Phase 4.1)

> Scope of the extension: the corpus gained the top UNWRAPPED high-volume
> classes named by the lean-agent-init diagnosis — a test-runner invocation
> (vitest), a tree-wide grep, and a build command. **Selection basis is the
> roadmap's own candidate list, not per-command session telemetry** — the
> injection census instruments hook payloads, not tool output, so no
> per-tool volume ranking exists yet. rtk 0.44.1, same machine, single run.

| command | raw bytes | rtk bytes | saving |
|---|---:|---:|---:|
| `git status` | 613 | 257 | 58.1% |
| `git log --oneline -50` | 4,287 | 4,280 | 0.2% |
| `git log -10` | 5,997 | 2,901 | 51.6% |
| `git diff --stat HEAD~5..HEAD` | 4,732 | 4,731 | 0.0% |
| `git branch -a` | 32,852 | 25,282 | 23.0% |
| `ls -la src/scripts` | 45,491 | 19,934 | 56.2% |
| `npm ls --depth=0` | 1,042 | 1,041 | 0.1% |
| `git show --stat HEAD` | 2,506 | 2,506 | 0.0% |
| `npx vitest run <one file> --reporter=basic` | 376 | 372 | 1.1% |
| `grep -rn "export function" src/scripts` | 301,927 | 21,499 | 92.9% |
| `npm run build:cli` | 103 | 60 | 41.7% |
| **TOTAL** | **399,926** | **82,863** | **79.3%** |

Honest reading of the extension:

- **The 79.3% total is dominated by one command class** — the tree-wide
  grep (302 KB raw, 92.9% saved) carries most of the aggregate. Without
  it the mixed corpus stays in the ~30% band of the 2026-07-28 run.
- **Test-runner output is a near-passthrough** (1.1%): vitest's own
  reporter is already compact at file granularity; rtk adds nothing
  material there. Wrapping test runs is not where the savings live.
- **Consequence:** the high-value wrap targets on this repo are
  tree-wide search and directory/branch listings — exactly the verbose
  classes; compact structured output (`--stat`, `--oneline`, `npm ls`)
  passes through at ~0% in both runs.

## Reproduce

```bash
internal/bench/rtk-savings/corpus.sh
```
