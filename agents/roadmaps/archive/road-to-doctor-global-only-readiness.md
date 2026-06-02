---
status: ready
complexity: lightweight
parent_roadmap: road-to-self-update-and-global-hook-resolution
---

# Road to `doctor` Global-Only Readiness

> Make `agent-config doctor` usable in an ADR-020 global-only consumer repo.
> Today it hard-bails on a missing project lockfile before any check runs —
> including the global-scoped checks that need no lockfile — so a global-only
> consumer onboarded via `refresh --project` can never get a green (or even
> informative) `doctor` report.

## Goal

A global-only consumer (bridge marker present, no `agents/installed-tools.lock`)
can run `agent-config doctor` and `agent-config doctor --check global-binary`
and get a meaningful report on the global binary, version drift, and bridge
state — instead of a single "no project lockfile → run init" bail.

## Context

Surfaced as **finding 2** during Phase 5 e2e validation of
[`road-to-self-update-and-global-hook-resolution.md`](road-to-self-update-and-global-hook-resolution.md)
(2026-06-02), validated against the real consumer `agent-ide-plugin`.

Root cause: `scripts/_cli/cmd_doctor.py` (~line 1373) reads the lockfile via
`installed_tools.read_manifest(...)` and, when it is `None`, prints
`❌ doctor: no project lockfile … run \`./agent-config init\`` and `return 2`
**before** dispatching any check — even when the caller asked for a
single global-scoped check via `--check global-binary` / `--check bridge-drift`,
neither of which needs a project lockfile.

Under ADR-020 global-only, consumers legitimately have **no**
`installed-tools.lock` (that lockfile tracks project-local *distributed* tools,
which global-only consumers do not have). `refresh --project` writes the bridge
marker + overrides + gitignore but no lockfile; only `init` writes one. So the
`doctor`-green sub-points of Phase 5 steps 1 & 3 of the parent roadmap are not
satisfiable via the aggregate command, even though every underlying condition
(binary on PATH, no version drift, bridge present, plugin installed) holds and
was verified directly.

Not fixed in the parent PR by design: the parent's load-bearing promise
(dashboard auto-regen in a global-only consumer) was a different subsystem and
was fixed + validated there; folding a second subsystem fix in would have
violated minimal-safe-diff (AI council, claude-sonnet-4-5 + gpt-4o, 2026-06-02,
flagged the scope-creep risk explicitly).

## Phase 1 — Run lockfile-independent checks without a lockfile

- [x] Classify each `doctor` check by scope: **global** (`global-binary`,
      `bridge-drift`, `mcp-mode`, `offline-readiness`, `python-runtime`,
      `council-cli`, … — need no project lockfile) vs **project-manifest**
      (`manifest-integrity`, `lockfile-freshness`, `scope`, … — need the
      lockfile). Encode the split next to the existing `--check` id registry.
      <!-- done: GLOBAL_CHECK_IDS + MANIFEST_REQUIRED_CHECK_IDS frozensets added next to CHECK_IDS in cmd_doctor.py. Council-endorsed reclassification: `scope` → global (reads only project_root); `bridge-drift` kept scope-aware (not in either set), not project-manifest, per the SRP point. -->
- [x] In `cmd_doctor.py`, when the manifest is `None`: instead of an
      unconditional `return 2`, run the **global** checks (and any explicitly
      requested global `--check ID`), and only report the missing lockfile as a
      **project-manifest** finding (downgraded to a clear note, not a hard bail)
      when a project-manifest check was requested or a full report was asked
      for. A bare `doctor` in a bridge-present repo should report bridge +
      global state, not just the lockfile error.
      <!-- done: main() no-manifest branch delegates to _run_no_manifest(). Global checks run; manifest-required checks report `skipped` (explicit, machine-readable — stable --json shape); bridge-drift gets the scope-aware no-manifest verdict via _check_bridge_drift_no_manifest (kept out of the pure roll-up per council SRP). Exit codes: 0 global-only bare / 1 runnable --check fail / 2 unrunnable --check or uninitialised bare. Smoke-verified A–F. -->
- [x] When a bridge marker is present but no lockfile, treat the repo as a
      recognised global-only consumer in the report header (not "run init") —
      point at `refresh --project` for the consumer surface, reserve the `init`
      hint for repos with neither bridge nor lockfile.
      <!-- done: bridge-present header reads "global-only consumer: bridge marker present … (expected under ADR-020)" with no init nag; the init/refresh hint is reserved for the neither-bridge-nor-lockfile (uninitialised) case, emitted to stderr with rc 2. -->
- [x] Verify: `doctor --check global-binary` and `doctor --check bridge-drift`
      return a real verdict (exit 0/green) in a fixture global-only consumer
      with a bridge marker and no lockfile; a full `doctor` reports bridge +
      global state plus a non-fatal lockfile note. Add the fixture + tests.
      <!-- carve-out: new-gate-verification -->
      <!-- done: tests/test_doctor_global_only.py (13 tests) — scope-split partition, bridge-drift scope-aware verdict, skipped-check shape, bare green-capable report, header-no-init-nag, --check exit-code contract (global→0, manifest-required→2), uninitialised→2+stderr note, stable --json checks array. 57/57 doctor tests green (incl. backward-compat test_missing_lockfile_returns_2). -->

## Decisions (AI council, claude-sonnet-4-5 + gpt-4o, design lens, 2026-06-02)

Both members converged. Adopted:

- **Classification-first, not per-check special-casing.** `_check_bridge_drift`
  stays a pure manifest-derived roll-up; the no-manifest verdict lives in
  `_check_bridge_drift_no_manifest`, selected by `main()`. Encoded as
  `GLOBAL_CHECK_IDS` + `MANIFEST_REQUIRED_CHECK_IDS` frozensets; `bridge-drift`
  is scope-aware (in neither set); `scope` reclassified to global (it reads only
  `project_root`, contradicting the step-1 prose — code reality wins).
- **Explicit exit-code contract:** `0` global-only bare report / passing global
  `--check`; `1` a runnable `--check` failed; `2` an unrunnable `--check`
  (manifest-required with no lockfile) or a bare report in an uninitialised repo
  (preserves the old "run init" signal without the pre-check hard bail).
- **Stable `--json` shape:** skipped manifest-required checks are explicit
  `status: "skipped"` entries with a machine-readable reason — never omitted/null.

Deferred as out-of-scope for this lightweight fix (recorded so they are not lost;
candidates for a follow-up if demand appears): HMAC-signed bridge-marker integrity,
dynamic runtime check-suite selection, concurrency lock for parallel `doctor`
runs, full bridge-marker schema-versioning strategy, and incomplete-`refresh`
transaction-state detection. None are required to make `doctor` runnable without
a lockfile; folding them in would breach minimal-safe-diff.

Exit criteria: in a bridge-present, lockfile-absent consumer, `doctor` and
`doctor --check global-binary` give an informative, green-capable report; the
parent roadmap's Phase 5 steps 1 & 3 `doctor`-green sub-points become literally
satisfiable.

Rollback: the change is additive (a branch before the existing bail); revert to
restore the unconditional lockfile-required behaviour.

## Acceptance criteria

- `agent-config doctor --check global-binary` exits 0 with a real verdict in a
  global-only consumer (bridge present, no lockfile).
- Bare `agent-config doctor` in such a repo reports bridge + global state and a
  non-fatal lockfile note, not a hard `return 2`.
- Project-manifest checks still require the lockfile and still direct the user
  to create one — but via the consumer-appropriate path.
- New fixture + tests cover the global-only `doctor` path.
