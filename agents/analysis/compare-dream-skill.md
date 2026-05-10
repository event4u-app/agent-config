# Reference analysis: grandamenium/dream-skill

> Single-author, MIT-unstated, 51-star Claude-Code-only skill that runs
> a four-phase memory-consolidation cycle (`ORIENT → GATHER SIGNAL →
> CONSOLIDATE → PRUNE & INDEX`) over session JSONL transcripts and
> writes findings into a flat `MEMORY.md` index with topic files
> (`preferences.md`, `decisions.md`, `corrections.md`, `patterns.md`,
> `facts.md`). Auto-triggers every 24 h via a Claude-Code `Stop` hook
> + `~/.claude/.dream-pending` flag file. The strategic value for our
> suite is **the signal-class grep patterns and the consolidation
> phasing** — re-targetable as a portable `/memory mine-session`
> sub-command that feeds our existing intake → promote pipeline. The
> file format, hook mechanism, and topic taxonomy do **not** port.

- **Source:** https://github.com/grandamenium/dream-skill
- **Default branch:** `main` (commit-pinned at adoption time:
  `228634143517906e3407ecec827890aaf70d5a97`, 2026-03-24)
- **License:** unstated in repo (no `LICENSE` file at root) — must
  contact author or treat as **all rights reserved** until clarified.
  We DO NOT vendor any code; we re-implement the patterns natively.
- **Stars / forks:** 51 / 11 (fetched 2026-05-10)
- **Created:** 2026-03-24 · **Last push:** 2026-03-24 (pushed-at);
  metadata last updated 2026-05-09 — repo is single-commit, single-day
  authorship.
- **Language:** Shell (4 scripts, ~300 LOC) + 1 Markdown skill (~280 LOC)
- **Surface area:** `SKILL.md`, `install.sh`, `should-dream.sh`,
  `dream-hook.sh`, `test-dream.sh` — that's the whole repo.
- **Maintainer:** `grandamenium` (single contributor, no issues
  triaged, no PRs merged from third parties)
- **Fetched:** 2026-05-10 (40-fetch budget: 7 used)

## TL;DR

### What this skill actually is

`dream-skill` is a **periodic transcript-mining cron-job** dressed
as a Claude-Code Skill. The four phases collapse to:

1. **ORIENT** — `ls` + `cat` of `~/.claude/projects/*/memory/MEMORY.md`
   to map current state.
2. **GATHER SIGNAL** — pre-baked `grep -il` over JSONL transcripts
   from the last 7 days, scanning for four signal classes:
   *corrections* (`actually|wrong|stop doing`), *preferences*
   (`I prefer|always use|never use`), *decisions* (`let's go with|
   we're using|I decided`), *patterns* (`again|every time|keep
   forgetting`).
3. **CONSOLIDATE** — merge findings into the topic files, normalize
   relative dates ("yesterday" → ISO), delete contradicted entries
   with a `(Updated YYYY-MM-DD, previously: X)` audit note.
4. **PRUNE & INDEX** — cap `MEMORY.md` at 200 lines, demote stale
   entries to `archive.md`, refresh the index table + Quick
   Reference (max 10 items).

The auto-trigger is a `Stop` hook calling `should-dream.sh` (gates on
24 h elapsed via `.last-dream` timestamp file) which `touch`es
`~/.claude/.dream-pending`; the **next** session start spots the flag
and runs `/dream` as a background subagent. Zero overhead on cold
exit (~10 ms), single-fire per 24 h window.

This is a **content-store maintainer**, not a knowledge-layer. There
is no schema, no confidence score, no contradiction reconciliation
beyond textual replacement, no trust math, no source attribution
beyond `(source: session, confidence: high/medium)` in free prose.

### Top 3 things to ADOPT

1. **The four signal-class grep patterns, re-targeted at OUR intake
   stream.** The patterns themselves (`actually|wrong|I prefer|
   always use|let's go with|again|every time|keep forgetting`) are
   **calibrated by actual production use** of Claude Code over the
   author's own sessions. We can lift them verbatim into a new
   `/memory mine-session` sub-command that scans the host agent's
   recent transcript or chat history (Augment / Claude Code / Cursor
   transcripts where available) and emits intake JSONL signals via
   the existing `/memory propose` payload. The signals land in
   `agents/memory/intake/*.jsonl`, then go through the existing
   `/memory promote` gate — no schema rewrite, no parallel pipeline.
   Citation: `dream-skill/SKILL.md` Phase 2 grep blocks.

