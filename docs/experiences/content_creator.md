# ✍️ The `content_creator` experience

> Set `profile.id: content_creator` (wizard, or
> `agent-config use --profile=content_creator`). **Preset default: `balanced`.**

## Who it's for

Writers, ghostwriters, marketers — draft in someone else's voice, plan a quarter
of content, ship a launch, render a cinematic AI video.

## First three tasks

1. **Write in a voice** — `/ghostwriter` against a public-figure voice profile, or `/post-as` for your own (`.agent-user.md`).
2. **Lock the brand frame** — `voice-and-tone-design` + `messaging-architecture` before any copy ships.
3. **Render a video** — `/video:from-script` drives script → character-locked image → motion+audio → render → stitch (`AIV_DRYRUN=true` cost-safety default).

## First commands

`/work` · `/post-as` · `/ghostwriter` · `/optimize-prompt` · `/video:from-script` · `/video:storyboard` · `/video:scene` · `/video:stitch`

## Packs that activate

`gtm-marketing` + `ai-video` (+ `meta`, always on).

## Flows that apply

[Discovery](../flows.md) drives content planning (editorial calendar, messaging).
The engineering flows (implementation / review / delivery) do not apply — the work
is pack-skill-driven (voice, messaging, video), not a code journey.

## What is NOT loaded

No `engineering-base` (no `/implement-ticket`, `/review-changes` code judges),
no `finance-*`, no `founder-strategy`. The surface is content + video.

## Example

> *"Draft a launch post in our founder's voice."* → `/post-as:me` writes against
> `.agent-user.md`; `voice-and-tone-design` + `messaging-architecture` hold the
> brand frame; `release-comms` shapes the announcement.

## See also

[Profile (deep)](../profiles.md#profile-content_creator) ·
[Role guide](../getting-started-by-role.md#creator-writer-marketer-indie-content-shop) ·
[Flows](../flows.md) ·
key skills: `voice-and-tone-design` · `messaging-architecture` · `editorial-calendar` · `release-comms` · `character-consistency`.
