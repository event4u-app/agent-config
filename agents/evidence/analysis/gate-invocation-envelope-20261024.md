<!-- evidence-type: analysis -->

# Invocation envelope for per-aspect gate producers — a draft

Step 7.1 of `road-to-authority-routing-mechanism`, D26's owed item. Both seats
of the second 2026-10-24 round named one thing to settle before adversarial
fixtures and a disposable `v0` schema: a validator-owned specification of
execution identity, controlled and uncontrolled inputs, channel lifecycle,
resource limits, status precedence and report persistence. This file drafts it.
It is a proposal, not a decision, and it changes no gate.

Vocabulary, as the round asked: **recorded** means the validator wrote it down
from its own knowledge; **controlled** means the validator supplied or fixed
it; **declared** means the producer said so. Nothing here is called *bound* or
*authenticated*. The producer and the validator run as one principal, on one
filesystem, and this envelope does not change that.

## What the existing runner does — read first

`src/scripts/_lib/counted_probe.ts` is the runner `check_gate_coverage` uses
today. Measured against the six items:

- it spawns the child in the **caller's process group** (no `detached`), and on
  timeout or overflow sends `SIGTERM` to **that child only**, so a grandchild
  survives;
- it passes the **caller's whole environment** unless `env` is given;
- the **timeout is optional**; with none, a hung producer hangs the run;
- an output overflow **throws** (`ProbeOverflowError`) rather than reading as a
  short count, and `gate_result.ts` already classifies that error as
  `estate_invalid`.

The envelope keeps the last property and changes the other three.

## E1 — Execution identity: a recorded manifest, not an entry-script hash

Before spawning, the validator records an **execution manifest**:

| Field | Source | Kind |
|---|---|---|
| `source_sha` | `git rev-parse HEAD` | recorded |
| `tree_clean` | `git status --porcelain` is empty, untracked files included | recorded |
| `target_sha` | the CI-provided base SHA, never derived from Git ancestry | recorded |
| `entrypoint_blob` | blob hash of the producer script at `source_sha` | recorded |
| `closure_digest` | hash over the blob hashes of `src/`, `package-lock.json` and `scripts-run` at `source_sha` | recorded |
| `runtime` | `node --version`, the `scripts-run` loader argv | recorded |
| `argv` | the registry row's argv, verbatim | controlled |
| `env` | the allowlist in E2 | controlled |
| `validator_blob` | blob hash of the validator entrypoint at `source_sha` | recorded |
| `registry_blob` | blob hash of the registry file at `source_sha` | recorded |

`tree_clean: false` makes the producer's results reportable but marks the
producer status `incomplete` (`dirty-tree`). The closure digest is deliberately
coarse: it changes whenever anything under `src/` changes, so it cannot claim
two runs behaved alike when they did not; its cost is that it cannot say *which*
change mattered. That is the honest trade for not tracing imports.

## E2 — Inputs: what is controlled, what is declared, what is uncontrolled

**Controlled.** argv; the working directory (the checkout root); the
environment, reduced to an allowlist: `PATH`, `HOME`, `TMPDIR` (set to the
private directory in E3), `NODE_OPTIONS` cleared, `TZ=UTC`, `LANG=C.UTF-8`,
`CI`, and the two envelope variables. Every other variable is dropped, so a
producer that reads an undeclared variable reads nothing.

**Declared.** The `evidence` list a record carries. The validator re-hashes it
after the run and reports a mismatch, and calls the result **integrity
telemetry**, as the round required. It does not prove what was read or when.

**Uncontrolled, and stated as such in every report.** Network access,
filesystem reads outside the declared list, files outside the checkout reached
through symlinks, and mutation by another process during the run. No workflow
under `.github/workflows/` configures a sandbox (a grep for `bwrap`, `firejail`,
`nsjail`, `unshare`, `sandbox-exec` and `--network none` matches nothing), so
the envelope does not pretend to close these. It detects one of them: a
`tree_clean` check is repeated after the run, and a tree that changed during the
run marks the producer `invalid` (`tree-mutated`).

## E3 — Channel lifecycle

1. The validator creates a private directory (`mkdtemp`, mode `0700`) per
   invocation and an empty channel file inside it (mode `0600`). It records the
   file's inode.
2. It spawns the producer **detached into a new process group**, passing the
   channel path and a random nonce in the two envelope variables, with stdin
   closed.
3. The run ends at the first of: the producer exits; the wall-clock limit
   (E4) passes; output exceeds its limit.
4. At that moment the validator sends `SIGTERM` to the **whole process group**,
   waits a 2-second grace, then `SIGKILL` to the group. Only then is the
   channel considered closed. A surviving grandchild cannot write after this,
   because its group was killed.
5. The validator re-checks the channel: still a regular file, same inode,
   link count 1, not a symlink, size within the limit. Any violation makes the
   producer `invalid` (`channel-tampered`).
6. Only then does parsing start. Parsing never overlaps the producer's run.

What step 4 does not cover: a process that leaves the group with `setsid`.
That is a deliberate act by producer code reviewed into the tree; it is named
here as uncovered rather than claimed.

## E4 — Resource limits

