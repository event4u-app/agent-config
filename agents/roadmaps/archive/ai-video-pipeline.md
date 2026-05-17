---
complexity: lightweight
---

# Roadmap: AI Video Pipeline — Hollywood-level video generation via Claude

> Ship a single, end-to-end video-generation pipeline so content creators and editors can turn a script into a stitched, character-consistent, cinema-grade video using Claude as orchestrator and pluggable AI providers (Gemini Veo · Kling · OpenAI Images · Higgsfield · Sora).

## Prerequisites

- [x] Read `AGENTS.md` and `.agent-src.uncompressed/personas/README.md`
- [x] Read `.agent-src.uncompressed/templates/roadmaps.md` (this template)
- [x] Read `.agent-src.uncompressed/skills/roadmap-writing/SKILL.md`
- [x] `ffmpeg` available on `PATH` (validated by adapter setup, not assumed)
- [x] `curl`, `jq`, and a POSIX shell available on `PATH`
- [x] At least one provider API key available for an end-to-end smoke test
- [x] Reviewed source material (see Context): three prompt-library repos and Higgsfield landing

## Context

This roadmap creates a new capability — **video generation orchestrated by Claude** — that does not yet exist in the package. The unit of delivery is **one branch, one PR**. Execution is end-to-end in one pass; no calendar pacing.

The pipeline turns a script into a finished clip:

```
script (with optional dialogue + sound directions)
  → scene parse           (scene_expander — extracts dialogue/ambient blocks)
  → character lock        (character_consistency)
  → image prompt          (pixar_storyteller / video_director)
  → image render          (provider adapter — OpenAI / Higgsfield image model)
  → best-of selection     (operator-in-the-loop or scoring heuristic)
  → motion + audio prompt (motion_choreographer — audio block when adapter supports native audio)
  → video render          (provider adapter — Veo / Kling / Sora / Higgsfield; native audio when capable)
  → stitch + audio mux    (ffmpeg assembler — passes native-audio tracks through, muxes the rest)
```

Three personas drive the prompt quality: **Hollywood Director** (cinematic realism), **Pixar Storyboard Artist** (emotional animation), **AI Video Technical Director** (provider-tuned prompt structure).

- **Feature:** none (new capability — defined entirely by this roadmap)
- **Jira:** none
- **Source material:**
  - `geekjourneyx/awesome-ai-video-prompts` — provider-agnostic structural prompt frameworks
  - `hr98w/awesome-sora-prompts` — Sora-specific structural patterns + character lock language
  - `YouMind-OpenLab/awesome-seedance-2-prompts` — motion/duration choreography patterns
  - `higgsfield.ai` — presets, models, and consistency-lock UX patterns
- **Bounds:** No paid API calls during this roadmap unless the user invokes `/video:*` against a real key. Adapters MUST default to dry-run and return synthetic responses for tests. Output directory `agents/ai-video/` is operator scratch and gitignored.
- **In scope — audio:** Provider-native audio in video is supported when the backend offers it (e.g., Veo native speech / ambient sound, Sora-class native audio). Scripts may carry dialogue and sound directions; adapters pass them through and surface returned audio tracks in the stitched output. Operator-supplied audio (WAV/MP3) is also supported via `ffmpeg` mux.
- **Out of scope:** distribution, social-media posting, voice cloning of real people, pure standalone audio-only generation (TTS-only, music-only, sound-effects-only runs without a video target).

## Phase 1: Provider configuration and secrets surface

