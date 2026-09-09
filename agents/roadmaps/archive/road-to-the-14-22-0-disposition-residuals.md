---
complexity: lightweight
status: ready
relates:
  - slug: road-to-a-graph-that-is-shipped
    relation: extends
    note: >
      Shared surface, verified rather than assumed: that roadmap names
      `packed-binary-manifest` / `src/vendor/grammars` three times
      (`grep -c` on its text) and is what introduced the vendored WASM and its
      eleven manifest-internal admission conditions. Steps 1.1 and 1.2 extend
      exactly that surface with the verification it did not add — an anchor
      outside the manifest, and the threat boundary written down.
  - slug: road-to-skill-menu-economy
    relation: disjoint
    note: >
      Shares the SUBJECT of step 1.3 and not its surface. That roadmap changes
      what the preloaded catalog costs; 1.3 corrects the ledger text ADR-263
      superseded and is gated only on re-emitting the census via
      `report_skill_activation`, which that roadmap neither performs nor
      blocks — `grep -c 'skill-activation-census\|report_skill_activation'`
      over its text returns 0. So no ordering edge exists in either direction.
estate_offset_exempt: "Offsets nothing, because it is the receiver the 14.22.0 disposition pass owed and there was nothing to disarchive against it. Three residuals survived verification of the eleven blocking findings in `agents/evidence/release-findings/14.22.0.json`; each is REAL and none was fixable inside a governance-ledger commit, so the alternative to this file was a deferral with no receiver — the shape `active-remediation` names as not a disposition at all. MEASURED on this branch rather than predicted: `check_estate_count` read `active_roadmaps 7 (floor 7 at origin/main, +0)` before the file and is expected to read `+1 active / -0 disposed` after it, which is what this line authorises under path 1 of the gate's own three (`check_estate_count.ts:59-62`). Nothing was archived to pay for it and no unrelated roadmap was parked to buy room — laundering an unrelated disposal to fund a receiver is the move the ratchet exists to catch, and doing it in the ratchet's name would be worse than the growth. Deliberately NOT folded into another file: `grep -rl 'release-findings' agents/roadmaps/*.md` returns nothing on this branch, so no active roadmap owns this surface."
execution:
  mode: phase-checkpoints
---
# Road to the 14.22.0 disposition residuals

> **Source:** verification of the eleven blocking findings of the
> `release/14.22.0` self-review (run 34214806821, artifact
> `self-review-findings`, 56 findings) while writing
> `agents/evidence/release-findings/14.22.0.json`. Nine of the eleven were
> dispositioned `false_positive` and one `fixed`; the three items below are the
> halves that survived, recorded here because a `false_positive` verdict on a
> finding's stated mechanism does not dispose of a real gap found next to it.

## Goal

Each of the three residuals is either closed or carries a recorded decision
naming why it stays open — so a later reader of the 14.22.0 ledger can follow
every "REAL" half of a SPLIT verdict to something that owns it, rather than to
a rationale paragraph that named it and stopped.

## Phase 1 — The residuals

