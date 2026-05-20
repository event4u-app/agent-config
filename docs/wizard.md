# Setup wizard

> Browser-based first-run flow that writes `.agent-settings.yml` and
> (optionally) `.agent-user.md`. Same write path as the `/onboard`
> chat skill — both call `commitMulti` (2PC + intent marker). The
> wizard is the canonical surface; `/onboard` is a thin chat client.

## Launching

```bash
agent-config ui:serve --open
```

Starts a Fastify server on a free `127.0.0.1` port, mints a bearer
token, and opens the browser at `/#/wizard`. The server stays bound
to loopback — the wizard never accepts off-host requests.

To skip the wizard and jump straight to the settings editor:

```bash
agent-config settings
```

Both commands share the same SPA and the same backend; the URL hash
selects which surface renders.

## The seven steps

| # | Title | What it asks |
|---|---|---|
| 1 | Identity | `personal.user_name`, `personal.ide` |
| 2 | Personality | `personal.minimal_output`, `personal.play_by_play`, `personal.open_edited_files` |
| 3 | Cost profile | `cost_profile` (minimal · balanced · full) |
| 4 | Roadmap quality | `roadmap.quality_floor`, `roadmap.run_tests_inline` |
| 5 | Memory | `memory.enabled`, MCP server presence |
| 6 | `.agent-user.md` | Optional long-form persona / preferences |
| 7 | Review | Read-only diff of every change, plus a `Finish` button |

Each step posts its partial state to `POST /api/v1/wizard/state` on
transition, so closing the browser mid-flight is safe — re-opening
`/#/wizard` resumes from the last persisted step.

## Resume behaviour

`GET /api/v1/wizard/state` returns the persisted step index and
partial values. The wizard mounts on that step and seeds the form
with the persisted answers. If the file does not exist, the wizard
starts at step 1 with the on-disk `.agent-settings.yml` values as
seed.

The server clamps an out-of-range step index into
`[0, WIZARD_TOTAL_STEPS - 1]` to survive partial schema migrations.

## Skip behaviour

Closing the browser before reaching step 7 writes **nothing**. The
wizard's intent marker is only created at the start of `Finish`; an
abandoned session leaves disk untouched. To force the template
defaults onto disk without answering questions, run:

```bash
agent-config settings --apply-defaults
```

## Finish — the 2PC dance

On `Finish`:

1. Wizard mints `txnId = uuid()`.
2. Writes `.agent-settings.yml.tmp-<txnId>` and (if changed)
   `.agent-user.md.tmp-<txnId>`.
3. Writes the intent marker `.agent-config/commit-intent-<txnId>`.
4. Renames both files into place.
5. Deletes the intent marker.

If the server crashes between steps 3 and 5, the next boot replays
the rename idempotently. See
[`docs/architecture/setup-vs-settings-shared-surface.md`](architecture/setup-vs-settings-shared-surface.md)
for the full failure-mode matrix.

## Auto-launch from `npx … init`

Tracked under
[`agents/roadmaps/wizard-install-py-wiring.md`](../agents/roadmaps/wizard-install-py-wiring.md)
(carved out from the parent roadmap). Until that ships, run
`agent-config ui:serve --open` manually after `npx … init`.

## Accessibility

- Every form control has a `<label>` and an `aria-describedby`
  pointer to its help text.
- The Next button is `disabled` until the current step's schema
  slice validates — no silent "click does nothing" states.
- The progress bar is a native `<progress max="7" value="N">`.
- Focus management on step transitions: the new step's `<h2>`
  receives `tabIndex={-1}` and `.focus()` so screen readers
  announce the new heading.

## Disabling the GUI

Set `AGENT_CONFIG_NO_UI=1` in the environment to skip every
GUI-launching code path. The chat-based `/onboard` skill remains
available; settings can still be hand-edited.

## Tests

- `tests/ui/WizardPage.flow.test.tsx` — full step-by-step click
  flow + `POST /finish` assertion
- `tests/ui/WizardPage.resume.test.tsx` — server-state resume +
  clamp of out-of-range step
- `tests/server/onboardFinish_parity.test.ts` — byte-identical
  output across the chat and wizard surfaces

## Contracts

- [`docs/contracts/settings-api.md`](contracts/settings-api.md) —
  HTTP shape for every wizard / settings route
- [`docs/contracts/onboard-skill-wizard-bridge.md`](contracts/onboard-skill-wizard-bridge.md) —
  how the chat skill calls the same write path
- [`docs/contracts/settings-gui-agent-mode.schema.json`](contracts/settings-gui-agent-mode.schema.json) —
  JSON-Schema for the agent-mode JSON output
