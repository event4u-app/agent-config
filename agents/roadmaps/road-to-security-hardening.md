---
complexity: lightweight
status: ready
---

# Roadmap: Security hardening — consumer/CI/git-enforcement layer

**Trigger:** Source-E competitive-harvest (2026-06-15). A code-audited external
agent-harness reference (**Source-E**, link in § Provenance) ships a
consumer-facing security layer AC lacks: a disclosure policy, a CI workflow
security validator, and a deterministic git-discipline enforcement hook. AC
ships 20+ GitHub workflows and a public npm package and is currently
**accidentally** safe, not **enforced** safe.

## Goal

Close the three genuine consumer/CI/git-enforcement security gaps the deep-dive
surfaced, in AC-native shapes (file-first, CI linter, deterministic hook). This
is the **first** roadmap of the Source-E harvest set because it is a hard dependency
for mission-mode: you cannot define a mission's trust boundaries without first
documenting AC's attack surface and enforcing the git-discipline floor missions
will run against (council, 2026-06-15).

> **Scope boundary.** This is **distinct** from the archived
> `road-to-security-pillar` (which covered our-own-artifact supply-chain
> integrity + injection-aware authoring). That roadmap protected the corpus AC
> *ships*; this one protects the repo's **CI/release/git** surface and gives
> consumers a disclosure contract. No overlap — verified against the archive.

---

## Phase 1 — Threat model + disclosure contract

The policy layer the rest of the set depends on. Authoring-only, no runtime.

- [ ] Write `docs/threat-model.md` documenting AC's attack surface + mitigations:
      (a) malicious skill/rule contribution (mitigation: PR review +
      `lint_agent_security`); (b) supply-chain compromise of AC's own deps
      (lockfiles + documented update policy); (c) hostile repo environment
      (existing `.git/hooks`, malicious `.env`); (d) the lethal-trifecta surface
      already governed by `lethal-trifecta-guard`. Each row: surface → current
      control → gap → mitigation.
- [ ] Write `SECURITY.md` (repo root) — vulnerability disclosure policy, a
      trust-boundary statement, supported-version response posture, and a
      contact path. Link it from README + AGENTS.md.
- [ ] Cross-link `docs/threat-model.md` from `security-audit` /
      `threat-modeling` skills and the `security-sensitive-stop` rule (see-also
      only; no behavior change to those artifacts).

## Phase 2 — Workflow-security CI linter

- [ ] New `src/scripts/lint_workflow_security.py` scanning `.github/workflows/*`
      for the high-risk patterns: `pull_request_target` / `workflow_run` with an
      untrusted checkout, `permissions: write-all`, and dependency install
      without `--ignore-scripts` where the workflow runs untrusted PR code.
- [ ] WARN-first with a documented promotion path (mirror the
      `lint-skill-originality` warn-only-then-strict pattern); existing
      workflows are grandfathered, new/changed steps are checked.
- [ ] `tests/test_lint_workflow_security.py` — a fixture workflow with each
      risky pattern asserts a finding; a clean workflow passes.
- [ ] Wire `lint-workflow-security` into `taskfiles/ci-fast.yml` + the `ci` /
      `ci-strict` orchestrators.

## Phase 3 — `block-no-verify` git-discipline hook

Turns the `git-history-discipline` Iron Law from prose into a deterministic gate
(ADAPT of Source-E's `scripts/hooks/block-no-verify.js`).

- [ ] Add a PreToolUse-style guard (Python, consistent with
      `context_hygiene_hook.py`) that exit-blocks `git … --no-verify` and
      `git -c core.hooksPath=…` overrides, with a clear bypass message. Tokenize
      the command properly (no naive substring match).
- [ ] Wire it into the package's own hook installer (`install-hooks.sh`) and the
      Claude-plugin hook manifest, documented as opt-in for consumers.
- [ ] `tests/test_block_no_verify.py` — blocks `commit --no-verify`,
      `push --no-verify`, hooksPath override; allows normal commits.

---

## Acceptance criteria

- [ ] `docs/threat-model.md` + `SECURITY.md` exist, linked from README/AGENTS.md;
      `check-public-links` / `check-refs` stay green.
- [ ] `lint_workflow_security.py` ships warn-only with tests green and is wired
      into CI; promotion-to-strict path documented.
- [ ] `block-no-verify` guard ships with tests + is installed by the hook
      installer; the `git-history-discipline` rule cites it as its enforcement.
- [ ] This roadmap completes before any `road-to-mission-mode` Phase ≥ 1 work
      starts (hard dependency, council 2026-06-15).

## Council notes (2026-06-15, deep + peer-review)

Live council (claude-sonnet-4-5 + gpt-4o) on the Source-E harvest set converged:
security hardening is **GREENLIGHT, sequence first** — it is the policy layer
mission-mode's trust boundaries depend on. The council added a threat-model doc
(Phase 1) as a required deliverable beyond the three Source-E items (SECURITY.md +
workflow linter + no-verify hook) — "without a threat model, SECURITY.md is just
a bug-bounty email address, not a security design." Distinctness from the
archived security-pillar confirmed against the archive.

## Provenance

- Source-E (external agent-harness reference, code-audited 2026-06-15;
  maintainer-recoverable via `src/scripts/_lib/link_crypto.py decrypt`):
  `ENC1:KPeL+ygg/jMY1GhTqv0giUX6ZODHZCJEHN6zxZh5VvLwnrNmfGwwhvXN3Pz/N69lIhLQBEojZTwbXkJ7nKW44Dfn1m3JBzimqNcQynvJa7icti4F53l+EWAGMawPzAg=`
- Evidence: gitignored harvest store (`agents/.harvest-local/source-e-findings/07-*`).
  Source-E security edges confirmed: no SECURITY.md, no workflow-security
  validator, supply-chain `--ignore-scripts` enforcement, deterministic
  `block-no-verify` hook. AC verified absent on all three.
- Council: live two-member run (claude-sonnet-4-5 + gpt-4o, deep, peer-review,
  2026-06-15); convergence inlined above.
