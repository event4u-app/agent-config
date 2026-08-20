## Acceptance criteria (anti-dump — the review's own rule)

- [x] **Net-negative surface:** the diff removes/retires more surface than it
      adds; the proactive suggestion-eligible count strictly drops.
      <!-- verified 2026-07-28 by counting frontmatter across all 191
      `src/domains/**/command.md`: `suggestion.eligible: true` = **53**, false =
      138, absent = 0. Baseline in § Context was 160 eligible of 190, so the
      proactive surface dropped 160 → 53 (-67%), landing exactly on the Phase-1
      exit target of ~53. The Phase-1 invariant is total, not partial: of 130
      cluster sub-commands (`sub:` set), **0 remain eligible**; the 53 eligible
      are all heads/standalone entry points (61 of those exist, 8 are
      additionally ineligible). Nothing was added to offset the reduction — the
      complexity budget went into an existing guideline and the restraint
      decisions into a context note, both net-zero. -->
- [x] **No new mechanism without naming what it retires:** the complexity-budget
      folds into an existing rule; no new lint/rule/command/hook is created.
      <!-- verified 2026-07-28: the complexity-budget checklist lives in the
      EXISTING `docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md`
      (§ Complexity budget), and the restraint decisions in the EXISTING context
      dir as `agents/settings/contexts/surface-consolidation-restraint.md` — a
      note, not a rule. No new lint script, rule file, command, or hook is
      attributable to this roadmap.
      STATED RATHER THAN GLOSSED: a `git log --diff-filter=A` sweep over
      `src/rules/`, `src/scripts/lint_*` and `src/scripts/hooks/` in the
      Phase-1/2 window returns exactly one added rule, `src/rules/secret-vcs-guard.md`.
      That belongs to the secret-hygiene guardrail roadmap (rule-first + CI net,
      commit-hook cut), not to this one — the window overlaps, the authorship
      does not. -->
- [x] **Demote, not delete:** every affected command/skill remains fully
      invokable; only suggestion-eligibility (and, for learning-tutor,
      proactive surfacing) is retired.
      <!-- verified 2026-07-28 two ways. (1) Nothing was deleted: 191 source
      `command.md` files and 191 command artefacts in
      `dist/discovery/discovery-manifest.json` — the § Context baseline was 190,
      so the count GREW by one over the window. (2) Invokability spot-checked on
      five de-eligibled cluster sub-commands across five different clusters —
      `tdd-green`, `feature-plan`, `roadmap-process-step`, `brand-tokens`,
      `analyze-decision`: `./agent-config commands explain <slug>` resolves for
      all five. Note the eligibility flag is frontmatter-only and is NOT carried
      in the discovery manifest, so it cannot affect resolution by construction —
      the CLI check is the real evidence, a manifest field check would have been
      vacuous. -->
- [x] The Unified Verification Router is NOT built here (deferred blocker).
      <!-- verified 2026-07-28: a case-insensitive sweep for
      "unified verification router" across `src/` and `docs/contracts/` returns
      no implementation — only the defer/CUT records in this roadmap's gap-table
      and council notes, plus the `benchmark-spend` blocker that gates its
      re-opening. No seventh entry point, no forwarding shim. -->
- [x] Every gated item (launch, branch protection, external session,
      utilization removal, benchmarks) is a `## Blockers` entry, not a step.
      <!-- verified 2026-07-28 — all five map onto the three blockers below:
      launch → `launch-and-adoption`; external session → `launch-and-adoption`;
      branch protection → `repo-admin-and-usage`; utilization removal →
      `repo-admin-and-usage`; benchmarks → `benchmark-spend` (which also gates
      the verification-router re-open).
      ONE NUANCE, recorded rather than smoothed over: Phase 3 IS a step, and its
      subject is utilization-driven disposition. It was re-homed here verbatim
      on 2026-07-28 from an archiving sibling roadmap, and its own header ties
      it to `repo-admin-and-usage`. So the gated WORK is tracked by a blocker as
      this criterion requires; it additionally carries a step so the re-homed
      item stays visible on the dashboard instead of vanishing into a blocker.
      Live check of that gate: branch protection is confirmed OFF
      (`gh api .../branches/main/protection` → 404) and the utilization window
      does not elapse until ~2026-08-26, so the step is correctly still open. -->
