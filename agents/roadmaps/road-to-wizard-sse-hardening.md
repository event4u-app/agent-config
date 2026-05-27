---
complexity: lightweight
---

# Roadmap: Wizard SSE hardening — edge-case test coverage, severity-phased

> The `road-to-single-install-source-of-truth` work made the browser wizard install for real: the Finish step calls the installer with `dry_run: false` and streams NDJSON back to the SPA as Server-Sent Events. The happy path and the WIZARD_READY handshake are covered; the **failure** paths are not. This roadmap closes the verified test gap — no `*wizard*sse*` / abort-on-disconnect / malformed-NDJSON / no-terminal-frame test exists today. Council (claude-sonnet-4-5 + gpt-4o, 2026-05-27, analysis lens) flagged that the four missing cases are **not equal severity** and must be phased: a leaked child process and an unguarded CSRF path are P0; stream-robustness polish is P2.

## Context

- **Surface under test.** SSE install stream + dual-mode endpoint live in `src/server/routes/wizard.ts` and `src/server/routes/install.ts`; the SPA consumer is `src/ui/api.ts`. TS tests are vitest, co-located as `*.test.ts` (precedent: `src/server/writeRoot.test.ts`).
- **Why now.** The feature shipped and is the primary install path for non-terminal users; an orphaned `install.py` child or an unauthenticated apply is a production-grade defect, not a polish item.
- **Source honesty.** The originating external feedback (round 13) reconstructed repo state by scraping and was wrong on several points (it claimed `recruit-sessions/` was empty; it was not). The SSE-test gap is the one claim that **verified true** against the tree, which is why it earns a roadmap and the rest of that round did not.
- **Gates.** `engineering-safety-floor` (CSRF/abort touch the request-handling boundary), `verify-before-complete` (every new test runs green once locally before the step is closed), `roadmap-progress-sync` (checkbox + dashboard same response).

## Phase 1: P0 — resource-leak + security paths

The two cases with real production blast radius. Ship before Phase 2.

- [ ] **Step 1:** Test — **abort-on-disconnect kills the child.** Simulate a client that drops the SSE connection mid-stream; assert the spawned installer process receives `SIGTERM` (no orphaned `install.py`). Cite `Finding #24` (the council finding the abort handler was built for) in the test docstring so the regression intent is traceable.
- [ ] **Step 2:** Test — **CSRF rejection on the apply endpoint.** Assert a POST to the real-install (`dry_run: false`) endpoint without a valid CSRF token is rejected before any installer process spawns. This is the security floor for the loopback GUI substrate.
- [ ] **Step 3:** Exit gate — both tests run green locally (`vitest` on the touched files), and a deliberate revert of the abort handler / CSRF guard turns each test red (proves the test actually pins the behaviour, not the happy path).

## Phase 2: P2 — stream-robustness polish

UX-grade resilience. Lower blast radius; ship after Phase 1.

- [ ] **Step 1:** Test — **malformed NDJSON does not break the stream.** Inject a malformed line into the installer's NDJSON output; assert the SSE connection survives and surfaces a structured error frame rather than tearing down.
- [ ] **Step 2:** Test — **no-terminal-frame emits a synthetic done.** Installer exits 0 without emitting a `done` frame; assert the `sawTerminal` guard fires a synthetic terminal frame so the SPA does not hang waiting.
- [ ] **Step 3:** Exit gate — both tests green locally; the SSE handler's error-frame and `sawTerminal` branches are covered.

## Acceptance criteria

- [ ] Phase 1: abort-on-disconnect and CSRF-rejection tests shipped and green; each verified to fail when its guard is reverted.
- [ ] Phase 2: malformed-NDJSON and no-terminal-frame tests shipped and green.
- [ ] No regression in the existing wizard/install vitest suite; `task ci` green on the PR.

## Notes

- **Roadmap plans work, not a release.** No version, tag, or commit step is implied here; release shape is decided per turn per `commit-policy`.
- **Phasing is the point.** Phase 1 is independently shippable and is the part that matters; Phase 2 can wait or be dropped if the maintainer judges the stream-robustness risk acceptable.
- **Cross-reference.** Sibling of the archived `road-to-single-install-source-of-truth` (the feature this hardens). No dependency on the other two feedback-derived roadmaps (`road-to-distribution-identity`, `road-to-abstraction-budget-discovery`).
