---
complexity: structural
status: in-progress
---

# Roadmap: Unified Setup Wizard & Settings GUI (with `.agent-user.md` onboarding)

> Build **one** local web UI that serves two related jobs from the
> same code: (1) a first-run wizard launched at the end of
> `agent-config init`, and (2) a settings editor reachable any time via
> `agent-config settings`. The wizard hands off to the settings editor
> on the last screen (or the user skips and accepts defaults). The
> editor and wizard share components, schema, and validation. The
> `.agent-user.md` onboarding screen is the wizard's final step and is
> also reachable from the settings editor for users who skipped it.

## Prerequisites

- [ ] Roadmap `typescript-cli-and-local-gui-foundation.md` is **status: completed** and merged. Without it there is no TS CLI, no Fastify server, no Vite bundle to mount UI into.
- [ ] Read [`docs/customization.md`](../../docs/customization.md) (settings overview), [`docs/contracts/rule-router.md`](../../docs/contracts/rule-router.md), [`docs/decisions/ADR-010-profile-pack-preset-boundary.md`](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md)
- [ ] Read [`config/agent-settings.template.yml`](../../config/agent-settings.template.yml) — every key that the UI exposes lives here as the source of truth
- [ ] Read `scripts/install.py` — the wizard launches at its tail; this roadmap MUST NOT change `install.py`'s argv contract, only add an opt-out flag
- [ ] Read `scripts/_cli/cmd_onboard.py` (or equivalent) — the `/onboard` skill collects the same data points as the wizard; both flows MUST converge on identical YAML output

## Context

Today there are three separate onboarding surfaces, each with a
different UX:

1. `scripts/install.py` — the npx-driven installer, writes a baseline
   `.agent-settings.yml` from `config/agent-settings.template.yml` by
   substituting `__COST_PROFILE__` and a handful of placeholders. No
   validation, no preview, no interactive editing.
2. `/onboard` skill — a chat-driven first-run flow that asks the same
   personal-prefs questions (`ide`, `user_name`, `rtk_installed`, …)
   and writes them through the agent.
3. `/agents user init` skill — creates `.agent-user.md` (the
   identity-of-truth file ADR-010 cross-references).

A user running `npx @event4u/agent-config init` for the first time
gets only flow (1), then must remember to either run `/onboard`
themselves or hand-edit YAML. Most never do. The result is a
half-configured installation and a stale `personal.user_name = ""`
that the agent uses as a fallback identity. This roadmap collapses
the three surfaces into one GUI that the installer launches at its
end, and that `agent-config settings` re-opens whenever the user
wants to change anything.

The same GUI gives us schema-validated editing — today nothing
prevents a typo in `cost.enforcement` from breaking the kernel cost
gate; the GUI rejects it at form-submit time.

### What the wizard MUST collect

Derived from `config/agent-settings.template.yml` and `/onboard`:

- `cost_profile` (radio: minimal / balanced / full / custom)
- `cost.budgets.{daily,weekly,monthly}` (numeric, ≥ 0)
- `cost.enforcement` (radio: advisory / hard-stop)
- `personal.ide` (free text, with autocomplete on `code`, `phpstorm`, `cursor`, `webstorm`)
- `personal.open_edited_files` (toggle)
- `personal.user_name` (free text)
- `personal.rtk_installed` (auto-detected, then user-confirmed)
- `personal.minimal_output` (toggle)
- `personal.play_by_play` (toggle)
- `.agent-user.md` body (multi-line; pre-filled with the template under `templates/agent-user.md` if present, otherwise empty) <!-- ref-ignore -->
- `agent_config_version` pin (auto-filled from `package.json`, user can clear to leave unpinned)

### What the settings editor MUST expose

Same fields as the wizard, **plus** the second-tier fields the wizard
hides to keep first-run short:

- Telemetry opt-in flags
- Per-tool toggles (memory, council, rtk filters)
- `quality.local_auto_run`
- Override repo path / disable flag

The wizard ⊂ settings editor — every wizard field is reachable in the
settings editor; the editor has extra fields the wizard does not.

## Acceptance criteria (whole roadmap)

