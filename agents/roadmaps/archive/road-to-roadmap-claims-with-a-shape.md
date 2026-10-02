---
complexity: lightweight
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "This roadmap is the change that makes an exemption like this one checkable. The previous inbox landing added 22 roadmaps with 22 free-text exemptions in one commit, and this round adds eight more the same way; the gate that would make the eighth one cost something is the subject here, so it cannot wait for a slot the gate does not yet price. Merging into road-to-corpus-refresh-cadence-shape was rejected because that draft owns a different gate, and archiving or parking an active roadmap would buy a slot while leaving the free-text exemption unpriced."
relates:
  - slug: road-to-corpus-refresh-cadence-shape
    relation: disjoint
    note: Same family of roadmap-authoring gates, different object; that roadmap owns the corpus re-check cadence.
---
# Road to roadmap claims with a shape

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a round of sixteen external
> reviews of the 16.2.0 release plus a supplied scorecard rescore whose fourth
> fold names the estate exemption and whose falsifiability row names the verify
> grammar nobody uses. Verified against `main` at `9bc8cd4f2` on 2026-10-01;
> disposition at `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

Three claims a roadmap makes about itself become checkable instead of free text:
why it was exempt from the estate's one-in-one-out rule, whether its new
`verify:` lines can fail, and how often the held object it cites has arrived.
Done means: an exemption reason that does not name the alternatives it rejected
fails the estate gate, drafts appear in the estate report, a changed executable
`verify:` line without an expectation fails a diff-scoped check, and the
arrival-count check runs somewhere a pull request can see it.

## Context

Reproduced on 2026-10-01:

- `e0db0cca2` added 22 roadmaps and 22 `estate_offset_exempt` lines in one
  commit. `exemptionReason` (`check_estate_count.ts:558-566`) accepts any
  non-empty string. `collect()` excludes `status: draft` by design
  (`check_estate_count.ts:937-942`), so a draft is invisible to the count half.
- `./scripts-run src/scripts/roadmap_verify_share` over the active estate →
  173 clauses, 99 naming a command, 34 naming an expectation — and all 34 sit in
  roadmaps authored in this round; the twelve roadmaps active before it carry
  **zero** expectations. The grammar shipped in `_lib/verify_clause.ts:26-33`;
  `closure_scan` lists unfalsifiable clauses and gates nothing (`:41,:122`).
- `check_held_object_arrivals` is advisory and has no caller outside its own
  file (`grep` over `.github`, `Taskfile.yml`, `package.json`, `src/scripts`).

## Phase 1 — An exemption names what it rejected

- [x] **1.1 Measure the exemption population first.** Over every
      `estate_offset_exempt` in the active, later and archived trees, count how
      many name at least one rejected alternative (archive, park, merge into an
      existing roadmap) and how many repeat another file's reason verbatim.
      Written to `agents/evidence/analysis/estate-exemption-shape-<date>.md`.
      verify: `grep -c 'rejected alternative' agents/evidence/analysis/estate-exemption-shape-*.md` -> /^[1-9]/
- [x] **1.2 Require the shape on added files only.** `exemptionReason` refuses a
      reason that names none of archive, park or merge, and a reason identical
      to another added file's in the same diff. Grandfathered: existing files are
      never re-read. Fixture first, seen red on the current accept-anything path.
      verify: `npx vitest run tests/scripts/check_estate_count.test.ts -t shape` -> 0
- [x] **1.3 Report drafts beside the count.** The estate output prints a
      `draft_roadmaps` line. Reported, not gated: a draft is not active work, but a
      reader of the count should see how many exist.
      verify: `./scripts-run src/scripts/check_estate_count` -> /draft_roadmaps/

## Phase 2 — A changed verify line can fail

- [x] **2.1 Measure the false-positive cost on real diffs.** Replay the last
      thirty merged diffs that touched `agents/roadmaps/*.md` and count the added
      or changed `verify:` lines that name a command without an expectation, and
      how many of those could have carried `-> 0` without loss.
      verify: `grep -c 'replayed' agents/evidence/analysis/verify-expectation-replay-*.md` -> /^[1-9]/
- [x] **2.2 Ratchet changed lines, never the estate.** A diff-scoped check fails
      an added or changed `verify:` line that names a command and no expectation,
      reusing `VERIFY_ARROW_SOURCE` rather than a second regex. Prose clauses stay
      legal. Seen red on a fixture diff, with a gate-coverage row and a self-test.
      verify: `npx vitest run tests/scripts/check_verify_expectation_delta.test.ts` -> 0

## Phase 3 — The arrival count is read where it matters

- [x] **3.1 Give the arrival check a caller.** Run
      `check_held_object_arrivals` in the consistency workflow, advisory first,
      printing the objects it names; `--enforce` only after one green run on
      `main`.
      verify: `grep -c 'check_held_object_arrivals' .github/workflows/consistency.yml` -> /^[1-9]/

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| Free-text exemption accepted, 22 of 22 exempt | KEEP | Phase 1 |
| Drafts invisible to the estate count | FOLD — reported, not gated | 1.3 |
| New or changed executable verify must carry an oracle, shrink-only | KEEP, diff-scoped | Phase 2 |
| Migrate every old verify clause | CUT — prose stays legal by design | 2.2 |
| `check_held_object_arrivals` has no caller | KEEP | 3.1 |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Drafts are reported, never counted | `collect()` excludes them deliberately, and counting them would make every parked idea cost a slot | Drafts are used to hold ready work outside the count |
| D2 | reversible-technical | evidence | The verify ratchet reads changed lines only | Gating the estate would red every roadmap active before this round; `verify_clause.ts:34-40` records why prose stays legal | 2.1 shows the false-positive share above one in four |
| D3 | deterministic | evidence | Closure-scan C1 and C2 (steps 1.1 and 1.2 read as typed operations) match the word `archive` as a value an exemption names; neither step archives anything | Both steps read or validate frontmatter only | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The shape check is satisfied by boilerplate | product | A required phrase becomes a template line pasted into every reason, and the check passes while saying as little as before. | 1.2 also refuses a reason identical to another added file's, and 1.1 measures the population so a later review can see boilerplate growing. | Phase 1 — An exemption names what it rejected |
| 2 | Authors add `-> 0` to commands whose exit is meaningless | implementation | `-> 0` on `cat file` is an expectation that still cannot fail. | 2.1 counts how many replayed lines would carry an expectation without loss; the ratchet's message names the regex form for content checks. | Phase 2 — A changed verify line can fail |
| 3 | Enforcing the arrival check reds unrelated pull requests | implementation | A held object cited in an old blocker fails a PR that never touched it. | 3.1 starts advisory and enforces only after a green run on `main`. | Phase 3 — The arrival count is read where it matters |

## Acceptance Criteria

- [x] AC-1 — An added roadmap whose exemption names no rejected alternative, or
      repeats another added file's, fails the estate gate.
- [x] AC-2 — The estate report prints the number of draft roadmaps.
- [x] AC-3 — A diff adding a command-bearing `verify:` line without an
      expectation fails a check, and prose clauses still pass.
- [x] AC-4 — `check_held_object_arrivals` runs in a pull-request workflow.
