---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >-
  This roadmap IS the offset. It exists because an AI council classified four
  review findings as shippable debt rather than release blockers, and that
  decision is worthless unless it is written where the next reviewer finds it —
  otherwise all four are re-found and both review rounds are paid for again.
  Archiving an unrelated roadmap to make room would dispose of somebody else's
  open work to record a decision about this one, which trades a real estate
  reduction for a bookkeeping entry. Closes with the release that ships the
  fixes; two of its four items are already decided and need only a dated line.
---
# Road to settings writer residual debt

> **Source:** two neutral reviews over the 15.0.0 settings-writer idempotence
> change (rounds 1 and 2, 2026-09-10), plus an AI-council verdict on which of
> the residuals block a release. The council classified R2 blocking (fixed on
> that branch), R1 and R3 "fix now" (also fixed), and the four items below
> "ship as recorded debt". This roadmap is that record — without it the four
> are only a paragraph in a chat log.

## Goal

The four residuals the council explicitly agreed to ship are either closed or
re-decided against evidence, and none of them is discovered a second time by a
future reviewer who has no way to tell "known and accepted" from "nobody
noticed". Finished means: each item below is fixed, or carries a dated line
saying why it stays.

## Phase 1 — the two that mislead a reader

- [x] **1.1 Remove the stale flat twin when the nested key wins.**
      `mergeIntoTemplate` hits the nested key and returns, so a file the
      pre-15.0.0 writer produced keeps a dead top-level `personal.ide: <stale>`
      line beside the real nested one. It parses (the nested key wins by YAML
      semantics) and it is a single occurrence, so the duplicate pass never
      sees it. It is permanent, and it tells a reader the opposite of the truth.
      verify: a test writing `personal:\n  ide: a\npersonal.ide: b\n`, running
      the merge, and asserting no `^personal\.ide:` line survives — observed
      failing before the change.

- [x] **1.2 Drop an orphaned `# Wizard-added keys` header.**
      Collapsing the duplicated block can leave the comment header with nothing
      under it, and the next append writes a second header below the first, so
      they accumulate.
      verify: repair a file whose whole appended block collapses, assert the
      output carries exactly one such header and it is followed by at least one
      key.

## Phase 2 — the two that need a decision, not a patch

- [x] **2.1 Decide `--check` over a corrupt file.**
      Today it exits 2 and names the repair explicitly (distinct from template
      drift). The council split on whether a repair-only difference should exit
      0; this branch kept 2, on the ground that a green `--check` over a file
      the reader cannot parse hides the breakage. Re-decide once a consumer
      actually wires `--check`, with their CI shape as the evidence.
      verify: either the exit code changes with a test pinning the new
      contract, or a dated line here records the decision to keep 2.

      2026-09-11 — Keep exit 2 for a repair-only difference: the target still
      requires a write and cannot be consumed by the strict YAML reader, so a
      green `--check` would hide the breakage. The documented contract is
      corrected from "exit 2 on drift" to "exit 2 when synchronization requires
      intervention", since the code already exits 2 for both cases. Reopen when:
      an identified consumer integrates `--check` specifically for template-drift
      detection and demonstrates a reproducible need to machine-distinguish
      repair-only remediation from drift while still treating both as
      unsuccessful checks. (AI council, 2 of 2 seats, converged.)

- [x] **2.2 Decide whether an unparseable input may be repaired at all.**
      An input broken beyond its duplicate keys (an unterminated quote) can be
      collapsed into a document that parses to structure nobody wrote. The
      branch ships a warning naming exactly that. The alternative is to refuse
      the repair outright when the original does not parse for any other
      reason — safer, and it costs the operator a hand edit in a case they were
      going to hand-edit anyway.
      verify: either the refusal ships with a test, or a dated line records why
      the warning is enough.

      2026-09-11 — Refuse the repair, before any durable write. The collapse's
      safety rests on preserving the original's last-wins reading, and a
      document invalid for some further reason has no reading to preserve — so
      the pass can emit valid YAML carrying structure nobody authored, which
      then passes every downstream check. A stderr warning is a weak control
      against a silent outcome; a refusal is loud and recoverable. Implemented:
      `main` calls `residualParseError` on the raw text before the collapse
      notice and returns 2 with the parser's own first message line, its error
      code and line/column; the target is left byte-for-byte unchanged (the
      single `writeFileSync` is the last statement in `main`, with no temporary
      file and no rename). No `--repair-anyway` flag — both seats rejected one:
      an operator who understands the file well enough to invoke it understands
      it well enough to fix the error first, and "read the diff" is not a
      trustworthy acceptance oracle for YAML semantics. Reopen when: a real
      input class appears where the residual error is provably independent of
      the duplicated keys AND a hand fix is not available to the caller.
      (AI council, 2 of 2 seats, converged.)

## Sibling site, searched and deliberately left

The wrong construct behind 1.1 is *`findScalarLine` hits → `replaceScalar` →
return, without consulting the flat form*. Grepped: it occurs at exactly **two**
sites — `mergeIntoTemplate` (fixed) and `upsertScalar` (`src/server/io/yamlIO.ts`,
the `replaceScalar` branch). The second is left, as a decision rather than an
omission: `upsertScalar` has never written a flat twin — its absent-path branch
creates real nesting, and its own docstring names the flat form as the wrong
shape for a nested key. So any flat `a.b:` it meets is by construction **not its
own leftover**, which is precisely where risk-register row 2 bites hardest.
Extending the deletion there would outrun the provenance argument that makes it
safe in `mergeIntoTemplate`. Reopen if a caller is found that routes a
wizard-written flat key through `upsertScalar`.

A second construct was searched on the same pass: the documented `--check`
contract that 2.1 corrected. `grep 'exit 2 on drift'` found **two** sites —
`sync_agent_settings.ts`'s header and `src/scripts/_dispatch.bash`'s help text —
and both are corrected here. The grep now returns zero.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-10 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The record is the only thing that exists | process | Nothing enforces these; a future reviewer re-finds all four and the cost of the two review rounds is paid again | The Source block names the reviews and the council verdict, so a re-find resolves to "decided" in one read rather than a fresh investigation | Phase 1 — the two that mislead a reader |
| 2 | 1.1 deletes a line somebody meant | implementation | The stale-twin sweep cannot distinguish a leftover from a flat key a user wrote deliberately | Remove only when the nested form of the SAME path exists and won; never on a flat key with no nested twin | Phase 1 — the two that mislead a reader |

## Acceptance Criteria

- [x] AC-1 — No `mergeIntoTemplate` output carries a flat dotted line whose
      nested twin exists in the same document, and a test fails if one does.
- [x] AC-2 — A repaired file carries at most one `# Wizard-added keys` header,
      and never one with no keys beneath it.
- [x] AC-3 — Each Phase 2 item is either implemented with a test pinning the
      new contract, or carries a dated line in this file recording the decision
      to keep the current behaviour and what evidence would reopen it.