- [x] **Step 1:** Design the XML schema for `agents/.ai-video.xml` with one `<provider>` block per backend (`gemini-veo`, `kling`, `openai-images`, `higgsfield`, `sora`, plus an `<extra>` slot for future). Each block holds `<api-key>`, optional `<endpoint>`, `<default-model>`, `<dry-run>true|false</dry-run>`, and per-provider tuning (e.g., aspect, fps, max-duration). Root-level elements `<default-image-provider>` and `<default-video-provider>` declare which provider a `/video:*` run uses when the command does not pass `--image-provider` / `--video-provider`. Character-lock tokens (Phase 3 Step 3) are provider-agnostic; only adapter-layer tuning is provider-specific.
- [x] **Step 2:** Add `agents/.ai-video.xml.example` to the repo. Real keys file is NEVER committed.
- [x] **Step 3:** Add `agents/.ai-video.xml`, `agents/ai-video/`, and `agents/ai-video/**` to `.gitignore`. Verify with `git check-ignore`.
- [x] **Step 4:** Implement a config loader `scripts/ai-video/lib/load-config.sh` (POSIX `sh`) that parses the XML with `xmllint --xpath`, surfaces a single provider's settings as `AIV_KEY` / `AIV_ENDPOINT` / `AIV_MODEL` / `AIV_DRYRUN` env vars to its caller, and **never echoes the key** — only `present` / `missing`.
- [x] **Step 5:** Add a `scripts/ai-video/lib/redact.sh` helper used by every adapter to scrub keys from logs and error output before printing.
- [x] **Step 6:** Document the schema and key-handling rules in `agents/ai-video/README.md` (operator-facing; explains how to populate the XML, how to rotate keys, and the redaction guarantee).

**Exit criteria:** `agents/.ai-video.xml.example` exists; loader returns redacted status for each provider; `.gitignore` blocks the real file and the output directory; quality pipeline (`task lint-skills`, repo-local linters) green.

## Phase 2: Specialist personas — director, storyboard artist, technical director

- [x] **Step 1:** Create `.agent-src.uncompressed/personas/hollywood-director.md` from `_template-specialist/persona.md`. Voice — award-winning Hollywood director and cinematographer. Output expectations enforce the block list: SCENE · CHARACTER · ACTION · CAMERA · LENS · LIGHTING · ENVIRONMENT MOTION · SECONDARY MOTION · MOOD · DURATION · NEGATIVE CONSTRAINTS. Anti-patterns: vague "cinematic" with no lens/lighting; motion described without subject grounding.
- [x] **Step 2:** Create `.agent-src.uncompressed/personas/pixar-storyboard-artist.md`. Voice — senior Pixar storyboard artist. Output blocks: character sheet · scene prompt · image prompt · video prompt. Anti-patterns: flat acting, missing emotional beat, environment that doesn't react to the character.
- [x] **Step 3:** Create `.agent-src.uncompressed/personas/ai-video-technical-director.md`. Voice — AI technical director optimizing for Veo / Kling / OpenAI Images / Higgsfield / Sora. Output enforces separation of: static visual prompt · motion prompt · camera choreography · consistency lock · negative constraints. Critical Rules section names provider-specific token caps and supported aspect/duration ranges.
- [x] **Step 4:** Update `.agent-src.uncompressed/personas/README.md` Specialists table with the three new entries (id, tier=specialist, focus one-liner). No changes to the Core-6.
- [x] **Step 5:** Run `task sync` so the mirrors in `.agent-src/` and `.augment/` regenerate; verify all three personas appear in `.augment/personas/`.

**Exit criteria:** Three specialist persona files exist; pass the schema linter; `personas/README.md` table updated; mirrors regenerated.

## Phase 3: Core skills, scene-blueprint schema, adapter contract draft

