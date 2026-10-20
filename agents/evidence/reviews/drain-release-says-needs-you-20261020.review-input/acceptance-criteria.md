## Acceptance Criteria

- [x] **AC-1** Replaying 10.0.0 → 16.0.0 through the new bump rule yields minor
      for 13.0.0, 14.0.0 and 16.0.0 and major for 12.0.0 and 15.0.0.
- [x] **AC-2** A release-span commit carrying `!` with no `Consumer-Impact:`
      trailer fails the release check; the same commit with a trailer passes.
- [x] **AC-3** The new comparator returns `true` for
      `('16.6.0','16.6.0-next.3')` while the pinned `_is_newer` fixture still
      returns `false`.
- [ ] **AC-4** Over a ≥ 40-case matrix, `classifyUpdate` returns `ask` for
      every input whose `engines.node` is unsatisfied, and `auto` for **no**
      input carrying an unknown, a missing provenance or a project pin.
      Open for the owner (2026-10-18): the AI council split on whether this
      text may be amended to the shipped `action` form — `anthropic` (3) leave
      it with the owner, `openai` (1) amend with ordered wording. Both agree
      the shipped behaviour is right. Record and the proposed wording:
      `agents/evidence/council/release-impact-ac4-wording-20261018.md`.
- [x] **AC-5** `classifyUpdate` performs no filesystem or network access,
      asserted by a test that calls it with a frozen input.
- [x] **AC-6** The banner, `upgrade` and `update` produce byte-identical
      recorded stdout before and after the whole change.
      (Evidence under step 4.3: no file in their import closure changed.)
- [x] **AC-7** Every row of `BREAKING_CHANGES.md`'s table carries a
      `Consumer impact` value from the enum.
- [ ] **AC-8** `task ci` green.
      (Closes with the PR that closes this file: the remote pipeline is the
      authoritative run, and a green it has not yet reported is not evidence.)
