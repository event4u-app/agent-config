<!-- evidence-type: analysis -->
# How many tests actually skip — the census, and it is the whole deliverable

**Measured:** 2026-08-22 · **Command:** `CI=true npx vitest run --reporter=basic`
**Environment:** local worktree with `CI=true` set. **Named, because it is not a CI runner** — see the honesty section.

## The number

| | count | of | share |
|---|---|---|---|
| **skipped tests** | **40** | 16,266 | **0.25 %** |
| **skipped files** | **3** | 1,172 | 0.26 % |

**The question was never "how many `skipIf` sites exist".** That count is **65**
across **36** files, plus **28** `.skip(` sites, and it answers nothing: a
`skipIf` whose condition is false runs. 40 of 16,266 is the answer.

Both site counts drifted from the figures the commissioning roadmap carried
(66 in 37 files, and 9 `.skip(` sites). Re-measured here: 65 / 36 / 28. The
`.skip(` figure is the notable one — 28, not 9 — and the roadmap's number was
low by a factor of three.

## Where the 40 sit — every file, no elision

| file | skipped / total | what gates it |
|---|---|---|
| `tests/cli/cli-e2e.test.ts` | **12 / 12** | the whole file — a built CLI bundle that this run did not have |
| `tests/scripts/hooks/dispatch_large_payload_guard.test.ts` | **5 / 5** | whole file |
| `tests/scripts/refine_ticket_detect.test.ts` | 3 / 56 | per-test |
| `tests/ai_council/clients_live_smoke.test.ts` | 2 / 3 | live provider credentials |
| `tests/lib/value_report.test.ts` | 2 / 8 | per-test |
| `tests/scripts/bench_ab_pinned_repo.test.ts` | 2 / 17 | per-test |
| `tests/scripts/build_mcp_registry_manifest.test.ts` | 2 / 6 | per-test |
| `tests/scripts/validate_discovery_manifest.test.ts` | **2 / 2** | whole file |
| `tests/contracts/mcp_client_compat_remote.test.ts` | **1 / 1** | whole file — a remote MCP endpoint |
| `tests/install/npm_resolution.test.ts` | 1 / 4 | per-test |
| `tests/scripts/audit_initial_context.test.ts` | 1 / 6 | per-test |
| `tests/scripts/bench_matrix.test.ts` | 1 / 16 | per-test |
| `tests/scripts/bench_per_tool.test.ts` | 1 / 3 | per-test |
| `tests/scripts/lint_command_tiers.test.ts` | 1 / 8 | per-test |
| `tests/scripts/lint_featured_skills.test.ts` | 1 / 6 | per-test |
| `tests/scripts/measure_markitdown_lift.test.ts` | 1 / 4 | per-test |
| `tests/scripts/score_skill_selection.test.ts` | 1 / 4 | per-test |
| `tests/scripts/smoke_path_resolution.test.ts` | 1 / 2 | per-test |

Sums to 40. The dominant conditions across the `skipIf` corpus are
tool-availability guards — `!POSIX` (13 sites), `!tsx` (4), `!sqlite` (4),
`!py3` (4), `!hasNodeSqlite()` (3) — i.e. "the binary this test drives is not
installed here", which is precisely the class that vanishes on a runner that
installs it.

## The honest limit of this measurement

**This is `CI=true` on a developer machine, not a CI runner**, and the difference
is load-bearing rather than pedantic: the two whole-file skips with the largest
counts (`cli-e2e`, 12) gate on **build artefacts and installed tooling** that a
CI job provisions and this run did not. So **40 is an upper bound for CI**, and
the real CI number is plausibly closer to zero.

Reading it the other way — treating 40 as the CI figure — would overstate the
problem this census was commissioned to size. Reading the *shape* is what holds
either way: the skips are tool-availability guards, not disabled assertions.

The precise figure the roadmap's verify asked for — *"a single CI run's reporter
output"* — needs a workflow that publishes its reporter summary as an artefact.
No workflow does today, and adding one is a change to the CI surface that this
census was explicitly told not to make.

## Where it stops, deliberately

The commissioning step 3.2 is a hard stop: *"No capability contract, no
required-environment manifest, no gate."* 0.25 %, dominated by
tool-availability guards, is **trivially small** and the census is the whole
deliverable. Nothing is built on it, no allowlist, no manifest.

**Reversal condition:** a skip count above ~1 % of tests, or any skip that
gates an *assertion* rather than a *tool*. Either would justify its own roadmap
and its own screen.

## One unrelated red, recorded because it was in front of me

`tests/scripts/check_rule_projection_integrity.test.ts` fails in this worktree
("expected 13 to be greater than 50"). It is a known worktree-only false red:
the main checkout masks `.agent-tools.yml` to `tools: []` via skip-worktree and
the test skips there; a fresh worktree does not, so it runs against an
unprojected tree. Green on all CI shards. Not caused by this change and not
fixed here — the fix would be to the test's own environment guard, which is a
different piece of work.
