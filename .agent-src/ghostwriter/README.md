# Ghostwriter profiles (package source)

> Third voice primitive — public-figure writing-style profiles consumed
> by `/ghostwriter:write` and `/post-as:ghostwriter`. Peer to
> `personas/*.md` (review-lens) and `.agent-user.md` (maintainer-self).

## What ships in this directory

- `README.md` — this file.
- `fictional-fixture-v1.md` — single allowlisted fictional fixture
  demonstrating the schema. **No real-person profiles ever ship here.**

That's it. Real-person profiles live in **`agents/ghostwriter/`** in the
consumer project and are gitignored by default
(see [`config/gitignore-block.txt`](../../config/gitignore-block.txt)).

## Why fictional-only

The package is OSS. Shipping a real public figure's writing voice
with the package would put a defamation / right-of-publicity surface
on every clone, every fork, every mirror — and the maintainer of this
package never attested anything about that figure. The user who runs
`/ghostwriter:fetch` for a real figure attests in their own project,
and the profile stays local.

The fictional fixture exists so:

- The schema lint has a positive example to validate against.
- New contributors can read a complete profile without us inventing
  one in a doc.
- Tests for the `/ghostwriter:*` cluster have a stable fixture to load.

## Adding a new fictional fixture

Two-step process — **both required**:

1. Add the file stem (without `.md`) to
   [`scripts/ghostwriter_fixture_allowlist.txt`](../../scripts/ghostwriter_fixture_allowlist.txt).
2. Set `fictional: true` in the frontmatter.

`task lint-ghostwriter-source` (runs in `task ci`) fails on:

- Any file in this directory whose stem is not on the allowlist.
- Any allowlisted file missing `fictional: true`.
- Any consumer-side file under `agents/ghostwriter/` with `fictional: true`
  (fictional profiles belong here, not in consumer trees).

New fixtures require reviewer sign-off on the allowlist change.

## Schema

See [`docs/contracts/ghostwriter-schema.md`](../../docs/contracts/ghostwriter-schema.md)
for the locked v1 frontmatter, field reference, confidence derivation,
verification enum, ethics floor, lint rules, and command surface.

## See also

- [`agents/roadmaps/step-4-ghostwriter.md`](../../agents/roadmaps/step-4-ghostwriter.md)
  — the implementation roadmap.
- [`personas/README.md`](../personas/README.md) — sibling primitive,
  distinct voice axis.
- [`docs/contracts/agent-user-schema.md`](../../docs/contracts/agent-user-schema.md)
  — the maintainer-self primitive that `/post-as:me` consumes.
