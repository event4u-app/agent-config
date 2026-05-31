# Character Canon Spec — schema, fidelity rubric, fidelity loop

Shared contract consumed by [`image-analyser`](SKILL.md) and
[`image-creator`](../image-creator/SKILL.md). Defines the structured truth a
character image is reconciled against, how a candidate is scored, and how the
create→analyse→regenerate loop converges.

> **Design lock (AI-council, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round
> debate, user-invoked):** keep **ontology and epistemology separate**.
> `confidence` is a property of a *verification attempt*, **not** of the
> character — so it never lives on a canon leaf. Three layers below. The rubric
> is a **vector + hard gate**, never one scalar. The loop uses **plateau +
> oscillation detection**, not a bare iteration count.

## The three layers

A character record is split so each layer changes for a different reason:

### Layer 1 — `identity` (immutable canon · the character truth)

What the character *is*. Per-leaf `severity` only — **no confidence**, no
verification state. Source of truth = the canon (the book + its authoritative
portraits; *the image wins over the text*).

```jsonc
{
  "id": "veikko",
  "identity": {
    "physique": { "value": "lean wiry athletic, 1.82m, broad shoulders narrow hips", "severity": "major" },
    "face":     { "value": "...", "marks": [ { "value": "tiny scar above right mouth corner", "severity": "minor" } ] },
    "hair":     { "value": "vertical split: LEFT pitch-black / RIGHT platinum-blond, long open to chest, no shaved sides", "severity": "canon-breaking" },
    "eyes":     { "left": "ice-blue", "right": "forest-green", "heterochromia": true, "severity": "canon-breaking" },
    "tattoos":  [ { "location": "central chest", "motif": "Vegvisir compass", "style": "blackwork", "severity": "canon-breaking" },
                  { "location": "left chest", "motif": "Loki serpent biting tail", "severity": "canon-breaking" },
                  { "location": "knuckles", "motif": "block letters", "text": "S-U-S-I", "severity": "major" } ],
    "jewelry":  [ { "value": "massive round silver watch, RIGHT wrist", "severity": "major" } ],
    "outfit_variants": [ { "name": "studio-casual", "value": "black sleeveless tank under open leather vest" } ]
  },
  "identity_anchors": ["hair", "eyes", "tattoos[central chest]", "tattoos[left chest]", "jewelry[watch]"],
  "notes": "Loki = asymmetry everywhere (hair, eyes, tattoos)."
}
```

- **`severity`** ∈ `canon-breaking | major | minor` — how much a miss matters.
- **`identity_anchors`** — the must-never-drift list. **Derived rule:** every
  `severity: canon-breaking` leaf MUST be an anchor; anchors MAY also name
  cross-feature invariants (e.g. "asymmetry") that no single leaf captures.
- Relationship to [`character-consistency`](../character-consistency/SKILL.md):
  its existing token JSON (`agents/reference/ai-video/<project>/characters/<id>.json`)
  is the **load-bearing subset** of this `identity` layer. The Canon Spec is the
  richer superset; `image-analyser` emits the token subset into that exact file
  so there is **one** character record, not two.

### Layer 2 — `observation` (verification state · the analyser's output)

What a *specific image* shows, per attempt. **This** is where `confidence`
lives (`high | medium | low`, the `image-ocr` pattern) plus `unverifiable[]`
for features the image cannot resolve (occluded / low-res). Never written back
onto Layer 1.

```jsonc
{
  "source": "agents/tmp/odins-beard/img_2.png", "character": "veikko",
  "observed": { "hair": { "value": "near-uniform light/blond, split not distinct", "confidence": "high" },
                "eyes": { "value": "both read blue; green not visible", "confidence": "medium" } },
  "unverifiable": ["tattoos[knuckles].text (hands out of frame)"]
}
```

### Layer 3 — `generative_hints` (prompt-assembly guidance)

How to render the identity well: anchor ordering (hard-to-render anchors first
— heterochromia, hair-split), per-engine caveats, negative-prompt seeds. Read
by `image-creator`; never confused with the canon itself.

## Fidelity rubric — vector + hard gate (not one scalar)

A diff scores each observed feature `match | partial | miss`, then reports a
**vector**, not a single number:

1. **Canon-breaking gate (hard).** ANY `canon-breaking` leaf at `miss` → overall
   **FAIL**, regardless of everything else. Non-negotiable.
2. **Per-section scores.** `face`, `hair`, `eyes`, `tattoos`, `outfit`, `jewelry`
   each get their own 0–100 (severity-weighted within the section). Surfaced
   individually so a strong face can't mask a broken hair split.
3. **Headline.** A weighted roll-up is shown for convenience but is **advisory** —
   the gate + per-section vector decide pass/fail, not the roll-up.
4. **Low-confidence discipline.** A `miss` on a `low`-confidence observation is
   reported as `needs-better-image`, **not** counted as a hard miss — avoids
   false-fail on an un-resolvable feature (re-pass per SKILL § enhancement first).

## Fidelity loop — plateau + oscillation detection

`image-creator` generates → `image-analyser` re-reads the output against the
character's Layer-1 identity → diff → feed `canon-breaking` + `major` misses back
as refined prompt directives → regenerate.

Stop conditions (first to fire):

- **PASS** — canon-breaking gate clear AND every per-section score ≥ its
  threshold.
- **Plateau** — N consecutive rounds with no per-section score improvement →
  stop; the prompt is not the bottleneck (provider/seed is).
- **Oscillation** — fixing feature X regresses a previously-passing feature Y
  (tracked across rounds) → stop; surface the trade-off, do not thrash.
- **Budget** — hard ceiling on rounds as a backstop.

On any non-PASS stop → **halt and surface** the best candidate + its remaining
diff for human review. **Never silently accept drift** (per `verify-before-complete`).
