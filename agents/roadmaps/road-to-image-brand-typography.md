---
complexity: structural
---

# Roadmap: image generation, brand, and typography/iconography

> **Complexity:** structural (three new/extended design domains + a
> cross-cutting eval substrate). Council-reviewed; the five design trade-offs
> are resolved inline (see *Locked decisions* + *Council notes*).
>
> Frames against [`ADR-061`](../../docs/decisions/ADR-061-corpus-grounding-layer.md)
> (the reusable corpus-grounding layer; frontend-design is its first instance),
> the `provider-lifecycle-discipline` / `media-governance-routing` rules, the
> `pack-ai-video` adapter architecture
> ([`src/scripts/media/lib/adapter-contract.md`](../../src/scripts/media/lib/adapter-contract.md),
> [`agents/.ai-video.xml`](../../agents/.ai-video.xml)), and the existing
> `design-intelligence` / `design-tokens` / `corpus-grounding` skills.

## Goal

Make image generation a first-class domain beside video, make brand a
first-class UX layer that *constrains* UI (not a sub-feature of it), and
reinstate typography + iconography correctly classified — each shipped to the
same package-quality bar `design-intelligence` cleared (ATTRIBUTION, SHA-pin +
refresh DoD, schema-conformant frontmatter, trigger-evals), with the trigger-eval
substrate built **last** from observed measurement needs.

## Governing principle (ADR-061 §1, carried forward)

Every capability is classified by the **four operations** before a line is
written — **Grounding** (pre-action selection: curated corpus + decision
rules), **Reference** (mid-action factual lookup → API/RAG *or* a curated,
freshness-contracted lookup table, *not* decision logic), **Validation**
(post-action constraint check → rule/linter), **Method** (the procedure → a
skill). Conflating them is "grounding theater." Each phase names which
operation each piece is.

## The three honest constraints (verified June 2026)

1. **Claude is not a pixel provider — by Anthropic policy.** Claude has no
   native raster image generation; image output is reached through third-party
   connectors. **Consequence:** the image domain treats Claude as the
   *orchestrator* (prompt construction, provider selection, governance,
   SVG/code visuals) and Gemini / OpenAI / Flux / Ideogram as the *pixel
   providers*. "Claude drives the provider that does" — never "Claude generates."
2. **We already generate images — in the wrong place.** Image generation lives
   today as a `kind="image"` provider *inside* `pack-ai-video`
   ([`src/scripts/ai-video/adapters/openai-images.sh`](../../src/scripts/ai-video/adapters/openai-images.sh)
   — promoted `stable` 2026-06-10; `gemini-veo.sh`; `fal.sh`; `replicate.sh`).
   The adapter contract, the `.ai-video.xml` registry, and
   `provider-lifecycle-discipline` are all reusable. Track A is mostly
   **promotion + extraction**, not greenfield.
3. **Half the brand→token pipeline already ships.**
   [`src/skills/design-tokens/`](../../src/skills/design-tokens/) authors a DTCG
   token system ([`scripts/tokens.py`](../../src/skills/design-tokens/scripts/tokens.py),
   `$value`/`$type`, no Node). Missing: the **brand layer above tokens**
   (strategy, identity, voice/tone, the brand→token *derivation* ADR-061 §8
   deferred). DTCG reached first stable (2025.10) — the deferred interop
   substrate is now stable enough to commit to.

## Locked decisions (council-resolved — do not relitigate)

