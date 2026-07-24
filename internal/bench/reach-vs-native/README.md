# Bench: reach-vs-native

Decides the **default scope** of the `internet-reach` capability area
before the router skill is authored. Two arms, one question: does a reach
prescription beat the host's own web tools on a dev-research task, and at
what token cost?

Everything in this file — tasks, thresholds, bands, protocol — is
**pre-registered**. It is committed before the run and is not adjusted
afterwards. A post-hoc threshold is not a threshold.

## Arms

| Arm | What it may use |
|---|---|
| `native` | The host's own web-search / web-fetch tools **only**. No shell, no third-party CLI. |
| `reach` | The prototype prescriptions in `agents/runtime/tmp/reach-proto/` (gitignored scratch): `web-read.sh`, `github.sh`, `rss.sh`, `hackernews.sh`. Plus `web-search.sh`, which by design declares "host-native only". |

## Tasks (12)

Every task is answerable from public endpoints with **no credentials**.
`Acceptance evidence` is what a correct answer must contain; an answer
missing it is a failure for that arm regardless of prose quality.

| id | Channel | Question | Acceptance evidence |
|---|---|---|---|
| `T01` | web-read | What is the exact `<title>` of `https://example.com`, and roughly how much body text does the page carry? | The literal title `Example Domain` **and** a character/word count of the extracted text. |
| `T02` | web-read | From `https://raw.githubusercontent.com/yt-dlp/yt-dlp/master/README.md`, name the first top-level heading and one documented installation method. | The first `#` heading text **and** one install method quoted from the file. |
| `T03` | web-search | Which HTTP status code does an origin return to signal "too many requests", and name one public source stating it. | `429` **and** a resolvable source URL. |
| `T04` | web-search | Name the current stable major version of Node.js and cite where the claim comes from. | A version number **and** a resolvable source URL. |
| `T05` | github | What is the latest release tag of `yt-dlp/yt-dlp` and its publication timestamp? | The exact tag string **and** an ISO timestamp. |
| `T06` | github | List the titles of up to 5 currently open issues in `yt-dlp/yt-dlp` with their issue numbers. | ≥ 3 `#number` + title pairs. |
| `T07` | github | For `simonw/llm`, what is the latest release tag and does its body mention any breaking change? | The tag **and** an explicit yes/no grounded in the release body text. |
| `T08` | rss | Give the 3 newest entries of `https://news.ycombinator.com/rss` with their publication dates. | 3 titles **and** 3 dates. |
| `T09` | rss | From `https://github.com/yt-dlp/yt-dlp/releases.atom`, give the 2 newest release entries with timestamps. | 2 entry titles **and** 2 ISO timestamps. |
| `T10` | discussions | Find the highest-scored Hacker News stories about "prompt injection" and report their scores. | ≥ 3 story titles **each with a numeric score**. |
| `T11` | discussions | Find Hacker News discussion of "SQLite WAL" and report one story's title plus its link. | 1 title **and** 1 resolvable URL. |
| `T12` | mixed | For the latest `yt-dlp` release tag, is there any Hacker News story mentioning yt-dlp, and what is its score? | The release tag **and** either a scored HN story or an explicit, evidenced "none found". |
| — | youtube | *(no task)* | Backend absent — recorded as `untested`, cannot contribute to the tally. See `NOTES.md` in the prototype scratch. |

## Pre-registered thresholds

**S0a — task success.** Per task, the `reach` arm **wins outright** iff
the `native` arm fails the task or returns materially weaker evidence
against the `Acceptance evidence` column. **Ties are native wins** — the
tie-break favours the tool the user already has. `untested` is never a
win for either arm.

**S0b — token cost.** On tasks **both** arms solve, the reach arm's token
cost must be ≤ 1.5× native. Recorded **per channel**, not only in
aggregate: a channel that breaches S0b ships as a documented fallback,
never as a routed default, even if it wins on S0a.

## Verdict bands

| `reach` wins (of 12; `untested` never counts) | Band | What ships |
|---|---|---|
| 0–2 | `stop` | Publish the null. **No skill.** Registry + doctor + validator may still ship as standalone operator tooling; the router does not. |
| 3–6 | `prescriptions-only` | Skill ships with gated/fallback triggers only ("use when host tools fail: 403, auth wall, no subtitle access"). No general research triggers. |
| 7+ | `router` | Skill ships with general triggers **for the channels that individually cleared both S0a and S0b**. |

## Run protocol

Recorded per run, before scoring, in `results.csv`'s companion metadata
block (`RUN-META` lines at the top of the file):

1. **Host baseline** — host platform + version; per native tool: provider
   (if disclosed), result cap, rate limit (if disclosed).
2. **Run identity** — `run_id`, UTC date, which arm ran in which order.
3. **Endpoint log** — which endpoints were called; any rate limit hit and
   how it was handled (`retry` / `skip` / `fail`).
4. **Re-baseline rule** — a later run whose recorded host capabilities
   differ **materially** from a previous run is a **re-baseline, not a
   comparison**: re-run the native arm in the same session rather than
   comparing across sessions, and say so in the results. This is a rule,
   not a footnote: without it a host-side upgrade can spuriously pass or
   fail the verdict.

## Files

- `results.csv` — `task_id,arm,outcome,tokens,notes,run_id`; `RUN-META`
  lines carry the protocol block above.
- `VERDICT.md` — the binding output: tally, per-channel S0a/S0b outcome,
  `band:` line, and the one-line scope sentence the skill's description
  must copy verbatim.
