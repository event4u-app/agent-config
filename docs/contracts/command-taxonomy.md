---
stability: beta
keep-beta-until: 2026-08-12
---

# Command taxonomy

> **Status:** beta — first draft 2026-05-16 (Phase 2 Item 6 of
> `step-15-product-refinement`).

The taxonomy answers **"how is the command surface organized so each
profile finds their three first commands in under 30 seconds?"** It is
a **catalog-organization contract**, not an invocation-rename. Existing
slash invocations (`/work`, `/fix ci`, `/research deep`) are preserved
by the locked verb-cluster contract at
[`command-clusters`](command-clusters.md). This file adds a **profile
axis** on top of the verb axis without breaking either.

## The two axes

| Axis | Owner | Surface |
|---|---|---|
| **Verb-cluster** (existing) | [`command-clusters`](command-clusters.md) | Defines the invocation tree (`/fix ci` dispatches to the `ci` sub-command of the `fix` cluster). Linter-enforced. **Source of truth for invocation.** |
| **Profile** (this contract) | [`profile-system`](profile-system.md) | Defines which verb-clusters and sub-commands are surfaced first for each profile (developer · content_creator · founder · agency · finance · ops). **Source of truth for discoverability.** |

A command can be discoverable under multiple profiles. `/work` is
universal — it appears in `commands_hint` for every profile. `/dcf-modeling`
is finance-only. Discoverability is many-to-many; invocation stays
single-source.

## Membership rules

### Profile membership

A command appears in a profile's `commands_hint` (in
`.agent-src.uncondensed/profiles/<id>.yml`) iff **all** hold:

1. **First-week reach.** A user of that profile will reach for this
   command within their first five sessions without being told.
2. **Profile-coherent.** The command's domain matches the profile's
   primary work surface (engineering for `developer`, content for
   `content_creator`, etc.).
3. **Verb-cluster owned.** The command exists in `command-clusters` —
   no profile may declare a command that has not gone through the
   verb-cluster linter.
4. **Cap of five.** A profile's `commands_hint` is capped at five
   entries. The cap is what makes "three first commands" possible.

### Top-10 most-used (for alias / deprecation policy)

The top-10 list is the **union of all six profiles' `commands_hint`
lists, ranked by per-profile membership count**. As of 2026-05-16
that union is, in rank order:

1. `work` (6/6 profiles)
2. `implement-ticket` (2/6 — developer, agency)
3. `feature` (2/6 — founder, agency)
4. `council` (2/6 — founder, finance)
5. `challenge-me` (2/6 — founder, finance)
6. `review-changes` (2/6 — developer, ops)
7. `fix` (2/6 — developer, ops)
8. `refine-ticket` (1/6 — agency)
9. `commit` (1/6 — developer)
10. `roadmap` (1/6 — agency)

The top-10 is regenerated automatically from the profile YAMLs by
`scripts/regen_top10.py` (Phase 2 deliverable — not yet shipped). Until
the regen script lands, the list above is the locked snapshot.

## Backward-compat policy

The top-10 commands carry a **two-release backward-compat guarantee**:

- A rename of any top-10 command (whether by verb-cluster restructure
  or profile-axis reorganization) ships with an alias for **at least
  two minor releases**.
- The alias is recorded in the verb-cluster's `Replaces` column in
  [`command-clusters`](command-clusters.md) and re-emits a one-line
  deprecation notice to stderr on every invocation.
- Removing the alias requires the `bundled-always-rules-acknowledged`
  PR label and an entry in the CHANGELOG `Removed` section naming the
  end-of-deprecation release.

Commands outside the top-10 follow the existing verb-cluster
deprecation rules (one release as a shim, then disappear).

## Discoverability surfaces

Three surfaces consume this contract:

| Surface | Path | What it shows |
|---|---|---|
| **README** | `README.md` § "Six entry paths" | Per-profile `commands_hint` (max 5) rendered as the first-commands list per profile block |
| **Catalog** | `docs/catalog.md` | All commands grouped by verb-cluster (primary axis), with a per-command `profiles:` line listing which profiles surface it |
| **Wizard** | `.agent-src.uncondensed/commands/onboard.md` | After role selection, prints the five-command starter list from the selected profile's `commands_hint` |

The README and wizard surfaces are already wired. The catalog `profiles:`
line is a Phase 2 deliverable.

## What this contract does **not** do

- **Does not** rename any command. Invocation stays flat (`/work`, not
  `/dev/work`). The `/dev/...` / `/ops/...` strawman in the Item 6
  roadmap entry is **rejected** — adding a profile prefix to invocation
  would dual-namespace the surface, conflict with verb-cluster cluster
  heads, and require a 124-command migration with no measurable
  discoverability gain over the README + wizard surfaces above.
- **Does not** modify the verb-cluster contract. `command-clusters`
  remains the locked source of truth for invocation. This contract is
  additive.
- **Does not** ship telemetry. The top-10 is derived from declared
  profile membership, not observed usage. A usage-based top-10
  recomputation is deferred to Item 10 (Cost Governance Dashboard),
  which already collects per-command call counts.

## Open questions (post-beta)

1. **Profile evolution.** When a seventh profile lands (e.g.
   `researcher`), what is the membership review process for the
   top-10? Proposal: any new profile triggers a `regen_top10.py` run
   and a CHANGELOG entry; no manual review unless the top-10 order
   changes.
2. **Profile-prefix invocation.** If the no-rename verdict is
   revisited (e.g. user research shows discoverability still fails
   even with the README + wizard surfaces), a separate ADR records
   the decision; this contract does not pre-authorize it.
3. **Catalog generator.** `docs/catalog.md` is currently
   handwritten. The `profiles:` line proposed in the discoverability
   table requires `scripts/regen_catalog.py` to consume profile YAMLs
   — deferred to its own roadmap step.

## See also

- [`command-clusters`](command-clusters.md) — verb-axis (invocation)
- [`profile-system`](profile-system.md) — profile-axis (discoverability)
- [`command-surface-tiers`](command-surface-tiers.md) — tier-axis (`./agent-config --help` visibility)
- `step-15-product-refinement` § Phase 2 Item 6
