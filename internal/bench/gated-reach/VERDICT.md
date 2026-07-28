band: per-channel

# Verdict — gated-reach (2026-07-25)

Thresholds frozen in [`README.md`](README.md) before the run: **≥5/6 ship · 3–4/6
park · ≤2/6 drop**. Rows and evidence: [`results.md`](results.md). Doctor snapshot:
[`doctor-snapshot-run.json`](doctor-snapshot-run.json). Network class: residential.

**Verdicts are per channel and are never aggregated.** There is deliberately no
overall band on this bench: the parent's single band was right for one router making
one claim, and wrong for four independent prescriptions. A failing channel drops
alone; a passing channel ships alone.

| Channel | reach | native | Verdict | Bound attached to it |
|---|---|---|---|---|
| `reddit` tier 1 (Atom text) | 6/6 | 0/6 | **ship** | none — durable surface, no announced change |
| `reddit` tier 2 (ranking + structure) | 6/6 | 0/6 | **ship** | time-bounded; kill-switch on an **observed** login wall |
| `twitter-oembed` | 6/6 | 2/6 | **ship** | gap is narrower than 6/6 suggests — see `results.md` § honest limitation |
| `youtube-transcripts` | not run | — | **park** | unexercised: backend absent, human install by contract |

## Kill-switch criteria

Retirement is a **registry edit plus an [`internal/upstream-changes.md`](../../upstream-changes.md)
entry** — never a silent degradation, and never a quiet drop in reliability that a
caller discovers by getting worse answers.

### `reddit` tier 2 — the one criterion already known

**Retire on:** a login wall, or a redirect to login, on the `old.reddit` permalink
fetch. That is an *observed* event on a real fetch — HTTP status, a login form in the
body, or the parser reporting `login_wall: true`.

When it fires, all four in the same commit:

1. the registry entry for the tier-2 backend is edited (not deleted silently);
2. the channel **degrades to tier-1 text**, which keeps working;
3. the **ranking claim is struck** from
   [`docs/guides/gated-platform-reads.md`](../../../docs/guides/gated-platform-reads.md)
   — a prescription that promises scores after scores stopped arriving is worse than
   no prescription;
4. the successor decision recorded in `README.md` § Step 2 fires (accept text-only /
   human-exported session cookie / approved API), chosen **then**, by the maintainer.

**Reverse trigger — equally binding.** If logged-out access is still working at the
next staleness check, `last_verified` moves forward and **tier 2 stays**. An announced
closure is not an observed one. This bench does not retire a working capability on a
press release, and an agent that reads the 2026-06-30 announcement in this repo's
history must not pre-emptively strike the tier.

### `reddit` tier 1

**Retire on:** the Atom endpoint answering non-200 (or an empty entry set on a thread
known to have comments) across two staleness checks. One failure is a rate-limit or an
outage; two is a surface change. Note that a **403 pattern matching the `.json` block
page** is the specific shape to watch — `.json` was closed exactly that way.

### `twitter-oembed`

**Retire on:** `publish.twitter.com/oembed` answering non-200 for a tweet confirmed
public by another route, or beginning to require a key. There is **no fallback** for
this channel: `cdn.syndication.twimg.com/tweet-result` was measured dead (200, empty
body), so retirement means the capability is gone, not degraded. Say that plainly
rather than substituting a search result and calling it a tweet read.

### `youtube-transcripts`

**Retire on:** the pinned `yt-dlp` version failing extraction against a video with a
known caption track, where bumping the pin does not fix it. Distinguish this from the
`missing` and `not-ready` states, which are facts about the local machine — neither is
a reason to retire a channel.

## What this verdict does not claim

- **Not durability.** All four surfaces are undocumented or explicitly at-will, and
  three of the four have already changed behaviour within the last year. A ship verdict
  says "reliable on 2026-07-25 from a residential network", not "stable".
- **Not network-independence.** Residential IP is load-bearing: these platforms
  discriminate by network reputation, and a datacenter IP is expected to score worse.
  CI is explicitly not a bench environment for this reason.
- **Not a capability ranking against the host.** The native arm's 0/6 on Reddit is a
  domain refusal by the host's own tooling, not a statement about its web tools'
  quality.
