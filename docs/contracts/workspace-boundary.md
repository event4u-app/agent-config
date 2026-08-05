---
stability: stable
---

# Workspace Boundary Contract

> **Status** · stable · 2026-06-14. Governed by
> [`ADR-095`](../decisions/ADR-095-workspace-boundary-contract.md). Exists to
> stop "workspace" from becoming the new "meta" — a catch-all that absorbs
> every nearby concern until it owns everything and means nothing.

The **workspace** is the task-orchestration layer behind `/work`,
`/implement-ticket`, and the host-drive loop — 13 modules under
`src/cli/python/workspace_*.py`. This contract draws the line around it.

## Owns

The workspace owns the **orchestration and lifecycle** of work:

- **Task orchestration** — picking up, sequencing, and driving a task to done.
- **Host-session lifecycle** — host detection, tier selection, fallback, the
  drive loop, the kill-switch.
- **Continuation** — multi-turn resume: a long task survives across turns
  instead of restarting cold.
- **Drive health** — task completion / abandonment / retry telemetry, drive
  kill-switch signals, local workspace analytics **as drive-health data**.

## Does NOT own

The workspace orchestrates these domains but does **not** own their
*design, semantics, or policy*. It may **consume** their artefacts (read a
skill body to hand it off; read a profile to launch under it) — it must not
**define** them:

| Not owned | Owner lives at | The line |
|---|---|---|
| **Skill design** | `src/skills/`, `condense.py`, `skill_linter.py` | Workspace may *resolve* a skill body for hand-off; it must not define what a skill is or how it is authored. |
| **Profile semantics** | `src/profiles/`, `build_discovery_manifest.py` | Workspace may *launch under* a profile; it must not decide what a profile means. |
| **Video-provider logic** | `src/scripts/ai-video/` | Workspace never reaches into provider adapters or lifecycle. |
| **MCP-registry policy** | the MCP builder / registry surface | Workspace never encodes which MCP servers exist or how they install. |
| **Analytics product strategy** | the telemetry / product-analytics surface | Workspace records *drive-health* metrics locally; it does not decide analytics product strategy. |

## Drift detection — import-edge check + doc-governance

Two layers, with an explicit division of labour:

1. **Import-edge lint** — the `no-restricted-imports` block scoped to
   `src/cli/python/workspace_*.ts` in `eslint.config.js`, wired into CI via
   `lint-ts`. Fails if any workspace module imports an owner-module of a
   not-owned domain. This is the cheap, precise lock — it catches the most
   common concrete drift (a workspace module reaching into video / MCP /
   skill-design internals).

   > **Mechanism changed 2026-08-05 (AI council).** This was the bespoke gate
   > `lint_workspace_boundary`. ADR-200 migrated this contract's corpus from
   > `.py` to `.ts`; the gate's glob never followed, so it matched **0 files**
   > and exited 0 for ~7 weeks — printing `⚠️ no files match …` even under
   > `--quiet` — and the boundary was documented but unenforced. Repointing the
   > glob was rejected: the gate's Python-shaped import scanner extracts garbage
   > from TypeScript (measured: `'*'`, `"{ fileURLToPath"`), so a glob swap
   > would have satisfied a scan-scope assertion while enforcing nothing, and
   > rewriting the scanner is a new analyser rather than a port. ESLint already
   > lints this corpus and already carried `no-restricted-imports` for the
   > `src/shared/**` boundary, so the edge moved to the layer built for it.
   > ADR-095's original rejection of TS tooling here ("the surface is Python,
   > not TS; importing JS tooling for it is wrong-stack") was falsified by
   > ADR-200: the surface *is* TS now. The move also fixed a live defect — the
   > bespoke patterns anchored on `[._-]`, which **missed 7 of 10** forbidden
   > tokens when they began a path segment (`../../scripts/mcp_render.js`
   > passed); the ESLint patterns add `/` to the boundary class and catch them.

2. **Doc-governance (review).** The import check enforces **import edges
   only**. It does **not** catch *semantic* drift — a workspace module that
   encodes profile-semantics or analytics-*product-strategy* judgement without
   importing anything forbidden. That stays a **review responsibility** against
   this contract. **A green import check is not proof the boundary holds** — it
   is one supplement to boundary thinking, not a substitute for it.

### Escape hatch

A genuinely justified import may carry an inline pragma:

```python
import some_owner_module  # boundary-exception: <reason>
```

The linter then allows that line. A `boundary-exception` is reviewed like any
boundary change — it is a documented, deliberate exception, not a silent
bypass. Persistent exceptions are a signal to revisit this contract or the
module's placement.

## Day-one state

Survey of all 13 `workspace_*.py` modules (2026-06-14, recorded in ADR-095):
**zero violations**. The only cross-module import is intra-workspace
(`workspace_inbox → workspace_skills`). The import check therefore locks a
boundary that currently holds.

**Re-surveyed on the TS surface, 2026-08-05: still zero violations.** The corpus
did not shrink — the same 13 modules exist as `workspace_*.ts` (the directory is
still named `python/`; renaming it is a wide-blast change and out of scope here).
Their complete import set is 7 Node built-ins, one third-party (`yaml`), and
three intra-workspace siblings. Both directions were proven before the mechanism
was swapped: the real corpus passes, and a probe file importing
`compile_router` / `mcp_render` / `condense` / `lint_persona_governance` /
`build_discovery_manifest` fails with 5 domain-specific errors while its
`./workspace_crypto.js` sibling and `node:fs` import stay clean.

### Escape hatch on the new mechanism

The `# boundary-exception:` pragma is replaced by an
`// eslint-disable-next-line no-restricted-imports` carrying a reason — same
contract as before: a documented, reviewed, deliberate exception, never a silent
bypass.

## See also

- [`ADR-095`](../decisions/ADR-095-workspace-boundary-contract.md) — the decision.
- [`ADR-050`](../decisions/ADR-050-workspace-vs-package-root-boundary.md) — the workspace-vs-package-root trust boundary (this refines it at module level).
- [`daily-workspace.md`](daily-workspace.md) — the daily-workspace surface contract.