| Limit | Default | On breach |
|---|---|---|
| wall clock per producer | the registry row's `timeout`, else 300 s | producer `incomplete` (`timeout`) |
| channel size | 1 MiB | producer `invalid` (`channel-oversize`) |
| records per producer | 256 | producer `invalid` (`too-many-records`) |
| one record | 8 KiB | that record rejected; producer `invalid` |
| `detail` field | 512 bytes, UTF-8, control characters stripped | truncated and marked `truncated: true` |
| evidence entries per record | 64 | producer `invalid` |
| total hashing per run | 256 MiB read | run `incomplete` (`hash-budget`) |
| stdout/stderr | the existing 64 MiB `counted_probe` ceiling | `ProbeOverflowError`, as today |

Every limit is a stated default, not a measured optimum, and each is a field in
the disposable `v0` so it can be revised from what the fixtures show.

## E5 — Parsing and the status state machine

A producer ends in exactly one **producer status**, decided in this order,
first match wins:

1. `operational-failure` — spawn failed, the executable is missing, or the
   validator itself broke while handling this producer.
2. `invalid` — channel tampered or oversized; a record is not JSON, has an
   unknown field, an out-of-enum value or a mixed version; a nonce mismatch;
   two records for one aspect; a record for an aspect another producer owns or
   the registry does not list; a second terminator or a record after the
   terminator; a terminator count that differs from the record count; the tree
   mutated during the run; a disagreement in the compatibility matrix (E6).
3. `incomplete` — no terminator; a registered aspect with no record; timeout;
   killed by a signal; dirty tree at the start.
4. `complete` — none of the above.

The **run status** is the worst producer status under the precedence the round
gave: `operational-failure > invalid > incomplete > complete`. A producer that is
not `complete` never contributes a `pass` for any of its aspects: every one of
its aspects is reported `not-evaluated` with the producer status as the reason.
Every other producer is still run and reported, in report-only and
authoritative mode alike.

## E6 — Exit codes: an expiring compatibility matrix, not protocol truth

During migration each producer's registry row carries a `legacy_exit` entry
stating its own exit semantics, for example
`{ "0": "all-pass", "1": "any-fail-or-not-evaluated", "2": "usage" }`. The
validator checks the records against that producer's entry and reports a
contradiction as `invalid`. The matrix has an `expires` date per row. After
expiry, or once a producer is fully migrated, the exit code is read only as
*process succeeded or not*, which feeds `operational-failure`, and no longer as
an evaluation.

## E7 — Report persistence and operational health

The validator writes its summary (manifest, per-producer status, per-aspect
results, run status) to a file and to the CI step summary, then reads the file
back and checks its digest. Two exit dimensions, kept apart:

- **evaluation exit** — always `0` in report-only mode;
- **operational exit** — non-zero when the summary could not be written or read
  back, or when the run status is `operational-failure`.

In report-only mode the operational exit lands on a **separate, non-required
CI job**, so a broken reporter is visible as a red job without changing any
existing required gate. That is the "fail or visibly degrade" the round asked
for, without making the reporter a new merge blocker.

## E8 — Clock

Time-qualified aspects are evaluated against the **committer timestamp of
`source_sha`**, and every such result is labelled **revision-relative
freshness**. The validator rejects the timestamp (producer `incomplete`,
`clock-implausible`) when it is earlier than the parent's committer timestamp or
later than the CI job start plus 10 minutes. A rewritten history that lands
inside those bounds is not detected; that is stated in the report header.

## E9 — Merge base, as telemetry only

When a comparison needs an earlier policy, the validator records `source_sha`,
the CI-pinned `target_sha`, every merge base `git merge-base --all` returns,
whether history was shallow, and the policy blob hashes it read. Zero or more
than one merge base is reported as `ambiguous-base`, and the comparison is not
made. The result is labelled **merge-base policy (telemetry)** and never
*previous enforced policy*. Nothing blocks on it in `v0`.

## E10 — Kill switch

A repository variable outside the registry and outside the tree,
`GATE_REPORTER_ENABLED`, set through the forge's settings, gates **only the
reporter job**. It cannot be flipped by a pull request. Existing gates do not
read it. Triggers to turn it off: an existing required gate's result changing on
the same revision, a reporter hang or missing summary, a CI runtime regression
beyond 2 minutes per run, false `invalid` on more than a tenth of producers over
a week, or any path or content leakage in a summary. Who may turn it back on is
the same owner-reserved question as every other authority in this roadmap, so
until that resolves, re-enabling is an owner act.

## What the first adversarial fixtures attack

Each fixture is a throwaway producer plus an expected producer status:
a surviving grandchild writing after the parent exits (expect: no record
accepted after E3 step 4); a symlinked channel (`invalid`); a record after the
terminator (`invalid`); a missing terminator (`incomplete`); oversized output
(`invalid`); a mixed version (`invalid`); a tree mutation during the run
(`invalid`); a timeout (`incomplete`); a summary write failure (operational exit
non-zero, evaluation exit 0); an exit code contradicting the records
(`invalid`); a criss-cross history (`ambiguous-base`, no comparison). The first
of them is the proof of concept the round accepted in place of a separate one.

## Limits

- **L1.** Producer and validator share a principal. Nothing here authenticates
  output against a malicious producer; that stays with
  `external-bootstrap-boundary-for-phases-2-3`.
- **L2.** Network, out-of-checkout reads and `setsid` escape are uncontrolled
  and named as such.
- **L3.** Every number in E4 and E10 is a default to be revised from the
  fixtures.
- **L4.** No producer emits records yet; this is drafted against one runner,
  two shared modules and three checks.
