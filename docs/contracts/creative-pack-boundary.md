# Creative Pack boundary — video is an optional pack, not core identity

The `ai-video` (Creative) pack is a **bounded, optional** capability: a first-class
part of the **content creator** experience, never the package's core identity.
This contract draws the boundary so omitting the pack degrades nothing in the
engineering / strategy / finance experiences. (`ai-video` ships
`trust_level_default: experimental`, 10 artefacts.)

## (a) User-facing video artefacts

Surfaced only when the pack is active (the `content_creator` profile, or an
explicit enable):

- **Commands:** `/video:from-script` · `/video:storyboard` · `/video:scene` ·
  `/video:stitch` · `/video:from-song` · `/image:create` · `/image:analyse` · `/image:verify`.
- **Skills:** `video-director` · `character-consistency` · `motion-choreographer` ·
  `scene-expander` · `song-to-script` · `pixar-storyteller` · `image-creator` ·
  `image-analyser` (+ `prediction-pool-optimizer`).

## (b) Internal / provider-specific artefacts

Not user-facing; they implement the pipeline and stay inside the pack boundary:

- Provider adapters under `src/scripts/ai-video/adapters/` (openai-images,
  gemini-veo, kling, higgsfield, sora) + the adapter contract.
- `provider-lifecycle-discipline` rule + `agents/templates/.ai-video.xml.example`
  (provider tiers, `<default-video-provider>`).
- `AIV_DRYRUN=true` cost-safety default; the media-governance policy layer
  (`agents/settings/policies/media/`) and the `media-sync-ground-truth` /
  `media-governance-routing` rules.

## (c) Compatibility matrix — what works without the Creative Pack

| Profile | Creative Pack | Without it |
|---|---|---|
| `content_creator` | **active** | full video surface |
| `developer` · `agency` · `ops` · `finance` · `founder` | not included | **no change** — video was never projected |

| Flow | Depends on Creative Pack? |
|---|---|
| discovery · implementation · review · delivery | **No** — the four work-flows are engineering journeys; none reference a video command or skill |

**What breaks without it:** nothing in the core surface. The `/video:*` and
`/image:*` commands are simply absent (graceful — projection-time filtering never
writes them); no rule, flow, or non-creator profile depends on an `ai-video`
artefact. The media-governance policy layer is referenced by routing rules that
stay inert unless a media surface fires, so it does not break either.

**Conclusion:** the Creative Pack is cleanly severable. It enriches the
`content_creator` experience and is invisible everywhere else — keeping video a
bounded Creator capability, not the package's identity.

## See also

- [`src/domains/ai-video/pack.yaml`](../../src/domains/ai-video/pack.yaml) — the generated pack manifest (span + trust level).
- [`profiles.md`](../profiles.md) · [`experiences/content_creator.md`](../experiences/content_creator.md) — where the pack surfaces.
- [`provider-lifecycle-discipline`](../../src/rules/provider-lifecycle-discipline.md) — the provider-tier rule inside the boundary.
- ADR-040 — projection-time filtering (the mechanism that makes a pack optional).
