# Phase 1 measurements — parallel-session register

Measurement record for `road-to-parallel-session-coordination` Phase 1.
Every number here was observed on this machine at the stated date; nothing is
carried over from a code comment or a prior session's claim.

**Measured:** 2026-08-07 · **Repo HEAD:** `a22e7bd05`

## 1. Runtime state is per-worktree, not per-repo — CONFIRMED

The roadmap read this off a code comment
(`src/scripts/hooks/dispatch_hook.ts`: concerns run with
`CWD = envelope.workspace_root`). Observed directly:

| Checkout | Resolved `agents/runtime/state/` | Contents |
|---|---|---|
| main checkout | `<main>/agents/runtime/state` | populated — `context-hygiene.json`, `hot-context.md`, `memory-index-v1.sqlite3`, … |
| fresh worktree | `<worktree>/agents/runtime/state` | **absent** (directory does not exist) |

Two different paths, one populated and one not existing at all. Two sessions in
two worktrees share no runtime state. The design premise holds.

## 2. `git rev-parse --git-common-dir` — CONFIRMED, with one trap

Identical **after resolution**, and different **before** it. This distinction is
load-bearing and is the reason the roadmap insists on reusing the existing
resolution in `src/scripts/_cli/cmd_doctor.ts` rather than writing a second one.

| Invoked from | Raw output | Resolved (realpath) |
|---|---|---|
| main checkout | `.git` — **relative** | `<main>/.git` |
| worktree | `<main>/.git` — absolute | `<main>/.git` |

A consumer that compares the **raw** strings concludes the two checkouts have
different common dirs. Raw output is not a repo identity; the resolved realpath
is. Any register-path helper resolves against the invoking CWD before use.

### Symlinked parent — CONFIRMED convergent

Built a throwaway repo plus worktree, reached both through a real path and
through a symlinked ancestor. Four accesses, one answer:

| Access path | Resolved common dir |
|---|---|
| `real/repo` (main) | `…/real/repo/.git` |
| `real/wt-a` (worktree) | `…/real/repo/.git` |
| `link/repo` (main, via symlink) | `…/real/repo/.git` |
| `link/wt-a` (worktree, via symlink) | `…/real/repo/.git` |

Git reports realpaths, so a symlinked ancestor collapses to the same directory
rather than forking into a second register. This is the *opposite* outcome from
the worktree-cleanup finding that motivated the check — there, realpath
reporting caused a mis-classification; here the same behaviour is what makes one
shared register possible. Worth recording precisely because the prior finding
predicted trouble and the measurement did not reproduce it.

## 3. The claim window on `/roadmap:next` — measured, and it is wide

Measured over the 14 most recent merged feature PRs: time from the **first
commit on the branch** to **PR creation**.

| | minutes |
|---|---|
| min | 2 |
| median | **18.5** |
| p75 | ~33 |
| max | **67** |

Raw per-PR values (minutes): 2, 3, 7, 10, 13, 15, 16, 21, 24, 25, 33, 43, 46, 67.

**This is a lower bound, not the window.** The claim window opens when a session
*selects* the roadmap, which is strictly earlier than its first commit — the
selection, the branch creation, and all pre-commit work sit inside the window and
outside this measurement. Git records no selection timestamp for past runs, so
the earlier half is not recoverable retrospectively.

One directly-observed data point from the run that produced this document:
branch created `08:36:30 +0200`, first commit later the same run — the roadmap
was selected minutes before the branch, and the PR did not exist for the whole
of Phase 1.

Against the roadmap's own decision rule — *"Under a minute makes the register a
nice-to-have; an hour makes it the point"* — a **median of 18.5 minutes and a
maximum of 67**, both lower bounds, put this closer to the second reading. The
window is real and wide enough for a second session to screen the same roadmap
as free.

## 4. TTL calibration — measured, and the per-host split is an honest null

Source: the `chat-history` JSONL. Schema, with citations into
`src/scripts/chat_history.ts`: `t` (entry type, `:1410`), `ts` (ISO-8601, seconds
precision, `:316-319`), `s` (session tag, sha256-truncated, `:326-331`), `agent`
(**the platform**, `:1754`), `source` (`hook:<platform>:<native_event>`, `:1753`).

### How thin the corpus is — stated before the numbers

- 262 worktrees enumerated; **4** carry a chat-history file; **3 of those 4 hold
  only a header line and zero body records**.
- All measurable data is in **one file**: 71 body records, 5 sessions, 0
  unparseable, covering **24.5 hours** (2026-08-06T06:14Z → 2026-08-07T06:41Z).
- **77 % of the 66 gaps come from a single session.**
- Exactly **one platform appears: `claude`, 71/71 records.**

### The per-host requirement — not measurable, and not fabricated

