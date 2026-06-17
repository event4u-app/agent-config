---
type: "auto"
tier: "2a"
description: "Rights gate for AI image generation — real-person likenesses, trademarked brand marks, and named living artists' styles require explicit rights/consent check before generation."
triggers:
  - keyword: "/image:"
  - keyword: "image generation"
  - keyword: "generate an image"
  - keyword: "logo"
  - keyword: "likeness"
  - keyword: "trademark"
  - keyword: "brand mark"
  - path_prefix: "scripts/ai-image/adapters/"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Image Likeness and Rights

## The Iron Law

```
NEVER GENERATE A REAL PERSON'S LIKENESS, A TRADEMARKED BRAND MARK,
OR A NAMED LIVING ARTIST'S STYLE WITHOUT EXPLICIT RIGHTS/CONSENT.
SURFACE THE RIGHTS QUESTION. REFUSE-AND-SURFACE OVER GENERATE.
```

## What this gates

| Trigger | Gate |
|---|---|
| Real person's face / body (celebrity, public figure, private individual) | Likeness consent required — route to `media/likeness.md` + `media/public-figures.md` |
| Trademarked logo, brand mark, or product identity of a third party | Trademark clearance required — refuse without explicit rights |
| Named living artist's distinctive style (e.g. "in the style of [name]") | Style license check — route to `media/style.md` |
| AI model license restrictions (training data, output restrictions) | Check model card; surface if output license is restricted |

## Compose — do NOT duplicate

These policies carry the full decision framework; this rule surfaces them
and stops the job until checked:

- `agents/settings/policies/media/likeness.md` — real-person visual likeness.
- `agents/settings/policies/media/public-figures.md` — recognised public figures.
- `agents/settings/policies/media/style.md` — named living artist style.
- `agents/settings/policies/media/brand-impersonation.md` — brand / broadcaster identity.
- `agents/settings/policies/media/disclosure.md` — mandatory AI-generation disclosure.

## Failure modes

- Generating a logo "inspired by [Brand]" without clearance — likely
  infringing, even when the model doesn't reproduce exactly.
- "Just testing" a celebrity likeness on a scaffold-tier adapter — dry-run or not,
  the prompt itself can create harm if persisted.
- Skipping the rights check because "it's only a banner" — brand marks
  in banners are still trademark territory.

## See also

- [`media-governance-routing`](media-governance-routing.md) — parent routing rule loading all media policies.
- [`provider-lifecycle-discipline`](provider-lifecycle-discipline.md) — adapter-tier gate for live generation.
- [`image-provider-routing`](../skills/image-provider-routing/SKILL.md) — provider selection before prompt authoring.
