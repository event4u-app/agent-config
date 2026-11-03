---
complexity: lightweight
status: later
estate_growth_exempt: "Fix-what-you-see disposition (feat/map-always-fresh, 2026-11-01): `check-reach-staleness` went red on the wall clock, not on that branch's diff, and the fix needs `yt-dlp` installed, which the agent may not do silently. +1 later_roadmaps; no active roadmap is added."
estate_offset_exempt: "rg -F 'reach-channels' and 'last_verified' over agents/roadmaps found no roadmap owning the reach channel verification dates, so nothing absorbs this item. Parking it in later/ rather than active keeps the active estate unchanged."
review_by: 2026-11-15
entry_condition:
  what: "yt-dlp installed on a maintainer machine (pipx install yt-dlp==2026.7.4)"
  when: "before the next PR that must pass `task ci` on the wall clock"
  who: owner
---
# Road to a re-verified youtube channel

> Observed during `feat/map-always-fresh` (2026-11-01), `task ci`
> step `check-reach-staleness`.
> **Arrivals:** 4 — latest `analysis/inbox-2026-11-l` (2026-11-02): still 101 days
> old, `yt-dlp` still absent; earlier: `analysis/inbox-2026-11-k`,
> `analysis/inbox-2026-11-f`, `feat/map-always-fresh`.
>
> **Decided 2026-11-02** (AI council, owner-delegated, decision D2): option 1.
> The channel stays `experimental` and is **not** exempted or retired — a missing
> verifier is an evidence gap, not proof the channel is useless. `last_verified`
> moves only after a successful `reach:doctor --deep`. Until then the local gate
> stays red by design. Revisit-if: the deep check fails, or the yt-dlp path stops
> being viable — then retire with that evidence.

## Defect

`src/config/reach-channels.yml` → `channels[youtube].last_verified` is
`2026-07-24`, 100 days old on 2026-11-01, over the 90-day floor. The gate reads
the wall clock, so it is red on `main` and on every branch, regardless of diff.

## Evidence

```
❌  src/config/reach-channels.yml: 1 staleness violation(s):
  - [stale-verification] channels[youtube]: `last_verified` is 100 days old (2026-07-24), over the 90-day floor
```

`./agent-config reach:doctor --deep` on the observing machine:
`'yt-dlp' does not resolve on PATH` — the channel cannot be re-verified there,
and bumping the date without a run would be a fabricated verification.

## Closes when

- [ ] `yt-dlp` installed per the channel's pinned prescription
- [ ] `./agent-config reach:doctor --deep` reports the youtube channel ready
- [ ] `last_verified` updated to the run date — or the channel retired
- [ ] `task check-reach-staleness` green without `AC_AS_OF`
