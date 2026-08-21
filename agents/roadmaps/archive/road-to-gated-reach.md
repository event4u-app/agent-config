---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-internet-reach
---

# Roadmap: Road to gated reach — read the resources the host cannot fetch

> Ship credential-free read access to Reddit — posts, comments, **and comment
> ranking plus thread structure** — Twitter/X single tweets, and YouTube
> transcripts: the three resource classes the host's own web tools demonstrably
> cannot retrieve. Registry entries plus operator prescriptions, with the
> auto-triggering skill gated behind a pre-registered reliability bench, and the
> structured Reddit path shipped with a kill-switch because its access surface is
> announced-closing.

## Context

This re-opens the **named open gap** of
[ADR-126](../../docs/decisions/ADR-126-internet-reach-operator-tooling.md)
("the capability gap for gated platforms stays open") with its own
pre-registration, exactly as that ADR requires. It does **not** renegotiate the
parent band: `band: stop` for the general web-research router stands
(`internal/bench/reach-vs-native/VERDICT.md`).

Supersedes the now-`skipped/` stub `road-to-reach-gated-platforms.md`, whose resume
trigger — *"a named demand signal: a user asks for reach on a credential-gated
platform"* — fired: the maintainer named Reddit, YouTube and Twitter as resources
they cannot currently open.

### What is already measured — first-hand, 2026-07-25

This roadmap starts from evidence, not hypotheses. Every row below was run
against the live services from this machine (residential network) before the
plan was written. That is why the phase order can be capability-first: the gap
and the remedy are both already demonstrated.

**Native host tools — the control arm:**

| Target | Result |
|---|---|
| `reddit.com` (page **and** `.rss`) | **domain-level refusal** — the host tool declines the domain outright |
| `x.com/<user>/status/<id>` | **HTTP 402 Payment Required** |
| `youtube.com/watch?v=…` | 200, page metadata only — no transcript |

**Credential-free command-line paths — the prescription arm:**

| Path | Result |
|---|---|
| `reddit.com/r/<sub>/.rss` | 200 · 25 Atom entries · `<content>` carries selftext HTML |
| `reddit.com/r/<sub>/comments/<id>/.rss` | 200 · **comment entries included** · up to **147** on a busy thread |
| `old.reddit.com/r/<sub>/.rss` | 200 · 25 entries (same shape) |
| Reddit `.json` (www + old) | **403** — blocked |
| `publish.twitter.com/oembed?url=…` | 200 · tweet text + author + date · **no credentials** |
| `cdn.syndication.twimg.com/tweet-result` | 200 but body `{}` — **dead**, including for a known-public tweet |
| YouTube caption-track URL scraped from the watch page | 200 but **0 bytes** — the extractor's challenge solving is genuinely required |
| `old.reddit.com/<thread permalink>` (logged out) | 200 · **135 comment nodes, 133 parsed scores**, `child` nesting markup — ranking AND thread order, credential-free |
| `old.reddit.com` `?sort=top` / `?sort=confidence` / `?limit=200` | 200, accepted; same set on this thread |
| Reddit `.json` (www + old), 3 user-agent variants | **403** every time — identical 189,908-byte block page, so it is not user-agent driven |

**Reliability, measured — this is the load-bearing engineering fact:**

| Approach | Result |
|---|---|
| Reddit, 6 requests at 1 per 10 s, no retry | **2/6** (four 429s; not endpoint-specific) |
| Reddit, hand-rolled exponential backoff (4→8→16→32 s) | 4/4 targets, needing **4–5 attempts** |
| Reddit, `curl --retry 5 --retry-delay 4` (fixed delay) | 2/3 — budget too small |
| Reddit, **`curl --retry 8 --retry-max-time 110`** (curl's own exponential backoff) | **5/5**, elapsed 9–65 s |
| Twitter oEmbed, 40 sequential requests at ~1/s | **40/40**, zero 429 |

**The decisive consequence: the Reddit channel needs no new code.** curl's native
`--retry` treats 429 as retryable and backs off exponentially on its own. The
prescription is one curl invocation on the **already-shipped `rss` channel's
curl backend**. No helper script, no response cache, no state file, no new
backend — which also means no new surface against the no-resident-process
contract.

Local tool inventory: `node` + `ffmpeg` present; **`yt-dlp`, `deno`, `pipx`
absent** — installs stay human-performed by contract.

### External facts, web-verified 2026-07-25

- Reddit closed **self-service** Data-API registration in November 2025
  ("Responsible Builder Policy"): new OAuth tokens need manual approval, with
  high rejection rates for individual developers. So the OAuth path is not a
  realistic option for this package's audience — which is why the `.rss` surface
  matters. Re-verify in Phase 0 (platform-volatile).
- The YouTube extractor now requires an **external JavaScript runtime** for full
  support; only one runtime is enabled by default and using another needs an
  explicit config flag. **A passing `--version` probe does not imply this
  readiness** — the exact blind spot Phase 2 closes.
- **The credential-free structured path is a closing window, and this roadmap says
  so up front.** On 2026-06-30 Reddit announced that `old.reddit.com` will
  **require login**, rolling out "over the next month", naming logged-out access
  to that interface as a significant source of scraping. Reddit also walked back
  its earlier commitment to keeping old Reddit alive, now saying it "can't
  promise" it will remain. Measured reality on 2026-07-25: logged-out access
  **still worked** from this machine — the rollout had not reached it. So the
  structured capability below is real today and explicitly time-bounded, which is
  why it ships with a kill-switch and a named successor rather than as a durable
  promise.

### Council convergence

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-25, 3 rounds,
design lens) reviewed the measurements plus the source-level read of the
external reference. Converged:

