---
complexity: structural
execution:
  mode: autonomous
---

# Road to cache economy — pay read rates, not write rates

> A public report claimed Claude Code subagents miss prompt caching entirely.
> Measured on this repo's own traffic, that is **false** — 97% of subagent input
> tokens are cache reads. The real cost is elsewhere and it is ours: every
> subagent spawn re-writes a ~235k-token preamble, ~88k of which is a **second,
> near-identical copy of the same 110 always-loaded rules**, and the two
> human-facing cost surfaces we already ship are both wrong (one is cache-blind,
> one double-counts transcript replays).

## Goal

Charge the cheapest correct rate for every token this package causes to be sent —
host subagent legs, the AI council's billed calls, team reviews — and be able to
**prove** it with one deterministic, no-daemon measurement the package owns.
Where the cost is host-controlled and unreachable, say so once, version-stamped,
instead of implying a fix exists.

## Prerequisites

- [x] Cache multipliers already derived in `src/scripts/ai_council/pricing.ts:111-113`
      (0.1× read · 1.25× 5m write · 2.0× 1h write) — no new pricing source needed.
- [x] Council caching already ships as explicit opt-in with a stable-prefix /
      volatile-suffix split (`src/scripts/ai_council/clients.ts:458-487`).
- [x] Per-leg cache attribution is available locally with no daemon, no beta flag
      and no network: `~/.claude/projects/**/*.jsonl` carries top-level `agentId` /
      `isSidechain` next to `message.usage.cache_read_input_tokens` and
      `cache_creation_input_tokens` — verified on this machine.

## Context — measured 2026-07-30 (host ≈ CC 2.1.220), do not relitigate

### The public claim, verified against primary sources

- **anthropics/claude-code#29966** (OPEN, 2026-03-02, CC 2.1.63 / Agent SDK
  0.2.63, **AWS Bedrock**): 54 subagent requests carried zero `cache_control`
  markers. Its stated root cause — an `enablePromptCaching: false` default — is
  **contested by Anthropic on the record**: *"the code path you identified isn't
  the one subagents use… The subagent path does enable caching by default."* The
  reporter's rebuttal keys on User-Agent (`cli` vs `agent-sdk/…`), not on that
  default. A CHANGELOG sweep 2.1.63 → 2.1.220 found **no fix**; only v2.1.128
  *"sub-agent progress summaries missing the prompt cache"*.
- **anthropics/claude-code#74318** (OPEN, 2026-07-05) is the rigorous measurement
  — ~95 sessions, ~1,800 subagents, 6.8B input tokens, local transcripts, no
  proxy — and it **contradicts the "no caching" framing**: *"~95% of input tokens
  are cache hits… subagents do cache — but every subagent write is `ephemeral_5m`,
  while the main loop uses 1-hour."* Measured per-token deltas: blanket 1h on
  subagents **+8.6% (worse)**; head-1h/tail-5m split **+1.3% (worse)**;
  retention-1h on the pre-dispatch write **−6.0%**; persistent per-type prefix
  **−1.0%**; reordering dynamic content after the prefix breakpoint **−7.6%**; all
  three **−13.6%**. Load-bearing conclusion: *"The TTL value is not the lever —
  98% of cache reuse happens within ~34 seconds."*
- **anthropics/claude-code#81389** (OPEN, 2026-07-26): parent-accumulated shared
  context is re-prefilled per child on fan-out; *"the waste scales linearly with
  fan-out width, and is worst in the pattern where fan-out is most valuable."*
  **No fix at any layer** — and this is exactly the shape of `do-in-parallel`.
- **Official docs, verbatim:** *"A subagent starts its own conversation with its
  own system prompt and tool set… It builds its own cache, starting with no cache
  hits on its first call… Subagents use the five-minute TTL even on a
  subscription."* And: *"A fork… inherits the parent's system prompt, tools, and
  conversation history exactly, so its first request reads the parent's cache."*
  A fork is the **only** documented mechanism; a named subagent's prompt
  *"replaces the default Claude Code system prompt entirely"*, so no knob makes it
  match the parent.
- **Every custom subagent loads the full CLAUDE.md hierarchy per spawn** — user
  scope, project scope, `CLAUDE.local.md`, managed policy — and docs state there
  is *"no frontmatter field or per-agent setting"* to change that.
- **Partitioning:** per-model caches, per-`effort` caches, tool-definition changes
  invalidate everything (`tools → system → messages`), and the cache is
  *"effectively scoped to one machine and directory — that includes worktrees of
  the same repository"*, while *"sessions you run in parallel in the same
  directory… read each other's cache."*

### Claims that did NOT survive verification — do not encode them

| Claim | Verdict |
|---|---|
| `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS` saves ~1,800 tokens **per call**; any file edit busts the prefix | Git status is a **startup snapshot**; docs list repo edits under *actions that keep the cache*; the number is unsourced. The var is real and does drop the subagent git snapshot — a smaller, per-spawn lever. |
| `CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP` stabilises the prefix across CC updates | Covers four deprecated Opus 4.0/4.1 ids only; docs say an upgrade rebuilds the cache regardless. |
| `ENABLE_PROMPT_CACHING_1H_BEDROCK` | Deprecated (live name `ENABLE_PROMPT_CACHING_1H`), and docs pin subagents to 5m regardless. |
| `enablePromptCaching` as an option we could set | Not public API; four open SDK issues request exposure. |
| Cache writes burn subscription quota (Q5h/Q7d), so flat-rate paths are not cost-free | **No source found.** The only adjacent doc line is about TTL on a subscription, not quota consumption. Dropped from this roadmap's argument — see § Re-opened premise. |
| A third-party cache-fix proxy as our instrument | Real (MIT, v4.3.0, 392★) but a **daemon on a listening socket** → Class B, prohibited (ADR-124, `docs/contracts/no-runtime-boundary.md`), and unnecessary: the host already emits per-leg attribution locally. |

### First-party measurement — this repo's traffic, 14-day window

