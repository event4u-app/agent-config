# First Win — AI Video

**Time to first value:** ≈ 12 minutes from install to a provider-tuned
motion prompt you can paste into Veo / Kling / Sora.

## What you'll get

One idea expanded into the 12-block Cinematic Scene Blueprint, then turned
into a provider-specific motion prompt with camera, primary + secondary
motion, physics, and native-audio cues — with the media-governance
disclosure footer attached.

## The one workflow

```text
1. /video:scene "<one-line idea>"
2. → agent runs `scene-expander` (12-block blueprint)
3. → agent runs `motion-choreographer` (provider-tuned motion prompt)
4. → output written to agents/runtime/state/<timestamp>-scene-prompt.md
```

## Expected output shape

```markdown
## Scene blueprint

- **Premise**: <one sentence>
- **Setting**: <where + when + light>
- **Subject**: <character lock JSON if reused across scenes>
- **Want / obstacle**: <…>
- **Beat**: <emotional beat in one word>
- **Camera**: <lens, height, motion>
- **Primary motion**: <subject motion>
- **Secondary motion**: <ambient motion>
- **Physics cue**: <gravity, weight, hair, fabric>
- **Native audio**: <ambient + foley>
- **Negatives**: <text, watermark, distortion>
- **Aspect / duration**: <9:16 · 8s>

## Provider-tuned prompt (Veo)

<copy-paste block>

---
Generated with AI video tooling.
Likeness / public-figure rules per project media-governance policy apply.
```

That disclosure footer is non-negotiable — see
[`media-governance-routing`](../../dist/agent-src/rules/media-governance-routing.md).

## Screenshot

`docs/wizard/screenshots/ai-video-first-win.png` _(captured in Phase 5 of
`road-to-role-first-onboarding.md`)_.

## What this does **not** do

- Does **not** generate the actual video — the agent produces the prompt;
  Veo / Kling / Sora run the inference.
- Does **not** clone real people without explicit project policy opt-in.
- Does **not** publish anywhere — output stays on your disk.

## Next step

Run `character-consistency` when you need the same subject across multiple
scenes (silhouette, palette, wardrobe lock).