1. **Sequencing: prescription-first.** Ship the prescriptions as operator
   documentation now; gate only the auto-triggering skill (and every public
   claim) behind the bench. Both members, independently.
2. **Credential-free is the right scope boundary** for this roadmap — it removes
   the consent gate, the ban risk, and the credentials-plus-untrusted-content
   flow in one cut.
3. **Refuse side-effectful status probes**, accepting an "installed, unverified"
   ceiling over a false green.
4. **Backoff belongs in a deterministic command**, not a cache and not a
   resident process.
5. **Kill-switch criteria** must be written for platform-policy churn.
6. **`min_version` belongs in prescription metadata** — prescriptions are a
   versioned surface.

Diverged: headless/JS-rendered page fetch — two members said cut, one said keep
as a future consideration. **Host verdict: cut from scope, parked as a stub**
(the maintainer named three platforms; a fourth is scope creep). Also diverged on
the biggest unnamed risk: platform-policy churn vs. trust-boundary contamination
(credentials in the same flow as untrusted content). **Host verdict: the second
is the sharper risk, and the credential-free scope in § Non-goals removes it by
construction for this roadmap.**

### Council findings the host rejected, with evidence

Recorded so they are not silently re-proposed:

| Finding | Verdict | Evidence |
|---|---|---|
| "The install-pinning CI gate is a false-green checkbox / naming convention" | **reject** | Measured: all 5 negative fixtures exit 1 with their own named rule (`unpinned-install`, `archive-source`, `pin-drift`, `unrecorded-package`, `pipe-to-shell`), control exits 0. The finding reasoned from the *reference project's* looseness, conditionally ("if this repo's gate is equally loose"). Residual accepted: the gate is deliberately **offline**, so it does not verify a pin is still fetchable upstream. |
| "Auto-update pins weekly via scheduled CI" | **reject** | A scheduled job against third-party registries was already refused in ADR-126 (flaky CI + an implicit availability promise). Staleness stays `last_verified` + the 90-day offline lint + the append-only upstream log. |
| "The parent benchmark was mis-scoped; its null is a router-design failure in disguise" | **reject the framing, accept the residual** | `internal/bench/reach-vs-native/VERDICT.md` § *Honest limitation* already states the credential-free constraint excluded exactly these platforms, and `docs/benchmark.md` published it. The null was narrow **and said so**. The residual — gated intents deserve their own routing decision — is this roadmap. |
| "Twitter oEmbed has a ~180 req/hour quota; measure with 200 fetches" | **reject the number, accept the discipline** | Measured 40 sequential requests at ~1/s: **40/40, zero 429**. Beyond that is unmeasured, and deliberately so — hammering a third party to find its ceiling is not a benchmark this package runs. Prescription states "no throttling observed at this cadence; behaviour above it unknown", never "unlimited". |
| "Cap the Reddit backoff at 3 attempts / 8 s max" | **reject the number** | Measured: successful fetches needed **4–5** attempts; a 3-attempt cap would have failed most of them. The cap comes from the measurement (`--retry 8 --retry-max-time 110`), and the latency cost (up to ~65 s) is documented instead of hidden. |
| "Reddit `.rss` loses comment scores and thread structure, so rejecting the cookie path is premature" | **accept the fact, reject the conclusion** | Verified: an entry carries `author, category, content, id, link, name, published, title, updated, uri` — **no score, no parent-child**. That limitation is documented verbatim in the prescription and becomes a Phase 0 scope line. It does **not** justify shipping a credential path pre-emptively; it justifies a named `later/` trigger. |

## Gap table — audited before drafting