Method: read `~/.claude/projects/**/*.jsonl`, keep `type=="assistant"` records
with `message.usage`, **dedupe by `message.id`+`requestId`**, split on presence of
`agentId` / `isSidechain`. Weights: read 0.1× · 5m write 1.25× · 1h write 2.0× ·
uncached 1.0×.

| bucket | calls | uncached input | cache_read | cache_write | write TTL split | share of an all-uncached bill |
|---|---|---|---|---|---|---|
| main session | 15,859 | 414.7k (0.0%) | 8.65B (**98.6%**) | 119.7M (1.4%) | 5m 16.1M / **1h 103.6M** | **12.5%** |
| subagent legs | 6,015 | 102.2k (0.0%) | 1.58B (**97.0%**) | 49.1M (3.0%) | **5m 49.1M / 1h 0** | **13.5%** |

Per-leg cold start (206 distinct `agentId`s):

- turns per leg: median **18**, mean 29.2, max 232
- **cold start (first call): median 235.5k tokens written-or-uncached; first-call cache_read share 3.8%**
- **cold starts are 69.4% of all subagent write volume** (34.2M of 49.2M tokens)
- **50.8% of raw records were replays** — un-deduped totals inflate ~2×, and the
  inflation grows with conversation length, i.e. it mimics the very defect being hunted

### Where the 235k comes from — byte census (the finding that decides the framing)

The upstream community baseline for a subagent cold start is ~37k tokens. Ours is
~6× that. Census of the always-loaded preamble:

| source | files | chars | ≈ tokens |
|---|---|---|---|
| user-scope rules (`~/.claude/rules/*.md`) | 110 | 356,161 | ~89k |
| project-scope rules (`dist/agent-src/rules/*.md`) | 110 | 350,708 | ~88k |
| project `CLAUDE.md` | 1 | 2,901 | ~0.7k |
| user `CLAUDE.md` + imported memory | 2 | 972 | ~0.2k |

