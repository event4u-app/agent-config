---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-o executed at 2bc5715c7 that a CLI failure whose stderr says 'timed out' and contains the word 'login' is classified auth_rejected and becomes eligible for replay onto the metered API, that an unpriced billable model estimates at $0.00 and passes a $0.01 ceiling, and that stitch.sh exits 0 with missing:0 on an unreadable clip. No active, parked or stub roadmap owns any of these: a grep over agents/roadmaps/{*,later,stubs} for record_spend, _classify_stderr, HTTPS_PROXY, verifyCheckpoint, stitch.sh, unpriced and test-pipeline returns nothing, and the neighbours (road-to-council-cost-truth, road-to-cost-parity-2-state-aware-dispatch) own different defects. Archiving or parking costs more because Phase 1 is a double-charge with no ceiling set; merging into a neighbour would put a council-transport fix behind a parked cost roadmap."
relates:
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Owns the grant object and who may authorise what. This file adds no ask, no attestation field and no turn binding to `--confirm`, `--yes`, `council:grant-billing` or the settings `source`; the census of agent-producible approvals in § Handoffs H3 is input there, not acted on here."
  - slug: road-to-sentences-the-tree-can-back
    relation: extends
    note: "Step 6.6 hands it the ten sentences in § Handoffs H1, one step each, in its one-sentence-per-step form. Nothing in this file edits those sentences."
  - slug: road-to-what-was-built-and-never-ran
    relation: extends
    note: "Step 6.6 hands over two instruments documented as live and reached by nothing (`ai_council/probation_gate.ts`, `lint_global_paths.ts`) for wire-or-withdraw (H2)."
  - slug: road-to-a-hook-carrier-that-is-never-silent
    relation: disjoint
    note: "Owns the silent `|| exit 0` hook fallthrough and the SessionStart hint a parent plan proposed; withdrawn here (H4)."
  - slug: road-to-local-gates-wired-while-they-are-green
    relation: disjoint
    note: "Owns wiring local-only gates. Step 5.3 changes what an existing CI gate (`check_test_weakening`) counts; it wires nothing new."
  - slug: road-to-cost-parity-2-state-aware-dispatch
    relation: disjoint
    note: "Parked. Its step 1.5 refuses a fifth price surface; Phases 2–3 here add a state to the existing estimate and ledger and create no price table, file or fetch."
  - slug: road-to-council-cost-truth
    relation: disjoint
    note: "Stub. Owns billability in reported council cost. Phase 2 here owns the different defect of an unpriced billable seat estimating at zero."
---
# Road to unknowns that say so

> **Source:** `agents/tmp.old/inbox-2026-10-o/` — one transcript and three
> supplied plans from two parallel sessions comparing this package with an
> external agent-first media-production tree (opaque id Source A, copyleft;
> nothing here copies its code, prompts or text). The plans were pinned at
> `main@d760ecbde` and `main@82a450c4e`; every reading below was re-taken at
> `main@2bc5715c7` on 2026-10-12, and the one commit since `82a450c4e` touches
> none of the cited code. Readings marked *(executed)* ran against this tree's
> own code in a scratch directory outside the repository.

## Goal

Where this package meets something it does not know — a model it has no price
for, a CLI failure it cannot place, a model it swapped on its own initiative, a
test that found nothing to test, a network it should not reach, a checkpoint it
cannot read, a clip it never opened — the unknown is a **named state that
reaches the record**, never a zero, a green, a skipped file or a stdout line.

No ask is added anywhere. No ceiling is turned on that a person did not set
(ADR-279). Nothing here changes who may authorise what, adds a runtime, or
widens the flow schema.

## Prerequisites

- `npx vitest` runs locally; FFmpeg/`ffprobe` for Phase 6's stitch tests
  (Decision D7 covers CI).

## Context — read at `main@2bc5715c7`

