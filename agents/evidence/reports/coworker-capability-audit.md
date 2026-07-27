# Coworker capability audit — honest self-assessment on an external rubric

> Adoption-exhibit input from the road-to-ai-employee-borrowings roadmap
> (2026-07-27). The rubric is an external eight-capability framework for a
> company-wide "AI coworker", published by a vendor selling in that
> category (anonymized per source-confidentiality; maintainer-recoverable
> `ENC1:` link in the source roadmap's provenance block). Using an
> external rubric written by someone selling a competing product is the
> only kind of comparison table this package permits itself to publish —
> comparison tables where we pick the axes are forbidden on the proof
> surface. **The N/A and No rows stay in. A table that concedes six of
> eight is the positioning artifact.**

| Capability | agent-config | Note |
|---|---|---|
| Cross-functional reach | **N/A** | We govern agents. We are not a worker. |
| Cross-system access and action | **N/A** | Same. |
| Sandboxed compute | **N/A** | Host-provided. |
| Organization-wide shared memory | Partial | Per-workspace retrieval substrate, not org-wide. |
| Proactive and scheduled operation | **No** | No daemon. Deliberate (`no-runtime-daemon` ledger claim). |
| Collaboration surfaces | Partial | Through the host agent's surface only. |
| Identity, permissions, approvals, audit | **Strong** | Iron Laws, claims-ledger gate, provenance stamps. |
| Model flexibility | **Strong** | Multi-provider council, host-capabilities resolution. |

Six rows N/A/No, two Strong — and the two Strong rows are precisely the
two the products in that category treat as an afterthought. That is the
positioning: a **governance substrate underneath AI coworkers** — a
category vendor is a potential customer, not a competitor (candidate
text; the launch ADR decides, see
`agents/settings/contexts/launch-adr-inputs.md`).

Publication routing: adoption roadmap exhibit set
(`road-to-adoption-without-narrative-debt`), same surface rules as the
other exhibits — every published cell must trace to a ledger entry or a
verifiable N/A.