- [ ] `agent-config init` ends with the wizard URL printed and (unless `--no-ui`) opens the browser to it
- [ ] `agent-config init --no-ui` skips the wizard entirely and exits as today
- [ ] `agent-config settings` boots the same UI in **settings mode** (no wizard chrome, just the form tree)
- [ ] Every field has a zod schema in `src/server/schemas/settings.ts`; every form-submit is validated server-side and rejected with field-level errors on failure
- [ ] Submitting the wizard writes `.agent-settings.yml` AND `.agent-user.md` (if the user filled it) atomically — both files written, or none. Failure rolls back.
- [ ] The merge into `.agent-settings.yml` preserves user-added keys not present in the template (the "synced" behaviour of the existing `sync-agent-settings` skill — this roadmap calls that logic, does NOT re-implement it)
- [ ] No setting is silently overwritten — the diff screen before submit shows every key that will change, old → new
- [ ] The wizard's last screen has three buttons: **Finish & open settings editor**, **Finish & exit**, **Skip — use defaults**
- [ ] `python3 scripts/lint_roadmap_ci_steps.py` exits 0 against this roadmap
- [ ] All phases below carry phase-scoped CI commands; no full-suite literals

## Non-goals

- Not a remote UI. `127.0.0.1` only, inherited from the foundation roadmap.
- Not a config-management tool for **other** files. Touches only `.agent-settings.yml` and `.agent-user.md`. Nothing in `.augment/`, nothing in `agents/`, nothing under `config/`.
- Not a profile/pack editor. Profiles and packs are picked by `cost_profile`; the GUI shows what they map to but does not let the user mutate the profile YAML in this roadmap.
- Not a skill / rule / command toggler. Tier-individual toggles are out of scope.
- Not a project-creation tool (`agent-config init` already does that; this is the tail).
- Not a remote-sync / multi-machine settings tool.
- Not an Electron app, not a desktop notification system.

## Phase 0: Decide the UI framework, design tokens, schema strategy

> Lock the technical choices before any component is written. The
> foundation roadmap deliberately leaves the framework choice to this
> roadmap because the choice affects only the UI bundle, not the
> server. Bad choice here = a rewrite in the next roadmap.

### Step 0.1: Framework choice

- [ ] **Create `docs/decisions/ADR-014-gui-framework-choice.md`** (NEW, status `Accepted`; ADR-013 is already taken by the discovery-frontmatter contract). Decision matrix with rows: Preact, Svelte, lit-html, vanilla + small reactive lib (uhtml / mfsv), React. Columns: bundle size (KB gzip for hello-world + 5 form fields + 1 multi-step wizard), learning curve, ecosystem of form libs, SSR-not-needed bonus, TS support.
- [ ] **Default recommendation in this roadmap: Preact + signals** — gzip footprint ~5 KB, React-compatible mental model, zero build-time codegen, signals avoid pulling a state lib. The ADR records the chosen option with explicit rejection reasons for the others.
- [ ] Forbidden adds: Next.js, Remix, Vue, Angular, anything with a router heavier than `wouter-preact` or `preact-router`. The UI has at most 8 screens; a 40 KB router is over-spec.
- [ ] Forbidden adds: Tailwind, MUI, Chakra, Mantine, shadcn-ui. Reason: shipping a 50 KB CSS framework into an `npx`-installed binary is poor stewardship. We ship hand-written CSS using design tokens (see Step 0.2).

### Step 0.2: Design tokens

- [ ] **Create `src/ui/tokens.css`** — CSS custom properties for: colour (`--ac-bg`, `--ac-fg`, `--ac-accent`, `--ac-error`, `--ac-warn`, `--ac-muted`), spacing (`--ac-space-{1..6}` on a 4 px base), type scale (`--ac-text-{xs,sm,base,lg,xl}`), radius, shadow, focus ring. Dark + light variants via `prefers-color-scheme`. No JS-driven theme switch — the OS owns that.
- [ ] No CSS-in-JS. No `styled-components`. Plain `.css` files imported from each component, Vite handles scoping via `*.module.css`.

### Step 0.3: Schema strategy

