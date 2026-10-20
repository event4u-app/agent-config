---
proposed_by: claude-opus-5.5/drain-gates-read-written-20261020
implemented_by: claude-opus-5.5/drain-gates-read-written-20261020
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-20
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
subject: f3e5598593fc4ff2c466c065ae4e04e925e6d180f4d404f35dbdc2399385ca8c
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the speaking-inbox guard probes what it can place

Covers branch `drain/gates-read-written-20261020`, Phase 3 of
`road-to-gates-that-read-what-was-written` (decisions D7 and D8). One gated file,
`src/scripts/hooks/block_speaking_inbox_dir.ts`. The subject above is
`ratification_subject` over the branch's whole changed-file list; it was first
computed at `18bba1df1`, the head round 3 reviewed, and is unchanged at
`8d61e75d6`, which restores that file byte-for-byte (see Round 4).

## What changed

1. A path-keyed tool's relative path is probed against the native payload
   `cwd` only, and only when absolute. `project_dir`, `workspace_root` and a
   wrapper-level `cwd` are never read. No `cwd` keeps the base behaviour.
2. A shell command's token gets the already-exists probe only when it is
   absolute. A relative token naming a speaking directory is refused wherever
   it exists.
3. No command shape is exempt from the token scan. The deny message asks for
   the source itself, never an `agents/tmp` path, and says a shell command
   reaches an existing directory only by absolute path.

## The review — four rounds, CLI seats, nothing billed

Prompts and seat texts are committed verbatim beside each other as
`agents/evidence/council/speaking-inbox-guard-mention-review-20261020{,-r2,-r3,-r4}.*`.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `5f1ed1604` | refused | refused |
| 2 | `f65646b17` | refused | refused |
| 3 | `18bba1df1` | confirmed-non-expanding | confirmed-non-expanding |
| 4 | `1418c8c8a` (delta only) | no answer (`exit_1`) | confirmed-non-expanding |

- **Round 1** refused the remediation exemption: a regular-file check on a
  workspace-writable `./scripts-run` is shape, not identity. Kept: the
  native-`cwd` base and its conflicting-field tests, accepted by both seats as
  tightening.
- **Round 2** refused the cwd probe on a relative shell token: `helper
  agents/tmp/<name>`, where the helper changes directory first, was refused at
  the base and allowed by the probe. Both seats converged on the absolute-only
  form round 3 reviewed.
- **Round 3** returned `confirmed-non-expanding` 2/2. Both seats called the
  change stricter than the base for shell tokens and correct for path-keyed
  tools. Two low findings: the hint "a shell command reaches it only by its
  absolute path" describes shell resolution rather than guard recognition, and
  the test suite left its temporary trees behind.
- **Round 4** put the fix of both findings to the council. The anthropic seat
  exited 1 without an answer; the one retry returned no answer from either
  seat. The round cap is spent, so the gated file was restored to the round-3
  bytes (`8d61e75d6`); the test cleanup, which is ungated, stays. The reworded
  hint is carried as open step 3.5 of the roadmap. The round-4 openai reply is
  committed but not counted as a seat verdict here.

## Classification

`confirmed-non-expanding`, from both round-3 seats. The newly allowed case is a
path-keyed relative path into a directory proven to exist under the tool's
absolute `cwd`; it grants no creation. Shell tokens lose the relative probe the
base gave them. No recorded security, privacy or safety floor is lowered.

## Measured

At `8d61e75d6`: `tests/hooks/block_speaking_inbox_dir.test.ts` 92/92. Against
the base guard the new suite has 4 red: a relative Write under native `cwd`,
the message wording, and two cases where `project_dir` naming another tree made
the base allow a `mkdir -p` and a Write. Neutralising each mechanism re-reds its
cases: the absolute-only shell probe 2 (incl. the helper-script case), the
native-`cwd` base 2, the absolute-`cwd` check 1.

## What this record does NOT establish

That a relative `ls` of an existing round is allowed — it is refused by design
(D7). That the operational cost of that refusal is low: both round-3 seats named
it as a deliberate cost that pushes toward absolute paths or the kill switch.