1. **Brand-asset generation ADOPTED — overturns ADR-061 §9** (2026-06-13 merits
   council). Logo/CIP/banner/social generation is structured prompting +
   brand-token injection + provider routing on Phase A's **existing** adapters —
   **not** a second image-gen stack, which dissolves §9's only rationale.
   Generation lives in **pack-ai-image**; brand **governance/tokens** stay in
   **pack-brand**, which *exports* tokens that pack-ai-image consumes (dependency
   B → A, never inverted — generation-in-pack-brand would be a God-object). Add a
   **vector path** (raster-only models can't emit usable logos): a `recraft`
   adapter (true `<path>` SVG) + an LLM-authored-SVG path for simple marks.
   Harvest MIT patterns from `designrique/ai-graphic-design-skill` +
   `neonwatty/logo-designer-skill`.
7. **Slide/presentation engine SKIPPED — reasoned, not ADR-deferred** (2026-06-13
   merits council; overrides the research's adopt-lite). Document assembly ≠ brand
   UX; owning a render engine (reveal.js/Presenton/Gamma) is scope creep that
   dilutes both image-gen and brand focus. Instead pack-brand **exports validated
   brand templates** (e.g. Marp/reveal YAML with locked brand variables) for the
   user's own deck tools — enforcement via the template, not engine ownership.
   Re-open only on evidenced demand.
8. **Font catalogue ADOPT-LITE pinned metadata — overturns ADR-061 §8 "API-only"**
   (2026-06-13 merits council). Don't re-vendor the 745 KB CSV **and** don't rely
   on the live API (needs a key, nondeterministic, no pairing metadata). Pin the
   MIT `google-font-metadata` mirror — or a slim top-N slice (usage rank + pairing
   coverage + ≥ 10 per category) — as the deterministic offline Reference;
   pairings stay a curated map; Iconify CSS-mode + Font Awesome for icons-as-CSS.
2. **Greenfield = sibling roadmap.** The Lovable-style `scaffold` work-engine
   directive step ships in a separate `road-to-greenfield-scaffold.md`. This
   roadmap lands only the **interface stubs** (brand-token consumption contract +
   `mixed`-set routing hook) in Phase B, so brand→tokens is not dead output.
3. **Sequence A → C → B → D.** A (image) is independent and provides the logo
   path B needs; C (typography/icons) ships its Reference table + style path; B
   (brand) adds the brand-principle Grounding that upgrades C and consumes A's
   logo path; D (eval substrate) ships **last**, built from observed needs with
   **domain-specific floors** — not frozen before the skills exist.
4. **Typography reclassified.** Curated font pairings stay (not deleted) but as
   **Reference** (`font-pairings-reference.csv` + freshness contract); the brand
   archetype → pairing-filter mapping is **Grounding** in the brand corpus;
   `typography-system` is a two-stage Method (style-idiom path in C, brand-aware
   upgrade in B).
5. **Personas:** add `brand-strategist` + `design-director` (the art-direction
   lens folds into `design-director`, which also serves Track A) — 2 specialists,
   within the `persona-governance` per-domain cap. `design-system-lead` deferred.
6. **Image providers:** `ideogram` default for text-in-image (logos/banners),
   `gemini-image` (Nano Banana family + Imagen 4) and GPT Image 2 general, `flux`
   photoreal. The DALL·E branch in `openai-images.sh` is removed before its
   2026-10-23 API deprecation.

## Prerequisites

- [`src/skills/corpus-grounding/`](../../src/skills/corpus-grounding/) engine
  (`scripts/bm25_search.py`, `decision_engine.py`, `ground.py`,
  `schema_validator.py`) — the shared layer Track B's brand corpus plugs into.
  **No forked engine** (ADR-061 §2).
- [`src/scripts/skill_trigger_eval.py`](../../src/scripts/skill_trigger_eval.py)
    + `task test-triggers[-live]` in [`taskfiles/engine.yml`](../../taskfiles/engine.yml).
- [`src/cli/registry.ts`](../../src/cli/registry.ts) + commander wiring in
  `src/cli/agent-config.ts` (ADR-012 TS CLI shell) — host for `eval:record`.
- [`docs/decisions/ADR-061-corpus-grounding-layer.md`](../../docs/decisions/ADR-061-corpus-grounding-layer.md)
  §8 (brand→token defer — this roadmap is the "first consumer demand") and §9.

---

## Phase A — `pack-ai-image`: image as a first-class sibling of video

Standalone, multi-provider, governed image domain that does **not** ride inside
the video pipeline. Mostly extraction + promotion. Ships first: it is
independent and provides the logo/asset path Phase B consumes.

### A.1 The load-bearing refactor

- [x] Extract the shared adapter substrate out of `src/scripts/ai-video/` into a
  neutral `src/scripts/media/` (adapter-contract, provider-registry schema,
  lifecycle states, smoke harness); `ai-video` and `ai-image` both depend on
  it. Gate with a parity test that the moved video adapters still pass their
  smoke runs. Broaden `provider-lifecycle-discipline`'s `path_prefix` from
  `scripts/ai-video/adapters/` to `scripts/media/`.
  <!-- done 2026-06-16: Option-B behavior-preserving relocate (council
  claude-sonnet-4-5 + gpt-4o, 3-round design debate). Moved adapter-common /
  redact / load-config / telemetry / adapter-contract.md / fixtures → src/scripts/media/lib/;
  all 12 adapters + staying libs + 94 refs repointed; MEDIA_* aliases added as
  the forward-neutral surface; rule path_prefix +scripts/media/lib/. Video
  parity green (5605 pass). DEFERRED to a Phase-A follow-up: (a) AIV_*→MEDIA_*
  internal rename, (b) generalizing+relocating smoke-trace.sh (still hardcoded
  to ai-video adapters/out-dir) — both cosmetic/high-churn, kept in place to
  hold the shipped video pipeline stable. -->
- [ ] *(Phase-A follow-up, deferred from A.1)* Rename the substrate internals
  `AIV_*` → `MEDIA_*` and generalize+relocate `smoke-trace.sh` into
  `src/scripts/media/` (parameterize ADAPTER_DIR / OUT_DIR per domain). Ships
  with A.2 when the first image adapters exercise the neutral surface.

### A.2 Pack + providers

- [x] New pack `pack-ai-image` mirroring `ai-video`'s manifest shape
  (`trust_level_default: experimental`, `size_class: large`, `FIRST_WIN.md`,
  `time_to_first_value_minutes`); `requires: []`, `suggests: [ai-video]`.
  Ship in `balanced` + `full`; `minimal` stays text-only.
  <!-- 2026-06-16: shipped as a manifest-only capability pack (src/packs/ai-image/,
  registered in packs.yml + small-business optional_packs; suggests:[ai-video]).
  It became non-empty once A.3's first 2 skills landed (artefact_count=2).
  size_class=medium + FIRST_WIN.md/onboarding + the balanced/full split deferred to
  the command-bearing cut (relocates to src/domains/) when /image:* commands land. -->
- [ ] Promote/extend adapters under the moved substrate, each per
  `provider-lifecycle-discipline` (scaffold → live-validated → stable, with
  smoke evidence):
  <!-- 2026-06-16: the 4 NEW adapters shipped at scaffold tier (dry-run +
  domain-neutral smoke harness proves the media/ substrate drives a new
  image domain end-to-end; live submit/poll/fetch honestly "not wired").
  openai-images retarget deferred — it is live-adapter surgery on a shipped
  `stable` video adapter, not a scaffold (council 2026-06-16). -->
    - [ ] `openai-images` — retarget to GPT Image 2; **remove the DALL·E branch**.
    - [x] `gemini-image` — Nano Banana family + Imagen 4. (scaffold tier)
    - [x] `ideogram` — text-in-image default (logos/banners). (scaffold tier)
    - [x] `flux` — photorealism (via fal/replicate to start is acceptable). (scaffold tier)
    - [x] `recraft` — vector/SVG output (true `<path>` logos/icons; raster models
      can't emit usable vector brand marks). Decision 1's vector path. (scaffold tier)

### A.3 Skills, commands, rules, persona

- [x] Skills: `image-generation` (Method — provider-agnostic blueprint →
  provider translation; ref-image/seed reuse for character consistency),
  `image-provider-routing` (Grounding — corpus + decision rules selecting a
  model from job shape: needs-text? photoreal? budget? 4K?), `image-editing`
  (Method — inpaint/edit/variation where supported),
  `prompt-engineering-image` (Method/Reference — per-provider prompt grammar).
  <!-- 2026-06-16: 2/4 shipped — `image-provider-routing` + `prompt-engineering-image`
  (the two that are genuinely testable now: select + prompt-grammar, no live render).
  `image-generation` + `image-editing` DEFERRED until the adapters leave scaffold
  tier — shipping "generate"/"edit" skills over dry-run-only adapters is fake
  capability (council 2026-06-16). -->
- [x] **Brand-asset generation skills** (decision 1 — ADOPTED, overturns §9; ride
  on the adapters above, not a second stack): `logo-generation`,
  `brand-asset-generation` (banner / social / CIP) — structured prompting +
  brand-token injection + provider routing; vector via the `recraft` adapter or
  LLM-authored SVG for simple marks. Harvest MIT patterns from
  `designrique/ai-graphic-design-skill` + `neonwatty/logo-designer-skill`.
  Consume brand tokens **from pack-brand** when present (brand-compliant
  output); raw generation works without it (graceful, like the greenfield seed).
- [ ] Commands: `/image:create`, `/image:edit`, `/image:variations`,
  `/image:provider`, `/image:logo`. Tier per the command-surface conventions.
- [ ] Rules — adapt, don't duplicate: extend `media-governance-routing` /
  `media-sync-ground-truth` `routes_to` to the new skills; add one **new**
  rule `image-likeness-and-rights` (real faces, trademark, model-license) as
  a child of the media-governance floor.
  <!-- 2026-06-16: the new `image-likeness-and-rights` rule shipped (tier-2a,
  child of the media-governance floor, references the media/*.md policies).
  The media-governance-routing `routes_to` extension to the A.3 skills is pending
  the remaining skills. -->
- [ ] Persona: add `design-director` (composition, art direction, brand-aligned
  visual judgment — serves A and B) within the `persona-governance` cap;
  reuse `ai-video-technical-director` / `hollywood-director` for the
  cinematic crossover.

### A.4 Quality gates

- [ ] ATTRIBUTION for any vendored prompt corpora; per-adapter smoke evidence
  (local-only, gitignored) + lifecycle marker; cost note in each adapter
  header; a provider-registry **freshness** check (prices/models are
  Reference, re-checked on cadence, never frozen). Trigger-evals authored
  (the spec) but *recorded* in Phase D.

**Exit criteria:** `/image:*` runs against the extracted `scripts/media/`
substrate, multi-provider, governed; video adapters still pass parity smoke;
image domain opt-in via `pack-ai-image`.

---

## Phase C — typography & iconography (Reference + style path)

**Operation classification is the whole point** (council-refined). Curated
pairings are **Reference** (curated optical-compatibility data — x-height,
stroke balance, render-tested — not decision logic, with a freshness contract);
the brand archetype → pairing-filter mapping is **Grounding** and lands in
Phase B.1; the full font catalogue is **Reference** (Google Fonts API on
demand). Icons split the same way.

- [x] Reclassify typography: rename `typography.csv` → `font-pairings-reference.csv`
  and move it to the `corpus-grounding` **Reference** layer with a freshness
  contract (re-review when Google Fonts adds families > ~10M downloads). For
  the catalogue (decision 8): don't re-vendor the 745 KB CSV **and** don't rely
  on the live API — pin the MIT `google-font-metadata` mirror or a slim top-N
  slice (usage + pairing coverage + ≥ 10/category) as the deterministic offline
  Reference; the `font-lookup` path reads that, not a live key-gated call.
- [x] New skill `iconography` (Method): resolve a requested icon to a concrete
  **Iconify** name and emit the embedding — CSS class for the Font Awesome /
  web-font path; inline SVG or component for the SVG path — respecting the
  stack (`react-shadcn-ui`, `blade-ui`, `tailwind-engineer` pull from it).
  Default open sets: Lucide / Heroicons / Phosphor / Tabler; brand/provider
  marks via lobe-icons. Add an `icon-system` **Grounding** domain (icon-set ↔
  style/stack/brand fit) to `design-intelligence`'s manifest.
- [x] New skill `typography-system` (Method, stage-1 = **style path**): take a
  style constraint from `design-intelligence`'s existing idiom corpus, query
  `font-pairings-reference.csv`, derive scale/line-height/weights, emit DTCG
  type tokens through `design-tokens`. The brand-aware stage-2 (archetype →
  pairing-filter) is added in Phase B.4 — `typography-system` degrades
  gracefully without a brand layer.
- [x] Rule (adapt): extend `ui-audit-gate` `routes_to` with the new skills. New
  light rule `icon-consistency` (Validation): one icon system per project
  unless the brand defines otherwise (encodes the "every AI UI looks like
  default Lucide" anti-pattern).
- [x] No new pack — these belong in the existing `frontend-design` pack.
  Trigger-evals authored (spec) but recorded in Phase D; icon-system grounding
  rows carry confidence + evidence-gap (ADR-061 §3).

**Exit criteria:** fonts/icons live data is Reference (freshness-checked, never
frozen); `typography-system` emits type tokens via the style path;
`iconography` resolves through Iconify across stacks.

---

## Phase B — brand as first-class UX (`pack-brand` + brand corpus)

Branding is the layer that *constrains* UI, modelled as a **second instance of
the ADR-061 grounding layer** plus the designer workflow: discover → strategy →
identity → system → application → governance.

### B.1 Brand corpus (second corpus-grounding instance)

- [ ] A manifest + CSVs under a new `brand` skill plugged into the **existing**
  `src/skills/corpus-grounding` engine — no forked engine. Domains: brand
  archetypes (the 12), voice-and-tone matrices, naming patterns,
  colour-psychology by industry, logo-style ↔ industry fit, messaging
  frameworks. **Plus** `typography-principles.csv` (archetype → pairing-filter
  Grounding: e.g. `corporate-authoritative → geometric+slab`, with confidence
  + evidence) — the Grounding layer that upgrades Phase C's `typography-system`.
  Source to adopt under the usual gates: the upstream `brand` + `design-system`
  sub-skills already SHA-pinned in `design-intelligence/ATTRIBUTION.md`
  (Apache-2.0; §4b file marking). This is the "adopt on first consumer demand"
  ADR-061 §8 named.

### B.2 Designer workflow → skills

- [ ] `brand-audit` (Method) — brand audit + references (+ `existing-ui-audit`).
- [ ] `brand-strategy` (Grounding) — positioning, voice, tone, archetype,
  messaging over the brand corpus.
- [ ] `brand-identity` (Grounding + Method) — logo, colour story, type story,
  imagery direction. brand-identity **defines** the tokens/constraints;
  pack-ai-image's brand-asset generation skills (decision 1) **generate** the
  marks from them. pack-brand exports tokens → pack-ai-image consumes (B → A).
- [ ] Application stage reuses `fe-design` / `react-shadcn-ui` /
  `design-intelligence` (already ship).

### B.3 Personas, rules, commands, greenfield stubs

- [ ] Persona: add `brand-strategist` (positioning/archetype/voice; challenges
  weak briefs). `design-director` already landed in Phase A and carries the
  art-direction lens. `design-system-lead` deferred (decision 5).
- [ ] Rules — adapt first: extend `domain-safety-disclaimer` `routes_to` with the
  brand skills; `framework-neutrality-in-generic-skills` keeps them
  stack-agnostic. **New `brand-consistency` (Validation) — concrete gate:**
  generated UI/copy/assets are checked against the active brand tokens (from
  `state.ui_design` / the consumer's `.tokens.json`) and the voice profile;
  a value not traceable to a brand token or voice rule is flagged off-brand
  (mirrors design-intelligence's "audit findings outrank corpus"). New light
  `brand-source-of-truth`: consumer brand tokens + voice are the run's source
  of truth; corpus only fills gaps.
- [ ] Commands: `/brand:strategy`, `/brand:identity`, `/brand:tokens` (wraps
  brand→token), `/brand:review` (consistency audit), `/brand:voice`. Wire into
  the UI directive set so `design` consults the brand layer **before**
  `design-intelligence` (brand constrains style selection).
- [ ] **Greenfield interface stubs** (decision 2): publish the brand-token
  consumption contract (how a scaffold step reads `.tokens.json` + voice
  profile) and a `mixed`-set routing hook, documented for the sibling
  `road-to-greenfield-scaffold.md` to consume. No `scaffold.py` here.

### B.4 Brand → token derivation (closes ADR-061 §8) + typography upgrade

- [ ] `brand-to-tokens` (Method): brand decisions → a DTCG `.tokens.json` source
  of truth → `design-tokens/scripts/tokens.py` emits CSS vars + Tailwind. Stay
  on `$value`/`$type` + `.tokens.json` so Tokens Studio (Figma) / Style
  Dictionary round-trip without glue; document Style Dictionary as the
  sanctioned external transform. The same `.tokens.json` is the export that
  pack-ai-image's brand-asset generation (decision 1) and the greenfield
  scaffold seed (sibling roadmap) consume.
- [ ] **Brand deck templates** (decision 7 — slides skipped): pack-brand emits
  validated brand templates (Marp/reveal YAML with locked brand variables) for
  the user's own deck tools. No rendering engine is owned.
- [ ] Upgrade `typography-system` to stage-2: when a brand layer exists, query
  `typography-principles.csv` for the archetype → pairing-filter, then filter
  `font-pairings-reference.csv` and emit brand-aligned type tokens. The
  style-idiom path (Phase C) remains the fallback. Trigger-eval test:
  "law-firm redesign" → must route to serif-containing pairs.

### B.5 Quality gates

- [ ] ATTRIBUTION for the claudekit-derived material (Apache-2.0 §4b marking);
  brand corpus carries confidence + evidence-gap (ADR-061 §3); SHA-pin +
  refresh DoD; `pack-brand` opt-in, `requires: [frontend-design]`.
  Trigger-evals authored (spec); recorded in Phase D.

**Exit criteria:** brand is a standalone opt-in pack; brand→token derivation
emits a DTCG source of truth; the UI `design` step consults brand before style;
`brand-consistency` enforces token/voice provenance on emitted artifacts.

---

## Phase D — trigger-eval substrate (built last, from observed needs)

Now that the skills exist, build the substrate that makes "the skill provably
fires" enforceable — with **domain-specific floors** derived from the actual
trigger patterns of A/B/C, not universal thresholds frozen up front (council).
This closes the ADR-061 verified gap: `design-intelligence`'s manifest has **no
`last_eval`**, and the live eval is manual/out-of-CI by design.

- [ ] Port the legacy Python recorder to the TS CLI (TS-first directive). Add
  `src/cli/commands/recordTriggerEval.ts` exporting
  `runRecordTriggerEval(opts): number` (ESM, `zod`, `logger`), reading the
  `EvalResult` JSON from `skill_trigger_eval.py --output` and patching
  `upstream.last_eval` into a corpus `manifest.json`. Guards: reject non-live
  (`router != "anthropic"`) with exit 2 unless `--allow-mock`; stamp
  `sha_at_eval` from `upstream.sha`; exit 1 (recorded) on floor miss.
- [ ] Encode **domain-specific floors** observed from A/B/C, e.g. `image-generation`
  1.0/0.85, `iconography` 1.0/0.9 (reference task), `brand-strategy` 0.9/0.7
  (judgment task) — tuned to the trigger patterns each skill actually shows,
  not a single global pair.
- [ ] Register `eval:record` in [`src/cli/registry.ts`](../../src/cli/registry.ts)
  (`disposition: native`) and wire the commander subcommand in
  `src/cli/agent-config.ts` (`--eval-json`, `--manifest`, `--min-recall`,
  `--min-precision`, `--allow-mock`, `--dry-run`).
- [ ] Co-located vitest `recordTriggerEval.test.ts` (six paths: pass → 0; mock →
  2; `--allow-mock` → 0; recall < floor → 1; skill/manifest mismatch → 2;
  dry-run writes nothing). `task test --filter recordTriggerEval`. <!-- carve-out: new-gate-verification -->
- [ ] Deterministic CI lint (no token spend), wired to `task ci-fast`: fail if a
  skill ships `evals/triggers.json` but its `manifest.json` lacks
  `upstream.last_eval` **or** `last_eval.sha_at_eval != upstream.sha`. <!-- carve-out: new-gate-verification -->
- [ ] Refresh runbook `docs/guides/frontend-design-corpus-refresh.md` coupling the
  live eval to SHA-bump / description-edit: DoD = no refresh PR merges without
  `upstream.last_eval.passed: true` and `sha_at_eval == upstream.sha`. Step-3
  command is `agent-config eval:record …`.
- [ ] Backfill: run `task test-triggers-live -- <skill>` once per corpus-backed
  skill (`design-intelligence` first, then the A/B/C skills) and `eval:record`
  each result so every description-routed skill is provably firing.

**Exit criteria:** `eval:record` is a green TS command with tests; the
deterministic lint runs in `task ci-fast`; the runbook is the cited DoD; every
shipped corpus-backed skill carries a passing `upstream.last_eval`.

---

## Acceptance criteria (whole roadmap)

- [ ] All new/extended skills pass `task lint-skills` with schema-conformant
  frontmatter (`name`, `description`, `source`, `domain`; no extra fields).
- [ ] Every description-routed new skill has `evals/triggers.json` (5/5) **and**,
  after Phase D, a passing `upstream.last_eval` (where corpus-backed) per the
  Phase D lint.
- [ ] Brand-asset generation rides on Phase A's adapters (no second stack, decision
  1); the `recraft`/LLM-SVG vector path ships; the full font catalogue is not
  re-vendored (pinned slim metadata, decision 8); no forked grounding engine
  (brand reuses `corpus-grounding`).
- [ ] ADR-061 §8/§9 supersession recorded (brand-asset generation adopted; fonts
  pinned-metadata; slide engine skip-with-reasoning) via an ADR amendment.
- [ ] ATTRIBUTION + SHA-pin + refresh DoD present for every adopted corpus.
- [ ] `pack-ai-image` and `pack-brand` opt-in; `minimal` profile unaffected.
- [ ] Greenfield scaffold lives in the sibling `road-to-greenfield-scaffold.md`;
  this roadmap only ships the brand-token + `mixed`-routing interface stubs.
- [ ] Quality pipeline green before archival (per `verify-before-complete`;
  cadence per `roadmap.quality_cadence`).

## Council notes

Council (claude-sonnet-4-5 + gpt-4o, 2026-06-13, 2-round debate, design lens)
converged on: (1) move the eval substrate to the **end** and use
**domain-specific floors** built from observed trigger patterns, not universal
thresholds frozen before the skills exist; (2) **keep** the curated font
pairings but **reclassify** them as Reference (`font-pairings-reference.csv` +
freshness contract) while the brand archetype → pairing-filter mapping is
Grounding in the brand corpus, making `typography-system` a two-stage Method
that degrades gracefully (no live Google Fonts pairing API exists — confirmed
by both members); (3) greenfield scaffold ships as a **sibling roadmap** but
brand-token-consumption + `mixed`-routing **interface stubs** land here so
brand→tokens is not dead output; (4) `brand-consistency` must be a **concrete**
Validation gate (artifacts checked against active brand tokens + voice
profile), not hand-wave. Sequence resolved to A → C → B → D on the real
dependency graph (A independent + provides the logo path B needs; C ships the
Reference table + style path; B adds the brand-principle Grounding that upgrades
C and consumes A's logo path; D last). Persona pair within the
`persona-governance` cap and provider defaults were uncontested.

**Second council — deferred-item merits (claude-sonnet-4-5 + gpt-4o, 2026-06-13,
2-round debate, design lens; web-research-grounded).** The user rejected
ADR-citation-as-settled and asked to examine the gated items on the merits for
the product vision. Converged: (1) **brand-asset generation ADOPTED, overturning
ADR-061 §9** — it rides on the existing adapters, never was a second image-gen
stack; generation in pack-ai-image, governance/tokens in pack-brand (B exports →
A consumes), with a `recraft`/LLM-SVG vector path (decision 1); (2) **slide engine
SKIPPED** with reasoning, overriding the research's adopt-lite — document assembly
≠ brand UX; pack-brand exports validated deck templates instead of owning a render
engine (decision 7); (3) **font catalogue ADOPT-LITE pinned metadata**, overturning
ADR-061 §8's "API-only" — pin `google-font-metadata`/slim top-N for deterministic
offline use (decision 8); (4) **no third track** — fold into A (generation) + B
(governance), no slides/brand-asset megatrack. ADR-061 §8/§9 are superseded by
this merits pass; record the amendment when implementing.

> **Staged assets:** the ready-made `eval:record` TS recorder + the resource/link
> appendix from the source feedback live in
> [`agents/roadmap-assets/road-to-image-brand-typography.assets.md`](../roadmap-assets/road-to-image-brand-typography.assets.md)
> (tracked, consume-then-delete). Phase D ports the recorder (applying the
> domain-specific-floors decision).
