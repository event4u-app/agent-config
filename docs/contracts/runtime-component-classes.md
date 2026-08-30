# Runtime component classes — every runtime component, labelled against ADR-124

`road-to-experience-loop-broadening` step 0.1. Every runtime component in this
package carries an explicit ADR-124 class label, in one place, so a reader does
not have to re-derive it from a docstring.

**No ADR is rewritten by this page.** The taxonomy already exists — ADR-124 § 1,
as scoped by ADR-249 — and the gap was that nothing applied it component by
component. This is the application, not a new taxonomy, and `docs/decisions/`
is untouched by the change that added it.

## The three classes, restated once so a reader does not have to hold two tabs

| Class | ADR-124's definition, compressed | Standing |
|---|---|---|
| **A — Embedded engine** | Deterministic, in-process, invoked per command, no resident process, no listening socket, no network in the build path. **It terminates when the command does**, and in-memory state never spans invocations. State only as gitignored, rebuildable artifacts under `agents/runtime/`. | Adoptable |
| **B — Resident service / daemon** | Anything with a lifecycle beyond one command: servers, watchers, background workers, web consoles. A memory-only long-lived process is Class B whatever its storage story. | Prohibited in core by ADR-124 — **reversed for a SUPERVISED resident process by ADR-249** (2026-08-27), subject to its four governance conditions |
| **C — Network/LLM-dependent build path** | An index / graph / corpus **build** step that requires network or model calls. | Prohibited by default |

Two boundaries that decide most of the table below, and both are easy to get
backwards:

- **Class C is about the BUILD path, not about using a model.** Query-time LLM
  use follows council and budget governance and is not Class C. A component that
  calls a model to answer a question is not building an index from the network.
- **A `--watch` flag is not an escape from Class A.** ADR-124 permits exactly
  one shape — stateless file regeneration where each cycle is a fresh Class-A
  invocation with no shared in-memory state — and calls the mode itself a
  Class-B escalation. Any other persistent process is Class B regardless of
  what the flag is called.

## The inventory

Every row names the file that decides its class, so the label is checkable
rather than asserted.

| Component | Entry point | Class | What decides it |
|---|---|---|---|
| Hook dispatcher | `src/scripts/hooks/dispatch_hook.ts` | **A** | One process per hook event, resolves the concern chain, exits. `main()` returns an exit code; nothing survives it. |
| Hook concerns (47) | `src/scripts/hooks/*.ts` | **A** | Each runs inside the dispatcher's process and returns a verdict. No concern opens a socket or a timer. |
| Work engine | `src/agent-src/templates/scripts/work_engine/` | **A** | Command-scoped dispatcher; state is the run's own files under `agents/runtime/`. |
| Code-graph engine | `src/scripts/code_graph/` (`agent-config code-graph`) | **A** | `build\|detect\|query\|affected\|path\|explain\|validate` — each a per-invocation command over a rebuildable index. The index is a gitignored artifact, which is what Class A permits rather than what Class C forbids: it is built from the tree, never from the network. |
| Gates and linters (`check_*`, `lint_*`, `audit_*`) | `src/scripts/` | **A** | Read the tree, print, exit. The largest population and the least interesting row. |
| `ui:audit` | `src/cli/commands/uiAudit.ts` | **A** | Inventories a UI tree into `agents/runtime/state/ui-audit.json` and exits. |
| `ui:render` | `src/cli/commands/uiRender.ts` | **A** | Headless capture; the CLI registry's own synopsis says *"no process survives"*, and that is the class test verbatim. |
| Council CLI | `src/scripts/council_cli.ts` | **A**, with a query-time network call | Per-invocation. It calls providers at QUERY time, which is governed by the council budget rules — not a Class-C build path. It builds no index. |
| **UI / settings server** | `src/cli/commands/uiServe.ts` → `src/server/app.ts` | **B** | Listens on `127.0.0.1`. Started by an explicit human action (`agent-config config`, `settings`, `install`, `setup`), bounded to that session. |
| **MCP server** | `src/scripts/mcp_server/server.ts` | **B** | A stdio server with a lifecycle beyond one command; ADR-124's own Class-B text names "MCP *servers* run as memory/retrieval backends" explicitly. |
| **A supervised telemetry collector** | not in this tree yet — `road-to-supervised-telemetry-collector` builds it | **B**, permitted under ADR-249 | Listed because ADR-249 exists FOR this row and a table that omitted it would read as if the reversal had no subject. It is the only planned component that runs unattended, and it is therefore the only one that needs ADR-249's four conditions rather than "a human started it". |

### The Class-B rows are three, and each is permitted for a different reason