| # | Defect | Evidence |
|---|---|---|
| F1 | **A timed-out CLI call can be replayed onto the metered API.** The resolver's invariant: `timeout` / `server_error` "are ineligible under EVERY policy" (`src/scripts/ai_council/transport_resolver.ts:575-581`). `_classify_stderr` tests the auth list first (`src/scripts/ai_council/clients.ts:1619-1630`) and that list holds the bare word `login` (`clients.ts:1216-1225`). *(executed)* `'Error: request timed out; see https://x/login for status'` → `auth_expired` → `auth_rejected` (`transport_resolver.ts:538-540`) → fallback-eligible (`:434-443`); without `login` → `timeout`, ineligible. The harness's own subprocess timeout sets `error: 'timeout'` directly and is safe (`clients.ts:1497-1513`); only a vendor CLI that exits non-zero on its own with such stderr takes the bad path (`clients.ts:1557-1560`). A sibling: an exact `parse_failed` maps to the eligible `cli_unsupported` (`transport_resolver.ts:541`) — latent today, because the producer emits `parse_failed: <Type>` (`clients.ts:1593`), which classifies as `other`. |
| F2 | **An unpriced billable model costs $0 and passes every ceiling.** `estimate_cost` returns zero amounts when `lookup` finds no row (`src/scripts/ai_council/pricing.ts:128-137`); the prefix fallback reaches only dated aliases of a listed row (`pricing.ts:71-101`). The table was last hand-edited on 2026-05-14 (`_default_prices.ts:16`). *(executed)* under `max_total_usd: 0.01`, `_breach` (`spend_gate.ts:101-127`): `anthropic/claude-opus-4-5` → $0.0000, breach `null`; `anthropic/claude-opus-4-1` → $4.05, breach `session`. The module itself records that an unpriced billable model "produces a zero total" (`pricing.ts:217-222`). |
| F3 | **Unpriced spend never reaches the ledger.** `record_spend` returns early on `usd <= 0` (`budget_guard.ts:500-502`); an unpriced metered call is indistinguishable there from a subscription call. |
| F4 | **A set ceiling is read-then-compare.** `would_exceed` sums today's ledger and compares (`budget_guard.ts:473-483`); nothing is reserved and `budget_guard` has no lock primitive, so two councils started together both pass against the same remainder. Inert while no ceiling is set (`docs/decisions/ADR-279-no-spend-bound-by-default.md:120-123`). |
| F5 | **The size-fit downgrade is a stdout line only.** Auto-apply is the default (`council_cli.ts:1959-1961`); the member's model is overwritten (`:2045-2051`); the decisions are returned (`:2060-2062`) and discarded at both call sites (`:2463`, `:3006`). The transport fallback, by contrast, is in the artefact (`response_render.ts:51-63`). |
| F6 | **A production path reads where nothing is written; its test is green on the crash.** `score_skill_selection.ts:51` reads `agents/reports/skill-collision-clusters.json`; the producer writes `agents/runtime/reports/…` (`skill_collision_clusters.ts:40`). *(executed)* the suite reports 3 passed, 1 skipped — the skipped one is the happy path, the green one asserts the crash (`tests/scripts/score_skill_selection.test.ts:43`, `:62-74`). |
| F7 | **Conditional skips are invisible to the weakening gate.** `check_test_weakening` (`.github/workflows/tests.yml:336`) counts `SUPPRESSION` (`src/scripts/_lib/test_delta.ts:115-116`). *(executed)* the regex matches `it.skip(` and neither `it.skipIf(` nor `describe.runIf(`; the tree carries 111 such lines in 60 test files. |
| F8 | **Nothing stops the test suite reaching the network.** The setup files neutralise locale and pin the config home only (`vitest.config.ts:102`, `tests/_lib/`). The metered transport is a `curl` subprocess (`src/scripts/ai_council/api_transport.ts:57`), so an in-process socket patch would not cover it. |
| F9 | **A resumed run is ordered to call functions nothing can call.** "A RESUMED RUN RE-VERIFIES THE CHECKPOINT BEFORE ACTING ON IT", via `latestCheckpointFor` then `verifyCheckpoint` (`src/agent-src/contexts/execution/roadmap-process-loop.md:793-799`; relaunch prompt `src/scripts/_lib/headless_invocation.ts:86-92`). `verifyCheckpoint` (`src/scripts/_lib/run_checkpoint.ts:344`), `renderVerification` (`:410`) and `latestCheckpointFor` itself have no production caller — only a re-export (`run_supervise.ts:668`) and `tests/scripts/run_checkpoint.test.ts`; `run:supervise` accepts only `--digest`, `--print-relaunch`, `--relaunch` (`run_supervise.ts:596`). `writeCheckpoint` is a plain `writeFileSync` (`run_checkpoint.ts:243-247`) and an unreadable file is skipped silently (`:282-286`, `:298-301`), so a torn newest checkpoint resumes against an older one unannounced. |
| F10 | **A stitch reports success on a clip it could not open.** `stitch.sh` rejects only a missing file (`src/scripts/ai-video/stitch.sh:217`), concatenates with `-c copy` (`:355`) and prints `"missing":0` (`:359`). *(executed)* `AIV_DRYRUN=false`, a manifest declaring 2 s + 5 s, a text file named `.mp4` as clip 2: ffmpeg logs "Impossible to open … Invalid data", the script exits **0** with `{"scenes":2,"missing":0}`, the output probes at 2.02 s. The pack is lab tier (`src/domains/ai-video/pack.yaml:18`, `:26`). |
| F11 | **A visual-regression check that cannot fail, and runs nowhere.** `character-consistency` claims "pixel similarity ≥ 95%" (`src/skills/character-consistency/SKILL.md:28-29`, `:127-131`). The only `compare` call (`src/scripts/ai-video/test-pipeline.sh:149`) compares three committed `locked.png` fixtures with identical sha256 (`8cdaacb6…` ×3); the script is wired into no CI job or task. |

