# VERDICT — reach-vs-native, run-2026-07-24

```
band: stop
```

## Tally against the pre-registered rule

**S0a — reach outright wins: 0 of 12.** The `native` arm passed **12/12**
tasks. Under the pre-registered rule ("reach wins outright iff native
fails or returns materially weaker evidence; **ties are native wins**"),
a zero-failure native arm makes an outright reach win arithmetically
impossible. Band `0–2` → **`stop`**.

| Outcome class | Count | Tasks |
|---|---|---|
| reach outright win | **0** | — |
| both arms passed (tie → native) | 8 | T01, T05, T06, T08, T09, T10, T11, T12 |
| native only (reach failed or had no backend) | 4 | T02, T07 (reach fail) · T03, T04 (reach `no-backend`) |
| untested (cannot count) | 1 channel | `youtube` — `yt-dlp` absent |

## Per-channel S0a / S0b

| Channel | Tasks | S0a (outright wins) | S0b (reach tokens ÷ native, both-pass tasks) | Verdict |
|---|---|---|---|---|
| `web-read` | T01, T02 | 0 | 0.80× | S0b pass, S0a fail |
| `web-search` | T03, T04 | 0 | n/a — no backend by design | out |
| `github` | T05–T07 | 0 | 0.26× | S0b pass, S0a fail |
| `rss` | T08, T09 | 0 | 0.93× | S0b pass, S0a fail |
| `hackernews` | T10, T11 | 0 | 0.31× | S0b pass, S0a fail |
| mixed | T12 | 0 | 0.67× | S0b pass, S0a fail |
| `youtube` | — | untested | untested | untested |

**Aggregate S0b on the 8 both-pass tasks: 3,070 reach tokens vs 6,730
native tokens = 0.46×** — comfortably inside the ≤1.5× guardrail.

## Scope sentence (would-be Phase 4 input, copy verbatim)

> No router skill ships. The pre-registered benchmark returned zero
> outright wins for the reach arm; the host's own web tools solved every
> credential-free dev-research task in the set.

## The verdict is robust to the two reach-arm defects

Two reach failures were **prescription-quality defects**, not channel
limits: `web-read.sh` hard-slices its excerpt at 400 characters (T02
returned only a badge block), and `github.sh`'s jq projection drops
`.body` (T07 could not ground a breaking-change answer). Repairing both
and re-running **cannot change the band**: the native arm passed those
same tasks, so a repaired reach arm would score a *tie*, and ties are
native wins by the pre-registered rule. Zero native failures ⇒ zero
possible reach wins, regardless of prescription quality. The defects are
therefore recorded, not fixed-and-re-run — re-running after seeing the
result is exactly the post-hoc adjustment the pre-registration exists to
forbid.

## Honest limitation of this task set (does NOT change the band)

The task set required every task to be answerable **without
credentials** — a deliberate reproducibility constraint. That constraint
structurally excluded the two cases where a reach advantage was
hypothesized up front:

- **Video subtitles** — the backend (`yt-dlp`) is absent and installing
  it is human-performed by design, so the channel is `untested`. Scoring
  a page-scrape stand-in as a subtitle capability would have rigged the
  arm.
- **Authenticated / rate-limited platform access** — 403/auth-wall paths
  cannot appear in a credential-free set at all.

So the correct reading of this null is narrow and specific: **on
public, credential-free dev-research tasks, a reach prescription layer
buys no capability the host does not already have.** It says nothing
about gated-platform access, which this run could not measure. A future
roadmap that wants to test the gated case must pre-register a
credentialed task set and its own thresholds — not reuse this one's.

## Unregistered observation — cost, not capability

Recorded separately and explicitly **outside** the pre-registered
decision, because S0b was authored as a cost *guardrail* (≤1.5×), never
as a win condition, and moving it into one after seeing the data would be
the same rigging the bands exist to prevent:

On every task both arms solved, the reach prescription was **cheaper** —
aggregate 0.46×, with the largest gaps on `github` (0.26×: one `gh api`
call vs a rendered page plus a second fetch for an ISO timestamp) and
`hackernews` (0.31×: one API call vs a failed search, an empty SPA shell,
and a 429). The native arm's cost came from *discovery overhead*: it
repeatedly had to find the machine-readable endpoint the prescription
already knows.

This is a real, measured signal — and it is **not** what this benchmark
was designed to decide. Anyone acting on it must pre-register a
cost-primary benchmark (equal-evidence tasks, token cost as the primary
metric, a stated minimum saving worth the maintenance burden) and publish
that separately. Until then the shipped position is the band above:
`stop`.

## Consequences applied (roadmap Phase 0c Step 12)

- Phases 4 (router skill), 5 (gated-platform prescriptions) and 6
  (adversarial + shipped-skill verdict) are **cancelled** — marked `[-]`
  in the roadmap with this verdict as the inline reason.
- Phases 1 (registry + schema), 2 (probe engine + `reach:doctor`) and 3
  (prescription validation gate) continue, **re-scoped as standalone
  operator tooling**: they answer "is the upstream tool I already chose
  to install healthy, and is its install command pinned?" — a question
  that stands on its own and does not depend on a router existing.
- Phase 7 continues, minus the skill-dependent comparison row.
- The band is **not** renegotiated.
