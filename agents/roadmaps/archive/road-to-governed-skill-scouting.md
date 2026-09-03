---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: later/road-to-skill-ecosystem-capability-queue
    relation: extends
    note: "receives this roadmap's Phase 4 (upstream drift-watch) by carried-to; the egress decision here excluded it, and that queue is where capability-shaped work waits"
  - slug: later/road-to-skill-ecosystem-security-and-conformance
    relation: disjoint
    note: "adjacent skill-ecosystem surface, but it makes unenforced rules detectable and shares no mechanism with candidate intake or the capability differential"
estate_offset_exempt: Added by the 2026-09-b inbox round on the maintainer's instruction to carry its survivors into ready roadmaps. No archive move was available as a named one-in-one-out counterpart, so this is a self-issued claim and not an offset -- the distinction the owner-reserved question in agents/roadmaps/stubs/road-to-owner-authority-decisions.md records as undecided. Stated rather than smoothed over.
---
# Road to governed skill scouting

> **Source:** `agents/tmp.old/inbox-2026-09-b/s08/` — the only unit in that round
> carrying the maintainer's own words rather than a reviewer's. Verified against
> `c6b4f6407` by the run that wrote this file.

## Goal

There is a bounded, repeatable way to evaluate an external skill against what
this package already has, and to reject it on evidence rather than on taste.
When this is finished, a candidate that clears every gate can be proposed as a
contribution, one that does not ends with a written reason, and neither outcome
depends on anybody's memory of what the 299 existing skills already cover.

## Context

The maintainer asked, in their own words: *"Können wir so skills suchen und für
uns bewerten und übernehmen?"* — and then constrained the answer twice, without
being asked to:

> *"Das sollte dann natürlich nur ein interner command oder so sein. Oder wenn er
> von überall … nutzbar ist, sollte am Ende gefragt werden, ob man den als
> Verbesserung gegen AC als PR schicken möchte."*

> *"Die PR-Frage sollte nur erscheinen, wenn die Verbesserung die Gates
> tatsächlich bestanden hat – also Novelty vorhanden, Security/License okay,
> messbarer Benefit und die drei Challenge-Loops ohne ungelöste kritische
> Einwände. Sonst endet es einfach mit 'keine Contribution empfohlen'."*

Both constraints are load-bearing and both are already the design. The second
one in particular inverts the usual failure: the interesting output of a
scouting pipeline is the **rejection**, and a flow that only knows how to
succeed produces a contribution queue nobody trusts.

The core principle is *import intelligence, not files* — what is evaluated is
the marginal capability delta against this package, never the external skill in
isolation. A skill that is excellent and already covered is a reject.

### What the tree already supplies

| Need | Existing carrier | Verified |
|---|---|---|
| Lint a candidate outside `src/skills/` | the lint fleet takes `--root` | `lint_skill_descriptions.ts:370` |
| Ask whether a capability is already covered | `src/scripts/audit_skill_overlap.ts` | file present |
| Record a borrow with its licence | `provenance/borrows.jsonl` + `lint_provenance.ts` | present |

### Three constraints this roadmap must not break

1. **No new CLI verb.** ADR-041 (`status: accepted`) governs the verb surface.
   The scout is a script plus a Taskfile target.
2. **No new skill in the default path.** The preamble payload has zero headroom
   against its grace ceiling and a catalogue entry costs ~50 tokens. A
   `skill-scout` meta-skill is deferred until two real pipeline runs have
   happened, and that deferral is not a preference — it is the only legal option.
3. **`lint_provenance.ts` has no network logic** (`grep` for `fetch(`/`http` →
   zero). A borrow recorded today cannot notice that its upstream changed
   afterwards. Drift-watch is therefore a *new* capability, not a widening.

### One correction to the source

The draft describes a quarantine directory following "the memory-quarantine
pattern". No `*quarantine*` script exists in `src/scripts/`. Phase 1 must
establish the pattern rather than assume it.

## Phase 1 — Candidate intake that cannot execute anything

- [x] **1.1 Establish the quarantine shape.** A candidate lands as inert files
      under a gitignored path, is never projected, and nothing in it is executed,
      sourced, or added to a tool manifest. Write the shape down before writing
      the code — the source's cited precedent does not exist.
      verify: the contract names the path, states that content is inert, and a
      test asserts that a candidate directory is absent from every projection.
- [x] **1.2 Run the existing lint fleet against the candidate root.** No new
      linters. `--root` already exists on the description linter; establish which
      of the fleet accept it and record which do not.
      verify: report the list of lints run against a candidate and the list that
      could not be, with the reason per entry.

      **Finding — the flag is not the capability.** Four lints under
      `src/scripts/` accept `--root`. Run against a real quarantined candidate,
      only **one of the four** reaches a candidate at all. `lint_skill_link_reach`
      and `check_skill_admissions` take `--root` to mean the *repository* root, a
      self-test affordance, and keep scanning `dist/agent-src/skills` and the
      admissions ledger respectively; `lint_skill_scripts_readonly` takes a skill
      root but scans `<skill>/scripts/**`, which a text-only candidate does not
      have. All three reported a dead scan scope rather than a pass — loudly,
      which is the behaviour that made the finding visible at all. A fleet list
      assembled by grepping for `--root` would have been wrong in three places
      and would have reported three lints as having run over nothing. The split
      recorded in `LINT_FLEET_ROOTED` / `LINT_FLEET_UNROOTED`
      (`src/scripts/skill_scout.ts`) is therefore measured, and the test asserts
      a non-empty reason per unavailable entry.

