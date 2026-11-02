---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: 6233ceedef
estate_growth_exempt: "Operator asked for this roadmap to be made active and processed in the same invocation (2026-11-02, /analyze:inbox … then /roadmap:process-full, worktree, PR, merge). It closes and archives in the same PR, so the active count at merge is unchanged. No new skill, rule or command."
estate_offset_exempt: "grep -rlF -e __timelines -e 'seek form' -e seeked -e 'Negative locks' -e 'NEGATIVE LOCKS' -e council_cli.py -e 'five shipped' over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs (whole roadmap tree) — no roadmap owns the film witness's seek forms, the code-film tells, the motion-prompt grammar or these two doc drifts. Every other finding of the round lands on its existing owner (Phase 4)."
relates:
  - slug: later/road-to-breadth-with-depth
    relation: disjoint
    note: "Owns the video domain (5.3, 5.3a, F1–F6). Editing operators, voice-over, sync gates, adapter inputs and ingest arrive there as an arrival block (4.1); nothing here touches those steps."
  - slug: stubs/road-to-a-limit-the-host-actually-signals
    relation: disjoint
    note: "Owns the Notification alias. The attention-signal plan arrives there (4.2)."
  - slug: later/road-to-mod-surfaces-that-read-what-ac-knows
    relation: disjoint
    note: "Owns mod surfaces. Visible compact and cache hit-rate arrive there (4.3)."
---

# Road to a timeline the witness can seek

> **Source:** `agents/tmp.old/inbox-2026-11-k/` — six topic folders on video,
> voice and creator production (one owner prompt set with a motion-video skill,
> a raw-take editing workspace, an interactive-training skill and a video-model
> prompt library; five folders of agent plans with their transcripts).
> Re-verified at `tree_pin` on 2026-11-02.

## Goal

The code-rendered film track that shipped today reaches the pages people
actually write. A page built on a seekable timeline registry is recognised and
captured instead of reported `unassessed`; a page that embeds footage shows the
right footage frame at every `t`; the craft corpus names four generated-looking
tells it did not name; the motion-prompt grammar carries negative locks, timed
segments and a dialogue-language rule. Two doc drifts close.

Everything larger — editing operators, voice-over, sync gates, adapter inputs,
attention signals — lands on the roadmap that already owns it (Phase 4).

Owner constraint (transcripts): *include, do not duplicate*; *research first*;
paid, external and irreversible steps stay under explicit control. Nothing here
calls a paid provider, adds a hook concern or flips a default.

## Context — re-verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| T1 | `renderers.csv` routes a timeline framework with "detect its page form; capture through the film profile" | **never-true** | `SeekForm` is `seek \| render \| waapi \| none` (`src/cli/commands/uiRenderFilm.ts:34`); `detectForm` falls through to `none` (`:220-226`) — a GSAP-style registry creates no Web Animations |
| T2 | Embedded `<video>` frames follow `t` | still-true defect | `seekPage` seeks SVG and `document.getAnimations()` only (`uiRenderFilm.ts:237-256`) |
| T3 | No tell for slideshow, symbol-for-thing, reused illustration, linear easing | still-true | `src/skills/code-film/data/tells.csv` (12 rows) |
| T4 | Motion prompt has no negative-lock block and no dialogue-language rule | still-true | `src/skills/motion-choreographer/SKILL.md` Step 3–4 |
| T5 | `config-presets.md` cites `council_cli.py` | still-true | `docs/contracts/config-presets.md:70,84`; the file is `src/scripts/council_cli.ts` |
| T6 | `voice-cloning.md` says "five shipped video adapters" | stale | `src/scripts/ai-video/adapters/` holds ten adapters |
| T7 | `supply-chain-intake` names MCP servers but not host plugins/mods | still-true | `src/skills/supply-chain-intake/SKILL.md:21,76` |

## Phase 1 — Film pages the witness can drive

- [x] **1.1** `timelines` seek form: a page exposing `window.__timelines`
  (an object of paused timelines with `seek`, `time` or `totalTime`) is
  detected after `__seek`/`render` and before Web Animations, every timeline is
  paused and set to `t`. `film-page.md` gains the row; `renderers.csv`'s route
  becomes true.
  verify: `tests/cli/ui_render_film_capture.test.ts` — the registry page reports `form` = `timelines`, 4 distinct frames and `deterministic: true`; an unseekable registry reports `none`.
