---
complexity: lightweight
status: later
---

# Roadmap: Second-Sweep surfaced proposals (parked)

> **Parked (2026-07-15, later/ disposition).** Two ecosystem-second-sweep
> Phase-2 items were explicitly "surface as a proposal / do not auto-edit"
> and "note only — that roadmap owns the change". They are captured here so
> they are tracked, not lost — neither is auto-applied. **Resume when** the
> maintainer decides to adopt either; each then lands as its own small PR
> against the named target.

## Proposal 1 — compact clarification protocol (→ `ask-when-uncertain` / `improve-before-implement`)

- [ ] Evaluate folding a compact clarification protocol into `ask-when-uncertain`
      / `improve-before-implement`: numbered questions, lettered options, a
      **bolded recommended default**, a `defaults` fast-path, compact `1b 2a 3c`
      replies, and a need-to-know vs nice-to-know split. *Source G
      (ask-questions-if-underspecified).* **Surfaced proposal — not auto-applied**
      (the second-sweep step forbade auto-editing those rules). Note the overlap
      with the existing `user-interaction` numbered-options contract before adopting;
      much of this may already be covered.

## Proposal 2 — memory-writeback quality-gate preflight (→ retrieval-and-memory)

- [ ] Evaluate a memory-writeback quality-gate preflight: reject candidates that
      are work-logs not experience-assets; required fields by outcome type
      (`fix`→root_cause/resolution, `pitfall`→pitfalls, `decision`→decisions,
      `pattern`→reusable_patterns); a recall trigger threshold (fire on
      non-trivial work only). *Source: a recall/writeback skill.* The owning
      roadmap `road-to-opt-retrieval-and-memory` is **archived** — if adopted,
      this lands as a fresh small PR against the memory skills, not a re-open.

## Acceptance criteria

- [ ] Each proposal is either adopted (own PR, named target) or explicitly
      declined with a reason — never silently dropped.
