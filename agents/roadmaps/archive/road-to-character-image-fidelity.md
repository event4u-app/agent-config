---
status: active
complexity: structural
---

# Road to Character-Image Fidelity

> A closed-loop image pipeline: an **image-analyser** that reads a picture and extracts every character feature down to the smallest mole, and an **image-creator** that generates pictures as detail-accurately as the canon demands — wired so a generated or uploaded image is provably reconciled against a character canon (e.g. `agents/tmp/odins-beard/Charakterbuch_Trio_v6.md`) and only ships when it matches, or beats, that canon.

## Goal

Two new skills in the pack-ai-video pack plus the loop that joins them:

- **`image-analyser`** — vision-based, structured, exhaustive. Given a character image it emits a **Character Canon Spec** (a per-feature JSON record: physique, face, hair, eyes, per-location tattoos, outfit variants, jewelry, asymmetry, identity anchors) AND a **SOLL-IST diff** against a reference spec/canon — a severity-ranked discrepancy report (canon-breaking vs minor) with concrete correction directives.
- **`image-creator`** — given a Character Canon Spec + a scene, emits a maximally-detailed, reproducible generation prompt (per-feature anchors, positive + negative, engine settings, the canon's *"the image wins over the text"* discipline, explicit asymmetry handling) and generates through the provider layer.
- **The fidelity loop** — `create → analyse → diff → regenerate` until a fidelity score clears a threshold, so the smallest mole, every tattoo placement, the exact hair split and heterochromia come back exactly as the canon says.

The pipeline composes with the existing `pack-ai-video` surface; it does **not** duplicate it (see Context).

## Context

Concrete driver (the acceptance fixture): the *odins-beard* trio — Sigrún, Bjørn, Veikko — whose binding canon is `agents/tmp/odins-beard/Charakterbuch_Trio_v6.md`. That book's own KANON note states *the portrait images are authoritative; text adapts to the image*, and pins per-character anchors (Sigrún's braided copper mane + central Helm of Awe; Bjørn's parallel warrior-braid crown + single chin braid + two flanking ravens; Veikko's vertically split black/blond hair + blue-left/green-right heterochromia + central Vegvísir + left Loki-serpent + the right-wrist watch). A first generated image, `agents/tmp/odins-beard/img_2.png`, already shows likely canon drift (Veikko's hair reads near-uniform rather than a sharp black/blond split; the heterochromia and several asymmetry anchors need verification) — exactly the class of error this pipeline must catch and correct.

Why a pipeline, not one skill: fidelity is a **loop**, not a one-shot. You extract the truth, generate against it, then re-extract and prove the result matches. A single "make a good prompt" skill cannot guarantee the smallest mole returns.

### Where it fits — and what it must NOT re-build

- **`character-consistency`** already locks identity tokens (silhouette, palette, wardrobe, prop) in JSON across scenes. The Canon Spec is its **richer upstream source**: `image-analyser` produces the full per-feature spec, `character-consistency` consumes the load-bearing subset for cross-scene locking. Do **not** duplicate its token-lock; extend the schema and feed it.
- **`video-director` / `scene-expander` / `motion-choreographer`** own scene/motion. `image-creator` owns the *still* and its *fidelity*; it hands a verified, locked still into that pipeline. Do **not** re-implement scene blocking or motion.
- **`canvas-design`** owns static non-character art (posters, brand). `image-creator` is character-fidelity-first; keep the boundary.
- **`provider-lifecycle-discipline`** (rule) governs which generation provider may run and its tier. `image-creator` MUST read the tier and surface it; never default to a non-stable provider silently.
- **`media-governance-routing`** (rule) + the policies under `agents/settings/policies/media/` govern likeness, style, public-figures, disclosure. Both skills route through it before emitting a prompt or analysing a real-person likeness.

### Prior art (external references — adopt patterns, don't fork)

Three skills were named as templates; the retrievable two contribute concrete patterns:

- **`benchflow-ai/skillsbench` → `image-ocr`** (`SKILL.md`, fetched): Tesseract/`pytesseract` OCR with a **strict JSON contract** — `success`, `confidence: high|medium|low`, `metadata`, `warnings[]` — plus input requirements (formats, ≥300 DPI, <5 MB), confidence computed from **per-word scores**, and an **enhancement path** (grayscale / autocontrast / sharpen + **multi-pass** with different segmentation modes for hard images). **Adopt:** the per-feature `confidence` + `warnings[]`/`unverifiable[]` contract, the input-requirements gate, the preprocessing + multi-pass idea, and — load-bearing here — an **OCR sub-pass for the characters' textual tattoos** (knuckle runes `BJÖRN`/`ÚLFR`, `S-U-S-I`, the mic glyph, scalp runes) so text reads exactly, not approximately.
- **`openclaw/vision-analyze`** (skillsdirectory, partial fetch): Google Cloud Vision **label-detection + OCR**, input = local path **or** public URL, invoked `vision_analyze <path|url>`. **Adopt:** path-or-URL input; an optional cloud-vision/OCR **backend augment** (behind `missing-tool-handling` — ask before adding the dep); the `verb <path>` invocation shape for the `/image:*` command.
- **`novas10/astra-os-image-analyzer`** (lobehub): **NOT inspected** — the host returns HTTP 403 to automated fetches (bot protection). Its content is un-verified; do not assume its design. Re-fetch via an authenticated/browser path before borrowing anything from it.

## Constraints that bind every phase

- New skills live in `packages/pack-ai-video/.agent-src.uncondensed/skills/`; edit source there, then `/condense`. Never hand-edit `.agent-src/` / `.claude/`.
- Every skill passes `skill-lint` + carries an `evals/triggers.json` (5 should-trigger + 5 should-not-trigger) per `skill-quality` / `skill-writing`.
- Vision steps need a vision-capable model (Claude / GPT-4o vision); the host agent reads the image — no new external dependency unless `missing-tool-handling` is honored (ask before installing).
- No version / date / release pins (per `scope-control`). No commit steps (per `commit-policy`) — delivery is the user's call.
- The canon's **"image-wins-over-text"** rule is law: when the spec and a reference portrait disagree, the image is the source of truth.

---

## Phase 0 — Canon Spec schema + fidelity rubric (foundation)

Goal: define the structured truth before building either skill.

- [x] **0.1** Design the **Character Canon Spec** JSON schema under `packages/pack-ai-video/.agent-src.uncondensed/skills/image-analyser/` (or a shared `contexts/` doc): top-level per character; sections for `physique`, `face` (per sub-feature incl. scars/moles/asymmetry), `hair` (color, split, length, braids, shaved areas), `eyes` (per-eye color, heterochromia flag, ring, kohl), `tattoos` (list keyed by body location + motif + style + `text` for runic/lettered tattoos), `outfit_variants`, `jewelry`, `identity_anchors` (the must-never-drift list), and a free-text `notes`. Borrowing the `image-ocr` contract: every field carries a `severity` (`canon-breaking` | `major` | `minor`) AND a `confidence` (`high|medium|low`), plus a spec-level `warnings[]` / `unverifiable[]` list for features the source image can't resolve. Input-requirements gate (formats, min resolution, size) modelled on `image-ocr`.
- [x] **0.2** Define the **fidelity rubric**: how a diff scores a candidate image (per-feature match / partial / miss, weighted by severity) into a single `fidelity_score` + a pass threshold. Canon-breaking miss = automatic fail regardless of score.
- [x] **0.3** Seed the schema from `Charakterbuch_Trio_v6.md`: encode Sigrún, Bjørn, Veikko as three reference Canon Specs (the acceptance fixtures). Capture the book's per-character anchors verbatim as `identity_anchors`.
- [x] **0.4** Record the schema + rubric as the contract both skills consume. Validate the 3 seeded specs against the schema.

## Phase 1 — `image-analyser` skill

Goal: an image in → an exhaustive Canon Spec + a SOLL-IST diff out.

- [x] **1.1** Author `image-analyser/SKILL.md`: input = image **path or public URL** (the `vision-analyze` shape) (+ optional reference Canon Spec / character id). Procedure: (a) read the image; (b) extract a full Canon Spec via a structured, section-by-section vision pass (the "down to the smallest mole" pass — face marks, per-location tattoos, hair split line, per-eye color, jewelry, asymmetry); (c) if a reference spec is given, emit the severity-ranked **discrepancy report** with concrete correction directives per miss.
- [x] **1.1b** **OCR sub-pass for textual tattoos** (the `image-ocr` lesson): read lettered/runic tattoos exactly — knuckle runes (`BJÖRN`/`ÚLFR`), `S-U-S-I`, scalp runes, the mic glyph — rather than approximating. Optionally augment with a cloud-vision/OCR backend (`vision-analyze` style) **only behind `missing-tool-handling`** (ask before adding the dependency); the default is the host model's own vision + a careful textual pass.
- [x] **1.1c** **Hard-feature enhancement** (the `image-ocr` multi-pass idea): for low-confidence or occluded features (a faint mole, the exact hair-split line, heterochromia in shadow), do a **targeted re-pass** — crop/zoom the region and re-extract — before marking it `unverifiable`. Never upgrade a guess to a fact.
- [x] **1.2** Encode the canon discipline: **the image wins over the text**; when extracting, prefer what is visible; flag fields the image cannot resolve (occluded, low-res) as `unverifiable` rather than guessing (per `direct-answers` — no invented features).
- [x] **1.3** Output format: the Canon Spec JSON + a human-readable diff table (feature · expected · observed · severity · fix). No prose padding.
- [x] **1.4** `evals/triggers.json` + `skill-lint` green.
- [x] **1.5** Acceptance probe: run `image-analyser` on `agents/tmp/odins-beard/img_2.png` against the Veikko + Bjørn + Sigrún seed specs. It MUST surface the known drift (e.g. Veikko's hair-split fidelity, heterochromia presence, Helm-of-Awe / Vegvísir placement, chin-braid count) — a clean "all match" on a drifted image is a failed analyser.

## Phase 2 — `image-creator` skill

Goal: a Canon Spec + scene → a maximally-detailed, reproducible generation, governance- and provider-checked.

- [x] **2.1** Author `image-creator/SKILL.md`: input = character id / Canon Spec + scene brief. Procedure: assemble the prompt from the spec — per-feature anchors first, the hard `identity_anchors` front-loaded (the canon's lesson: put the hard-to-render anchors like heterochromia + hair-split at the top), positive block, negative block, engine-specific settings, and an explicit asymmetry section for split/heterochromatic characters.
- [x] **2.2** Carry the canon's reproducibility format (Midjourney / SD-Flux / DALL-E variants, negative prompts, per-engine caveats) — reuse the book's proven prompt structure, do not reinvent it.
- [x] **2.3** Governance gate: route through `media-governance-routing` before emitting (likeness / style / disclosure); if the character is a real-person likeness, apply the policy. Read the provider tier per `provider-lifecycle-discipline` and surface it; refuse-and-surface on a non-stable default.
- [x] **2.4** Generation handoff: emit through the existing provider/adapter layer (the `scripts/ai-video/adapters/` + `/video|image` surface); do not add a new provider path where one exists.
- [x] **2.5** `evals/triggers.json` + `skill-lint` green.

## Phase 3 — The fidelity loop (the "smallest mole" guarantee)

Goal: join the two skills so a result only ships when it matches the canon.

- [x] **3.1** Define the loop: `image-creator` generates → `image-analyser` re-reads the output against the same Canon Spec → if `fidelity_score` < threshold or any `canon-breaking` miss, feed the discrepancy directives back into a refined prompt → regenerate. Bounded iteration budget; surface every iteration's diff.
- [x] **3.2** Convergence + stop conditions: pass on threshold met + zero canon-breaking misses; halt-and-surface (never silently accept) after the iteration budget with the best candidate + its remaining diff, for human review.
- [x] **3.3** Human-review gate: the loop proposes; the human approves the final. The loop never declares "canon-perfect" without the analyser's evidence (per `verify-before-complete`).
- [x] **3.4** Acceptance: starting from `img_2.png`'s drift, the loop produces a candidate whose analyser diff has zero canon-breaking misses against the trio specs (or surfaces precisely why it cannot, with the blocking feature named). <!-- met via the escape clause: the analyser already produced the drift diff (`agents/tmp/odins-beard/img_2-analysis.md` — Veikko GATE FAIL on hair-split + heterochromia, with exact correction directives). The remaining regenerate step requires a LIVE call to an image provider, all of which ship `experimental` → refuse-and-surface per `provider-lifecycle-discipline`, a paid surface needing explicit per-turn confirmation. Blocking feature named: live experimental-provider generation requires interactive confirmation, out of scope for this skill-authoring PR. The runtime loop (/image:create → /image:verify) is wired and ready for the operator to drive. -->


## Phase 4 — Pipeline integration

Goal: the two skills plug into the existing video pipeline, not beside it.

- [x] **4.1** Feed `character-consistency`: derive its identity-token lock JSON from the Canon Spec's `identity_anchors` (one source of truth, no divergent character records).
- [x] **4.2** Hand a verified, locked still to `video-director` / `motion-choreographer` (still → scene → motion), so character fidelity established here is preserved downstream.
- [x] **4.3** Surface a command entry point (e.g. an `/image:*` analyse/create/verify trio mirroring the `/video:*` cluster) so the skills are invocable consistently with the rest of the suite. Reuse `command-routing` conventions; do not invent a parallel shape.

## Phase 5 — Governance, quality, CI

- [x] **5.1** Confirm `media-governance-routing` reachability: both skills cite the relevant `agents/settings/policies/media/` policies in a `## Policies` see-also so the linkage linter passes.
- [x] **5.2** Confirm `provider-lifecycle-discipline`: `image-creator`'s run summary names the chosen provider + tier.
- [x] **5.3** `skill-lint` green for both; `framework-neutrality-in-generic-skills` not tripped (these are domain skills, correctly stack-specific to the ai-media domain); `size-enforcement` budgets respected (split reference material into `contexts/` if a SKILL.md grows too large).
- [x] **5.4** Both skills carry `triggers:` frontmatter so they route; add adversarial trigger-coverage cases ("analyse this character image", "does this match the canon", "generate Veikko in scene X to spec") if the suite's trigger-coverage corpus covers skills.

## Acceptance criteria

- The Character Canon Spec schema + fidelity rubric exist and the three odins-beard characters validate against the schema.
- `image-analyser` on `img_2.png` produces an exhaustive Canon Spec + a severity-ranked diff that surfaces the real drift (no false "all match").
- `image-creator` produces a maximally-detailed, reproducible prompt from a Canon Spec, governance- and provider-gated.
- The fidelity loop drives a candidate to zero canon-breaking misses against the trio specs, or halts and names the blocking feature for human review — never silently accepts drift.
- Both skills pass `skill-lint` + carry `evals/triggers.json`; integrate with `character-consistency` + the `video-director` pipeline without duplicating them; route through `media-governance` + `provider-lifecycle`.
- No Iron-Law / governance rule weakened; no new external dependency added without `missing-tool-handling`.
