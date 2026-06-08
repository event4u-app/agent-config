# Role-experience evidence basis

> What backs each role's `status:` today — and what does **not**. This file
> exists so the honesty is legible and auditable: no role claims validation it
> has not had.

## Current basis (2026-06-08)

All six shipped roles — `galabau`, `content-creator`, `consultant`, `sales`,
`support`, `leadership` — are at `status: beta-internal`.

**What that means:** the role's identity, three first tasks, ≥ 5 prompts, and
skill shortlist were authored by the maintainer from a domain hypothesis and
pass the structural lint (`task lint-role-experiences`). The launcher surfaces
them with an `internal beta` label.

**What it does NOT mean:** no external user has been recorded using any role.
`recruit_session_ref` is `null` for all six. None has external-validation
evidence.

## Why not faked, why not blocked

A 2026-06-08 AI-council round (claude-sonnet-4-5 + gpt-4o, design mode)
addressed the maintainer's question — *can we treat the recruit sessions as
done and move on?* Convergence:

- **Do not fabricate session reports.** The whole roadmap
  (`road-to-employee-product-and-external-proof.md`) exists because there are
  zero confirmed external users; inventing quotes that then flow into role
  prompts and release notes is the exact failure mode it guards against.
- **Do not cancel the sessions either.** Recruit sessions test a boundary the
  self-improvement loop is blind to: *can a cold-start external user get in at
  all?* The improvement loop refines tasks for people who already got in — it
  is a refinement tool, not a design-validity tool. So the sessions stay as an
  **optional future** activity.
- **De-gate, honestly labelled.** The `beta-internal` tier lets the roles be
  used today without claiming external validation. Promotion to `beta` /
  `stable` stays reserved for real recruit evidence and is lint-enforced
  (`beta`/`stable` require a non-null `recruit_session_ref`).

## How a role upgrades to external `beta`

1. Run a recruit session per [`agents/recruit-sessions/_runbook.md`](../recruit-sessions/_runbook.md).
2. File the report under `agents/recruit-sessions/0N-<role>.md`.
3. Set `recruit_session_ref:` in the role's `index.md` to that report path and
   flip `status: beta-internal → beta`.
4. Replace the seeded first tasks with the verbatim findings.

The self-improvement loop (`skill-improvement-pipeline`) continuously refines
the prompts from real usage in the meantime — but that refinement never flips
the external-validation status; only a recruit session does.

## See also

- [`docs/contracts/role-experience.md`](../../docs/contracts/role-experience.md) § Versioning + status — the tier definitions + lint gate.
- [`agents/recruit-sessions/README.md`](../recruit-sessions/README.md) — what a recruit session is + the consent/redaction floor.