- [x] **Step 1:** Create `.agent-src.uncompressed/skills/video-director/SKILL.md`. Cites `hollywood-director` persona. Trigger: production-grade cinematic prompts from a scene idea. Procedure produces the full 11-block prompt. Output schema documented.
- [x] **Step 2:** Create `.agent-src.uncompressed/skills/pixar-storyteller/SKILL.md`. Cites `pixar-storyboard-artist`. Trigger: emotional/animation scenes; produces character sheet + scene + image + video prompt.
- [x] **Step 3:** Create `.agent-src.uncompressed/skills/character-consistency/SKILL.md`. Implements **Character Lock**: stable identity tokens (face descriptor, wardrobe descriptor, palette tokens, gait/stance tokens), reused across every scene in a run. Defines the `character.json` shape stored under `agents/ai-video/<project-slug>/characters/`.
- [x] **Step 4:** Create `.agent-src.uncompressed/skills/scene-expander/SKILL.md`. Trigger: a one-line idea or a script line. Expands to the **Cinematic Scene Blueprint** (STYLE · SUBJECT · ENVIRONMENT · ACTION · CAMERA · LENS · LIGHTING · MOOD · DIALOGUE · AMBIENT SOUND · DURATION · NEGATIVE). Dialogue and ambient-sound blocks are optional but first-class — they feed adapters with native-audio capability and document operator intent for `ffmpeg`-mux fallback. Hard rule: every output is provider-agnostic; provider tuning is a later step owned by the technical director.
- [x] **Step 5:** Define the **scene-blueprint YAML schema** in `scripts/ai-video/lib/scene-blueprint.schema.yaml` and implement a parser `scripts/ai-video/lib/parse-blueprint.sh` that maps the prose blocks emitted by `scene-expander` to the structured JSON consumed by the adapter contract: `STYLE/SUBJECT/ENVIRONMENT/ACTION/CAMERA/LENS/LIGHTING/MOOD` → composed `prompt`; `DIALOGUE` → `audio.dialogue`; `AMBIENT SOUND` → `audio.ambient`; `DURATION` → `duration`; `NEGATIVE` → `negative`. Parser is pure POSIX `sh`; produces stdout JSON ready for adapter stdin. Schema lives under `.agent-src.uncompressed/skills/scene-expander/` and is mirrored by `task sync`.
- [x] **Step 6:** Draft the adapter contract in `scripts/ai-video/lib/adapter-contract.md` — capability flags (`audio: native | none`), stdin JSON shape, stdout JSON shape (`{video_path, audio_path?, audio_embedded: boolean}`), error contract (non-zero exit + `scenes/<id>/error.json`), dry-run fixture path. This is the contract `motion-choreographer` (next step) tunes against and that Phase 4 Step 1 finalizes + implements. Resolves the P3→P4 sequencing inversion: the contract surface exists before any skill or adapter references it.
- [x] **Step 7:** Create `.agent-src.uncompressed/skills/motion-choreographer/SKILL.md`. Cites `ai-video-technical-director`. Trigger: turning an approved still + scene blueprint into a **motion prompt** with camera choreography, primary subject motion, secondary environment motion, physically believable physics constraints, and — when the target adapter declares `audio: native` — a synchronized **audio direction** block (dialogue timing, ambient layer, sync cues). Tunes per provider via the adapter table defined in Step 6; explicitly records audio-capability fallbacks.
- [x] **Step 8:** All five skills run through `task lint-skills`. Fix violations before moving on.

**Exit criteria:** Five new skills land green on the linter; each cites at least one of the new personas where applicable; mirrors regenerated by `task sync`.

## Phase 4: Provider adapters — one shell entry per backend

