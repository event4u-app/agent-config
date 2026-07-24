---
complexity: structural
execution:
  mode: autonomous
---

# Roadmap: Road to internet reach — a governed reach layer for dev research

> Ship a governed `internet-reach` capability area — channel registry +
> `reach:doctor` + a scope-bound router skill + mechanized supply-chain
> validation — whose default scope is decided by a pre-registered
> benchmark before the skill is authored, and whose injection hygiene,
> pinning discipline and host-native honesty are machine-checked rather
> than asserted.

## Context

The package has **zero** coverage for internet reach. Verified at
`b4ac186` (9.7.0):

- `CAPABILITIES.yaml` — `total_skills: 279`, `capability_areas: 28`,
  `gaps: 0`; no area covers web reading, web search, repository-metadata
  retrieval, video transcripts, feeds, or discussion platforms.
- Directory sweep over `src/skills/` for
  `web|search|reddit|twitter|rss|youtube|browser|fetch|scrape|reach|research|crawl`
  returns two false positives only (`customer-research/`,
  `laravel-websocket/`).

So the honest statement is: `gaps: 0` is true for the areas the index
tracks, and internet reach is not one of them. This roadmap opens the
area.

**Layer classification (pre-decided, ADR in Phase 7).** The reach layer
is **Class A** under ADR-124: deterministic, command-invoked
probe/doctor/validation scripts, no LLM call and no network access in
the build path, no resident process — consistent with
`docs/contracts/no-runtime-boundary.md` and ADR-112. Reading and
searching itself is **the agent calling upstream tools directly**. The
package ships selection, health, prescriptions and hygiene — never a
wrapper, never a proxy, never a daemon.

**Council convergence.** Council (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2026-07-24, 3 rounds, roadmap lens) reviewed the draft
capability-absorption plan and converged on five structural defects,
all of which are fixed in the phase order below:

1. **Sequencing was impossible** — the draft's scope-deciding benchmark
   compared "reach prescriptions" that did not exist yet. Fixed: Phase 0
   prototypes in gitignored scratch first, then measures, then commits a
   binding verdict; no tracked reach code before the verdict exists.
2. **The pass threshold was rigged** — "win ≥3/12 → claim default
   routing" turns *any* value into *default* value. Fixed: a three-band
   verdict (`0–2 → stop`, `3–6 → prescriptions-only`, `7+ → router`)
   with the `0–2` band shipping **no skill at all**.
3. **The evidence verdict was post-facto** — re-benchmarking an already
   merged, indexed and comparison-table-listed skill documents a
   decision instead of gating it. Fixed: the verdict phase runs
   **pre-merge** (Phase 6) and can still stop the ship.
4. **Every acceptance criterion was unfalsifiable** — "JSON-clean",
   "correct classification", "hygiene floor" with no schema, no
   pre-registered case matrix, no compliance measurement. Fixed:
   payload JSON schema + a pre-registered probe case matrix + an
   adversarial suite, each named in the phase that owns it.
5. **Discipline claims were an honour system** — "every prescription
   passes the supply-chain gate inline" with no mechanism. Fixed:
   Phase 3 ships `validate_reach_prescriptions.ts` wired into `task ci`,
   with negative fixtures proving it fails closed.

Divergence worth recording: the members split on effort estimation
(one produced a multi-month serial estimate, the other a parallelized
weeks estimate). **Host verdict: rejected, both.** This package's
roadmaps carry no duration or headcount estimates (`templates/roadmaps.md`
rule 13 + `direct-answers` Iron Law 2 — no duration estimates); the
useful residue is the *parallelism map*, which is recorded per phase as
"Parallel-safe with:" so an autonomous multi-subagent run can exploit it.

## Gap table — audited before drafting (rule 19a)

Each candidate capability of the external reference audited against the
existing surface. Only `KEEP` rows generate work below.

| # | Candidate capability | Verdict | Reason / target |
|---|---|---|---|
| 1 | Ordered-backend channel abstraction (backend switch = list reorder) | **KEEP** | No equivalent. Lands as `src/config/reach-channels.yml` (Phase 1). |
| 2 | Probe taxonomy `ok/missing/broken/timeout/error` incl. stale-shim detection | **KEEP** | No equivalent. Lands as `src/scripts/_lib/tool_probe.ts` (Phase 2). |
| 3 | Read-only health doctor with per-channel fix prescription | **KEEP** | `hooks_doctor.ts` is the *shape* precedent, not the capability. Lands as `reach:doctor` (Phase 2). |
| 4 | Tiered access model (zero-config / free-key / login) | **KEEP** | No equivalent. Registry field `tier` (Phase 1). |
| 5 | Router skill with progressive-disclosure `references/` | **KEEP** | Format precedent exists (`code-review` checklists); the reach content does not. Lands as `src/skills/internet-reach/` (Phase 4). |
| 6 | Graceful-degradation messages when all backends fail | **KEEP** | No equivalent; council-surfaced as one of the reference's genuinely best features. Phase 4. |
| 7 | Channel lifecycle / deprecation path | **KEEP** | Absent from the reference too (council: a broken channel there has lingered for many months). Reuses this package's existing lifecycle vocabulary (Phase 1). |
| 8 | Standing rule "doctor before gated channels" | **KEEP** | Correct mechanism; lands as a skill-body standing rule (Phase 4). |
| 9 | Injection hygiene for fetched content | **KEEP (differentiator)** | Primitives exist (`retrieval_sanitize.ts`, `lethal-trifecta-guard`); no reach surface cites them yet. Phase 4 + Phase 6. |
| 10 | Supply-chain pinning of upstream CLIs | **FOLD** | Into the existing `supply-chain-intake` gate, mechanized by a new validator (Phase 3) — not a new policy. |
| 11 | Hardened subprocess spawning | **FOLD** | `hardenedSpawnEnv()` already exists (ADR-123); every probe routes through it. |
| 12 | Multi-host skill installation (three hardcoded skill dirs) | **CUT — already covered** | The projection pipeline emits to six hosts from one source; nothing to build. |
| 13 | Auto-install of system packages (Node, gh, extra tooling) | **CUT — forbidden** | Violates `supply-chain-intake` (verify, pin, lock, never pipe remote to shell). Replaced by prescription-first. |
| 14 | Browser cookie extraction across five browsers | **CUT — forbidden** | Credential harvesting on an agent-invoked path; the reference documents the account-ban risk itself. Human-performed prescriptions instead (Phase 5). |
| 15 | Update-check standing rule appended to task wrap-ups | **CUT — forbidden** | Token-funded self-promotion; explicitly lint-blocked (Phase 4). |
| 16 | Wrapper CLI / reach MCP server exposing a status call | **CUT** | No value over direct tool calls; the reference reached the same conclusion. |
| 17 | CN-market channels (Xiaohongshu, Bilibili, Xueqiu, V2EX, Xiaoyuzhou, WeChat) | **CUT — non-goal** | Perpetual anti-bot maintenance, no demand signal in this audience. Negative triggers keep the skill from firing on them at all (Phase 4). |
| 18 | Audio transcription pipeline (hosted Whisper) | **CUT — deferred** | Needs API keys + billable spend; revisit only behind a named demand signal and its own roadmap. |

