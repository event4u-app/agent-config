---
model_tier: medium
name: design-system-sync
pack: engineering-base
visibility: internal
cluster: design-system
sub: sync
disable-model-invocation: true
skills: [design-system-capture]
description: Reconcile a design system that already exists on the host's canvas into the code through one ledger the user sees, before the user runs the host's own sync.
argument-hint: "plan|reconcile|verify [options]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; user-invoked only, never model-invoked."
workspaces:
  - engineering
packs:
  - frontend-design
---

# /design-system:sync

The repository is the only **store** of the design system. The host's canvas
holds a projection of it, which the host's own sync produces and **which only
the user starts**. This command never starts it, never writes to the canvas and
never touches the network: it reads files and writes one ledger,
`.claude/design-system/sync-ledger.json`, next to `.design-sync/config.json`.

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/design_sync.ts plan \
    --code design-system.json [--remote <snapshot-dir>] [--base-commit <sha>]
npx tsx node_modules/@event4u/agent-config/src/scripts/design_sync.ts reconcile \
    [--set <key>=<disposition>]... [--maturity <m>] [--intent preserve|extend|redesign]
npx tsx node_modules/@event4u/agent-config/src/scripts/design_sync.ts verify \
    [--render-check <file>] [--baseline <path>]... [--accept-render <field>=<reason>]...
```

`--code` is this repo's inventory from [`/design-system:capture`](../capture/command.md);
`--remote` is a snapshot directory the user exported from the canvas, read by the
`claude-design` lane of [`/design-system:import`](../import/command.md).

## plan — what a sync would do, before it does it

Every token path and component export becomes one row, classified across the
**base** (the code file at the projection commit, read with `git show`), the
**code** and the **remote**: `in-sync`, `code-only`, `remote-generated`,
`remote-only:collides`, `remote-only:twin`, `conflict`, `orphan`, `unknown`.
Without a projection commit the comparison is two-way and a differing value is
`unknown`, never a guessed class.

`plan` prints two counts first: **overwrite** (`remote-only:collides` +
`conflict` — what the host sync would overwrite) and **twin**
(`remote-only:twin` — what stays on the canvas as a second system). An
unreachable remote prints `unknown` rows and no recommendation; a
`config.json` with no `projectId` blocks the handover. A second `plan` over
unchanged inputs writes a byte-identical ledger and no other file.

## reconcile — the user disposes every row

`ui_authority`'s resolver runs once: the snapshot is the `reference`, the code is
the `incumbent`, a `Colour Lock` / `Type Lock` in `DESIGN.md` is a hard
constraint, `--intent` is the user. Each `conflict` row is **pre-filled** from
that posture and carries it as provenance — a proposal, never a decision. Then
the user sets each row: `keep-code`, `take-remote`, `import-as-brief` or
`keep-as-exploration` (the last two for a remote-only component, which has no
default). A row left `pending` keeps the run open.

`import-as-brief` writes **no component**. It emits a brief — the remote contract
as the spec — for the run's UI owner (`fe-design` ad hoc, `directives/ui/*` in the
engine), whose coverage records each mechanic as honoured, translated or flagged.
The brief carries the tier names the project's taxonomy detector recorded, and no
tier when it recorded none. Imported values go to
[`design-system-capture`](../../skills/design-system-capture/SKILL.md)'s
per-field import; `DESIGN.md` is not written from here.

## Then the user runs the host sync

When `plan` reports the handover ready, **the user** runs the host's own sync.
The agent does not, on any host, and does not offer to.

## verify — the gates that read the projection

`verify` reads the host's `.render-check.json`: any non-zero failure count,
`variantsIdentical` included, with no `--accept-render` disposition fails the
run. `--baseline <path>` stamps the visual baselines a run touched with the
projection commit; a baseline made against an older projection is reported
`stale`. A check that could not run reports `unverified` or `degraded` with a
reason, never a pass.

## Rules

- **Never invoke the host sync**, never write to a canvas project, never create
  or re-adopt a remote project, never run unattended or in CI.
- **The ledger is the only file written.** The snapshot is written by the user
  under `.claude/design-system/remote-snapshot/<date>/` and never committed by
  this command; nothing in it is executed.
- **Do NOT commit, push, or open a PR.**