Phase 1 asked for the distribution *split by host*. **It cannot be derived from
this data.** One host is present. A second corpus found outside this repo (other
projects, same writer) adds `augment` with 2 sessions — and its median is
corrupted by a writer artifact: for `augment` + `stop` the dispatcher appends
**two** entries in one call (`chat_history.ts:1763-1775`), both stamped the same
second, so augment's raw record-to-record median is exactly `0.0 s`. That is the
writer, not a cadence. Two hosts, one with two sessions and a known artifact, is
not a per-host distribution, and no per-host table is shipped on that basis.

What this changes in the design: **nothing structural, everything about the
values.** Phase 2 still stores a per-host *map* — the mechanism is right and the
Phase 1 finding is precisely why the map needs a conservative default for
unmeasured hosts. What it must not do is populate that map with interpolated
numbers for seven hosts nobody measured.

### The distribution, for the one host that exists (seconds)

Idle cutoff stated: gaps > 1800 s (30 min) dropped. Both views shown.

| view | n | p50 | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|
| all-record, raw | 66 | 351 | 982 | 6089 | 8409 | 13705 | 13705 |
| all-record, kept ≤1800 | 52 | 236 | 412 | 787 | 982 | 1140 | 1140 |
| user→user, raw | 34 | 718 | 5724 | 8414 | 12132 | 14199 | 14199 |
| user→user, kept ≤1800 | 22 | 477 | 718 | 867 | 1225 | 1246 | 1246 |

Dropped by the idle filter: 21.2 % (all-record), 35.3 % (user→user).

### The correction the exclusion step produced

Phase 1 asked for long idle stretches to be excluded before taking the
percentile. Done — and the result inverts the step's own intent for this use:

**The 30-minute filter characterises cadence correctly and is wrong as a TTL
basis.** The dropped gaps are not session boundaries; they occur *inside* a
single session tag. 35 % of user→user gaps exceed 30 minutes while the session is
demonstrably still live — the dominant session spans 24.5 hours with 51 gaps. A
TTL taken from the filtered p95 (982 s) would expire a live session's claim on
roughly a third of its turns, which is Risk-Register item 1 caused by the
mitigation rather than by the gap.

The filter answers "how fast does a turn follow a turn". A TTL answers "how long
may a live session stay silent before we may assume it is gone". Those are
different questions over the same data, and only the second one governs expiry.

### Derived values

| | seconds | derived from |
|---|---|---|
| `claude` | **14 400** (4 h) | raw all-record p99 = 13 705 s and raw user→user max = 14 199 s, rounded up to the next hour |
| unknown / unmeasured host | **86 400** (24 h) | the same host's raw p99 in a *different* project corpus is 53 903 s — 4× its in-repo value. One host's own number moved 4× across corpora, so 4 h is not portable to a host with zero observations |

The unknown-host default is deliberately far above any measured value: an
unmeasured host must degrade to *holding a claim slightly too long*, never to
*vanishing while alive*.

Revisit-if: ≥ 3 distinct `agent` values and ≥ 30 sessions per host exist in
the corpus. Below that, the per-host question stays unanswerable and re-running
the analysis will produce the same null.

### One roadmap premise the data does not support

The roadmap and the council both assert that a single global TTL "is dominated by
the slowest host". **This data does not test that claim, and the fragment that
touches it points the other way**: in the out-of-repo corpus, pooling two hosts
moved the kept p95 to 348 s — *between* claude's 620 s and augment's 214 s, not up
to the slower one, because the faster host contributed more samples. Pooling is a
sample-weighted mixture, not a max.

Recorded as unsupported rather than refuted: n is far too small to settle it. The
per-host *map* is kept regardless, because its justification does not depend on
this claim — an unmeasured host needs a conservative default whether or not
pooling would have been dominated by the slowest measured one.

## 5. Slot frequency per host — the lattice already exists

Platform list confirmed from `src/scripts/hook_manifest.yaml:323-429`: augment,
claude, cowork, cursor, cline, windsurf, gemini, copilot.

| Platform | `session_start` | `user_prompt_submit` | `stop` | `session_end` | `stop` frequency | Per-turn carrier for a *liveness* heartbeat |
|---|---|---|---|---|---|---|
| augment | ✅ `:325` | ❌ absent | ✅ `:327` | ✅ `:326` | per-turn (default) | ✅ post-reply only |
| claude | ✅ `:332` | ✅ `:335` | ✅ `:334` | ✅ `:333` | per-turn, per reply | ✅ both sides |
| cowork | ✅ `:354` | ✅ `:357` | ✅ `:356` | ✅ `:355` | per-turn | ⚠️ wired, nothing fires |
| cursor | ✅ `:369` | ✅ `:372` | ✅ `:371` | ✅ `:370` | per-turn, **IDE only** | ⚠️ IDE yes, CLI no |
| cline | ✅ `:384` | ✅ `:387` | ✅ `:386` | ✅ `:385` | **per-event** (`TaskCancel`) | ✅ pre-reply only |
| windsurf | ✅ `:403` | ✅ `:407` | ✅ `:404` | ❌ **absent** | per-turn | ✅ both sides |
| gemini | ✅ `:420` | ✅ `:423` | ✅ `:422` | ✅ `:421` | per-turn | ✅ both sides |
| copilot | ❌ | ❌ | ❌ | ❌ | n/a | ❌ no hook surface |

