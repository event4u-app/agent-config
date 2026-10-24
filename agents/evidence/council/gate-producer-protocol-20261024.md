<!-- evidence-type: analysis -->

# The protocol names the right points; the envelope under it is still owed

AI council, 2026-10-24, the second round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, 2/2 present, 2 rounds with peer review, design mode,
CLI transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-producer-protocol-20261024.question.md`. The draft it
asks about is `agents/evidence/analysis/gate-producer-protocol-20261024.md`,
written to discharge D25.

## Verdict: convergent, and narrower than a no

- openai: *"go for adversarial fixtures and a disposable `v0` schema, but do
  not declare the trust boundary closed or stabilize `v1`."* Confidence high.
- anthropic: *"Yes to exploratory fixtures explicitly expected to change. No to
  a schema draft that implies stability or completeness."* High confidence on
  the fixtures, medium-high on a disposable `v0`, high that `v1` is premature.

Both name the **same single item owed first**, in nearly the same words:

> a validator-owned invocation-envelope specification covering execution
> identity, controlled and uncontrolled inputs, channel lifecycle, resource
> limits, deterministic status precedence, and report persistence behaviour.

So D24 items 3 and 4 move from *withheld* to *conditionally permitted*: the
fixtures are adversarial and expected to change, they attack the envelope
specification, the schema is named and versioned as disposable, and nothing
claims step 7.1 closed. Step 7.1 stays open.

## Where the seats converge

1. **All eight points are addressed; only raw evaluation versus disposition
   (P4) is resolved.** Identity, binding, evidence, lifecycle, coverage and
   previous-policy selection stay partial.
2. **"Binding" overclaims.** Recording a revision next to a result is context
   metadata, not proof the producer read that revision. Use *recorded* for
   metadata and reserve *bound* for what the validator actually controls.
   P2's "wrong-revision defence" is rewritten as *correlates output with a
   validator-started invocation*.
3. **A nonce is correlation, not writer authentication.** Producer and
   validator share a principal, environment and filesystem, so the trust
   boundary is not closed. P1's narrow honesty is accepted for non-authoritative
   experimentation only.
4. **P1's identity is the wrong object.** An entry-script blob hash does not
   identify behaviour that depends on imported modules, the lockfile, Node
   flags, environment or a dirty tree (openai, critical). It either becomes a
   validator-owned execution manifest or is renamed `entrypointBlob`.
5. **P3 is integrity telemetry, not provenance.** Rehashing producer-declared
   paths after the run cannot prove what was read or when (time-of-check /
   time-of-use), nor that undeclared inputs were not used.
6. **Merge base is not policy lineage.** Stacked branches, rebases,
   criss-cross merges, shallow clones and merge-queue synthetic commits can
   select a policy that was never enforced. *"An immutable object can still be
   the wrong object."* Permitted only as provisional telemetry that records
   source, CI-pinned target, selected base, the algorithm and any ambiguity;
   never labelled *previous enforced policy* without evidence from real
   workflows. anthropic calls this the hardest pushback.
7. **P5 must become a deterministic lifecycle and state machine**, with
   process-group termination and channel closure before parsing, and the full
   parse, process, filesystem and validator-lifecycle failure classes.
8. **The exit-code rows are migration compatibility, not protocol truth.**
   Replace them with a per-producer, versioned compatibility matrix that
   expires.
9. **Report-only needs an operational-health dimension.** Exit 0 is fine for
   evaluation; a validator that cannot write its summary must fail or degrade
   visibly, or the report can vanish while CI stays green. Status precedence
   (openai): `validator operational failure > invalid > incomplete > complete`,
   per-producer status kept separate from the run status.
10. **P7's "governed path" is an open question inside an enforcement rule.**
    Report-only may detect removals; it cannot know which are authorised.
    Renames and splits need stable identities or explicit mappings.
11. **A kill switch outside the producer registry**, disabling only the new
    reporting path, with stated triggers (existing gate behaviour changing,
    hangs, missing summaries, runtime regression, widespread false `invalid`,
    leakage) and stated ownership and re-enable criteria.

## Where the seats split

| Question | anthropic | openai | Taken here |
|---|---|---|---|
| Is merge base blocking for `v0`? | Yes for `v1`; wants pinned target or tested alignment before it is load-bearing | Provisional telemetry is enough for `v0` | `v0` records it as telemetry only; neither seat lets it be load-bearing |
| A separate proof-of-concept before the fixtures | Yes, one throwaway fixture before P1–P8 are finalised | No separate gate; the first adversarial fixture is the proof of concept | The first fixture is the proof of concept; both outcomes are the same file |
| Commit time as the freshness clock | Not raised | Deterministic but not trustworthy; needs bounds and a "revision-relative" label | Recorded as owed in the envelope spec |
| Data exposure in `detail` and paths | Not raised | Size limits, redaction, untrusted-field marking | Recorded as owed in the envelope spec |

## What is owed next

The invocation-envelope specification, then adversarial fixtures that attack
it (surviving child writer, dirty or concurrently modified checkout, omitted
and changed evidence, malformed, oversized, mixed-version and post-terminator
output, timeout, signal and summary-write failure, target movement and
ambiguous bases, rename of a governed check), then a disposable `v0` schema.
Authority, `v1` and any claim of a closed trust boundary stay behind
`external-bootstrap-boundary-for-phases-2-3`.
