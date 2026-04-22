# Reference estimate output — clean, single-file ticket (Size: S)

> Input: tests/fixtures/refine_ticket/clean.md (AvatarCropper extraction)

```markdown
## Estimate

- **Size:** S
- **Risk:** Low
- **Split:** No
- **Uncertainty:** High-confidence

## Sizing rationale

- **Surface area** — One new file (`AvatarCropper.vue`) + one refactored
  caller in user-settings. No cross-layer changes.
- **Unknowns** — Zero. Component contract is fully specified
  (`src: string`, `aspect-ratio: number`, emits `cropped(blob: Blob)`).
- **Coordination** — None. Backend upload logic explicitly out of scope.
- **Testing cost** — One unit test covering the crop-and-emit path.

## Persona voices (sizing-focused)

- **Developer** — Implementation is small; Vue component with clear
  props/emits contract.
- **Senior Engineer** — Blast radius is a single page; refactor risk is
  minimal since the inline version works today.
- **Product Owner** — Value is incremental (unlocks org-settings reuse);
  deliverable in one slice.
- **Stakeholder** — Fits any sprint; no external dependency.
- **Critical Challenger** — Estimate might be optimistic if the existing
  inline crop logic has undocumented edge cases — add a regression test
  first.
- **AI Agent** — Fully automatable: scaffold component → move template
  → write test → update caller.
```

## Close-prompt shown

```
> Next action for this estimate:
>
> 1. Comment on Jira — I'll post the estimate as a comment
> 2. Set story points — I'll set the Story Points field (S=2)
> 3. Nothing — I'll handle it myself / take it to planning
```
