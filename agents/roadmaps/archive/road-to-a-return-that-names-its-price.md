---
complexity: lightweight
status: ready
tree_pin: 5a66c1bf19
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_offset_exempt: "Opened and closed in one change on the owner's invocation of 2026-11-01 (analyze the round, then /roadmap:process-full, PR and merge): it is archived in the same PR, so the active count is unchanged. Owner search at 5a66c1bf19 (grep -rlF for prompt_cache, recache_tokens_if_cold, prompt_cache_likely_expired over agents/roadmaps, later, stubs): only stubs/road-to-a-limit-the-host-actually-signals (owns the live-host observation, receives Phase 0) and archived roadmaps; src hits are council API caching, a different subject."
relates:
  - slug: road-to-a-fill-the-session-sees-coming
    relation: extends
    note: "Shares its status-line segment and doctor row. 3.2 here is folded into its 1.2 instead of a second row."
  - slug: stubs/road-to-a-limit-the-host-actually-signals
    relation: feeds
    note: "Receives the three live-host probes (former Phase 0): they need an observed session, not effort."
  - slug: stubs/road-to-a-quota-notice-that-earned-its-bands
    relation: disjoint
    note: "Owns the plan-window band values; nothing here changes them."
  - slug: archive/road-to-token-economy-cache
    relation: respects
    note: "Its ban on TTL keepalive stands (K1)."
---
# Road to a return that names its price

