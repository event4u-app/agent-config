<!-- evidence-type: analysis -->

# Closure over today's set is not closure over Phase 7's

AI council, 2026-10-24, the fourteenth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, design mode, 2 rounds with peer review, CLI transport,
`$0.00`. **DEGRADED 1/2.** The pre-run probe already recorded the anthropic
seat as `other` after two empty answers in round 13, so the seat was skipped.
This is one single-seat reading, not convergence. The prompt is committed
verbatim beside this file as `gate-classification-ledger-r9-20261024.question.md`
(13 KB, shortened after the 22 KB prompts).

## openai's reading: no, three concrete gaps, none owner-reserved

- Q1 *no, not fully* (0.90): two of the four `unsure` mapping verdicts were
  kept on their rows "noted here", which *"turns uncertainty into approval
  without evidence"*. The reconciler should reject every unresolved verdict,
  not only an unadopted disagreement.
- Q2 *no* (0.94). The single missing thing is **a pinned, authoritative Phase 7
  start manifest** reconciled to the binding aspects. The reconciler proved
  equality among three *present* artefacts, and that cannot show a deleted,
  renamed or merged Phase 7 check is still represented. *"Not inherently"*
  owner-reserved.
- The reconciler is the asking agent's own gate. openai wants mutation tests
  showing it refuses each of these:
  - omitted historical checks;
  - unresolved verdicts;
  - category laundering;
  - altered applicability;
  - stale pins;
  - withdrawn-row mishandling.

  It also wants suspend, rollback and re-attestation rules for 7.2, and an
  owner for pin renewal.

## Applied in revision 10

1. **Phase 7 start manifest, checked against git.**
   - The population was measured at `bbe5b73be` and recorded in `7a7a55b2`.
     The reconciler checks that the record equals the version that landed.
   - All 16 checks existed at the measured commit and still exist under the
     same path.
   - `R1.c`'s history is stated: binding in revisions 3–8, withdrawn in 9.
2. **Every review verdict binds.**
   - An *agree* mapping may not change.
   - A *disagree* must be adopted.
   - An *unsure* needs a recorded decision with a reason. All four have one in
     the mapping file. `R5.b` and `R13.a` keep their branches because one
     implemented code path reports one finding for both read and parse
     failure, so there is one implemented assertion. The I/O-versus-content
     conflation is a defect carried to 7.2.
3. **The ledger table is pinned by digest**, so a row edited after review is
   stale.
4. **`--self-test`** applies eleven mutations to the real inputs, and each must
   be refused for its named reason. **11/11 behaved.** The cases:
   - a dropped Phase 7 check;
   - an altered record;
   - a lost resolution;
   - laundering a reviewed row branch into a category;
   - a reverted disagreement;
   - a stale source pin;
   - a stale helper;
   - edited applicability;
   - a branch mapped to the withdrawn row;
   - an unknown flag;
   - a clean baseline.
5. **7.2's suspend, rollback and re-attestation rules** are written into step
   7.2. See the roadmap.

Still not done: an independently implemented verifier. The reconciler and its
self-test share an author. The independence comes from the branch inventory and
the mapping review, both written by separate sessions, and from git as the
historical source.
