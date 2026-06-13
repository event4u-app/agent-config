---
model_tier: high
name: image-analyse
pack: ai-video
tier: 2
visibility: internal
cluster: image
sub: analyse
description: Analyse a character image down to the smallest mole and diff it against a canon — per-feature spec, OCR tattoo text, severity-ranked drift report.
personas: [hollywood-director]
skills: [image-analyser]
suggestion:
  eligible: true
  trigger_description: "analyse a character image, check character accuracy, does this render match the canon, find what drifted"
  trigger_context: "user supplies an image path/URL (and optionally a character id) and wants a detailed feature extraction or canon diff"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /image:analyse

Run the [`image-analyser`](../../skills/image-analyser/SKILL.md) skill on an
image. Args: `<path-or-url>` (required) `[character-id]` (optional — the canon
to diff against, e.g. `veikko`).

## Steps

1. **Resolve the image** — accept a path or public URL. Apply the input gate
   (refuse blurry / sub-resolution / unreadable; per the `image-ocr` contract).
2. **Governance check** — real-person likeness → route through
   [`media-governance-routing`](../rules/media-governance-routing.md) first.
3. **Run `image-analyser`** — section-by-section extraction (the "down to the
   smallest mole" pass), OCR sub-pass for lettered tattoos, hard-feature
   enhancement on low-confidence regions. Emit the Layer-2 observation
   (per-feature `confidence` + `unverifiable[]`).
4. **If `[character-id]` is given** — diff against
   `agents/reference/ai-video/<project>/characters/<id>.json` per the rubric in
   [`canon-spec.md`](../../skills/image-analyser/canon-spec.md): per-feature
   `match|partial|miss`, the canon-breaking hard gate, per-section scores.

## Output

1. Observation JSON (Layer 2).
2. Diff table (if a canon was given): `feature · severity · expected · observed · verdict · confidence · fix`.
3. Verdict line: `GATE: pass|FAIL` + per-section scores.

## Rules

- **Do NOT commit, push, or open a PR.**
- **The image wins over the text** — never invent an unseen feature; mark it `unverifiable`.
- **Read-only** — analysis only; generation is `/image:create`.
