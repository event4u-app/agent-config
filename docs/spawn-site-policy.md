# Spawn-Site Policy — subprocess env-hardening classification

> Every place agent-config spawns a subprocess is classified into one of four
> buckets. The bucket decides whether the spawn MUST route its environment
> through `hardenedSpawnEnv()` (`src/scripts/_lib/spawn_env.ts`). This document
> is the single authoritative inventory — a new spawn site is visible in a PR
> diff as either an addition to a bucket below or an unclassified site that
> contradicts this doc's completeness claim. That git-diff visibility is the
> enforcement mechanism (a dedicated lint was considered and **rejected** — see
> ADR-123 and the "No lint" note below).

## The buckets

| Bucket | Definition | Env rule |
|---|---|---|
| **Consumer Runtime** | Runs on the end-user's machine as part of the installed package — the hook dispatcher, dispatched hook concerns, and the AI-council CLI transport. The parent `process.env` is whatever the user's agent/shell exposes and is influenceable by repo content the agent just read. | **MUST** pass `env: hardenedSpawnEnv(overrides?)`. |
| **Maintainer CLI / tooling** | Runs on a maintainer's dev machine, invoked explicitly (benchmarks, fixture replay, wizards, one-off scripts). The env is the maintainer's own. | SHOULD prefer the helper; MAY use raw env with a stated reason. Not attacker-controlled. |
| **CI (trusted)** | Runs inside this repo's GitHub Actions on the repo's own refs (git/gh helpers reading `git log` / `gh pr view`). Env is set by the workflow file, not by PR content; fork PRs get no secrets. | Raw env permitted. Migrate only if a job begins consuming untrusted fork content into its env. |
| **Install-time** | Runs during `npx`/install (the installer spawning package managers from a lockfile). | Raw env permitted; installs are lockfile-pinned. Revisit if an installer step ingests untrusted input. |

## Consumer-Runtime inventory (the security-critical set)

All Consumer-Runtime spawns route through `hardenedSpawnEnv()`:

| Site | Spawns | Status |
|---|---|---|
| `src/scripts/ai_council/clients.ts::_runSubprocess` | provider CLIs (`codex`/`claude`/`gemini`) | ✅ hardened (ADR-123 / PR #984) |
| `src/scripts/hot_context_hook.ts` | `git rev-parse` | ✅ hardened (PR #984) |
| `src/scripts/roadmap_progress_hook.ts` | tsx regenerator (runs git) | ✅ hardened (PR #984) |
| `src/scripts/hooks/dispatch_hook.ts` | every hook concern via tsx | ✅ hardened (this roadmap) |
| `src/scripts/hooks/replay_hook.ts` | re-dispatches through the runtime | Maintainer/fixture tool; its downstream concern spawn is hardened by `dispatch_hook` above. Exempt at this layer. |

Any NEW consumer-runtime spawn (a new hook that shells out, a new installed
runtime path) MUST be added to this table and route through `hardenedSpawnEnv`.

## Maintainer / CI / Install (exempt, with rationale)

The remaining spawn sites (benchmarks `bench_*`, `consumer_matrix`, the
installer `install.ts`, the fleet CLI, and the ~15 git/gh maintainer helpers
such as `check_trunk_drift`, `evidence_report`, `print_required_checks`,
`check_release_pr_shape`, `migration_status`, …) are Maintainer CLI, trusted CI,
or install-time. Their environment is the maintainer's own or GitHub Actions'
workflow-controlled env — not influenced by untrusted repo content the agent
read at runtime. They are exempt from the MUST rule. A maintainer/CI site moves
to the Consumer-Runtime bucket (and MUST harden) only if it starts running on an
end-user machine or ingesting untrusted fork content into its spawn env.

## What `hardenedSpawnEnv` scrubs

Deny-by-family (not an allowlist — the CLIs legitimately need arbitrary env):
dynamic loader (`LD_*`, `DYLD_*`, `GCONV_PATH`), git command hooks
(`GIT_*_COMMAND`, `GIT_EXTERNAL_DIFF`, `GIT_SSH_COMMAND`, `GIT_PAGER`, `PAGER`),
**git config-injection** (`GIT_CONFIG` and the whole `GIT_CONFIG_*` family —
`GIT_CONFIG_COUNT`/`_KEY_<n>`/`_VALUE_<n>`/`_GLOBAL`/`_SYSTEM`, the
`core.fsmonitor` RCE primitive), `GIT_ALTERNATE_OBJECT_DIRECTORIES`,
`HOSTALIASES`, runtime auto-exec hooks (`NODE_OPTIONS`, `BASH_ENV`, `ENV`,
`PYTHON*`, `PERL5*`, `RUBYOPT`), and `IFS`. Everything else is preserved.

## No lint (deliberate)

A CI lint forbidding raw spawn in runtime paths was proposed and **rejected**
(council 2026-07-21; recorded in ADR-123): it is net-new governance surface (a
CI gate + allowlist + exemption-adjudication + false-positive triage), which the
complexity-budget lock forbids ("must not become a new rule/linter/gate"). This
inventory doc is the self-enforcing substitute — its completeness claim is
checked by git-diff visibility at review time, not by a build gate.

## See also

- `docs/decisions/ADR-123-runtime-security-scope-and-spawn-hardening.md` — the runtime-security scope decision + the rejected-lint record.
- `docs/threat-model.md` row (g) — the subprocess-env-inheritance vector.
- `src/scripts/_lib/spawn_env.ts` — the helper.
