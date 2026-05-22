# `agents/reference/ai-video/` — Operator surface for the `/video:*` pipeline

> Operator-facing notes for the AI video pipeline. Scripts, skills, and
> commands live in the repo; this directory is the **runtime surface**:
> provider secrets next to it (`agents/.ai-video.xml`), prompt library,
> reference examples, and project scratch outputs.

## Directory layout

```
agents/
├── .ai-video.xml                       # operator-only — gitignored, NEVER committed
├── templates/
│   └── .ai-video.xml.example           # committed schema template
└── reference/ai-video/
    ├── README.md          # this file
    ├── prompts/           # vetted prompt library (committed)
    ├── examples/          # golden reference projects (committed)
    └── <project-slug>/    # operator scratch (gitignored)
        ├── characters/    # character.json — Character Lock state
        ├── scenes/        # per-scene artifacts (image, video, selection.json)
        └── out/           # stitched MP4 output
```

Everything under `agents/reference/ai-video/` except `README.md`, `prompts/`, and
`examples/` is gitignored. Generated clips, intermediate renders, and
operator picks live on disk only.

## First-run setup

1. Copy the template:

   ```bash
   cp agents/templates/.ai-video.xml.example agents/.ai-video.xml
   ```

2. Open `agents/.ai-video.xml` and fill in the API keys for the
   providers you actually use. Leave the others as `REPLACE-ME` — the
   loader treats those as `missing` without warning so you can roll out
   one provider at a time.

3. Check loader status without echoing keys:

   ```bash
   bash scripts/ai-video/lib/load-config.sh status gemini-veo
   # → provider=gemini-veo key=present dryrun=true model=veo-3.0-generate-001 …

   bash scripts/ai-video/lib/load-config.sh defaults
   # → default-image-provider=openai-images
   #   default-video-provider=gemini-veo
   ```

4. Verify gitignore covers the secrets file:

   ```bash
   git check-ignore agents/.ai-video.xml   # → agents/.ai-video.xml
   ```

   If this prints nothing, **stop** — your secrets file is tracked.

## Schema overview — `agents/.ai-video.xml`

Root element `<ai-video version="1">` with two sections:

- **Defaults** — `<default-image-provider>` and `<default-video-provider>`
  name the providers `/video:*` commands use when `--image-provider` /
  `--video-provider` flags are not passed.
- **`<provider id="…" kind="image|video|image+video">`** — one block per
  backend. Holds `<api-key>`, optional `<endpoint>`, `<default-model>`,
  `<dry-run>true|false</dry-run>`, and a per-provider `<tuning>` block
  (`aspect`, `fps`, `max-duration`, `audio-native`, plus provider-specific
  knobs like `preset` or `best-of-n`).
- **`<extra>`** — slot for future providers without changing the parser
  contract.

Provider IDs shipped in the example: `openai-images`, `higgsfield`,
`gemini-veo`, `kling`, `sora`.

## Key handling — the redaction guarantee

Every adapter under `scripts/ai-video/adapters/` sources two helpers
before any network call:

- `scripts/ai-video/lib/load-config.sh` — parses the XML, populates
  `AIV_KEY` / `AIV_ENDPOINT` / `AIV_MODEL` / `AIV_DRYRUN` env vars.
  **It never prints the key.** Status output is `present` or `missing`.
- `scripts/ai-video/lib/redact.sh` — registers `AIV_KEY` in a private
  scrub list and provides `aiv_redact` / `aiv_redact_stream`. Adapters
  pipe every `curl`, error, and trace through these before printing.

Rule of thumb for any new adapter:

```bash
. scripts/ai-video/lib/redact.sh
. scripts/ai-video/lib/load-config.sh
aiv_load_provider gemini-veo
curl … 2>&1 | aiv_redact_stream
```

If you see a key in a log, that is a bug — file an issue and pin the
adapter that printed it.

## Rotating a key

1. Generate the new key in the provider dashboard.
2. Replace the value inside `<provider id="…"><api-key>…</api-key></provider>`
   in `agents/.ai-video.xml`.
3. Revoke the old key in the provider dashboard.
4. (Optional) `bash scripts/ai-video/lib/load-config.sh status <id>` to
   confirm `key=present`.

No restart needed — adapters re-source the loader on every invocation.

## Dry-run by default

All adapters honor `AIV_DRYRUN=true` (default — set per-provider in the
XML and overridable via env). Dry-run returns a fixture artifact from
`scripts/ai-video/lib/fixtures/` without touching the network, so the
offline smoke test (`task test:ai-video`) is hermetic and the cost floor
holds.

A live network call requires **both** `AIV_DRYRUN=false` (set in XML
or env) **and** explicit per-turn confirmation in the invoking command
(see `non-destructive-by-default` for the rationale).

## What NOT to put here

- Real keys committed to git — there is no recovery path; the key is
  considered compromised the moment it lands in history.
- Generated MP4s — anything not under `prompts/` or `examples/` is
  scratch and gitignored.
- Voice clones of real people, music-only renders, audio-only renders
  without a video target — explicitly out of scope per the roadmap.
