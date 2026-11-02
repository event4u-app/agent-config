---
model_tier: inherit
name: code-film
description: "Build a short motion film from code — launch clip, kinetic type, animated chart, explainer — every frame computed from time, captured, encoded and checked."
personas:
  - design-director
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
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# code-film

> A motion film whose every frame is a pure function of its timestamp: a page
> exposes `window.__seek(t)`, `ui:render --profile film` seeks it to each frame,
> captures, proves the sequence deterministic, checks it against the
> photosensitivity floor and its declared format, and encodes it with ffmpeg.
> No paid video provider, no live playback. The values for film motion live in
> [`references/film-motion.md`](references/film-motion.md); the page contract in
> [`film-page`](../../../docs/contracts/film-page.md).

## When to use

- The user asks for a short motion film built from their own material — a
  product launch clip, a showreel, kinetic typography, an animated chart, a
  process explainer, a looping brand animation.
- The film has to render the same twice, sit on a beat or a declared tempo, or
  ship as an MP4 at a stated size.

## When NOT to use

- A prompt for a generative video provider (Veo, Kling, Sora) → `motion-choreographer`.
- An animation inside a UI — hover, scroll reveal, page transition → `fe-design` § Motion.
- Cutting or captioning existing footage → the `/video` cluster.
- A single static or looping SVG asset → `svg-authoring`.

## Procedure

1. **Inputs.** Ask only what the recipe lists as variable: purpose, format and
   pixel size, palette as hex, one typeface, audio (none, a supplied file, or a
   declared tempo), end card. On "just make it", state the defaults you used.
2. **Direction.** Pick one recipe from the corpus and state the one concept every
   shot serves:

   ```bash
   node <skills-root>/corpus-grounding/scripts/ground.mjs search \
     --manifest <skills-root>/code-film/data/manifest.json "<the brief>"
   ```

3. **Bans.** Pull the tells for the brief (`--domain tell`) and write each ban
   with its alternative into the plan.
4. **Grid.** Tempo and bars from the supplied track (`allin1.sh` when installed;
   otherwise a declared tempo, reported as declared), then an ordered shot list
   with times. Hold every text for its reading time (3 words per second).
5. **Explainers only — claims.** List every on-screen figure, name and date with
   its source, or mark it as the user's. Invent none.
6. **Build.** Write the page on the seek contract: `window.__seek(t)`,
   `window.__videoMeta`, no wall clock, seeded randomness, local fonts. Choose
   the renderer from `--domain renderer`; plain HTML is the default and a
   licensed renderer is suggested only after its licence question is answered.
7. **Contact sheet.** Render once, read `contact.png`, fix clutter, overlap and
   off-beat timing. At most three passes.
8. **Render.**

   ```bash
   agent-config ui:render film/index.html --profile film --out film/out.mp4 [--audio track.wav]
   ```

   Exit 0 is clean, 2 carries findings (determinism, flash, dead time, format,
   network), 1 means not assessed, 3 means no browser driver.
9. **Report.** Quote the manifest: the seek form, every check as `ran` or
   `skipped: <reason>`, the findings, and `verification`. Say `verified` only
   when the manifest says it and its file digest is the file you deliver.

## Status — what each word may mean

- **verified** — every applicable check ran on this machine and the encoded
  file's digest is the one recorded. It says nothing about whether the film is
  good.
- **static-only** — frames were captured and hashed, but a check that needs
  ffmpeg (flash floor, encode, format) did not run. Name the missing tool.
- **unassessed** — nothing was seen: no browser driver, no seek form, or no
  declared length. Name the install or the missing declaration.

## Output format

1. The film path and its SHA-256 from the manifest.
2. The checks table (`ran` / `skipped: …`) and every finding.
3. The contact sheet path.
4. For an explainer, the claims list with sources.

## Gotcha

- A page that uses `Math.random` or `Date.now` renders differently in the reverse
  pass; the manifest names the first diverging frame. Seed from `t`.
- The flash floor is a safety floor: a strobe fails and no flag lowers it.
- The film profile runs the page's scripts with the network off. A font or image
  fetched from a CDN does not load — ship it next to the page.
- Determinism is proven per machine; fonts and GPUs differ between machines.

## Do NOT

- Do NOT paste prompt text from an external gallery into a plan or a recipe —
  write it fresh from the corpus.
- Do NOT bundle or install a renderer without asking; detect and route.
- Do NOT call a film done from the code alone — the frames decide.
- Do NOT claim a film is good, on-brand or "less AI"; report what was measured.

## See also

- [`motion-choreographer`](../motion-choreographer/SKILL.md) — generative-provider motion prompts.
- [`svg-authoring`](../svg-authoring/SKILL.md) — the same witness vocabulary for single assets.
- [`corpus-grounding`](../corpus-grounding/SKILL.md) — the engine behind `data/`.
