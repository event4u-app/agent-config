<!-- evidence-type: analysis -->

# Does `decideDeployWrite`'s `unknown` arm preserve a ledger-listed path with no recorded digest?

You are deciding one narrow question in the installer of `event4u/agent-config`,
a package that deploys managed files into a consumer's `$HOME` and into their
project. Decide it on the evidence below. Report findings; do not assume any
particular outcome is wanted.

## The code as it stands

`src/install/preserve.ts`:

```ts
export function decideDeployWrite(inputs: DeployWriteInputs): DeployWriteDecision {
    if (!inputs.exists) return 'write';
    if (inputs.force) return 'write';
    const ownership = classifyOwnership(inputs.recordedSha256, inputs.onDiskSha256);
    return ownership === 'recorded-modified' ? 'preserve' : 'write';
}
```

`classifyOwnership` returns `unknown` when no digest was recorded for the path,
and `unknown` therefore **writes** — i.e. overwrites whatever is on disk. The
module's own header argues for that: "Preserving there would stage a sidecar
beside every pre-existing file on a first install, which is not protection, it
is noise."

A preserved file costs the consumer three things: the managed file is left
alone, the package content is staged beside it as `<path>.agent-config.new`,
and the whole run exits `3` ("completed with conflicts") instead of `0`.

## What changed around it

A user-scoped ownership ledger now exists (`global_deploy_inventory`, schema 2).
It is written on **every** global deploy, wherever the install ran from, and it
records `{path, installed_sha256, packaged_sha256}` per file. `recordedHashesWithLedger`
lays the ledger's digest map over the project manifest's, so a path recorded in
either one classifies correctly and reaches `recorded-modified` when edited.

Schema 1 of the same file listed paths in a `files[]` array and recorded **no
digest at all**. The schema bump is additive; schema-1 files still load.

## The question

A roadmap step (2.4) proposes: the `unknown` arm becomes `preserve` for a path
the **ledger lists**, and stays `write` for a genuinely unrecorded pre-existing
file.

The set that change actually reaches is narrow and worth stating exactly. A
path is ledger-listed-but-digest-less only when **all** of these hold:

- it was deployed globally by an install that predates the ledger (schema 1), and
- no project manifest records a digest for it either — which means that install
  ran from a directory carrying no project settings, because an install from a
  project with settings wrote a manifest that does record those digests.

That is precisely the population the roadmap's K1/K2 defect describes: the
consumers whose global edits are currently overwritten silently.

For them, on the **first** install after upgrading across the schema bump,
every such file is listed without a digest. The install cannot tell an edited
file from an untouched one, because nothing recorded what was written.

## Candidate dispositions

**(a) Preserve.** `unknown` + ledger-listed → `preserve`. The first post-upgrade
install for that population stages a sidecar beside every affected file and
exits 3. From the second install onward the ledger carries digests and the
behaviour is exact. Edits are never lost; the cost is one loud, confusing
install for people who had edited nothing.

**(b) Close the step as already satisfied.** Argue that 2.3 did the work: the
ledger now records a digest for every path it writes, so a ledger-listed path
with a digest already reaches `recorded-modified`. Restricting the preserve arm
to digest-bearing ledger paths is a no-op, so the arm stays as it is and the
roadmap records why. Pre-ledger global edits made from a settings-less
directory are lost once, on the next install, and the roadmap says so.

**(c) Backfill and state the loss.** Keep `write` for the digest-less case, but
have that install record the digest of what it wrote, closing the ambiguity
window after exactly one install. Same outcome as (b) for the consumer — one
lost edit — but the window is explicitly bounded and documented rather than
left implicit. (Note: 2.3 may already do this; verify before preferring it on
that ground alone.)

**(d) Something else you can name and defend.**

## Considerations that are in scope

- Which direction is recoverable. A preserved file is recoverable by the
  consumer; an overwritten edit is not.
- Whether a one-time noisy install is an acceptable price, and whether it can
  be made legible (e.g. a distinct message for the migration case) rather than
  merely tolerated.
- Whether `rc=3` on a migration install breaks anything downstream — CI, a
  wrapper script, the GUI wizard (`installCompleted` already treats 3 as a
  completion).
- Whether a decision here should be bounded by a `revisit-if`.

## What is out of scope

- Changing `--force` semantics.
- Adding a CLI verb, a prompt, or any interactive question to the installer.
- Project-scope behaviour: this is about globally deployed files.

## Output asked for

A verdict naming one of (a)–(d), the reasoning behind it, the condition that
should reopen it, and — if your verdict is not (a) — a plain statement of what
a consumer loses under it.