**The same 110 rule filenames exist at both scopes, and all 110 differ in bytes**
(version drift between the globally installed projection and this repo's `dist/`).
Both are injected — every session and every spawn pays for two near-identical
copies of the same rule set, ~88k tokens of pure redundancy. Over 206 spawns that
is ≈18.1M tokens, ≈**37% of the measured subagent write volume**.

**Honesty caveat, load-bearing:** this double-load is a property of *this
maintainer setup* — developing the package while the same package is installed at
user scope. A consumer with one copy pays ~88k, not ~176k. So the roadmap carries
two distinct items: a **general** lever (the per-spawn cost of the always-loaded
rule set, which every consumer pays) and a **detection** item (warn when the same
rule set is present at both scopes, which only affects maintainers and
double-installers). Neither is a cache mechanism; both are payload size.

### The in-repo precedent — telegraph-speak dormancy (landed on main, verified at `f23e6aa58`)

While this roadmap was being authored, main landed exactly the mechanism Phase 3
needs, as a one-rule worked example. It is cited here rather than re-invented:

- **The measurement killed the feature, not a preference.** Telegraph-speak's own
  bench found median `vs_terse` **−9.27%** (API counts) / **−5.47%** (exact
  `cl100k_base` re-analysis) — it emits *more* tokens than a plain "be terse"
  instruction. The rule is now dormant by default, and flipping it on *"needs a
  passing output-side bench, never a preference."*
- **The load-bearing distinction is runtime-scope vs compile-time toggle**, stated
  verbatim in the rule: *"`off` does NOT stop the token cost… `compile_router.ts`
  gates this rule on `telegraph.enabled` / `telegraph.speak` and never reads
  `speak_scope`… The zero-cost dormancy lever is `telegraph.speak: false`, which
  omits the rule from `dist/router.json` entirely."* A behaviourally-inactive rule
  still ships its ~982-token body — per session **and** per spawn.
- **Verified post-merge:** `dist/agent-src/rules/` carries 110 files / 350,708
  chars and `telegraph-speak.md` is **absent** from both the project projection and
  the installed user-scope copy. The byte census above therefore still holds
  unchanged, and one ~982-token body has already left the per-spawn payload by
  exactly the route Phase 3 proposes to systematize.
- **Inherited fragility to respect:** the compile-time toggle is *"a separate
  axis, and this is its FOURTH consumer after the router compiler, the dist
  writer, and check_sync… three out of four is how #1047 blocked its own push."*
  Any per-spawn payload lever built as another toggle inherits that failure mode —
  so Phase 3 extends the existing predicate rather than adding a fifth axis.

### Adjacent roadmap on main — overlap verdict: DISTINCT, one interaction

`road-to-global-user-memory.md` (merged 2026-07-30) moves the
user-memory layer to a global root with a learning channel and an accept-gate.
Checked for overlap against this roadmap: **no shared file, no shared claim, no
shared mechanism** — that roadmap governs *what the agent remembers about the
user*; this one governs *the rate charged for bytes already being sent*. A
`grep` for token / cache / spawn / payload / budget across its 429 lines returns a
single incidental hit (a redaction note). **Do not merge the two.**

One real interaction, recorded so it is not discovered twice: the global user layer
adds a user-scope `profile.md` that, like every user-scope instruction file, is
loaded **in full on every subagent spawn**. It is small today (~100 lines), but it
lands inside the same per-spawn payload this roadmap measures — so its size is
governed by Phase 3's ceiling, not by its own roadmap. Phase 3's byte census
therefore counts it as a named source.

### Defects in code we already ship (verified)

- `pricing.ts:188-223` `reprice_with_cache(…, ttl)` is **dead code** — zero
  production callers, tests only. `orchestrator.ts:785` bills the realized cost
  with the cache-blind `estimate_cost(…)`, and Anthropic's `usage.input_tokens`
  excludes cache tokens, so **every council dollar figure omits the write premium
  and hides the read saving**.
- `clients.ts:466,480` emit `cache_control: {type:'ephemeral'}` with **no `ttl`**
  → 5m only, while debates run rounds minutes apart.
- `budget_guard.ts:72-78` `SpendEntry` is `{ts, usd, provider, model}` — no cache
  fields, so an archived roadmap's acceptance line ("the ledger carries the new
  fields") is **not met**.
- `src/scripts/cost/track.mjs` (144 lines) renders `Cache write` / `Cache read`
  columns to a human **without deduping by `message.id`** (`grep message.id` →
  zero hits) and without splitting `isSidechain` / `agentId`. Its shipped numbers
  are therefore inflated ~2× and merge subagent legs into the orchestrator bucket.
- `orchestration_record` carries `payload_hash` and a boolean `cache_hit`, both
  `null`-by-default and **read by nothing**.
- `docs/guidelines/agent-infra/api-cost-levers.md § Claude Code note` asserts
  *"prompt caching is automatic… keeping a stable prefix pays off"* — true for the
  main loop, misleading for subagent legs.
- `src/skills/subagent-orchestration/prompts/README.md:26-46` instructs reuse of a
  stable **system-prompt** prefix across siblings. On this host the system prompt
  comes from the agent definition; what the orchestrator controls is the dispatch
  **user message**. Right direction, wrong noun — and it omits the fork option and
  the per-type prefix effect (#74318: same-type sibling prefix hits **85%** within
  5 min vs **45%** without).

### Council convergence — 2026-07-30, deep debate (claude-sonnet-4-5 + gpt-4o, 2 sessions)

The council **split hard** on round 1 and the split is recorded here because it
shapes the cut:

- **Position A (sonnet):** do not reopen the prior verdict; *"the artefact treats
  observing host behavior as equivalent to having a lever to pull."* Measurement
  is *"a 20-line flag, not a roadmap"*; authoring levers are *"existing token
  discipline under a new label"*; the billing fix is *"a bug — file it, fix it,
  close it"*; consumer guidance is premature given rot risk. It also caught the
  **uncited quota claim** and rejected fork-by-default as self-defeating:
  *"if background mode changes the tool set, it invalidates the prefix, destroying
  the cache benefit that justified the fork."*
- **Position B (gpt-4o):** ship all four workstreams, narrow re-open limited to
  cold-start inefficiency plus council billing, 1h TTL on the council's stable
  prefix contingent on round gaps.

Round 2 was run on the split itself, with the byte census added as new evidence.
**Both positions converged:**

- **Two levers, not one** — unanimous. Position A: *"Two levers, not one. They
  point the same direction but enforce at different boundaries… With 206 spawns, a
  235k cold start costs 60.6M write tokens even if each subagent only produces a
  10k response. This is independent of context-window size."* Position B: *"the
  per-spawn write volume should have its own monitoring and control mechanisms."*
  This is what Position A did not have in round 1 when it called the finding
  "existing discipline wearing a new hat": an artefact can sit inside the
  context-window cap and still dominate the write bill because it is re-written on
  every one of 206 spawns — and ~37% of that volume is a duplicate copy no budget
  rule currently forbids.
- **Measurement ships as real scope** — Position A explicitly conceded: *"I was
  wrong to dismiss it as 'add a flag'… a measurement harness that reports inflated
  numbers is worse than none, and the 50.8% replay rate means the trap is not
  edge-case."*
- **Cold-start ceiling ships**, as an addendum to the existing token-budget
  discipline rather than a parallel track. Position A proposed the concrete
  numbers: median ≤ **40k**, p95 ceiling **50k** (anchored to the ~37k upstream
  baseline).
- **Fork-by-default is CUT** by both. Position A: *"unfalsifiable because it
  requires predicting the cache-sharing benefit before the fork happens… if
  background mode changes the tool set, it invalidates the prefix, so the cache
  benefit that justified the fork never arrives."* An **ordering rule** ships instead.
- **The quota argument is dropped** (A: *"an unverified premise should not drive
  roadmap scope"*; B preferred verifying it as a step). Dropped — nothing left in
  the cut depends on it.
- **A version-stamped "known upstream cost, no package fix" note ships** — both agreed.
- **Billing correction is a bug, not a research track** — both agreed. It stays in
  the plan because the work is real (dead code + wrong shipped numbers + missing
  ledger fields), but it is labelled as a correctness fix with no cost story
  attached until C-4 says otherwise.

**One council conclusion is NOT adopted, with reason.** Both members voted to cut
the 1h-TTL item, but both justified it with the same factual error: *"the package
cannot set TTL (host-controlled)"*. That is true for host subagents and **false for
our own council calls**, where this repo builds the `cache_control` object itself
(`clients.ts:466,480`). The underlying caution is adopted anyway on better grounds
— upstream measured *"the TTL value is not the lever"* and we have no inter-round
gap distribution — so the item survives only as **measure-the-gap-first**, with
`5m` remaining the default until a pre-registered threshold clears.

### Scope boundary — what this roadmap is NOT

- **Not** a subagent cache mechanism. Request construction is host-owned and
  unreachable; the 2026-07-14 verdict's operative conclusion stands (§ below).
- **Not** a reopening of the parked context-token **projection** work
  (`agents/roadmaps/later/road-to-token-saving.md`) — that governs how many rule
  tokens enter a context window; this governs the rate charged for bytes that are
  already loading, and the per-spawn multiplication of them.
- **Not** an amendment to the pre-registered public claim
  `orchestration-dispatch-net-win` in `docs/CLAIMS.md`, nor to the roadmap owning it.
- **Not** a change to worktree-per-task practice. Cache scope is per-directory, so
  our footprint does fragment the cache — but isolation is a deliberate governance
  property. Measure it; do not trade it.

### The re-opened premise, stated narrowly

The 2026-07-14 verdict rested on: (a) subagents are host-cached ⇒ nothing to gain;
(b) they are unreachable ⇒ nothing to build; (c) team reviews are flat-rate ⇒ no
dollar impact.

- **(b) holds, unchanged.** No code here touches subagent requests. Every item
  below is measurement, payload size, or authoring discipline — never a mechanism.
- **(a) is narrowed, not falsified.** The host caches (97% read share, confirmed).
  What it re-writes on every cold start is authored here. "Unreachable request
  construction" was never the same claim as "unreachable payload size".
- **(c) is left alone.** The quota argument that would have weakened it is
  **unsourced and is dropped**. Team reviews stay out of scope on their original
  flat-rate reasoning.

Re-open scope: **measurement + payload size only.** Do not build a caching
mechanism for teams or subagents — restated as a refusal in Phase 5.

## Phase 1 — Make the two shipped cost surfaces correct (a bug fix, not a research track)

- [x] Extract transcript parsing into `src/scripts/_lib/cc_transcript.ts`:
      iterate `~/.claude/projects/**/*.jsonl`, keep assistant records with
      `message.usage`, **dedupe by `message.id`+`requestId`**, and expose per
      record: bucket (`main` | `subagent` via `agentId`/`isSidechain`), `agentId`,
      the four token counts, and the `ephemeral_5m` / `ephemeral_1h` write split.
      <!-- verify: unit test on a fixture transcript containing replays, a sidechain leg, a zero-read first call, and both TTL tiers; dedup ratio asserted, values derived not hardcoded -->
      <!-- done 2026-07-30 — 9 vitest cases: replay pair dedupes to one, sidechain/agentId leg classified subagent, zero-read first call, both TTL tiers; expectations derived from fixture constants -->
- [x] Fix `src/scripts/cost/track.mjs` to consume that lib: dedupe (its current
      output is inflated ~2×) and add an agent split so subagent legs stop being
      merged into the orchestrator bucket. Report the dedup ratio in the output so
      the inflation is visible rather than silent.
      <!-- verify: before/after run on the same transcripts shows the corrected total and a non-zero dedup ratio -->
      <!-- done 2026-07-30 — logic MIRRORED, not imported: track.mjs ships to consumers and runs on bare node, tsx is a devDependency and _lib/ has no compiled output, so importing the .ts lib would break every consumer. Measured on real transcripts: dedup ratio 57.3%, total $1847 → $1031, subagent legs split out. Same pass fixed encodeProjectPath (dots were not encoded, so no worktree cwd ever resolved). -->
- [x] Route the council's **realized** cost through `reprice_with_cache` instead of
      the cache-blind `estimate_cost` at `orchestrator.ts:785`, passing the cache
      fields already captured on `CouncilResponse` plus the TTL actually requested.
      Leave `estimate_cost` cache-agnostic for the pre-flight gate — the
      conservative 0%-hit default is a deliberate prior decision.
      <!-- verify: a live 3-round debate reports a realized cost differing from the pre-flight estimate in the cache direction; unit test pins the arithmetic -->
      <!-- done 2026-07-30 — realized site only; pre-flight estimate_cost left cache-agnostic by design. Unit test computes the expectation from the 0.1/1.25/2.0 multipliers, no dollar literal -->
- [x] Widen `budget_guard.ts` `SpendEntry` + `record_spend` with the cache counts
      and TTL tier, making the archived acceptance claim true.
      <!-- verify: a ledger entry from a live run carries non-zero cache fields -->
      <!-- done 2026-07-30 — additive optional fields; a legacy entry without them still parses, and an entry that omits them stays byte-identical (regression guard) -->
- [x] Extend `cost-summary/v1` (`src/scripts/cost_summary.ts`,
      `docs/contracts/cost-summary-schema.md`) additively with the cache fields;
      note in the contract that older records lack them.
      <!-- verify: a record without cache fields still parses; schema doc and script agree -->
      <!-- done 2026-07-30 — stays cost-summary/v1: the contract's own stability section says field additions are non-breaking and consumers MUST ignore unknown fields. Missing fields aggregate as 0 -->
- [x] Leave `.agent-prices.md` untouched — byte-frozen row format, pinned by
      consistency tests. Multipliers stay derived constants in `pricing.ts`.
      <!-- verified 2026-07-30 — git status --porcelain -- .agent-prices.md: clean -->

**Exit criteria:** both human-facing surfaces (council run summary, `cost:report`)
report cache-aware numbers, deduped, with subagent legs separated.
**Rollback:** the lib is additive; reverting the two call sites restores prior behaviour.

## Phase 2 — Pre-register the claims the rest of the roadmap can fail

- [x] Add a `cache-realization` report mode over the Phase 1 lib emitting, per
      bucket and per `agentId`: `read_share`, `weighted_input_units`
      (0.1/1.25/2.0/1.0), and a `cold_start` section (first call per leg:
      `cache_creation + input` vs `cache_read`; median, mean, share of leg write
      volume). Header states the metric definition —
      `billable_input = input_tokens + cache_read + cache_creation`, and that
      `input_tokens` excludes cache tokens — plus the host version the run observed.
      <!-- verify: run reproduces the baselines above within ±15% on this repo's transcripts -->
      <!-- done 2026-07-30 — src/scripts/cache_realization_report.ts (Class A: no socket, no daemon, no network) + 22 vitest cases. Real run reproduces every baseline inside ±15%: main read_share 98.5% (base 98.6%), subagent 96.7% (97.0%), cold-start share 69.7% (69.4%), dedup 52.4% (50.8%) -->
- [x] Record the pre-registered claims, thresholds fixed **before** any
      optimization lands:
      - **C-1 cold-start dominance** — cold starts are **≥50%** of subagent write
        volume (baseline 69.4%). Falsified below 50% → Phase 3 loses its premise
        and is cancelled.
      - **C-2 duplicate-scope share** — when the same rule set is installed at both
        user and project scope, the redundant copy is **≥25%** of subagent write
        volume (baseline ≈37%). Falsified → the detection item ships as a note, no
        warning.
      - **C-3 preamble reducibility** — a measured reduction of the per-spawn
        always-loaded payload moves median cold-start tokens by **≥15%** with no
        regression on the existing trigger/outcome evals. Falsified → Phase 3
        ships as measurement only, no ceiling.
      - **C-4 council mispricing magnitude** — cache-aware repricing changes the
        reported realized cost of a real 3-round debate by **≥5%**. Falsified →
        Phase 1 stands as a pure correctness fix with no cost story attached.
      - **C-5 worktree fragmentation** — the same dispatch in a fresh worktree
        shows a first-call `cache_read` share **<10%** of the same dispatch in an
        established directory. Falsified (≥50%) → the documented per-directory
        scoping does not cost what the docs imply; say nothing about worktrees.
      - **Honest-null condition:** if C-1 and C-4 both fail, Phases 3–4 are
        cancelled, Phase 1 stands alone as a correctness fix, and this roadmap
        archives with the measurement retained.
      <!-- done 2026-07-30 — the report evaluates each claim and prints confirmed/falsified/pending with its measured value; verdicts recorded below -->
- [x] Attach the re-verification procedure to the report itself: one command plus
      `claude --version`, and the two drift thresholds that trigger a re-run
      (`read_share` below 90%, or cold-start share below 50%).
      <!-- done 2026-07-30 — every run ends with the reproduce command, claude --version (2.1.220 observed), and the two drift thresholds -->

### C-3 pre-registration — written 2026-07-30, BEFORE the first measurement run

C-3 was `pending` because no reduction had shipped. This registers the exact
reduction, metric and threshold **before** any measurement, so the result cannot
be fitted to the outcome.

**The reduction under test: scope de-duplication of the rule projection.** The
package projects the same rule suite into one host session twice — `generate-tools`
writes per-tool rule symlinks at project scope (`.claude/rules/`, 94 in scope
here) while a global install writes the same suite at user scope
(`~/.claude/rules/`, 110). Both load on every subagent spawn. De-duplication
emits the body once and skips the redundant twin.

**Why this is NOT the locked thin-projection mechanism.** Thin projection was
measured at a 36.2% win-rate against a 48% floor and stays DISABLED: it makes
rule bodies *trigger-gated*, so the model may never see a rule it would have
needed. De-duplication changes nothing about what the model sees — the identical
text still loads, in full, once instead of twice. Mechanism-match check per the
decision-revisit gate: different mechanism, so the lock does not apply. Router
tiering is untouched; no rule becomes conditional.

**Content-identity gate (load-bearing).** A twin is de-duplicated **only when it
is byte-identical**. Verified precondition on this machine: all 110 shared
filenames **differ in bytes** (a globally installed release vs this repo's
`dist/`), so a naive filename-keyed dedup would silently let an older copy win.
Byte-identity is what makes the reduction content-neutral, and therefore what
makes "no regression on the existing trigger/outcome evals" true *by
construction* rather than by measurement.

**Metric.** `preamble_byte_census` median cold-start payload tokens, on a
two-scope fixture representing the condition the reduction targets: a consumer
carrying the SAME package version at user and project scope (the byte-identical
case). Reported alongside the same census on this machine, where version drift
makes the dedup correctly inert.

**Threshold.** ≥ 15% reduction of the median cold-start payload on that fixture.

**Honest-null consequence, fixed in advance.** Below 15%: the payload ceiling and
the per-rule dormancy routing are marked `[-]` cancelled **with the measured
number as the reason**, not quietly dropped. At or above 15%: both proceed, and
the shipped default for the dedup remains a separate governance call — this
claim measures the mechanism, it does not authorise flipping a consumer default.

### C-3 measured result — 2026-07-30, after the pre-registration above

Reproduce: `./scripts-run src/scripts/measure_scope_dedup`.

| condition | byte-identical twins | rules payload before → after | removed |
|---|---|---|---|
| **Fixture** (consumer: same version at both scopes) | 110/110 | 175,354 → 87,677 tok | **87,677 tok** |
| **Control** (this machine: releases drift) | 0/110 | unchanged | 0 tok |

**Reduction: 38.0% of the measured median cold-start** (87,677 of 230,556 tok), or
50.0% of the two-scope rules payload. Threshold was ≥ 15% → **MET**.

The control matters as much as the result: on a maintainer machine the two scopes
hold different releases, so the byte-identity gate makes the dedup **correctly
inert** (0/110) instead of silently letting the older globally-installed copy win.

End-to-end proof, not just arithmetic: with `projection.scope_dedup: true` and a
byte-identical user scope, `condense --generate-tools` skipped all 110 project-scope
rule links (`.claude/rules` → 0 files) while the host still loads the same 110 rules
from user scope. Default is **off**; flipping a consumer default is a separate
governance call, and this claim does not authorise it.

> **Condition on the 38.0% — added 2026-07-31, after the number was published.**
> The figure was measured on a **byte-identical two-scope fixture**, and that
> condition is currently **unreachable in production for every consumer**, not
> just on this machine. `_tag_installed_file` stamps `package:` / `source_path:`
> into every installed rule unconditionally (`install.ts:2723`, `install.ts:2725`),
> while the in-repo projection stamps nothing — two writers, deliberately
> different output. Aligning versions yields **0/110** twins, not 110/110,
> because it only collapses body diffs into provenance diffs. The number stands
> as measured; what it measures is the mechanism's ceiling under a condition that
> nothing currently makes real — and making it real was **decided against**
> (2026-07-31), so this is a permanent condition until a reopen fires, not a
> pending step. Do not cite it as a realised saving. Cause and line references:
> [`cache-economy-refusals`](../../settings/contexts/cache-economy-refusals.md)
> § Honest null; the decision and the preserved candidate analysis:
> [`dedup-reachability-refusal`](../../settings/contexts/dedup-reachability-refusal.md).

### Measured verdicts — 2026-07-30, host CC 2.1.220

| claim | threshold | measured | verdict |
|---|---|---|---|
| C-1 cold-start dominance | ≥50% of subagent write volume | **69.7%** | **confirmed** |
| C-2 duplicate-scope share | ≥25% of subagent write volume | **38.5%** | **confirmed** |
| C-3 preamble reducibility | ≥15% median cold-start reduction | **38.0%** | **confirmed** 2026-07-30 · fixture-conditional, see the note above |
| C-4 council mispricing | ≥5% change in realized cost | **5.5%** | **confirmed** |
| C-5 worktree fragmentation | first-call read share <10% of an established directory | **69.1%** | **FALSIFIED** |

**C-5 is the one that changes the plan.** Pooled first-call `cache_read` share across
24 worktree transcript directories vs the established checkout came out 2.8% vs
4.0% — a ratio of 69%, far above the ≥50% falsification line. Per the
pre-registration, the consequence is fixed in advance and now binds: **the
package says nothing about worktrees.** The per-directory cache scoping the docs
describe does not cost what its framing implies, so no guidance, no warning, and
no practice change ships — and the Phase 5 refusal is resolved, not conditional.

**The honest-null condition did not fire:** it required C-1 **and** C-4 to fail;
both are confirmed, so Phases 3–4 keep their premise.

**Exit criteria:** every later phase has a numbered claim that can kill it.
**Rollback:** report mode is read-only; deleting it removes the phase.

## Phase 3 — Per-spawn payload: the one large lever we own

- [x] Attribute the measured cold start to its sources with a byte census over the
      projected artefacts: user-scope rules, project-scope rules, `CLAUDE.md`
      hierarchy, the global user `profile.md` (once the user-memory layer lands),
      preloaded `skills:` content, tool definitions, dispatch prompt.
      <!-- verify: the buckets sum to within ±10% of the measured cold-start median -->
      <!-- done 2026-07-30 — src/scripts/preamble_byte_census.ts. Measured: user-scope rules 89,040 tok · project-scope rules 87,677 · CLAUDE.md hierarchy 968 · skills catalog 14,197 · profile.md 0 (layer not written yet). File-measurable = 83.2% of the 230,556-token median; the remainder is an explicitly labelled RESIDUAL bucket (tool defs + dispatch prompt) because no local transcript field carries the request payload — the ±10% sum check is tautological once that bucket exists, and the code says so -->
- [x] Report per-rule per-spawn cost in the census, so a dormancy decision has the
      same kind of number telegraph-speak had (~982 tokens) instead of an opinion.
      A rule that is behaviourally inactive but still projected pays full write
      cost on every spawn — that is the class the census must make visible.
      <!-- verify: the census lists the top-10 always-loaded rules by per-spawn token cost -->
      <!-- done 2026-07-30 — top-10 project-scope rules by per-spawn cost: domain-safety-pii 2,070 · domain-safety-disclaimer 1,875 · senior-engineering-discipline 1,670 · legal-safety-floor 1,606 · roadmap-progress-sync 1,479 · token-budget-discipline 1,435 · autonomous-execution 1,431 · media-governance-routing 1,421 · downstream-changes 1,359 · code-provenance 1,352 -->
- [x] Ship duplicate-scope **detection** (C-2): when the same rule filenames are
      present at both user and project scope, the existing doctor/consistency
      surface warns once with the measured token cost and names which copy is
      authoritative. Detection only — never delete a user's files.
      <!-- verify: warning fires on this machine's setup and stays silent in a single-scope fixture -->
      <!-- done 2026-07-30 — new duplicate-scope-rules check on the EXISTING cmd_doctor surface (no new command), sharing one census lib with the C-2 evaluation so the two can never disagree. Measured 110 shared filenames / 86,803 redundant tokens per spawn. Detection only: warns, names the authoritative copy, modifies nothing -->
- [x] Record the finding against the existing always-rule concentration cap as a
      **second, independent argument**: the cap governs context-window share; this
      governs per-spawn write volume, multiplied by spawn count. Cite the parked
      projection decision, do not re-derive it, and state which mechanism each
      argument belongs to.
      <!-- done 2026-07-30 — noted in docs/contracts/load-context-budget-model.md: per-spawn write volume is a second, independent argument for the cap; the parked context-token-projection decision is cited, not re-derived -->
- [x] Publish a per-spawn payload ceiling **only if C-3 holds**, enforced by the
      existing byte-census gate rather than a new one. Candidate numbers from the
      council: median ≤ **40k**, p95 ≤ **50k** tokens of cold-start payload,
      anchored to the ~37k upstream baseline. Ship them as an addendum to the
      existing token-budget authoring discipline, not as a parallel budget system.
      <!-- verify: the gate fails on a deliberately oversized fixture and passes on the current tree -->
      <!-- deferred 2026-07-30 — C-3 is pending, so the gate is NOT wired. Candidates (median ≤40k / p95 ≤50k) are documented with their basis and explicitly labelled not-enforced. Removing the duplicate copy would model a 37.6% reduction (labelled modelled, never measured) — C-3 needs a real intervention plus a live re-measure before any ceiling is enforced -->
      <!-- done 2026-07-30 — C-3 confirmed at 38.0%, so the gate is now wired: check_preamble_payload_budget + src/config/preamble-payload-budget.json, registered in both CI pipelines. Shipped as a RATCHET, not the literal 40k/50k: the deterministic in-repo payload is 102,599 tok, so a hard 40k gate would be red on day one and would train the reader to ignore the line. The 40k/50k target stays recorded as the destination. Red-proofed: +9,350 tok turns it red, restoring turns it green; 7 tests pin both directions plus the machine-independence of the gated buckets -->
- [x] Where the census names a rule whose per-spawn cost is not earned, route the
      decision through the **existing compile-time dormancy predicate** (the
      `telegraph.speak` axis and its four consumers) — extend that predicate, never
      add a fifth axis, and require the same evidence bar telegraph-speak met: a
      measurement first, dormancy second.
      <!-- verify: no new toggle axis is introduced; the existing predicate's consumers all agree (check_sync + check_bridge_derivation pass) -->
      <!-- deferred 2026-07-30 — the census now supplies the per-rule numbers, but routing a specific rule to dormancy requires the same evidence bar telegraph-speak met: a per-rule output-side bench, which does not exist. Building the census was in scope; making the dormancy call is not -->
      <!-- done 2026-07-30 — the route is documented at the existing predicate (_lib/compile_time_toggles.ts header): candidate from the census cost ranking, then an output-side bench against the kill-criterion, then an entry in COMPILE_TIME_TOGGLES keyed on a real setting. No fifth toggle axis (the predicate already has four consumers), and NO rule is flipped here: the evidence bar is a bench that does not exist yet, and cost alone never justifies dormancy -->
- [x] Wire a reader for the two dormant telemetry fields: join the recorded
      `payload_hash` against observed per-leg cache reads so prefix-stability drift
      becomes visible. No hook — the no-hook capture decision stands.
      <!-- verify: a cohort dispatched with a deliberately unstable payload shows a lower read share than a stable one -->
      <!-- done 2026-07-30 — src/scripts/orchestration_payload_hash_drift.ts joins payload_hash against cache_hit into stable/unstable cohorts, reusing readAuditLines. No hook (the 2026-06-30 no-hook decision stands). Real run: 0 lines carry both fields yet — reported as an honest empty state, explicitly NOT a green pass -->
- [x] Refuse auto-tuning: `cache_hit` is a proxy for host behaviour we do not
      control, and the loop-engineering boundary requires a direct measure before
      any measure→adjust automation. Report it; never act on it.
      <!-- done 2026-07-30 — refusal recorded in the telemetry context against the loop-engineering boundary: report the proxy, never act on it -->

**Exit criteria:** the 235k median is attributed to named sources, and the
duplicate copy is detected rather than inferred.
**Rollback:** census and warning are additive and independently revertable.

## Phase 4 — TTL and authoring guidance, gated and version-stamped

- [x] Measure the council's inter-round gap distribution first: write the observed
      gap between a round's cache write and the next round's read into the session
      artefact.
      <!-- verify: two runs — rounds seconds apart vs a >5-minute gap — produce different recorded gaps -->
      <!-- done 2026-07-30 — run_debate measures the wall-clock gap between a round finishing and the next starting via an injectable clock; written to the session artefact as prompt_cache_round_gap_ms (null on round 1). No new spend -->
- [x] Add `prompt_cache.ttl: 5m | 1h` to the council config contract, default
      **`5m`**, threaded into both breakpoints (1h breakpoint before any 5m one,
      per the API ordering rule). Enable 1h **only** if ≥40% of a 30-debate sample
      shows inter-round gaps ≥5 minutes; if a `ttl: 1h` debate costs more weighted
      units than the same debate at `5m`, the default stays `5m` permanently and
      the key is documented as a niche override. Blanket-1h is a measured **+8.6%**
      upstream regression — do not repeat it.
      <!-- verify: unit test asserts breakpoint order and that ttl reaches only the stable prefix -->
      <!-- done 2026-07-30 — key threaded end-to-end into BOTH breakpoints, default 5m (which omits the ttl field entirely, so the wire shape is byte-identical to before). assertCacheBreakpointOrder enforces 1h-before-5m. 1h is NOT enabled anywhere; the falsification condition sits next to the key -->
- [x] Say nothing new about host TTL: subagents are host-pinned to 5m and
      `ENABLE_PROMPT_CACHING_1H` is documented as not applying to them.
      <!-- done 2026-07-30 — no env-var recommendation for subagent TTL ships; the contract states subagents are unaffected by this key -->
- [x] Correct `api-cost-levers.md § Claude Code note`: keep "automatic for the main
      loop"; add that a **named subagent builds its own cache at 5-minute TTL with
      no first-call hit**, that a **fork reads the parent's cache**, and that the
      cold-start preamble is re-written per spawn. Stamp the host version verified.
      <!-- verify: check_token_optimizer_freshness still passes on the catalog row -->
      <!-- done 2026-07-30 — main-loop claim kept, plus: a named subagent builds its own cache at 5m TTL with no first-call hit, a fork reads the parent cache, the cold-start preamble is re-written per spawn. Stamped CC 2.1.220 / 2026-07-30. check_token_optimizer_freshness: 0 drift signals -->
- [x] Fix the noun in `subagent-orchestration/prompts/README.md` (dispatch prompt,
      not the subagent's system prompt) and add the sibling-uniformity rules that
      follow from partitioning: same model, same `effort`, same tool set across a
      cohort, dispatched promptly rather than trickled; per-type prefix hits 85%
      within 5 min vs 45% without.
      <!-- done 2026-07-30 — dispatch prompt, not system prompt; plus sibling uniformity (same model/effort/tools, dispatched promptly) with the measured 85%-within-5min vs 45% figures -->
- [x] Ship the fork-vs-subagent rule as **ordering, not default** — adopted from
      the council's Position A: *tool and scope fit is first-order; cache
      inheritance is second-order.* A fork is preferred when the child's work is a
      continuation of the parent's task under identical tools and constraints; a
      named subagent when it needs isolation, a different tool set, or nested
      dispatch. State the fork's costs: it cannot nest, and it forces background
      mode, which changes the tool set and therefore the very prefix that
      motivated the fork.
      <!-- verify: the shipped rule contains no "always fork" phrasing and names both costs -->
      <!-- done 2026-07-30 — SKILL.md form gate + a dispatch-primitive output in auto-dispatch-classification.md. Tool/scope fit first-order, cache second-order; the fork costs (cannot nest, forces background mode which changes the tool set and therefore the prefix) are stated. No always-fork phrasing -->
- [x] Name the unfixable, once, version-stamped, in a `## Known upstream costs`
      block on the existing `api-cost-levers.md` surface (not a new root doc — no
      surface sprawl): fan-out re-prefills parent-accumulated context per child
      (upstream issue open, no fix at any layer, and `do-in-parallel` has exactly
      that shape); host subagents are pinned to 5-minute TTL. Each entry carries
      the host version observed and the re-verification command, so it degrades
      into a dated observation rather than a false promise when upstream changes.
      <!-- verify: every entry in the block carries a version stamp and a command; no entry implies a package fix -->
      <!-- done 2026-07-30 — ## Known upstream costs table on api-cost-levers.md (no new root doc): fan-out re-prefill + the subagent 5m pin, each with the host version and its re-verification command -->

**Exit criteria:** every host-behaviour sentence shipped to consumers carries the
verified host version and the one-command re-verification.
**Rollback:** each surface is an independent doc edit; the TTL key defaults to
today's behaviour.

## Phase 5 — Refusals, recorded so nobody rebuilds them

- [x] Record each refusal with its reason in the closing note, and in the relevant
      contract's see-also where it is a durable boundary:
      - **Interception proxy** (any `ANTHROPIC_BASE_URL` shim) — Class B daemon +
        listening socket + egress; prohibited, and unnecessary given local per-leg
        attribution.
      - **Beta-flag OTel join** (`agent_id` spans) — richer but gated on two beta
        flags and an OTLP sink; revisit only if the transcript fields disappear.
      - **Blanket 1h TTL** anywhere — measured +8.6% worse upstream.
      - **Any env-var recommendation not verified in official docs** — three of the
        four originally proposed levers failed verification.
      - **Cache-hit-driven auto-tuning** — proxy signal on host-controlled behaviour.
      - **Worktree practice changes for cache reasons** — **refused outright, C-5
        falsified 2026-07-30** (measured 69.1% vs the <10% the claim required). The
        measurement was run, the documented per-directory scoping does not cost
        what its framing implies, so no guidance ships and governance isolation is
        never traded for a cache rate.
      - **A caching mechanism for teams or subagents** — the 2026-07-14 verdict's
        operative conclusion, unchanged.
      - **The subscription-quota argument** — dropped as uncited; do not
        reintroduce it without a primary source.
      <!-- done 2026-07-30 — promoted to agents/settings/contexts/cache-economy-refusals.md (durable: a roadmap is archived, a context is not) and linked from api-cost-levers.md § See also. Contracts are NOT edited to cite a roadmap file — the promote-then-link pattern keeps check_no_roadmap_refs green -->

**Exit criteria:** the refusal list is discoverable from the surfaces it constrains.
**Rollback:** none needed — documentation only.

## Acceptance criteria

- [x] One deterministic report (no daemon, no beta flag, no network) produces per-
      bucket and per-leg cache figures, deduped, with the dedup ratio and host
      version in its output.
      <!-- verified — cache_realization_report + preamble_byte_census run with no daemon, no beta flag, no network; both print the dedup ratio and the observed host version -->
- [x] `track.mjs` and the council's realized cost are both cache-correct; a live
      debate's ledger entry carries cache token fields.
      <!-- partial — repricing verified LIVE from the worktree: a real 1-round debate reported cost_usd_actual 0.010016 through reprice_with_cache, and the artefact carries the new prompt_cache_round_gap_ms field. track.mjs verified against real transcripts (dedup 57.3%, subagent legs split). NOT shown live: a ledger ENTRY — orchestrator.ts gates record_spend on budget.daily_limit_usd > 0, unset in this environment, so no ledger file is produced at all. The cache fields are threaded at that call site and round-tripped by unit tests -->
      <!-- closed 2026-07-30 — the ledger is now PROVEN LIVE. The gap was not configuration but wiring: daily_limit_usd existed on CostBudget and gated the append, yet the typed config had no such field and load_settings replaces the ai_council block with a synthesized one, so a raw YAML key could never reach it. Threaded end to end (default still 0), then a real 1-round debate with the cap temporarily at 5.0 wrote two entries carrying cache_read_input_tokens, cache_creation_input_tokens and cache_ttl: 5m. Temporary config change reverted and verified byte-identical to its backup -->
- [x] C-1 … C-5 are each marked confirmed or falsified, and every phase whose claim
      failed is cancelled in the file rather than quietly dropped.
      <!-- partial — C-1 confirmed 69.7%, C-2 confirmed 38.5%, C-4 confirmed 5.5%, C-5 FALSIFIED 69.1% (and its dependent refusal resolved in Phase 5). C-3 is pending BY CONSTRUCTION: it measures the effect of a reduction intervention, and no reduction has shipped — the two steps that depend on it are [~], not silently dropped -->
      <!-- closed 2026-07-30 — all five now resolved: C-1 confirmed 69.7%, C-2 confirmed 38.5%, C-3 confirmed 38.0% (the reduction was built and measured against a threshold registered beforehand), C-4 confirmed 5.5%, C-5 FALSIFIED 69.1% with its dependent refusal resolved. No claim is left pending -->
- [x] The council TTL default remains `5m` unless the 30-debate gap sample clears
      40%; the falsification condition sits next to the key.
      <!-- verified — default 5m (which omits the ttl field entirely, so the wire shape is unchanged); the 40%-of-30-debates condition and the cost-comparison falsifier sit next to the key in the config contract -->
- [x] The duplicate-scope condition is detected with its measured cost, and no
      user file is ever deleted by the package.
      <!-- verified — doctor check warns with 110 shared filenames / 86,803 redundant tokens per spawn, names the authoritative copy, and modifies nothing; silent on a single-scope fixture -->
- [x] Both corrected guidance surfaces state what the package controls and what it
      does not, version-stamped, with no implied fix for the unreachable parts.
      <!-- verified — api-cost-levers.md § Claude Code note + § Known upstream costs (host-version stamped, re-verify command per entry) and prompts/README.md (dispatch prompt, sibling uniformity, fork ordering). check_token_optimizer_freshness: 0 drift -->
- [x] The refusal list is recorded; no proxy, no beta dependency, no auto-tuning,
      no subagent caching mechanism, and no quota claim ships.
      <!-- verified — promoted to agents/settings/contexts/cache-economy-refusals.md and linked from api-cost-levers.md; check_no_roadmap_refs green, so the durable record cites no roadmap file. Nothing refused was shipped -->