Mechanism shapes drawn in from Source A, all adapted and none copied: a price
that cannot be quoted is a state, never a zero
<!-- harvest:unquotable-price-is-a-state -->; a spend ledger that moves through
`estimated → reserved → completed | failed | released` and never reopens a
terminal state <!-- harvest:reserve-then-reconcile-spend-ledger -->. Everything
else in this file is own analysis of this tree.

**Already present, no phase** — both parent plans proposed these and the tree
has them: provider health `available | degraded | unavailable | unknown`
(`src/scripts/ai_council/qualification.ts:57`); append-only journal with atomic
writes and locks; findings that never auto-pass a round cap; a paired benchmark
corpus (`internal/bench/corpora/ab-trackb-v2.yaml`, 34 tasks) and 30 golden
replay scenarios (`tests/golden/baseline/`); the transport-fallback record in
the artefact; a reasoned best-effort events write
(`src/scripts/_lib/council_fallback_wiring.ts:106-120`).

## Phase 1 — A timeout stays a timeout

First and alone: the only defect here that can charge twice with no ceiling set.

- [x] **1.1 Pin the reading as tests.** In `tests/scripts/ai_council/clients.test.ts`:
      `timeout-with-login-substring-is-timeout` (the F1 string → `timeout`),
      `timeout-is-never-fallback-eligible` (same string, default policy →
      ineligible), and the failure matrix — truncated JSON on stdout, stderr plus
      a kill signal, quota text beside a timeout — each asserting the protected
      class wins. Seen red before 1.2.
      verify: `npx vitest run tests/scripts/ai_council/clients.test.ts -t timeout-with-login-substring-is-timeout --reporter=verbose` -> /✓.*timeout-with-login-substring-is-timeout/
- [x] **1.2 Ambiguity resolves to the protected class.** `_classify_stderr`
      tests `_TIMEOUT_PATTERNS` before the auth and quota lists; a string that
      matches an ineligible class and an eligible one is ineligible. The bare
      `login` narrows to the phrases it was written for (`not logged in`,
      `please log in`, `login required`), each pinned by a fixture from the
      provider CLI's real output.
      verify: `npx vitest run tests/scripts/ai_council/clients.test.ts --reporter=verbose` -> /✓.*timeout-is-never-fallback-eligible/
- [x] **1.3 Genuine auth still falls back.** `genuine-auth-still-falls-back`:
      `not logged in` stays `auth_expired` and stays eligible under the policy
      that allows it today.
      verify: `npx vitest run tests/scripts/ai_council/clients.test.ts -t genuine-auth-still-falls-back --reporter=verbose` -> /✓.*genuine-auth-still-falls-back/
- [x] **1.4 The metered transport is never dispatched.** An end-to-end case
      with a spied API transport: a CLI seat failing with the F1 stderr ends the
      seat; the spy records zero calls.
      verify: `npx vitest run tests/scripts/ai_council/clients.test.ts -t timeout-never-dispatches-api --reporter=verbose` -> /✓.*timeout-never-dispatches-api/
- [x] **1.5 The latent `parse_failed` replay is closed.** `classifyCliFailure`
      stops mapping an exact `parse_failed` to `cli_unsupported`; a parse failure
      happens after generation.
      verify: `npx vitest run tests/scripts/ai_council/clients.test.ts -t parse-failed-is-not-replayed --reporter=verbose` -> /✓.*parse-failed-is-not-replayed/

*Exit: 1.1–1.5 green, every existing `transport_resolver` and `clients` test
green.*

## Phase 2 — Unpriced is a state, not a zero

- [ ] **2.1 The estimate says it is unpriced.** `CostEstimate` gains
      `priced: boolean`, `false` on a null `lookup`; amounts stay zero for
      arithmetic callers. No price row, file or fetch is added.
      verify: `npx vitest run tests/scripts/ai_council/pricing.test.ts -t estimate-carries-priced-flag --reporter=verbose` -> /✓.*estimate-carries-priced-flag/
