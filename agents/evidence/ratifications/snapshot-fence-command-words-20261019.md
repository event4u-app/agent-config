---
proposed_by: claude-opus-5.5/snapshot-fence-ratification-residue-2026-10-19
implemented_by: claude-opus-5.5/test-snapshot-fence-regex-negatives-20261019
reviewed_by: council/anthropic+openai-2026-10-19-snapshot-command-words-round5
providers: [anthropic, openai]
subject: 2d3fbaf0726037ed344f6876cfc20f7ef3988ce6905b0cfcf83d29615ce55f3a
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the snapshot command warning reads shell words

Covers branch `test/snapshot-fence-regex-negatives-20261019`. The only gated file is
`src/scripts/hooks/block_config_weakening.ts`; the subject digest covers it alone.

## Decision

Both seats, round 5, CLI subscription transport, `confirmed-non-expanding`. The change
replaces the lexical `--update-snapshots` regex of the snapshot fence
(`canvas-snapshot-fence-20261019.md`) with a word reader over simple commands. It touches
only `snapshotUpdateWarning`, which yields WARN or nothing; `evaluate()` and every path
decision are unchanged, so no input moves to or from BLOCK. Commands that only name the
runner or the flag stop warning; real updates the regex missed (`-u`, a quoted flag,
`env`/`sh -c` wrappers, launcher options with values, direct `yarn`/`pnpm` dispatch) now
warn. The recognised shape is stated as a contract in the round-5 prompt, with its
deliberate limits: `sudo`/`time`/`command`/`nohup`/`xargs` wrappers, `env -S`, variable
expansion and npm scripts do not warn.

## How it got here

Five rounds, prompts under `agents/evidence/council/snapshot-fence-command-words*`.
In rounds 1–4 anthropic concurred and openai requested changes, each time naming
concrete commands, all now in the test tables: `env …` and `sh -c '…'` (round 1, along
with the missing test file in the prompt), direct `yarn`/`pnpm` dispatch and `--help`
(round 2), `env -u NAME` and line continuations (round 3), a `-c` after the shell's
operand (round 4). Round 5: both seats concur.

## Residue

Hook bundle 1,549,546 B of 1,550,000 B — 454 B of headroom, enforced by the existing
`check_hook_bundle_composition` gate. The next addition to this bundle will need room.

Spend: five rounds on subscription seats, $0.00.
