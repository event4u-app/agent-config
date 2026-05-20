# Shared Surface — Setup Wizard ↔ Settings Editor

> Single source of truth for the "wizard and settings editor live in one
> codebase" promise of
> [`agents/roadmaps/unified-setup-and-settings-gui.md`](../../agents/roadmaps/unified-setup-and-settings-gui.md).
> Folded in during Phase 0 of implementation from the
> `frontend-engineer` council finding (line 332 of the roadmap).

## Rule

Every UI component, validator, schema, and API surface in
`src/ui/` and `src/server/` is **one of three** labels:

| Label | Meaning | Drift policy |
|---|---|---|
| `shared` | Used by **both** the wizard and the settings editor, unmodified | Any divergence is a regression |
| `setup-only` | Wizard chrome — meaningless in the settings editor | Settings-page must never import |
| `settings-only` | Advanced fields the wizard hides for first-run brevity | Wizard must never expose |

End of every phase, the implementing agent walks `src/ui/` + `src/server/`
and verifies each new file matches one of the three. Phase review fails
on drift.

## Inventory (Phase 0 baseline)

### Schema + validation

| Module | Label | Notes |
|---|---|---|
| `src/server/schemas/settings.ts` | `shared` | Wizard ⊂ settings — wizard slices, never owns its own schema |
| `src/server/schemas/userMd.ts` | `shared` | Parser convergence locked (gray-matter, ADR-010) |
| `src/server/schemas/wizardState.ts` | `setup-only` | Partial-state-on-disk shape |

### Server routes

| Route | Label |
|---|---|
| `GET/PUT /api/v1/settings` | `shared` |
| `GET /api/v1/settings/diff` | `shared` |
| `GET/PUT /api/v1/user-md` | `shared` |
| `GET /api/v1/user-md/template` | `shared` |
| `GET /api/v1/wizard/state` | `setup-only` |
| `POST /api/v1/wizard/state` | `setup-only` |
| `POST /api/v1/wizard/finish` | `setup-only` |

### IO primitives

| Module | Label |
|---|---|
| `src/server/io/atomicWrite.ts` | `shared` |
| `src/server/io/atomicMultiWrite.ts` | `shared` |
| `src/server/io/substituteTemplate.ts` | `shared` |

### UI form primitives (Phase 2)

| Module | Label |
|---|---|
| `src/ui/forms/Field.tsx` | `shared` |
| `src/ui/forms/TextInput.tsx` | `shared` |
| `src/ui/forms/NumberInput.tsx` | `shared` |
| `src/ui/forms/Toggle.tsx` | `shared` |
| `src/ui/forms/Radio.tsx` | `shared` |
| `src/ui/forms/Textarea.tsx` | `shared` |
| `src/ui/forms/Autocomplete.tsx` | `shared` |
| `src/ui/forms/FieldError.tsx` | `shared` |
| `src/ui/forms/FieldDescription.tsx` | `shared` |
| `src/ui/forms/SchemaForm.tsx` | `shared` |
| `src/ui/copy/errors.ts` | `shared` |

### UI pages (Phase 2)

| Module | Label |
|---|---|
| `src/ui/pages/SettingsPage.tsx` | `settings-only` |
| `src/ui/pages/UserMdPanel.tsx` | `shared` (the wizard's UserMdStep wraps this body editor) |
| `src/ui/pages/DiffModal.tsx` | `shared` |

### UI wizard chrome (Phase 3)

| Module | Label |
|---|---|
| `src/ui/wizard/StepHeader.tsx` | `setup-only` |
| `src/ui/wizard/ProgressBar.tsx` | `setup-only` |
| `src/ui/wizard/StepNav.tsx` | `setup-only` |
| `src/ui/wizard/FinalActions.tsx` | `setup-only` |
| `src/ui/wizard/steps/*.tsx` | `setup-only` (each step composes `shared` form primitives) |
| `src/ui/wizard/WizardPage.tsx` | `setup-only` |

### CLI

| Module | Label |
|---|---|
| `src/cli/commands/uiServe.ts` | `shared` |
| `src/cli/commands/settings.ts` | `settings-only` (initial-route flag only) |

## Audit procedure

End of every UI / server PR, run:

```bash
node scripts/check-shared-surface.mjs  # walks src/ui + src/server, prints unlabeled files
```

If the script is not yet written (it lands in Phase 4 follow-up), the
reviewer audits this table by eye against the diff. Unlabeled new
modules fail review.

## Why this matters

The whole roadmap is justified by reusing one codebase across two
surfaces. Without this table, every PR can quietly diverge — wizard
form fields drift from settings fields, primitives get forked, the
shared-codebase claim erodes. The table is the contract; the audit
is the enforcement.