- [ ] **2.2 A set ceiling refuses an unpriced billable seat (D2).** With any USD
      ceiling set, `_breach` returns `unpriced` for a billable seat whose
      estimate is unpriced; the seat is not called and is reported the way an
      over-budget seat is — pause and report, no question. With no ceiling, what
      runs is unchanged (ADR-279). Case `unpriced-billable-breaches-set-ceiling`
      is seen red first.
      verify: `npx vitest run tests/scripts/ai_council/pricing.test.ts -t unpriced-billable-breaches-set-ceiling --reporter=verbose` -> /✓.*unpriced-billable-breaches-set-ceiling/
- [ ] **2.3 An unpriced call reaches the ledger (D3).** `record_spend`
      separates non-billable from unpriced: a billable call with
      `priced: false` appends `usd: null, unpriced: true` with its token counts;
      `today_spend_usd` reports `unpriced_calls` beside the sum.
      verify: `npx vitest run tests/scripts/ai_council/budget_guard.test.ts -t unpriced-row-is-appended --reporter=verbose` -> /✓.*unpriced-row-is-appended/
- [ ] **2.4 The run says so.** The council's cost line prints
      `unpriced: <provider>/<model>` once per such seat, ceiling or not.
      verify: `npx vitest run tests/scripts/council_cli.test.ts -t prints-unpriced-seat --reporter=verbose` -> /✓.*prints-unpriced-seat/

*Exit: 2.1–2.4 green; with no ceiling, council output over listed models is
byte-identical to today apart from the unpriced line.*

## Phase 3 — A set ceiling holds two councils at once

No-op by construction while no ceiling is set; 3.4 proves it.

- [ ] **3.1 Reserve before the call, under a lock.** With a ceiling set, a
      billable seat takes the ledger lock (`src/scripts/_lib/fs_atomic.ts`
      family), re-reads, appends a `reserved` row with its estimate and `run_id`,
      and releases; `would_exceed` counts reservations without a terminal row.
      verify: `npx vitest run tests/scripts/ai_council/budget_guard.test.ts -t concurrent-councils-cannot-both-pass --reporter=verbose` -> /✓.*concurrent-councils-cannot-both-pass/
- [ ] **3.2 Reconcile after it.** `completed` with the actual amount;
      `released` when the call failed before the provider accepted it; an unknown
      outcome keeps its reservation until run end, then closes as `unreconciled`
      at the estimate — never zero. Terminal states never reopen.
      verify: `npx vitest run tests/scripts/ai_council/budget_guard.test.ts -t reservation-states-never-reopen --reporter=verbose` -> /✓.*reservation-states-never-reopen/
- [ ] **3.3 A crashed run's reservation expires (D8).** A `reserved` row with no
      terminal row older than the hold window closes as `unreconciled` at its
      estimate on the next ledger read, so a killed run cannot hold budget
      forever and is never counted as zero.
      verify: `npx vitest run tests/scripts/ai_council/budget_guard.test.ts -t stale-reservation-expires-at-estimate --reporter=verbose` -> /✓.*stale-reservation-expires-at-estimate/
- [ ] **3.4 No ceiling, no rows.** With every ceiling at 0 the ledger after a
      council run is byte-identical to today's.
      verify: `npx vitest run tests/scripts/ai_council/budget_guard.test.ts -t no-ceiling-no-reservation-rows --reporter=verbose` -> /✓.*no-ceiling-no-reservation-rows/

## Phase 4 — A downgrade is on the record

- [ ] **4.1 The response carries what was configured.** Applied size-fit
      decisions attach to each affected member; its response metadata carries
      `configured_model` and `size_fit_reason`. Case
      `size-fit-downgrade-is-recorded` is seen red first.
      verify: `npx vitest run tests/scripts/council_cli.test.ts -t size-fit-downgrade-is-recorded --reporter=verbose` -> /✓.*size-fit-downgrade-is-recorded/
- [ ] **4.2 The artefact says so.** `response_render` adds
      `model: <answered> (downgraded from <configured>: <reason>)` beside the
      transport note. No test imports `response_render` today; this step creates
      `tests/scripts/ai_council/response_render.test.ts`.
      verify: `npx vitest run tests/scripts/ai_council/response_render.test.ts -t renders-size-fit-downgrade --reporter=verbose` -> /✓.*renders-size-fit-downgrade/

*Exit: 4.1–4.2 green. Auto-apply stays the default (D4).*

## Phase 5 — Tests that cannot spend and cannot quietly pass

