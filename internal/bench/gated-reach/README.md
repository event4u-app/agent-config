# Bench: gated-reach

Pre-registration for the **reliability** question on platforms the host's own web
tools cannot fetch at all. Everything in this file is committed **before** the run
and is not adjusted afterwards.

This is not the parent bench's question. `internal/bench/reach-vs-native/` asked
*"does a prescription layer beat native web tools on general dev research"* and
answered no (`band: stop`, 0/12). Here the capability gap is already established —
the native arm cannot reach these platforms at all — so the measured question is
whether the prescriptions are **reliable enough to justify their maintenance
weight**, per channel.

## Step 1 — Platform facts, re-verified 2026-07-25

Method: `curl -sSL --retry 8 --retry-max-time 110` with a desktop browser
user-agent, from a residential network, each fetch measured after completion (not
in a shell substitution that evaluates before the request — a trap that produced a
vacuous pass on the first attempt).

| Fact | Command | Observed |
|---|---|---|
| (a) subreddit Atom feed | `GET reddit.com/r/rust/.rss` | **200**, 53,825 bytes, **25 entries** |
| (b) thread comments feed | `GET reddit.com/r/programming/comments/1tlh5aj/.rss` | **200**, 129,280 bytes, **147 entries** |
| (c) old.reddit thread HTML, logged out | `GET old.reddit.com/r/programming/comments/1tlh5aj/` | **200**, 532,295 bytes, **134 comments**, 133 scores, no login wall |
| (d) Twitter oEmbed | `GET publish.twitter.com/oembed?url=…/jack/status/20` | **200**, 630 bytes, `author_name=jack`, tweet text present |

**Correction to fact (c), made during Phase 1 and recorded rather than
overwritten.** The first pass reported "135 comment nodes" from a raw
`thing_t1_…` match count. Re-measured precisely: **135 occurrences, 134 distinct
ids** — id `t1_onflihe` appears twice, once as the real stickied score-hidden
comment and once as a `data-type="morechildren"` stub reusing it. The true comment
count is **134**, which is what the parser emits. The parser author measured 134
independently and pinned that; the host's 135 was the error, and the discrepancy
was resolved by measurement, not by preferring either number.

Facts recorded earlier in the same session and unchanged: Reddit `.json` is 403
across `www` and `old` and three user-agent variants (identical 189,908-byte block
page — not user-agent driven); `cdn.syndication.twimg.com/tweet-result` answers 200
with an empty body; a caption-track URL scraped from a YouTube watch page answers
200 with 0 bytes.

**Standing external fact that bounds tier 2.** Reddit announced a login
requirement for `old.reddit.com` on 2026-06-30, rolling out "over the next month",
naming logged-out access as a scraping vector, and stated it can no longer promise
the interface will remain. Fact (c) shows the rollout had **not** reached this
machine on 2026-07-25. Tier 2 is therefore shipped as real-but-time-bounded, with
the kill-switch in Phase 3 Step 4 keyed on an **observed** login wall.

## Step 2 — Reddit depth decision (answered by the maintainer)

**Ranking and thread structure are the goal**, not a follow-up. Two things follow.

**The two-tier contract.**

| Tier | Surface | Gives | Durability |
|---|---|---|---|
| 1 | `reddit.com/…/.rss` | post + comment **text**, author, timestamp | durable — no announced change |
| 2 | `old.reddit.com/<permalink>` HTML | **scores + reply nesting** + the full comment set | announced-closing; kill-switch on observed login wall |

Degradation from tier 2 to tier 1 is a **documented outcome, not a bug**. A login
wall must produce "ranking is unavailable" — never unranked text presented as
ranked.

**The successor decision — deliberately recorded as OPEN, with its trigger.** The
maintainer chose the goal; they have not chosen the successor, and the trigger has
not fired (fact (c) above). Recording a choice they did not make would be worse
than recording that it is open. When an observed login wall retires tier 2, one of
these three is chosen **then**, and the point of writing them now is that the
options and their costs are already on paper:

1. **Accept text-only.** Tier 1 continues; ranking is lost. Zero new surface.
2. **Human-exported session cookie** for logged-in `old.reddit` HTML. Restores the
   full capability with the same parser. Costs: a consent gate, a `chmod 600`
   credential file declared as `credential_path`, account-ban risk, and
   credentials sitting beside untrusted content — the risk the design council
   named as the sharpest in this whole area.
3. **Approved API access.** The durable path. Approval-only since Nov 2025, weeks
   of latency, high rejection rates for individual developers — so it is either
   started *before* it is needed or not at all.

Host recommendation, for the record: start (3) opportunistically at any time since
its cost is waiting rather than risk, run (1) as the automatic fallback the moment
tier 2 dies, and treat (2) as the deliberate escalation only if ranking turns out
to be load-bearing in practice.

## Step 3 — Latency decision

Reddit rate-limits bursts hard. Measured: **2/6** at one request per 10 s with no
retry; **5/5** with `curl --retry 8 --retry-max-time 110` (curl's own exponential
backoff, which treats 429 as retryable), elapsed **9–65 s**.

