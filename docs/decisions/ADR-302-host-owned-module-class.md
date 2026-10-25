---
adr: 302
status: accepted
date: 2026-10-25
decision: host-owned-module-class
amends: ADR-124 (§ 1 only — adds Class H)
supersedes: —
superseded_by: —
phase: road-to-a-mod-that-decides-nothing-new · step 2.1
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  decision_makers: [agent]
  human_directed: false
evidence:
  strength: E1
  basis:
    - agents/evidence/analysis/claude-code-mod-harness-probes-2026-10-25.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
    - docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md
    - docs/decisions/ADR-285-one-dispatcher-stage-is-the-only-rewriter.md
review_trigger: >-
  Reopen if a module shipped under this class hooks an event other than a
  read-and-show event, declares a host call outside the read and UI set, or
  becomes the only place a value AC shows can be read; or if a host other than
  Claude Code gains an in-process module surface, which would make the
  single-host wording of the class conditions too narrow.
---

# ADR-302 — A host-owned module is its own class, and it decides nothing

## Status

Accepted 2026-10-25. Amends ADR-124 § 1 by adding one row. Reversible: removing
the row and the one module that uses it restores the previous state.

## Context

Claude Code 2.1.310 loads hooks modules ("mods") from plugins. A module runs in
the host's own worker for the length of a session, keeps state in memory across
events and in the host's stores, and is started and stopped by the host.

ADR-124 sorts engines into three classes. **A** is an AC process that ends with
its command. **B** is a resident AC process — prohibited in core by ADR-124 and
since reversed by ADR-249 into "permitted under supervision". **C** is a build
path that needs network or a model. A module is none of them: AC starts no
process at all, yet the code is AC's and outlives one event. Without a row, a
reviewer either forces it into B (and asks for supervision a host-owned module
cannot have) or reads its absence as permission for anything.

What a module can do is the risk. It can deny or allow tool calls, rewrite
prompts, spawn processes and call models. AC is a multi-host suite whose
decisions are made in the dispatcher (ADR-285: one stage is the only rewriter),
so a module that decides would be a second decision point that exists on one host
only.

## Decision

Add **Class H — host-owned module** to ADR-124 § 1. A module is admitted under
this class only when all five conditions hold:

| # | Condition |
|---|---|
| I1 | It decides nothing the dispatcher did not already decide; every value it shows exists first as dispatcher output in a state file with a `schema_version`. |
| I2 | It rewrites no tool input, prompt, prompt section or session row, and adds no context (ADR-285; prompt-cache prefix stability). |
| I3 | It declares only `$.fs.read`, `$.fs.exists` and `$.ui.*` host calls — no `$.process`, `$.http`, `$.model`, `$.fs.write` or `engine.create`. |
| I4 | It only reads, so a hook that throws is skipped by the host and nothing is let through; a guarding hook is not admissible under this class. |
| I5 | Every value it shows is also reachable as text on hosts without modules (`doctor neighbours` prints the context fill). The module is a display surface, never a source of truth. |

A module that needs to guard (hold a verdict) is outside Class H and needs its own
record; this ADR admits readers only.

## Consequences

- One module ships under this class (`src/templates/claude-mod/`), opt-in, with
  I3 pinned by a test that reads its source and runs without the Claude CLI.
- `doctor neighbours` reports other installed modules with a capability class
  (verdict-capable, prompt-capable, side-effects, display-only) read from their
  source, because a foreign module is not bound by this class.
- A future holder or sensor that changes or records verdicts is a new decision,
  not an extension of this one.

## Alternatives

- **Treat a module as Class B under ADR-249.** Rejected: ADR-249's supervision
  conditions govern a process AC starts and stops; the host owns a module's
  lifecycle, so the conditions cannot be met or checked.
- **No class; review each module ad hoc.** Rejected: the first reviewer would have
  no criterion, and the multi-host invariant would depend on memory.
- **Supersede ADR-124.** Rejected: its core — AC starts no unsupervised resident
  process — is unchanged.

## Evidence

- Harness reproduction on Claude Code 2.1.310: a read-only module declares exactly
  `$.fs.exists`, `$.fs.read`, `$.ui.status`, and a display hook that throws is
  skipped (`agents/evidence/analysis/claude-code-mod-harness-probes-2026-10-25.md`).
- ADR-124 § 1 lists A, B, C only; ADR-249 reverses B for supervised processes only.
- ADR-285 makes one dispatcher stage the only rewriter.
