---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Domain Watch (gated verticals)

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**A** = a multi-harness marketplace, **D** = a
CLI component-template catalog); full provenance in the index § Provenance.

**Priority: Watch.** Two large net-new verticals surfaced. Opening either is a
[`domain-adoption-policy`](../../src/rules/domain-adoption-policy.md) decision
(demand signal / named owner / CI-tooling). Neither passes the gates today — so
neither opens. The council carved **one** narrow, in-mission exception.

## Goal

Record the gated verticals as watch-notes with their gate requirements (so the
case is not relitigated each harvest), and adopt only the single black-box
capability that sits inside the suite's mission.

## Phase 1 — The one in-mission exception (adopt)

- [ ] **U1 — `evaluate-llm-feature` skill (black-box).** The real gap: a user building their product with the suite cannot get help evaluating the **LLM feature they ship**. Adopt a *black-box* evaluator — user describes the shipped LLM behavior; the skill runs adversarial probes (hallucination, prompt-injection, cost-runaway), checks against stated expectations, and reports findings. **Scope boundary:** evaluates the feature as a black box; it does **not** teach RAG architecture / chunk sizing / embedding models (that is *building* an LLM app, out of mission). *Source A (llm-evaluation), D (agent-evaluation).* Verify: "review my chatbot" fires the skill; it emits injection/hallucination/cost findings, not a RAG tutorial.

## Phase 2 — Gated verticals (do NOT open — watch-notes)

- [-] **LLM-app engineering vertical** (RAG / embedding / vector-index / hybrid-search / fine-tuning / serving). Two independent reviewers flagged it as the biggest net-new gap, but opening it is a **category error** — that is tooling for *building* an AI product (LangChain territory), not for *using* the suite inside an AI IDE. Open a watch-note at `agents/settings/contexts/domain-watch/llm-app-engineering.md`. Gates to open: **≥ 2 consumer projects** shipping LLM features + a **named owner** + a **CI decision** on eval-fixture tooling. *Source A, D.* <!-- gated: domain-adoption-policy — demand signal + owner + CI not met -->
- [-] **Cloud-native / Kubernetes / GitOps / service-mesh** (ArgoCD/Flux/Istio). Hard no today — Docker + terraform/terragrunt already cover the solo-founder consumer; k8s/GitOps is at-scale operations a solo consumer does not have. Open a watch-note at `agents/settings/contexts/domain-watch/cloud-native.md`. Gates to open: **≥ 2 consumers on k8s** + a **named SRE co-maintainer** + a **CI decision** (cluster-in-CI vs reference-only). *Source A.* <!-- gated: domain-adoption-policy — no demand, no owner -->

## Phase 3 — Watch-note authoring

- [ ] **U2 — Write the two watch-notes.** Create `agents/settings/contexts/domain-watch/{llm-app-engineering,cloud-native}.md`, each listing the missing gate evidence, so the next harvest re-evaluates without re-litigating. *Per `domain-adoption-policy` § "What to do when the gates fail".* Verify: both notes exist and name their gates.

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) converged: cloud-native is a hard no
(resume-driven, zero demand); the LLM vertical must **not** open wholesale
(category error); adopt **only** the narrow black-box `evaluate-llm-feature`
skill and defer everything else to watch-notes with explicit gates. RAG /
embedding / vector = out of mission.

## Acceptance criteria

- [ ] `evaluate-llm-feature` ships as a black-box evaluator (no RAG-building content).
- [ ] Two watch-notes exist under `agents/settings/contexts/domain-watch/` with gate requirements.
- [ ] Neither vertical is opened; the reject/gate rationale is recorded so it is not relitigated.
- [ ] Dashboard regenerated.
