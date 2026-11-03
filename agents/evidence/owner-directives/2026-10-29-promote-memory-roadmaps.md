<!-- evidence-type: analysis -->

# Owner directive — promote three memory roadmaps past the WIP cap

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-29 |
| Scope | three roadmaps parked in `agents/roadmaps/later/` by round `inbox-2026-10-bi` |
| Grants by itself | moving exactly these three roadmaps to the active estate above the five-roadmap WIP cap of the 2026-10-24 directive; nothing else |

The owner's words, verbatim, after OQ-32 to OQ-35 were answered:

> "ziehe die 3 von later in den normalen ordner, merge einen pr mit ihnen und dann können wir erst einmal den tree aufräumen und stoppen" <!-- md-language-check: ignore -->

("move the 3 from later into the normal folder, merge a PR with them, and then
we can clean up the tree and stop.")

The three roadmaps:

- `road-to-a-noted-that-is-a-write`
- `road-to-a-memory-each-worker-is-handed`
- `road-to-a-fill-the-session-sees-coming`

The active estate goes from 5 to 8. The cap itself is not changed: this record
names three roadmaps, so `check_estate_count` honours an `estate_offset_exempt`
above the cap only for them.