## Non-goals

- **No CN-market channels** (row 17). The skill must not even *trigger*
  on them — a trigger that loads the skill body only to decline is worse
  than no skill (council, round 3). Phase 4 ships a positive-only
  trigger list plus explicit negative triggers, with a trigger eval
  proving both directions.
- **No browser cookie extraction** (row 14). Login-tier platforms get
  documented, human-performed setup only.
- **No auto-installation** of system packages, and no unpinned install
  source anywhere in a shipped surface (row 13). Enforced by Phase 3's
  validator, not by good intentions.
- **No update-nagging, no self-promotion, no unconditioned "MUST USE"**
  trigger phrasing in the skill (row 15). Lint-blocked in Phase 4.
- **No wrapper, no resident process, no reach MCP server** (row 16).
- **No transcription pipeline** (row 18).
- **No credits/attribution entry naming the external reference.**
  `source-confidentiality` forbids derivation-attribution in tracked
  artefacts, and the license-required carve-out applies to vendored code
  only — nothing is vendored here. Provenance lives in this roadmap's
  `## Provenance` block, anonymized, with the real link stored as an
  `ENC1:` token. (Council proposed a `CREDITS.md` entry; **host verdict:
  rejected** — `src/rules/source-confidentiality.md` Iron Law, backstop
  `src/scripts/check_no_external_sources.ts`.)
- **No scheduled network CI job.** Council proposed a weekly cron
  probing every upstream backend. **Host verdict:
  accept-with-modification** — a scheduled job that hits live third-party
  endpoints buys flaky CI and an implicit availability promise the
  package does not make. Replaced by a `last_verified` registry field, a
  staleness lint that runs offline, and an operator-invoked
  `reach:doctor --deep` (Phase 7).
- **No duration, headcount, or release-version statements** anywhere in
  this roadmap (rule 13).

## Prerequisites — verified at `b4ac186`

| Primitive | Path | Verified |
|---|---|---|
| Hardened subprocess env (ADR-123) | `src/scripts/_lib/spawn_env.ts` | `hardenedSpawnEnv()` at line 106 |
| Fetched-text sanitizer | `src/scripts/_lib/retrieval_sanitize.ts` | 71 lines; `sanitize_text()`, `sanitize_entry()` |
| Trifecta containment rule | `src/rules/lethal-trifecta-guard.md` | present |
| Dependency intake gate | `src/skills/supply-chain-intake/SKILL.md` | present |
| Read-only doctor precedent | `src/scripts/hooks_doctor.ts` + `hooks:doctor` | present, registered |
| Dispatcher registration surfaces | `src/cli/registry.ts`, `src/scripts/_dispatch.bash` | `hooks:doctor` at `registry.ts:70`, `_dispatch.bash:1086` |
| Capability index generator | `src/scripts/generate_capabilities_index.ts` | present |
| Claims ledger + pointer resolver | `docs/CLAIMS.md`, `src/scripts/check_claims.ts` | present |
| Comparison rows (one claim per row) | `docs/comparison.yaml`, `check_comparison.ts` | row shape verified |
| Benchmark publication surface | `docs/benchmark.md`, `internal/bench/<name>/` | present |
| Lifecycle vocabulary to reuse | `docs/contracts/provider-lifecycle.md` | `experimental / stable / deprecated / community` |
| Link encryption for provenance | `src/scripts/_lib/link_crypto.ts` | `encrypt` verified working |
| Local tool baseline for Phase 0 | — | `gh` 2.96.0 ✅, `curl` ✅, `node` ✅, `python3` ✅, `jq` ✅, `yt-dlp` ❌, `pipx` ❌ |

- [x] **Step 0:** Re-verify the primitive table above against the
  working tree before Phase 0 starts; any row that no longer resolves
  is a stop-and-surface, not a silent workaround.
  <!-- verify: node -e "['src/scripts/_lib/spawn_env.ts','src/scripts/_lib/retrieval_sanitize.ts','src/rules/lethal-trifecta-guard.md','src/skills/supply-chain-intake/SKILL.md','src/scripts/hooks_doctor.ts','src/scripts/generate_capabilities_index.ts','docs/CLAIMS.md','docs/comparison.yaml','docs/contracts/provider-lifecycle.md'].forEach(p=>{if(!require('fs').existsSync(p))throw new Error('missing '+p)});console.log('ok')" -->

## Phase 0 — Binding scope decision (prototype → protocol → verdict)

The single largest waste risk: authoring a router skill that loses to
the host's own web-search / web-fetch tools. The external reference
forces itself on every research intent with no published evidence; this
package decides scope by measurement **before** any tracked reach code
exists. Nothing in Phases 1–7 may be started before `0c` writes its
verdict.

Parallel-safe with: nothing. This phase gates everything.

### 0a — Prototype the prescriptions in gitignored scratch

