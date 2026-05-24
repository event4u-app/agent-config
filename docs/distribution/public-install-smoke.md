# Public Install Smoke

Cross-platform install matrix for the two consumer entrypoints.

> **Authority** — Phase 1 of [`road-to-product-adoption.md`](../../agents/roadmaps/road-to-product-adoption.md). The matrix is the regression guard for Phases 3–5 of that roadmap.

## What the matrix runs

Workflow: [`.github/workflows/smoke-public-install.yml`](../../.github/workflows/smoke-public-install.yml).

| Axis | Values | Total |
|---|---|---|
| OS | `ubuntu-latest` · `macos-latest` · `windows-latest` | 3 |
| Node | `20` · `22` | 2 |
| Install path | `setup.sh` (curl) · `agent-config init` (npx bin) · `--dry-run --yes` headless leg | 3 |
| Total legs | | **18** |

Each leg builds a local tarball from the current checkout, extracts it, then invokes the consumer entrypoint against a temp project root. The matrix proves "our installer is correct" — not "the npm registry is reachable".

## Triggers

| Trigger | Purpose |
|---|---|
| Pull request (path-filtered) | Catch regressions before merge when installer files change |
| Push to `main` / `master` | Lock the baseline so a green main can be released without surprises |
| Weekly cron `0 6 * * 1` (Mon 06:00 UTC) | Catch drift from upstream toolchain / registry changes even when no PR touched our installer |
| `workflow_dispatch` | Manual run for incident triage |

## What the matrix proves

- `curl … setup.sh \| bash` resolves a tarball, extracts it, runs `scripts/install`, exits 0 on every OS / Node combination.
- `npx @event4u/agent-config init` (simulated via `scripts/agent-config init` on the extracted tarball) writes `.claude/` and `.agent-settings.yml` to the target project on every OS / Node combination.
- The headless `--dry-run --yes` leg accepts non-interactive flags, produces no file writes, exits 0.

## What the matrix deliberately does NOT prove

- **Provider credentials.** No OpenAI / Anthropic keys in CI; the `agent-config setup` wizard's provider validation step is exercised by unit tests in `tests/cli/` and `packages/core/installer/tests/`, not this matrix.
- **The GUI wizard in a real browser.** The `ui:serve` boot path is covered by `vitest` (`tests/cli/uiServe.test.ts`); end-to-end wizard interactions are deferred to a follow-up roadmap.
- **Network fetch from the public npm registry.** The matrix uses a local tarball on purpose so a flaky registry doesn't fail the smoke. Real-registry health is covered by `publish-npm.yml` after release.
- **Tooling beyond `claude-code`.** The matrix installs a single tool target to keep wall-clock short. The full per-tool matrix lives in [`tests.yml`](../../.github/workflows/tests.yml) (`install-tests` job, sharded × 4).

## Failure policy

- Any leg red → **block merge** (status check required on `main`).
- Weekly cron red → file an issue with the `regression` label and the failing leg's URL; do not auto-retry.
- A leg that flakes twice in 14 days → freeze, audit `tests/test_one_liner_entrypoints.sh` for non-determinism, only un-freeze after a green run on three consecutive cron cycles.

## Adapting the test scope

The matrix invokes [`tests/test_one_liner_entrypoints.sh`](../../tests/test_one_liner_entrypoints.sh) plus the inline dry-run leg. Adding a new install path means adding a `test_*` function to that shell script — the matrix picks it up automatically.

## Roadmap deviations

The Phase 1 roadmap referenced two surfaces that never landed in code:

| Roadmap text | Reality | Adaptation |
|---|---|---|
| `--no-ui` flag | CLI surface is `--yes` (non-interactive) + `--dry-run` (no writes) | Headless leg uses `--yes --dry-run` |
| `AGENT_CONFIG_NO_UI=1` env | Not implemented; non-interactive mode is detected via stdin TTY + `--yes` | Same — `--yes` is the canonical CI-safe entry |

These deviations are recorded here so a future maintainer reading the roadmap doesn't search for flags that don't exist. The intent of the roadmap step — prove the installer survives headless CI — is preserved.

## See also

- [`tests/test_one_liner_entrypoints.sh`](../../tests/test_one_liner_entrypoints.sh) — the smoke harness invoked per matrix leg.
- [`scripts/install`](../../scripts/install) — the consumer-facing installer orchestrator.
- [`.github/workflows/tests.yml`](../../.github/workflows/tests.yml) — the broader install integration matrix (Linux + macOS, 35 tests × 4 shards).
- [`agents/roadmaps/road-to-product-adoption.md`](../../agents/roadmaps/road-to-product-adoption.md) — parent roadmap and acceptance criteria.
