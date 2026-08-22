# Council disposition — publish-boundary blockers

<!-- evidence-type: analysis -->

**Date:** 2026-08-22 · **Members:** 2/2 (anthropic, openai) · **Mode:** `design`,
depth `standard`, blind peer review · **Cost:** $0.0486.

## Decision 1 — `b-sourcemap-intent`: (b′), which is neither option as written

Both seats rejected the question's own option set, independently and for the
same reason: **it conflated two classes.**

- A product `.js.map` is a **consumer debugging affordance** — line mapping and
  stepping in a debugger over shipped JS. Shipping `.ts` files is not a
  substitute: *"Maps encode generated-to-source locations; loose `.ts` files
  alone do not preserve debugger or stack-trace mapping."*
- A compiled **test's** output has no consumer-facing purpose at all.

So the 8 test maps prove that *test compilation* is unintentional. They do not
prove the 119/120 product maps are, and one seat put it directly: *"One faulty
output class cannot determine the intent of another."*

**Verdict: strip compiled-test artefacts (threshold 0), keep the product maps at
a provisional measured ratchet.** The risk is asymmetric — stripping is an
irreversible capability loss with no evidence of non-use, keeping is reversible.
"A zero threshold is more legible" is an operational preference, not a finding.

### The council predicted a defect the measurement then confirmed

One seat asked whether compiled test **JavaScript** was also published, not just
its maps — *"removing only its maps addresses the symptom."* It was: 8
`.test.js` files alongside 8 `.test.js.map` files. So (b′) strips both, and
without that question the fix would have left the compiled tests in the tarball.

### Two conditions attached

- The ratchet is **provisional**, not an architectural constant, and must be
  recomputed from a clean checkout at the release commit rather than from a
  developer worktree.
- Tie the packaging gate to **release sequencing**, not a calendar date: it must
  complete before the next publish. One seat rejected a bare date as
  insufficient for exactly that reason.

## Decision 2 — `b-sbom-scope`: (a), the rejection stands

Both seats. ADR-238's Trigger A requires a named maintainer with a stated review
cadence **and** a fixture set authored against the current skills showing a real
miss. Neither half exists, and the trigger is deliberately expensive.

**What would make it worth paying:** a fixture set demonstrating the current
skills missing a real supply-chain finding an SBOM would have caught. Stated so
the next reader meets a condition rather than a closed door.

One caveat carried forward: *"'blocks nothing' is only true if no later phase
promises or consumes SBOM-derived evidence."* None does today.

## One mechanism finding, produced while implementing the verdict

The strip was first attempted in `.npmignore` and **had no effect**:
`package.json` `files[]` is an allowlist that overrides `.npmignore` for anything
under an included root, and `dist/` is one of the 26 roots. The working mechanism
is four `!` negation patterns inside `files[]`.

That is a live fact for this roadmap's Phase 3, which is about drift between
exactly those two surfaces — and it means an `.npmignore` rule covering a
`files[]` root is decoration. The ineffective line was reverted rather than left
in place.

Payload before: 2,970 entries, 128 maps, 8 compiled test JS.
After: **2,954 entries, 120 maps, 0 test JS, 0 test maps.**