### `stop` is per-turn on Claude Code — confirmed in our own source

`src/scripts/_lib/obligation_frequency.ts:243-247` states it directly: the native
`Stop` fires after every assistant reply, and true session end is the separate
`session_end` slot. Corroborated by the per-turn cadence list in
`agents/settings/contexts/chat-history-platform-hooks.md:149` and by the
hot-context stop-write description at `hook_manifest.yaml:23-24`.

### Augment's `stop` — answered for our purpose, undetermined at vendor level

Augment has no `user_prompt_submit` (`hook_manifest.yaml:325-329`, declared as a
gap at `:312-313`). Its `stop` resolves to the `per-turn` default because
`SLOT_FREQUENCY_OVERRIDE` (`obligation_frequency.ts:269-271`) lists only `cline`.

The **vendor-level** fact — does Augment's native Stop fire after every reply —
is **UNDETERMINED from this repo**: no vendor quote is carried, only our own
mapping decision, and one comment (`hook_manifest.yaml:382`) describes Augment's
Stop as an interruption, which would place it in the `external-event` root
instead. Recorded as undetermined rather than resolved by plausibility.

**It does not block this design**, and the reason is a distinction the roadmap did
not draw: a heartbeat that only *records liveness* rides a post-reply slot
perfectly well, because nothing depends on it reaching the model before the reply.
Only obligations that must *shape* the turn need a pre-reply carrier. Augment's
gap is real for the second class and absent for ours.

### Reuse, do not rebuild — the lattice is already there

`src/scripts/_lib/obligation_frequency.ts` already provides everything this
roadmap's per-turn obligation needs, and a new heartbeat slots in **with no new
schema**:

- `Frequency` union + `FREQUENCIES` (`:58-77`), and `ROOT_OF` (`:85-94`) — a
  forest (`lifecycle | tool-call | repository | external-event`), not a chain.
- `SLOT_FREQUENCY_DEFAULT` (`:249-256`) — `session_start`/`session_end` →
  `per-session`; `stop`/`user_prompt_submit` → `per-turn`.
- `SLOT_FREQUENCY_OVERRIDE` + `slot_frequency(platform, slot)` (`:269-275`).
- `carrier_frequency_by_platform()` (`:375-391`) returns a **set**, never a
  scalar (`:365-373` explains why collapsing would be wrong).

The rule frontmatter field `obligation_frequency` already accepts `per-turn`
(`src/scripts/schemas/rule.schema.json:157-161`), is required on every non-kernel
rule (`validate_frontmatter.ts:839-856`), and is joined per platform by
`check_enforcement_coverage.ts:546-552`. So the heartbeat is a **data change**:
declare `per-turn`, bind the concern in the manifest, and the join, the verdict,
the gap-platform list and the CI ratchet all work unchanged.

### Declared gaps — carried into the design, not papered over

1. **copilot** — no slot of any kind (`hook_manifest.yaml:428-429`,
   `fallback_only: true`). Excluded from the join *by declaration*
   (`obligation_frequency.ts:288-290`, skip at `:381`). Any heartbeat there is
   model-carried and must never be counted as covered.
2. **cline leaks on cancel — new, and it changes Phase 3.** `stop` ← `TaskCancel`
   (`hook_manifest.yaml:473`) is typed `per-event`
   (`obligation_frequency.ts:269-271`, pinned by
   `tests/scripts/obligation_frequency.test.ts:128-129`), and `session_end` ←
   `TaskComplete` (`:472`). A **cancelled** cline task therefore reaches neither:
   its register entry survives until TTL. See § 7.
3. **windsurf** — no `session_end` in the alias table at all; the comment at
   `hook_manifest.yaml:479-481` explains the per-turn append lands in `stop`
   instead. Deregistration bound only to `session_end` never runs there.
4. **cursor CLI** — both per-turn slots are IDE-only
   (`hook_manifest.yaml:365-366`, `chat-history-platform-hooks.md:214`).
5. **cowork** — structurally wired, lifecycle events do not fire today
   (`hook_manifest.yaml:346-351`).

### Two blind spots in the lattice itself

Worth stating before building on it: the lattice models **slot presence, not slot
reachability**, so gaps 4 and 5 are *false greens* — the join reports cursor and
cowork covered while nothing fires. And the pre-reply / post-reply distinction
that resolves Augment (above) is expressible only in prose today, not in
`Frequency`.

Neither is this roadmap's to fix, and neither is silently inherited: the
register's own artefact states which platforms actually carry its heartbeat.
