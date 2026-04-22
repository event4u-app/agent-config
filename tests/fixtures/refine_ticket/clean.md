# PROJ-100 — Extract profile avatar cropping into a reusable Vue component

## Description

The avatar cropper inside the user settings page is written inline and
cannot be reused on the organisation-settings page. Extract it into a
standalone component `AvatarCropper.vue` that accepts `src` and emits
`cropped`.

## Acceptance criteria

- [ ] `AvatarCropper.vue` lives under `resources/js/components/`
- [ ] Props: `src: string`, `aspect-ratio: number` (default 1)
- [ ] Emits: `cropped(blob: Blob)`
- [ ] Existing usage in user-settings refactored to the new component
- [ ] Unit test covers the crop-and-emit path

## Out of scope

- Backend persistence of the cropped image — already works and is unchanged
- Organisation-settings page rollout — follow-up ticket
