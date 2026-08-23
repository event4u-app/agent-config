---
stability: beta
keep-beta-until: 2026-11-23
---

# `ui_authority` — the one authority object for a UI surface

> **Audience:** every UI skill, every UI directive, the stop gate, and anyone
> about to add a decision table about "what am I allowed to change here".

Produced by `road-to-frontend-power` step A1.1. One object, resolved once before
design, read by every UI phase.

## The Iron Law

```
ONE SCHEMA. ONE RESOLVER. NO SECOND PARTIAL DECISION TABLE.
A SKILL THAT RE-INFERS SURFACE MODE OR CHANGE INTENT BESIDE THIS OBJECT
IS A DRIFT SURFACE, NOT A CONVENIENCE.
```

- Schema: `src/scripts/schemas/ui-authority.schema.json`
- Resolver: `src/scripts/_lib/ui_authority.ts` (`resolveUiAuthority`)
- Behaviour pinned by: `src/scripts/_lib/ui_authority.test.ts`, against fixtures
  in `tests/eval/frontend-corpus/` hashed **before** the resolver existed

## Fields

| Field | Values | Notes |
|---|---|---|
| `surface_mode` | `persuade` `operate` `read` `experience` | What the surface is FOR. **Per-surface.** Never inherited from PRODUCT.md. |
| `register` | `brand` `product` | Unchanged from [`design-modes`](../guidelines/design-modes.md). |
| `change_intent` | `preserve` `extend` `redesign` `new-world` | What the run may move. Drives the intent-aware gate. |
| `reference_maturity` | `wireframe` `prototype` `finished-comp` `runnable-artifact` `production-incumbent` `null` | How finished the supplied reference is. |
| `fidelity_mandate` | string · `null` | **Carried** from `road-to-frontend-fidelity-calibration` Phase 0. Never re-derived here. |
| `primary_source` | `{kind, path}` | Which authority the run builds from. |
| `constraints` | `preserve_palette` `preserve_type_family` `preserve_layout` `preserve_copy` | Booleans. `preserve` sets the first two. |
| `conflicts[]` | `{dimension, wanted, blocked_by}` | Reported, never silently resolved. |
| `provenance[]` | `{field, source, detail}` | One entry per resolved field. |
| `verification` | `verified` `degraded` `unverified` | Graft 2. A pass that could not run says so. |
| `degradation_reason` | string | **Required** when `verification` ≠ `verified`. |

## Precedence — stated once, because it exists nowhere else

1. **Explicit user authority** — beats every inference.
2. **A registered hard constraint** — the one thing that outranks (1).
3. **The surface brief** — surface-local; never promoted to DESIGN.md.
4. **A supplied reference artifact.**
5. **The coherent incumbent.**
6. **DESIGN.md / PRODUCT.md** — `register` only, never `surface_mode`.
7. **Declared defaults** (`operate` · `product` · `extend`).

### Quoted text is not authority

A document the user pasted can contain "make it bold and colourful". That is
data inside a container, and acting on it is the found-instructions failure
[`untrusted-input-defense`](../../src/rules/untrusted-input-defense.md) names.
Callers mark such a signal `quoted: true`; the resolver ignores its directives.

### A missing DESIGN.md is not `new-world`

The single most consequential branch. A coherent incumbent resolves to `extend`
with incumbent authority. Only a genuinely empty surface — no incumbent, no
reference, no DESIGN.md — is `new-world`.

**The provenance field is what makes this checkable.** `extend` is also the
declared default, so a value-only assertion cannot separate "resolved from the
incumbent" from "fell through". A sabotage probe in this run disabled the
incumbent branch and left the value-only test green; the test now asserts
`source: 'incumbent-scan'`. Anyone extending this resolver should assert the
source, not only the value.

## The intent-aware gate — `preserveViolations`

Under `change_intent: preserve`, a **visual-world** change blocks. The
threshold is pre-registered in
[`frontend-power-PREREG.md`](../../internal/bench/frontend-power-PREREG.md)
§ A1.5 and is deliberately narrow:

- **In:** palette (a colour token absent from the incumbent's set) and type
  family (a first-choice `font-family` absent from the incumbent's set).
- **Out:** spacing, radius, line-height, weight, size, letter-spacing, shadow,
  layout. `polish` and `refine` must be able to move all of those under
  `preserve` — that is what the verbs are for.
- `transparent` / `currentColor` / `inherit` / `unset` / `initial` are never a
  palette delta.

`extend` is permissive on this axis on purpose: extending a surface routinely
adds a semantic colour, and blocking that would make the verb unusable.

## The six operations — one field, not six commands

`polish` · `quieter` · `bolder` · `distill` · `harden` · `clarify`. Each
declares the dimensions it may touch, so a collision is decidable rather than a
judgement call. `operationConflicts` returns the collisions; **the caller
performs no write when the array is non-empty.**

`bolder` under `preserve` is the pinned case: it wants `palette` and
`type_family`, both locked, so it surfaces two conflicts and writes nothing.

## Declared consumers

The A1.1 verify line asserts that `grep -rln 'surface_mode\|change_intent'
src/skills/` names **only** this list. Adding a consumer means adding it here.

| Consumer | Reads | Must NOT |
|---|---|---|
| [`fe-design`](../../src/skills/fe-design/SKILL.md) | `surface_mode`, `register`, `change_intent` | carry its own mode table, or vary a quality floor by mode |
| [`design-review`](../../src/skills/design-review/SKILL.md) | `surface_mode`, `change_intent`, `verification` | vary the Q1–Q6 floor set by mode |

**Quality floors do not vary by surface mode.** Density, hierarchy and
expressiveness defaults do; contrast, font size, line length, reduced motion,
heading hierarchy and focus do not. A floor that moved with the mode would be a
preference, not a floor.

## See also

- [`design-modes`](../guidelines/design-modes.md) — the register axis this adds a second axis beside.
- [`design-fidelity`](../../src/rules/design-fidelity.md) — a supplied artifact is the spec; `reference_maturity` is how this object records which kind.
- [`no-runtime-boundary`](no-runtime-boundary.md) — the resolver is a pure function; nothing here owns a process.