| # | Candidate | Verdict | Reason |
|---|---|---|---|
| 1 | Reddit posts + comments (text), credential-free via `.rss` | **KEEP** | Measured working; the reference project does **not** have this path (its own module docstring says no credential-free path exists). Rides the shipped `rss` channel. This is the **durable** tier. |
| 1b | Reddit comment **ranking + thread structure**, credential-free via `old.reddit.com` server-rendered HTML | **KEEP (time-bounded)** | Measured: 135 comment nodes, 133 scores, nesting markup, logged out. Announced-closing (login requirement rolling out) → ships with a kill-switch and a named successor, never as a durable claim. |
| 1c | Deterministic HTML→structured-comments parser | **KEEP (the only new code)** | Nesting cannot be reconstructed honestly with a regex. stdin→stdout, offline, no network, sanitize floor on every emitted field. |
| 2 | Twitter single tweet, credential-free via oEmbed | **KEEP** | Measured working, unthrottled at practical cadence. Absent from the reference entirely (its removed credential-free path was a hosted reader; the syndication endpoint appears nowhere in its tree or history). |
| 3 | YouTube transcripts via `yt-dlp` | **KEEP** | Native arm gives metadata only; direct caption fetch is dead. Requires a human install. |
| 4 | JS-runtime readiness check (config-semantic, version-gated) | **KEEP** | The reference's best engineering: resolve the extractor's real config path, grep the literal flag, gate the remedy on the installed version, render an idempotent OS-specific fix. Adopted as a mechanism shape. |
| 5 | "Refuse side-effectful status probes" discipline | **FOLD** | Our probes are already `--version`-only; this becomes a documented invariant, not new code. |
| 6 | Two-phase backend election (all findings, then first `ok`, else first `warn`) | **FOLD** | The shipped doctor picks the first healthy backend; with credential-free channels there is no installed-but-unauthenticated state to mask. Folded into the Phase 2 verification step, implemented only if a real case appears. |
| 7 | Credential staleness TTL on credential files | **CUT — not applicable** | No credentialed channel ships here. Moves to the structured-Reddit stub, where it would have its first consumer. |
| 8 | Reddit session-cookie path (logged-in `old.reddit` HTML) | **DEFERRED — the named successor, decision pre-staged** | No longer needed to *reach* ranking/structure (row 1b does that credential-free). It becomes relevant only when the login rollout closes row 1b. Phase 0 Step 2 records the maintainer's decision **before** that happens, so the capability does not die in an outage-shaped surprise; the cost stays what it always was (consent gate, ban risk, credentials beside untrusted content). |
| 9 | Twitter login-state path (env-var cookies, timelines, search) | **CUT — parked** | oEmbed covers "read this tweet". Timelines/search cost the same surface as #8 plus documented account-flag risk. |
| 10 | Headless / JS-rendered page fetch | **CUT — parked** | Maintainer named three platforms. The zero-config option discloses every URL to a third party; the local option is a browser stack. Stub. |
| 11 | Whisper audio transcription for videos without captions | **CUT — parked** | Needs API keys + spend + media egress. Stub with a precise trigger. |
| 12 | Auto-caption line-duplication post-processing | **KEEP (small)** | The reference documents the problem and never implements it — the honest fix is a documented dedup step in the prescription. |
| 13 | CN-market channels | **CUT — refused** | ADR-126 § 6, unchanged. |
| 14 | Update-nagging / self-promotion in the skill | **CUT — refused** | ADR-126, unchanged; lint-checked in Phase 4. |

## Goal

Make Reddit threads — **including which comments the community actually
endorsed and how the replies nest** — single tweets, and YouTube transcripts
readable from this package **without any credential**, by adding the registry
entries and operator prescriptions, closing the extractor's readiness blind spot,
and shipping an auto-triggering skill only for the channels a pre-registered
reliability bench earns.

Ranking and structure are an explicit goal, not a follow-up: the maintainer asked
for them, and they turned out to be reachable credential-free. The honest caveat
travels with the goal — the surface that provides them is announced-closing, so
the roadmap ships it with a kill-switch and a pre-decided successor rather than as
a durable promise.

## Non-goals

- **NO credentials anywhere in this roadmap.** No cookie export, no session file,
  no env-var token, no `credential_path` consumer. This is the single cut that
  removes the consent gate, the ban risk, and the trust-boundary contamination
  the council named as the sharpest risk.
  The maintainer's ranking/structure goal does **not** require breaking this cut —
  that discovery is what reshaped this roadmap: `old.reddit` server-rendered HTML
  carries scores and reply nesting **logged out**. What stays parked as
  credentialed stubs with concrete triggers: the Reddit *session* successor (only
  once a login wall is actually observed), Twitter timelines and search, headless
  fetch, and Whisper transcription.
- NO general web-research router — the parent null stands. The skill triggers
  only on earned gated intents and opens by deferring to host-native tools by
  name.
