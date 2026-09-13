---
stability: beta
keep-beta-until: 2026-10-01
---

# Conformance contract — green means installed AND firing

> **Status:** active · **Owner:** maintainer · **Siblings:**
> [`install-layout.md`](install-layout.md) · [`smoke-contracts.md`](smoke-contracts.md)

`task conformance` (equivalently `agent-config conformance`) is the
consumer-runnable, CI-shaped answer to one question:

> **Is agent-config installed *and firing* in this repo?**

It is deterministic — no LLM, no network — and safe to wire into a
consumer repo's CI. A green run is the "conformance badge" a repo earns;
a red run names the exact broken surface and its remedy.

## § 1 — What runs

Two legs, one exit code:

1. **Doctor under the `--ci` contract.** `agent-config doctor --ci` runs
   the full drift scan plus every registered health check, emits a JSON
   payload, and — unlike the default doctor run, which keys its exit off
   drift only — folds **any check failure** into the exit code.
2. **Five conformance checks** (registered in
   `src/scripts/_cli/cmd_conformance.ts`):

| id | proves | red when |
|---|---|---|
| `txlog-clean` | the last install completed | the install-log tail is an abandoned `abort` |
| `router-pointers` | the installed rule index is intact | any rule id or `routes_to` target does not resolve on disk |
| `hook-dispatcher` | hooks actually fire on this host | the dispatcher errors on a synthetic `session_start` / `stop` envelope |
| `lean-projection` | `lean_projection.mode` matches reality | projected non-kernel rules contradict the configured mode |
| `host-manifest` | a leftover `subagents.host_capabilities` override is flagged deprecated | never fails — the key is inert (always-on orchestration resolves capability from a probe/registry only) |

Every check returns `ok` / `warn` / `unknown` / `fail` / `skipped` with a
one-line remedy. `skipped` means "not applicable here", never "silently
passed"; `unknown` means the check ran and could not answer.

### `txlog-clean` — the three absent-log cases

The install transaction log is written by the browser install route only. A
command-line install therefore produces none, and for as long as an absent
log returned `ok` this check could not go red on the path most consumers
take. It now distinguishes:

| Tree | Row |
|---|---|
| no log, no install manifest — nothing was installed here | `ok` |
| no log, install manifest present — an install recorded no log | `unknown` |
| log present, tail is `write` / `skip` / `rollback` | `ok` |
| log present, tail is `abort` | `fail` |

`unknown` is not a failure and does not change the exit code: an install
that predates the log is an unanswered question, not a broken install.

### What the failure remedy may claim

Nothing in this tree reverses an aborted install. The only rollback-shaped
entry any writer emits is the wizard's dismiss marker (empty path, null
hash), which clears the recovery banner and un-writes nothing. The
`txlog-clean` failure remedy therefore names what re-running `init` actually
does — re-apply the plan over the partial tail — and a test in
`tests/scripts/_cli/cmd_conformance.test.ts` asserts both that the verb it
names is one the dispatcher registers and that no remedy this check emits
promises a recovery the tree cannot perform.

## § 2 — Exit-code contract

| Exit | Meaning |
|---|---|
| `0` | Green — no check failed, no drift. Warnings allowed. |
| `1` | Red — at least one check failed, or manifest drift present. |
| `2` | Environment unresolvable (no project root, corrupt setup). |

The same contract applies to `agent-config doctor --ci` standalone.

## § 3 — Report line (fleet aggregation)

Every run appends exactly one JSONL line — mirroring the install-txlog
entry shape — to `~/.event4u/agent-config/conformance-log.jsonl`
(override: `AGENT_CONFIG_CONFORMANCE_LOG`):

```json
{"ts":"2026-07-07T10:00:00.000Z","kind":"conformance","path":"/repo","sha256":null,"note":"5/5 ok; fails: none"}
```

Fleet installs (`--fleet`) aggregate these lines into their per-repo
summary; the line is append-only and never breaks the exit contract.

## § 4 — Pre-install twin: `init --validate-only`

`agent-config init --validate-only` is the **pre-install** gate — the
typed pre-flight suite (`src/install/preflight.ts`): target-root
permissions, free-disk floor, conflict detection, host-detection
sanity. Nothing is written. Exit `0` = clear, `1` = blocking finding,
`2` = no runner. `--dry-run` (full plan print) and `--minimal`
(settings-only bootstrap) are the existing siblings; `--validate-only`
completes the trio.

## § 5 — CI wiring (consumer)

```yaml
- name: agent-config conformance
  run: npx @event4u/agent-config conformance
```

Green conformance in a consumer pipeline is the supported way to assert
"the OS is installed and firing here" — instead of hand-rolled greps
over projected files.
