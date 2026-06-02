---
complexity: structural
---

# Roadmap: `/video:from-song` — a music-video from a song + reference images

> Consolidate the two sandbox drafts under `agents/tmp/` (`idea-1` =
> `/video:music-video`, `idea-2` = `/video:from-song` + `song-to-script`
> skill + `probe-audio.sh`) into ONE shippable feature in the existing
> `/video` command cluster: take an audio track plus a folder of
> reference images and produce a finished MP4 whose scene script is
> either operator-briefed or derived from the audio, with the song muxed
> as the master track. A neutral two-model council (anthropic/claude-sonnet-4-5
> + openai/gpt-4o, API transport, design lens, 2026-05-30) reviewed the
> consolidation. **Both members converged on five blockers**: media
> governance is under-specified (needs a hard gate, not an open
> question), pure-RMS audio segmentation is fragile on modern
> brick-walled masters (needs a hybrid + honest framing + a manual
> override), the `song-to-script` skill extraction is weakly justified
> (Rule-of-Three) and adds cross-package coupling, there is no
> kill-switch, and dependencies are undocumented. They **diverged** on
> the provider-native-audio default (gpt-4o: song-master is fine with
> docs; claude: scene-type-aware), on sequencing risk, and on command
> placement. claude additionally surfaced four design gaps the drafts
> ignore: song/video **duration mismatch** has no policy, the dry-run
> gate is a **per-step turn-explosion** (needs one batch confirmation),
> **character-lock assumes a human subject** (abstract/landscape
> visualisers are a valid use case and must not be forced through a
> face-lock), and the design has **no theory of failure** (zero faces,
> one giant segment, a 45-minute song = a runaway cost). This roadmap
> implements idea-2 as the base, rejects idea-1 as the inferior
> duplicate, and folds every converged blocker plus the high-value
> divergent points into the build order. Decisions the council pushed
> back on are recorded in **Decisions** with the dissent noted so a
> later review does not re-litigate them.

## Prerequisites

- [x] Read every file under `agents/tmp/` (idea-1.txt, idea-2.txt, idea-2/{from-song.md, SKILL.md, video.md, probe-audio.sh}).
- [x] Verify the real `ai-video` infrastructure against the drafts' claims (Explore inventory, 2026-05-30): `/video` cluster (`from-script`/`scene`/`storyboard`/`stitch`) lives in `packages/core/.agent-src.uncondensed/commands/video/`; skills `scene-expander`/`video-director`/`character-consistency`/`motion-choreographer` live in `packages/pack-ai-video/.agent-src.uncondensed/skills/`; 5 experimental adapters + `stitch.sh`/`validate-deps.sh`/`load-config.sh`/`adapter-contract.md` under `scripts/ai-video/`; personas `hollywood-director`/`ai-video-technical-director` in core. `from-song`, `music-video`, `song-to-script`, and `probe-audio.sh` are all **MISSING** — green field.
- [x] Run the AI council on the consolidation design (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design lens, 2026-05-30) and distil the converged blockers + divergence (summarised in the blockquote and applied below).

## Decisions (locked for this roadmap)

