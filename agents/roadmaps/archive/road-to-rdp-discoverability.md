---
complexity: lightweight
status: ready
parent_roadmap: road-to-frontier-grade-reasoning
---

# Roadmap: RDP discoverability — settings docs, user contract, surfacing

The Reasoning Discipline Protocol (RDP) is architecturally complete: the
`reasoning:` block exists in `src/config/agent-settings.template.yml` and the
`settings.ts` schema, the `rdp-gate` context defines the table-free cost gate,
and the `frontier-reasoning-operating-profile.md` dossier holds the sourced
rationale. The remaining gap is **discoverability**, not function — a user who
did not read the dossier cannot find the feature or learn how to turn it off.

Spawned from the GPT thread of `agents/tmp/fable-feedback-2.txt` (2026-06-14),
fact-checked against HEAD: the `reasoning.*` rows are confirmed **absent** from
the customization "Available settings" table, and no concise user-facing RDP doc
exists (only the internal design dossier). The feedback's "heavy/light
contradiction" claim did **not** verify — live docs already state "no heavy/light
variants" consistently — so it is downgraded to a confirm-only step (Phase 3).

## Goal

Make RDP findable and self-serviceable for a user who never reads the design
dossier: the settings are listed where users look, a one-screen contract explains
what RDP does / when it fires / how to switch it off / why it is not a Fable copy,
and the setting is confirmed visible in the GUI — without re-opening any
benchmark or kernel-promotion question (those live in the sibling roadmaps).

## Phase 1 — Settings discoverability

- [x] Add `reasoning.enabled`, `reasoning.auto_gate`, and the
      `reasoning.components.*` switches to the **Available settings** table in
      `docs/customization.md` (currently absent), each with default + one-line
      description, matching the existing `personal.*` / `ai_council.*` row style.
- [x] Add a short prose block under the table pointing at the user contract
      (Phase 2) and the dossier for rationale — so the table row has a "learn
      more / turn off" path, not just a name.

## Phase 2 — User-facing RDP contract

- [x] Author `docs/contracts/reasoning-discipline-protocol.md` — concise,
      user-facing (NOT a copy of the design dossier):
      - **What RDP does** — transplants operating discipline (notes-first,
        complexity-first, verifier, orchestrator), never capability.
      - **When it engages** — the three table-free signals (settings · task signal
        · host self-assessment); skips trivial tasks; light on strong hosts.
      - **How to turn it off** — `reasoning.enabled: false` (whole layer inert),
        per-component switches, `auto_gate: false`.
      - **Why it is not a Fable/Mythos copy** — "capability does not transfer,
        discipline does"; link the dossier and `rdp-gate` for depth.
- [x] Cross-link: dossier → contract (user entry point), contract → dossier
      (rationale), and the `reasoning:` template comment → contract. Keep the
      one-screen budget; depth stays in the dossier.

## Phase 3 — Surfacing confirmations (verify-only)

- [x] Confirm the GUI surfaces the `reasoning.*` settings now that schema +
      template carry them. If the settings UI hardcodes categories/order and
      `reasoning` is hidden, file the minimal wiring fix; if it is schema-driven
      and already shows, record that and close.
      <!-- verified 2026-06-16: SHOWS (schema-driven). src/server/schemas/settings.ts:189-225
      defines reasoning{enabled,auto_gate,components.*} with .describe() on every field;
      the settings UI is fully schema-driven (settings route serves zodToJsonSchema →
      src/ui/pages/SettingsPage.tsx → src/ui/forms/SchemaForm.tsx via flattenSchema in
      schemaTypes.ts:99-113, which inlines depth-3 components.* as fields). No hardcoded
      category list anywhere → the "Reasoning" section with all 11 fields renders
      automatically. No wiring fix needed. -->
- [x] Confirm no stale "tier-1/2 heavy vs tier-3/4 light" content-variant language
      survives in live (non-archived) docs/skills/rules — the gate's "one
      constraint-light scaffold, no heavy variant" (L1) is the current contract.
      Grep was clean at authoring time; this is a confirm + fix-if-found, not a
      sweep.
      <!-- verified 2026-06-16: grep over live src + docs for heavy/light variant
      language found only the two contract-affirming negations ("never ship heavy/light
      content variants" in rdp-gate.md; "no heavy/light content variants" in the dossier).
      No doc advertises tier-banded heavy vs light variants. Clean, no fix. -->

## Acceptance criteria

- `reasoning.*` settings appear in the `docs/customization.md` Available-settings
  table with defaults + descriptions.
- `docs/contracts/reasoning-discipline-protocol.md` exists, is one-screen, <!-- ref-ignore -->
  user-facing, and cross-linked both ways with the dossier; `check-refs` passes.
- GUI visibility of `reasoning.*` is confirmed (shown, or wiring fix filed).
- No live (non-archive) doc still advertises heavy/light RDP content variants.
- No benchmark or kernel-promotion scope leaks in — those stay in
  `road-to-discipline-axis-meso-pilot` and `road-to-rdp-eval-and-promotion`.