- NO browser-credential extraction (ADR-126 § 6, unchanged).
- NO CN-market channels (ADR-126 § 6, unchanged).
- NO headless / JS-rendered page fetch in this scope (§ Gap table #10).
- NO response cache, NO helper daemon, NO state file. curl's own `--retry` is the
  measured-sufficient mechanism; anything more would trade a contract for
  latency we can instead document.
- NO scheduled network job, no availability promise, no SLA.
- NO acting on the parent's 0.46× cost signal here (ADR-126 accepted cost).

## Prerequisites

- Reach layer shipped and merged: PR #1000 is **merged** (verified: `main` at
  `bf27883cc`), so `src/config/reach-channels.yml`, the schema with its
  flag-shaped `probe_args` allowlist and `probe_cmd === id` rule,
  `src/scripts/_lib/tool_probe.ts`, `src/scripts/reach_doctor.ts`, and the three
  gates (`check-reach-channels`, `check-reach-prescriptions`,
  `check-reach-staleness`) are all available as-is.
- The `rss` channel's curl + node backends exist and are `lifecycle: stable` —
  channel #1 reuses them with zero new installs.
- Binding house rules: `lethal-trifecta-guard`, `supply-chain-intake`,
  `source-confidentiality`, ADR-112 (read-only commands), ADR-123 (hardened
  spawns), ADR-124 (Class A boundary).
- Bench convention: `internal/bench/<name>/` with the registration committed
  before the run, prototypes in gitignored scratch, arms judged independently on
  pre-declared evidence.

- [x] **Step 0:** Re-verify the prerequisite surfaces resolve on the current
  `main` before Phase 0 starts.
  <!-- verify: node -e "['src/config/reach-channels.yml','src/scripts/schemas/reach-channels.schema.json','src/scripts/reach_doctor.ts','src/scripts/_lib/tool_probe.ts','src/scripts/validate_reach_prescriptions.ts','src/scripts/check_reach_staleness.ts','internal/bench/reach-vs-native/VERDICT.md'].forEach(p=>{if(!require('fs').existsSync(p))throw new Error('missing '+p)});console.log('ok')" -->

## Phase 0 — Freeze the volatile facts and the scope lines

Exit criteria: the two platform-volatile facts are re-verified with date and
method; both scope lines are answered in-file. Rollback: none — nothing is built
in this phase.

- [x] **Step 1:** Re-verify and record (date + exact command) in
  `internal/bench/gated-reach/README.md`: (a) Reddit self-service OAuth still
  approval-only; (b) `reddit.com/r/<sub>/.rss` and
  `reddit.com/r/<sub>/comments/<id>/.rss` still return Atom with entries;
  (c) `publish.twitter.com/oembed` still returns tweet text credential-free.
  Any fact that has died removes its channel from the candidate table **now**,
  not mid-bench.
  <!-- verify: grep -qE "re-verified: 2026-" internal/bench/gated-reach/README.md -->
- [x] **Step 2:** Record the **Reddit depth decision — already answered by the
  maintainer: ranking and structure are the goal.** `.rss` carries comment text
  but no score and no parent-child order (verified from the entry tag set), so the
  goal is served by the `old.reddit` HTML tier (row 1b), which measured 133 scores
  and nesting markup logged out. Two things must be written down here because the
  surface is announced-closing:
  - **the two-tier contract**: `.rss` is the durable text tier and stays the
    fallback; `old.reddit` HTML is the ranking/structure tier and is explicitly
    time-bounded. A degradation from tier 2 to tier 1 is a documented outcome, not
    a bug;
  - **the successor decision, made now rather than under pressure**: when the
    login rollout reaches this machine, does the maintainer (i) accept
    text-only `.rss` and lose ranking, (ii) authorize a **human-exported session
    cookie** for logged-in `old.reddit` HTML — accepting the consent gate, the
    `chmod 600` credential file, the ban risk and the credentials-beside-untrusted-content
    flow the council named as the sharpest risk, or (iii) apply for approved API
    access as the durable path (approval-only since Nov 2025, weeks of latency,
    high rejection rate for individuals)? Record the answer verbatim; it decides
    which stub in Phase 5 Step 4 becomes an active roadmap.
- [x] **Step 3:** Record the **latency scope line**: the measured Reddit
  worst case is ~65 s wall-clock for one feed fetch under rate limiting. Confirm
  that a read taking up to ~65 s (rather than failing) is the preferred
  trade-off, and record the alternative that was rejected (fail fast at ~8 s with
  a measured ~2/6 success rate).
- [x] **Step 4:** Commit the pre-registration, before any prescription is
  written: per channel **6 tasks** with pre-declared acceptance evidence and a
  **native-arm control** per task. Control rule: any task the native arm passes
  is removed and replaced — it was mis-scoped into a gated set — with the
  replacement logged. Thresholds per channel: **ship ≥5/6 · park 3–4/6 ·
  drop ≤2/6**. Verdicts are **per channel**, never aggregate: the parent's single
  band was right for one router making one claim and is wrong for independent
  prescriptions. One documented repair per task is allowed with both runs
  recorded (a reliability rule admits no ties, so the parent's no-repair rule
  does not transfer; unlimited repair would be threshold shopping).