## Phase 2 — The differential, which is the whole point

- [x] **2.1 Compute the capability delta against the 299, not the candidate's own
      claim.** Route through `audit_skill_overlap.ts`; the output is a delta
      statement, not a score.
      verify: a candidate that duplicates an existing skill is rejected with the
      overlapping skill named; run it against a known-covered subject and record
      the rejection.
- [x] **2.2 Reject on coverage, not on quality.** A well-written skill this
      package already covers is a reject, and the reason string says so.
      verify: the rejection text names the covering artefact.

## Phase 3 — The exit the maintainer specified

- [x] **3.1 Gate the contribution offer on all four conditions.** Novelty present,
      security and licence clear, a measured benefit, and three challenge loops
      with no unresolved critical objection. Any one missing ends the run with
      *"keine Contribution empfohlen"* and the reason.
      verify: a candidate failing exactly one condition produces no PR offer;
      test one such case per condition, four in total.
- [x] **3.2 Make the negative path the default output shape.** The run's normal
      ending is a written rejection. A flow whose success path is better
      developed than its rejection path will produce optimistic verdicts.
      verify: the rejection output carries the same fields as the acceptance
      output — candidate, delta, gates, reason — and a test asserts both shapes.
- [x] **3.3 Never post anything.** The offer is a question to the human. Opening
      a PR is an outward-facing irreversible action and stays behind the standing
      confirmation floor.
      verify: no code path in the scout invokes `gh pr create` or an equivalent.

## Phase 4 — Upstream drift, only after two real runs

- [~] **4.1 Do not start this phase before Phase 3 has two recorded runs.**
      <!-- deferred-resolution: carried-to=road-to-skill-ecosystem-capability-queue -->
      `lint_provenance.ts` has zero network logic, so a borrow recorded today
      cannot notice its upstream changing afterwards. Adding a fetch is an egress
      decision governed by the first blocker below, not a lint extension — and
      designing a watcher for a pipeline that has never run twice is designing
      against an assumption.
      verify: this step stays open until two pipeline runs are recorded in the
      roadmap; the entry condition is the check, and starting early is the
      failure.

      **Carried, not deferred for capacity.** The entry condition is now met —
      two real runs are recorded below — and the phase still cannot be built
      here, because the decision that unblocked the rest of the roadmap closed
      this phase. `scout-egress-authority` resolved **(a)**: no network fetch of
      any kind. Drift-watch requires exactly one, so it is not a step this
      roadmap is postponing, it is a capability the egress decision excluded.
      It is carried to `later/road-to-skill-ecosystem-capability-queue` — which
      is where capability-shaped work waits, and which this roadmap already
      names in its `relates:` list — rather than marked done, because the
      obligation is real and unbuilt. Reopening it means reopening the egress
      decision first, on the evidence that blocker records.

### Two recorded pipeline runs

Both against the real corpus of 299 skills, on 2026-09-03, via
`task dev:skill-scout`. Both ended in a rejection, which is the shape the
maintainer's constraint predicted the normal ending would have.

| Run | Candidate | Verdict | Deciding gate |
|---|---|---|---|
| 1 | a verbatim copy of an existing skill, staged under a different name | `keine Contribution empfohlen` | `novelty` — covered by `accessibility-auditor` (`src/skills/accessibility-auditor/SKILL.md`) at similarity **0.9934** against 299 skills |
| 2 | an off-domain candidate written for the run | `keine Contribution empfohlen` | `challenge_loops` — 2 of 3 recorded; `novelty` passed at **0.0832** against nearest `source-discovery` |

Run 1 is the real known-covered subject AC-2 asks for. Run 2 exercised the
novelty pass and a non-novelty rejection in one pass, which is what makes the
two runs a pair rather than a repetition. Neither run's candidate is named
upstream anywhere in this tree — `source-confidentiality` governs the rejection
text, so the reason names the covering artefact in this package and never a
source.

## Blockers

### blocker: scout-egress-authority
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** all of Phase 1 and Phase 4
- **What to do:** pick exactly one — (a) the scout performs no network fetch at
  all and operates on candidates the human has already placed in the quarantine
  directory, keeping the lethal-trifecta legs separated by construction; or
  (b) the scout may fetch from an explicit allow-list of sources, which adds an
  untrusted-content ingestion leg beside existing repo read access and the
  contribution path, and therefore needs the egress gate spelled out before any
  code lands.
- **Resolved when:** the choice is recorded in this file and, for (b), the
  allow-list and its gate are named.
- **Recommendation:** (a). It is the smaller surface, it needs no new
  authorization, and it costs the human one copy step per candidate — which is
  the step where a human looks at what they are importing anyway.
