<!-- evidence-type: analysis -->

# Council — how the release cut recognises ADR-300's automatic migration

| Field | Value |
|---|---|
| Date | 2026-10-24 |
| Question | `agents/evidence/council/adr-300-exception-at-the-cut-20261024.question.md`, committed before the run and not edited after it |
| Members | `anthropic/claude-sonnet-4-5`, `openai/codex-default`, CLI seats, 2 rounds, blind review |
| Quorum | 2/2 present, needed 1 — concluded |
| Cost | $0.00 (subscription CLI seats) |
| Raw response | `agents/runtime/council/responses/adr-300-exception-at-the-cut-20261024.md` (gitignored, local) |
| Blocker | `adr-300-exception-at-the-cut` in `road-to-a-release-that-says-whether-it-needs-you` |
| Routing | the orchestrating session ruled on 2026-10-24 that the blocker carries out an owner decision already taken, removed option (c), and routed (a) vs (b) to the council |

## Verdict

**(b), 2/2, converged.** Only a key moved into `RENAMED_KEYS` counts as an
automatic migration at the cut, and only when the release declares
`Consumer-Impact: automatic`. A key moved into `REMOVED_KEYS` still needs its
`MINOR_REMOVAL_PROOFS` entry or a major. The rule sentence is amended in all
eight places.

Both seats named the same discriminator: `RENAMED_KEYS` carries the consumer's
value onto the new path; `REMOVED_KEYS` discards it. The trailer is written by
the author and the cut cannot verify it, so it may not turn a value-discarding
removal into a migration. Both also cited 17.0.0's ADR-293 batch: a removal
with a one-time conversion module still shipped as a major classed `action`.

## Conditions the seats attached, and where each landed

- The release declares `automatic`, and the key is newly carried by
  `RENAMED_KEYS` — `belowMajorRefusalLines` (`impact` parameter), fed by
  `release.ts` with the span's strongest declared impact.
- A named test proves the value carry — `every RENAMED_KEYS alias carries the
  value onto its new path` in `tests/scripts/release_settings_delta.test.ts`,
  iterating every entry, including the case where the new key already exists.
- The old alias stays until a major — unchanged; a dropped alias is still
  refused below a major whatever the trailer says (asserted in the same test file).

## Dissent and residue

No dissent on the pick. `openai` added that (b) alone under-implements ADR-300
for genuine non-rename migrations (a conversion module like 17.0.0's) and asked
for a separate, test-backed migration registry; `anthropic` agreed it belongs
in its own registry rather than in `REMOVED_KEYS`. That registry is not built
here: it is a follow-up, and until it exists such a removal takes a
`MINOR_REMOVAL_PROOFS` entry or a major, which is the conservative side.