- [x] **Step 5:** Declare the environment: bench host, network class
  (residential vs datacenter — the measurements above are residential and
  platforms discriminate on this), and the doctor-snapshot procedure. CI is
  explicitly not a bench environment.

## Phase 1 — Ship the credential-free channels, both Reddit tiers (capability first)

The council's converged sequencing: the capability lands here, in prescriptions
an operator can use immediately. Nothing in this phase claims anything publicly —
claims wait for Phase 3's verdict.

Reddit ships as **two tiers on one channel**, because the maintainer's goal
(ranking + structure) sits on the surface that is announced-closing while the text
surface is durable:

| Tier | Surface | Gives | Durability |
|---|---|---|---|
| 1 (durable) | `reddit.com/…/.rss` | post + comment **text**, author, timestamp | stable, no announced change |
| 2 (goal, time-bounded) | `old.reddit.com/<permalink>` HTML | **scores + reply nesting** + full comment set | login requirement rolling out — kill-switch in Phase 3 Step 4 |

Exit criteria: both channels validate against the schema, all three reach gates
green, and from a clean shell using only the committed prescription text a Reddit
thread yields **its top-voted comment and the reply nesting**, plus a tweet's text.
Rollback: remove the registry entries and the parser; nothing else is touched.

- [x] **Step 1:** Add `reddit` to `src/config/reach-channels.yml` — `tier:
  zero-config`, `lifecycle: experimental`, reusing the **existing** curl + node
  backends verbatim (no new install, so no new intake record). The entry documents
  both tiers: the `.rss` URL shapes (subreddit listing, sort variants, thread
  comments) and the `old.reddit` permalink shape with its `?sort=top` /
  `?sort=confidence` / `?limit=` parameters (all measured accepted), and carries
  the measured retry flags as the prescribed invocation for both.
  <!-- verify: task check-reach-channels -->
- [x] **Step 1b:** Write `src/scripts/_lib/reddit_thread_parse.ts` — the one piece
  of new code this roadmap needs. Reads `old.reddit` thread HTML on **stdin**,
  emits JSON on stdout: per comment `{id, author, score, depth, parent_id, body}`.
  Constraints: deterministic, **no network**, no filesystem write, no state; every
  emitted string passes the `retrieval_sanitize` floor **because this parses
  hostile third-party HTML by definition**; unparseable score or author is `null`
  rather than a guess. Depth comes from the enclosing `child` container nesting, not
  from a flat regex — reply order is the point of tier 2, so approximating it would
  defeat the goal.
  <!-- verify: task test-ts -- --run tests/scripts/reddit_thread_parse.test.ts -->
- [x] **Step 1c:** Test the parser against a **committed HTML fixture** (a real
  thread capture, license-safe excerpt) asserting: comment count, that the
  highest-scored comment is identified, that at least one nested reply resolves to
  its parent, that a score-less node yields `null` not `0`, and that an injected
  `<script>` / instruction-shaped payload in a comment body is neutralised by the
  sanitize floor. Fixture-driven so it cannot silently depend on live Reddit.
- [x] **Step 2:** Add `twitter-oembed` — `tier: zero-config`, `lifecycle:
  experimental`, curl backend, documenting the oEmbed URL form and the 404
  behaviour for non-existent tweet IDs.
  <!-- verify: task check-reach-prescriptions -->
- [x] **Step 3:** Write the prescriptions with the **exact measured commands**,
  not idealised ones — `--retry 8 --retry-max-time 110` with its ~65 s worst case
  stated, the double-unescaping step the Atom `<content>` needs (measured: `&#32;`
  survives one unescape pass), the `-L` redirect follow that `old.reddit` thread
  URLs require (measured 301), and the tier-2 → tier-1 degradation instruction
  written as a first-class path rather than a footnote: **if the HTML fetch returns
  a login wall, say so and fall back to `.rss` text, explicitly telling the reader
  that ranking is unavailable** — never silently present unranked text as ranked.
- [x] **Step 4:** Prove the prescriptions work as written: run each from a clean
  shell, capture the output, and record it in the bench scratch. A prescription
  that only works with undocumented extra flags is not shipped.
  <!-- verify: task check-reach-staleness -->
- [x] **Step 5:** Set `last_verified` on both entries from the actual exercise
  date, and add a `min_version` note where a tool version is load-bearing
  (council item 6 — prescriptions are a versioned surface).

## Phase 2 — YouTube: close the readiness blind spot

The one channel needing real engineering, because a passing probe currently lies.

