# Results — gated-reach

Run date **2026-07-25**. Thresholds and task sets were frozen in
[`README.md`](README.md) before any task ran; nothing below adjusts them.

Doctor snapshot: [`doctor-snapshot-run.json`](doctor-snapshot-run.json) —
`reddit ok`, `twitter-oembed ok`, `youtube missing`. Network class: **residential**.

`reach` = the prescription in [`docs/guides/gated-platform-reads.md`](../../../docs/guides/gated-platform-reads.md).
`native` = the host's own web tools (fetch + search), the control arm.

---

## `reddit` tier 1 — text (`.rss`)

| id | reach | native | Evidence |
|---|---|---|---|
| R1 | **pass** | fail | `r/rust/.rss` → 200, 25 entries, 3 newest titles + 3 `<updated>` timestamps |
| R2 | **pass** | fail | selftext from `<content>`, 1,549 chars |
| R3 | **pass** | fail | thread feed → **147 entries, 135 carrying `<author><name>`, 79 distinct authors** |
| R4 | **pass** | fail | second fetch of the same thread → 147 entries again (retry discipline, not luck) |
| R5 | **pass** | fail | non-existent subreddit → 0 entries, no fabricated listing |
| R6 | **pass** | fail | `user/<name>/.rss` → 25 entries attributed to that user |

**6/6 → ship.** Native fails all six by construction: the host tool refuses the
`reddit.com` domain outright (not a 403 from Reddit — a client-side refusal), so no
native path to any of this content exists.

Two numbers that look like a contradiction and are not: **147** is the entry count,
**135** is how many of those entries carry an author element. Both were re-measured
in the same fetch. The earlier session note recording "135 comments" was measuring
the author-bearing subset, not a different thread.

## `reddit` tier 2 — ranking + structure (`old.reddit` HTML + parser)

| id | reach | native | Evidence |
|---|---|---|---|
| S1 | **pass** | fail | top-voted comment: `@ShinyHappyREM`, score **175**, text present — score cross-checked against the rendered page (`175 points`) |
| S2 | **pass** | fail | `t1_onh8xqk` → parser **17**, page **17 points** |
| S3 | **pass** | fail | child d=1 `@ChemicalRascal` resolved to parent d=0 `@SourcerorSoupreme`; `child.depth == parent.depth + 1` |
| S4 | **pass** | fail | depth distribution `{0:35, 1:37, 2:31, 3:18, 4:5, 5:3, 6:5}` — **7 distinct depths** |
| S5 | **pass** | fail | exactly one null-score node (`t1_onflihe`); the page independently marks it `score-hidden`. Reported `null`, not `0`, not omitted |
| S6 | **pass** | fail | login-wall fixture → `login_wall: true`, `comments: []` — the documented degradation path, not a crash |

**6/6 → ship**, with the time-bound from the README attached: this tier is on an
announced closing path and ships with a kill-switch keyed on an *observed* login
wall.

Scores drift between fetches (**172** at fixture capture → **176** → **175** across
three reads of the same comment within one day). That is why the test fixture is
committed and pinned rather than fetched at test time, and why S1/S2 cross-check
against the *same* fetch's rendered HTML instead of a remembered number.

## `twitter-oembed`

**The pre-registered control rule fired, and it changed this channel's story.**

The first task set used the most-quoted tweets in existence (`jack/status/20`, a
famous Obama tweet). The native arm scored **5/6** on them — not by reading x.com
(that is a hard HTTP 402) but by finding the text in search results, because a
canonical tweet's text is reproduced everywhere. Per the control rule those five
tasks were **mis-scoped and were removed and replaced**.

Replacement tasks use five tweets nobody would call canonical, sourced from HN
comment/story links so that they are real URLs rather than invented ids:

| id | Task | reach | native | Evidence |
|---|---|---|---|---|
| T1′ | text + author, `samhenrigold/1964428927159382261` | **pass** | **pass** | reach: verbatim text + `author_name`. native: found the identical text via the author's **Threads and Mastodon cross-posts** |
| T2′ | date of `adamwathan/1233517884619546631` | **pass** | **fail** | reach: `February 28, 2020`. native: paraphrase only, no verbatim text, and it dated the tweet **"March 2020"** — wrong month |
| T3 | non-existent tweet id | **pass** | **fail** | reach: clean 404 (with `-f`: exit 56, 11 bytes). native: a missing tweet and a real tweet both answer **402**, so existence is indistinguishable |
| T4′ | two obscure tweets in sequence (`MushtaqBilalPhD`, `photonstorm`) | **pass** | **fail** | reach: both retrieved, no throttling. native: could not locate either — and said so rather than inventing |
| T5′ | `twitter.com` form URL | **pass** | fail | 200, `author_name: Richard Davey`, response `url` field normalised to the `x.com` form |
| T6′ | thread URL → parent only | **pass** | **pass** | reach: exactly **1** `<blockquote>`, no reply/thread field in the response — replies absent by construction. native: this tweet is a major news event, so search returned both the text and the x.com URL |

**reach 6/6 · native 2/6.**

### The honest limitation, stated rather than engineered away

The control rule says a native pass means the task was mis-scoped, so T1′ and T6′
should be replaced again. **They were not, and this is a bench limitation, not an
adjustment of the rule.** Every tweet-sourcing channel available to a host that
cannot read Twitter — HN links, Reddit links, search — *selects for tweets that
were discussed publicly elsewhere*, which is exactly the population native search
can recover. Sourcing a genuinely undiscussed tweet requires the Twitter access
this bench exists because we lack.

What that means for the verdict, plainly:

- The capability gap is **real but narrower than it looks**. `x.com` is closed to
  the host (402, always). But for a tweet that mattered enough for someone to
  quote, mirror, or report it, native search recovers the content without this
  channel.
- The channel's unique value is the case the maintainer actually hits: **a specific
  tweet URL in hand, whose content is not mirrored anywhere.** T2′ and T4′ are that
  case, and native failed all three of those reads — including one where it
  produced a **confidently wrong date**, which is worse than a miss.
- Verdict **ship (6/6)** stands on the pre-registered threshold. It is recorded
  here that two of the six were also reachable natively, so nobody later reads
  "6/6" as "six things only this channel can do".

## `youtube-transcripts`

**Parked — unexercised.** `yt-dlp` is absent on this machine and the package never
auto-installs (prescription-first, by contract). Per the README's unexercised rule
a channel that cannot be exercised cannot reach a ship verdict and is not scored as
a drop: an uninstalled tool is a fact about this machine, not about the channel.
Y1–Y5 were not run. Y6 (readiness detection with no JS runtime configured) is
testable without `yt-dlp` and is covered by the doctor's config-semantic check.

## Repair-rule ledger

One repair was used, within the "exactly once" budget, and both runs are recorded:

| What | Before | After |
|---|---|---|
| oEmbed prescription missing `-f` | a 404 answered **exit 0 + 3,663 bytes of HTML** — a caller reads success | **exit 56, 11 bytes** — an unambiguous signal |

Two prescription defects were found by executing the prescription verbatim rather
than by review, and both were fixed in the guide:

1. **`&mdash;` left undecoded** in the oEmbed text extractor — a single entity pass
   is not enough; the fix decodes until stable.
2. **`-L` silently required.** Dropping it makes `publish.twitter.com/oembed` answer
   **301 with an empty body** on all five test tweets, which reads as a dead
   endpoint. Now documented as load-bearing.

## Per-channel verdicts

| Channel | Tally | Verdict |
|---|---|---|
| `reddit` tier 1 | 6/6 | **ship** |
| `reddit` tier 2 | 6/6 | **ship** — time-bounded, kill-switch on observed login wall |
| `twitter-oembed` | 6/6 (native also passed 2) | **ship** — with the narrowed-gap caveat above |
| `youtube-transcripts` | not run | **park** — unexercised (tool absent by design) |

Verdicts are deliberately **not aggregated**: a failing channel drops alone, a
passing channel ships alone.