- [x] **Step 1:** Finalize the adapter contract drafted in Phase 3 Step 6 (`scripts/ai-video/lib/adapter-contract.md`). Every adapter exposes `submit`, `poll`, `fetch`, and `dry-run` subcommands; consumes stdin JSON `{prompt, ref_images?, duration?, aspect?, seed?, audio?: {dialogue?, ambient?, language?, enable_native_audio?}}`; writes stdout JSON `{video_path, audio_path?, audio_embedded: boolean}` — `audio_embedded: true` means the provider returned a muxed MP4 (stitcher passes through), `audio_embedded: false` with `audio_path` means an external track to mux, `audio_embedded: false` without `audio_path` means video-only (operator supplies audio at stitch). Logs to stderr; respects `AIV_DRYRUN=true` by returning a fixture path without calling the network. Adapters MUST declare a capability flag (`audio: native | none`) consumed by the orchestrator. Failure path: non-zero exit + `<project>/scenes/<id>/error.json` (rollback contract lives in Phase 4 Step 7).
- [x] **Step 2:** Implement `scripts/ai-video/adapters/openai-images.sh` — image generation, ref-image support, character-lock seed reuse. Capability: `audio: none`.
- [x] **Step 3:** Implement `scripts/ai-video/adapters/gemini-veo.sh` — long-running `predictLongRunning` flow with polling and artifact download. Capability: `audio: native` — pass `audio.dialogue` / `audio.ambient` from the scene blueprint to Veo's native-audio request; download the muxed MP4.
- [x] **Step 4:** Implement `scripts/ai-video/adapters/kling.sh` — motion-tuned video generation; document max-duration handling. Capability: `audio: native` where the model supports it; fall back to `none` otherwise (orchestrator muxes via `ffmpeg`).
- [x] **Step 5:** Implement `scripts/ai-video/adapters/higgsfield.sh` — preset/model selection per the landing page model list; record which preset maps to which `motion-choreographer` profile. Capability: per-model (declared per preset).
- [x] **Step 6:** Implement `scripts/ai-video/adapters/sora.sh` — structural-prompt path informed by `awesome-sora-prompts`. Capability: `audio: native` for Sora-class native audio; pass `audio.dialogue` / `audio.ambient` through.
- [x] **Step 7:** Implement `scripts/ai-video/stitch.sh` — `ffmpeg`-based clip concatenation driven by a **scene manifest** `<project>/manifest.json` (ordered array of `{scene_id, clip_path, audio_embedded, audio_path?, duration}`). Audio mux for clips with `audio_embedded: false`, pass-through for `audio_embedded: true`, optional crossfade, audio-track normalization across mixed-capability sets. **Failure semantics:** missing clip → fail loud with the scene_id and a re-render hint (do not silently skip); operator may pass `--skip-scene <id>` to drop a clip from the cut; `--abort-on-missing` (default) and `--continue` flags control batch behavior. Pure local; no API. This step also documents the **adapter-failure rollback contract**: a failed adapter call writes `<project>/scenes/<id>/error.json` and the orchestrator surfaces a single numbered-options block (retry · regenerate prompt · skip · abort) — no automatic retry.
- [x] **Step 8:** Add `scripts/ai-video/lib/fixtures/` with one dry-run fixture per adapter so dry-run mode produces a deterministic artifact path used by tests.
- [x] **Step 9:** Each adapter is executable, `#!/usr/bin/env bash`, `set -euo pipefail`, redaction helper sourced; passes `shellcheck`.

**Exit criteria:** Six adapter scripts + stitcher live under `scripts/ai-video/`; `shellcheck` clean; dry-run paths return fixtures without network access; contract doc matches actual implementation.

## Phase 5: Orchestration commands — operator-facing surface

- [x] **Step 1:** Create `.agent-src.uncompressed/commands/video/from-script.md` — `/video:from-script <path-to-script> [--image-provider <id>] [--video-provider <id>]`. Provider flags override the `<default-image-provider>` / `<default-video-provider>` from `agents/.ai-video.xml`; in their absence the defaults apply. Parses a script (Markdown with `## Scene N` headings, dialogue, action), drives the full pipeline: scene-expander → blueprint parser → character-consistency → image render → **operator pick (Step 1b)** → motion-choreographer → video render → stitch. Block-on-ambiguity per the standard command contract.
- [x] **Step 1b:** Implement the operator-selection checkpoint `scripts/ai-video/lib/operator-pick.sh` invoked by `/video:from-script` and `/video:scene` after image render. Renders a thumbnail contact-sheet PNG of the N best-of candidates per scene, pauses the run, and waits for the operator to write `<project>/scenes/<id>/selection.json` (`{selected: "candidate-<n>", reason?}`). Resume reads `selection.json` and feeds the locked image path into the motion step. Dry-run mode auto-selects the first candidate and writes the same `selection.json` so the smoke test stays unattended.
- [x] **Step 2:** Create `.agent-src.uncompressed/commands/video/scene.md` — `/video:scene "<idea>"`. Single-scene generation; useful for iteration without a full script.
- [x] **Step 3:** Create `.agent-src.uncompressed/commands/video/storyboard.md` — `/video:storyboard <path-to-script>`. Image-only output; produces a contact-sheet-style storyboard PNG via `ffmpeg` montage. No video calls.
- [x] **Step 4:** Create `.agent-src.uncompressed/commands/video/stitch.md` — `/video:stitch <project-slug>`. Re-stitches existing clips after operator edits, without re-rendering.
- [x] **Step 5:** Each command frontmatter declares its required personas (`personas: [hollywood-director, ai-video-technical-director]` etc.), required skills, required provider keys, and confirms dry-run / cost preview behavior on first invocation per run. Add a thin startup validator `scripts/ai-video/lib/validate-deps.sh` that resolves the declared personas + skills against `.augment/personas/` and `.augment/skills/`, fails fast with the missing-id list, and runs on every `/video:*` invocation before any network call. Scope: existence + frontmatter `id` match only — no version pinning (per `scope-control`).
- [x] **Step 6:** Add a default-deny safety gate in every command: refuses to call a network adapter unless `AIV_DRYRUN=false` AND the user has explicitly confirmed in this turn. Mirrors `non-destructive-by-default` for cost-incurring calls.

