## Acceptance Criteria

- [ ] AC-1 — Every phase names an existing carrier it widens, and no phase
      introduces a second store, second loop, or second promotion path.
- [ ] AC-2 — No recorded `success` in the audit stream is backed by an empty
      change *against that task's declared output contract*, and a read-only
      analysis dispatch that satisfies its contract is not marked a failure.
- [ ] AC-3 — The captured event type has no field capable of holding a prompt, a
      file body, or a path, and every event carries a privacy class.
- [ ] AC-4 — The per-asset report distinguishes helpful, neutral, harmful and
      unknown, reports unknown as its own share, and states a basis on every
      derived figure.
- [ ] AC-5 — A failing case is classifiable into one of the five
      activation/adherence states, and `unknown` is used wherever no evidence
      exists rather than a model's inference.
- [x] AC-6 — One outcome vocabulary is authoritative, or the mapping between the
      two is a committed module both readers import.

      **MET 2026-08-29 via the second disjunct, and the first is refused on
      evidence.** `src/scripts/_lib/outcome_vocabularies.ts` is the committed
      module, and both readers import it —
      `orchestration_record.ts` for `PhaseOutcome`, `outcome_envelope.ts` for
      `RunTerminalState`; `runtime_journal.ts` imports its value list too. The
      first disjunct is not taken because the producer trace under step 1.3
      showed three vocabularies with three different subjects, so declaring one
      authoritative would make the other two wrong rather than derived.

      **Stated precisely, because the AC's wording invites an over-claim:** what
      the module holds is the three vocabularies plus a REGISTRY of the crossings
      (`CROSS_DOMAIN_MAPPINGS`, one row). The mapping FUNCTION itself
      (`envelopeOutcome`) stays at its call site in `orchestration_record.ts`,
      where the translation actually happens; the module records that it exists
      and `tests/contracts/outcome_vocabularies.test.ts` asserts the named
      function resolves in the named file. Moving the function would relocate
      logic away from its only caller for no gain. So: both readers import the
      committed module — the AC as written — and the one real translation is
      registered and checked rather than relocated.
- [ ] AC-7 — Nothing in any selection or routing path imports the experience
      report, until and unless the Phase 9 blocker is resolved with a yes.
- [ ] AC-8 — The retention rule is written into the contract, and every claim
      resting on the ledger states whether its floor is reachable at that
      retention.
- [ ] AC-9 — At least one repeated-failure pattern has produced a reviewed card,
      and at least one card has been either promoted through
      `learning-to-rule-or-skill` or expired — so the lifecycle closes in both
      directions rather than only accumulating.
- [ ] AC-10 — At least one removal has landed that the loop itself motivated:
      prose replaced by a deterministic query or helper, with the prose deleted
      in the same change.
