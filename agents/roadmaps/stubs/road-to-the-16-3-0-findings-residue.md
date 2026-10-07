---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: the 16.3.0 findings residue

> **Stub — not active work.** Written 2026-10-07 by
> `road-to-findings-that-get-a-disposition` step 1.2, which re-read every row
> of `agents/evidence/release-findings/16.3.0.json` against `main` @
> `6051d3744`. Fourteen rows were real, unfixed and carried by no roadmap —
> eleven read in that step, three a council had already read `still_open`.
> That roadmap only records dispositions, so fixing them there would be scope
> creep; each one is named here with its evidence and what closes it, and its
> ledger row is `still_open` with this file's slug.

Every item is repository work an agent can do. Nothing here waits on the owner
or an outside party; it is parked only because no live roadmap owns it.

## 1. `runner.ts` behaviour-axis residue

`src/agent-src/templates/scripts/work_engine/stack/runner.ts` is 1,498 lines
against the 1,500-line source ceiling (`check_source_size_budget.ts`), so
every fix below needs room first.

- **4398cd4de275** — the line cap blocks the deferred fixes. Closes when the
  behaviour axis moves into its own leaf module and `runner.ts` has headroom.
- **636654f532ad** — two known-wrong outputs ship: `_dotnet_project_text`
  descends past scope boundaries (the comment above it says "NOT pruned at scope
  boundaries"), and `_pnpm_packages` drops a multi-line flow sequence (the
  "KNOWN GAP" comment in that function). Closes when each has a fixture that
  fails today and passes after.
- **a78536c88317 (residual)** — the row is `fixed` for the vector it names (a
  literal entry that is itself a symlink, closed by `lstatSync`), but
  `lstatSync` resolves only the last segment: a literal `pkg/x` whose `pkg` is
  a symlink to outside the root still resolves outside it, and the glob branch's
  `readdirSync` follows a symlinked parent the same way. No test pins the
  `lstat` fix either. Closes with a realpath containment check and a symlink
  fixture for both branches.

## 2. Delivery-set measurements that move without provenance

`agents/evidence/analysis/delivery-set-measurement-2026-08-31.json` and
`routing-body-signal-verdict.json` are regenerated in place, and neither records
why its figures moved. Spec rows whose own `_eval_note` in
`src/skills/test-case-discovery/evals/triggers.json` says they are expected to
fail a live pass sit in the train corpus that produces the headline recall.

- **2ce05ad49c18**, **28e4739a5e3b**, **8ab7e0deb605** — closes when the
  generators (`src/scripts/measure_delivery_sets.ts` and the routing-signal
  measurement) write a provenance block naming the corpus revision and any
  rows excluded or expected-red, or when those rows leave the train partition.

## 3. Stale figures in an archived roadmap

`agents/roadmaps/archive/road-to-behavior-vocabulary-and-runner-truth.md`
quotes counts the evidence tree has outgrown: its close-out says twenty
completion-review rounds and 158 findings, the tree holds 21
`behavior-vocabulary-close*.findings.md` files and 160 rows, and AC-3 says
"97 tests green" for a file that now holds 121 tests.

- **de29dcc6b5d8**, **357ec50dedd8**, **41aabf237a10**, **1b44a71a5dd3**,
  **703a0aacd48e** — closes when each figure is replaced by the command that
  produces it (the findings-file glob, `npx vitest run
  tests/scripts/work_engine/stack_runner.test.ts`), so the record cannot go
  stale again.

## 4. Review manifests that declare a tool set they did not record

- **84e495bee3c5** — `deriveManifest` in `src/scripts/dispatch_r2_reviewer.ts`
  writes the `tools:` line as a constant, so a round whose findings cite an
  executed `vitest` run still declares a read-only tool set, while
  `docs/contracts/plan-review-gates.md` § 5 calls the manifest verification
  rather than self-attestation. Closes when the line is derived from what the
  reviewer ran, or is relabelled as the dispatcher's declaration.

## 5. Ratifications whose review the record overstates

Three rows a council read `still_open` on 2026-10-07 (round 4, anthropic and
openai) without naming a carrier; this item gives them one. Since
`road-to-release-evidence-that-reproduces` step 3.1 the ratification reader
refuses a NEW artefact of either recorded shape below, so what stays open is
the named historical artefacts and one missing mechanism.

- **541a64c5b619** — nothing requires a council seat to be shown the diff
  rather than an author-written description of it. Closes when a ratification
  prompt that carries no diff, or no reference to one, is refused by the reader.
- **2c9959f7262d** — `agents/evidence/ratifications/drain-failed-command-recorder.md`
  records `verdict: ratified` over a final non-convergent seat.
- **13568e8fe68a** — `agents/evidence/ratifications/fix-dependabot-prs-can-reach-their-required-check.md`
  lists two providers for a verdict one seat gave.

The last two close when the reader re-reads merged artefacts too, or when each
header is corrected with a dated note that keeps the original value visible.
Either is a governance-surface edit and needs its own ratification.

## Not here

The two duplicated `diff.patch` snapshot findings (**6a0b6bcea5af**,
**78520e9a6a33**) are carried by `road-to-review-inputs-out-of-the-hot-tree`.