> **Source:** `agents/tmp.old/inbox-2026-11-b/` (consolidated final draft,
> its ChatGPT predecessor and the chat transcript; true source recorded
> encrypted in the round's intake note). Related points read from round
> files `links/P05` (step 3.5, resume fields) and `ponytail` F7 (prefix
> stability — a different subject, not taken here).
> **Arrivals:** 1 — `inbox-2026-11-b` (2026-11-01).
>
> **Owner demand (transcript, turn 1):** warn the user on sending a message
> when the prompt cache is gone because they waited too long, and state up
> front the approximate tokens of continuing versus continuing after `/clear`
> (with the continuity record).

## Goal

When a user returns to a session whose prompt cache has expired, AC says so
with the first prompt (user notice) and, where the status-line tap runs,
before sending — with the numbers: what continuing re-processes, what a
`/clear` start costs here, and what the continuity record adds. Silent while
warm, after a compaction already shrank the history, and on turns the host
starts itself. No new command, no block, no keepalive.

## Defects at the pin (all verified at `5a66c1bf19`)

| ID | Defect | Tree evidence |
|---|---|---|
| F1 | The tap drops the host's `prompt_cache` object. | `_lib/quota_ledger.ts:93-113` |
| F2 | The context line goes silent 10 minutes after the last snapshot — exactly when the cache is cold. | `_lib/pressure.ts:47`, `sessionContextFill` |
| F3 | "same task → /compact" is wrong on a cold cache (a cold `/compact` re-reads the full history uncached). | `quota_notice_hook.ts` `contextLine` |
| F4 | Resume carries host cost fields AC never reads. | `grep -rn prompt_cache_likely_expired src/` empty; `quota-notice` not on claude `session_start` |
| F5 | Without the tap there is no cache data; counters lack last-response time and TTL. | `_lib/session_eol.ts` `EolCounters` |
| F6 | The `/clear` start is unmeasured; counters keep only the final context. | `_lib/session_eol.ts` `final_context_tokens` |
| F7 | Host-started turns are not filtered by `quota-notice`. | `quota_notice_hook.ts` `suppression`; filter exists at `_lib/prompt_shape.ts` `isSyntheticPrompt` |
| F8 | `context-fill.json` is one file per workspace. | handed to the fill roadmap, not read here |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Host numbers win (`recache_tokens_if_cold`, `expires_at`); the transcript counters are the fallback. | statusline doc prompt-cache fields | 4.1 shows the host figure off by > 10 % |
| D2 | owner-ruled | owner (tree) | No block; the notice informs. | `quota_notice_hook.ts` header ("ruled out stopping") | the owner asks for a one-shot block |
| D3 | reversible-technical | agent | Before-send warning is the status line, as an absolute clock, not a countdown. | the line re-runs at `expires_at`, otherwise only on triggers | users ask for a countdown |
| D4 | reversible-technical | agent | Notice only when cold continuing re-processes ≥ 2× the measured `/clear` start; with no measurement yet, ≥ 50,000 tokens (stated default, not measured). | no measured band exists | 4.1 shows the line fires where nobody acts |
| D5 | reversible-technical | agent | Tokens for every login; money only when `billing_class` is `metered`. | `_lib/billing_class.ts`; plan-quota weighting unpublished | Anthropic documents plan-quota weighting |
| D6 | reversible-technical | agent | One AC status line: the cache part joins the quota segment. | `runTap` prints one AC segment | — |
| D7 | reversible-technical | agent | Notice text stays English like every other `quota-notice` line. | existing lines in `quota_notice_hook.ts` | users ask for localised notices |

## Phase 1 — Carry the state

- [x] **1.1 Ledger keeps the cache subset.** `snapshotFromStatusPayload`
      stores `warm`, `ttl`, `expires_at`, `recache_tokens_if_cold` (numbers
      and enums only).
      verify: `tests/scripts/_lib/quota_ledger.test.ts` case with a `prompt_cache` payload. (corrected-from-reproduction: the draft named `statusline_tap.test.ts`, which does not test the snapshot)
- [~] **1.2 Fallback counters.** `session_eol` counters gain <!-- deferred-resolution: carried-to=road-to-a-return-that-names-its-price-carried -->
      `last_response_at`, `last_write_ttl` and `first_context_tokens`.
      verify: `tests/scripts/_lib_session_eol.test.ts` fixture with a 1h write.
      Deferred 2026-11-01, blocked-by: cache-notice-chunk-ceiling — built and
      measured twice — in `session_eol` (+782 B in the dispatch bundle, which
      sits ~281 B under its ceiling) and as a transcript-tail reader in the
      `quota_notice` chunk (23,958 B against 22,800). Both ceilings rise only
      by a ratified edit. The 4.1 replay then showed a transcript-only cold
      reading is wrong on 46 % of returns, so the item needs a decision before
      a raise.
- [x] **1.3 Facts do not go stale.** Context fill is read from the session's
      last snapshot whatever its age; `STALE_AFTER_MS` keeps guarding only the
      plan-window projection (F2).
      verify: `tests/scripts/quota_notice_hook.test.ts` case 30 min after the last snapshot still prints the context line.
- [x] **1.4 Measured `/clear` start.** Median first-request tokens over the
      newest 20 transcripts of this project's store, measured by the
      status-line tap at most hourly and carried on the ledger snapshot as
      `clear_start`; the continuity record is named by its cap, not added.
      (corrected-from-reproduction: the draft split by start source, which no
      counter sees, and read it from session-eol state, which sits in the
      dispatch bundle.)
      verify: fixture with 3 sessions yields the median; no sessions → the number is omitted.

## Phase 2 — Say it when it matters

- [x] **2.1 Cache line on the first cold prompt.** `quota-notice` adds one
      line when the cache is cold (host `expires_at`, else
      `last_response_at + ttl`), no compaction since the last response, the
      prompt is not synthetic (F7) and D4 holds. Once per
      `(session, expiry)`. (corrected-from-reproduction: reads the host
      reading only — the fallback is 1.2, and the synthetic-prompt filter was
      dropped because a host-started turn pays the re-write too and the line
      shows once per expiry.) Shape:
      `AC: prompt cache cold for 23 min (TTL 1h) — this message is re-processing ~182k tokens. A /clear start here is ~24k (+ continuity record ≤ 1.5k).`
      Shipped 2026-11-01; tests seen red with the mechanism neutralised.
      verify: `tests/scripts/quota_notice_hook.test.ts` cases warm / cold / below threshold / no measured start / another session → one line only for cold. A compaction rewrites the cache and the host reports a fresh `expires_at`, so no separate compaction case exists on the host path.
- [x] **2.2 Advice that is true when cold.** Warm → `/compact` is cheap;
      cold → `/clear`, or continue knowingly; a cold `/compact` is named as
      re-reading the full history (F3).
      verify: snapshot test of both texts.
- [~] **2.3 Resume says it before the first request.** Bind the notice on <!-- deferred-resolution: carried-to=road-to-a-return-that-names-its-price-carried -->
      claude `session_start` for `source: resume|fork` and read the host's
      four fields (F4). Manifest edit with its ratification artifact.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main` -> 0; fixture with `prompt_cache_likely_expired: true` emits the line.
      Deferred 2026-11-01, blocked-by: resume-binding-ratification
- [~] **2.4 Money only where money is billed.** For `metered`, append the <!-- deferred-resolution: carried-to=road-to-a-return-that-names-its-price-carried -->
      repriced cache-write amount; plan logins show tokens only (D5).
      verify: plan fixture shows no currency; metered fixture shows one.
      Deferred 2026-11-01, blocked-by: cache-notice-chunk-ceiling — the price
      parser does not fit the chunk, and the shipped default price table
      carries no current Claude model row, so the amount would read "unpriced"
      anyway. Plan logins show tokens only, as shipped.

## Phase 3 — Before you send

- [x] **3.1 One segment.** The tap's AC line gains the cache part:
      `AC cache warm until 10:42` → after expiry `AC cache cold · continue ≈182k`,
      shown only when D4 holds; joined to the quota segment with ` · `.
      verify: `tests/scripts/statusline_tap.test.ts` warm and cold cases; one AC line, never two.
- [x] **3.2 Doctor row.** Folded into `road-to-a-fill-the-session-sees-coming`
      1.2 (it owns the row): the same row reports
      `cache notice: live | fallback (no tap) | not bound`.
      verify: the fill roadmap's 1.2 names the cache column.

## Phase 4 — Calibrate

- [x] **4.1 Predicted versus paid.** `session_eol_report` replays every
      transcript: a gap past the TTL of the newest write is a cold return; it
      prints how many still read the cache (false cold) and the size error on
      the really cold ones. (corrected-from-reproduction: recording at emission
      needs hook bytes neither ceiling has, and a replay calibrates every past
      return instead of only the ones a notice fired on.)
      verify: `tests/scripts/session_eol_report.test.ts` — false-cold split and
      size error; reading in `agents/evidence/analysis/cold-return-calibration-2026-11-01.md`
      (573 returns, 46 % false cold, size error p50 6.3 %).

## Blockers

### blocker: cache-notice-chunk-ceiling
- **Status:** resolved — carried, still open, to `road-to-a-return-that-names-its-price-carried` with the steps it blocks (was: open — raised 2026-11-01)
- **Class:** 3 — decision: whether a transcript-only fallback should exist at all, before any budget raise
- **Run:** `./scripts-run src/scripts/session_eol_report` — the cold-return line is the evidence
- **Owner:** council (a reversible, budget-bounded raise), owner only if a floor is lowered
- **Blocks:** steps 1.2, 2.4 and AC-3
- **Question:** ship the transcript fallback (ratified raise of the `quota_notice` chunk ceiling by ~1.6 KB), or drop it and keep the notice on the host reading?
- **What to do:** decide on `agents/evidence/analysis/cold-return-calibration-2026-11-01.md`; a raise needs a `raise_log` entry in `src/config/hook-bundle-budget.json` and a ratification artifact, since that file is on the gated set.
- **Recommendation:** drop the fallback — 46 % of transcript-detected cold returns still read the cache; recommend the status-line tap instead.
- **If you do nothing:** users without the tap get no cold-return line, as before this change; nothing else waits on it.
- **Resolved when:** the fallback ships ratified, or the item is cancelled with the evidence cited.

### blocker: resume-binding-ratification
- **Status:** resolved — carried, still open, to `road-to-a-return-that-names-its-price-carried` with the steps it blocks (was: open — raised 2026-11-01)
- **Class:** 2 — governance: a `hook_manifest.yaml` binding is a gated plumbing edit
- **Run:** `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main`
- **Owner:** council (provider-diverse ratification, 2 seats per `src/config/ratification-policy.json`)
- **Blocks:** step 2.3 only
- **Question:** bind `quota-notice` on claude `session_start` for `resume|fork`, reading `prompt_cache_likely_expired` and `context_tokens`?
- **What to do:** first let probe 3 in `stubs/road-to-a-limit-the-host-actually-signals` confirm the four fields arrive; then the binding, its fixture and a ratification artifact in one change.
- **Recommendation:** wait for the probe — binding to fields nobody has observed here is the order the manifest refuses.
- **If you do nothing:** a resumed session gets the line with its first prompt instead of before it (2.1).
- **Resolved when:** the binding ships with its ratification artifact.

## Kill register

| ID | Killed | Why |
|---|---|---|
| K1 | Cache keepalive / dummy prompts | Banned by `archive/road-to-token-economy-cache`; idle compaction is the host's sanctioned version. |
| K2 | Pre-submit block as default | Owner ruling in `quota_notice_hook.ts`; a block ends the turn and fires on host-started turns. |
| K3 | `session:cost-advisor` command | A concern extension, not a surface. |
| K4 | `session:clear-safe` workflow | The continuity record is written automatically; no hook output can run `/clear`. |
| K5 | Envelope evaluator | Exists in `handoff_context_hook.ts` validation. |
| K6 | "Clear without envelope 3,000 tokens" | AC's own `session_start` slot alone may carry 16,384 B; replaced by the measured start (1.4). |
| K7 | Restart checks between `/work` phases | No hook can clear; run checkpoints exist. |
| K8 | Multi-host adapter now | Only Claude has a verified user channel. |
| K9 | Countdown toasts | D3. |
| K10 | Money on plan logins | D5. |

## Risk register
<!-- risk-review: v1 | reviewed: 2026-11-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | The notice is a receipt | expectation | `UserPromptSubmit` runs after Enter | Wording says "is re-processing"; the before-send path is 3.1 | Phase 2 |
| 2 | Wrong number | accuracy | The fallback cannot see prefix changes | Host field wins (D1); 4.1 publishes the error | Phase 4 |
| 3 | Noise on 5m sessions | adoption | Metered logins go cold every coffee | D4 plus once per expiry | Phase 2 |

## Acceptance criteria

- [x] AC-1 — A user returning after the TTL sees, with the first prompt, one line with the numbers; nothing while warm, after a compaction, or on a host-started turn.
- [x] AC-2 — With the tap, the status line shows "warm until" / "cold" before the user sends.
- [~] AC-3 — Without the tap, 2.1 still fires from the fallback counters. <!-- deferred-resolution: carried-to=road-to-a-return-that-names-its-price-carried -->
      Deferred with 1.2, blocked-by: cache-notice-chunk-ceiling
- [x] AC-4 — The prediction error is published (4.1).
- [x] AC-5 — No new command, no block, no keepalive.