- [x] **1.1 Verify the vendored grammar bytes against their upstream anchor.**
      `src/config/packed-binary-manifest.json:5-31` records `sha256`, `size`,
      `kind`, `grammar_id` and `abi` per grammar, and `evaluateEntry`
      (`src/scripts/_lib/packed_binary_predicate.ts:165-217`) checks eleven
      conditions against it — but every one of them is manifest-internal, so a
      same-commit edit of the manifest and the bytes passes all eleven. The
      independent anchor already exists and is read by nothing:
      `package-lock.json:7288` holds `tree-sitter-wasms@0.1.13`'s upstream
      `integrity: sha512-…`. Close the loop there rather than by inventing a
      signing story — `grep -rniE 'cosign|sigstore|minisign|slsa'` returns no
      signing tooling in this tree, so "sign the manifest" has no
      infrastructure and would anchor to the wrong thing.
      verify: a gate or test that fails when a vendored `.wasm` diverges from
      the bytes the locked `tree-sitter-wasms` version resolves to, with the
      failure demonstrated on a deliberately mutated copy — a check never seen
      red has unknown sensitivity.
      Done 2026-09-09. `src/scripts/_lib/vendored_grammar_upstream.ts` reads the
      locked pin out of `package-lock.json` (`node_modules/tree-sitter-wasms`,
      version + `integrity`), asserts the INSTALLED version equals the locked
      one, and byte-compares every grammar the manifest admits against
      `node_modules/tree-sitter-wasms/out/`. Exercised by
      `tests/scripts/vendored_grammar_upstream.test.ts` — 16 cases, all green.
      (13 at the first commit; three added by the R2 completion review below,
      which found the vendored side resolving by BASENAME rather than by the
      entry's own path. Two rows sharing a filename in different directories
      would have anchored to the same file — one admitted binary silently
      unanchored while the verdict reported full coverage, the false green this
      module exists to remove. Fixed with a refusal for the ambiguous case and a
      sabotage-proven test for the resolution.)
      **Refusal, never a pass, is the load-bearing half** and it is what Risk 1
      asks for: an absent upstream, an installed version that is not the locked
      one, a lock row with no `integrity`, a missing counterpart, a missing
      vendored file and an EMPTY claim set are each a thrown
      `UpstreamAnchorRefusal` with its own test, so the check cannot go green
      over nothing.
      **Sensitivity proven on the REAL tree, not only on fixtures.** One byte of
      `src/vendor/grammars/tree-sitter-php.wasm` at offset 812000 was flipped in
      place; the real-tree case went red
      (`× the real tree > anchors every vendored grammar to the locked upstream,
      byte for byte`, `1 failed | 12 passed`), and the file was restored from a
      pre-mutation copy and re-hashed to
      `55bb617b6f01e14bab997861f0b20a2420cf6ba3199ffeb295b9ec398966d8a3`, its
      committed value. A fixture case mutating a copy of the same real grammar
      is kept in the suite so the sensitivity re-runs in CI.
      **Test, not gate — the council split and the split was resolved by
      measurement.** AI council 2026-09-09, 2 seats: unanimous that the
      node_modules comparison is a real anchor; SPLIT on the shape, one seat for
      a vitest test with cross-references, one for a registered gate on
      discoverability grounds. Resolved to the test on two measured facts rather
      than on a majority. First, the discoverability objection is answered by an
      edit step 1.2 already owed: the predicate's docblock — the place a reader
      auditing these bytes actually arrives — now names the module and the test
      by path, and the manifest `_comment` and `src/vendor/grammars/README.md`
      carry the same pointer. Second, the precedent exists: the ABI smoke test in
      `tests/scripts/code_graph.test.ts` already depends on this same
      devDependency, so a test-shaped check over `tree-sitter-wasms` is this
      repository's existing pattern, not a new one. Against that, a gate costs
      six registration surfaces and trips three ratchets
      (`check_ci_local_parity`, `check_gate_coverage` hardening, the `allowEmpty`
      prefix contract) for a corpus of exactly three static files.
      **What the module may NOT claim, in the council's own words, written into
      its docblock:** it is not independent of all repository state, and it does
      not verify the grammars cryptographically against the registry independent
      of local build state. The chain is registry tarball → `npm ci` checks its
      sha512 against the lock's `integrity` → extracted bytes → vendored bytes,
      and only the last link is checked here.

- [x] **1.2 Write the threat boundary into the predicate's docblock.**
      `packed_binary_predicate.ts:1-64` lists all eleven conditions and is
      unusually explicit that it relaxes a control, yet names no attacker, no
      trust anchor, and nowhere states that a same-commit manifest-plus-bytes
      edit is out of scope because the diff is reviewed. A reader therefore
      cannot tell the boundary from an oversight, which is what made finding
      `d1696732ac28` reach for a signature the repository cannot provide.
      verify: the docblock states the boundary and what closes it (1.1), and
      `grep -c 'same-commit' src/scripts/_lib/packed_binary_predicate.ts`
      returns non-zero.
      Done 2026-09-09. The docblock gained a § THE THREAT BOUNDARY block in four
      named parts: what the eleven conditions DO refuse (a byte drifting from
      the row — corruption, a truncated checkout, a refresh that forgot the row,
      an ABI move, a second row widening a path); what they deliberately do NOT
      (the same-commit manifest-plus-bytes edit, held by review because the
      manifest is a small JSON file whose diff a human reads); what closes it
      (`_lib/vendored_grammar_upstream.ts` and its test, both by path, with the
      sentence that module may not claim); and what stays open and owned by
      review (a `package-lock.json` row pointing at a hostile package, which no
      check in this tree defends). Verify output: `grep -c 'same-commit'` returns
      `1`.
      The finding this answers is named in the block itself, so a later reader
      meets the reason rather than re-deriving it: `d1696732ac28` reached for a
      signature this repository cannot provide precisely because nothing said
      where the line was.

