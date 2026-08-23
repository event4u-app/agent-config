---
task: "{one line — what this procedure accomplishes}"
scope: "{a workspace path, e.g. packages/ui — or the literal `repo`}"
grade: "{configured | observed}"
invokes:
  - "{script / turbo task / turbo generator id}"
---

# Playbook: {task}

> **A `Playbook` context** (ADR-244) — the sixth type, beside Module, Domain, Service,
> Integration and Infrastructure. It lives in the playbook home and reuses the
> `contexts.md` machinery; it is not a new artefact class.

> **This is THIS repository's answer, and it outranks a shipped skill.** A shipped skill
> is a generic answer to a generic question. A playbook encodes decisions this repository
> already made — file layout, barrel exports, test co-location, naming — that no generic
> skill can know. When both match, the playbook goes first.

## The grade, and what it is claiming

| grade | means | obligation |
|---|---|---|
| `configured` | every step invokes something **present in the tree and seen** | **no step may lack an `invokes` entry** |
| `observed` | the procedure was inferred from a worked example | every step **cites the commit** it was seen in |

Do not write `configured` for a generator you did not observe. That is the Class-A rule of
`standards-from-config` applied to procedure, and the grade is the only field that tells a
reader whether to trust the steps or check them.

## Steps

Numbered, in the `command-writing` shape. **Every step carries both lines** — a step
without them is a suggestion wearing a procedure's formatting.

### 1. {what this step does}

- **Source of truth:** `{the script / generator / task it invokes}` — or, for an
  `observed` playbook, `{commit sha}` where it was seen.
- **Verify:** `{a command whose output settles whether the step worked}`

{Any detail the invocation does not carry: a prompt answer to give, a flag that matters,
a thing that goes wrong if skipped.}

### 2. {…}

- **Source of truth:** `{…}`
- **Verify:** `{…}`

## What this playbook does NOT cover

{State the boundary. A playbook that silently stops short is worse than one that names
where it ends, because the reader cannot tell completion from omission.}

## Staleness

Every `invokes` id is resolved by a deterministic check. When an id no longer exists the
check **fails naming the id**, and the grade **downgrades** — so a renamed generator
surfaces as a failure rather than as a playbook quietly instructing the wrong command.

First release resolves ids against `package.json#scripts`, `turbo.json` tasks and
`turbo gen` templates only. Nx generators and Plop are deliberately out of scope (ADR-244
§ What the first release resolves): their discovery needs a consumer binary, and a gate
that needs the consumer's toolchain installed is a gate that does not run.