- [ ] **5.1 The production path is fixed, then the test runs it.**
      `score_skill_selection.ts:51` reads the producer's path; the test imports
      the producer's constant; the crash branch becomes an always-running
      fixture-backed happy path (`reader-and-writer-share-the-clusters-path`).
      verify: `npx vitest run tests/scripts/score_skill_selection.test.ts -t reader-and-writer-share-the-clusters-path --reporter=verbose` -> /✓.*reader-and-writer-share-the-clusters-path/
- [ ] **5.2 The network is closed by default, children included (D5).** A setup
      file points `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` at a closed loopback
      port with `NO_PROXY=localhost,127.0.0.1,::1` in `process.env`, so every
      spawned `curl`, `git` and `node` that honours proxy variables inherits it,
      and installs an undici dispatcher refusing non-loopback origins in-process.
      `AGENT_CONFIG_ALLOW_NETWORK=1` lifts both; the existing live-test flags
      work only together with it. A child that ignores proxy variables is a
      named gap in the file header, not a claim of isolation.
      verify: `npx vitest run tests/_lib/network_guard.test.ts -t spawned-curl-cannot-reach-a-public-address --reporter=verbose` -> /✓.*spawned-curl-cannot-reach-a-public-address/
- [ ] **5.3 A test that must never run.** In the same file, a case gated on the
      live-test flags throws "a live test ran without the network opt-in"; a
      meta-case asserts `fetch('https://example.com')` is refused and a spawned
      `curl` exits non-zero. Neither needs the network.
      verify: `npx vitest run tests/_lib/network_guard.test.ts -t in-process-fetch-is-refused --reporter=verbose` -> /✓.*in-process-fetch-is-refused/
- [ ] **5.4 A new conditional skip is counted (D6).** `SUPPRESSION` also
      matches `.skipIf(` and `.runIf(`; an added one passes
      `check_test_weakening` only with a `// skip-reason:` on the same or
      preceding line. The 111 existing sites are untouched.
      verify: `npx vitest run tests/scripts/check_test_delta.test.ts -t conditional-skip-needs-reason --reporter=verbose` -> /✓.*conditional-skip-needs-reason/

*Exit: 5.1–5.4 green on the sharded run; suite wall time moves by < 2 %.*

## Phase 6 — A resume that can verify, a stitch that was checked

- [ ] **6.1 The verification has a command (no new verb, ADR-041).**
      `run:supervise --verify <slug>` runs `latestCheckpointFor` then
      `verifyCheckpoint` and prints `renderVerification`, exit 0 on agreement and
      1 on a disagreement — "a disagreement is not an error" for the run
      (`roadmap-process-loop.md:806-811`), so the exit is a signal, not a halt.
      verify: `npx vitest run tests/scripts/run_supervise.test.ts -t verify-flag-renders-per-field-report --reporter=verbose` -> /✓.*verify-flag-renders-per-field-report/
- [ ] **6.2 The two instructions name the command.**
      `roadmap-process-loop.md:793-799` and `headless_invocation.ts:86-92` say
      `run:supervise --verify <slug>` instead of the function names.
      verify: `grep -c 'run:supervise --verify' src/agent-src/contexts/execution/roadmap-process-loop.md src/scripts/_lib/headless_invocation.ts` -> /:[1-9]/
- [ ] **6.3 A torn checkpoint is not an absent one.** `writeCheckpoint` writes
      through `write_atomic` (`src/scripts/_lib/fs_atomic.ts:70`);
      `latestCheckpointFor` still skips an unreadable file but the `--verify`
      report names it (`unreadable: <file>`).
      verify: `npx vitest run tests/scripts/run_checkpoint.test.ts -t unreadable-newest-is-named --reporter=verbose` -> /✓.*unreadable-newest-is-named/
- [ ] **6.4 Every clip is readable before concat.** With `AIV_DRYRUN=false`,
      each listed clip is opened with `ffprobe -v error`; an unreadable clip is
      treated as missing, honouring `--abort-on-missing` / `--continue` /
      `--skip-scene`. The stdout shape of a valid cut run is unchanged
      (`stitch.sh:149-151`).
      verify: `npx vitest run tests/scripts/ai_video_stitch_flags.test.ts -t stitch-refuses-unreadable-clip --reporter=verbose` -> /✓.*stitch-refuses-unreadable-clip/
