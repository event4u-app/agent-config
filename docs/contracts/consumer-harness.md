---
stability: beta
keep-beta-until: 2027-01-14
---

# Consumer harness — where a claim about a consumer's machine is checked

> Written for `road-to-gates-that-run-where-the-consumer-stands` Phase 1. Most of
> this package's gates read this repository's own tree; this file names the one
> place that reads what an installed copy does on somebody else's machine, and
> the claims that should be checked there.

## The harness

`tests/install/` is the consumer harness. It is not a second test tree beside
some other one: it is where a case that drives the real installer, uninstaller
or an installed hook against a throwaway user directory lives, and nothing else
in the tree plays that role. `installed_layer_ownership_real_install.test.ts` and
`global_install_hooks_smoke.test.ts` are the shape to copy — they spawn the real
orchestrator with `spawnSync`, let it write, then read back what it wrote.

**Adding a case.** One file per behavior under `tests/install/`, named for the
behavior rather than the module it touches. A case that runs the real
orchestrator costs seconds to minutes, so it says so in its header; a case that
only exercises a pure planner belongs beside its unit tests instead.

**The `HOME` injection rule.** A case never runs against the developer's real
home. It creates a directory with `fs.mkdtempSync`, passes it to the child as
`env: { HOME, EVENT4U_CONFIG_HOME }` (the second set to
`<HOME>/.event4u/agent-config` when the case reaches user-global config), and
removes it in `afterEach`. A case that inherits the parent `HOME` can write into
the machine it runs on, and one that passes only `HOME` still reads the
developer's user-global settings through the second variable.

**A consumer defect starts here.** A reported defect in what an installed copy
does lands as a failing case in `tests/install/` before its fix, and the fix is
the change that turns it green. The case is the reproduction the report could
not carry and the regression test the fix would otherwise ship without; a fix
proved only by a unit test of the module it edited has not shown the consumer's
symptom is gone.

## Consumer-facing claims

A claim in `docs/CLAIMS.md` is **consumer-facing** when its truth depends on what
an installed copy does on a consumer's machine — the installer, the uninstaller,
hook dispatch, the projection a host loads, the MCP server, a CLI verb at
runtime — rather than on a property of this repository's tree, on a benchmark of
a model, or on a governance process. A benchmark run against a fixture corpus is
not consumer-facing even when the feature it measures ships, because the reading
is about the corpus.

The subset, by claim id, read against the ledger on 2026-10-16:

| Claim id | Status | Evidence class today |
|---|---|---|
| `surgical-uninstall` | backed | `exec:` — `tests/install/uninstall_shared_host_config_real_install.test.ts`, this harness, plus the `tests/lib/` unit suites |
| `host-agent-count` | backed | `exec:` — `tests/install/toolDetection.test.ts`, this harness |
| `install-audit-clean` | backed | pointer — a workflow step |
| `hook-dispatch-latency` | backed | `exec:` — `tests/install/hook_dispatch_invocation_path_real_install.test.ts`, this harness; the millisecond figures stay CI-gate readings |
| `default-install-context-cost` | backed | `exec:` — `tests/install/default_install_skill_count_real_install.test.ts`, this harness |
| `thin-inject-delivery-equivalence` | backed | pointer — a bench report |
| `mcp-registered-server-standing-cost` | backed | pointer — a metrics file |
| `skill-tiering-h2-costs-more-by-default` | backed | pointer — an analysis file |
| `council-fallback-loses-zero-seats` | backed | `exec:` — unit tests under `tests/scripts/` |
| `gated-platform-reads` | backed | pointer — `docs/benchmark.md` |
| `no-runtime-daemon` | withdrawn | — |

`tests/scripts/consumer_harness_contract.test.ts` fails when an id in this table
leaves the ledger or changes status, so the subset cannot drift silently.

**Removed from the subset on 2026-10-18:** `scope-dedup-cold-start-reduction`.
Its own claim text states the figure is fixture-measured on byte-identical
projections and "currently unreachable for production installs", so the reading
is about the fixture, which is the exclusion in the definition above. It stays
`backed` on its pointer; a production install that realises the saving would be
a new claim and would belong in this table. The other fixture- and bench-backed
rows stay: each of their claim sentences asserts something about what a shipped
install does, so the exclusion does not reach them.

## What this file does not do

It does not move a case, add a CLI verb, or decide whether a figure becomes a
ratchet. Whether the consumer-path gate count from
`src/scripts/report_consumer_gate_reach.ts` is published as a floor is an open
owner question on the originating roadmap.