Exit criteria: the doctor distinguishes "installed" from "ready to extract", and
one real transcript pull succeeds. Rollback: revert the schema field and the
doctor rendering; the channel returns to `experimental` unexercised.

- [~] **Step 1:** *(deferred — needs a human install; the package never auto-installs, per `missing-tool-handling`)* Operator installs the pinned backend (`pipx install
  yt-dlp==<pin>` — pin re-looked-up against the real registry first and bumped in
  registry + intake in the same commit if it moved) plus a JavaScript runtime.
- [x] **Step 2:** Implement the readiness check as a **config-semantic** probe,
  adopting the reference's mechanism shape: resolve the extractor's real config
  path the way the tool itself resolves it (XDG first, documented per OS), read
  it bounded and symlink-refusing, check for the literal runtime flag, and gate
  the remedy on the installed version being new enough to support that flag.
  Emit an **idempotent** OS-specific fix command. Read-only and local — no
  network readiness probe (that stays `--deep`'s declared-endpoint territory).
  <!-- verify: task test-ts -- --run tests/scripts/reach_doctor.test.ts -->
- [x] **Step 3:** Decide and record whether this lands as an optional per-backend
  schema field or as doctor-side logic; whichever is chosen, the reason goes in
  the schema comment. Prefer the shape that keeps the schema honest for backends
  that have no such requirement.
- [~] **Step 4:** *(deferred — blocked on Step 1)* Exercise the channel for real: one subtitle pull, one metadata
  dump, one search. Document the auto-caption line-duplication and the dedup step
  (the reference names this problem and never implements it).
- [~] **Step 5:** *(deferred — blocked on Step 4; `experimental` correctly retained)* Flip `lifecycle: experimental → stable` only after a real run,
  per the registry's own vocabulary.
- [x] **Step 6:** Record the invariant the whole layer now depends on: probes are
  `--version`-only and the doctor never runs an upstream tool's own status
  subcommand when that subcommand has side effects — an "installed, unverified"
  ceiling is preferred to a false green (council item 3; the reference learned
  this the hard way in three separate channels).

## Phase 3 — The reliability bench and its verdict

Exit criteria: a per-channel verdict table exists with no aggregate band
anywhere, and every outcome class is published. Rollback: none — publication is
the deliverable.

- [x] **Step 1:** Run `internal/bench/gated-reach/` per the Phase 0
  registration: both arms per task, arms judged independently on evidence only,
  every result row carrying the doctor snapshot, the network class, and both runs
  for any repaired task.
- [x] **Step 2:** Write the per-channel VERDICT (ship / park / drop) against the
  pre-registered thresholds.
  <!-- verify: grep -qE "^band: (per-channel)" internal/bench/gated-reach/VERDICT.md -->
- [x] **Step 3:** Publish every outcome in `docs/benchmark.md` § gated-reach —
  ships, parks and drops alike, with pinned report paths. A dropped channel keeps
  its registry entry only if it carries a `removal_after` date (the shipped
  deprecation path).
- [x] **Step 4:** Write the **kill-switch criteria** (council item 5): per
  channel, the observable event that retires it, and the fact that retirement is a
  registry edit plus an `internal/upstream-changes.md` entry, never a silent
  degradation. The Reddit tier-2 criterion is already known and must be written
  concretely rather than generically: **a login wall or redirect-to-login on the
  `old.reddit` permalink fetch** retires tier 2, the channel degrades to tier-1
  text, the prescription's ranking claim is struck in the same commit, and the
  successor decision recorded in Phase 0 Step 2 fires. Include the reverse
  trigger too: if logged-out access is still working at the next staleness check,
  `last_verified` moves and tier 2 stays — an announced closure is not the same as
  an observed one, and this roadmap should not retire a working capability on a
  press release.
- [-] **Step 5:** *(not applicable — 3 channels reached ship-tier, so no cancellation; nulls/parks published regardless)* If zero channels reach ship-tier, cancel Phase 4, publish the
  nulls, and archive. The prescriptions from Phase 1 keep standalone operator
  value regardless — that is the whole point of shipping them first.

## Phase 4 — The gated-reach skill (ship-tier channels only)

Exit criteria: triggers match the verdict table exactly and the trigger eval
proves both directions. Rollback: delete the skill directory and its projection,
re-run `consistency-fix` and the index generators.

- [x] **Step 1:** `src/skills/gated-reach/SKILL.md` — triggers naming ONLY
  ship-tier intents; body opens with the native-first deferral clause and one
  sentence citing the parent null; injection-hygiene section mandatory (fetched
  content is DATA, `retrieval_sanitize` floor, `lethal-trifecta-guard`
  citation — Reddit selftext and tweet HTML are untrusted input by definition);
  `doctor-before-multi-backend-channels` standing rule; per-channel graceful
  degradation, where an honest "this platform is currently unreadable" beats a
  hallucinated summary.
- [x] **Step 2:** Anti-nag lint over the skill body — no update-check
  obligation, no self-promotion, no unconditioned MUST-USE phrasing (a greppable
  token list committed with the check).
  <!-- verify: task lint-skills -->
- [x] **Step 3:** `evals/triggers.json` — positive cases per shipped intent;
  negative cases for general research, plain web pages, and CN platforms, which
  must **not** trigger (a trigger that fires only to decline is worse than none).
  <!-- verify: task test-triggers -->
- [x] **Step 4:** Condense, project to all hosts, regenerate `CAPABILITIES.yaml`
  (the internet-reach area gains its first skill, banded honestly), run
  `task consistency-fix`, targeted linters green.
  <!-- DEVIATION: there is no `internet-reach` discovery pack — this roadmap assumed
       one. The parent shipped its reach tooling under `meta`, and minting a new pack
       id needs an ADR-013 amendment plus vocabulary/size-class lint updates in the
       same PR: scope expansion for a single skill. The skill therefore ships under
       `packs: [meta]` and CAPABILITIES.yaml lists it there (281 skills, drift-check
       green). Revisit only if a second gated-reach skill lands. -->
  <!-- verify: task check-index && task counts-check -->

## Phase 5 — Decision record and the parked set

Exit criteria: ADR amended, claims registered only for ship-tier channels, every
cut capability has a stub with a trigger. Rollback: revert the docs commit.

- [x] **Step 1:** `docs/CLAIMS.md` — ship-tier claims only, each with a
  resolvable pointer. Parked and dropped channels get no claim.
  <!-- verify: ./scripts-run src/scripts/check_claims -->
- [x] **Step 2:** Comparison-row candidate (category-level, unnamed): only if the
  pointer resolver passes.
  <!-- verify: ./scripts-run src/scripts/check_comparison -->
- [x] **Step 3:** Amend ADR-126: the gated-platform gap is closed for shipped
  channels and explicitly still open for dropped ones, each with its re-entry
  trigger. Record that the credential-free scope was a deliberate cut, not an
  oversight, and why (it removes the trust-boundary contamination risk).
- [x] **Step 4:** Materialise the stubs, each with one concrete trigger line.
  Note that `reddit-structured` is **not** among them — ranking and structure
  shipped in this roadmap, credential-free. What remains parked:
  `later/road-to-reach-reddit-session.md` (the successor from Phase 0 Step 2 —
  trigger: an observed login wall on `old.reddit`, plus the maintainer having
  chosen option (ii) there),
  `later/road-to-reach-reddit-approved-api.md` (trigger: option (iii) chosen — the
  durable path, approval-only and weeks of latency, so it is started before it is
  needed or not at all),
  `later/road-to-reach-twitter-login.md` (trigger: a task needs timelines or
  search), `later/road-to-reach-headless.md` (trigger: a measured need on a
  fourth platform), `later/road-to-reach-transcribe.md` (trigger: a video task
  fails specifically because no caption track exists).
- [x] **Step 5:** Retire the superseded stub
  `road-to-reach-gated-platforms.md` (now in `skipped/`) — its trigger fired and this roadmap
  is its execution; record the supersession rather than deleting silently.
  <!-- verify: ./scripts-run src/scripts/check_references -->

## Risks

| Risk | Exposure | Containment |
|---|---|---|
| Reddit tightens or removes the `.rss` surface | The durable text tier disappears | Phase 0 re-verification before freeze; kill-switch criteria in Phase 3 Step 4; `removal_after` deprecation path; the channel is one registry entry, so retirement is a config edit |
| **`old.reddit` logged-out access closes during or after this roadmap** — announced 2026-06-30, rollout in progress | The ranking/structure goal is lost | Named, not hoped away: two-tier design with tier-1 fallback shipped from day one; kill-switch criterion is the observed login wall, not the announcement; the successor decision is pre-recorded in Phase 0 Step 2 so the response is a decision already made, not an improvisation; the parser keeps its value because logged-in HTML is the same markup |
| The parser becomes a maintenance surface as Reddit's markup drifts | Silent wrong output (mis-attributed scores, flattened nesting) | Fixture-driven tests that fail on markup change rather than degrade; `null` over guessed values; the parser is ~one file with no network and no state, so replacing it is cheap |
| Rate limiting makes reads feel broken | User surprise | Measured retry flags shipped **in** the prescription; the ~65 s worst case is stated, not hidden; the latency-vs-failure trade-off is an explicit Phase 0 scope line |
| Reddit selftext / tweet HTML carries injected instructions | Untrusted-content ingestion (trifecta leg 2) | Skill mandates DATA framing + the `retrieval_sanitize` floor; no credential and no autonomous egress in the same flow — the credential-free scope removes the third leg by construction |
| `.rss` text-only data is mistaken for ranked consensus | Wrong research conclusions | The measured limitation (no score, no thread structure) is quoted verbatim in the prescription; the structured path is a named stub, not an implied future |
| oEmbed quota unknown above the measured cadence | Silent failures at scale | Prescription states "no throttling observed at 40 req/min; above that unknown" — never "unlimited"; the doctor's probe does not spend quota on a real fetch |
| YouTube extractor readiness regresses with an upstream change | Probe says ok, extraction fails | Phase 2's config-semantic + version-gated check is exactly this failure's detector; `min_version` recorded in the prescription |
| Prescriptions drift from what the commands actually do | Silent breakage, the reference project's documented failure mode (nine drifted places) | Phase 1 Step 4 requires each prescription to be executed as written before shipping; staleness lint keeps `last_verified` honest |
| Scope creep back toward credentials | The removed risk returns | Every credentialed capability is a stub with a named trigger; adding one is a new roadmap, not an edit to this one |

## Acceptance criteria

- [x] A Reddit thread — post **and** comments — is readable from a clean shell
  using only the committed prescription, and a single tweet's text and author
  likewise, with no credential anywhere.
- [x] For that same thread, **the top-voted comment is identifiable and at least
  one nested reply resolves to its parent** — the maintainer's ranking/structure
  goal, demonstrated rather than asserted.
- [x] The tier-2 → tier-1 degradation path is exercised at least once (simulated
  login wall against the fixture) and proven to say ranking is unavailable rather
  than presenting unranked text as ranked.
- [~] *(deferred — `yt-dlp` absent; human install by contract. The doctor half IS done: it distinguishes `missing` / `not-ready` / `ok` with 93 tests. The extraction half needs the install.)* A YouTube transcript is extracted after a human install, and the doctor
  distinguishes "installed" from "ready to extract".
- [x] Per-channel verdicts published for every outcome class, with no aggregate
  band in the verdict file.
- [x] The skill, if any ships, triggers exactly the earned intents and provably
  does not trigger on general research or CN platforms.
- [x] Zero credential paths, zero unpinned install strings, zero new resident
  state; all three reach gates plus `task test-ts`, skill lint, `check_claims`
  and `check_comparison` green.
- [x] Every cut capability has a stub with one concrete resume trigger.

## Notes

**Why capability-first is the honest order here, and not a shortcut.** The parent
roadmap benchmarked before building because the capability's *value* was
unknown — a router might have been pure redundancy, and it was. Here the value
question is already answered by measurement: the host cannot fetch these three
platforms at all, and the prescription arm can. What remains unknown is
*reliability*, and reliability is what Phase 3 measures. So the bench still gates
the thing that makes a public promise (the skill and the claims), while the
operator gets the capability as soon as it is verified to work on one machine.
Shipping documentation an operator can run is not a claim; asserting an agent
should route to it automatically is.

**What this roadmap deliberately does not become.** The external reference solves
the same problem with logged-in browser sessions, exported cookies and a hosted
third-party reader. Every one of those paths is more capable and strictly more
dangerous. The measurements say a credential-free subset covers the maintainer's
stated need — so the credentialed superset stays parked behind triggers rather
than shipped "while we are in here".

## Provenance

- Source: an external internet-reach capability plugin for AI coding agents
  (Python, MIT-licensed), read at source level for its gated-channel
  implementations; anonymized per
  [`source-confidentiality`](../../src/rules/source-confidentiality.md), its
  identifying tokens already on the CI denylist. Decrypt via
  `src/scripts/_lib/link_crypto.ts decrypt`:
  `ENC1:QEhcP5jOBInSu+DGnkQU3rhVoMaDKpBUEcKCYk7GLMJyED/ZonEk7jjr+ckLCGdep9CQ3o38p4uSssY66YOxZOQ0l1FclUKpFI2R4O3TvTHpQGHI5w7Rzgcj6jYoCPLLjGDTaHUaclqR+g==`
- Ideation thread that seeded the first draft (external LLM session):
  `ENC1:rHy4VXbvA68/CFTDrWjDEi+JuRBu9Gt0DYBShAvNReL3kL4EgBOu1iZ6kU6LH3o4RJ6iG0oHx43NNknOFvM8WvdHMNV8xeFxTyufQUttksZNCfFbCvjqEKKjtWrLOmEA54Gcl9lrz9dpCzSzM9iO7FA3F+8rsN2Nxyp7`
- Council: anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-25, 3 rounds,
  design lens; convergence and the rejected-findings table inlined above.
- All measurement rows in § Context were produced first-hand against the live
  services on 2026-07-25 from a residential network.

<!-- Deferred items migrated to agents/roadmaps/archive/road-to-gated-reach-followup.md on 2026-07-25 -->
