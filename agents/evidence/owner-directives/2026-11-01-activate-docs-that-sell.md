<!-- evidence-type: analysis -->

# Owner directive — activate road-to-docs-that-sell past the WIP cap

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-11-01 |
| Scope | `road-to-docs-that-sell`, parked in `agents/roadmaps/later/` because all active slots were taken |
| Grants by itself | moving exactly this roadmap to the active estate above the five-roadmap WIP cap of the 2026-10-24 directive; nothing else |

The owner's words, verbatim. The original request that produced the roadmap:

> "Plane daraus eine bestehende Roadmap für AC, in einem Workingtree. Allgemein sollten wir die Readme und ALLE Dokumentationen überarbeiten. Vor allem aber auch die starlight doku." <!-- md-language-check: ignore -->

("Plan a roadmap for AC from this, in a worktree. In general we should rework
the README and ALL documentation — above all the Starlight docs as well.")

And, after the roadmap was parked with this record named as its promotion path
in its `entry_condition`:

> "erstelle den owner-directive record für die Aktivierung" <!-- md-language-check: ignore -->

("create the owner-directive record for the activation.")

The estate gate refuses an owner record written in the same change as the
activation, so this record lands first; the activation is a later change that
moves the file out of `later/` and cites this record in its
`estate_offset_exempt` reason.

The roadmap:

- `road-to-docs-that-sell`

The cap itself is not changed: this record names one roadmap, so
`check_estate_count` honours an `estate_offset_exempt` above the cap only for it.

## Undo

Park the roadmap again (`agents/roadmaps/later/`); this record then grants nothing.
