---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
research_pin: "agent-config @ 6e37584a1 (main, 2026-08-30, v14.12.0). Every figure re-derived in an isolated worktree at that commit; no network, no writes outside agents/roadmaps/."
estate_offset_exempt: "The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived nothing, so there is no offset to point at. Sanctioned on its own terms: the two roadmaps that previously closed the adjacent defect class are archived at 19/19 and 21/21 closed, so neither is a live carrier, and no active, parked or stubbed roadmap names retired-claim reachability or rule provenance."
estate_growth_exempt: "Lands as status: ready rather than draft because the gap is structural and verified: retiring a claim in the ledger changes nothing about where its wording is still published, and no gate in the tree connects the two. A draft would leave that design hole filed as an opinion."
---
# Road to retired claims stay retired

> **Source:** intake round `inbox-2026-08-g`, sets A, B and C, consumed by the
> `/analyze:inbox` run of 2026-08-30. The sets found the *instance*; the
> structural half below was found by checking what the existing gates actually
> read. True source paths are recorded encrypted in the round's intake note per
> `src/rules/source-confidentiality.md`.

## Goal

Retiring a claim in the ledger has a consequence outside the ledger: its
wording can no longer be published. Finished means a `withdrawn` or
`resolved-null` entry carries the phrasings it retires, a gate refuses those
phrasings on any surface the package publishes, and the normative content of a
rule either names where it came from or is recorded as having no external
source.

## The gap, stated precisely

Three separate things are true at `6e37584a1`, and none of them closes the
loop:

| | What it does | What it cannot see |
|---|---|---|
| `check_claims.ts` | Validates a ledger entry's own shape — a `withdrawn` entry must carry `retired_by` (`:484-489`); `SURFACE_ROOTS = ['README.md', 'docs']` (`:56`) | Whether the retired claim's **text** is still published. `package.json` and `.github/about.yml` are in neither the surface set nor the witness set |
| `lint_positioning.ts` | Enforces that `README.md`, `package.json.description` and `.github/about.yml` share the canonical anchor | The ledger. It reads **0** lines of `docs/CLAIMS.md`. Three surfaces agreeing on a retired claim pass it |
| The ledger itself | 60 `backed` · 29 `unbacked` · 6 `resolved-null` · 1 `withdrawn` | Nothing downstream. A row's `status` has no consumer that looks outward |

So retirement is a bookkeeping act with no reach. The live instance — the
withdrawn `no-runtime-daemon` claim still advertised on two publish surfaces —
is being fixed as a red in `road-to-gates-that-do-not-run` Phase 2.1. **This
roadmap deliberately does not fix that string**; it fixes the reason a second
one can appear tomorrow without anything noticing.

## Prior disposition — closed twice, each time scoped to a surface list

`agents/roadmaps/archive/road-to-number-truth.md` (2026-07-25, 19/19 closed)
found three published numbers wrong and named the cause: *"the ledger checks
that a pointer exists, never that its number is true."*
`agents/roadmaps/archive/road-to-published-number-truth.md` (2026-08-24, 21/21
closed) found the resulting witness sweep watched the right file in the wrong
shapes, and widened the shapes.

Both closes were correct. Both were about **numbers on a listed surface**.
Neither reached a *qualitative* claim, and neither questioned the list. That
the same class arrives a third time on a third axis is the finding — routed
through `src/rules/recurring-criticism.md`, where the broken assumption is
that a surface list plus a shape list is a closure. It is a snapshot of what
was published when the list was written.

## Phase 1 — Give a retired claim something to retire

- [x] **1.1 Add a `retires_phrasings:` field to closed ledger entries.** On a
      `withdrawn` or `resolved-null` row, a short list of the literal phrasings
      that claim was published as. The list lives on the row so that retiring a
      claim and forbidding its wording are one edit — a separate deny-list is a
      second file, and the second file is the one nobody updates.
      verify: `check_claims` accepts a closed entry with the field and one
      without; a `withdrawn` entry whose field is present but empty fails.
