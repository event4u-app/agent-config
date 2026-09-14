<!-- evidence-type: analysis -->

# F3a — a conclusive technical verdict

The half of F3 that must produce **no** owner-facing options block. The verdict
resolves the question; handing it to the owner as options would route a
technical decision to a person because it was hard.

- **Question:** should the on-disk record format be newline-delimited JSON or a
  single array?
- **Ownership:** contested-technical
- **Convergence:** 2/2 convergent

## Evidence

- A streaming read holds RSS flat across a 100k-record file; the array form
  needs the whole document parsed before the first record is available.
- Both forms round-trip, so correctness does not separate them.

## Member positions

- Member A — NDJSON. The memory profile is the only axis that differs, and it
  differs by an order of magnitude at the sizes this reader sees.
- Member B — NDJSON. Adds that the array form's only advantage, a single parse
  call, disappears behind the reader abstraction already in the tree.

## Verdict

Newline-delimited JSON. Confidence: high.

## Revisit if

The reader stops streaming, or a consumer appears that needs random access by
index rather than sequential reads.
