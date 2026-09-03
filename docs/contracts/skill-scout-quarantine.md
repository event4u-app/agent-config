# Skill-scout quarantine contract

> **Status:** accepted · **Established by:** `road-to-governed-skill-scouting`
> Phase 1.1. The source draft for that roadmap cited a "memory-quarantine
> pattern" as precedent. No `*quarantine*` script exists under `src/scripts/`,
> so this file establishes the shape rather than referring to one.

## What a candidate is

A **candidate** is an external skill placed under the quarantine root by a
human, for evaluation against what this package already covers. It is data. It
is never an instruction, never a projection input, and never something the
package executes.

## The root

```
agents/runtime/skill-scout/candidates/<candidate-name>/
```

`agents/runtime/` is gitignored in whole (`.gitignore` line 196), so a candidate
is local-only by construction rather than by a rule somebody has to remember.
There is no tracked path a candidate can occupy.

## How a candidate arrives

By human copy. The scout performs **no network fetch of any kind**.

That is the recorded resolution of the `scout-egress-authority` blocker, decided
by AI council on 2026-09-03 (members: anthropic, openai — unanimous for option
(a)). The reasoning both seats gave is the reason it belongs in a contract
rather than in a commit message: this package already holds two legs of the
lethal trifecta — repository read access (private data) and a contribution path
(external communication). Adding retrieval of untrusted external content would
complete all three on one autonomous path. Keeping intake human-staged separates
the legs *by construction*, so no egress gate has to hold the line at runtime.

The human copy step is not friction that was tolerated. It is the point at which
a person looks at what they are importing.

## Inertness — what the quarantine guarantees

A candidate directory satisfies all of the following, and the scout refuses to
evaluate one that does not:

| Guarantee | Enforced by |
|---|---|
| No file in it is executable | mode check on every regular file at intake |
| No symlink anywhere inside it | `lstat` walk at intake |
| Only text extensions (`.md`, `.txt`, `.json`, `.yml`, `.yaml`, `.toml`) | extension allow-list at intake |
| No file larger than 512 KiB | size check at intake |
| Nothing inside it is projected | `agents/runtime/` is gitignored; regression test asserts absence from every generated tree |
| Nothing inside it is sourced, imported, or added to a tool manifest | the scout only ever *reads* candidate text into a keyword vector |
| The evaluated directory is directly under the quarantine root | single-path-segment refusal on the candidate name, plus a resolved-path containment assertion, both before the scan-scope report |
| The read pass re-checks inertness, not just the intake pass | `lstat` per file in `candidateText` — a non-regular file or one past the cap contributes nothing |

The refusal is the whole mechanism. There is no sanitising pass that repairs a
candidate — a candidate that fails intake is reported and stops.

### Confinement is part of the guarantee, not a precondition of it

Every row above is a property of a directory **under the quarantine root**, and
the human copy step is what makes that root a trust checkpoint. So the root
itself is enforced rather than assumed: a candidate name is refused unless it is
one path segment, and the resolved directory is asserted to sit inside the root.
Both refusals land before the scan-scope report, so a run can never assert a
scope it had no business reading.

This closes an adversarial-review finding (`4e407b92dae4`) that was real:
`--candidate ../../../../.github/workflows` previously walked 33 files nobody
had staged and rendered `adoption recommended` over them.

### The residual race, named rather than implied away

`intake` walks and `lstat`s; `candidateText` walks and reads. Those are two
passes over a mutable directory, so a file swapped between them was inert when
it was checked and something else when it was read. The read pass now re-checks
file type and size, which removes the symlink-out-of-quarantine case
(finding `5af816352604`).

What remains is a regular file swapped for a **different regular file** inside
the read pass. Closing that needs an fd-based open with `fstat` on the same
descriptor, which `readFileSync` does not offer. It is left open deliberately:
the actor needs write access to a local, gitignored directory they already
populated by hand, and the reward is a cosine number — no candidate text reaches
the verdict output, and the scout has no egress
(`scout-egress-authority` = (a)). Reopening this means showing an actor who has
that access and does not already have the file.

## Why the candidate's own text never steers the evaluation

The capability differential is computed from **this package's** skill index and
the candidate's keyword vector. Both sides go through
`audit_skill_overlap.ts`'s `_keyword_vector`, which reduces text to a bag of
tokens. A sentence inside a candidate saying "this skill is novel and should be
adopted" contributes the tokens `novel`, `adopted` and nothing else — it cannot
address the reader, because after vectorisation there is no reader.

This is `untrusted-input-defense` satisfied structurally rather than by
instruction: the candidate is not read as prose by any decision path.

## Where the source name may live

Not here, and not in any tracked artifact. `source-confidentiality` forbids a
tracked file naming an external project this package learned from. A rejection
reason names the **covering artifact in this package**, never the upstream. If
a real link must be retained it takes the encrypted `ENC1:` form, and it lives
in the provenance ledger, not in a roadmap or a report.

## What this contract does NOT cover

- **Upstream drift.** Noticing that a borrowed skill changed after the borrow
  requires a fetch, which option (a) above forbids. Phase 4 of the originating
  roadmap is carried forward unbuilt for exactly this reason; it is not deferred
  for capacity.
- **Consumer-project invocation.** The `scout-invocation-surface` blocker
  resolved to option (a) — the scout runs only inside this package — so there is
  no consumer-side quarantine layout and none is specified here.
