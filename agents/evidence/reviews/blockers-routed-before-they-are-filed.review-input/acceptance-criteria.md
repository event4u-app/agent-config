## Acceptance Criteria

- [x] AC-1 — A host-wrapped agent message leaves the language pin unchanged,
      proven by a test that is red without the fix.
- [x] AC-2 — No new open human-owned blocker can land without `Routed:`; the
      existing ones are counted, not exempted silently.
- [x] AC-3 — The two blockers whose condition the tree satisfies read
      `resolved`, and `first-corpora-named` stays open with the reason.
