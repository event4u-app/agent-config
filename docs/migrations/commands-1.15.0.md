# Command migration — 1.15.0

> **Audience:** consumers of `event4u/agent-config` upgrading from
> `1.14.x` to `1.15.0`.
> **Authoritative spec:** [`docs/contracts/command-clusters.md`](../contracts/command-clusters.md).

`1.15.0` collapses 15 atomic commands into 3 verb clusters
(`fix`, `optimize`, `feature`) to reduce command-palette
fragmentation. **Old commands keep working through the entire
1.15.x cycle**; they emit a one-line deprecation warning on
invocation and are removed in `1.16.0`.

## Summary table

| Old command | New invocation | Removed in |
|---|---|---|
| `/fix-ci` | `/fix ci` | 1.16.0 |
| `/fix-pr-comments` | `/fix pr` | 1.16.0 |
| `/fix-pr-bot-comments` | `/fix pr-bots` | 1.16.0 |
| `/fix-pr-developer-comments` | `/fix pr-developers` | 1.16.0 |
| `/fix-portability` | `/fix portability` | 1.16.0 |
| `/fix-references` | `/fix refs` | 1.16.0 |
| `/fix-seeder` | `/fix seeder` | 1.16.0 |
| `/optimize-agents` | `/optimize agents` | 1.16.0 |
| `/optimize-augmentignore` | `/optimize augmentignore` | 1.16.0 |
| `/optimize-rtk-filters` | `/optimize rtk` | 1.16.0 |
| `/optimize-skills` | `/optimize skills` | 1.16.0 |
| `/feature-explore` | `/feature explore` | 1.16.0 |
| `/feature-plan` | `/feature plan` | 1.16.0 |
| `/feature-refactor` | `/feature refactor` | 1.16.0 |
| `/feature-roadmap` | `/feature roadmap` | 1.16.0 |

## What changes for you

**Nothing breaks in 1.15.x.** Old slugs continue to work — the agent
recognises them, dispatches to the new cluster command, and prints
one warning line at the top of the reply:

```
⚠️  /fix-ci is deprecated; use /fix ci instead.
```

**Your existing custom skills, rules, or agents/roadmaps that
reference old slugs do not need to change in 1.15.x.** Update at
your own pace.

## What to update before 1.16.0

Search your project for any direct references to the old slugs and
swap them for the new invocation:

```bash
# Find references in agents/, docs/, README, custom rules
rg -n '/(fix|optimize|feature)-[a-z-]+' \
   agents/ docs/ README.md AGENTS.md .github/ 2>/dev/null
```

Common spots:

- `agents/roadmaps/*.md` — roadmap steps that name commands
- `agents/contexts/*.md` — context docs cross-linking commands
- Custom skills/rules under `.augment/` overrides
- Internal team docs / runbooks / onboarding pages

## Why this changed

The atomic-command surface had grown to 77 commands by 1.14.0. Three
prefix families (`fix-*`, `optimize-*`, `feature-*`) accounted for 15
of those — same verb, same invocation pattern, only the noun
differed. Collapsing the families into clusters:

- Reduces palette noise (15 → 3 top-level entries).
- Makes new sub-commands additive (`/fix tests` ships without a new
  top-level slug).
- Holds the line: `scripts/lint_no_new_atomic_commands.py` fails CI
  if a new atomic command lands without a `cluster:` field declared
  in [`docs/contracts/command-clusters.md`](../contracts/command-clusters.md).

## Phase 2 (deferred)

A second wave of collapses (`chat-history`, `agents`, `memory`,
`roadmap`, `module`, `tests`, `context`, `override`, `copilot-agents`,
`commit`, `judge`, `create-pr`) is scheduled after 1.15.0 ships and
the deprecation cycle for Phase 1 closes. Tracked in
[`agents/roadmaps/archive/road-to-governance-cleanup.md`](../../agents/roadmaps/archive/road-to-governance-cleanup.md)
§ F2.

## Related rule split — `chat-history` (post-1.15.0, superseded)

> **Superseded · 2026-05-04** by
> [`agents/contexts/chat-history-platform-hooks.md`](../../agents/contexts/chat-history-platform-hooks.md).
> The three sibling rules (`chat-history-ownership`,
> `chat-history-cadence`, `chat-history-visibility`) and the heartbeat
> marker no longer exist. Persistence is now a pure platform-hook
> contract — `session_start` auto-adopts foreign sessions silently;
> the agent never reads or writes `agents/.agent-chat-history` cooperatively.
> Manual recovery lever: `./agent-config chat-history:adopt`.

For historical context: the monolithic `rules/chat-history.md` was
first split into three sibling `always` rules in the post-1.15.0
optimization phase, recorded in
[`docs/contracts/adr-chat-history-split.md`](../contracts/adr-chat-history-split.md)
(also marked superseded). The hook-only roadmap then collapsed all
three rules into structural-only artefacts.

## Rollback

If a deprecation warning blocks tooling that screen-scrapes agent
output, suppress it for the 1.15.x cycle by setting
`commands.deprecation_warnings: false` in `.agent-settings.yml`.
The setting disappears in 1.16.0 along with the shims.

## See also

- [`docs/contracts/command-clusters.md`](../contracts/command-clusters.md) — locked cluster spec.
- [`docs/contracts/STABILITY.md`](../contracts/STABILITY.md) — public-surface stability tiers.
- [`agents/roadmaps/archive/road-to-post-pr29-optimize.md`](../../agents/roadmaps/archive/road-to-post-pr29-optimize.md) — P0.8 anchor for this migration.