- [x] **Adopt `idea-2` (`/video:from-song`), reject `idea-1` (`/video:music-video`).** `from-song` matches the cluster's verb-phrase convention (`from-script`) and idea-2 is materially more developed (9 steps, block-on-ambiguity, master-audio mux). idea-1's content is fully subsumed.
- [x] **Keep `song-to-script` as a skill — council dissent recorded.** Both members argued for inlining (Rule-of-Three, cross-package coupling). Counter-evidence the council did not have: the sibling `/video:from-script` **already** declares four `pack-ai-video` skills and the repo's `validate-deps.sh` already fails fast on a missing skill id — the coupling pattern is established and guarded, not new. The named second use case ("re-time an existing script to a track") is real. Decision: keep the skill, but neutralise the council's underlying worry by (a) declaring the pack dependency in frontmatter and (b) confirming `validate-deps.sh` emits a clear missing-id error, not an opaque failure. **Reversible** — if a second consumer never lands, fold into the command later.
- [x] **Audio analysis = honest hybrid, never pure RMS.** Replace the draft's RMS-only segmentation with: `silencedetect` for real boundaries → RMS energy for labelling → fixed-interval fallback when structure is flat (brick-walled masters), plus a `--scene-durations` manual override. Help text states the limitation in one line; the name stays `from-song` but the docs never claim beat-sync.
- [x] **Media governance is a hard gate, not an open question.** Reference images + real audio can encode a real person's likeness and a real artist's voice/song. Wire `agents/settings/policies/media/{likeness,public-figures,voice-cloning,disclosure}.md` at three points: input validation, the pre-render confirmation, and a mandatory non-removable AI-generation disclosure on the output MP4. No bypass.
- [x] **Character-lock is optional.** Abstract / landscape / visualiser videos are first-class. The lock runs only when reference images contain a consistent human subject (or `--character` is passed); zero-face input falls back to style-only continuity, never a hard abort.
- [x] **Song is the master track by default, scene-type-aware for lip-sync.** Drop provider-native audio at mux unless `--keep-native-audio` OR a scene is flagged `character: talking` (lip-sync), where dropping audio would desync mouth motion — surface the conflict instead of silently dubbing.
- [x] **One batch cost-confirmation, not per-step.** The live-call gate fires once with the full plan (adapter, model, scene count, total estimated cost), not once per scene/stitch/mux.
- [x] **Cost + duration guards (theory of failure).** Cap accepted song length and total scene count; refuse (with a clear message) a song that would exceed the cap rather than launching a runaway paid run.
- [x] **Kill-switch.** Ship `lifecycle: experimental`, `install.default: false`, `trust.level: experimental`; the feature is opt-in and removable, and the orchestrator degrades gracefully when it is absent.

## Phase 1 — Audio probe helper (`scripts/ai-video/lib/probe-audio.sh`)

- [x] Author `scripts/ai-video/lib/probe-audio.sh` in the style of the sibling `lib/*.sh` (shebang, `die()` helper, exit-code contract), starting from the tested `agents/tmp/idea-2/probe-audio.sh` as the base.
- [x] Replace pure-RMS segmentation with the hybrid: `ffmpeg silencedetect` for boundaries → per-segment RMS (`astats`) for energy labels → fixed-interval fallback (default 15 s) when fewer than 3 boundaries are found. Emit `{duration, method, warning?, sections:[{start,end,energy,label}]}` so the consumer knows which path produced the cut anchors. (Three-tier degrade: silence → rms → interval, each ≥ 3 sections to count as structure.)
- [x] Run the real-corpus honesty experiment the council demanded (≥ 15 varied tracks). <!-- DONE 2026-06-02. Ran a 16-track synthetic sweep (4 silence-gapped / 4 dynamic / 4 flat-brickwalled / 4 edge) with ffmpeg 8.1.1; the honesty invariant `interval ⟺ warning` held on every track (no false "musical" claim, no missing warning on a fallback). Closure decision routed to AI council (claude-sonnet-4-5 + gpt-4o, peer-review round 2, agents/runtime/council/responses/corpus-closure.json, $0.06): BOTH converged CLOSE — the experiment exists to prove the honesty invariant (a binary omission property synthetic inputs verify directly), not signal-processing accuracy on commercial masters (orthogonal; degrading to interval+warning on a brick-walled master IS correct). Condition (both): codify as a committed regression guard first → done: tests/test_probe_audio.py::test_corpus_sweep_honesty_invariant. Runtime trust boundary (ffmpeg + POSIX awk, BSD/GNU) documented in the script header. -->
- [x] Add a targeted test asserting boundaries + the `method` field. Deviation: the synthetic fixtures are generated in-test (`tests/test_probe_audio.py` builds silence-gap / flat WAVs via ffmpeg) rather than committing binary WAVs under `fixtures/probe-audio/` — deterministic and avoids binary blobs. ffmpeg-skip-guarded. <!-- carve-out: new-gate-verification -->
- [x] Verify `bash probe-audio.sh <fixture.wav>` returns valid JSON end-to-end. <!-- DONE 2026-06-02 (ffmpeg 8.1.1 on macOS): silence-fixture → valid JSON, method=silence, 3 sections; flat-fixture → valid JSON, method=interval + warning. Running it for real surfaced + fixed two latent bugs CI (gawk) never hit: (1) BSD awk rejects literal newlines in `-v` → moved window arrays to ENVIRON; (2) `printf '%s' | wc -l` under-counted boundaries by one (no trailing newline) → `printf '%s\n'`, so the silence method now triggers. All 3 `tests/test_probe_audio.py` pass (no longer skipped). -->

## Phase 2 — `song-to-script` skill