- [ ] **6.5 Mismatched streams and a short output are refused (D9).** Before
      `-c copy`, codec, resolution, frame rate and the presence of an audio
      stream where the manifest declares `audio_embedded` (`stitch.sh:190`) are
      compared; a mismatch exits non-zero naming the first divergent scene and
      suggesting `--mode handoff`. After concat, the output duration is compared
      with the manifest sum minus skipped scenes; a shortfall beyond the stated
      tolerance exits non-zero. Black and silent spans go to stderr, never fatal.
      verify: `npx vitest run tests/scripts/ai_video_stitch_flags.test.ts -t stitch-output-matches-manifest --reporter=verbose` -> /✓.*stitch-output-matches-manifest/
- [ ] **6.6 The found-elsewhere items are handed over.** Each H1 sentence becomes
      one step in `road-to-sentences-the-tree-can-back`, the H2 instruments one
      step in `road-to-what-was-built-and-never-ran`, the H3 census a note in
      `road-to-typed-grants-that-persist` — each edit names this file.
      verify: `grep -l 'road-to-unknowns-that-say-so' agents/roadmaps/archive/road-to-sentences-the-tree-can-back.md agents/roadmaps/archive/road-to-what-was-built-and-never-ran.md` -> /what-was-built/

*Exit: 6.1–6.6 green; `ai_video_stitch_handoff.test.ts` unchanged and green.*

## Handoffs — found here, owned elsewhere

**H1 → `road-to-sentences-the-tree-can-back`** (one step per sentence there):
- `docs/safety.md:18` — "rules load only when the matching user-type is active";
  `applies_to_user_types` has no non-test reader.
- `docs/decisions/ADR-020-global-only-consumer-scope.md:199-201` — names
  `scripts/lint_global_paths.py` as a required precondition; its successor has no
  caller (an ADR edit needs its own record).
- `docs/contracts/low-impact-corpus-format.md:95` — names
  `scripts/ai_council/probation_gate.py`; its successor has no caller.
- `src/agent-src/presets/README.md:20`, `src/agent-src/profiles/README.md:23` —
  `task lint-config-schema`; no such task or script.
- `src/agent-src/templates/agents/proposal.example.md:12` — `task check-proposal`;
  no such task.
- `src/config/agent-settings.template.yml` — lacks `verbosity.script_output`
  (`src/scripts/_lib/script_output.ts:14`) and `personal.user_name`
  (`src/scripts/install.ts:335`).
- `README.md:122` — links `/video:from-script` into `.augment/`, which is
  gitignored (`.gitignore:145`); the source is
  `src/domains/ai-video/video/from-script/command.md`.
- `src/skills/character-consistency/SKILL.md:28-29`, `:127-131` — a ≥ 95 %
  similarity check on rendered frames that no script performs; the one compare
  that exists sees three identical files and runs in no job (F11, D10).
- `src/skills/prompt-validator/SKILL.md:20-24`, `:153` — "deterministic pre-spend
  gate … contradictions block", with no executable; not in `/video:from-script`'s
  `skills:` line (`src/domains/ai-video/video/from-script/command.md:11`) (D11).

**H2 → `road-to-what-was-built-and-never-ran`**: `ai_council/probation_gate.ts`,
`lint_global_paths.ts` — wire-or-withdraw.

**H3 → `road-to-typed-grants-that-persist`**: approvals the agent can produce
itself — `council:run --confirm` (`council_cli.ts:2534-2540`),
`gates --execute --confirm` (`src/agent-src/scripts/gate_execute.ts:364`),
`release --yes` (`release.ts:879`), `council:grant-billing`, settings `source`
defaulting to `manual`. Under the 2026-09-05/08 owner rulings none is a defect
by itself.