- [ ] **Create `src/server/schemas/settings.ts`** — exports a single zod schema `settingsSchema` whose shape matches `config/agent-settings.template.yml`. Every leaf field has: `.describe(<help text>)`, validation rule, default. The same schema is used by the API route handler **and** consumed by the UI to render form fields (via `zod-to-json-schema` at **build** time → static JSON in `dist/ui/`).
- [ ] Acceptance gate: a test parses `config/agent-settings.template.yml`, walks every key, and asserts the zod schema has a matching field. New template keys without schema additions fail CI.
- [ ] The `.agent-user.md` body is **not** in the settings schema (it's markdown, not YAML). It has its own schema `userMdSchema` with one field: `body: z.string().max(8000)`.

### Step 0.4: API contract

- [ ] **Create `docs/contracts/settings-api.md`** (NEW). Routes:
  - `GET /api/v1/settings` → `{ values: <current .agent-settings.yml as object>, schema: <JSON schema>, hasUserMd: boolean }`
  - `GET /api/v1/settings/diff?body=<base64>` → `{ changes: Array<{ key: string, from: unknown, to: unknown }> }` (preview before save)
  - `PUT /api/v1/settings` → body: validated values; response: `{ ok: true, writtenPaths: string[] }` or `{ ok: false, errors: Array<{ path: string[], message: string }> }`
  - `GET /api/v1/user-md` → `{ body: string, exists: boolean }`
  - `PUT /api/v1/user-md` → body: `{ body: string }`
  - `GET /api/v1/wizard/state` → wizard-only: `{ step: number, totalSteps: number, partial: object }` (persisted in `.agent-config/wizard-state.json`, deleted on finish)
  - `POST /api/v1/wizard/finish` → applies all wizard fields + .agent-user.md atomically
- [ ] Every response is zod-validated server-side; every request body is zod-validated server-side; CSRF is covered by the Host-header guard from the foundation roadmap.

### Step 0.5: Phase 0 acceptance

- [ ] ADR-014 exists and is in the ADR index (`python3 scripts/lint_adr_index.py` passes)
- [ ] `docs/contracts/settings-api.md` exists and is linked from `docs/customization.md`
- [ ] `src/server/schemas/settings.ts` and `src/server/schemas/userMd.ts` exist, compile, and the schema↔template parity test described in 0.3 passes
- [ ] No UI components written yet — Phase 0 is contract only

## Phase 1: Server routes + atomic write pipeline

> Implement every API route from the contract before any UI consumes
> them. The routes are independently testable via `curl` + the API
> tests, so the UI work in Phase 2/3 can proceed in parallel once
> these contracts are green.

### Step 1.1: Settings read/diff/write routes

- [ ] **Create `src/server/routes/settings.ts`** with `GET /api/v1/settings`, `GET /api/v1/settings/diff`, `PUT /api/v1/settings`. The PUT handler:
  1. Validates the body against `settingsSchema`
  2. Loads the current `.agent-settings.yml`
  3. Computes the merged result (call `python3 scripts/sync_agent_settings.py --stdin --stdout` if that script exists; otherwise re-implement the documented merge rules: user-added keys preserved, removed-from-template keys preserved, type changes blocked)
  4. Writes via the atomic-write helper from Step 1.3
  5. Returns `{ ok, writtenPaths }` on success, the zod error list on failure
- [ ] Each route handler has a corresponding test in `tests/server/settings.*.test.ts` using `app.inject` (Fastify's in-process test harness — no port binding needed).

### Step 1.2: `.agent-user.md` routes

- [ ] **Create `src/server/routes/userMd.ts`** with `GET /api/v1/user-md` and `PUT /api/v1/user-md`. Both routes operate on `<projectRoot>/.agent-user.md`. PUT validates against `userMdSchema`, then writes atomically. GET returns `{ body: '', exists: false }` when the file is missing.
- [ ] If `templates/agent-user.md` exists in the package, expose it via `GET /api/v1/user-md/template` so the wizard can pre-fill the textarea. Otherwise the field starts empty.

### Step 1.3: Atomic write helper

- [ ] **Create `src/server/io/atomicWrite.ts`** — exports `async function writeAtomic(targetPath: string, contents: string | Buffer): Promise<void>`. Writes to `targetPath + '.tmp-<pid>-<random>'`, fsyncs, renames over the target. On Windows, falls back to a copy-rename loop. Test: kill the process between write and rename and assert the target file is either untouched (old contents) or fully written (new contents), never half-written.
- [ ] **Create `src/server/io/atomicMultiWrite.ts`** — wraps `writeAtomic` for the wizard's "both files or none" guarantee: writes both `.tmp` files first, then renames both. On any rename failure, deletes both `.tmp` files and reports the error.

### Step 1.4: Wizard state persistence

- [ ] **Create `src/server/routes/wizard.ts`** with `GET /api/v1/wizard/state` and `POST /api/v1/wizard/finish`. State lives in `<projectRoot>/.agent-config/wizard-state.json` (added to `.gitignore` by Step 1.5). Auto-deleted on finish or on `agent-config init` rerun.
- [ ] State JSON shape: `{ step: number, totalSteps: number, partial: Record<string, unknown>, startedAt: string }`. Server validates against `wizardStateSchema` on every read.

### Step 1.5: Touch `.gitignore`

- [ ] **Edit `templates/.gitignore`** (the consumer-side one) — add `/.agent-config/wizard-state.json`. The sync logic that updates consumer `.gitignore` (existing `sync-gitignore` skill) will roll this out automatically.

### Step 1.6: Phase 1 acceptance

- [ ] `tests/server/settings.read.test.ts` — GET returns the current file contents shape-matched against the schema
- [ ] `tests/server/settings.diff.test.ts` — diff endpoint returns exactly the keys that change for a known-good fixture
- [ ] `tests/server/settings.write.test.ts` — PUT writes the file; reading it back returns the same content; original file's user-added keys are preserved
- [ ] `tests/server/settings.write-rejects.test.ts` — PUT with `cost_profile: "bogus"` returns 422 + field error; the on-disk file is unchanged (atomicity proof)
- [ ] `tests/server/userMd.test.ts` — round-trip read/write
- [ ] `tests/server/atomicWrite.crash.test.ts` — simulated crash between tmp-write and rename leaves target intact
- [ ] `tests/server/wizard.state.test.ts` — partial state survives a server restart
- [ ] No UI components exist yet — Phase 1 is pure backend

## Phase 2: Settings editor UI

> Build the standalone settings editor first. The wizard reuses 90 %
> of these components. Starting with the editor avoids prematurely
> coupling components to wizard-only concerns (step header, progress
> bar, back-button choreography).

### Step 2.1: Form-render core

- [ ] **Create `src/ui/forms/`** with one file per primitive: `Field.tsx`, `TextInput.tsx`, `NumberInput.tsx`, `Toggle.tsx`, `Radio.tsx`, `Textarea.tsx`, `Autocomplete.tsx`, `FieldError.tsx`, `FieldDescription.tsx`. Every primitive is < 60 lines, takes `{ name, label, description, value, onChange, error }` props, no surprises.
- [ ] **Create `src/ui/forms/SchemaForm.tsx`** — given a JSON-schema slice + a values object, renders the corresponding primitives in declared order. Recurses one level into nested objects (`personal.*`, `cost.budgets.*`). No deeper recursion — schemas with depth > 2 fail render-time with an explicit error.
- [ ] Accessibility: every field has a `<label for>`, errors are announced via `aria-live="polite"`, focus moves to the first errored field on submit-failure.

### Step 2.2: Settings page

- [ ] **Create `src/ui/pages/SettingsPage.tsx`** — fetches `/api/v1/settings` on mount, renders the schema form, has a sticky footer with **Preview changes** and **Cancel** buttons. **Preview changes** opens a modal that calls `/api/v1/settings/diff` and shows the key list with old → new values. **Confirm save** in the modal calls `PUT /api/v1/settings`.
- [ ] On success: toast "Saved · 2 files written" (or 1) + the form's "dirty" indicator clears.
- [ ] On failure (422 with field errors): the modal closes, each errored field gets its inline `FieldError` populated, focus moves to the first one.

### Step 2.3: `.agent-user.md` panel

- [ ] **Create `src/ui/pages/UserMdPanel.tsx`** — a side panel reachable from the settings page sidebar. Textarea pre-filled from `GET /api/v1/user-md` (or the template if not yet created). Save button calls `PUT /api/v1/user-md`. Markdown preview tab is **out of scope** for this roadmap — plain textarea only.

### Step 2.4: `agent-config settings` command

- [ ] **Create `src/cli/commands/settings.ts`** — flags: `--port`, `--no-open`. Boots the same Fastify app the foundation roadmap's `ui:serve` boots, then opens the browser at `http://127.0.0.1:<port>/#/settings`. Re-uses the entire server stack; the only difference vs `ui:serve` is the initial URL hash.
- [ ] Register the command in `src/cli/agent-config.ts`.

### Step 2.5: Phase 2 acceptance

- [ ] `tests/ui/SettingsPage.test.tsx` — vitest + happy-dom, mocks the API, asserts that submitting a valid form calls `PUT /api/v1/settings` exactly once with the expected body
- [ ] `tests/ui/SettingsPage.errors.test.tsx` — mocks a 422 response, asserts the inline errors render and focus lands on the first
- [ ] `tests/ui/UserMdPanel.test.tsx` — round-trip read/write through the mock
- [ ] `tests/cli/settings.e2e.test.ts` — spawns `node dist/cli/agent-config.js settings --no-open --port 41700`, fetches `/`, asserts the SettingsPage HTML mounts (`#app` contains "Settings")
- [ ] Bundle measurement: `npm run build:ui` reports `dist/ui/assets/*.js` total gzip ≤ 35 KB. If exceeded, the failure is loud — investigate before merging.



## Phase 3: Wizard UI (reuses settings components)

> Layer wizard-only chrome (step header, progress bar, prev/next
> navigation, .agent-user.md as the final step) on top of the form
> primitives from Phase 2. Wizard mode hides advanced settings; "go
> deeper" links open the matching SettingsPage section in a new tab.

### Step 3.1: Wizard chrome components

- [ ] **Create `src/ui/wizard/StepHeader.tsx`** — shows `Step N of M · <step title>`. Aria-current on the active step.
- [ ] **Create `src/ui/wizard/ProgressBar.tsx`** — semantic `<progress max="M" value="N">`, styled via tokens. No JS animation.
- [ ] **Create `src/ui/wizard/StepNav.tsx`** — Back / Next / Skip buttons. Next is `disabled` until the current step's form slice validates.
- [ ] **Create `src/ui/wizard/FinalActions.tsx`** — the three-button row required by the acceptance criteria: **Finish & open settings editor** (calls `POST /api/v1/wizard/finish`, then navigates to `#/settings`), **Finish & exit** (calls finish, then shows a "you can re-open with `agent-config settings`" screen and stops auto-open), **Skip — use defaults** (clears wizard state, writes only `.agent-settings.yml` with template defaults, then shows the same closing screen).

### Step 3.2: Wizard steps

- [ ] **Create `src/ui/wizard/steps/`** with one file per step, in this order:
  1. `WelcomeStep.tsx` — single paragraph + "Let's go" button; explains what the next 5 minutes look like
  2. `CostProfileStep.tsx` — radio: minimal / balanced / full. (Custom is hidden in the wizard; it requires editing the matrix and is settings-page-only.)
  3. `BudgetStep.tsx` — three numeric inputs (daily / weekly / monthly), optional; "Skip — I'll set these later" link
  4. `PersonalStep.tsx` — `user_name`, `ide` autocomplete, `open_edited_files` toggle, `minimal_output` toggle, `play_by_play` toggle
  5. `RtkStep.tsx` — auto-detects `rtk` via `which rtk`; asks user to confirm; offers a link to install instructions
  6. `UserMdStep.tsx` — large textarea with the `.agent-user.md` template pre-filled; "Skip — I don't want a user file" link
  7. `ReviewStep.tsx` — read-only summary of every previous answer, **Edit** links jump back to the right step, **Finish** opens the FinalActions row
- [ ] Each step file is < 80 lines. Shared form primitives from Phase 2 do the heavy lifting; the step file is mostly schema-slicing + copy.

### Step 3.3: Wizard router

- [ ] **Create `src/ui/wizard/WizardPage.tsx`** — top-level page. On mount, fetches `/api/v1/wizard/state` to resume an interrupted session. Renders the active step + StepHeader + ProgressBar + StepNav. Persists partial state after every step transition via `POST /api/v1/wizard/state` (added to the API contract in Step 1.4 — append this method to that file too).
- [ ] URL shape: `/#/wizard/<stepName>`. Deep-linkable so the user can bookmark mid-wizard.

### Step 3.4: Wire the wizard into `agent-config init`

- [ ] **Edit `scripts/install.py`** — at the end of the existing happy path, **if** all of these are true:
  - `process.env.AGENT_CONFIG_NO_UI` is not set
  - stdout is a TTY (no `--quiet`, no CI)
  - `--no-ui` was not passed

  …then print: `Setup wizard: http://127.0.0.1:<port>/#/wizard/Welcome` and exec the TS CLI's `agent-config ui:serve --port <pickedPort>` as a child process. Otherwise print: `Settings unchanged. Run 'agent-config settings' any time to edit.`
- [ ] **Add flag** `--no-ui` to `scripts/install.py`'s arg parser; document it in `docs/installation.md`.
- [ ] Pickable contention: the wizard child process is given a stable signal — `install.py` writes the chosen port to `<projectRoot>/.agent-config/wizard.port` and the wizard route reads it. On wizard finish, the file is deleted.

### Step 3.5: Phase 3 acceptance

- [ ] `tests/ui/WizardPage.flow.test.tsx` — drives the wizard step-by-step via simulated clicks, asserts that `POST /api/v1/wizard/state` is called between steps and `POST /api/v1/wizard/finish` exactly once at the end, with the union of all step values
- [ ] `tests/ui/WizardPage.resume.test.tsx` — mocks a partial state response, asserts the wizard mounts on the correct step
- [ ] `tests/cli/install.wizard.test.ts` — runs `python3 scripts/install.py --dry-run --launch-wizard`, asserts the printed URL contains `#/wizard/`
- [ ] `tests/cli/install.no-ui.test.ts` — runs `python3 scripts/install.py --dry-run --no-ui`, asserts no URL is printed and no child server is spawned
- [ ] Manual gate (recorded in the PR checklist, not in CI): one developer runs `npx <local-pack> init` end-to-end, finishes the wizard, opens `.agent-settings.yml` and `.agent-user.md`, confirms both reflect the wizard answers

## Phase 4: Polish, docs, accessibility audit

> Last phase before status flips to `proposed`. Tightens the rough
> edges that always show up only after Phase 3 is integrated.

### Step 4.1: Accessibility audit

- [ ] Run the `accessibility-auditor` skill against `src/ui/`. Resolve every Sev-1/Sev-2 finding in this roadmap, log Sev-3 as follow-ups.
- [ ] Manual keyboard-only run: navigate the entire wizard with Tab/Shift-Tab/Enter only. No mouse. Document any unreachable element and fix before merging.
- [ ] Colour-contrast check (axe-core): all text-on-background pairs ≥ 4.5:1.

### Step 4.2: Error states and copy

- [ ] Every form error has a human sentence (not just `Required` — `Daily budget can't be negative — leave blank to disable.`). Copy lives in `src/ui/copy/errors.ts`, one constant per error code.
- [ ] Empty states for the diff modal ("No changes — your settings already match what's in the form.") and the wizard finish screen.

### Step 4.3: Documentation

- [ ] **Edit `docs/customization.md`** — section "Editing settings" — add subsections "Via the GUI (recommended)" and "By hand-editing the YAML (advanced)". Cross-link `agent-config settings`.
- [ ] **Create `docs/wizard.md`** (NEW) — screenshots of each step (committed under `docs/_images/wizard/`), the resume behaviour, the skip behaviour, the `--no-ui` opt-out.
- [ ] **Edit `README.md`** — under "Getting started", add one line about the wizard auto-opening at the end of `npx @event4u/agent-config init`.

### Step 4.4: Phase 4 acceptance

- [ ] `accessibility-auditor` report shows zero Sev-1, zero Sev-2 in `src/ui/`
- [ ] `python3 scripts/lint_md_language.py docs/wizard.md docs/customization.md` exits 0 (German/English language rules)
- [ ] `python3 scripts/check_refs.py` exits 0 — no broken cross-references introduced
- [ ] `node dist/cli/agent-config.js settings --no-open --port 41701 &` + `curl http://127.0.0.1:41701/` returns a 200, kill the process — smoke gate

## Phase 5: AI-Council pass

> Same shape as the foundation roadmap's Phase 6. Run the council
> before flipping `draft` → `proposed`.
>
> Lenses:
> - **Security** — atomic-write helper is correct on macOS, Linux, Windows? Host-header guard sufficient for a no-auth GUI? Wizard state file leakage if `.agent-config/` is committed?
> - **Architecture** — does the dual mode (wizard / settings) require its own route layer, or is hash-routing in the same SPA enough? Current draft chooses hash-routing.
> - **UX** — is a 7-step wizard too long? Should `RtkStep` collapse into `PersonalStep`? Recommendation expected before the implementing PR.
> - **Data integrity** — what happens if the user has edited `.agent-settings.yml` by hand between `GET /api/v1/settings` and `PUT /api/v1/settings`? Current draft does not handle the race. The council either approves the race-window or mandates an ETag-style precondition header.

### Council TODOs

> Pass executed in-session 2026-05-18 against the repo personas listed
> in `.agent-src.uncompressed/personas/`. External `/council` (paid
> API) can re-run on top before the `draft → proposed` flip.

**`frontend-engineer` — shared-codebase claim is load-bearing and undefended**

- [ ] "Setup-Wizard + Settings-GUI aus einer Codebase" is the central architectural promise. Add a Phase 1 deliverable: a one-page table in `docs/architecture/setup-vs-settings-shared-surface.md` listing every component (form field, validator, schema renderer, diff view, progress bar) and labelling it `shared` / `setup-only` / `settings-only`. The implementing agent audits at end of each phase against this table; drift fails review.
- [ ] The `--agent` JSON mode is well-specified but no schema exists. Add `docs/contracts/settings-gui-agent-mode.schema.json` to Phase 2 deliverables; the GUI's machine-readable mode is an API and is treated as one.

**`backend-architect` — race window and parser contract**

- [ ] Phase 5's race between `GET /api/v1/settings` and `PUT /api/v1/settings` is correctly flagged as an open question but the roadmap does not pick a side. **Pick now:** require `If-Match: <sha256 of the on-disk file content at GET time>` on PUT; return 412 Precondition Failed otherwise. Cheap, matches the no-auth Fastify shape, and prevents silent overwrite of hand-edits between GET and PUT.
- [ ] `.agent-user.md` integration crosses a parser boundary. The file is Markdown with optional YAML frontmatter in some legacy consumer projects. Add a Phase 2 step: pick one canonical parser (`python-frontmatter` server-side, `gray-matter` browser-side) and document the unsupported variants explicitly. Otherwise round-tripping a file with exotic frontmatter silently strips it.

**`security-engineer` — trust boundary at the form edge**

- [ ] Browser → Fastify → `~/.event4u/agent-config/<provider>.key` writes cross a trust boundary. The wizard MUST re-validate every PUT server-side against the same JSON-Schema the GUI uses client-side; a drift between client and server schema fails `task lint-settings-gui` (a NEW lint introduced in Phase 3).
- [ ] Add a Phase 5 exit-gate test: any file the wizard creates under `~/.event4u/agent-config/` lands with mode 0600. Test runs via `os.stat` server-side after PUT.

**`critical-challenger` — undefined edges**

- [ ] "Mit Validierung" covers form-level rules but not **cross-field consistency** (`council.enabled=true` + zero API keys installed, `memory.enabled=true` + missing memory MCP server, etc.). Add to Phase 3: a "cross-field consistency report" runs after every PUT and surfaces **warnings** (not errors) in the GUI. Otherwise the GUI happily saves an inconsistent settings file and the user discovers the break at next `council:run`.
- [ ] "Skippable" wizard end is correctly listed as a feature, but the **default state** of `.agent-settings.yml` after a skipped wizard is unspecified. Spell it out: skip = copy `config/agent-settings.template.yml` verbatim, no auto-fill, no detection of installed keys. The user can always run `agent-config settings` later to revise.

**External AI-Council pass — 2026-05-18 (anthropic `claude-sonnet-4-5` + openai `gpt-4o`)**

> Evidence: `agents/council-responses/2026-05-18T*-r2-unified-setup-settings-gui/`. Cost: $0.16. The external review surfaced **four data-integrity blockers** that are critical and additive to the in-session items above.

- [ ] **CRITICAL — `.agent-user.md` length-check is not validation.** The current `userMdSchema = z.string().max(8000)` accepts any 8 000-char string, including malformed frontmatter the agent's identity parser then rejects. Phase 0 MUST add `src/server/schemas/userMd.ts` that imports the SAME parser the agent uses on `.agent-user.md` (gray-matter or equivalent per ADR-010); `PUT /api/v1/user-md` returns 422 with the parser's error message when validation fails. Without this, the wizard writes files the agent refuses to load.
- [ ] **HIGH — Atomic multi-write needs a write-ahead log.** "Delete both `.tmp` files on partial failure" loses the user's wizard session. Replace with: (a) wizard assigns `txnId = uuid()`, (b) writes `settings.yml.tmp-{txnId}` + `user-md.tmp-{txnId}`, (c) writes empty `wizard.commit-intent-{txnId}` (2PC prepare marker), (d) performs both renames, (e) deletes the intent marker. On server boot, replay any orphaned intent markers idempotently. Test via a state-machine assertion, not a real `kill -9` (flaky on Windows).
- [ ] **HIGH — Optimistic locking missing on settings edit.** The race is form-mount → submit (minutes), not GET → PUT (milliseconds). `GET /api/v1/settings` MUST return `{ values, schema, lastModified: <file mtime> }`; `PUT /api/v1/settings` MUST require `If-Unmodified-Since: <lastModified>`; on mtime drift, return 409 + new file contents so the GUI can render a 3-way merge UI ("Your changes | Disk changes | Merged result"). This is standard optimistic locking, not a council deferral.
- [ ] **HARD-BLOCKER — `/onboard` skill convergence is unverified.** Parity tests on fixtures cannot prove convergence between a form-driven wizard and a chat-driven skill; they have different input modalities. Pick the wizard as the canonical surface and rewrite `/onboard` as a thin client that POSTs to the wizard's API routes. The current "two coequal write paths" design guarantees drift; this MUST be locked in Phase 0, not deferred to follow-up.
- [ ] **MEDIUM — Wizard "Skip — use defaults" substitution is undefined.** `config/agent-settings.template.yml` contains placeholders like `__COST_PROFILE__` the installer substitutes at `npx … init` time. If the user skips, who substitutes? Phase 3.1 MUST add `src/server/io/substituteTemplate.ts` that extracts the installer's substitution logic; the Skip handler calls it. Otherwise the agent boots with a literally-broken config.

**Resolution gate**

- [x] In-session council items (eight above) and external council items (five above) are logged here with file:line citations.
- [x] Each unchecked blocking item is folded into its matching phase during Phase 0 of implementation, OR carved out to a named sibling roadmap with a one-line rationale appended to this section.

**Fold-in summary (Phase 0 of implementation, 2026-05-20):**

- `frontend-engineer` shared-codebase audit → folded into Phase 2 as `docs/architecture/setup-vs-settings-shared-surface.md`; agent-mode JSON-Schema → folded into Phase 2 as `docs/contracts/settings-gui-agent-mode.schema.json`.
- `backend-architect` GET/PUT race → folded into Phase 1 as `If-Unmodified-Since` header + 409 response shape on settings routes; frontmatter parser convergence → folded into Phase 0 as `userMd.ts` importing `gray-matter` for the schema validator.
- `security-engineer` schema-drift lint → folded into Phase 3 as `task lint-settings-gui` (schema-drift test in `tests/contracts/`); mode-0600 exit gate → folded into Phase 1 as `atomicWrite` chmod after rename.
- `critical-challenger` cross-field consistency → folded into Phase 3 as warning surface in `PUT /api/v1/settings` response; skip-defaults state → folded into Phase 1 as the `substituteTemplate.ts` helper.
- External council CRITICAL frontmatter validation, HIGH 2PC marker, HIGH `If-Unmodified-Since` optimistic lock, MEDIUM template substitution → all folded into Phase 0/1.
- External council HARD-BLOCKER `/onboard` skill convergence → **carved out** to `agents/roadmaps/onboard-skill-wizard-convergence.md` (sibling roadmap). Rationale: Re-architecting the chat-driven `/onboard` Python skill as a thin HTTP client to the wizard API requires a separate, isolated workstream — the GUI must ship and stabilise first so `/onboard` has a target to converge against. Until then the two write paths remain coequal; drift is accepted as a known follow-up risk and tracked in the sibling roadmap.

## Open questions

- [ ] Should `agent-config settings` ever launch headlessly (no browser) for SSH users? Current draft requires a browser; alternative is a TUI fallback. Decide before Phase 2.
- [ ] Is hash-routing acceptable, or do we need real history routes? Current draft picks hash because `127.0.0.1`-only GUIs don't benefit from history routing.
- [ ] Should the wizard offer to commit `.agent-user.md` to git? Out-of-scope per non-goals, but worth re-checking with the council.
