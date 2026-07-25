# Project overrides

Project-local override layer for `@event4u/agent-config` (see ADR-020 — consumer
installs are global-only). Files dropped under the directories below replace or
extend their global counterparts from `~/.event4u/agent-config/`.

## Layout

```
agents/overrides/
├── rules/      # Always-active behaviour rules (project-scoped)
├── skills/     # On-demand domain skills (project-scoped)
└── commands/   # Slash commands (project-scoped)
```

The `.gitkeep` placeholder in each subdir is committable so a fresh consumer
repo can track the structure before any actual overrides are added.

## How overrides resolve

Highest precedence wins:

1. `agents/overrides/<kind>/<name>.md` — this project (wins on name match)
2. `~/.event4u/agent-config/<kind>/<name>.md` — user-global shared layer
3. Bundled defaults that ship with the package

Drop a file under `agents/overrides/rules/foo.md` to override the global
`foo.md` rule for this project only; delete the file to revert to the global
copy. The bridge anchor at `agents/.event4u-bridge.yml` tells the loader which
`~/.event4u/agent-config/` install to pair with.

## What you cannot override

The nine kernel rules — `agent-authority`, `ask-when-uncertain`, `commit-policy`,
`direct-answers`, `language-and-tone`, `no-cheap-questions`,
`non-destructive-by-default`, `scope-control`, `verify-before-complete` — and
anything marked `tier: safety-floor` are **not replaceable**. You may *tighten*
one with a `Mode: extend` override plus an entry in
`agents/overrides/kernel-exceptions.yml` recording why. A `Mode: replace` on one
is refused and reported.

Two consequences that are easy to miss:

- **"Wins on name match" is not unconditional.** An empty file at
  `agents/overrides/rules/non-destructive-by-default.md` does not switch off the
  Hard Floor — it is refused.
- **Whole-file replacement freezes that file.** Later fixes to the original,
  including security fixes, stop reaching you for as long as your copy exists,
  and nothing announces it. Prefer `extend`, which keeps the rest of the rule in
  the update flow.

## Adding your first override

```bash
# Start from the global copy so you only edit the deltas:
cp ~/.event4u/agent-config/rules/<name>.md agents/overrides/rules/<name>.md
$EDITOR agents/overrides/rules/<name>.md
```

Run `agent-config doctor` afterwards to confirm the loader sees the override.

## Settings

Project-local `.agent-settings.yml` is **tolerated but not required**. Effective
settings merge `defaults < global < project-overrides`; see
`docs/contracts/layered-settings.md` (in the package) for the precedence model.