**H4 → `road-to-a-hook-carrier-that-is-never-silent`**: a SessionStart line when
no dispatcher resolves. That roadmap owns the fallthrough and its repair.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | One stem, six phases; Phase 1 lands first as its own PR | One theme (an unknown is a named state); a split doubles the estate offset for no ordering gain, and Phase 1 is the only double-charge with no ceiling | Phases 5–6 stall on CI FFmpeg while 1–4 are done — then split 5–6 out |
| D2 | reversible-technical | agent | Under a set ceiling an unpriced billable seat is refused (pause and report), never warned | ADR-279 says a set ceiling "behaves as that contract describes once set"; a ceiling an unknown passes is not that ceiling | a provider ships a model faster than the table is refreshed and refusals become routine |
| D3 | reversible-technical | agent | Without a ceiling, unpriced calls get one ledger row and one output line; nothing is refused | Visibility without a gate is what ADR-279 permits | the ledger row count grows without a reader |
| D4 | reversible-technical | evidence | Size-fit auto-apply stays the default; Phase 4 makes it visible | The default is already on (`council_cli.ts:1960`); the defect is invisibility, not the downgrade | an artefact shows a downgrade that changed a verdict |
| D5 | reversible-technical | agent | Network guard = proxy env for children plus an in-process dispatcher; documented as defence in depth, not isolation | A socket patch alone misses the `curl` transport (F8); a child ignoring proxy variables escapes either way | a test is found reaching the network past the guard |
| D6 | reversible-technical | agent | New conditional skips need a `skip-reason`; the 111 existing sites are untouched | Diff-only and one line; grandfathering avoids a 60-file sweep | reason lines turn out to be boilerplate in review |
| D7 | reversible-technical | agent | The stitch tests skip with a `skip-reason:` when `ffprobe` is absent; the job that runs them installs FFmpeg in the same change, carried by its workflow-step ratification artefact | No CI workflow installs FFmpeg today (grep over `.github/workflows`) | the install step costs more than the job budget allows |
| D8 | reversible-technical | agent | Stale reservation hold window = the run's own timeout plus one hour; it closes at the estimate | A crash never reaches "run end"; zero would undercount, the estimate never does | a legitimate run outlives the window |
| D9 | reversible-technical | agent | Fatal: unreadable clip, stream mismatch on the copy path (incl. missing declared audio), duration shortfall; black/silence on stderr only | The fatal set is what *(executed)* F10 shows broken on decode; black/silence can be intended | a valid creative cut is refused |
| D10 | reversible-technical | agent | `character-consistency`: correct the claim (H1); no frame comparison is built, and `test-pipeline.sh` is not given a self-test it would run nowhere | Building it is a feature for a lab-tier pack; the script has no CI job and needs ImageMagick no runner has | the pack leaves lab tier |
| D11 | reversible-technical | agent | `prompt-validator`: correct the claim (H1); no executable gate is built | A validator is a feature, not a defect fix | `/video:from-script` starts listing the skill |

## What this roadmap deliberately does not do

- **K1** Copy anything from Source A (copyleft) — mechanism shapes only.
- **K2** Add a price table, file, fetch or a fifth price surface.
- **K3** Turn on a ceiling, per-action threshold or first-paid-tool approval.
- **K4** Add asks, attestation fields or turn binding to approval flags (H3).
- **K5** A run-level decision log keyed by subject; no measured harm from the
  keyless `decision:memo` (`src/scripts/decision_memo.ts:51-62`).
- **K6** A board or observer UI; `conformance_scan` already replays host
  transcripts.
- **K7** A schema-field-consumer gate over every frontmatter field.
- **K8** Taste dials, bespoke composition, distinctness review.
- **K9** Unwrap the best-effort events write (`council_fallback_wiring.ts:106-120`).
- **K10** A new CLI verb (ADR-041) — 6.1 is a flag on `run:supervise`.
- **K11** Reconcile `gate_execute.ts`'s `actual_usd: null` (no source of actuals).
- **K12** A typed stage contract on `src/flows`. ADR-055 is accepted: flows are
  "curated, navigable command lists, not workflow engines", and executable graphs
  are "a schema v2 event" (`docs/decisions/ADR-055-flow-layer-data-model.md:57-59`,
  `:71`; `src/scripts/schemas/flow.schema.json:7-8`).
- **K13** An `effect_class` taxonomy; ADR-260 Decision 9 closes the irreversible
  vocabulary at eleven typed ops
  (`docs/decisions/ADR-260-owner-rulings-consumer-first-typed-authority-and-proposal-form.md:78-84`).
- **K14** Provider ranking by quality, cost, latency — health exists
  (`qualification.ts:57`), ranking is parked, council seating is family
  diversity only (`src/scripts/ai_council/seating.ts:8`).
- **K15** A creative production vertical (Remotion and FFmpeg adapters, screen
  demos, subtitles, safe areas, golden frames, brand kits). No defect asks for
  them and the tree has no such surface; the pack is `ai-video`, lab tier.
- **K16** Content-addressed artefact/stage receipts and an evidence-and-resume
  pilot; no defect measured, and the parts exist apart.
- **K17** A new baseline harness — `bench:ab` v2 and 30 golden replays exist.
- **K18** Unifying the three finding-severity vocabularies — no harm measured.
- **K19** Atomic writes for `/work` engine state; its reader already fails loud
  (`src/agent-src/templates/scripts/work_engine/state.ts:492-499`).
- **K20** "No mandatory runtime service" as doctrine; ADR-124's Class-B row is
  superseded by ADR-249.