- [x] **1.2 Populate it for the four closed entries that have published
      phrasings.** One `withdrawn` and six `resolved-null` rows exist; read
      each and record the phrasings it actually shipped under, or record that
      it never appeared outside the ledger.
      verify: every closed row carries either a non-empty list or a stated
      never-published note.
      <!-- Executed 2026-08-30. TWO corrections to this step's own premises,
      both found by running it. (a) The ledger holds SEVEN `resolved-null`
      rows, not six — this roadmap's figure was written at `6e37584a1` and
      `dispatch-event-capture-reliability` landed with #1742 before execution
      began, so eight closed rows were populated rather than seven. (b) The
      step title says "the four closed entries that have published phrasings";
      the measured answer is ONE. `git log -S` over README.md, package.json,
      .github/about.yml, .github/topics.yml and .claude-plugin/marketplace.json
      across the full history returns commits for `no-runtime-daemon` alone;
      the other seven never appeared outside the ledger and carry the
      `never-published` sentinel with that evidence. A four that was never
      measured is exactly the class of number this roadmap exists to catch. -->
- [x] **1.3 Name the publish-surface set once, with the rule for extending
      it.** Both prior closes fixed an instance and left a list. State the
      decision rule instead: any file whose content is rendered by a
      distribution channel the package publishes to. Record it where the
      surface set is defined, not in a roadmap.
      verify: a reader can apply the rule to a channel not yet listed — a
      registry page, a marketplace manifest — and get an answer without asking.

## Phase 2 — Refuse a retired phrasing on any publish surface

- [x] **2.1 Extend `check_claims` to scan the publish-surface set for
      `retires_phrasings`.** Extend rather than add a sibling gate: the
      withdrawn/retired axis is already modelled there and a second gate needs
      its own copy of the ledger parser. The surface set comes from 1.3.
      verify: a fixture whose `package.json` description carries a retired
      phrasing fails; the same fixture with the current wording passes. Seen
      red before green.
- [x] **2.2 Prove the gate on the case that motivated it.** Re-introduce the
      exact historical string in a fixture — not a synthetic near-miss — and
      watch it fail. A gate never seen red on the real instance has unknown
      sensitivity.
      verify: the fixture carries the literal historical wording; the red and
      the restored green are both recorded.
- [x] **2.3 Register the widened gate** in the gate-coverage ledger with the
      new `scanned` paths and a self-test.
      verify: the coverage gate is green and the row names every surface added.

## Phase 3 — Say where a rule's content came from, and what it was when it left

- [x] **3.1 Add an optional `evidence:` frontmatter block to the rule schema.**
      Fields: `source_type`, `source_urls` (ENC1 tokens where the source is
      confidential, per `source-confidentiality`), `verified_on`,
      `normative_level`. Optional on day one — **0 of 120** rules carry any
      provenance field today, and holding all 120 at once is the
      strict-gate-fires-on-everything failure this repository has recorded
      before. The blocker linter's own decidability fields are the ratchet
      precedent.
      verify: `validate_frontmatter` accepts a rule with the block and one
      without; a malformed block fails.
- [x] **3.2 Populate ten rules and register the ratchet.** Pick the ten whose
      normative content most plausibly came from outside — the security and
      safety floors — because an unsourced normative claim costs most there.
      verify: ten rules carry a populated block; the ratchet baseline is the
      measured ten, and an eleventh rule added without one fails.
      <!-- Executed 2026-08-30. Shape decision, taken because the step does
      not fix one: the ratchet is expressed as a DECLARED SCOPE with a hard zero
      rather than a count of adopters with a floor. Reason it is not derivable
      from frontmatter — measured, not assumed: the ten span three `tier` values
      (2a, 2b, safety-floor), two `type` values and three pack sets, and
      `packs: [engineering-base]` also holds rules that are not safety floors.
      A proxy would silently admit and drop rules as unrelated frontmatter
      moved. `check_rule_evidence_declaration.SCOPE` is the list; adding a row
      is how the obligation widens, and it fails until that rule declares —
      proven by adding `scope-control` transiently (1 finding, exit 1). -->
