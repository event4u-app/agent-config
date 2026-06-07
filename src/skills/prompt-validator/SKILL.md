---
model_tier: inherit
name: prompt-validator
description: "Pre-spend contradiction gate for AI-video runs: checks every prompt in the batch, blocks on style / character / physics mismatch. Triggers 'validate the prompts', 'check the storyboard'."
personas:
  - ai-video-technical-director
domain: product
workspaces:
  - small-business
packs:
  - ai-video
lifecycle: experimental
trust:
  level: experimental
install:
  default: false
  removable: true
---

# prompt-validator

> Deterministic pre-spend gate: collect **every** prompt a video run is
> about to send (all scenes, all blocks), cross-check them against each
> other and against the run's locked facts (character lock, vocal map,
> model capabilities), and **block with a specific error** on
> contradiction. Skills are deterministic — the failure mode of a
> multi-scene batch is not drift, it is *contradiction*: two prompts
> that cannot both be true of the same video (AI-council convergence,
> 2026-06-06). One blocked batch costs a re-edit; one rendered
> contradiction costs the whole spend.

## When to use

- Immediately **before** the unified storyboard/cost preview gate in
  [`/video:from-song`](../../commands/video/from-song.md)
  Step 8 / [`/video:from-script`](../../commands/video/from-script.md) —
  after every scene's eight-block prompt exists, before anything is
  shown for approval or sent live.
- After an operator hand-edits scene prompts (`/video:scene` re-runs) —
  re-validate the batch, not just the edited scene.

Do NOT use when:

- Only a single scene exists (nothing to contradict) — the per-scene
  checks in `video-director` already cover internal consistency.
- The run is pure preview with no approval intent — validate when the
  batch is about to be gated, not on every draft keystroke.

## Inputs

- `<project>/script.md` — every `## Scene N` (duration, mood, action,
  camera, dialogue).
- Every rendered scene prompt (the eight-block image/video prompts from
  `video-director` / blueprint JSON), in scene order.
- `<project>/character.json` — when present, the locked identity
  (subject, palette, wardrobe, prop, seed).
- `<project>/vocal-map.json` — when present, the signed-off
  line → singer assignments.
- The chosen model's capability entry (`capability --model <id>`).

## Procedure

### Step 1: Collect the full prompt set

Read every scene's prompt blocks into one table:
`scene → {style, subject, environment, action, camera, lens, lighting,
mood, duration, aspect, dialogue/singer}`. A scene whose prompt is
missing or unparseable → **block**: `scene N: prompt missing/unreadable`
— an incomplete batch is already a contradiction with the script.

### Step 2: Style consistency

The `style` block must agree across all scenes — one look per video
unless the script *names* an intentional break (e.g. "dream sequence").

- Conflicting render families (`photorealistic` vs `cel-shaded` /
  `claymation` / `watercolor`) with no scripted break →
  `style mismatch: scene 3 'photorealistic' vs scene 7 'cel-shaded'`.
- Conflicting era/grade tokens (`1970s film grain` vs `clean digital
  HDR`) → same error shape, name both scenes and both tokens.

### Step 3: Character consistency (character mode)

With `character.json` present, every scene naming the subject must
match the lock:

- Wardrobe / palette / prop drift (`red coat` locked, scene says
  `blue jacket`) → `character mismatch: scene 5 'blue jacket' vs lock
  'red coat'`.
- A scene inventing a second recurring subject the script never cast →
  flag it — uncast identities break continuity AND the likeness gate.
- **Lip-sync ownership:** a scene with a `dialogue:` line must name the
  vocal map's singer for that line — wrong mouth on wrong words is the
  render-money-burning failure (`media-sync-ground-truth`). A `"?"`
  singer with a lip-sync scene → block until resolved.

### Step 4: Physics + continuity

- Day/night or weather flips **inside one contiguous song section**
  with no scripted transition → `continuity: scene 4 'noon sun' →
  scene 5 'starry night' within the same chorus`.
- Impossible camera/action pairs (`locked-off tripod` + `whip pan`),
  (`underwater` + `desert dust`) → name scene + the two tokens.
- Duration / aspect vs. the model envelope: any scene outside
  `[min_duration, max_duration]` or with an aspect the model does not
  list → block with the violated bound (defense-in-depth after
  `song-to-script` Step 1 — hand-edited prompts re-open this hole).

### Step 5: Verdict

- **Zero findings** → emit `prompt-validator: N scenes, no
  contradictions` and hand the batch to the preview gate.
- **Any finding** → **block the gate**. Report every finding (not just
  the first), each as `class: scene(s) + conflicting values + fix
  hint`. The operator (or the calling command) fixes the prompts and
  re-runs the validator — never "approve anyway" past a contradiction;
  an intentional break gets *scripted* (named in `script.md`), which
  legitimizes it on the next pass.

## Output format

```
prompt-validator: 12 scenes checked
✅ style: one look (neo-noir, consistent)
❌ character: scene 5 'blue jacket' vs character.json 'red coat' — align scene 5 or update the lock
❌ lip-sync: scene 9 dialogue assigned to 'Freya' but vocal-map line 24.5-27.8 is singer '?' — resolve the singer first
verdict: BLOCKED (2 contradictions) — fix and re-run
```

## Gotchas

- **An intentional style break is scripted, not waved through.** The
  validator only accepts a break that `script.md` names; "the operator
  said it's fine in chat" does not survive to the next run.
- **Re-validate after every hand-edit.** A single edited scene can
  contradict five untouched ones; the batch is the unit, not the scene.
- **`verified: false` capability entries still gate.** Blocking on a
  documented-best-effort bound beats rendering past a real one; the
  report names the unverified flag so the operator can override by
  editing the manifest, never by skipping the check.

## Do NOT

- Do NOT auto-fix prompts — report and block; the fix is the
  operator's (or calling skill's) edit, visible in the diff.
- Do NOT validate only changed scenes — always the full batch.
- Do NOT soften a contradiction into a warning — contradictions block;
  only consistency passes.
- Do NOT duplicate `video-director`'s per-scene craft checks — this
  skill owns *cross-scene* contradiction only.

## See also

- [`/video:from-song`](../../commands/video/from-song.md) —
  invokes this before the unified storyboard/cost preview gate (Step 8).
- [`video-director`](../video-director/SKILL.md) — produces the prompts
  this skill cross-checks.
- [`character-consistency`](../character-consistency/SKILL.md) — the
  lock this skill enforces against.
- [`song-to-script`](../song-to-script/SKILL.md) — upstream timing +
  vocal-map source.