- [x] **1.2** Embedded footage: in the `waapi` and `timelines` forms every
  `<video>` is paused and set to `t − data-start` (clamped to its duration),
  and the capture awaits `seeked`. `__seek`/`render` pages keep owning their
  footage. The contract names the all-intra encode advice.
  verify: the footage test in the same suite reports 5 distinct frames (t ≤ 0.5 hold the first clip frame) and `deterministic: true`.

## Phase 2 — Craft corpus

- [x] **2.1** Four tells in `tells.csv`: image-plus-caption slideshow, symbol
  in place of the thing, reused illustration, linear easing.
  verify: `ground.mjs search --domain tell "slideshow caption"` returns the new row.
- [x] **2.2** Recipe "Vertical explainer short" in `recipes.csv` (split
  graphic/speaker, few-word captions with one highlighted term, hook within
  1 s, numbered spine, end on the speaker), written fresh — no gallery text.
  verify: `ground.mjs search "vertical explainer short"` returns the row.
- [x] **2.3** `motion-choreographer`: a `NEGATIVE LOCKS` block, an optional
  timed-segment block (`0–3 s: …`), and the rule that the prompt is English
  while spoken lines stay verbatim in their own language with a language tag.
  verify: the skill lint passes and the three rules are findable in Steps 3–4.

## Phase 3 — Drift

- [x] **3.1** `config-presets.md:70,84` cite the TS council entry point.
  verify: `grep -c council_cli.py docs/contracts/config-presets.md` → 0.
- [x] **3.2** `voice-cloning.md` names the adapter directory instead of a count.
  verify: `grep -c "five shipped" agents/settings/policies/media/voice-cloning.md` → 0.
- [x] **3.3** `supply-chain-intake` gains a host plugin/mod intake section:
  unsandboxed, runs with the user's rights, source read before enable.
  verify: the skill lint passes; the section names plugin and mod.

## Phase 4 — Arrivals on the owners

- [x] **4.1** Arrival block on `later/road-to-breadth-with-depth`: talking-head
  operators (last clean take, slip detection, padding by cut type, padding in
  the EDL), word-anchor sync grid, voice-over sub-steps (shortlist with free
  previews, one take, bracket stripping, tempo check, paid-TTS confirmation),
  caption contrast and layout-aware placement, SFX category allowlist, still
  and A/V-offset checks for provider clips, ffmpeg capability gate, adapter
  multi-reference / edit-mode inputs, paid-second planner, cost per accepted
  second, licence field per manifest entry, media ingest gate, retry cap,
  media retention, named format presets.
  verify: the block exists under the roadmap's `Source:` header with an `Arrivals:` line.
- [x] **4.2** Arrival on `stubs/road-to-a-limit-the-host-actually-signals`:
  attention signal (wait classes, terminal sequence sink, user-command sink
  over stdin with `stdio: ['pipe','ignore','ignore']`), host-event census.
  verify: the stub carries the arrival line and the stdin correction.
- [x] **4.3** Arrival on `later/road-to-mod-surfaces-that-read-what-ac-knows`:
  visible compact summary with before/after tokens; cache hit-rate segment.
  verify: `grep -c inbox-2026-11-k` on that roadmap returns 2 (steps 1.6 and 1.7).
- [x] **4.4** Stub `stubs/road-to-adapter-traces-before-the-window`: the seven
  `stable` adapter traces are dated 2026-06-10; the 180-day window closes on
  2026-12-07 and `lint_adapter_tier` then fails CI. Owner choice: re-capture
  (paid) or demote.
  verify: the stub names the date, the lint line and both options.

## Decisions

| # | Decision | Reason | Revisit-if |
|---|---|---|---|
| E1 | `/schulung` (interactive training) is an owner decision, not a skill | education is not a domain in breadth 0.4; smallest form would be a lesson mode on `html-deck` | the owner names education as a domain |
| E2 | Speaker cut-out layouts parked | needs a segmentation model — breadth kill K1 | a local segmentation rung exists |
| E3 | Preferences file inside the skill folder declined | writes into a read-only projection; provider choice already lives in `agents/.ai-video.xml` | — |
| E4 | Symlinking third-party npm skills into `.claude/skills` declined | bypasses `supply-chain-intake` | — |
| E5 | `creator.yml` `default_skill_priority` left | no reader consumes the field (only the schema names it) | a reader lands |

## Risk Register

| Risk | Mitigation |
|---|---|
| A timeline object exposes neither `seek` nor `time` | detection requires one of the three methods; otherwise the form is not claimed |
| `seeked` never fires for a clip at its end | clamp to `duration − 1/fps` and resolve on `seeked` or when `currentTime` already equals the target |
| Footage seeking changes `__seek` pages | only the `waapi` and `timelines` forms seek footage |
