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

- [ ] **1.1 Verify the vendored grammar bytes against their upstream anchor.**
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

- [ ] **1.2 Write the threat boundary into the predicate's docblock.**
      `packed_binary_predicate.ts:1-64` lists all eleven conditions and is
      unusually explicit that it relaxes a control, yet names no attacker, no
      trust anchor, and nowhere states that a same-commit manifest-plus-bytes
      edit is out of scope because the diff is reviewed. A reader therefore
      cannot tell the boundary from an oversight, which is what made finding
      `d1696732ac28` reach for a signature the repository cannot provide.
      verify: the docblock states the boundary and what closes it (1.1), and
      `grep -c 'same-commit' src/scripts/_lib/packed_binary_predicate.ts`
      returns non-zero.

- [ ] **1.3 Land the CLAIMS.md correction ADR-263 deferred.**
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | 1.1 is closed by a check that cannot fail | implementation | An upstream-comparison gate is easy to write so that it passes when the upstream package is absent from `node_modules`, which is the normal state in a fresh CI checkout — it would then be green forever while verifying nothing, the exact shape the eleven manifest-internal conditions already have | 1.1's own verify demands the failure be demonstrated on a mutated copy, so the check is seen red before it is trusted; an absent upstream must be an explicit refusal rather than a pass | Phase 1 — The residuals |
| 2 | 1.3 lands the text edit without re-emitting the census | implementation | The prose half of 1.3 is unblocked while the arithmetic half is gated, so an executor can correct "stay OPEN" and leave `189` — producing a claim that is half-superseded and reads as fully corrected | 1.3 names the ordering and the blocking mechanism explicitly, and its verify requires the corrected figure rather than only a green gate, which `189` would also produce | Phase 1 — The residuals |
| 3 | The file is read as re-opening settled findings | product | Nine of the eleven findings were dispositioned `false_positive` on verified evidence; a receiver roadmap next to that ledger invites a later reader to treat the whole set as unresolved and re-run a verification that already happened | The Source block states the split explicitly, and each step names only the surviving half with the file and line the verification landed on, so the closed halves are not reachable from here | Phase 1 — The residuals |

## Acceptance Criteria

- [ ] AC-1 — The vendored grammars have an independent verification path against
      the locked upstream, proven by a check that has been observed failing on
      mutated bytes. A manifest-internal check does not satisfy this.
- [ ] AC-2 — `packed_binary_predicate.ts`'s docblock states its threat boundary,
      so the absence of a trust anchor is documented rather than inferable.
- [ ] AC-3 — `docs/CLAIMS.md`'s `skill-activation-census-zero` entry no longer
      contradicts ADR-263, with `check_skill_activation_claim` green on the
      corrected figure rather than on the stale one.
