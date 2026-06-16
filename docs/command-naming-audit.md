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

Everything resolves **toward** the colon-canonical form. The PR command
only ships as `dist/agent-src/commands/pr/create.md` (invoked `/pr:create`);
there is no `commands/create-pr.md` projection, so `/create-pr` is a legacy
*alias name* recorded in `replaces:`, not a directly-invocable command.

| Surface | Was | Now | Basis |
|---|---|---|---|
| `README.md` Delivery flow + 2 prose refs | `/pr:create` (1) + `/create-pr` (2) | `/pr:create` (all) | Colon-canonical (ADR-003); `/pr:create` is the only projected command. |
| `docs/featured-commands.md` | `/create-pr` (→ stale `commands/create-pr.md` link) | `/pr:create` (→ `commands/pr/create.md`) | The legacy link target no longer exists; point at the real projection. |
| `docs/cookbook.md` (generated) | `/feature/explore`, `/feature/plan`, … (slash) | `/feature:explore`, `/feature:plan`, … (colon) | Fixed at the **generator** (`_invocation()` renders `cluster/sub` → `/cluster:sub`); all clustered refs now colon. The file is generated — the slash form was a generator bug, not a hand-edit. |

## Known debt — deferred (own change)

The PR command's frontmatter still carries `cluster: git-pr-create` and its
body prose still self-documents the `/create-pr` family (and
`/create-pr:description-only`). The user-facing invocation and all docs are
now `/pr:create`; retiring the `/create-pr` alias name entirely — frontmatter
`cluster`, the body prose, and the `:description-only` sub-family wording —
is a command-body refactor out of scope for this audit and is tracked as
command-surface debt.

## See also

- [`contracts/command-clusters.md`](contracts/command-clusters.md) — cluster + colon-syntax rules.
- [`decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md`](decisions/ADR-003-flat-cluster-subs-and-colon-syntax.md).
- [`contracts/STABILITY.md`](contracts/STABILITY.md) — command stability policy.
