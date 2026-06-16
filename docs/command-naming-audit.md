# Command-naming audit (road-to-contract-integrity F5)

External review flagged inconsistent command naming across the docs
(`/pr:create` vs `/create-pr`, `/feature/plan` vs `/feature:plan`). Two
names for one command is two sources of truth — a discoverability failure,
not cosmetic polish. This audit fixes the user-facing inconsistencies and
records the canonical rule + the alias registry that already exists.

## The canonical form

Per [ADR-003](decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md) and
[`command-clusters.md`](contracts/command-clusters.md) §"Colon-canonical
invocation": **`/<cluster>:<sub>` is the canonical invocation form
everywhere** — catalog, docs, cookbook. The frontmatter `name:` field is
always the hyphen slug (`feature-plan`); the slash form (`/feature/plan`)
is never an invocation syntax.

## The alias registry already exists — do not add a parallel field

The roadmap step proposed adding an `aliases:` field to the command
schema. That would **duplicate** the mechanism that already ships:

- **`replaces:`** (on the new/canonical command) — the prior name(s) or
  alias(es) it absorbs. Colon forms are allowed here on purpose (historical
  aliases like `commit:in-chunks`). Enforced by `lint_command_routing.py`.
- **`superseded_by:`** (on the old shim) — points forward to the successor.

Adding a second `aliases:` field would re-create the exact two-sources-of-
truth problem this audit fixes. **Decision: `replaces:` is the canonical
alias registry; no new field is introduced.** (This deviates from the
literal Phase-1 roadmap text by intent — see the roadmap step note.)

## Clashes resolved in this change

| Surface | Was | Now | Basis |
|---|---|---|---|
| `README.md` Delivery flow | `/pr:create` | `/create-pr` | The command's own body, `featured-commands.md`, and 3/4 README refs use `/create-pr`; this aligns the outlier to what actually ships. |
| `docs/cookbook.md` (×2) | `/feature/explore`, `/feature/plan` | `/feature:explore`, `/feature:plan` | Colon-canonical (ADR-003); matches the README flow table. |

## Known debt — deferred (own change)

The PR command diverges from the colon-canonical rule: it ships as
`/create-pr` (frontmatter `cluster: git-pr-create`, body documents the
`/create-pr` family and `/create-pr:description-only`) rather than
`/pr:create`. Re-clustering it to `/pr:create` touches the command body,
the `:description-only` sub-family, and every inbound reference — out of
scope for this audit. Until then, **`/create-pr` is the documented
canonical** for that command (it is what the shipped command answers to),
and the colon-form migration is tracked as command-surface debt.

## See also

- [`contracts/command-clusters.md`](contracts/command-clusters.md) — cluster + colon-syntax rules.
- [`decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md`](decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md).
- [`contracts/STABILITY.md`](contracts/STABILITY.md) — command stability policy.