Stating this per row rather than once, because "Class B is allowed now" is the
misreading ADR-249's `supersedes_scope` was written to prevent:

- **UI server** — human-started, session-bounded, loopback only. It is the
  console shape ADR-124 names, and it is present because a browser wizard has
  no other form. It does not run unattended.
- **MCP server** — started by the host tool that speaks the protocol, for the
  duration of that session. Same shape, different caller.
- **The supervised collector** — the only row that would run unattended, and
  therefore the only one that needs ADR-249's four governance conditions rather
  than "a human started it". It does not exist in this tree yet; the row is here
  because leaving it out would make the table look like ADR-249 reversed a
  prohibition for nothing.

### What is NOT in this table, and why that is not an omission

- **Skills, rules, commands and personas.** Content, not runtime components.
  They are projected text; nothing about them has a process lifecycle.
- **The skill runtime registry** (`src/scripts/runtime_registry.ts`). It
  describes how a SKILL declares execution (`manual` / `assisted` /
  `automated`, and a handler), which is a different axis from ADR-124's process
  lifecycle. A skill with `handler: shell` still runs inside a Class-A
  invocation. Naming the overlap because the two registries sound alike and a
  reader who conflates them will look for class labels in the wrong file.
- **Third-party processes** the suite spawns (`git`, `gh`, `node`, a host's own
  tooling). ADR-123 and `docs/spawn-site-policy.md` govern those; they are not
  components of this package.

## The two boundaries, in writing

`road-to-experience-loop-broadening` step 0.2. Both are boundaries a plan can
cross by accident, so they are written down rather than held as an intention.

### 1. ADR-094 Layer 2 is GATED, not forbidden — and the gate is the thing to cite

ADR-094 removed Layer 2 (the `@event4u/agent-memory` companion package) and
kept Layer 1 (file-first `agents/memory/` plus intake JSONL). Its alternatives
section records *"Revive Layer 2 later. Gated: requires ≥2 funded consumer
projects …"*.

The gate is unmet, so the practical answer today is the same as a prohibition.
The wording still matters: a plan that says "forbidden" invites a
re-litigation that a plan saying *"gated, gate unmet, here is the gate"* does
not. **Nothing in this package's runtime may depend on Layer 2**, and the way
to change that is to meet ADR-094's gate, not to argue the boundary.

### 2. Runtime consumption of experience is an OPEN owner decision

May selection or routing read experience data at runtime? Reading it at runtime
means deleting it changes *what* the system does — which is what ADR-124's
state-store test classifies as Class C. So the question is not a preference; it
is a class boundary.

It is carried as a gate and assumed in **neither** direction. Until an owner
answers it, experience is a REPORT: a human or CI reads it, and nothing in
selection or routing does.

**Audited on the roadmap that owns this boundary**, because a boundary nobody
checked is a sentence: of its 37 numbered steps, exactly two mention runtime
consumption at all. One (`6.3`) FORBIDS it in those words — *"Report only. No
runtime consumption … nothing in selection or routing does"* — and the other
(`9.6`) is the deferred owner decision itself. No step reads experience data at
selection or routing time, which is that step's verify clause, checked rather
than asserted.

## Two hazards this page exists to keep out of a citation

**The parents' letters are swapped, and a cross-citation inverts the meaning.**
Two same-lineage source proposals both use an `A/B/C/D` runtime-class taxonomy
with **B and C exchanged**: one has B = resident runtime and C = derived
persistence, the other the reverse. Neither matches ADR-124, where **C is the
prohibited build-path class**. So a letter carried across from either document
silently swaps "the thing to build" for "the thing that is banned". Every letter
on this page is ADR-124's, and a future citation into those documents must
restate what the letter means rather than carry it.

**ADR-124's Class-B prohibition is reversed in a NAMED SCOPE, not in general.**
ADR-249's `supersedes_scope` names ADR-124 `:111` and ADR-109 `:28` and nothing
wider. A resident process is permitted when it is *supervised* under the four
conditions; an unsupervised background process is not permitted by that record
and was never requested.

## What this page does not claim

It is a labelling of what exists on the day it was written, checkable against
the entry points in the third column. It is not a gate: nothing refuses a new
runtime component that arrives without a row here, and adding one is a
documentation obligation carried by review rather than by a script. Saying so
is cheaper than implying an enforcement that does not exist.

*Revisit-if:* a new component with a process lifecycle lands; ADR-249's scope
changes; or ADR-124's class boundaries are amended.

## See also

- `docs/decisions/ADR-124-embedded-engine-doctrine.md` — the taxonomy.
- `docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md` — the scoped Class-B reversal.
- `docs/contracts/resident-process-floors.md` — the observation-only contract and the five questions every resident process answers.
