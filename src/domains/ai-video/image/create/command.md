---
model_tier: high
name: image-create
pack: ai-video
visibility: internal
cluster: image
sub: create
description: Generate a character image to spec — assemble a max-fidelity, anchors-first prompt from a Canon Spec; governance- and provider-gated, dry-run by default.
argument-hint: "<character-id> <scene> [analyse-diff]"
personas: [hollywood-director]
skills: [image-creator, character-consistency]
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /image:create

Run the [`image-creator`](../../skills/image-creator/SKILL.md) skill. Args:
`<character-id>` (required) `"<scene>"` (setting + pose). Optional: a prior
`/image:analyse` diff to fold in (loop mode).

## Steps

1. **Governance gate FIRST** — real-person likeness → route through
   [`media-governance-routing`](../rules/media-governance-routing.md) +
   `agents/settings/policies/media/` before emitting anything.
2. **Provider gate** — read the resolved provider's tier; non-stable
   (experimental/deprecated/community) → surface the tier and **ask** before
   any live call (per
   [`provider-lifecycle-discipline`](../rules/provider-lifecycle-discipline.md)).
   `AIV_DRYRUN=true` is the default.
3. **Assemble the prompt, anchors first** — load the Canon Spec; front-load the
   hard-to-render `identity_anchors` (heterochromia, hair-split), then physique,
   face + marks, per-location tattoos (exact `text`), outfit, jewelry; add the
   asymmetry block + negative block + engine settings.
4. **Generate** through the existing adapter layer (`scripts/ai-video/adapters/`)
   only on explicit confirmation. **Verify** the output with `/image:verify`.

## Output

1. Generation prompt — anchors · positive · asymmetry · negative · engine settings.
2. Provider + tier line (the audit entry).
3. The `/image:verify` call to run on the result.

## Rules

- **Do NOT commit, push, or open a PR.**
- **No live provider call without explicit per-turn confirmation** + a stable (or confirmed non-stable) provider.
- **Never claim "canon-perfect"** without an `image-analyser` verify pass (per `verify-before-complete`).
