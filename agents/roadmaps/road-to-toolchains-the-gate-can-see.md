---
complexity: lightweight
status: ready
tree_pin: 81788b6e63
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_offset_exempt: "Operator asked in the invocation itself for the round's roadmaps to be processed with /roadmap:process-full in the same run (2026-11-03); this file is executed and archived in the same change, so the active count returns to its floor. Owner search at 81788b6e63 (grep -rlF for isVerificationAttempt, detectProjectShape, _dotnet_basis, UNSUPPORTED_STACK, IGNORE_DIRS over agents/roadmaps, later, stubs) found only stubs/road-to-the-16-3-0-findings-residue.md, which owns the runner.ts line ceiling, not engine detection; that item is closed here as 2.1."
relates:
  - slug: later/road-to-a-game-the-agent-can-playtest
    relation: extends
    note: "The game-specific remainder of the same round; it needs these generic fixes first."
---
# Road to toolchains the gate can see

> **Source:** `agents/tmp.old/inbox-2026-11-q/` (one topic: an agent building a
> game in an engine and a 3D app).
> **Arrivals:** 1 — `inbox-2026-11-q` (2026-11-03).

## Goal

The completion gate, the stack detector and the code graph recognise the
toolchains this package already names, before any game-specific work. Every
step fixes a defect verified at `81788b6e63`; none adds a skill, a hook concern
or a pack.

## Phase 1 — The gate accepts the resolver's own commands

Evidence (executed): `src/scripts/_lib/verification_command.ts:240` — a probe of
`isVerificationAttempt` returned false for `dotnet test`, `rspec`,
`bundle exec rspec`, `./gradlew test`, `mvn test`, `npx playwright test`, all of
which `resolve_toolchain` itself emits (`toolchain-resolver.md:64-76`).

- [ ] **1.1 Resolver↔gate parity.** `segmentVerifies` accepts `dotnet test`,
      `rspec` (and `bundle exec` peeled like `npx`), `mvn`/`mvnw` and
      `gradle`/`gradlew` with `test`/`verify`/`check`, and `playwright test`.
      A parity test reads every runner command the resolver documents and
      asserts the gate counts it; seen red first.
      verify: `npx vitest run tests/scripts/verification_command_resolver_parity.test.ts tests/scripts/verification_command_anchoring.test.ts` -> 0

## Phase 2 — An engine project is recognised, not misrouted

Evidence (executed): `src/agent-src/templates/scripts/work_engine/stack/runner.ts:705`
— a Unity fixture resolved to `["dotnet test"]`; Godot and Unity fixtures
detected as stack `plain` (`stack/detect.ts:85`) and as project kind `unknown`
(`src/install/detect.ts:136`).

- [ ] **2.1 Extract the dotnet basis into a leaf module.** `runner.ts` sits at
      1,498/1,500 lines; move `_dotnet_basis`, `_dotnet_runners`,
      `_dotnet_project_text` to `stack/dotnet.ts` with no behaviour change.
      verify: `npx vitest run tests/scripts/work_engine/stack_runner.test.ts` -> 0
- [ ] **2.2 An engine marker suppresses `dotnet test`.** A Unity
      (`ProjectSettings/ProjectVersion.txt`) or Unreal (`*.uproject`) root
      yields no dotnet runner instead of a wrong one; note the precedence in
      `toolchain-resolver.md`.
      verify: `npx vitest run tests/scripts/work_engine/stack_runner.test.ts` -> 0 with a Unity fixture asserting no `dotnet test`
- [ ] **2.3 An engine project is not `plain`.** `detect_stack` returns
      `UNSUPPORTED_STACK` for an engine marker with no web marker, so the UI
      lane refuses instead of driving a browser at a game.
      verify: `npx vitest run tests/scripts/work_engine/stack_detect.test.ts` -> 0
- [ ] **2.4 Installer engine kinds.** `ProjectKind` gains `godot`, `unity`,
      `unreal`, detected from `project.godot`,
      `ProjectSettings/ProjectVersion.txt`, `*.uproject`; the install route's
      enum follows. Not added to the scope-prompt manifests.
      verify: `npx vitest run tests/install/detect.test.ts` -> 0

## Phase 3 — The code graph skips engine caches

Evidence (read): `src/scripts/code_graph/build.ts:59` — `IGNORE_DIRS` holds no
engine cache directory; since #2808 `.gitignore` is honoured, so the walk only
reaches them in a checkout without git or without an ignore file.

- [ ] **3.1 Engine cache dirs, conditional on a root marker.** With a Unity
      marker skip `Library`, `Temp`, `Obj`, `Logs`, `UserSettings`; with an
      Unreal marker skip `Intermediate`, `Saved`, `Binaries`,
      `DerivedDataCache`. Never unconditional — these names occur elsewhere.
      verify: `npx vitest run tests/scripts/code_graph_engine_caches.test.ts` -> 0, run in a tmp dir without git

## Phase 4 — Carry the round's other findings to their owners

Evidence (read): `agents/roadmaps/later/road-to-reach-transcribe.md:12` — arrival
1 only; `src/scripts/media_bundle.ts:512` still probes `whisper-cli`/`whisper` only.

- [ ] **4.1 Arrivals lines on existing owners.** `later/road-to-reach-transcribe.md`
      gets arrival 2; `stubs/road-to-mcp-fingerprint-slot-binding.md` gets the
      app-side code-tool shape as arrival 1.
      verify: `grep -c 'inbox-2026-11-q' agents/roadmaps/later/road-to-reach-transcribe.md agents/roadmaps/stubs/road-to-mcp-fingerprint-slot-binding.md` -> 1 each

## Decisions

| # | Decision | Decided by | Revisit-if |
|---|---|---|---|
| D1 | Game nouns in the intent classifier wait for the later roadmap: routing a game to the UI lane is harmful before 2.3, and to which lane it belongs is a design question with no consumer yet | own analysis, reversible | a first engine project commits to this repo's consumer set |
| D2 | `.cpp` in the code graph is deferred: it needs an extractor, include resolution and an ABI pin, far above this roadmap's size | own analysis | a C++ consumer asks |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Gate accepts too much | implementation | A broader verify list counts a command that proves nothing | Only runner commands the resolver documents; parity test pins the list both ways | Phase 1 — The gate accepts the resolver's own commands |
| 2 | Detector regresses a web stack | implementation | An engine marker check changes the verdict of an existing stack | Engine verdict only when no web marker exists; existing fixtures stay green | Phase 2 — An engine project is recognised, not misrouted |
| 3 | Cache skip hides real code | product | A non-engine repo with a `Library/` dir loses files | Skip only with the engine root marker | Phase 3 — The code graph skips engine caches |
