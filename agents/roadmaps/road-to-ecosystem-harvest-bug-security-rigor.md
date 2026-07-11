---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Bug & Security Rigor

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**G** = a security-firm skills repo, **A** = a
multi-harness marketplace, **F** = a SaaS-pack marketplace); full provenance +
`ENC1:` tokens in the index § Provenance.

**Priority: P1.** The over-reporting gate is a live credibility fire — an
over-flagging bug/security cluster erodes user trust every time it fires, and
"AI over-flags bugs / overrates severity" is a *documented* failure mode the
suite's own `senior-engineering-discipline` names.

## Goal

Add the **verification rigor** the suite's authoring-time security cluster is
thin on: stop reporting bugs that aren't real (false-positive gate), give the
audit surface an evidence-cited maturity rubric, and pick up a few sharp
named-coverage gaps — without duplicating the cluster the suite already ships.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Threat modeling / abuse cases | Shipped | `src/skills/threat-modeling/`, `security-sensitive-stop` rule |
| Authorization / tenancy / IDOR | Shipped | `src/skills/authz-review/`, `broken-access-control` rule |
| Secrets, supply-chain, injection defense | Shipped | `secrets-management`, `supply-chain-intake`, `lethal-trifecta-guard`, `untrusted-input-defense` |
| Bug finding + judging | Shipped (but no over-report gate) | `bug-analyzer`, `judge-bug-hunter`, `security-audit` |
| Reflection / evaluator-optimizer | Shipped, stronger | judge-* cluster + council + `verify-repair-loop` — Source H's agentic-eval is a subset |

- [x] Reality check complete — the gap is **verification discipline on findings**, not new detection.

## Phase 1 — Adopt-now plate (≤ 5 units)

- [ ] **U1 — False-positive / over-reporting gate.** Fold a "Rationalizations to Reject" discipline into `bug-analyzer` + `judge-bug-hunter` + `security-audit`: a Step-0 that restates the claim + names the threat model (privilege level, sandbox, attacker precondition) and a short table of rejected rationalizations ("looks dangerous ⇒ pattern-recognition is not analysis; trace the full data flow first"; "clearly critical ⇒ complete a devil's-advocate pass — models overrate severity"), plus a Standard-vs-Deep verification routing. *Source G (fp-check).* Verify: a negative fixture (a benign pattern that *looks* vulnerable) must yield "not a finding" with a traced reason.
- [ ] **U2 — Security-maturity scorecard.** A generic (not domain-specific) `security-maturity-assessment` skill: ~9 categories (input validation, authz, secrets, error handling, logging/audit, dependency hygiene, data boundaries, tenant isolation, test coverage) each rated Missing/Weak/Moderate/Satisfactory/Strong with deterministic roll-up logic (any "Missing" in a critical category caps the overall rating), every finding cited `file:line`. *Source G (code-maturity-assessor).* Verify: run on a sample module, assert every rating cites evidence.
- [ ] **U3 — STRIDE matrix consolidation.** Add the explicit 6-category STRIDE→control-family table (Spoofing/Tampering/Repudiation/Info-disclosure/DoS/Elevation → question → control) into `threat-modeling` if not already a named table. *Source A.* Verify: the table renders and each row names a control the suite already teaches.
- [ ] **U4 — Named-coverage gaps (pick the portable subset).** Evaluate adding: `insecure-defaults` (fail-open / hardcoded-cred detection), `variant-analysis` (find similar bugs across the codebase once one is found), and folding an `agentic-actions-auditor` angle (CI-workflow AI-agent security) into `agent-security-review`. *Source G.* Each lands only if it is not already covered by an existing skill — check first, adopt the residue. Verify per skill: one worked example with a real finding shape.
- [ ] **U5 (rolling) — Active-probe authorization gate.** Latent-only today: if the suite ever adds active/external scanning, specify a two-step attestation (explicit in-chat confirmation **and** an `--authorized` flag, no env-var fallback since CI vars are attacker-settable; RFC1918/loopback carve-outs) as a specialization of `non-destructive-by-default`. *Source F/G.* Verify: documented as a design note; no code until an active-probe surface exists.

## Phase 2 — Gated / deferred

- [ ] PCI-compliance / payment-integration security skill — portable and security-adjacent, complements the finance pack. **Deferred** pending a demand signal (no consumer currently ships payments through the suite). *Source A.*

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) ranked the **false-positive gate the single
clearest P0** of the whole harvest — it addresses active trust erosion, not a
speculative want. U2–U4 passed as evidence-cited additions; U5 stays a design
note; PCI is demand-gated.

## Acceptance criteria

- [ ] U1 lands with a negative fixture proving a look-dangerous-but-benign pattern is NOT reported.
- [ ] Each adopted skill/section cites evidence (`file:line`) in its output contract.
- [ ] No overlap with existing security skills (checked before each unit).
- [ ] Dashboard regenerated.
