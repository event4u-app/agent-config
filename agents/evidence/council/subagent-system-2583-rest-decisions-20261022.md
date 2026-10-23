<!-- evidence-type: analysis -->

# Three design decisions for the rest of #2583: reconstruct the reuse verdict, admit a keyless first-party route, verify the shadow deterministically

AI council, 2026-10-22. anthropic + openai seats, CLI, subscription-authed, USD 0.00, one round
each, 2/2 present in both runs. Prompts committed verbatim beside this file:
`subagent-system-2583-rest-decisions-20261022.question.md` (round 1, all three decisions) and
`subagent-system-2583-rest-decision2-r2-20261022.question.md` (round 2, decision 2 only, after
the split). Each prompt states the options and asks for a choice, the deciding facts, the
counter-condition and reversibility, with no expected answer. Raw responses:
`agents/runtime/council/responses/subagent-system-2583-rest-decisions-20261022.md` and
`…-decision2-r2-20261022.md` (local, gitignored).

**Standing:** all three are reversible technical decisions the run's delegation lets the
council take; none is owner-reserved.

## Verdicts

| Decision | anthropic | openai | Applied |
|---|---|---|---|
| 1 — can the reuse shadow see a reusable worker | (a) | (a) | (a) |
| 2 — keyless route, round 1 | (c) | (a) | split → round 2 |
| 2 — keyless route, round 2 | (a) | (a) | (a) |
| 3 — how the shadow verifies | (c) | (c) | (c) |

**1 (a).** `worker_resume` becomes a live probe on `claude` under
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`, the condition under which step 1.4 observed a by-name
re-task; the hook records only the precondition and join keys, and the 3.5 report reconstructs
the full verdict, labelled `reconstructed`. Deciding facts named by both seats: the dispatch
bundle had 1,113 B of headroom and conditions (b)–(h) need transcript, commit and package state;
option (c) guarantees a null window. Conditions carried (openai): record immutable references
at stop time, reject incomplete joins rather than classify them `fresh`, and run a positive
control that yields at least one `would_resume`. Counter-condition (both): the state a worker had
at its stop cannot be recovered at report time.

**2 (a), after a split.** Round 1: one seat refused the route (30 s per call; community models
weaken the training attestation; no verifiable billing class), the other admitted it
maintainer-only provided first-party models are enforced at run time and provenance is recorded
per call. Round 2 added four facts — the route's model list marks each model `community:
true|false` and lists one anonymous first-party model; the published sub-processor list; the
route takes no key so nothing can be billed and its HTTP 402 already maps to
`policy_unproven_cost`; only `public-artifact` content of a public repository is admissible —
and both seats chose (a). Distribution field `unknown`, never `permitted`: absence of a
prohibition is not evidence of permission. Residue both seats name: downstream retention is per
inference host and unstated; admission closes no acceptance criterion by itself.

**3 (c).** Deterministic, tree-derived verification on a manufactured public-artifact corpus,
plus a blind paid-head audit of a random 10 % per kind. Narrowed by the openai seat: only
`classify` and `extract` have genuine ground truth; `summarise-given-text` stays unmeasured,
because a keyword-inclusion check measures lexical overlap, not summary quality. Pre-register
corpus, seed, verifier version, threshold and disagreement policy; keep manufactured evidence
apart from organic traffic.

## Where each landed

- Decision 1: `src/scripts/_lib/host_capability.ts` (`probeHostCapabilities`, `describeHostCapabilities`),
  `src/scripts/hooks/spawn_guard_shadow_hook.ts` and `subagent_ledger_hook.ts` (`stateStamp`,
  `headOf`, index), `src/scripts/worker_reuse_shadow_report.ts` (reconstruction).
- Decision 2: `src/scripts/ai_council/free_route_catalog.ts` (`pollinations` row,
  `first_party_list`, discovery filter), `src/scripts/ai_council/route_member.ts`
  (`firstPartyGate`).
- Decision 3: `internal/bench/free-hands-shadow-PREREG.md`, `internal/bench/free-hands-shadow/`.

The live free-hands shadow did not run in this session: the host's permission classifier refused
sending repository content to the external route. The harness is built and tested against
loopback stubs; the live run is an owner action listed in the PR.
