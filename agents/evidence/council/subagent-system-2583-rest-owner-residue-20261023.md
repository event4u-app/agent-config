<!-- evidence-type: analysis -->

# Owner residue of PR #2588: what the council settled and what reached the owner

AI council, 2026-10-23. anthropic + openai seats, CLI, subscription-authed, USD 0.00, one round
each, 2/2 present in both runs. Prompts committed verbatim beside this file:
`subagent-system-2583-rest-owner-residue-20261023.question.md` and
`subagent-system-2583-rest-served-id-20261023.question.md`. The raw responses are gitignored and
pruned after the retention window, so each is pinned here by its SHA-256.

| Run | Response file (`agents/runtime/council/responses/`) | SHA-256 |
|---|---|---|
| owner residue | `subagent-system-2583-rest-owner-residue-20261023.md` | `a915d78217ed8e554daa1dcb92e5a92ea6b5866c8ca4151df9ed307a418ae475` |
| served id | `subagent-system-2583-rest-served-id-20261023.md` | `1b1365342156ebdcef7bbdef1aad964df2c62aabd6e8476e3a88e4bc56627985` |

## Verdicts

| Item | anthropic | openai | Routed to | Outcome |
|---|---|---|---|---|
| A — blocker `delegated-owner-defaults` | (a), owner-reserved | (a), council-decidable | owner (split on routing) | owner chose (a); tick roadmap A8 |
| B — hook dispatch bundle ceiling | (3) lazy chunk, council-decidable | (3) lazy chunk, council-decidable | council | no speculative raise; the 2.4 carrier is a chunk, and only a measured loader stub may raise the dispatch ceiling, with its own ratification; tick roadmap A9 |
| C — `ask_transport` | (1) maintainer-only, council-decidable | (1) maintainer-only, council-decidable | council | maintainer tooling; the nudge stops citing it outside this repository's checkout; free-hands A15. Option (2), a consumer command, would be owner-reserved |
| Served id of a keyless route | (2) accept a declared alias | (1) probe once, keep the exact match | owner (split) | owner chose (1); free-hands A16 |

Two items did not go to the council. Condition (c) of the worker-reuse decision had already split
1:1 in two rounds (`subagent-system-2583-rest-condition-c-20261023.md`); a third round on the same
evidence would have been verdict shopping, so it went to the owner, who kept (c) pending a later
window (cold-start D15). The live shadow run sends repository content to an external route, an
egress decision, so it went to the owner directly; the owner approved it after a payload audit
(666 payloads at `44493165`, 0 secret findings, no personal or internal data beyond the public
GitHub handle in one frontmatter line). The `StopFailure` binding needed no decision: it was
already present in the owner's user settings.
