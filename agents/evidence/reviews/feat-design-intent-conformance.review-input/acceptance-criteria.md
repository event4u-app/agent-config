## Acceptance Criteria

- [x] AC-1 — A read command naming a not-yet-existing inbox directory is not
      refused, a creating command naming the same directory still is, and both
      are pinned by assertions that go red when the mechanism is removed.
- [x] AC-2 — `tailwind-engineer` names the artifact-bound branch explicitly,
      gates the reconciliation on `design.fidelity_mode`, and carries a named
      output field the reported distance lands in. Scoped to that skill on
      purpose: the corpus-wide version of this claim ("no shipped skill
      instructs …") is not checkable from a diff that changes one skill, and a
      neutral review flagged the earlier wording as unbacked. The sweep across
      the other design-adjacent skills is Phase 3's, via the same branch.
- [ ] AC-3 — `brand-source-of-truth` and `design-fidelity` each carry the
      split between them, in both directions, on a projected surface, without
      the per-spawn payload ratchet moving.
- [ ] AC-4 — `docs/guidelines/design-fidelity-mechanics.md` resolves inside
      `dist/agent-src/` and a gate fails when a projected rule routes to a
      target that does not.
- [ ] AC-5 — `design.fidelity_mode` set on the user-global layer resolves, and
      a non-whitelisted key there reports the drop rather than reading as unset.
- [ ] AC-6 — The artifact's maturity and the reconciliation outcome are fields
      with provenance, not prose, and a preserved value still carries its
      distance to the nearest project token.
- [ ] AC-7 — A corrupted port reds exactly the dimension that was corrupted,
      the record carries no self-reported verdict, and the flip criterion was
      written before the shadow window opened.