2. **The 4-phase consolidation procedure as a portable workflow.**
   `ORIENT → GATHER SIGNAL → CONSOLIDATE → PRUNE & INDEX` is a
   genuinely good cycle structure for *any* knowledge-store
   maintenance — file-based or schema-based. Adopt the **phase
   names and the per-phase invariants** as a documented procedure
   in a new senior-tier skill `memory-consolidation` that the host
   agent can run on demand. The phases stay; the file format
   underneath stays YAML.

3. **The relative-date-normalization rule (Phase 3 invariant).**
   "Convert relative dates to absolute. If a session from March 15
   says 'yesterday I changed the API key', write '2026-03-14:
   Changed API key'." This is currently **not enforced** in our
   YAML body fields (`last_validated` is ISO, but free-text fields
   in `decision`/`pattern`/`rule` can carry "last week"). Add a
   `scripts/check_memory.py` linter rule: reject entries whose
   body fields contain `yesterday|last week|last month|tomorrow|
   today` without an ISO anchor. Trivial to add, structural win.

### Top 3 things to ADAPT

1. **The 200-line index cap, adapted to a generated index file.**
   Their `MEMORY.md` is a hand-maintained 200-line table-of-contents
   over topic files. We adopt the **lean index pattern** but
   regenerate it: `scripts/build_memory_index.py` walks
   `agents/memory/<type>/<hash>.yml` and emits
   `agents/memory-index.md` (auto-generated, like
   `agents/roadmaps-progress.md`). Cap stays at 200 lines —
   forces aggressive summarization. Read-only for humans; the
   YAML is the source of truth.

2. **The Quick-Reference top-10 promotion.** Dream's `MEMORY.md`
   reserves a "Quick Reference" section for the 5-10 most
   important facts. Adapt as the **`load_context`-budget tier-0
   slice**: any entry with `confidence: high` AND `priority:
   critical` (new optional field) renders into a tier-0 block
   that loads on every `/memory load` regardless of query — these
   are facts the agent must see every turn. Implementation: add
   `priority` to the shared frontmatter (default `normal`),
   schema-gate at three values (`critical | normal | low`).