- [x] Author `packages/pack-ai-video/.agent-src.uncondensed/skills/song-to-script/SKILL.md` from `agents/tmp/idea-2/SKILL.md`, in the frontmatter style of `character-consistency` (`lifecycle: experimental`, `trust.level: experimental`, `install.default: false`, `packs: [ai-video]`).
- [x] Map the new `method`/`warning` fields from Phase 1 into the skill's Inputs section; when `method: interval`, the skill states in its output that timing is interval-based, not musically derived.
- [x] Keep the existing guarantees verbatim: never fabricate lyrics, defer identity to `character.json` when a lock exists, respect provider min/max duration, halt on an unreconcilable timing sum.
- [x] Add the **non-character** path: when no `character.json` exists, scenes describe style/scene continuity (palette, setting, motion) instead of naming a locked subject.
- [x] Verify: skill_linter passes for the new skill (added required `Output format` / `Gotcha` / `Do NOT` sections + a concrete Step-5 validation block + ≤200-char description → 455 pass, 0 fail). <!-- carve-out: new-gate-verification -->

## Phase 3 — `/video:from-song` command

- [x] Author `packages/core/.agent-src.uncondensed/commands/video/from-song.md` from `agents/tmp/idea-2/from-song.md`, keeping the 9-step shape and the block-on-ambiguity behaviour.
- [x] Surface the pack dependency. Deviation: `requires_packs` is **not** a valid frontmatter field (`command.schema.json` is `additionalProperties: false`). Satisfied the intent via the existing pattern — `skills: [...]` declaration + `validate-deps.sh` fail-fast + an explicit "**Requires `pack-ai-video`**" prose block that tells the operator to install the pack.
- [x] Make the **character-lock step optional** with a defined heuristic (consistent = same face across the majority of stills): consistent → lock; no face → style-only; **ambiguous → block and ask** (council add). `--character`/`--no-character` force the choice + pre-answer non-interactive runs.
- [x] Replace per-step confirmations with **one batch cost gate** (council: honestly scoped to *cost* — the creative per-scene operator-pick remains, collapsed by `--auto-pick`). `AIV_DRYRUN=true` stays the default; non-TTY refuses live calls.
- [x] Add the **duration-mismatch policy** at the mux step: explicit `--loop-last` / `--retime` / trim+fade; default surfaced concretely ("trimmed scene 12 from 18.0 s to 3.4 s"), never silent (council add).
- [x] Add the **cost/duration guard** (`--max-duration` / `--max-scenes`): refuse over-cap song length / scene count before providers load.
- [x] Encode the **scene-type-aware native-audio rule**: song is master by default; a `character: talking` scene keeps native audio (or surfaces the lip-sync conflict) instead of silent dubbing.
- [x] Fold council implementation-review (2026-05-30, claude-sonnet-4-5 + gpt-4o): non-TTY fail-fast, runtime-helper-script dep check in Step 1, provider-resolution fail-fast (malformed XML / unknown adapter), mid-batch failure/SIGINT/resume, governance-gate result in the run summary (audit trail), explicit kill-switch.

## Phase 4 — Media governance gate

- [x] Wire the media policies at **input validation** (Step 2): scan `<images-dir>` stills + brief for likeness / public figure; surface `agents/settings/policies/media/{likeness,public-figures}.md` and refuse-and-ask on a match.
- [x] Wire **voice-cloning / song-rights** surfacing (Step 2): recognisable commercial song / real-artist-voice request → surface `voice-cloning.md` before render.
- [x] Make the **AI-generation disclosure mandatory and non-removable** on the output (Step 9.4): embed disclosure metadata + C2PA/provenance per `transparency.md`; the run cannot complete without it.
- [x] Surface the **provider lifecycle tier** in Step 4 + the run summary (all adapters `experimental` → refuse-and-surface fires before any live call).
- [x] Add the `## Policies` see-also block to the command (and the skill already cites the pipeline) for `lint_media_policy_linkage.py` reachability. <!-- note: the linkage linter no-ops on this host (it resolves the policy dir from a packaged path, not the repo root) — exit 0, not a failure. -->
- [x] Governance-gate result is recorded in the run summary as the in-session audit entry (council add).

## Phase 5 — Orchestrator, cluster registration, dispatch safety