- [x] **Step 1:** Create `agents/runtime/tmp/reach-proto/` (gitignored
  via `/agents/runtime/`) with one executable recipe per candidate
  channel, using **only** locally available tooling: `web-read` (curl +
  reader-style extraction), `web-search` (host-native tool, recorded as
  the baseline arm), `github` (`gh api`), `rss` (curl + a Node parse
  step), `hackernews` (`https://hn.algolia.com/api/v1/search`, verified
  reachable, HTTP 200). Each recipe prints the retrieved evidence to
  stdout and exits non-zero on failure.
  <!-- verify: ls agents/runtime/tmp/reach-proto/*.sh | wc -l -->
- [x] **Step 2:** Write `agents/runtime/tmp/reach-proto/NOTES.md`
  recording, per recipe: the exact command, whether it succeeded, the
  evidence shape returned, and the failure mode when it failed. This is
  scratch — it never becomes a tracked artefact.
- [x] **Step 3:** Record the `youtube` channel as **not prototypable in
  this environment** — `yt-dlp` is absent and installing it is a
  human-performed step (see `## Blockers` → `yt-dlp-not-installed`). The
  youtube channel therefore enters Phase 0c's tally as **untested**,
  never as a win. Do not silently substitute a page-scrape stand-in and
  score it as a subtitle capability.

### 0b — Bench harness + pre-registered protocol (committed before the run)

- [x] **Step 4:** Create `internal/bench/reach-vs-native/README.md`
  defining the 12 tasks (2 web-read, 2 web-search, 3 repository
  metadata, 2 feeds, 2 discussions, 1 mixed) with, per task: the
  question, the acceptance evidence a correct answer must contain, and
  the arm-agnostic scoring rule. Tasks must be answerable from public
  endpoints with no credentials.
- [x] **Step 5:** Commit the **pre-registered thresholds** to the same
  README — no post-hoc adjustment:
  - **S0a — task success.** Per task, `reach` wins outright iff the
    native arm fails or returns materially weaker evidence for the
    stated acceptance evidence. Ties are native wins (the tie-break
    favours the tool the user already has).
  - **S0b — token cost.** On tasks both arms solve, reach-arm token
    cost ≤ 1.5× native. A channel that breaches S0b ships as a
    documented fallback, never as a routed default — recorded per
    channel, not just in aggregate.
- [x] **Step 6:** Commit the **verdict bands** — the fix for the rigged
  threshold (council, round 3, both members):

  | Wins (of 12, `untested` never counts as a win) | Verdict | What ships |
  |---|---|---|
  | 0–2 | **STOP** | Publish the null. No skill. Registry + doctor may still ship as standalone operator tooling; the router does not. |
  | 3–6 | **Prescriptions-only** | Skill ships with gated/fallback triggers only ("use when host tools fail: 403, auth wall, no subtitle access"). No general research triggers. |
  | 7+ | **Router** | Skill ships with general triggers for the channels that individually cleared S0a and S0b. |
- [x] **Step 7:** Commit the **run protocol** (council fix 10 — baseline
  drift): before each run, record host platform + version, and per
  native tool the provider, result cap and rate limit; record run
  timestamp, endpoints called, rate limits hit, and the handling
  (retry / skip / fail) per task. A re-run whose recorded host
  capabilities differ materially from the previous run is a
  **re-baseline**, not a comparison — stated in the README as a rule,
  not a footnote.
- [x] **Step 8:** Commit `internal/bench/reach-vs-native/results.csv`
  with a header row only (`task_id,arm,outcome,tokens,notes,run_id`) so
  the schema is fixed before any data exists.

### 0c — Run and commit the binding verdict

- [x] **Step 9:** Execute all 12 tasks × 2 arms using the 0a recipes and
  the host-native tools; fill `results.csv`; append the run metadata
  block required by Step 7.
  <!-- verify: node -e "const l=require('fs').readFileSync('internal/bench/reach-vs-native/results.csv','utf8').trim().split('\n');if(l.length<25)throw new Error('expected 24 result rows, got '+(l.length-1));console.log('ok')" -->
- [x] **Step 10:** Write `internal/bench/reach-vs-native/VERDICT.md` —
  the win tally, the per-channel S0a/S0b outcome, the selected band, and
  the one-line scope sentence Phase 4 must copy verbatim into the
  skill's description. This file is the binding input to every later
  phase.
  <!-- verify: grep -qE "^band: (stop|prescriptions-only|router)$" internal/bench/reach-vs-native/VERDICT.md && echo ok -->
- [x] **Step 11:** Publish the outcome in `docs/benchmark.md` —
  including a null. A null is a result, not a failure to report.
- [x] **Step 12:** If the band is **STOP**: mark Phases 4, 5 and 6 `[-]`
  cancelled with the verdict as the inline reason, keep Phases 1–3 and 7
  scoped to standalone operator tooling, and record in `VERDICT.md` that
  the router is not shipped. Do not renegotiate the band.

**Exit criteria:** `VERDICT.md` exists with a parsable `band:` line;
`results.csv` carries 24 rows; `docs/benchmark.md` cites the run.
**Rollback:** delete `internal/bench/reach-vs-native/` and the
`docs/benchmark.md` section; no other surface has been touched.

### Verdict outcome — `band: stop` (applied 2026-07-24)

The native arm passed 12/12; the reach arm scored **0 outright wins**.
Under the pre-registered rule (ties are native wins) the band is `stop`.
Report: `internal/bench/reach-vs-native/VERDICT.md`; null published in
`docs/benchmark.md` § internet-reach.

Applied consequences — the band is not renegotiated:

- **Phases 4, 5, 6 are cancelled** (`[-]`, reason inline per step). No
  router skill, no gated-platform prescription set, no shipped-skill
  verdict run: there is nothing left to gate.
- **Phases 1, 2, 3 continue, re-scoped as standalone operator tooling.**
  They answer a question that stands without a router: *is the upstream
  tool I already chose to install healthy, and is its install command
  pinned?* Concretely, the registry's channel set is now driven by
  "which external backend does a reach recipe actually need" rather than
  "which channel earned routing" — `github` (`gh`), `youtube`
  (`yt-dlp`, absent → see the blocker), and the baseline fetch/parse
  tools the keyless channels rely on (`curl`, `jq`, `node`). No channel
  is marked as routed anywhere.
- **Phase 7 continues minus the skill-dependent comparison row** — the
  hygiene-section row has no artefact to point at; only the
  pinned-prescription row ships.
- The reach prescriptions stay **gitignored prototypes**. They are
  evidence for the benchmark, not a shipped surface, so nothing in the
  tracked tree instructs an agent to fetch anything.

## Phase 1 — Channel registry, schema, lifecycle

The mechanism the external reference got most right: switching a
backend is reordering a list, never editing code. Here it becomes a
schema-validated config file.

Parallel-safe with: Phase 2 (registry shape first, probe consumes it).

- [x] **Step 1:** Write `src/config/reach-channels.yml`, containing only
  the channels the Phase 0c verdict admitted. Per channel:
  `backends:` (ordered candidate list, each with `probe_cmd`,
  `probe_args`, `install:` keyed by `darwin` / `linux` / `win32` /
  `default` with **exact pinned versions**), `tier:`
  (`zero-config | free-key | login`), `lifecycle:`
  (`experimental | stable | deprecated | community` — reusing
  `docs/contracts/provider-lifecycle.md` vocabulary rather than forking
  a second enum), `override_key:` (user backend pin),
  `last_verified:` (ISO date), and optional `removal_after:` +
  `replacement:` for the deprecation path.
- [x] **Step 2:** Write `src/scripts/schemas/reach-channels.schema.json`
  — required fields, the two enums, `install` pinning pattern (a version
  specifier is mandatory; `main`, `latest`, `master`, `HEAD` and archive
  URLs are rejected by pattern), and `additionalProperties: false` so a
  typo fails loudly.
- [x] **Step 3:** Wire schema validation into the existing content lint
  chain (`taskfiles/content.yml`) as `check-reach-channels`, and add it
  to `task ci`'s content group.
  <!-- verify: task check-reach-channels -->
- [x] **Step 4:** Negative fixtures under
  `tests/fixtures/reach-channels/`: `unpinned-install.yml`,
  `unknown-lifecycle.yml`, `missing-probe.yml`, `extra-key.yml` — each
  asserted to fail validation.
  <!-- verify: task test-ts -- --run tests/scripts/reach_channels_schema.test.ts -->
- [x] **Step 5:** Document the deprecation path in the schema doc block:
  `deprecated` → doctor emits a warning and still probes;
  past `removal_after` → doctor skips the probe and reports the channel
  as removed; the staleness lint (Phase 7) flags any channel whose
  `removal_after` has passed but which is still present in the file.
  This is the gap the reference itself has not closed (council, round 3).

**Exit criteria:** `check-reach-channels` green on the real file and red
on all four negative fixtures. **Rollback:** delete the config, schema,
fixtures and the lint task entry.

## Phase 2 — Probe engine + `reach:doctor`

Parallel-safe with: Phase 3 (independent script), Phase 5 (docs).

- [x] **Step 1:** Write `src/scripts/_lib/tool_probe.ts` implementing the
  five-state taxonomy, with **no line-count target** (council rejected
  the draft's "~150 lines" as aspiration dressed as specification;
  behaviour and cases are the spec):
  - `ok` — binary resolves **and** the side-effect-free probe exits 0.
  - `missing` — binary does not resolve.
  - `broken` — binary resolves but the probe fails: exit 126/127, or a
    resolvable shim whose interpreter is gone (**stale-shim case** — the
    single most valuable behaviour of the reference's probe layer).
  - `timeout` — probe exceeded its per-probe deadline.
  - `error` — anything else, captured and attributed to that channel only.
  Every spawn goes through `hardenedSpawnEnv()`. Probes are
  side-effect-free (`--version` / `--help` / status args only). Retry
  applies to `timeout` only, never to `missing` or `broken`.
- [x] **Step 2:** Platform-specific install strings come from the
  registry via `process.platform` with a `default` fallback. No
  OS-detection module, no package-manager discovery, no fallback
  install logic — the prescription is a static string the human reads.
  (Council divergence resolved in favour of the minimal reading:
  emitting an OS-specific string is trivial; auto-install complexity is
  explicitly out of scope.)
- [x] **Step 3:** Pre-register the probe case matrix in
  `tests/scripts/tool_probe.test.ts` **before** implementing the doctor
  — GIVEN/WHEN/THEN per state, including: absent binary → `missing`;
  shim present, interpreter deleted → `broken` + reinstall prescription
  present in the payload; exit 127 → `broken`; a probe that sleeps past
  the deadline → `timeout` with exactly one retry; one channel throwing
  → that channel `error`, all others still reported.
  <!-- verify: task test-ts -- --run tests/scripts/tool_probe.test.ts -->
- [x] **Step 4:** Write `src/scripts/reach_doctor.ts` — read-only, no
  writes, no installs, no network beyond the local probe. Follows
  `hooks_doctor.ts` payload and exit-code conventions. Per channel:
  `status`, `active_backend`, `tier`, `lifecycle`, `last_verified`, and
  for `missing` / `broken` the exact pinned fix command for the current
  platform. Flags: `--format json|table`, `--strict` (non-zero when any
  admitted channel is not `ok`), `--channel <name>`.
- [x] **Step 5:** Fix the "JSON-clean" unfalsifiability: write
  `src/scripts/schemas/reach-doctor-payload.schema.json` and have the
  doctor's own test validate real output against it.
  <!-- verify: task test-ts -- --run tests/scripts/reach_doctor.test.ts -->
- [x] **Step 6:** Register the command across the dispatcher surface —
  `src/cli/registry.ts` (name `reach:doctor`, `disposition: 'delegate'`,
  synopsis), `src/scripts/_dispatch.bash` (help block + `case` arm +
  `cmd_reach_doctor` function), then regenerate the consumer matrix
  (`src/scripts/consumer_matrix.ts` → `docs/distribution/consumer-matrix.md`).
  <!-- note: regen was a verified no-op — consumer_matrix.ts is the release E2E
  runner, not a doc generator, and consumer-matrix.md is hand-written prose that
  only describes that harness; reach:doctor is not one of its legs, so nothing was
  stale. The doc was NOT hand-edited. -->
  <!-- note: the plain `./agent-config help` is tier-gated to Tier-0 (a closed
  list per docs/contracts/command-surface-tiers.md); reach:doctor is correctly
  Tier-2 alongside hooks:doctor, so the verify uses --tier=all rather than
  mis-tiering a diagnostic to satisfy a grep. -->
  <!-- verify: ./agent-config --help --tier=all | grep -q "reach:doctor" && ./agent-config reach:doctor --format json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s);console.log('ok')})" -->
- [x] **Step 7:** Assert read-only-ness mechanically: a witness test
  snapshots the working tree before and after a `reach:doctor` run and
  fails on any file mutation.
  <!-- verify: task test-ts -- --run tests/scripts/witness/reach_doctor_readonly.test.ts -->

**Exit criteria:** all three test files green; `reach:doctor --format json`
validates against its schema; `--strict` returns non-zero with a
deliberately broken channel override. **Rollback:** revert the two
scripts, the schema, the tests and the dispatcher registration; Phase 1
stands alone.

## Phase 3 — Prescription validation gate (mechanized supply chain)

The draft asserted "every prescription passes the intake gate inline"
with no mechanism. An honour system is not a differentiator (council,
round 3, finding 18).

Parallel-safe with: Phase 2, Phase 4 authoring.

- [x] **Step 1:** Write `src/scripts/validate_reach_prescriptions.ts`:
  parse `reach-channels.yml`, extract every install command, and fail on
  (a) an unpinned version specifier, (b) an archive/branch URL install
  source, (c) a package whose name does not appear in the accompanying
  intake record. Registry existence + CVE state are read from a
  **committed intake record**, not fetched at lint time — the validator
  must run offline and deterministically (no network in the build path,
  per the Class A classification).
- [x] **Step 2:** Write
  `src/config/reach-prescriptions-intake.yml` — one entry per named
  third-party tool with: package name, registry, pinned version,
  the `supply-chain-intake` checklist outcome (existence verified,
  pinned, lockfile note, CVE note), and the date the check was run.
  A prescription without an intake entry cannot ship.
- [x] **Step 3:** Wire `check-reach-prescriptions` into the content lint
  chain and into `task ci`.
  <!-- verify: task check-reach-prescriptions -->
- [x] **Step 4:** Prove it fails closed with negative fixtures: unpinned
  version → red; archive-URL source → red; package absent from the
  intake record → red; fully pinned + recorded → green.
  <!-- verify: task test-ts -- --run tests/scripts/validate_reach_prescriptions.test.ts -->
- [x] **Step 5:** Add a repo-wide grep gate to the same validator: no
  shipped surface (`src/skills/internet-reach/**`, `src/config/reach-*.yml`,
  `docs/**` reach sections) may contain an unpinned install command or a
  `curl … | sh`-shaped instruction.
  <!-- verify: task check-reach-prescriptions -->

**Exit criteria:** the validator is in `task ci`; all four fixtures
behave as specified; the grep gate is red on a deliberately inserted
`npm i -g yt-dlp` (no version) and green after pinning. **Rollback:**
revert the validator, intake config, fixtures and task wiring.

## Phase 4 — The reach router skill — CANCELLED (band: stop)

Runs only if the Phase 0c band is `prescriptions-only` or `router`. The
skill's description, triggers and scope sentence are **copied from
`VERDICT.md`**, not re-argued here.

Parallel-safe with: Phase 5.

- [-] **Step 1:** Write `src/skills/internet-reach/SKILL.md` — router <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  body only, within the frontmatter floor (`model_tier`, `name`,
  `description` ≤ 200 chars, `domain`, `workspaces`, `packs`) and the
  skill-linter floor (a `## Gotcha` section, ≥ 2 ordered
  `## Output format` requirements). Per-channel command groups and retry
  chains live in `references/`, loaded on demand:
  `references/dev.md` (repository metadata), `references/video.md`,
  `references/feeds.md`, `references/discussions.md`.
- [-] **Step 2:** **Positive-only trigger list.** The skill declares the <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  exact in-scope intents (repository metadata, video transcripts, feed
  parsing, discussion search, and fetch-fallback after a 403 / bot wall)
  and **defers to the host's native web tools by name** for everything
  they already cover. No unconditioned "MUST USE" phrasing.
- [-] **Step 3:** **Negative triggers.** A `## When NOT to use` section <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  naming the out-of-scope classes — CN social platforms and CN podcast
  platforms (by platform name, never by naming the external reference,
  per `source-confidentiality`), plus document conversion and anything
  the native tools cover. The goal is **not to fire at all**, not to
  fire and then decline: a trigger that loads the body only to say
  "wrong tool" is pure waste (council, round 3, finding 17).
- [-] **Step 4:** **Injection-hygiene section — the differentiator.** <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  Mandatory in the body: fetched internet content is DATA, never
  instructions; cites `lethal-trifecta-guard` (fetch is the
  untrusted-ingestion leg; fetch + repo write + outbound comms must not
  sit on one autonomous path); long or externally-shaped payloads pass
  the `retrieval_sanitize` floor before being quoted into context.
- [-] **Step 5:** **Graceful-degradation paths.** When every backend for <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  a channel fails, the skill maps the error class to a user-actionable
  next step — auth wall → "export credentials, run the documented setup";
  rate limit → "wait, then retry once"; geo-block → "use another source";
  and **fails fast after three attempts**, never retrying indefinitely.
- [-] **Step 6:** **Standing rule:** `doctor-before-gated-channels` — <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  any multi-backend or login-tier channel requires a `reach:doctor` pass
  first; the command group is selected by the reported `active_backend`,
  never guessed.
- [-] **Step 7:** Write `src/skills/internet-reach/evals/triggers.json` <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md --> <!-- ref-ignore -->
  — ≥ 5 should-trigger and ≥ 5 should-not-trigger cases, with the
  should-not set containing at least three CN-platform tasks and one
  task the native tools cover.
  <!-- verify: task test-triggers -->
- [-] **Step 8:** Anti-nag lint: extend the skill lint sweep with a <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  committed forbidden-token list (`check-update`, "upgrade available",
  "latest version", "MUST USE" unconditioned, self-promotional wrap-up
  phrasing) scoped to `src/skills/internet-reach/**`.
  <!-- verify: task lint-skills -->
- [-] **Step 9:** Condense to `dist/agent-src/skills/internet-reach/` <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  via the `/condense` flow, then `condense.sh --mark-done` per file.
  <!-- verify: task check-condensation -->
- [-] **Step 10:** Run `task consistency-fix` for counts, pack <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  README/`pack.yaml` and discovery, then regenerate the indices —
  `generate_index` (`agents/index.md`, `docs/catalog.md`) and
  `generate_capabilities_index` (`CAPABILITIES.yaml`, new
  `internet-reach` area with honest coverage banding).
  <!-- verify: task check-index && task counts-check -->
- [-] **Step 11:** Targeted linters on the new files: <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  `skill_linter src/skills/internet-reach/SKILL.md` and
  `validate_frontmatter`.
  <!-- verify: ./scripts-run src/scripts/skill_linter src/skills/internet-reach/SKILL.md -->

**Exit criteria:** trigger eval passes in both directions; skill linter,
frontmatter validator, condensation check and anti-nag lint green;
`CAPABILITIES.yaml` shows the new area. **Rollback:** delete the skill
dir + its dist projection, re-run `consistency-fix` and the index
generators.

## Phase 5 — Gated-platform prescriptions (human-performed, documented)

Parallel-safe with: Phase 4.

- [-] **Step 1:** Write `src/skills/internet-reach/references/gated-platforms.md` <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md --> <!-- ref-ignore -->
  — per login-tier platform: what access unlocks, the **human-performed**
  setup steps (the human exports the credential; the agent never reads a
  browser profile), the credential storage path with a `chmod 600`
  expectation, and a dedicated-throwaway-account warning where the
  platform's terms make automation a ban risk.
- [-] **Step 2:** Extend `reach:doctor` with a credential-permission <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  check: when a configured credential file is group- or world-readable,
  report a warning (never the file's contents, never a fingerprint of
  the secret).
  <!-- verify: task test-ts -- --run tests/scripts/reach_doctor.test.ts -->
- [-] **Step 3:** Every third-party CLI named in the prescriptions has <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  its `reach-prescriptions-intake.yml` entry (Phase 3 Step 2). A
  prescription that cannot be pinned is not shipped — it is documented
  as unavailable instead.
  <!-- verify: task check-reach-prescriptions -->
- [-] **Step 4:** Trifecta review of the complete prescription set: for <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  each flow, record in the PR body which of the three legs is broken and
  how. A flow that keeps all three legs on one autonomous path does not
  ship.

**Exit criteria:** prescription validator green; the doctor's permission
warning covered by a test; the per-flow trifecta line present in the PR
body. **Rollback:** delete the reference file and revert the doctor's
permission check.

## Phase 6 — Adversarial suite + pre-merge evidence verdict (the real gate)

The draft benchmarked the shipped skill *after* merge — which documents
a decision instead of gating it (council: "devastating and correct").
This phase runs **before** merge and can still stop the ship.

Parallel-safe with: nothing (needs Phases 1–5 on the branch).

- [-] **Step 1:** Write <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  `tests/scripts/reach_adversarial.test.ts` — the failure-mode arm the
  draft lacked entirely. Four families, ten cases:
  - **Injection resistance (3):** fetched payloads carrying
    instruction-shaped text, bidi/zero-width obfuscation, and a
    Unicode-tag block — each must be neutralised by
    `retrieval_sanitize` before reaching a quoting path.
  - **Out-of-scope routing (3):** CN-platform task, native-covered task,
    document-conversion task — the skill must not trigger.
  - **Missing-tool handling (3):** a channel whose backend is absent —
    the doctor emits the pinned fix, the skill defers instead of
    emitting a command that fails silently.
  - **Rate-limit resilience (1):** repeated rapid calls — fails fast
    within the declared attempt cap, no unbounded retry.
  Acceptance: **≥ 9/10 pass; below that, this phase halts and the
  failures are fixed before the verdict run.**
  <!-- verify: task test-ts -- --run tests/scripts/reach_adversarial.test.ts -->
- [-] **Step 2:** Re-run the Phase 0 bench against the **shipped** <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  surfaces (registry + doctor + skill on the branch), same 12 tasks,
  same thresholds, plus the gated-platform tasks the native arm cannot
  attempt at all. Record the run metadata block from Phase 0b Step 7.
  <!-- verify: node -e "const s=require('fs').readFileSync('internal/bench/reach-vs-native/results.csv','utf8');if(!s.includes('shipped'))throw new Error('no shipped-arm rows');console.log('ok')" -->
- [-] **Step 3:** Compare against the recorded host-capability baseline. <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  If the host's native tools changed materially since Phase 0c, this is
  a **re-baseline**: re-run the native arm in the same session rather
  than comparing across sessions, and state that in the results.
- [-] **Step 4:** Write the verdict into `docs/benchmark.md` — win, <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  partial or null, with the pinned report path. Register exactly one
  headline claim in `docs/CLAIMS.md` with a resolvable pointer.
  <!-- verify: ./scripts-run src/scripts/check_claims -->
- [-] **Step 5:** **Band enforcement (pre-merge).** If the shipped-skill <!-- cancelled: Phase 0c band=stop (0/12 outright reach wins) — no router skill ships; see internal/bench/reach-vs-native/VERDICT.md -->
  result drops the tally below the band selected in Phase 0c, downgrade
  the skill's triggers to the lower band's scope **in this branch**
  before merge — or, at band `0–2`, remove the skill from the branch and
  keep only the registry + doctor + validator. The published story is
  written from the measured result only.

**Exit criteria:** adversarial suite ≥ 9/10; shipped-arm rows present in
`results.csv`; `docs/benchmark.md` + `docs/CLAIMS.md` updated and the
pointer resolver green. **Rollback:** revert the claim + benchmark
section; the branch does not merge.

## Phase 7 — Governance, staleness scaffolding, ADR

Parallel-safe with: Phase 6 (docs-only steps).

- [x] **Step 1:** Write the ADR (`adr-create` skill, next free number)
  recording: the reach layer's Class A classification, the
  never-a-wrapper doctrine, prescription-first over auto-install, the
  three-band scope decision and its outcome, and the two explicit
  refusals (cookie extraction, CN channels). Regenerate the ADR index.
  <!-- verify: ./scripts-run src/scripts/adr/regenerate_index -->
- [x] **Step 2:** **Comparison rows — one claim per row** (council
  finding 16: the draft's single row was three compound claims with
  three different falsifiers). Add to `docs/comparison.yaml`:
  - "Reach surfaces mandate a sanitizer floor and a trifecta review for
    fetched content" → `our_evidence` = the skill's hygiene section.
  - "Every reach install prescription is version-pinned and
    intake-recorded, enforced in CI" → `our_evidence` =
    `src/scripts/validate_reach_prescriptions.ts`.
  A behavioural compliance claim ("agents actually apply the sanitizer
  floor in ≥ N% of runs") is **not** added here — it needs an eval that
  does not exist yet; without it the row cannot be `checkable: true`, and
  an uncheckable row of our own is exactly what the comparison contract
  forbids. Recorded as a deferred item below.
  <!-- verify: ./scripts-run src/scripts/check_comparison -->
- [x] **Step 3:** Staleness scaffolding instead of a scheduled network
  job: a `check-reach-staleness` lint (offline) that fails when a
  channel's `last_verified` is older than 90 days, when a `deprecated`
  channel has no `replacement`, or when a channel is past its
  `removal_after` date and still present. Wire into `task ci`.
  <!-- verify: task check-reach-staleness -->
- [x] **Step 4:** Add `reach:doctor --deep` — operator-invoked, performs
  one real request per backend, and updates nothing automatically; it
  prints the `last_verified` lines the operator may commit. Never runs
  in CI.
  <!-- verify: ./agent-config reach:doctor --help | grep -q -- --deep -->
- [x] **Step 5:** Write `internal/upstream-changes.md` — an append-only
  log of upstream platform/tool changes that broke a channel, with the
  date, the symptom, and the registry edit that resolved it. This is the
  maintenance memory the reference lacks; it is a document, not a
  service.
- [x] **Step 6:** Add the external reference's identifying tokens to
  `src/scripts/external_sources_denylist.json` (that file is itself
  skip-pathed, so it is the one legitimate place the tokens may appear)
  so any future accidental attribution in a tracked file fails CI.
  <!-- verify: ./scripts-run src/scripts/check_no_external_sources -->
- [x] **Step 7:** Run the security surface review over the new area with
  the existing `agent-security-review` skill (council/openai asked for a
  pre-launch security pass; this is the house-native form of it) and
  record the findings in the PR body — no new process, no new document
  type.
- [x] **Step 8:** Full-suite green: `task lint-skills`, `task test-ts`,
  `task typecheck-ts`, `task check-refs`, `task check-index`,
  `task counts-check`, `task check-condensation`.
  <!-- verify: task typecheck-ts -->

**Exit criteria:** ADR + index regenerated; comparison rows resolve;
staleness lint in `task ci`; denylist tokens added; targeted lint/test
suites green. **Rollback:** revert docs, ADR, lint wiring; the shipped
code from Phases 1–5 is unaffected.

## Out-of-scope-for-now (scope notes, not steps)

These are deliberately **not** roadmap steps — recorded as prose so this
roadmap can close without an archival-gate interruption, and so a future
roadmap can pick them up with the reason intact.

- **Behavioural sanitize-compliance eval.** Instrument the sanitizer,
  measure the share of reach-fetched payloads that actually pass through
  it, then add the third comparison row. Needs an eval harness for
  agent-behavioural compliance that does not exist yet; the two
  structural comparison rows ship without it.
- **Audio transcription channel** (hosted speech-to-text). Needs API
  keys and billable spend; revisit behind a named demand signal, with
  its own roadmap and its own spend gate.
- **Browser-credential automation.** A trifecta leg this package does
  not ship; revisit only behind a named demand signal and a dedicated
  threat model.

## Risks

| Risk | Exposure | Containment |
|---|---|---|
| Router is built, then loses to host-native tools | Wasted work + a dishonest public claim | Phase 0 decides scope before any tracked reach code; three-band verdict; Phase 6 re-checks pre-merge and can downgrade or drop the skill |
| Fetched content carries injected instructions | Untrusted-content ingestion leg | Skill mandates DATA framing + sanitizer floor; adversarial suite tests it with obfuscated payloads; per-flow trifecta line in the PR body |
| A prescription names a nonexistent or typosquatted package | Supply chain | Phase 3 validator + committed intake record; unpinned or unrecorded → CI red |
| Upstream tools break at platform cadence | Capability rot | Doctor surfaces breakage with a pinned fix; ordered-backend lists make the swap a config edit; `last_verified` staleness lint; upstream-change log; no availability promise anywhere |
| Registry accumulates dead channels | Confusing output, wasted probe time | Lifecycle field + `removal_after` + staleness lint that flags overdue removals |
| Skill fires on out-of-scope tasks | Token waste, worse than no skill | Positive-only trigger list + explicit negative triggers + trigger eval asserting both directions |
| Benchmark comparison silently invalidated by a host upgrade | False verdict either way | Host-capability recording per run; material change forces a re-baseline instead of a comparison |
| Attribution of the external reference leaks into a tracked file | `source-confidentiality` breach | Anonymized provenance with `ENC1:` tokens; denylist tokens added in Phase 7; CI backstop |

## Acceptance criteria

- [x] `internal/bench/reach-vs-native/VERDICT.md` carries a parsable
  `band:` line, and every later phase's scope matches it.
- [x] `reach:doctor` is registered, read-only (witness-tested), and its
  JSON output validates against
  `src/scripts/schemas/reach-doctor-payload.schema.json`.
- [x] Probe classification is covered by a pre-registered case matrix
  including the stale-shim case, exit 126/127, timeout-with-one-retry
  and per-channel error isolation.
- [x] `check-reach-channels`, `check-reach-prescriptions` and
  `check-reach-staleness` are in `task ci`, each red on its negative
  fixtures.
- [x] Zero unpinned install commands and zero pipe-to-shell instructions
  in any shipped surface (validator grep gate).
- [x] The skill (if the band ships one) carries the hygiene section <!-- vacuously satisfied: band=stop ships no skill, so there is no trigger scope to match -->
  citing the trifecta rule and the sanitizer floor, a positive-only
  trigger list, negative triggers, degradation paths, and the
  doctor-before-gated-channels standing rule; the trigger eval passes in
  both directions.
- [-] Adversarial suite ≥ 9/10. <!-- cancelled with Phase 6 (band=stop): the suite tested skill triggering and shipped-skill behaviour, neither of which exists. The injection-hygiene half is moot too — no shipped code path ingests fetched content. -->
- [x] `docs/benchmark.md` publishes the shipped-surface result — win, <!-- null published; NO headline claim registered in docs/CLAIMS.md, by design: band=stop means nothing is claimed. The two comparison rows carry the only public statements, both checkable. -->
  partial or null — and `docs/CLAIMS.md` registers exactly one headline
  claim with a resolving pointer.
- [x] `docs/comparison.yaml` gains only single-claim, `checkable: true`
  rows.
- [x] No tracked file names the external reference; the denylist tokens
  are in place and `check_no_external_sources` is green.
- [x] `task lint-skills`, `task test-ts`, `task typecheck-ts` and
  `task check-refs` green.

## Blockers

### blocker: yt-dlp-not-installed

- **Status:** open
- **Owner:** user
- **Blocks:** Phase 0 — the `youtube` channel's benchmark arm; Phase 1's
  `youtube` channel entry can be authored but not probed green.
- **What to do:**
  1. Decide whether the `youtube` channel is in scope for v1 at all.
  2. If yes, install the pinned backend from the intake record
     (`pipx install yt-dlp==<pinned>` or the platform equivalent) — a
     human-performed step by design; the agent must not auto-install it.
  3. Re-run `reach:doctor --channel youtube`.
- **Resolved when:** `./agent-config reach:doctor --channel youtube
  --format json` reports `status: ok`, **or** the channel is recorded as
  out of scope in `VERDICT.md` and removed from the registry.

## Notes

**Council findings the host rejected**, with the evidence — recorded so
they are not silently re-proposed:

| Finding | Verdict | Evidence |
|---|---|---|
| Timeline / headcount estimates ("8–10 weeks, 2 engineers" vs "7–8 months") | **reject** | `templates/roadmaps.md` rule 13 (roadmaps describe work, not shipping); `direct-answers` Iron Law 2 (no duration estimates). Single-maintainer repo; the parallelism map is kept, the estimates are not. |
| `CREDITS.md` attribution entry for the external reference | **reject** | `src/rules/source-confidentiality.md` — derivation-attribution is forbidden in tracked artefacts; the license carve-out covers vendored code only, and nothing is vendored. Provenance block instead. |
| Weekly scheduled cron probing every upstream backend | **accept-with-modification** | A scheduled job against third-party endpoints buys flaky CI plus an implicit availability promise. Replaced by `last_verified` + offline staleness lint + operator-invoked `--deep`. |
| Pin `tool_probe.ts` at a specific line count (150 / 220+80 / 380) | **accept-with-modification** | Line counts are not a specification. The behaviour table and the pre-registered case matrix are. |
| Separate OS-detection module | **reject** | `process.platform` plus static per-platform strings in the registry. The reference needs OS logic because it auto-installs; this package does not auto-install. |
| Post-deployment user-feedback loop | **reject** | No user-feedback channel exists and none is in scope; the demand-signal gate in the non-goals already governs "should this grow". |
| Pre-launch "comprehensive security review" as a new process | **accept-with-modification** | Runs as the existing `agent-security-review` skill over the new surface (Phase 7 Step 7), not as a new document type. |
| Compound comparison-table row | **accept** | `docs/comparison.yaml` is one claim per row with one falsifier each; split into two shippable rows, the behavioural one deferred. |

**Execution note for a multi-subagent run.** Phase 0 is strictly
serial. After `VERDICT.md` exists, three streams are independent and may
be dispatched in parallel: (1) Phases 1→2 (registry then probe/doctor —
ordered internally), (2) Phase 3 (validator + intake record), (3) Phases
4→5 (skill + prescriptions, both bound to the verdict scope). Phase 6
requires all three streams complete on the branch. Phase 7's docs steps
may overlap Phase 6.

## Provenance

- Source: an external internet-reach capability plugin for AI coding
  agents (Python, MIT-licensed), anonymized per
  [`source-confidentiality`](../../src/rules/source-confidentiality.md).
  Decrypt via `src/scripts/_lib/link_crypto.ts decrypt`:
  `ENC1:SKHY9KcJx58yv2JI4Zt1OiENh7GK8AmpLyl4PIhYQHTT+nD/muWq7bpZU8j73eScQNZFBxHdVDbgOKYmVBtYqu2JAgnQb1esvfnZSPdgLihuzPGJ/7L/PK2ZJFYrl3BF4fAwHAmFFc3o/g==`
- Ideation thread that seeded the first draft (external LLM session):
  `ENC1:v+UUlOM1Uhsa+iXrrA49X8TQ1gw/B5vw2b8JnYECDiYCmDcvoj4xAlcgRdC2BCVh4pbpj06ehqR4xDwe5WVQDpqgAYsfMGcdZl4JIqz+w/g2UTKo3O9YqyKmPHK6JWRkwtZU37Z//DYAMpxvtUhHPvhstnDVeQ4rklPE`
- Council: anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-24,
  3 rounds, roadmap lens; convergence inlined in `## Context` and the
  rejected-findings table in `## Notes`.