- [x] **3.3 Create `docs/removed-rules.md` as a tombstone register.** One row
      per removed rule: name, what it required, when it went, why. A rule that
      vanishes without a row is indistinguishable from one that never existed,
      which is how a removed obligation returns as a fresh proposal.
      verify: the file exists, accounts for every rule removed in the two
      releases preceding this roadmap's landing as read from `git log`, and
      `check_references` stays green.
      <!-- Executed 2026-08-30. The measured answer over 14.10.0..HEAD is
      ZERO removals, and over the WHOLE history of src/rules/ exactly one `D`
      — a 2026-06-09 rename (augment-source-of-truth -> source-of-truth), not a
      removal. Both are recorded in the register with the re-derivation command,
      because "the table is empty" and "nothing has ever been deleted" are
      different statements. `--no-renames` is load-bearing in that command: with
      rename detection on, a real removal coinciding with an unrelated addition
      can be paired away and reported as a rename. -->

## Blockers

None. Every step is inside this repository and needs no host capability, no
network, no spend and no owner decision. Phase 1.3 makes a scoping decision,
but it records a rule rather than choosing a policy — the surfaces it admits
are the ones the package already publishes to.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The surface list grows by one again and the class recurs a fourth time | product | Both prior closes fixed an instance and left the list a list. Adding two files and stopping is the identical move, and the next channel — a registry page, a marketplace manifest, a generated badge — is outside it again | 1.3 makes the decision rule the deliverable rather than the entries, so a new channel is answerable without a fourth roadmap. The rule is recorded where the set is defined, not in this file, which will be archived | Phase 1 — Give a retired claim something to retire |
| 2 | `retires_phrasings` collects paraphrases and the gate becomes a false-positive machine | implementation | A retired claim has many near wordings; a list that tries to cover them all will match prose that is not the claim, and a gate that fires on legitimate text is muted within a release | 1.2 records only phrasings the claim was **actually published under**, read from history rather than imagined, and 2.2 proves the gate on the real historical string. A paraphrase nobody shipped is not in scope | Phase 2 — Refuse a retired phrasing on any publish surface |
| 3 | `evidence:` becomes a field authors fill with the nearest plausible URL | product | An unratcheted optional provenance field collects sources that look right, and a wrong provenance is worse than none because it survives review while being false | 3.2 populates only ten rules, by hand, on the highest-cost surfaces, and `normative_level` forces the author to state how binding the source is rather than only that one exists | Phase 3 — Say where a rule's content came from |
| 4 | Overlap with a concurrent re-opening of the archived number-truth roadmap | implementation | That roadmap touches `check_claims.ts` in the same region; two branches widening one gate is a conflict in the single file both need | The axes are separable — numeric witness shapes there, closed-status reach here — and 2.1 adds a scan rather than editing the witness sweep. If both land, the second rebases onto the first rather than re-deciding scope | Phase 2 — Refuse a retired phrasing on any publish surface |

## Acceptance Criteria

- [x] AC-1 — Every closed ledger entry carries either a non-empty
      `retires_phrasings` list or a stated note that the claim never appeared
      outside the ledger.
- [x] AC-2 — A fixture publishing a retired phrasing on any surface in the
      declared set fails `check_claims`, and the red was observed on the literal
      historical wording before the green.
- [x] AC-3 — The publish-surface set carries, where it is defined, a stated rule
      for deciding whether a channel belongs — applicable by a reader to a
      channel not yet listed.
- [x] AC-4 — The rule schema accepts an `evidence:` block, at least ten rules
      carry a populated one, and an eleventh added without it fails a ratchet.
- [x] AC-5 — `docs/removed-rules.md` exists and accounts for every rule removed
      in the two releases preceding this roadmap's landing.
