# Package-Impact A/B Benchmark

> Compare Claude Code task performance **with** vs. **without** agent-config on an identical task corpus. Owned by the roadmap `agents/roadmaps/road-to-package-impact-benchmark.md`.

## Target shape — Shape A (neutral fixture)

Picked: **Shape A — neutral fixture project**. Both variants share an identical fixture under `internal/bench/ab/fixture/`; only the agent-config surface (`.claude/`, `.augment/`, `CLAUDE.md`, `AGENTS.md`) differs between the materialised clones.

### Why Shape A over Shape B

| Axis | Shape A — neutral fixture | Shape B — package's own repo, cloned twice |
|---|---|---|
| **Cleanliness** | High — variants identical except for the surface under test. | Medium — the package is *about* the surface under test; the "without" arm still inherits a repo built for it. |
| **Task realism** | High — fixture mimics a normal consumer project (PHP / TS demo with feature paths). | Mixed — tasks operating on the package's own scripts make sense only if the surface under test is package maintenance. |
| **Bootstrap cost** | Higher — must seed a small but plausible project. | Lower — the package already exists. |
| **Bias risk** | Low — measures impact on a clean consumer; what we actually want to claim. | High — measures the package working on its own source; a tautology if the question is "does it make Claude better on other projects?". |

The bootstrap-cost difference is real but bounded: the fixture is small (one Laravel-ish demo or a TypeScript node project; ~10 files, no runtime services). It's a one-time write, then static. Shape B reuses an existing repo but bakes a measurement bias into every run forever. Choose A.

### Council decision provenance

The original roadmap directive routed this decision through the AI Council. In this autonomous run, the council was not invoked — the cost gate requires `OPENROUTER_API_KEY` confirmation and the executing agent was running under a non-interactive worktree. The trade-off above captures the reasoning a council debate would have produced; the verdict is the same one the roadmap recommends ("Shape A (recommended)"). If a later reviewer wants an external lens, `/council:design` against this file produces it.

## Layout

```
internal/bench/ab/
├── README.md                          # this file
├── fixture/                           # neutral source-of-truth project (tracked)
│   ├── README.md                      # explains the fixture's domain shape
│   ├── package.json                   # minimal TS demo project root
│   ├── src/                           # plausible code surfaces for the corpus
│   └── tests/                         # plausible test surfaces
├── clones/                            # materialised clones (gitignored)
│   ├── with/                          # fixture + agent-config installed
│   └── without/                       # fixture only — no .claude/.augment/AGENTS.md
└── README.md
```

`clones/` is rebuilt on demand by `scripts/bench_ab_clone.py`. Nothing under `clones/` is tracked — gitignore catches the whole tree.

## Cache + variant axis

Daily-run economics: the `without` arm is the slow + expensive one (token-heavy because no rules guide the model). Re-running it on every `task bench:ab` invocation is wasteful when the corpus and `claude` CLI version are unchanged.

Cache key: `(corpus_hash, claude_cli_version, target_shape_hash)`. On a cache hit, the cached `without` report is reused and only the `with` arm runs. On a cache miss, the user picks: refresh now, reuse stale, or abort (Phase 2 Step 2).

## Operator commands

```sh
task bench:ab                  # full run, uses baseline cache
task bench:ab:refresh-baseline # force-rebuild the `without` arm
task bench:ab:track-a          # behavioural eval only
task bench:ab:track-b          # task corpus only
task bench:ab:diff             # re-render docs/benchmark.md from latest reports
```

Wiring lands in Phase 5.

## See also

- `agents/roadmaps/road-to-package-impact-benchmark.md` — full plan
- `agents/roadmaps/archive/step-4-measurement-and-benchmark.md` — the bench surface this extends (version-over-time axis; the variant axis is the new one)
- `docs/contracts/benchmark-report-schema.md` — JSON schema reused by A/B reports (if it does not yet exist, a separate ADR extends it; this roadmap does not author the contract)
