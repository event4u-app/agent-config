<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     a design decision, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Decision: where the egress engine's growth goes, given the hook-bundle ceiling

Roadmap `road-to-one-detector-and-the-senders-we-own` keeps one rule table
(`src/scripts/_lib/egress_rules.ts`) and one token grammar (`src/scripts/_lib/egress_token.ts`)
for detecting and replacing credentials and personal identifiers in content bound for a model
provider. Both are statically imported into `dist/hooks/dispatch.js` — the single bundle every
hook event loads on every dispatch — because the dispatcher's egress stage
(`src/scripts/hooks/egress_stage.ts`) uses them. `src/config/hook-bundle-budget.json` caps that
bundle at 1,550,000 B, shrink-only, a raise needing a `raise_log` entry and a ratification record.

## Measured, 2026-10-18, on the branch carrying step 2.2

- Bundle: 1,546,845 B — 3,155 B of headroom; an esbuild rebuild moves the figure by hundreds of bytes.
- Engine bytes in the bundle (esbuild metafile `bytesInOutput`): `egress_rules.ts` 10,201,
  `egress_token.ts` 4,830, `secret_detector.ts` 4,163, `egress_stage.ts` 8,015. Of the table's
  bytes, 1,842 are per-rule `linearity` argument strings plus two shared constants (382 B) that
  no runtime path reads; only tests read them.
- Static importers of the engine inside the bundle: `egress_stage.ts` (detect, rule table, token
  replacement); `ai_council/config.ts` (the table's raw-key prefix list, for the `api_key_ref`
  refusal); `_lib/subagent_capsule.ts` → `secret_detector.ts` (`scanText`).
- The egress stage's default mode is `off`: on every event it reads settings and returns before
  using the engine. `observe`, `protect` and `strict` use it.

## What is queued and what it costs

- Step 2.3, validated identifier rules (IBAN by country length and mod-97, payment card by Luhn
  and a context word, e-mail with exclusions, phone with a country code or context word, German
  tax ID by checksum and context): a prototype measured about 4.3 KB in the bundle.
- Steps 2.4 (known values from env and `.env*`, with bounded decoding), 2.5 (invisible-character
  strip-then-rescan) and 3.2 (variant suffix in the token grammar) each add engine bytes,
  estimated 1–3 KB each.
- Step 1.1, a new `pre_tool_use` blocking concern refusing reads of credential-class files: a
  path classifier with no engine dependency, estimated 3–4 KB.
- Total queued: roughly 12–15 KB against 3 KB of headroom.

## Precedent

On 2026-10-11 a two-provider council refused 2/2 a ceiling raise for the SVG rule set (30,924 B)
and asked for a conditional chunk instead. That is now `src/scripts/hooks/svg_rules_loader.ts`:
`build:hook-chunks` emits `dist/hooks/svg_rules.chunk.cjs` beside the bundle with a digest
sidecar, and the loader pulls it synchronously through `createRequire` only when needed,
verifies the digest, and returns `null` (never throws) on any failure.

## Options

A. **Ratified ceiling raise** sized to the queued work (for example 1,550,000 → 1,565,000), one
   `raise_log` entry naming each addition.

B. **Move the `linearity` prose out of the bundled module** into a sibling module keyed by rule
   id that only tests import (frees about 2.2 KB), keeping the per-rule linearity contract as a
   test that every row has an argument. Does not by itself cover the queued work.

C. **Conditional egress-engine chunk**, following the SVG precedent: emit
   `egress_engine.chunk.cjs` (table, token grammar, commit-scanner rows) and load it only when
   the stage's mode is not `off`, or when another bundled caller needs detection. Removes about
   19 KB from the bundle now and puts every queued engine addition in the chunk. Open points:
   the two other static importers (`ai_council/config.ts`'s prefix list, `subagent_capsule`'s
   `scanText`) must stop being static edges or keep a small static view; and the failure mode
   must be stated per mode — the SVG loader returns `null`, but an egress stage in `strict`
   whose engine cannot load should arguably refuse rather than pass content through unscanned.

D. **B now, C later**: B plus fitting step 1.1 into the freed bytes, deferring 2.3+ until C lands.

Which option, and under what conditions? If C, say how the stage must behave in each mode when
the chunk is missing or fails its digest, and whether the two other importers may keep a static
detection-only view. Name the single highest-leverage condition on whichever you choose.
