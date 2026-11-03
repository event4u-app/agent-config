<!-- evidence-type: analysis -->

# Owner directive — activate the observation provider slot past the WIP cap

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-29 |
| Scope | `road-to-an-observation-provider-slot`, parked in `agents/roadmaps/later/` for OQ-36 |
| Grants by itself | moving exactly this roadmap to the active estate above the five-roadmap WIP cap of the 2026-10-24 directive; nothing else |

The owner's words, verbatim, after the roadmap had been parked because all
active slots were taken:

> "sie kann schon mal rüber zu den aktiven und mit einem pr gemerged werden, damit wir hier aufräumen können und der tree weg" <!-- md-language-check: ignore -->

("it can already move over to the active ones and be merged with a PR, so we
can clean up here and the worktree goes away.")

Asked how to pass the estate gate, which refuses an owner record written in
the same change, the owner chose this record as its own PR, merged before the
activation.

The roadmap:

- `road-to-an-observation-provider-slot`

The cap itself is not changed: this record names one roadmap, so
`check_estate_count` honours an `estate_offset_exempt` above the cap only for it.

## Undo

Park the roadmap again (`agents/roadmaps/later/`); this record then grants nothing.