3. **The `dry-run` first-run gate.** Dream's safety section
   mandates "On first use, read through all 4 phases but only
   print what you WOULD change." Adapt for the new `/memory
   mine-session` command: first invocation per repo emits a
   numbered-options preview block; user picks which signals
   become intake JSONL. After first-run, default behaviour stays
   `--preview` unless `--commit-intake` is passed.

### Top 3 things we ALREADY do better

1. **Structured-data over flat-markdown.** Dream stores knowledge
   in unstructured topic files; we have four typed schemas
   (`domain-invariants`, `architecture-decisions`,
   `incident-learnings`, `product-rules`) with required fields
   (`id`, `status`, `confidence`, `source`, `owner`,
   `last_validated`, `review_after_days`). Validation is a CI
   linter, not a markdown convention. **No regression — the
   adopted pieces feed our schema, never replace it.**

2. **Multi-tool portability.** Dream is hard-coded to Claude
   Code (`~/.claude/skills/`, `~/.claude/projects/*/sessions/`,
   `~/.claude/settings.json` Stop hook). Per
   [`augment-portability`](../../.augment/rules/augment-portability.md)
   our skills must work on Augment + Claude Code + Cursor + Cline +
   Windsurf + Gemini CLI. The Stop-hook mechanism is rejected
   wholesale; the workflow runs on demand via `/memory
   mine-session` from any host.

3. **Trust scoring + contradiction reconciliation.** Per
   [`agent-memory-contract.md`](../../docs/contracts/agent-memory-contract.md)
   our retrieval emits `confidence ∈ [0,1]` and `trust` scores;
   `memory_contradictions` is a first-class API. Dream's
   "delete contradicted facts" is a string-replace with no
   shadowed-by chain. Our model strictly dominates.

## Critical lenses

### Lens 1 — License posture (BLOCKING-IF-VENDORED)

The repo has **no `LICENSE` file**. GitHub does not infer one. Under
default copyright we may **not** copy code, scripts, or substantial
text fragments verbatim. Mitigation:

- We adopt **patterns and phase structure**, not source.
- Grep regexes are functional facts, not creative expression — safe
  to re-use as concept (the regex literals are short, common-language
  patterns).
- Phase names (`ORIENT`, `GATHER SIGNAL`, `CONSOLIDATE`, `PRUNE &
  INDEX`) are not novel enough to attract copyright in isolation;
  cite the source for attribution discipline.
- We re-implement everything from scratch in our own coding style,
  YAML schema, and command surface.
- If at any phase we feel pressure to copy a code block verbatim,
  STOP and either (a) re-author from scratch, or (b) open a GitHub
  issue asking the author to add a `LICENSE` file.

This lens is an Iron-Law gate per
[`augment-source-of-truth`](../../.augment/rules/augment-source-of-truth.md):
no vendoring, only re-implementation.

### Lens 2 — Privacy floor for transcript mining

Dream's grep patterns capture the user's **chat history**. Our
agent-memory contract has a privacy floor (no PII, no user names,
no raw quotes without consent). The signal-mining adoption MUST:

- **Redact before write.** When a transcript line matches a grep
  pattern, the intake JSONL entry stores the *normalized fact*
  ("user prefers X for Y"), never the verbatim quote.
- **No personal-prefs topic.** Dream creates `preferences.md` with
  entries like "User's name is Jordan", "User reviews PRs on phone".
  These are user-attribute facts, not project facts. Our adoption
  is **project-scoped** — preferences captured must be about the
  *codebase / workflow* (e.g. "project uses pnpm not yarn"), never
  about the human.
- **Opt-in switch.** `/memory mine-session` requires
  `personal.transcript_mining: true` in `.agent-settings.yml`
  (default `false`). Off by default; user opts in per-project.
- **Source-of-transcript discipline.** Augment / Cursor / Cline
  do NOT expose JSONL transcripts to third-party tools. The
  initial implementation supports **Claude Code only** (via
  `~/.claude/projects/*/sessions/*.jsonl`); other hosts emit a
  `not-supported-on-this-host` notice and fall back to manual
  `/memory propose`.

### Lens 3 — Auto-trigger mechanism (REJECT)

Dream's Stop-hook + flag-file is a clever Claude-Code-specific hack.
We reject it for three reasons:

1. **Portability:** breaks `augment-portability`. Cursor, Augment,
   Cline, Windsurf have different (or no) hook surfaces. We don't
   ship a mechanism that works on one host.
2. **Surprise:** background subagent spawn at session start
   without explicit user opt-in violates `non-destructive-by-
   default` (the user did not authorize this turn's action).
3. **Cost-blindness:** auto-spawn means a background `claude -p`
   process bills tokens silently. Per `commit-policy` and
   `ai-council` Iron Laws, autonomous token spend requires
   explicit per-session permission.

The replacement is **manual invocation**: user runs `/memory
mine-session` when they want consolidation. The skill body
documents "run this once a week" as a guideline, but never
self-triggers.

### Lens 4 — Topic taxonomy mismatch

Dream's topic files (`preferences.md`, `decisions.md`,
`corrections.md`, `patterns.md`, `facts.md`) are **user-facing**;
our schemas (`domain-invariants`, `architecture-decisions`,
`incident-learnings`, `product-rules`) are **project-facing**.
Mapping table:

| Dream topic | Our schema | Notes |
|---|---|---|
| `preferences.md` | (none — REJECT) | User-pref noise; not engineering memory |
| `decisions.md` | `architecture-decisions.yml` | Direct fit; signal-mined entries become draft ADRs |
| `corrections.md` | `incident-learnings.yml` | "Corrected pattern" → "incident-learning with guardrail" |
| `patterns.md` | `product-rules.yml` OR `domain-invariants.yml` | Depends on whether the pattern is a rule or an invariant |
| `facts.md` | `domain-invariants.yml` | Project-knowledge → invariant |

The mapping is explicit in the new skill so the agent does not
silently invent a fifth schema.

### Lens 5 — Consolidation window calibration

Dream uses `-mtime -7` (last 7 days) for transcript scanning. Two
issues:

- **Too narrow for low-frequency users.** A solo dev who codes 2 days
  / week loses 5 days of signal each cycle.
- **Too wide for high-frequency users.** A team running 20 sessions /
  day grep-scans hundreds of MB.

Adapt with a configurable `transcript_window_days` (default 14),
exposed in `.agent-settings.yml`. The `/memory mine-session`
command also accepts `--since YYYY-MM-DD` and `--limit N` for
explicit control.

### Lens 6 — "Memory" overload

Our package already has FOUR things called "memory":

1. `/memory` orchestrator (`add | load | promote | propose`).
2. `agents/memory/<type>.yml` curated layer.
3. `agents/memory/intake/*.jsonl` raw signal layer.
4. `@event4u/agent-memory` planned MCP companion (per
   `agent-memory-contract.md`).

Adding a fifth "memory consolidation skill" without disambiguation
would be terminology debt. The new skill ships as
`memory-consolidation` (not `dream`, not `memory`); the new
sub-command is `/memory mine-session` (verb-first, scoped). No
new top-level command, no new schema, no new directory.


## Comparison matrix

Legend: **dr** = grandamenium/dream-skill, **us** = this repo *after*
shipping the `memory-consolidation` skill + `/memory mine-session`
sub-command per the adoption roadmap.

| Axis | dr | us | Label | Notes |
|---|---|---|---|---|
| Distribution | single-repo, manual `bash install.sh` | shared package projection (`task generate-tools`) | **OURS-WINS** | We ship via 7 host trees from one source. |
| Host coverage | Claude Code only | Augment + Claude Code + Cursor + Cline + Windsurf + Gemini CLI | **OURS-WINS** | `augment-portability` Iron Law. |
| Trigger model | Stop-hook + 24 h flag-file (auto) | manual `/memory mine-session` | **us-stricter** | Reject auto-spawn per Lens 3. |
| Storage format | flat markdown topic files | typed YAML (4 schemas) + intake JSONL | **OURS-WINS** | Schema validation in CI; no markdown drift. |
| Phase model | 4 phases (`ORIENT → GATHER → CONSOLIDATE → PRUNE`) | n/a — was missing | **ADOPT** | Lift the phase names + invariants verbatim into the new skill. |
| Signal classes | 4 grep families (corrections / preferences / decisions / patterns) | n/a — was missing | **ADOPT** | Lift the regex patterns; map to our schemas (Lens 4). |
| Topic taxonomy | preferences / decisions / corrections / patterns / facts | domain-invariants / architecture-decisions / incident-learnings / product-rules | **us-stricter** | Reject `preferences.md` (user-pref noise); map the rest. |
| Date discipline | "convert relative → absolute" (Phase 3 invariant) | none enforced today on YAML body fields | **ADOPT** | Add `check_memory.py` rule rejecting `yesterday\|last week` without ISO anchor. |
| Index file | hand-edited `MEMORY.md` (200-line cap) | n/a — no index file today | **ADAPT** | Generate `agents/memory-index.md` from YAML; same 200-line cap. |
| Quick-Reference tier | top-10 facts at every read | n/a | **ADAPT** | Add `priority: critical` field; tier-0 slice in `/memory load`. |
| Contradiction handling | string-replace + audit note | trust-score + `memory_contradictions` API | **OURS-WINS** | Don't regress; signal-mining feeds intake, contradictions resolve via existing API. |
| Confidence model | `high\|medium` free-text label | `confidence ∈ [0,1]` numeric | **OURS-WINS** | Numeric stays. |
| License | unstated (no `LICENSE` file) | MIT | **us-stricter** | Lens 1 — pattern adoption only, no vendoring. |
| Privacy floor | no redaction (stores user names, mobile-review habits) | redact-before-write, project-scoped only | **us-stricter** | Lens 2. |
| Dry-run / preview | "first-run dry-run" suggestion in safety section | n/a | **ADAPT** | Default `--preview`; explicit `--commit-intake` to write. |
| Maintenance signal | single author, single-commit repo, no issues | active package, CI gates, weekly review | **OURS-WINS** | We verify the skill at adoption; we do not depend on upstream. |

## Council convergence

Two-member, two-round council (`anthropic/claude-sonnet-4-5` +
`openai/gpt-4o`, $0.0643 actual, 2026-05-10) reviewed an earlier
draft of the adoption shape. Full transcripts:
[`agents/council-questions/dream-skill-adoption.md`](../council-questions/dream-skill-adoption.md)
+ [`agents/council-responses/dream-skill-adoption.json`](../council-responses/dream-skill-adoption.json).

### Convergence (both members)

- **Portability lock-in is real.** Shipping Claude-Code-only in
  Phase 1 risks a two-tier ecosystem (one host gets the productivity
  win, six hosts get "not supported"). The `augment-portability`
  Iron Law is satisfied in letter but not in spirit.
- **Pattern calibration is brittle.** Single-author grep heuristics
  encode one user's communication style; both false-positive and
  false-negative rates rise on different team corpora.
- **Auto-trigger rejection is correct, but the manual fallback has
  an unsolved adoption-rate problem** — users forget to run
  consolidation, and reminders that say "run /memory mine-session"
  read as nagging, not nudging.
- **Defer add-ons D and E.** The generated index file and
  `priority: critical` tier address hypothetical retrieval pain
  without measured evidence. Ship them when there are 100+ curated
  entries and observed latency, not before.
- **Per-invocation consent beats persistent config flag.** Replace
  `personal.transcript_mining: true` with an explicit
  `--confirm-transcript-access` flag on the sub-command.

### Divergence

- **anthropic** — design from examples: ship the Claude Code
  implementation with documented transcript-format assumptions,
  extract the `TranscriptAdapter` interface only after a second
  host is implemented. Building the contract in a vacuum ossifies
  untested assumptions.
- **openai** — design abstraction-first: define the
  `TranscriptAdapter` contract upfront before any host
  implementation, so the door stays open for Cursor / Augment /
  Cline / Windsurf / Gemini.

### Host verdict

Split the difference. **Document the `TranscriptAdapter` contract
in the skill body** at Phase 1 (concrete file paths, schema
expectations, output JSONL shape) and ship a Claude-Code
implementation behind it. The contract document costs ~half a day
and prevents the lock-in failure mode; the second-host extraction
still happens against real evidence (anthropic's win).

### Novel adoptions from anthropic Round 2 (taken)

1. **Inline-during-load consolidation.** Replace the auto-trigger
   problem by surfacing intake review during the existing
   `/memory load` action: when intake JSONL has > 10 unreviewed
   entries, the load command emits a numbered-options preview of
   the top-3 signals and lets the user promote inline. No
   reminders, no nagging — consolidation becomes a side-effect of
   a high-frequency action.
2. **Per-invocation consent flag.** `--confirm-transcript-access`
   replaces the `.agent-settings.yml` flag. Each mining run is an
   explicit consent event.
3. **Tagging on existing schemas, not a fifth schema.** Dream's
   `patterns.md` topic straddles `product-rules.yml` (user-facing
   behaviour) and `domain-invariants.yml` (system properties). The
   resolution is **multi-tag YAML**: an intake entry carries
   `tags: [pattern, debugging]`; promotion targets the schema that
   matches the tag intersection. No new schema, no silent drops.
4. **Temporal jitter at promotion.** Replace exact `ts: ISO8601`
   with `ts_week: YYYY-Www` on curated entries. Defeats the
   session-context inference attack (a 13-minute gap between two
   promoted facts reveals user behaviour patterns; week-granularity
   does not).
5. **Defer D and E to a Phase 2 follow-up roadmap.** Phase 1 ships
   the skill, sub-command, and date-discipline linter only.

### Rejected from anthropic Round 2 (with reason)

- **Fifth schema `operational-patterns.yml`** — rejected in favour
  of the lighter tagging approach. Adding a new schema crosses the
  ADR-locked memory contract; tagging slots into existing
  frontmatter without contract drift.

## Adoption recommendation (revised post-council)

**ADOPT — narrow re-implementation, council-shaped:** ship one
senior-tier skill `memory-consolidation`, one sub-command
`/memory mine-session`, and **one** structural add-on (date-
discipline linter). The four signal-class grep patterns and the
four-phase procedure are lifted from `dream-skill` as concept; the
file format, the topic taxonomy, and the auto-trigger mechanism are
rejected. The skill ships with a documented `TranscriptAdapter`
contract upfront and a Claude-Code-only implementation behind it.

Five council-shaped guardrails:

1. **`TranscriptAdapter` contract documented in skill body**
   (file-path discovery, JSONL schema expectations, output
   normalisation rules) so a second host can be added without
   rewriting the skill.
2. **`--confirm-transcript-access` per-invocation flag** replaces
   the persistent settings flag.
3. **Inline-during-load consolidation prompt** when intake JSONL
   has > 10 unreviewed entries — no reminders, no auto-spawn.
4. **Multi-tag intake** so signals that straddle two schemas land
   without silent drops.
5. **Temporal jitter** (`ts_week`) at promotion to defeat
   session-context inference.

**Deferred to Phase 2 (separate roadmap, evidence-gated):** the
generated index file (`agents/memory-index.md`), the
`priority: critical` tier, and the second-host transcript adapter.
Phase 2 is unblocked when (a) curated entries exceed 100, OR (b)
two consumer projects file an issue requesting non-Claude-Code
mining.

The implementation phases, acceptance criteria, privacy floor, and
rollback trigger live in the sibling roadmap under
[`agents/roadmaps/road-to-dream-skill-adoption.md`](../roadmaps/road-to-dream-skill-adoption.md).

## Fetch budget

10 of 40 fetches used (3 GitHub-API + 5 raw-content for upstream
scripts + 2 council-render passes). Remaining 30 reserved for
spot-verification during roadmap Phase 1 execution.
