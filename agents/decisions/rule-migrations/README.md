# Rule-migration ledgers — what the body-migration transform kept, folded, and lost

44 of this package's 111 rules carry a line saying their body was migrated to a
skill, guideline, context or contract. The transform is **lossy** and, until
these files existed, unrecorded: `check_condensation` guarantees byte-exactness
for source → projection, and nothing at all covered rule → target.

One file per migrated rule, named after it. Linted by
[`lint_rule_migration_ledger`](../../../src/scripts/lint_rule_migration_ledger.ts).

## Shape

| Field | Meaning |
|---|---|
| `rule` | the rule slug; must match the filename |
| `source` | `recoverable` · `born_thin` · `unrecoverable` — see below |
| `source_commit` / `source_path` | where the pre-migration body was read from |
| `migrated_to` | the resolved target file(s) |
| `source_headings` | the pre-migration headings, **verbatim** |
| `rows[]` | one per `source_heading`: `heading`, `disposition`, `target`, `reason` |

`disposition` is `carried` (survives under a named anchor), `merged` (folded
into a section that also covers other material), or `dropped` (not in any
target). `carried` and `merged` name a target; `dropped` must not.

## Three source kinds, because two of them are different facts

`born_thin` means **no pre-migration body ever existed** — the file was added
already carrying its pointer. `unrecoverable` means a body existed and is now
gone. A ledger that spelled those the same way could not be audited, so they are
separate values and `born_thin` carries no rows at all.

## `source_headings` is the harvest, not a cache

The commits holding the pre-migration bodies for 20 of these rules —
`d4fe80e1c` and `2a11c70b2` — are **not ancestors of HEAD**. They survive only
because 31 and 2 `origin/*` branches still contain them. A routine remote
branch prune destroys them permanently and silently.

Recording the headings here is what makes that survivable, and it is also why
the gate needs no git at all: it compares the ledger against itself and against
the live targets, so it runs unchanged in a shallow CI clone.

## What the ledger found

277 rows across 44 rules: **238 carried · 24 merged · 15 dropped**, the drops
spread over 9 rules. Several of the 15 are losses nobody had recorded, and three
left a live citation pointing at content that no longer exists — a command file
still refers readers to `docker-commands` for a tool-detection branch that is
gone, `laravel-translations` is cited as the home of a key-format mandate it no
longer states, and two files name `reviewer-awareness` as the home of a reviewer
vocabulary that exists nowhere. Those dangling pointers are recorded here rather
than repaired: the ledger's job is that the loss is **visible**, and repairing
them is a change with its own scope.

## Retention policy

Standing policy, not a temporary state: **these ledgers are retained
indefinitely.** The source-recovery rationale above is the reason — the
pre-migration bodies for 20 of the 44 rules exist only in commits that are not
ancestors of HEAD, so the headings recorded here are the only prune-proof
record of what the transform touched. Deleting or archiving the ledgers would
make the recorded losses invisible again, which is the exact state they were
created to end.

Two boundaries keep the policy honest:

- **Never a second rule database.** `src/rules/` stays the sole source of
  truth for what a rule says today; a ledger records only what the migration
  transform did, once. Nothing routes through it at runtime and nothing ever
  should.
- **One consumer.** The files are consumed only by
  `lint_rule_migration_ledger` (self-consistency + live-target checks). A new
  reader is a design change, not a convenience.

## What the gate does not check

Not the semantic quality of a `reason` (a closed denylist of known-empty
phrasings plus a length floor — a gate that scored reason quality would invite
writing to the scorer), not whether `unrecoverable` is truly unrecoverable, and
not whether a heading *should* have been carried. A `dropped` row with a real
reason is a complete answer.