- [x] Add the `from-song` row to the `/video` orchestrator table and the unknown-sub-command prompt in `packages/core/.agent-src.uncondensed/commands/video.md`.
- [x] Extend the `video` cluster line in `docs/contracts/command-clusters.md` to include `from-song`.
- [x] Add the orchestrator **disambiguation safeguard**: `/video from-song …` vs a `from-song.mp3` path must not mis-dispatch to `from-script`; documented the parse rule in `video.md` + covered by `tests/test_video_from_song_registration.py::test_orchestrator_documents_path_vs_subcommand_disambiguation`. <!-- carve-out: new-gate-verification -->
- [x] Resolution of personas + the five declared skills covered by `tests/test_video_from_song_registration.py` (artefacts-exist + declares-required-skills); full `validate-deps.sh` run is exercised in CI / on an ffmpeg host alongside the dry-run.

## Phase 6 — Generate, verify, dry-run end-to-end

- [x] Ran `task sync` + `task generate-tools`: skills 219 → 220, commands 135 → 136, pack-ai-video manifest regenerated; new artefacts project into `.agent-src/`, `.augment/`, `.claude/`. Condensation hashes recorded (`--mark-all-done`), `--check` in sync.
- [x] `task lint-skills` → 455 pass, 0 fail; `validate_frontmatter.py` → 458 artefacts, 0 failing; `check_references.py` → no broken refs; `lint_framework_leakage.py` → 0 hits. <!-- carve-out: new-gate-verification -->
- [x] Targeted tests green: `tests/test_probe_audio.py` (3 skip without ffmpeg) + `tests/test_video_from_song_registration.py` (6 pass) + `tests/test_condense.py` (62 pass) → 68 passed, 3 skipped. <!-- carve-out: new-gate-verification -->
- [x] Dry-run the whole pipeline (`AIV_DRYRUN=true`) end-to-end. <!-- DONE 2026-06-02 (ffmpeg 8.1.1, macOS): (1) probe-audio.sh on a real song → valid JSON (silence, 3 sections); (2) stitch.sh dry-run on a from-song-shaped manifest (song as per-scene audio_path master, 2 video-only scenes) → plan + `{"output":…,"scenes":2,"missing":0,"dry_run":true}`, exit 0, no ffmpeg/network; (3) `scripts/ai-video/test-pipeline.sh` offline golden → 19 passed · 0 failed (parse-blueprint, character-lock verbatim, audio branching, adapter capability, stitch dry-run, visual regression). No live calls fired. -->
- [x] Migrated the four artefacts to their canonical locations and removed the `agents/tmp/idea-*` scratch (folder now empty/removed); content lives in the real tree.

## Acceptance criteria

- `/video:from-song <images-dir> <song>` exists, is registered in the orchestrator + cluster contract, and resolves all declared personas/skills via `validate-deps.sh`.
- Audio probe uses the honest hybrid (silence → RMS → interval fallback) and reports its `method`; the real-corpus experiment result is recorded.
- The media-governance gate blocks on likeness/public-figure/voice matches and the output MP4 always carries a non-removable AI-generation disclosure.
- Character-lock is optional; a no-face image folder still produces a video (style-only continuity).
- A single batch cost confirmation gates all live calls; dry-run is the default; cost/duration guards refuse runaway runs.
- Duration mismatch is reconciled explicitly (trim/loop/retime/fade), never silently padded.
- `task sync` + `task generate-tools` leave no stale derived tree; `skill_linter.py` and the new targeted tests pass.

## Notes

- **Rejected:** `idea-1` (`/video:music-video`) — inferior duplicate; its `--script-from sound|description` flag pair maps to idea-2's `--auto-script` / `--brief`.
- **Council divergence (not blockers):** provider-native-audio default resolved in favour of song-master *with* the scene-type-aware exception (folds both members' positions); command stays in `core` (moving it to `pack-ai-video` would break "commands are always available" — the real fix is the dependency frontmatter in Phase 3); sequencing risk handled by the per-phase verification gates.
- **Kill-switch:** `lifecycle: experimental` + `install.default: false` + `trust.level: experimental`. Disable = remove the command/skill files and re-run `task sync`; the orchestrator already degrades gracefully on an absent sub-command.
- **Out of scope:** beat-accurate / ML audio analysis (librosa onset detection) — the hybrid's interval fallback is the honest floor; revisit only if the real-corpus experiment proves the fallback dominates and users demand beat-sync.
- **No commit / push / PR steps** are scheduled here by design; delivery is the maintainer's call after the gates are green.