**Exit criteria:** Four `/video:*` commands exist; command linter green; dry-run is the default; cost preview surfaces estimated calls per provider before any real call.

## Phase 6: Prompt library, golden runs, end-to-end validation

- [x] **Step 1:** Curate `agents/ai-video/prompts/` with a small, vetted library distilled from the three source repos: `cinematic-blueprint.md`, `pixar-emotional.md`, `character-lock.md`, `motion-choreography.md`, `negative-constraints.md`. Each file references its upstream source for attribution.
- [x] **Step 2:** Create `agents/ai-video/examples/banana-arc/` — a three-scene reference project covering three named complexity tiers: (a) **simple** — single character, static camera, no dialogue, `audio: none` adapter; (b) **dialogue + native-audio** — same character, dialogue line, ambient layer, `audio: native` adapter; (c) **edge-duration** — same character, max-duration clip, fast camera move, motion stress. Each scene ships script, `character.json`, expected scene-blueprint YAML, and a locked reference frame under `fixtures/frames/` for the visual-regression assertion in Step 3.
- [x] **Step 3:** Add a smoke test `scripts/ai-video/test-pipeline.sh` that runs the full pipeline against `banana-arc` in dry-run mode and asserts: scenes parsed (including dialogue/ambient blocks), `character.json` descriptor tokens appear **verbatim** in every scene's image and motion prompt (exact string-match), image+motion+audio prompts produced, native-audio capable adapter receives the audio block, non-audio adapter falls back to `ffmpeg` mux, stitched MP4 path returned with audio track present. **Visual regression:** compare each rendered reference frame from `agents/ai-video/examples/banana-arc/fixtures/frames/` against the previous scene's locked frame using `ffmpeg` + `imagemagick compare -metric NCC`; assert similarity ≥ 0.95 per character. Offline / CI-friendly (all fixture frames committed; no network).
- [x] **Step 4:** Wire `test-pipeline.sh` into the project's quality pipeline (Taskfile target `task test:ai-video`). Ensure it runs offline.
- [x] **Step 5:** Run the full quality gate fresh in this session — `task ci` (or the documented subset) — and capture the output as evidence in the PR description.
- [x] **Step 6:** Update `AGENTS.md` Pointers section with a single capability bullet for the new `/video:*` cluster (no path lists per the Iron Law).
- [x] **Step 7:** Run an AI Council review pass on the finished branch using `/council` (PR variant) scoped to the three new personas and five new skills (not the whole branch). Verdicts are advisory at this stage — note them in the PR description; do not block merge unless a finding contradicts an Acceptance Criterion or an accepted finding from the planning-stage council (this file's §Council review). Run after Phase 3 mirrors are regenerated so the PR-variant council sees the final skill text.

**Exit criteria:** Smoke test passes offline in CI; `task ci` green in a fresh run; AGENTS.md updated with the new capability bullet; Council verdicts addressed; PR description carries the fresh evidence.

## Acceptance Criteria

- [x] `agents/.ai-video.xml.example` and the loader exist; real keys file is gitignored; redaction helper is sourced by every adapter
- [x] Three new specialist personas exist, pass the schema linter, and appear in the Specialists table
- [x] Five new skills exist (`video-director`, `pixar-storyteller`, `character-consistency`, `scene-expander`, `motion-choreographer`) and pass `task lint-skills`
- [x] Six adapter scripts plus `stitch.sh` live under `scripts/ai-video/`, are `shellcheck`-clean, and dry-run by default
- [x] Four `/video:*` commands exist, gate network calls behind explicit per-turn confirmation, and print a cost preview before any paid call
- [x] Golden `banana-arc` smoke test (three named tiers: simple / dialogue+native-audio / edge-duration) passes offline including the visual-regression frame check (`imagemagick compare -metric NCC` ≥ 0.95); wired into the quality pipeline
- [x] `task ci` green in a fresh run captured in the PR; AI Council pass recorded
- [x] Single branch, single PR; no scope creep beyond the items above

## Notes

- **Character consistency** is the load-bearing problem. Treat `character.json` as the source of truth across scenes; every prompt that references a character MUST inject the locked descriptors verbatim. Tested by the golden run.
- **Cost safety** is a hard floor. Adapters dry-run by default. Commands print an estimated-calls table before any live call and require explicit confirmation. This is the cost-incurring analog of `non-destructive-by-default` — codified in Phase 5 Step 6.
- **Operator-in-the-loop best-of-N** is preserved at the image-pick step: the operator can re-render or pick the best frame before motion runs. Required because image quality dominates final-video quality, and re-renders are cheaper than re-renders downstream.
- **Provider neutrality**: scene-expander output is provider-agnostic. Provider tuning lives only in `motion-choreographer` and the adapter layer. New providers can land later by adding one adapter + one entry in the tuning table — no skill rewrites.
- **Audio policy**: dialogue and ambient sound are part of the video product. Adapters with `audio: native` (e.g., Veo, Sora-class) receive the audio block and return a muxed track; `audio: none` adapters fall back to `ffmpeg` mux with operator-supplied audio. Out of scope is voice cloning of real people and pure audio-only generation (no video target).
- **AGENTS.md discipline**: the package AGENTS.md remains Thin-Root. A single pointer bullet for `/video:*` is enough; the cluster's own docs live under `agents/ai-video/README.md` and the command files themselves.
- **No version numbers, no tags, no release planning** anywhere in this roadmap (enforced by `scope-control`). When the PR is ready, the user decides on shape, base, and merge timing.

## Council review (2026-05-17)

Deep-tier council (Anthropic Claude Sonnet 4.5 + OpenAI GPT-4o, 3 rounds, `--input-mode roadmap`). Convergence is strong on sequencing and contract gaps; one structural disagreement (single-PR vs. milestone split) was resolved against the milestone split, citing the roadmap's iron constraint.

### Convergence findings

1. **Circular dependency Phase 3 → Phase 4** — Phase 3 Step 5 (`motion-choreographer`) tunes per provider before Phase 4 Step 1 defines the adapter contract · trace: §sonnet-r3 Blocking #1 · §gpt-4o Agreement #1
2. **Missing operator selection step** — pipeline diagram and Notes both reference "operator-in-the-loop best-of-N" but no phase implements the checkpoint, selection-state file, or resume contract · trace: §sonnet-r3 Blocking #2 · §gpt-4o Agreement #2
3. **No rollback path for adapter failures** — a failed scene render mid-run leaves no documented contract for skip / regenerate / abort · trace: §sonnet-r3 Blocking #3
4. **Stitcher audio-format ambiguity** — Phase 4 Step 1 mentions both `audio_path` and "single muxed `video_path`" but lacks an explicit `audio_embedded` flag the stitcher can branch on · trace: §sonnet-r3 Blocking #4 · §gpt-4o Coupling Issues
5. **Dialogue / ambient schema gap** — `scene-expander` (Phase 3 Step 4) emits prose blocks; adapter contract (Phase 4 Step 1) expects structured JSON · trace: §sonnet-r3 Blocking #5 · §gpt-4o Agreement #4
6. **Multi-provider selection logic missing** — XML schema has per-provider blocks but no `default-image-provider` / `default-video-provider`, and commands have no convention for cross-provider runs · trace: §sonnet-r3 New #1 · §gpt-4o New #1
7. **Character-lock cross-scene validation missing** — Phase 6 Step 3 asserts "stable across scenes" only structurally; no visual regression assertion (pixel similarity via `ffmpeg`+`imagemagick`) on reference frames · trace: §sonnet-r3 New #2 · §gpt-4o New #2
8. **Stitch.sh clip-ordering contract missing** — Phase 4 Step 7 lacks input manifest format and missing-clip behavior (skip vs. fail vs. operator override) · trace: §sonnet-r3 New #3 · §gpt-4o New #3
9. **Command dependency validation missing** — Phase 5 Step 5 declares dependencies in frontmatter but no startup validator fails fast when a required persona / skill is missing · trace: §sonnet-r3 New #4 · §gpt-4o New #4
10. **Golden run lacks adversarial cases** — `banana-arc` is undifferentiated; needs explicit coverage for simple / dialogue+native-audio / edge-duration cases · trace: §sonnet-r3 New #5 · §gpt-4o New #5
11. **Council review timing ambiguity (ship-and-fix)** — Phase 6 Step 7 doesn't bound scope or define verdict-resolution flow · trace: §sonnet-r3 Ship-and-Fix #1 · §gpt-4o New #6

### Divergences (no consensus)

- **Single-PR vs. milestone split** — Reviewer B (prior round) recommended splitting into milestone PRs; Sonnet R3 and GPT-4o final pass both reject this, citing the roadmap's explicit single-PR iron constraint and the dead-code risk of partial states. Host: the iron constraint stands.
- **Dry-run-only CI vs. real-API smoke** — Reviewer B argued dry-run alone is insufficient; Sonnet R3 disagreed (cost safety + post-merge manual validation is the right balance); GPT-4o silent. Host: dry-run CI is correct, real-API validation is post-merge operator work.

### Predecessor council trace

`agents/council-responses/ai-video-pipeline-roadmap.json` (this run; actual spend $0.13 / estimated $0.44). <!-- council-ref-allowed: ADR decision trace for roadmap findings F1–F11 -->


### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Circular dependency P3→P4 | `accept` | matches `agents/roadmaps/ai-video-pipeline.md` Phase 3 Step 5 (line 77) and Phase 4 Step 1 (line 84) — skill references contract that does not yet exist |
| 2 | Missing operator selection step | `accept` | pipeline diagram (line 31) and Notes (line 134) cite "operator-in-the-loop" but no Phase 5 step implements the checkpoint |
| 3 | No rollback path for adapter failures | `accept-with-modification` | fold into the Phase 4 Step 7 stitch contract (Finding 8) rather than a standalone step — one design surface, not two |
| 4 | Stitcher audio-format ambiguity | `accept-with-modification` | Phase 4 Step 1 already differentiates muxed vs. separate; tighten to require an explicit `audio_embedded` boolean instead of inferring from path shape |
| 5 | Dialogue / ambient schema gap | `accept` | Phase 3 Step 4 (prose) and Phase 4 Step 1 (JSON `audio.dialogue/ambient`) are incompatible without an explicit blueprint-to-JSON parser |
| 6 | Multi-provider selection logic missing | `accept` | Phase 1 Step 1 schema is per-provider-only; no orchestration-level defaults or per-command override flags |
| 7 | Character-lock visual regression | `accept` | Phase 6 Step 3 string-match is insufficient for "load-bearing" claim in Notes (line 132); pixel-similarity assertion required |
| 8 | Stitch.sh clip-ordering contract | `accept` | Phase 4 Step 7 (line 90) leaves input format and missing-clip behavior undefined |
| 9 | Command dependency validation | `accept-with-modification` | narrow to a thin startup checker (file-exists + frontmatter-id match); reject full version-pinning per `scope-control` (no version pins in roadmaps) |
| 10 | Golden run adversarial cases | `accept` | Phase 6 Step 2 (line 110) and Step 3 (line 111) under-specify scenes; three named complexity tiers required |
| 11 | Council review timing ambiguity | `accept-with-modification` | tighten Phase 6 Step 7 wording (scope = personas + skills; verdicts advisory) — not a structural change |
| — | Milestone-split disagreement | `reject` | contradicts the iron constraint stated in §Why (line 21) and Acceptance Criteria (line 128) |
| — | Dry-run CI disagreement | `reject` | contradicts the cost-safety floor codified in §Bounds (line 46) and Phase 5 Step 6 (line 103) |

