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

The refusal is the whole mechanism. There is no sanitising pass that repairs a
candidate — a candidate that fails intake is reported and stops.

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

Not here, and not in any tracked artefact. `source-confidentiality` forbids a
tracked file naming an external project this package learned from. A rejection
reason names the **covering artefact in this package**, never the upstream. If
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
