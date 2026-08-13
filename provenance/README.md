# Provenance ledgers

Two append-only ledgers live here, and the split is the useful part: one records
borrowed **code**, the other borrowed **ideas**.

| Ledger | Records | Linter |
|---|---|---|
| `borrows.jsonl` | A conscious external-**code** borrow — an algorithm, a non-trivial structure, more than roughly ten lines of logic shape. | `lint_provenance.ts` |
| `harvests.jsonl` | An externally-sourced **knowledge claim** — a heuristic, a number, a mechanism — asserted by a skill, rule, or roadmap in this repo. | `lint_harvest_provenance.ts` |

Neither is `docs/CLAIMS.md`, despite the overlapping vocabulary. That file and
its gate (`check_claims.ts`) govern **public-facing claims about this package**
— the anti-hype surface. These two ledgers govern what this package took **from
somewhere else**. A grep for "claim" hits all three; the distinction is
direction of travel.

## Borrowed code — `borrows.jsonl`

`borrows.jsonl` is the machine-readable record of every conscious external-code
borrow this repo has taken — per the `code-provenance` rule (roadmap
`road-to-provenance-and-license-governance.md`, S1.1): borrowing means read →
close the source → re-derive against house standards → adapt, and any
*conscious* borrow (algorithm, non-trivial structure, more than roughly ten
lines of logic shape) requires an entry here **before** the code lands.

This ledger starts empty. It grows only when a real borrow happens — never
speculatively.

### Record shape

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

### Append-only convention

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

### Rename-only is not transformation (principle #6)

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

### What the linter checks

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

## Harvested knowledge — `harvests.jsonl`

`harvests.jsonl` records the other half of borrowing: an **idea** taken from an
external source and asserted as doctrine inside a skill, rule, or roadmap. A
comparative analysis that ends "we should adopt their citation registry" has
produced a claim about someone else's work; six months later the sentence
survives in a skill and nobody can say where it came from or whether it was ever
true. This ledger is the answer to that.

The `code-provenance` rule binds the obligation: an artefact asserting an
externally-sourced claim either **cites a `harvest_id`** or **labels the
statement as own analysis**. Both are acceptable; silence is not.

This ledger starts empty. It grows only on a real harvest — never backfilled to
look populated.

### Record shape

One JSON object per line (JSONL — no header, no comments, no trailing commas).
Every record carries exactly these six fields:

```json
{
  "harvest_id": "assertion-level-citation-registry",
  "stated_in": "provenance/README.md",
  "source_ref": "opaque:ref-a",
  "evidence_locator": "sources/INDEX.md — idea|source|page columns",
  "harvested_at": "2026-08-13",
  "verdict": "adapt"
}
```

| Field | Meaning |
|---|---|
| `harvest_id` | Kebab-case slug naming the mechanism. This is what an artefact cites; it is unique across the ledger. |
| `stated_in` | Repo-relative path of the artefact making the assertion, optionally `:<line>`. The path must exist. |
| `source_ref` | `<url>@<sha>` for a public source, or `opaque:<id>` / `ENC1:<payload>` when [`source-confidentiality`](../src/rules/source-confidentiality.md) keeps the source name out of the tracked tree. A **bare URL with no revision is rejected** — an unpinned reference cannot be re-verified. |
| `evidence_locator` | Where inside the source the claim was read. Free-form (sources differ) but never empty. |
| `harvested_at` | ISO-8601 date (`YYYY-MM-DD`). |
| `verdict` | `adopt` or `adapt`. Nothing else produces a row — see below. |

The full JSON Schema lives at
[`src/scripts/schemas/provenance-harvest.schema.json`](../src/scripts/schemas/provenance-harvest.schema.json).

### Only `adopt` and `adapt` produce a row

A comparative analysis classifies findings as adopt / adapt / reject / already /
unclear. Only the first two enter this ledger, and the reason is mechanical
rather than editorial: the ledger's integrity gate asserts that every row's
`stated_in` artefact exists and that every cited id resolves. A `reject` row has
no artefact to point at, because nothing in the tree cites it. Rejections live
in the analysis document, which is where a future harvest goes to find out
whether a question was already settled.

### Append-only convention

- Add new harvests by **appending** a line — never edit or delete a prior one.
  A correction is a new line; the history stays intact.
- The schema is closed: exactly the six fields above. An extra or missing field
  fails the linter.
- Unlike `borrows.jsonl`, this ledger generates no notices file. Nothing is
  legally attributable here — the obligation is epistemic, not licensing.

### What the linter checks

`src/scripts/lint_harvest_provenance.ts` (wired into `task ci` as
`lint-harvest-provenance`), strict from day one for the same reason its sibling
is — it audits our own records, not a probabilistic detector:

- every record validates against the closed schema above;
- `harvest_id` is unique across the ledger;
- `stated_in` resolves to a file that exists and does not escape the repo root;
- `source_ref` is pinned (a revision-carrying URL) or explicitly opaque;
- every `harvest:<id>` reference under `src/` resolves to a row — no orphan
  citations;
- every row's artefact still exists — no dead rows.

**An empty ledger with zero references is a legitimate pass**, and the gate says
so out loud rather than exiting quietly: a gate that scans nothing and reports
green is indistinguishable from a gate that is broken.

### Writing about the marker without citing it

The scanner matches `harvest:` followed by a kebab-case id, so **documentation
that shows the marker literally becomes a citation**. Prose explaining the
syntax uses the angle-bracket placeholder — `harvest:<id>` — which cannot match,
because `<` is not a legal id character. This surfaced on the gate's first run:
the roadmap that introduced the ledger tripped its own orphan check by spelling
the example out. Keeping the placeholder form is the whole fix; no ignore-marker
mechanism is needed, and adding one would create a way to silence a real orphan.
