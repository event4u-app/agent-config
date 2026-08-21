---
complexity: lightweight
---

# Stub: road to org telemetry enablement

> **Stub — not active work.** Transferred out of
> [`road-to-org-telemetry.md`](../road-to-org-telemetry.md) Phase 3 on
> 2026-08-20 under blocker `dpo-signoff`, by the drain-run disposition
> framework
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> (disposition **B** — outcome `transferred`). Council 2026-08-20, quorum 2/2:
> *"A legal/internal data-protection signature is categorically external and
> cannot be recorded as agent-completed."*
>
> This is the narrowest kind of transfer there is. The design was built to make
> the review short and it succeeded: the artefacts to review are two, they both
> exist in the tree today, and neither of them is going to change while this
> stub waits.

## Why a signature cannot be simulated

An agent can draft the submission text, and the blocker says so ("the agent can
draft the submission text on request"). It cannot be the reviewer. The gate is
not "has someone thought about the field list" — it is "does a written internal
outcome exist", and that is a fact about a person having signed something.
Recording it as done from inside the repository would be the exact fabrication
the drain-run framework's rule 3 exists to prevent.

**Nothing about the code waits on this.** Every phase through 2 shipped, Phase 3
steps 1–3 shipped, and the Phase 5 emission paths shipped inert. What waits is
**enablement across colleagues** — and everything that can only be measured
once enablement has run for a period.

## The two artefacts to review — both already in the tree

Named precisely, because "review the roadmap" is what the blocker's own
recommendation warns against.

| Artefact | Where it is now |
|---|---|
| **The Class-A field list** | `ClassARecord` and `ClassADefectRecord` in `src/agent-src/templates/scripts/telemetry/remote.ts`. Every member is structural; neither type has a field able to hold free-form content, prompt text, a path, or a file body. That is the property to review, and it is checkable by reading the two interfaces. |
| **The one-line disclosure** | The `telemetry-disclosure` `session_start` concern, `src/scripts/telemetry_disclosure_hook.ts`. It carries the org, the endpoint HOST only (never the full URL, which can hold a token), what is sent, what cannot be sent, and the local read path. It never carries the salt. |

A third document exists and is worth handing over with them, though it is not
under review: `SECURITY.md` § Telemetry states the same posture in prose for a
reader who does not read TypeScript.

## Transferred work — quoted as it stood

**Original resolved-when criterion, verbatim** (from the `dpo-signoff` blocker
at the transfer commit):

> **Resolved when:** a written internal sign-off exists and is referenced from
> the ADR.

**Complete list of steps moved.** Six items.

| Origin | Item, verbatim |
|---|---|
| Phase 3, step 4 | "Route the design through the company data-protection process before any org-wide enablement." |
| Phase 4, step 2 | "Re-run the report after fourteen days of org enablement. Falsification criterion: at least three distinct users with at least one activation each. Below that, the hypothesis that colleagues actively use the package is examined before the pipeline is — and the null is published either way." |
| Phase 4, step 3 | "Only after that criterion passes, hand the data to the rationalization sweep as its deciding input; that sweep already names usage data as its verdict source." |
| Phase 6, step 2 | "Apply a thirty-day falsification gate: if no cluster reaches threshold after thirty days of active telemetry, record the finding — detection too blunt, or a genuinely low defect rate, both of which are results — and do not build the generation step below." |
| Phase 6, step 3 | "Only after that gate passes, generate draft changes from a thresholded issue in maintainer context, reading the structured taxonomy fields and never Class-B free text, through neutral review and the standing quality floor. Automatic merging stays permanently out of scope: the change fixes a hypothesis, and the user-text-to-issue-to-change chain into a public repository is an injection channel that keeps a human on the final gate." |
| Acceptance criterion 3 | "The usage report either cites one estate decision made on sink-backed distinct-user data, or publishes the null from the fourteen-day criterion." |

**The four measurement items also need the sink.** Phase 4 steps 2–3, Phase 6
steps 2–3 and AC3 all require records to exist, so they are gated by
[`road-to-org-telemetry-sink.md`](road-to-org-telemetry-sink.md) **and** by this
stub. Both gates must clear; neither alone releases them. They are listed here
rather than in the sink stub because the signature is the longer pole and
because "fourteen days of org enablement" is the phrase that names this gate.

**One consequence the blocker states and it is worth not losing:** the Phase 4
measurement needs at least three distinct users, so a null published without
this sign-off would be an artefact of the missing approval rather than a finding
about adoption. Do not publish that null as an adoption result.

## Re-entry producer and detection probe

| Field | Value |
|---|---|
| **Producer** | The **named internal data-protection reviewer** for the organisation — the person or role the company's data-protection process routes a written review to. Named by role because the repository cannot name the individual; the promotion act is filling this cell with a person's name, and a promotion that leaves it as a role has not cleared the gate. |
| **Detection probe** | The signed outcome, covering the Class-A field list **and** the disclosure line, is linked from ADR-233. Concretely: `docs/decisions/ADR-233-*.md` contains a reference to a dated written outcome, and that outcome names both artefacts. |
| **Measured at transfer (2026-08-20)** | **FAIL.** ADR-233 exists and is indexed; it carries no sign-off reference. `grep -c "sign-off" docs/decisions/ADR-233-*.md` finds no linked outcome. |

## Monitoring, review and rollback

Enablement is the act that turns the standing egress on, so it inherits the same
fields as the sink and adds one of its own. The sink stub holds the egress
mechanics; this table holds what is specific to enablement across people.

| Field | Value |
|---|---|
| **Monitoring owner** | The **data-protection reviewer** owns the standing question "is the approved field list still what ships"; the org repository administrator (see the sink stub) owns operational health. Two owners because they answer different questions and a single name would be doing one job badly. |
| **Review date** | **2026-11-20** (90 days), together with the sink stub, so the two are read side by side. If the sign-off has not been sought by then, the honest reading is that org-wide telemetry is not actually wanted — which retires both stubs rather than re-dating them. |
| **Rollback trigger** | ANY of: (a) the written outcome is negative, or conditional in a way the shipped field list does not satisfy; (b) a field is added to either record type after the sign-off without a re-review; (c) a colleague objects to the disclosure after seeing it in a real session; (d) the disclosure line fails to appear on an enabled install. |
| **Rollback procedure** | Remove `enabled` (or `endpoint`) from the org pack: `read_remote_settings` resolves `active: false` and every writer goes to zero file operations on the next session, with no code change and no release. Then supersede ADR-233 if the org-pack provenance class itself is what was rejected — the ADR's own rollback line already says the gate then fails closed by construction. Local logs stay and expire under the retention policy. |
| **Why (b) is a trigger and not a nicety** | The sign-off is over a field list, so the field list is the thing that must not drift after it. There is no gate today that fails a build when a member is added to `ClassARecord` — that is a real coverage gap and it is named here rather than implied to be covered. |

## What does NOT apply to this stub

The **Promotion criteria (shared)** in [`README.md`](README.md) do not govern
it, for the same reason they do not govern its sibling: this is a drain-run
transfer of already-agreed internal work, not a new org-mode product surface.
Its gate is the probe above.

Unlike its sibling, the pending act here crosses **no** Hard Floor: obtaining a
written internal review is not a destructive, irreversible, or
externally-visible action. Configuring the org pack afterwards is, and that act
belongs to the sink stub.
