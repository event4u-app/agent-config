<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-20, committed verbatim below this header. -->

# Reopen D8 of road-to-tool-results-that-leave-a-handle: build the result store now, or keep waiting?

## The recorded decision (D8, council 2026-10-14, 2/2)

"Phase 2's store is not built ahead of its caller; every step stays open until its dependency lands.
Rejected: a standalone store module flipping 2.3/2.4 (a callerless store cannot show the integrated
behaviour 2.1-2.4 describe, and it fixes handle, range and expiry contracts before the stage exists);
spooling from the byte-recorder hook today (a writer outside the single stage, storing unselected classes)."
Revisit if: "either dependency lands, or the placeholders 1.1 ADR freezes the stage interface before the
stage is built".

## What changed since (tree facts, main@220f8af88, 2026-10-20)

- ADR-285 is accepted: one dispatcher stage is the only rewriter. The stage exists:
  `src/scripts/hooks/egress_stage.ts` (405 lines), called from `dispatch_hook.ts`, modes off / observe /
  protect / strict, shipped default off. `observe` counts and never changes a view; the placeholder view
  exists from `protect` up. Placeholders steps 1.1, 1.2, 1.4 are done; 1.3 ("one release of readings")
  and 3.1 (emit the host's tool-output replacement) are open, so the stage delivers nothing shorter yet.
- The sibling roadmap already built a session-table module the stage "does not call yet".
- The selection of WHICH result classes enter scope is pre-registered and cannot be read before
  2026-10-29 (step 1.3, row D14). Text Read is the expected pass; no class selected closes the roadmap.

## Phase 2 as written

2.1 in the stage, from protect up, a result of a selected class is written to
`agents/runtime/spool/<sha256>` (hash over the bytes the model receives) before anything is shortened;
observe writes no body and counts what it would store; idempotent on the hash.
2.2 the spool receives the placeholder view only; when stored bytes would differ from delivered bytes,
nothing is stored and the result is delivered unreduced; with the stage off, a credential-class match is
never stored. 2.3 retention 7 days / 500 MB (D2), cleanup at session_start, oldest first past the cap;
an expired handle answers "expired". 2.4 one existing read path returns stored bytes by hash, whole or
by range, never re-reading the file; missing, expired and corrupted (digest mismatch) each answer
their own state.

Open contracts listed before 2.1 is built: (i) is a range in lines or bytes; (ii) which detector
confidence refuses storage in 2.2; (iii) how an expired handle is told from an unknown one without
keeping sensitive metadata past retention; (iv) concurrent write, read and cleanup.

## The question

Choose one, with reasons:

(A) Build Phase 2 now inside the existing stage, with the selected-class set an empty constant that
D14 fills on or after 2026-10-29 — so production stores nothing until a class is selected, and tests
inject a set. Settle (i)-(iv) in the same change.
(B) Keep waiting for D14 (2026-10-29), then build Phase 2 for the selected classes only.
(C) Keep waiting for placeholders 1.3's readings as well.

If (A): give your answer to each of (i)-(iv). If (B) or (C): say what concrete risk building now
carries that waiting removes. Name anything in the facts above that you think is misread.
