# Setup wizard

> Browser-based first-run flow that writes `.agent-settings.yml` and
> (optionally) `.agent-user.md`. Calls `commitMulti` (2PC + intent
> marker) for atomic write. The wizard is the **only** first-run
> surface — the legacy `/onboard` chat skill was retired in the
> wizard takeover (see
> [`agents/roadmaps/onboarding-wizard-takeover.md`](../agents/roadmaps/onboarding-wizard-takeover.md)).

## Launching

```bash
agent-config setup        # alias of `ui:serve --open --initial-route /wizard`
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
| 3 | Cost profile | `rule_loading_tier` (minimal · balanced · full) |
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

`scripts/install.py` acts as a supervisor at the tail of a successful
install: it evaluates a gate (TTY, `CI`, `--no-ui`,
`AGENT_CONFIG_NO_UI`), then spawns `node <pkg>/.../cli.js gui
--project-root <root>` and waits for the child's
`WIZARD_READY url=<http://127.0.0.1:PORT/>` handshake on stdout
(strict regex
`^WIZARD_READY url=(http://(?:127\.0\.0\.1|localhost):\d+/)\r?$`).
On match, the parent prints a banner and blocks on the child until
the user closes the tab or sends Ctrl-C.

Progressive readiness backoff: `10s → 20s → 40s → 80s` (cumulative
budget 150s) — generous enough for cold-start `node_modules`
extraction on slow disks. On timeout the parent kills the child,
prints the last 20 stderr lines, and exits 0 — the install itself
is unaffected.

Suppress the auto-launch with `--no-ui`, `AGENT_CONFIG_NO_UI=1`, or
by running in CI (`CI=1`). Preview the gate verdict without
installing anything via `python3 scripts/install.py --dry-run`,
which prints a plan summary and exits 0 with zero filesystem
writes.

Skill: [`agents/roadmaps/archive/wizard-install-py-wiring.md`](../agents/roadmaps/archive/wizard-install-py-wiring.md)
(archived after ship).

## Accessibility

- Every form control has a `<label>` and an `aria-describedby`
  pointer to its help text.
- The Next button is `disabled` until the current step's schema
  slice validates — no silent "click does nothing" states.
- The progress bar is a native `<progress max="7" value="N">`.
- Focus management on step transitions: the new step's `<h2>`
  receives `tabIndex={-1}` and `.focus()` so screen readers
  announce the new heading.

## Headless / CI / no-browser

When the wizard cannot or should not open — CI runs, SSH sessions
without X forwarding, headless servers, automated provisioning —
take the flag path instead. Three equivalent ways to suppress the
GUI: pass `--no-ui` to `npx … init`, export `AGENT_CONFIG_NO_UI=1`
in the environment, or run inside a `CI=1` context (auto-detected).
With the GUI suppressed, pass profile + pack on the command line —
`npx -y @event4u/agent-config init --no-ui --profile=developer
--pack=engineering-base` — or hand-edit `.agent-settings.yml`
directly. Preview the gate verdict and the planned writes with
`python3 scripts/install.py --dry-run` (zero filesystem writes,
exits 0). Settings can still be hand-edited at any time; the GUI
is opt-in, not required.

## Disabling the GUI

Set `AGENT_CONFIG_NO_UI=1` in the environment to skip every
GUI-launching code path. Settings can still be hand-edited.

## Tests

- `tests/ui/WizardPage.flow.test.tsx` — full step-by-step click
  flow + `POST /finish` assertion
- `tests/ui/WizardPage.resume.test.tsx` — server-state resume +
  clamp of out-of-range step
- `tests/server/dryRun.test.ts` — verifies the `--dry-run` mode
  suppresses every disk write

## Contracts

- [`docs/contracts/settings-api.md`](contracts/settings-api.md) —
  HTTP shape for every wizard / settings route
- [`docs/contracts/settings-gui-agent-mode.schema.json`](contracts/settings-gui-agent-mode.schema.json) —
  JSON-Schema for the agent-mode JSON output
