<!-- evidence-type: analysis -->

# Three owner blockers: admit free routes, keep them public-artifact, keep tokens

AI council, 2026-10-22. anthropic + openai seats, CLI, subscription-authed, one round, 2/2
present. The prompt is committed verbatim beside this file as
`subagent-system-2583-owner-blockers-20261022.question.md`; it states the options and asks for
a choice, the deciding facts, the counter-condition and reversibility, with no expected
answer. Raw response: `agents/runtime/council/responses/subagent-system-2583-owner-blockers-20261022.md`
(local, gitignored). For `road-to-free-hands-a-paid-head-checks` (blockers
`free-route-admission`, `project-content-ceiling`) and `road-to-a-tier-the-dispatch-carries`
(blocker `realistic-fakes-for-hands`).

**Standing:** these three blockers are owner-reserved. The run that asked was delegated to
take the council's answer as the default where the choice is reversible and to list it for the
owner; every row below is therefore a council recommendation applied as a default, not an
owner decision, and the owner may overturn any of them in review.

**Bound:** the openai seat reported that it could not read the three roadmap files and
answered from the prompt's own statement of the options; the anthropic seat cited the files.

## Verdict — convergent on every blocker

| Blocker | anthropic | openai | Reversible (both seats) |
|---|---|---|---|
| `free-route-admission` | (a) | (a) | partially — config can be withdrawn; a payload already sent cannot |
| `project-content-ceiling` | (b) | (b) | yes — the stricter ceiling discloses nothing |
| `realistic-fakes-for-hands` | (a) | (a) | yes |

- **Admission (a).** ADR-257 already confines an unpaid route to proposing and scoring; the
  USD 0.00 class, the 2,000-call shadow cap and the termination rules bound the experiment;
  (b) produces no evidence. Both seats name the residue: disclosure is not reversible, so
  fragmentation, egress classification and correlation controls must hold **before the first
  call** (openai), and Phase 6's termination must include privacy or correlation, not only
  availability (anthropic).
- **Ceiling (b).** The owner's directive limits free endpoints to work that "does not touch
  data protection"; a dated attestation is documentary, not enforcement; one uniform ceiling is
  easier to audit and fits the owner's distribution rationale. Counter-condition (both): a
  narrowed definition of `project-content` plus an independently validated fail-closed egress
  path and continuously refreshed provider assurance.
- **Fakes (a).** Tokens leak the least and the pre-registered comparison measures whether they
  cost quality before any transformation is added. Counter-condition: the T5 comparison crosses
  5 pp **and** a privacy review shows fakes are generated independently of source values.

## What the run does with it

1. `free-route-admission` → (a): Phases 2-7 are built. Live free calls carry
   `public-artifact` payloads only (consequence of the ceiling row).
2. `project-content-ceiling` → (b): no free route is raised above `public-artifact`; step 2.5's
   self-hosted loopback route is not a free route and keeps its own probe gate.
3. `realistic-fakes-for-hands` → (a): values keep leaving as `__TYPE_n_fp__` tokens; the line is
   recorded in both roadmaps (tier 4.4).
