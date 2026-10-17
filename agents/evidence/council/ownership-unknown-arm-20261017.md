<!-- evidence-type: analysis -->

# Preserve a digest-less ledger path unless equality with the package is provable

**Date:** 2026-10-17 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: `(d)` — convergent, no split**

Re-decides D3 of `road-to-an-ownership-record-that-belongs-to-the-user` so its
step 2.4 can be implemented. The step had been left open deliberately on
2026-10-16: changing `decideDeployWrite`'s `unknown` arm to preserve every
ledger-listed path would have staged a sidecar beside every affected file on
the first install after the schema bump and exited `3`, which is the noise D3
itself argues against. The question put to the seats was what the arm should
do instead.

## The population, stated exactly

A path reaches the `unknown` arm while the ledger lists it only when **both**
hold: it was deployed globally by an install predating the ledger (schema 1,
no digest), and no project manifest records a digest for it either — which
means that install ran from a directory carrying no project settings. That is
exactly the K1/K2 population: the consumers whose global edits are overwritten
silently today.

| Seat | Pick | Formulation | Confidence |
|---|---|---|---|
| `anthropic` | `(d)` | preserve when ambiguous, write when equality with the package is provable; frame the delay honestly | high |
| `openai` | `(d)` | equality is the only available proof; inequality proves nothing, so overwriting knowingly accepts irreversible loss | high |

## What both seats held

**Ledger membership changes what `unknown` means.** `preserve.ts`'s own header
argues that preserving an unrecorded file is noise rather than protection, and
both seats accepted that argument — for *genuinely* unrecorded files. A
schema-1 ledger entry is different in kind: it is this package's own record
that it deployed that path. The header's reasoning does not reach it.

**Equality with the current package is the only available proof.** If the
bytes on disk equal what this run would write, writing cannot destroy an edit,
whatever the history. If they differ, nothing is proven: the file may carry a
user's edit or merely an older package version, and those two states are
observationally indistinguishable without a recorded digest. Overwriting the
differing file therefore accepts irreversible loss knowingly.

**Recoverability is asymmetric.** A preserved file plus a sidecar is
recoverable by the consumer in a minute; an overwritten edit is not
recoverable at all.

## The correction both seats made to disposition (a)

Disposition (a) as drafted claimed that "from the second install onward the
ledger carries digests and the behaviour is exact". Both seats rejected that
sentence, and the rejection is load-bearing enough to record: a **preserved**
file was never installed, so recording either the packaged digest or the
on-disk digest as its installed digest would assert an ownership this run did
not establish. Preservation therefore **delays** the ambiguity by one install
cycle rather than resolving it.

Where they differed slightly is in how to read that delay. `anthropic` reads
it as useful — it converts a silent immediate loss into a visible delayed one,
and gives the consumer one cycle to notice a file they care about before the
next run treats an untouched file as `recorded-unmodified` and updates it.
`openai` reads it as a real operational cost that could persist until the
conflict is explicitly resolved, and holds that the cost still does not make
silent destruction the safer default. Neither reading changes the pick.

## The rule, as both seats stated it

1. The target does not exist, or the run carries `--force` → `write`.
2. `recorded-modified` → `preserve`, unchanged.
3. `unknown` **and** the ledger lists the path:
   - on-disk digest equals the digest this run would write → `write`;
   - otherwise → `preserve`, with a message naming the migration rather than
     reusing the ordinary preserved-file text.
4. Everything else → `write`, unchanged.

## What a consumer loses under this verdict

Nothing that this package can prove it wrote. The equality check writes every
file provably unedited. An ambiguous file is preserved, and the consumer sees
a message saying why.

Under the alternatives both seats declined — (b) close the step as already
satisfied, (c) backfill and state the loss — a pre-upgrade edit made from a
settings-less directory is silently overwritten on the first post-upgrade
install, and is not recoverable.

## Revisit if

- The package content for the affected files is shown not to have changed
  across the ledger-addition upgrade, which would make the equality check
  decisive in most cases rather than in the best case.
- A migration-generated `rc=3` is shown to break supported automation, and no
  improvement to the message resolves it.
- Conflict resolution gains an explicit step that establishes ownership, which
  would turn the one-cycle delay into a resolution.
