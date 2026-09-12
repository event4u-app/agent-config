---
proposed_by: claude-opus-5/drain-session-2026-09-12
implemented_by: claude-opus-5/drain-session-2026-09-12
reviewed_by: council/anthropic+openai-2026-09-12-workflow-step-r2
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — registering a gate step in the workflow that hosts the ratification gate

`check_kernel_edit_ratified` reports two gated surfaces on this branch. The first — a
governance-hook docstring — is covered by `drain-loop-governance-truth.md`, inherited from
the base branch. This artefact covers the second, which that one predates and does not
contemplate:

> `the ratification mechanism itself (gate, reader, policy or workflow)`

`.github/workflows/consistency.yml` runs `check_kernel_edit_ratified` as one of its steps, so
editing it touches the ratification mechanism.

## Why this review exists at all

**The gate was already satisfied without it.** It requires *an* artefact per diff, not per
surface — a deliberately stronger and mechanically decidable rule, per
`docs/contracts/ratification-artifact.md` § What the artifact does NOT decide. So the
inherited artefact would have carried this diff while no reviewer had ever seen the workflow
edit. Reviewing it was the alternative to self-certifying a surface the mechanism itself
names as gated.

## What was proposed

One additive step, between two existing steps, ~310 lines from the ratification gate's own
step, which is untouched:

```yaml
      - name: Verify the per-slot enforcement table matches host_lowering.yaml
        run: ./scripts-run src/scripts/check_enforcement_matrix --quiet
```

Job name unchanged, so the required branch-protection context is unaffected. Nothing removed,
no condition, no failure suppression.

## Why `confirmed-non-expanding` rather than `ratified`

Round 2 returned `ratified` from one seat and `confirmed-non-expanding` from the other. Both
clear the gate; the **more conservative label is recorded**, on the second seat's reasoning
that the evidence "supports confirmation more strongly than full ratification". Labelling a
registration that grants no new authority as `ratified` would record an authority expansion
that did not happen, which is the false-record failure the two-verdict vocabulary exists to
prevent.

## The round that did not converge, and why it was right not to

**Round 1: `confirmed-non-expanding` against `non-convergent`.** The non-convergent seat was
not refusing — it held that registering a command grants that command execution inside CI, and
that a six-line YAML diff cannot establish what the command can reach. It named precisely what
it needed: the implementation, the `scripts-run` execution path, the workflow triggers and
effective permissions, and tests showing missing or unreadable inputs fail nonzero.

That was correct, and the round-1 question had explicitly invited it. The evidence was
gathered and the question re-put.

## The evidence, measured rather than asserted

**Fail-closed, the seat's central question.** Each input made unreadable in turn and the gate
run for real:

| Condition | Exit |
|---|---|
| `src/scripts/hooks/host_lowering.yaml` unreadable (`chmod 000`) | **1** |
| `docs/enforcement-by-host.md` unreadable (`chmod 000`) | **1** |
| both restored | **0** |

It does not exit 0 on an input it could not read. It currently fails closed by *crashing* —
a Node stack trace rather than a clean diagnostic. Safe direction, poor presentation, recorded
rather than omitted.

**Read-only in the mode CI runs.** A grep for `writeFile|mkdirSync|appendFile|execSync|spawn|
fetch(|http` matches in two places, neither reachable from `--quiet`: line 443's
`writeFileSync` is inside the `--write` branch, and lines 533-537 write only into an
`fs.mkdtempSync` temporary directory inside `selfTest()`. No `execSync`, `spawn`, `fetch`, or
HTTP client in the file.

**Scope.** `on: pull_request`, path-filtered, the same job that already runs many sibling
`./scripts-run` gates under identical ambient permissions. The step adds no `env`, no
`secrets`, no `permissions` block, no credential reference.

## Two corrections the reviewer made to the evidence, adopted

Both are narrowings of claims **this artefact's author** made, and both are kept rather than
smoothed over:

1. **"Verified by inspection" was overstated.** Grepping one file does not cover imported
   modules, the `./scripts-run` wrapper's own behaviour, dynamic imports, alternative write or
   network APIs, or indirect side effects. The defensible claim is that *the file's own code*
   is read-only under `--quiet`.
2. **"Zero new authority" was too strong.** The defensible claim is **no new effective
   authority under the documented job context**. Registering code in CI does expand the
   executed code surface even when it expands no permission, and that distinction belongs in
   the record.

A third point is noted rather than adopted: one seat leaned on `scope-control` and
`non-destructive-by-default` as controls bounding this change. The other objected that those
controls were not evidenced in the artefact and therefore could not carry the conclusion. The
objection is correct and the conclusion here does not rest on them.

## A defect found while gathering the evidence, disclosed and then fixed

`check_enforcement_matrix` had **no argument parser**. Unknown flags were silently ignored:
`--help` ran the check and exited 0, and so did `--lowering /nonexistent/file.yaml`, which
read the real configuration and reported green.

It was disclosed in the round-2 question rather than left out, and both seats called it a real
fail-open interface defect that did not affect the hardcoded `--quiet` invocation. Fixed in
the same change: an unrecognised flag now exits 2 naming the flag and the known set. Verified —
`--lowering /nonexistent.yaml` exits 2; `--quiet`, `--self-test` and the bare invocation all
still exit 0; 31 tests pass.

## What would have changed the verdict

Removal or weakening of an existing step; a changed job name; a condition or
`continue-on-error` on the new step; new `env`, `secrets` or `permissions`; a gate that exited
0 on an input it could not read; or any subprocess or network capability in the registered
command.

## Independence

Council, two distinct providers (anthropic, openai), quorum concluded 2/2 in both rounds,
meeting `required_providers: 2`. Neither round's prompt stated an expected outcome, and both
put the strongest argument against the change in front of the seats — round 1 named this
repository's own recorded weakness for this file (a required context pins the job's *name*,
never its steps, so the threat model is step deletion) before any seat raised it. One seat
declining to converge in round 1 is the observable evidence that the framing did not steer.

Per `docs/contracts/ratification-artifact.md` § Honest enforcement: this artefact records who
decided and on what basis. It is not proof that they decided, and the trust anchor is the base
revision plus the platform, never these strings.
