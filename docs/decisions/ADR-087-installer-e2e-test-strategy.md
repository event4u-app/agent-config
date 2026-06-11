---
adr: 087
status: accepted
date: 2026-06-11
decision: installer-e2e-test-strategy
supersedes: —
superseded_by: —
phase: installer-hardening · wizard-apply
type: structural
---

# ADR-087 — Installer e2e test strategy: HTTP-API container e2e now, browser-driven Playwright deferred

## Status

**Accepted** · 2026-06-11. Lands with the fix for the browser-wizard
"Finish writes nothing" bug and the first containerized installer e2e.

## Context

A consumer ran `npx -y @event4u/agent-config@latest init`, clicked through the
browser wizard, saw only a "migration not available" notice, and **nothing was
installed**. The headless CLI form (`init --global --tools=all …`) worked.

Root cause (reproduced): the wizard server spawns
`python3 install.py --apply-payload` with **no `PYTHONPATH`**
(`src/server/routes/wizard.ts`), whereas the bash dispatcher always sets
`PYTHONPATH=$PACKAGE_ROOT/src` (`src/scripts/_dispatch.bash`). For a consumer
that already has a legacy tool dir (`.claude/` — every Claude Code user has
one), the global-scope apply triggers migrate-to-global, whose
`importlib.import_module("scripts._cli.cmd_migrate")` then raised
`ImportError: No module named 'scripts'` → `warn("migrate unavailable")` →
`return 1` → `install_global` never ran → an empty tree. (Fix: `install.py`
self-bootstraps `sys.path` for that import, and the wizard spawn helpers seed
`PYTHONPATH` for parity. Covered by `tests/test_install_wizard_wiring.py` and
`tests/server/wizard.applySse.test.ts`.)

The class of bug — the installer behaving differently depending on the spawn
environment — is invisible to in-process unit tests that inherit the test
runner's `sys.path`/`PYTHONPATH`. It only surfaces in a pristine process with no
host leakage. That argues for a **container** e2e that runs the real installer
end-to-end, including the real wizard HTTP apply path.

The open question was the **wizard test depth**: drive the real SPA in a
headless browser (Playwright, full UX) versus drive the wizard's HTTP API (the
exact routes the SPA calls) inside a container.

## Decision

1. **Ship an HTTP-API-level container e2e now** —
   `tests/fixtures/installer-e2e.Dockerfile` builds a pristine `node:20` +
   `python3` image and `tests/fixtures/installer-e2e/run-scenarios.sh` runs two
   scenarios, asserting a populated tree (`installed.lock` + terminal `done`
   frame) lands on disk:
   - **A.** `install.py --apply-payload` in a clean env (no `PYTHONPATH`,
     legacy `.claude/` present) — the exact field condition.
   - **B.** The real `createApp` wizard server, driven over HTTP via
     `POST /api/v1/wizard/apply` — the exact path that spawns the installer.

   Driven by `tests/test_e2e_container_install.py`, gated opt-in behind
   `AGENT_CONFIG_E2E_DOCKER=1` (`task test-installer-e2e`) so the multi-minute
   image build never runs in the default `task test` suite (and never per
   xdist worker).

2. **Defer browser-driven (Playwright UI) installer e2e** — do not add a
   containerized full-browser walkthrough of the wizard that asserts a real
   install. Document the deferral here; it can be added later.

## Consequences

- The regression that shipped to a consumer is now pinned at three layers:
  Python (`--apply-payload`, no-`PYTHONPATH`), TypeScript (spawn env carries
  `PYTHONPATH`), and a container e2e exercising both the CLI apply and the real
  wizard HTTP apply in a clean process.
- The container test is opt-in: contributors and CI run it deliberately
  (`task test-installer-e2e`), not on every `task test`. The wiring into the
  required CI gate is a follow-up decision, kept out of scope here.
- `.dockerignore` now also excludes `internal/bench` (~145 MB) so the build
  context stays lean.

## Alternatives considered

- **Full browser-driven Playwright installer e2e (rejected for now).**
  `@playwright/test` is already a devDependency and
  `tests/e2e/setup-wizard-9-steps.spec.ts` already drives the wizard's HTTP API
  via `request.newContext()` (no browser binary) — but in dry-run, asserting
  **zero** writes. A real-install browser walkthrough would add: a Chromium
  layer to the image (heavier build), UI-rendering flakiness (selectors,
  timing) on a path whose actual risk surface is the **apply** step, and
  duplicate coverage of the state machine already covered in dry-run. The
  apply/install logic is fully exercised at the HTTP level, which is where the
  bug lived. The cost/benefit favours HTTP-API depth first.
- **Why it can be added later.** The pieces exist: the Playwright config + the
  9-step spec, plus the now-proven `createApp` boot harness
  (`tests/fixtures/installer-e2e/boot-wizard.mjs`). A future browser e2e would
  add a `--with-chromium` image variant and a `*.spec.ts` that walks the SPA to
  "Finish" against a real (non-dry-run) backend, reusing the same write-root
  assertions. Trigger to revisit: a UI-layer regression that the HTTP-API
  e2e cannot catch (e.g. a frontend step that never posts the apply payload).

## References

- `tests/fixtures/installer-e2e.Dockerfile`,
  `tests/fixtures/installer-e2e/run-scenarios.sh`,
  `tests/fixtures/installer-e2e/boot-wizard.mjs`
- `tests/test_e2e_container_install.py` · `task test-installer-e2e`
- `tests/test_install_wizard_wiring.py` (no-`PYTHONPATH` apply regression)
- `tests/server/wizard.applySse.test.ts` (spawn env carries `PYTHONPATH`)
- `src/scripts/install.py::_run_migrate_to_global`,
  `src/server/routes/wizard.ts::installerSpawnEnv`
- `tests/fixtures/hermetic-smoke.Dockerfile` (prior container-test pattern)