- **K21** A four-state test-outcome taxonomy; 5.4 is the defect-sized slice.
- **K22** Corpus extras (tool-capability-missing, policy-revision-changed,
  host-switch) and metadata-only skill routing — no measured defect, and routing
  belongs to `road-to-skills-that-arrive-when-called`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Narrowed auth patterns miss a real auth message | implementation | A genuine expired login is classified `other` and the seat is lost instead of falling back. | Fixtures from real CLI output; 1.3 pins the fallback; a miss degrades to "seat lost", never "paid twice". | Phase 1 — A timeout stays a timeout |
| 2 | A set ceiling refuses a seat under an old price table | product | A person who set a ceiling meets a refusal for a model the table does not list. | The report names seat, model and fix; the ceiling is the person's own. | Phase 2 — Unpriced is a state, not a zero |
| 3 | The network guard breaks a test that silently used the network | implementation | A test that passed by reaching a live host goes red. | That test is the finding; it gets the live flag or a fixture. | Phase 5 — Tests that cannot spend and cannot quietly pass |
| 4 | Stitches that "worked" with mixed streams are now refused | product | A user's mixed-codec manifest stops producing a file. | Those outputs were already broken on decode (F10, executed); the message points at `--mode handoff`. | Phase 6 — A resume that can verify, a stitch that was checked |
| 5 | FFmpeg in CI costs job time | implementation | The stitch job grows by the install. | Skip-with-reason where absent; the install is scoped to the one job (D7). | Phase 6 — A resume that can verify, a stitch that was checked |

## Acceptance Criteria

- [ ] **AC-1** No CLI failure whose stderr matches a timeout pattern is
      replay-eligible, whatever else it contains, and the metered transport is
      not dispatched for it.
- [ ] **AC-2** No council run passes a person-set USD ceiling with an unpriced
      billable seat; every such seat appears in output and ledger.
- [ ] **AC-3** Two concurrent councils under one set ceiling cannot both spend
      the same remainder; a crashed run's reservation closes at its estimate.
- [ ] **AC-4** Every size-fit downgrade names the configured model in the
      artefact.
- [ ] **AC-5** With no flag set, an in-process `fetch` and a spawned `curl` to a
      public address both fail; a sentinel proves the opt-in is closed. Children
      that ignore proxy variables are a documented gap, not covered.
- [ ] **AC-6** An added `skipIf`/`runIf` without a reason is red in
      `check_test_weakening`.
- [ ] **AC-7** `score_skill_selection --baseline` reads what the producer writes.
- [ ] **AC-8** A resumed run can produce the per-field checkpoint verification
      with one command, and an unreadable newest checkpoint is named.
- [ ] **AC-9** `stitch.sh` exits non-zero on an unreadable clip, a stream
      mismatch on the copy path, or a duration shortfall; a valid run's stdout is
      byte-identical.
- [ ] **AC-10** With every ceiling unset, council output and ledger bytes are
      unchanged except for unpriced-seat lines.

## Notes — how this file was derived

Two sessions each ran three loops over Source A and this tree, then each
consolidated again in three more loops. The tree-pinned plan (this file's
predecessor, at `82a450c4e`) is the operative base. The parallel plans were
written without tree access; each item was classified against the tree:

- **Contradicted by an accepted ADR:** the flow stage contract (ADR-055, K12) and
  the effect taxonomy (ADR-260 D9, K13).
- **Already present:** provider health, journal/atomic/locks, finding
  no-auto-pass, the baseline harness, the layer model in `docs/flows.md`.
- **Premise corrected:** "Creative Pack" is a README phrase — the pack is
  `ai-video`, lab tier; ADR-124's Class-B row is superseded by ADR-249.
- **Taken from the last parallel plan (V4):** the failure matrix and the
  genuine-auth regression (1.1, 1.3), the dispatch spy (1.4), a lock around the
  reservation (3.1), a stale-hold expiry (3.3), missing declared audio (6.5), and
  the correction that proxy variables are defence in depth, not isolation (5.2,
  AC-5).
- **Declined from V4:** provider job ids (council calls have none), the
  SessionStart hint (H4), corpus extras and metadata routing (K22), per-PR review
  independence (already a rule and `road-to-self-modification-that-a-council-must-pass`),
  the evidence/resume pilot (K16), the creative vertical and runboard (K15, K6),
  the test-outcome taxonomy (K21).
- **Changed in this round:** the predecessor's separate red-test phase was folded
  into the first step of each fix phase — its verify lines matched `✗`, which
  vitest never prints (it prints `×`), so they could never have passed; its
  self-test for `test-pipeline.sh` was dropped (D10) because the script runs in no
  job.