- [x] **1.3 Land the CLAIMS.md correction ADR-263 deferred.**
      ADR-263 § Consequences says the published reading of
      `skill-activation-census-zero` "is now wrong and is superseded by this
      record" and that correcting the ledger text "is tracked as work rather
      than performed here" — but no slug tracks it, which is the gap this step
      closes. Two edits are owed at `docs/CLAIMS.md:244-250`: the arithmetic
      (`189` where ADR-263 fixes it at `187`) and the text still saying both
      alternatives "stay OPEN rather than closed" after Option B was locked.
      The arithmetic half is mechanically blocked first:
      `agents/evidence/metrics/skill-activation-census.json` holds
      `human_named_only: 189`, and `report_skill_activation.ts:352-379`
      requires the claim to match the census, so writing `187` reds
      `check_skill_activation_claim` until the census is re-emitted. Re-emit,
      then correct.
      verify: `./scripts-run src/scripts/check_skill_activation_claim` exits 0
      with the corrected figure in `docs/CLAIMS.md`, and ADR-263's § References
      pointer no longer describes a claim the tree contradicts.

      **THE STEP ABOVE IS WRONG ON THE ARITHMETIC HALF AND IS LEFT AS WRITTEN.**
      Done 2026-09-09, and only the prose half was landed. The original text is
      preserved because an executor who found it edited away could not tell a
      correction from a decision.

      **What was measured before anything was written.** `populations()` in
      `src/scripts/report_skill_activation.ts:226-237` computes the remainder as
      `census.total - eitherOne.size`, where `eitherOne` is the SET UNION of the
      trigger-key skills and the corpus skills. Union = 12 + 100 − 2 = 110;
      remainder = 299 − 110 = **189**. The report prints its own reconciliation
      today: `12 + 100 - 2 + 189 = 299 of 299`. ADR-263:113-115 states the union
      correctly at 110 in the same sentence and then subtracts 112, and its
      diagnosis is inverted — 189 IS the inclusion–exclusion result, and 187 is
      what you get by removing the two overlapping skills a second time, from a
      remainder they were never in. So the defect is in ADR-263, not in the
      ledger, and writing `187` into a `status: backed` claim would have put a
      figure there that the tree's own instrument contradicts.

      **The census was deliberately NOT re-emitted, against this step's own
      instruction.** Two reasons, both measured. Re-emitting cannot produce 187:
      the remainder is computed over a set union, so it recomputes 189 unless the
      population moves. And re-emitting from here would have CORRUPTED the
      record: `report_skill_activation` reads the transcript store for the
      current project path, and the only store reachable from the executing
      worktree holds `sessions=2 asst=425 Skill calls=1` against the committed
      `sessions=30 asst=11338 invocations=0`. The published claim's headline word
      is ZERO. The report itself already prints `population split still describes
      this tree`, so the population half needed no re-emit at all.

      **What landed.** (a) `docs/CLAIMS.md`: the sentence saying both
      alternatives "stay OPEN rather than closed" is corrected — ADR-263 locks
      Option B in the "by observation" form and rejects Option A — and the
      earlier "for the 12 the zero is a defect" reading now carries the
      supersession ADR-263 § Consequences names. The figure 189 is untouched.
      (b) `docs/decisions/ADR-263-…md` gained **Amendment 1 (2026-09-09)**
      correcting the 187 bullet, scoped in its first paragraph to one number:
      the Decision, Option A's rejection and Option D's not-taken status are all
      untouched, and `reopen_policy: owner` is unaffected because reopening the
      decision is not what an arithmetic correction does. The wrong bullet is
      kept in place with a pointer to the amendment rather than rewritten.
      verify output: `adr_cite_check ADR-263` reports
      `amendments 1: Amendment 1 (2026-09-09) …` and
      `→ AMENDED — read the amendment before citing the original decision`;
      `check_adr_frontmatter`: no errors;
      `check_skill_activation_claim`: `✅ census claim matches … (measured
      2026-09-06)`.

      **Authority for both deviations.** AI council 2026-09-09, 2 seats
      (anthropic, openai), converging: the defect is in ADR-263 rather than the
      ledger; an arithmetic correction touching no floor and no commitment is
      council-decidable under `decision-revisit-gate` rather than owner-reserved;
      the refusal to re-emit is correct and belongs in this step's own text
      rather than in a separate blocker, so the reasoning chain stays where the
      instruction is.

      **Left for the owner, not silently absorbed.** `report_skill_activation`
      has no guard against being run outside the canonical checkout — from a
      worktree it silently measures a different, smaller store and `--emit`
      would overwrite a published claim with it. That is a real defect this step
      only avoided by hand, and it is recorded as
      `agents/roadmaps/stubs/road-to-a-census-that-refuses-a-partial-store.md`
      rather than fixed here — changing what the census refuses to measure is a
      decision about a published claim's provenance, not a residual of the
      14.22.0 pass. A stub rather than a blocker on this file, deliberately: a
      blocker would hold a finished roadmap open on an item that is not one of
      its three residuals, and the stub carries the measured table and a
      two-branch promotion probe so the finding is not merely mentioned.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | 1.1 is closed by a check that cannot fail | implementation | An upstream-comparison gate is easy to write so that it passes when the upstream package is absent from `node_modules`, which is the normal state in a fresh CI checkout — it would then be green forever while verifying nothing, the exact shape the eleven manifest-internal conditions already have | 1.1's own verify demands the failure be demonstrated on a mutated copy, so the check is seen red before it is trusted; an absent upstream must be an explicit refusal rather than a pass | Phase 1 — The residuals |
| 2 | 1.3 lands the text edit without re-emitting the census | implementation | The prose half of 1.3 is unblocked while the arithmetic half is gated, so an executor can correct "stay OPEN" and leave `189` — producing a claim that is half-superseded and reads as fully corrected | 1.3 names the ordering and the blocking mechanism explicitly, and its verify requires the corrected figure rather than only a green gate, which `189` would also produce | Phase 1 — The residuals |
| 3 | The file is read as re-opening settled findings | product | Nine of the eleven findings were dispositioned `false_positive` on verified evidence; a receiver roadmap next to that ledger invites a later reader to treat the whole set as unresolved and re-run a verification that already happened | The Source block states the split explicitly, and each step names only the surviving half with the file and line the verification landed on, so the closed halves are not reachable from here | Phase 1 — The residuals |

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
