# Provenance ledger

`borrows.jsonl` is the machine-readable record of every conscious external-code
borrow this repo has taken — per the `code-provenance` rule (roadmap
`road-to-provenance-and-license-governance.md`, S1.1): borrowing means read →
close the source → re-derive against house standards → adapt, and any
*conscious* borrow (algorithm, non-trivial structure, more than roughly ten
lines of logic shape) requires an entry here **before** the code lands.

This ledger starts empty. It grows only when a real borrow happens — never
speculatively.

## Record shape

One JSON object per line (JSONL — no header, no comments, no trailing
commas). Every record carries exactly these seven fields:

```json
{
  "source_url": "https://example.com/owner/repo",
  "license": "MIT",
  "source_sha": "a1b2c3d4e5f6...",
  "borrowed_at": "2026-07-28",
  "files": ["src/scripts/example.ts"],
  "transformation_note": "Rebuilt the retry loop around this repo's exponential-backoff helper instead of the source's fixed-delay sleep, and replaced its bespoke queue with our existing job dispatcher.",
  "cleared_by": "human"
}
```

| Field | Meaning |
|---|---|
| `source_url` | Where the borrowed code came from (`https://…` or `git@…`). |
| `license` | The source's SPDX license id, or the literal `"unknown"`. `"unknown"` and any deny-class license (GPL/AGPL/SSPL family, by default) fail the linter — an unknown or incompatible license must be resolved before the borrow lands, never recorded and left unresolved (principle #1: unknown escalates, never down-guessed). |
| `source_sha` | The commit or blob SHA the borrow was taken from (hex, 7–64 chars). |
| `borrowed_at` | ISO-8601 date (`YYYY-MM-DD`) the borrow landed. |
| `files` | Repo-relative paths touched by the borrow. Every path must exist. |
| `transformation_note` | What structurally changed, in enough detail to show real re-derivation. A rename-only description (renamed variables/identifiers, whitespace/formatting only, etc.) is rejected — see below. |
| `cleared_by` | How the borrow was cleared: `rescan` (an automated similarity rescan found the original hit gone after the rewrite), `ledger` (this entry itself is the clearance — the attributed record), or `human` (a human reviewed and cleared it). |

The full JSON Schema lives at
[`src/scripts/schemas/provenance-borrow.schema.json`](../src/scripts/schemas/provenance-borrow.schema.json).

## Append-only convention

- Add new borrows by **appending** a line — never edit or delete a prior line.
  A correction to a past entry is a new line explaining the correction; the
  history stays intact.
- The schema is closed: exactly the seven fields above, nothing more, nothing
  less. An extra field or a missing field fails the linter.
- `docs/THIRD-PARTY-NOTICES.md` is **generated** from this file — never
  hand-edit it. Regenerate after every ledger change:

  ```bash
  ./scripts-run src/scripts/lint_provenance --regenerate-notices
  ```

  CI (`task lint-provenance`) fails if the two files are out of sync.

## Rename-only is not transformation (principle #6)

Winnowing/normalization erases identifiers and whitespace by construction, so
a similarity hit cannot be cleared by renaming variables. A
`transformation_note` that reads as rename-only — e.g. "renamed variables",
"rename only", "cosmetic rename", "whitespace only" — is rejected by the
linter even if the text is otherwise long enough. Clearing a hit requires
either:

- **(a) structural re-derivation** — the hit disappears on a rescan after a
  real rewrite (`cleared_by: rescan`), or
- **(b) an attributed ledger entry** — this record itself, describing what
  actually changed structurally (`cleared_by: ledger` or `cleared_by: human`).

## What the linter checks

`src/scripts/lint_provenance.ts` (wired into `task ci` as `lint-provenance`,
**strict from day one** — it checks our own records, not fuzzy similarity, so
there is no warn-only phase):

- every record validates against the closed schema above;
- every deny-class license fails, and every `"unknown"` license fails
  (principle #1);
- every missing, too-short, or rename-only `transformation_note` fails;
- `docs/THIRD-PARTY-NOTICES.md` must be in sync with this file.

License-class derivation defers to `license-policy.yaml` at the repo root
when present; absent that file it falls back to a conservative built-in deny
set (GPL/AGPL/SSPL family, plus `unknown`) — see the linter's header comment.
