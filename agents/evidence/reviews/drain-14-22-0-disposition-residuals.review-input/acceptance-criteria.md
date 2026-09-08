## Acceptance Criteria

- [x] AC-1 — The vendored grammars have an independent verification path against
      the locked upstream, proven by a check that has been observed failing on
      mutated bytes. A manifest-internal check does not satisfy this.
      Met 2026-09-09. `src/scripts/_lib/vendored_grammar_upstream.ts` +
      `tests/scripts/vendored_grammar_upstream.test.ts` (16 cases). Observed
      failing twice on mutated bytes: once by hand on the real committed
      `tree-sitter-php.wasm` (one byte flipped, `1 failed | 12 passed`, restored
      and re-hashed to its committed sha256), and once as a permanent suite case
      that mutates a copy of that same real grammar, so the observation re-runs
      rather than living in this sentence. Not manifest-internal by
      construction: the comparison never reads
      `packed-binary-manifest.json`'s hashes, only its path list.
- [x] AC-2 — `packed_binary_predicate.ts`'s docblock states its threat boundary,
      so the absence of a trust anchor is documented rather than inferable.
      Met 2026-09-09. § THE THREAT BOUNDARY names what is refused, what is
      deliberately not (the same-commit pair, held by review), what closes it
      (1.1, by module and test path), and what stays open and owned by review (a
      lock row pointing at a hostile package). `grep -c 'same-commit'` returns 1.
- [x] AC-3 — `docs/CLAIMS.md`'s `skill-activation-census-zero` entry no longer
      contradicts ADR-263, with `check_skill_activation_claim` green on the
      corrected figure rather than on the stale one.
      **AC AMENDED 2026-09-09, and the original is kept above.** As written it
      presumes the ledger's figure is the stale one; measurement showed the
      opposite — 189 is what the generator's inclusion–exclusion computes and
      ADR-263's `187` is the arithmetic error (step 1.3 carries the derivation).
      Read literally the criterion is unsatisfiable, because no correct figure
      other than 189 exists to write. It is satisfied in substance and that is
      what is claimed: the contradiction is gone, resolved on the side that was
      wrong. ADR-263 carries Amendment 1 (2026-09-09) correcting 187 → 189 with
      its Decision untouched; `docs/CLAIMS.md` carries the prose correction
      (Option B locked, Option A rejected, the "12 = defect" reading superseded)
      with the figure unchanged; `check_skill_activation_claim` exits 0 —
      `✅ census claim matches agents/evidence/metrics/skill-activation-census.json
      (measured 2026-09-06)`. Amended under the same AI-council convergence that
      settled 1.3, which is why this is recorded here rather than performed
      silently: rewriting an acceptance criterion to match what was done is the
      failure this note exists to make visible instead.