**Decision: prefer a slow success over a fast failure.** A read may take up to
~65 s. Recorded alternative, rejected: fail fast at ~8 s and accept a measured
~2/6 success rate — unusable for the maintainer's stated purpose (opening
resources they currently cannot read at all).

The prescription states the worst case explicitly so a caller is never surprised
by a slow read.

## Step 4 — Pre-registration (thresholds frozen)

**Task sets: 6 tasks per channel**, each with pre-declared acceptance evidence and
a **native-arm control**.

**Control rule.** Any task the native arm passes is *removed and replaced* — it was
mis-scoped into a gated set — and the replacement is logged. (The native arm is
expected to fail every task here; that is the premise, and the control exists to
falsify it rather than assume it.)

**Thresholds, per channel — verdicts are never aggregated.** The parent's single
band was right for one router making one claim; it is wrong for independent
prescriptions. A failing channel drops alone; a passing channel ships alone.

| Tally | Verdict | Consequence |
|---|---|---|
| ≥5/6 | **ship** | prescription + skill trigger |
| 3–4/6 | **park** | registry + prescription only, no skill trigger |
| ≤2/6 | **drop** | published null, entry removed or given a `removal_after` |

**Repair rule.** A task failing for *prescription-defect* reasons may be repaired
and re-run **exactly once**, with both runs recorded. The parent forbade re-runs
because ties were native wins there and a repair could manufacture a win; under a
reliability rule no tie exists, so one documented repair is honest — and unlimited
repair would be threshold shopping.

**Unexercised rule.** A channel whose backend cannot be exercised at all (absent
tool, human install required) cannot reach a ship verdict. It is **parked** with
that reason, never silently counted as a pass and never scored as a drop — an
uninstalled tool is a fact about this machine, not about the channel.

### Task sets

**`reddit` tier 1 — text (`.rss`)**

| id | Task | Acceptance evidence |
|---|---|---|
| R1 | Titles + dates of the 3 newest posts in a named subreddit | 3 titles AND 3 timestamps |
| R2 | Selftext of a named text post | the post body, ≥1 distinct sentence from it |
| R3 | Comment bodies of a named thread with ≥3 comments | ≥3 comment texts AND their authors |
| R4 | Same thread, second fetch after the first | same comment set retrieved again (retry discipline works, not luck) |
| R5 | A subreddit that does not exist | a clean "not found / empty", never a fabricated listing |
| R6 | A named user's recent submissions | ≥2 titles attributed to that user |

**`reddit` tier 2 — ranking + structure (`old.reddit` HTML + parser)**

| id | Task | Acceptance evidence |
|---|---|---|
| S1 | The top-voted comment of a named thread | that comment's author, its score, and its text |
| S2 | The score of a named comment | a number matching the rendered page |
| S3 | One nested reply resolved to its parent | child text + parent text, correctly paired |
| S4 | Depth distribution of a thread | at least two distinct depths reported |
| S5 | A comment with no visible score | reported as `null`, not `0` and not omitted |
| S6 | A thread fetched behind a simulated login wall (fixture) | explicit "ranking unavailable" + tier-1 fallback offered |

**`twitter-oembed`**

| id | Task | Acceptance evidence |
|---|---|---|
| T1 | Text + author of a named tweet | both, verbatim text |
| T2 | Date of the same tweet | a date |
| T3 | A non-existent tweet id | clean 404 handling, never invented content |
| T4 | Two different tweets in sequence | both retrieved, no throttling failure |
| T5 | A tweet URL given in `twitter.com` form | works (host normalisation) |
| T6 | A thread URL (parent tweet only is expected) | the parent tweet's text AND an explicit statement that replies are not available |

**`youtube-transcripts`** — task set written but **not runnable on this machine**:
`yt-dlp` is absent and the package never auto-installs (prescription-first). Per
the unexercised rule this channel is parked, not scored.

| id | Task | Acceptance evidence |
|---|---|---|
| Y1 | Subtitle track of a named public video | transcript text, ≥1 verbatim line |
| Y2 | Auto-caption of a video without manual subs | text, with the documented dedup applied |
| Y3 | Metadata dump of a named video | title AND duration |
| Y4 | Search returning ≥3 results | 3 video titles + ids |
| Y5 | A video with no caption track | explicit "no caption track", never a hallucinated transcript |
| Y6 | Readiness detection with a JS runtime unconfigured | doctor reports not-ready with the idempotent fix command |

## Step 5 — Environment declaration

| Property | Value |
|---|---|
| Host | darwin 24.6.0, node v25.9.0, curl 8.7.1, ffmpeg 8.1.1 |
| Absent | `yt-dlp`, `deno`, `pipx` (human-installed by contract) |
| Network class | **residential** — load-bearing: these platforms discriminate by network reputation, and a datacenter IP is expected to score worse |
| Doctor snapshot | `./agent-config reach:doctor --format json` captured before each channel's run, committed next to the results |
| CI | explicitly **not** a bench environment (`--deep` refuses there for the same reason) |

Every result row carries: outcome, token estimate, doctor-snapshot reference,
network class, and — for a repaired task — both runs.
