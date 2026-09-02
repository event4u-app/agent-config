## Acceptance Criteria

- [x] AC-1 — An activation receipt exists that was written by a producer
      independent of the classifier, and the evaluation cascade's stage list can
      assign all four Phase 1 families rather than two.
      **MET 2026-09-01 by step 1.1.** First half: `activation_receipt --rule
      <id>` appends a real line, and the test asserts the append against the real
      repository rather than a fixture. The ledger is local-only by contract
      (`audit-log-v1.md` § File location — "MAY be gitignored in consumer
      projects"), so "exists" rests on a reproducible write, not on a committed
      artefact; a committed receipt is not a thing this contract permits. Second
      half: `PREFIX_ASSIGNABLE_FAMILIES` stays at two and the stage list spans
      four, asserted one test per family. The `adhered` rung has no shipped
      observer, so the `adherence` family is reachable through the stage list and
      not yet from real evidence — a coverage gap named in 1.1 rather than
      counted here.
- [ ] AC-2 — A paired-verdict comparison between a metered proposer and the
      deterministic one has been run, and its result — in either direction —
      is recorded. Held by `metered-backend-park`.
<!-- AC-3 DISPOSITION 2026-09-01 (drain run 15): stays open, as a Phase-2
     SUCCESSOR obligation. Convergent 2/2. The reasoning, recorded because "no
     further code is needed to close it" reads like a completion claim and is
     not one: "'No further code is needed' establishes implementation
     completeness, not acceptance completeness. Its purpose half expressly
     requires one spent population, and none exists."
     And it is explicitly NOT transferred: "Do not transfer AC-3 merely to make
     this roadmap look cleaner. Transfer would require a named, valid
     destination that preserves the exact obligation and its evidence
     requirement; none is established. Keep it attached to the Phase 2 resume
     chain." When Phase 2 completes, AC-3 is the follow-on verification it
     triggers. -->
- [ ] AC-3 — `assertCheapestFirst` has at least one production caller, so the
      ordering it polices governs a real population rather than an empty one.
      **HALF MET 2026-09-01, and left `[ ]` on the half that is not.** The
      caller exists and is on the executable path: `proposeCandidatesWithModel`
      (declared `src/scripts/_lib/llm_candidate_proposer.ts:369`, calling
      `assertCheapestFirst` at `:417`) polices the attempts a run actually made,
      and `plannedAttempts` (declared `:429`, calling it at `:446`) polices the
      dry-run plan, which `llm_propose` reaches without spending (`:137`). Both
      pairs are the repaired citations — see step 2.2's CITATION REPAIR note;
      the declaration lines were previously cited as if they were the calls. The guard is also falsifiable now — an inconsistent resumed
      history is refused, and removing the call reds that case.
      **What is not met is the criterion's purpose clause.** The populations
      that exist today are the all-`lite` dry plan, in which no ordering
      decision arises, and test populations under a stubbed generator. Neither
      is a spent population, so the ordering has not yet governed one.
      **No further code is needed to close it** — Session B's first metered run
      produces the population, and the caller is already there to police it.
      Checking it now would be closing on the half that was already true, which
      is the failure this whole file was transferred to prevent.
      **RE-CONFIRMED 2026-09-02 (drain run 16) by running the dry path from a
      fresh checkout over the real corpus:** all five planned attempts came back
      `tier=lite`, so no ordering decision arose and the population is still not
      a spent one. That is the observation the criterion's purpose clause asks
      about, made rather than assumed, and it leaves the box exactly where it
      was.
- [ ] AC-4 — Programme success and failure criteria were committed before the
      first candidate run, and the run report carries an evolution-ROI figure.
      Transferred whole from `road-to-governed-harness-evolution` AC-8. Its
      shape half is met — `buildRunReport` refuses a report without the figure —
      and its subject half needs the run, which needs the park lifted. `[-]` on
      the source means TRANSFERRED, never met and never dropped.
