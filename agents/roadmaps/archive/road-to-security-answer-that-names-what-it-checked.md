---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >
  Owner search before adding — grep -rlF for "fsmonitor", "uploaded",
  "polyglot", "File Handling", "needs_validation", "is my app secure" over
  agents/roadmaps/*.md, later/, stubs/ (whole tree) — no active, parked or stub
  roadmap owns casual security questions, the git exec-config probes or upload
  controls. The adjacent owners (closed road-to-a-finding-that-fails-a-test,
  stubs road-to-a-security-chain-measured and road-to-a-route-that-names-its-guard)
  receive their parts as arrivals in Phase 6 instead of steps here.
relates:
  - slug: road-to-a-finding-that-fails-a-test
    relation: extends
    note: >
      Archived 2026-10-25. Shipped the verifier, the three states and the
      ledger; this closes the residue the inbox round found still true.
  - slug: road-to-a-security-chain-measured
    relation: disjoint
    note: >
      Stub. Owns the bench, the fixture app and the host-native probe; this
      roadmap only adds items to it.
---
# Road to a security answer that names what it checked

> **Source:** `agents/tmp.old/inbox-2026-10-as/` (topics t01–t03), analysed
> 2026-10-25 against `main@01bb841cbd`.
> **Arrivals:** 4 — latest `inbox-2026-10-as` (2026-10-25); earlier:
> `inbox-2026-10-ao`, `inbox-2026-09-b` (codenames only). Upload security: 2,
> earlier `inbox-2026-09-c`.

## Goal

A casual "is my app secure?" reaches `security-audit` and gets an answer that
says what was checked and what was not, never a bare all-clear. The ledger can
say `partial` instead of implying completeness. The code-graph's git probes do
not run repo-local exec config. And the threat corpus, the pre-ship checklist
and the Laravel stack rows cover the two upload attacks the source described:
a file that executes when it is fetched, and a file that attacks the processor
or scanner that reads it.

## Constraints from the source transcripts

- The owner asked for upload gaps to be **closed while coding and detected**
  (t03 user turn). Both halves land here: authoring knowledge (Phase 4) and
  detection by grounding and pre-ship greps (Phase 4). A lexical consumer
  detector is parked (Phase 6), not dropped.
- No parameter values in the corpus (ADR-238 rationale): server config and
  processor versions are written as **negative tests** and routed to vendor
  policy, never as values.
- No new skill, no new command verb (ADR-041): content lands where agents
  already look.

## Phase 1 — Git probes ignore repo-local exec config

- [x] **1.1 One helper, every code-graph git call.** `code_graph/detect.ts:280`
      (`git status`) and `map.ts:224` (`git diff` against the worktree) run
      under `hardenedSpawnEnv()`, which neutralises env-borne git config but not
      the target's own `.git/config` — so `core.fsmonitor` in that file runs.
      Add `gitSafeArgs()` (`-c core.fsmonitor=false -c core.hooksPath=/dev/null`)
      and prefix every `execFileSync('git', …)` under `src/scripts/code_graph/`.
      Severity is low today: the probes run against the session's own checkout,
      whose git already honours that config. It matters for auditing a foreign
      tree.
      verify: `npx vitest run tests/scripts/code_graph_git_safe_args.test.ts` -> 0

## Phase 2 — A casual question finds the skill and gets a scoped answer

- [x] **2.1 Trigger corpus and descriptions.** Add casual whole-app exemplars
      (DE/EN, "is my app secure before launch") to
      `security-audit/evals/triggers.json`. State the whole-app/launch question
      in the `security-audit` description, and state in `agent-security-review`
      that it reviews the agent's own config, not application code.
      verify: `npx vitest run tests/scripts/security_audit_route_probe.test.ts` -> 0
- [x] **2.2 Guidance-mode answer shape.** `security-audit` gains a casual-question
      path: a short check, then a scope block (`checked: …` / `not checked: …`),
      then an offer of `/audit code full`. It never says "secure" or "no
      vulnerabilities" without a ledger. This is skill text, not rule text,
      so it adds no per-spawn cost.
      verify: `grep -c "not checked:" src/skills/security-audit/SKILL.md` -> /^[1-9]/
- [x] **2.3 Skill hygiene from the residue.** Replace "drop it" with the
      `needs_validation` / `rejected` exits; point the dependency step at
      `/audit deps` instead of restating it; anchor severity to demonstrated
      impact; qualify the rate-limit row; name non-HTTP entry points (CI
      workflows, CLI/env, model context and tool arguments).
      verify: `grep -c "drop it" src/skills/security-audit/SKILL.md` -> /^0$/

## Phase 3 — The ledger can say partial

- [x] **3.1 `run_status` on the security ledger.** Derive
      `complete | partial | not_enumerated` in `_lib/security_ledger.ts`:
      `complete` only when rows exist and none is still open; zero rows is
      `not_enumerated`, never `complete`. `/audit code show` prints it first.
      verify: `npx vitest run tests/scripts/security_ledger.test.ts` -> 0

## Phase 4 — Uploads that stay data

- [x] **4.1 Freeze the misses first.** A grounding test over the reproduced
      misses: "thumbnails with ImageMagick", "virus scan uploaded attachments",
      "handle uploaded files", "Bild hochladen", an avatar upload. Each must
      ground to `file-upload` with a file-upload threat row. A near-miss
      ("publish the release to npm") must not.
      verify: `npx vitest run tests/scripts/threat_modeling_upload_grounding.test.ts` -> 0
- [x] **4.2 Surface keywords.** Add the inflected and processor class signals
      (uploaded, uploads, multipart, avatar, thumbnail, resize, exif, virus,
      scanner, hochladen, Anhang) to `surfaces.csv` and the manifest's
      `detect.surfaces`. Data only; the engine is unchanged.
      verify: `npx vitest run tests/scripts/threat_modeling_delegated_action_grounding.test.ts` -> 0
- [x] **4.3 Corpus rows.** Reorder the polyglot row so content sniffing is a hint,
      not the first control. Add class rows for: processor or scanner as attack
      surface; execution on fetch through handler config; scan-before-publish
      race; archive extraction; resource bombs. Each row carries a CWE reference
      and negative tests, never a config value or version floor. Add matching
      decision rules to `reasoning.csv`, and cite ASVS 5.0 V5 File Handling in
      the skill's references.
      verify: `grep -c "^file-upload," src/skills/threat-modeling/data/threats.csv` -> /^([7-9]|[1-9][0-9])$/
- [x] **4.4 Pre-ship checklist and stack rows.** `ai-code-blindspots` gains a
      file-upload row with backstop greps (client filename into a storage path,
      `mimes:` without `extensions:`, `move_uploaded_file(`, `include` of a
      variable, `phar://`). `design-intelligence` Laravel rows pair `mimes` with
      `extensions` and use `store()`, not `storeAs` with the client name.
      `security-audit` names the processor, fetch-execution and race classes,
      and routes processor versions to vendor policy. `supply-chain-intake`
      names a Dockerfile/apt install of a file processor as in scope.
      verify: `grep -c "extensions:" src/skills/design-intelligence/data/stacks/laravel.csv` -> /^[1-9]/

## Phase 5 — Regenerate and prove

- [x] **5.1 Projections and lint.** `task sync`, `task generate-tools`, skill lint,
      and the targeted suites above green.
      verify: `task lint-skills` -> 0

## Phase 6 — Hand-offs to the owners

- [x] **6.1 Arrivals on the adjacent owners.** `stubs/road-to-a-security-chain-measured`
      gains: a false-all-clear rate as a bench endpoint, the host-native security
      results import, and no-double-review when a host plugin already reviews at
      stop. The deferred work this round did not build lands in one parked
      roadmap with its reasons: a shadow absence-claim detector in
      `turn-end-gate`, verifier fan-out scoped by subject, wider
      `security-sensitive-stop` triggers, and a lexical upload-surface detector.
      verify: `grep -c "false-all-clear" agents/roadmaps/stubs/road-to-a-security-chain-measured.md` -> /^[1-9]/

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | New surface keywords move other prompts | implementation | "attachment", "import" or "image" pull non-upload prompts onto `file-upload` | Near-miss case in 4.1; existing grounding suites stay green in 4.2 | Phase 4 — Uploads that stay data |
| 2 | Corpus rows drift into parameter values | product | A row names a version or directive value that silently ages | Negative tests only; verify greps the new rows for version patterns | Phase 4 — Uploads that stay data |
| 3 | Description edits move the skill ranker | implementation | Sharper wording steals routes from neighbouring skills | Route probe in 2.1 asserts both directions; trigger corpus lint | Phase 2 — A casual question finds the skill and gets a scoped answer |

## Acceptance Criteria

- [x] AC-1 — No `execFileSync('git', …)` under `src/scripts/code_graph/` runs
      without the safe-args prefix, and a fixture with an fsmonitor marker
      stays untouched.
- [x] AC-2 — Casual whole-app security prompts rank `security-audit` above
      `agent-security-review`, and the skill's casual path ends in a
      checked / not-checked block.
- [x] AC-3 — A ledger with an open or zero rows never reports `complete`.
- [x] AC-4 — The reproduced upload misses ground to `file-upload` with a
      file-upload threat row, and the corpus names the processor and
      fetch-execution classes with negative tests, no config values.