- **If you do nothing:** nothing in this roadmap starts. Every phase reads or
  evaluates a candidate, and where candidates come from is the first question.
- **Decision:** **(a)** — the scout performs no network fetch. Decided by AI
  council on 2026-09-03 (members: anthropic, openai), unanimous, in place of
  maintainer sign-off under a standing autonomous mandate. Both seats gave the
  same reasoning: this package already holds two legs of the lethal trifecta —
  repository read access and a contribution path — so retrieval of untrusted
  external content would complete all three on one autonomous path. Human-staged
  intake separates the legs by construction rather than by a runtime gate, and
  the copy step is where a person looks at what they are importing. One seat
  added a condition adopted here in full: "human copied it" is not a content-trust
  guarantee, so quarantine still enforces provenance, extension and size limits,
  symlink rejection and inert parsing. Recorded in
  `docs/contracts/skill-scout-quarantine.md`; enforced by `intake()` in
  `src/scripts/skill_scout.ts` and by the six refusal tests in
  `tests/scripts/skill_scout.test.ts`.

### blocker: scout-invocation-surface
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** 3.1, 3.3
- **What to do:** pick exactly one — (a) the scout runs only inside this package
  and the contribution question never appears, because a maintainer running it
  here is already in the repository that would receive the change; or (b) it
  runs from a consumer project too, and the contribution question appears there
  behind the four gates of 3.1.
- **Resolved when:** the chosen surface is stated here and the Taskfile target
  matches it.
- **Recommendation:** (b), because it is what the maintainer described — but
  (b) means the scout must run without this repository's `src/` present, which
  changes what 2.1 can compare against and is worth settling before Phase 2.
- **If you do nothing:** Phase 3 has no defined caller and 3.1's four gates
  cannot be tested against a real invocation.
- **Decision:** **(a)** — in-repo only. Decided by AI council on 2026-09-03
  (members: anthropic, openai), unanimous, in place of maintainer sign-off under
  a standing autonomous mandate. This is the one place the council went AGAINST
  the roadmap's own recorded recommendation of (b), and both seats named the same
  reason: consumer invocation is not another entry point but a different trust
  domain. It requires three new contracts, not one — a quarantine layout that
  becomes an undocumented public contract in consumer repositories, a scout that
  functions without this repository's `src/` present, and a contribution flow
  whose comparison baseline is absent exactly where the differential in 2.1 needs
  it. One seat named the evidence that would reopen it: a signed, versioned
  capability baseline available without `src/`, equivalent quarantine isolation
  in a consumer repository, and explicit confidentiality handling. None exists.
  The Taskfile target is `dev:skill-scout` in `taskfiles/dev.yml`, which matches
  the chosen surface.
  *Consequence for 3.1 and 3.3:* the four gates are unchanged, but their exit is
  a recommendation to adopt rather than an offer to open a PR — the maintainer is
  already in the receiving repository. 3.3 is satisfied more strongly than
  specified: the scout has no outward action of any kind.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A candidate's own text steers the evaluation | implementation | An external skill is untrusted content that will be read by an agent deciding whether to adopt it; instructions inside it are the classic injection surface | 1.1 keeps candidates inert and unprojected; the differential in 2.1 is computed from this package's index, never from the candidate's self-description | Phase 1 — Candidate intake that cannot execute anything |
| 2 | The pipeline produces adoptions because that is what it is for | product | A scout whose success path is the developed one will find things worth adopting; the maintainer's own constraint anticipates this | 3.2 requires the rejection output to be as complete as the acceptance output, and 2.2 makes coverage a first-class reject reason | Phase 3 — The exit the maintainer specified |
| 3 | Adoption lands a skill and reds the payload budget | implementation | Zero headroom means one catalogue entry fails the build, and an adoption that cannot ship is worse than one that was never proposed | The budget check belongs in 3.1's gate set; a candidate whose adoption would exceed it is rejected on that ground with the number quoted | Phase 3 — The exit the maintainer specified |
| 4 | Scouting reveals the external source in a tracked artefact | product | `source-confidentiality` forbids naming an upstream this package learned from; a rejection reason naturally wants to say where the candidate came from | Rejections cite the encrypted-link form the round already uses; the ledger, not the roadmap, is where a source name may live | Phase 2 — The differential, which is the whole point |

## Acceptance Criteria

- [x] AC-1 — a candidate can be evaluated end to end without any file from it
      appearing in a projection, a tool manifest, or an executed path.
- [x] AC-2 — a duplicate-capability candidate is rejected with the covering
      artefact named, demonstrated on a real known-covered subject.
- [x] AC-3 — the contribution offer appears only when all four gates pass;
      four tests, one per gate, each observed failing before it was observed
      passing.
- [x] AC-4 — no new CLI verb and no new skill exist as a result of this roadmap,
      and the preamble budget reports no delta attributable to it.
- [x] AC-5 — both blockers carry a recorded decision, or the phases they gate
      stand `[~]` with that stated. Both carry a recorded decision; Phase 4
      additionally stands `[~]` because the recorded decision on the first
      blocker is what closed it.
