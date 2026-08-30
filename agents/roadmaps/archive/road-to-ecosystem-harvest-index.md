---
complexity: structural
status: ready
---

# Roadmap: Ecosystem-Harvest Index

**Trigger:** User ask — deep-dive the external agent-skill ecosystem (an
aggregator directory over ~10k skills across many repos), find what a mature,
project-agnostic AI-coding suite can benefit from, and plan the adoptions as a
set of prefixed roadmaps for later execution.

**Mode:** Harvest policy — sources are referenced **source-anonymously** per the
[`source-confidentiality`](../../src/rules/source-confidentiality.md) rule (real
links retained as `ENC1:` tokens in § Provenance). Adoption is **ruthlessly
prioritized**, not maximized: an AI-council pass (below) pushed hard on "would
you delete three existing things to make room for this?" and every low-value or
redundant candidate was dropped or gated, not shipped.

This is the **navigation + sequencing hub** for the `road-to-ecosystem-harvest-*`
family. Each sibling roadmap is a self-contained plate; this file carries the
shared source map, the council convergence, the priority order, the reject-log,
and the full provenance the siblings point back to.

## Goal

Adopt only the genuinely-additive mechanics the ecosystem survey surfaced — a
small, high-leverage set — while **rejecting** the large fraction the suite
already ships, the domain sprawl a single maintainer cannot sustain, and the
cargo-culted surface. Every sibling roadmap ships as its own change with
verification evidence; nothing here authorizes execution (authoring only — the
user decides when to run each plate).

---

## Method (how this survey was produced)

- Entry point: a public aggregator directory (**Source N**) over ~10,605 skills
  in 24 categories. Its "top starred" ranking is **repo** stars, not skill
  quality — most top entries are project-internal skills (framework-internal
  migration helpers, vendor-specific operators) irrelevant to a portable suite.
- The real signal is a handful of high-value general-purpose sources
  (**A–M**). Five parallel deep-dive passes read **actual `SKILL.md` bodies**,
  not READMEs, and judged each finding adopt / adapt / already-have / reject
  against the suite's current 271-skill / ~90-rule / ~150-command surface.
- The adopt/gate/reject calls and the sequencing were vetted by a 2-member
  AI-council debate (see § Council convergence).
- A **second sweep** (source directory's backing repo == this same catalog)
  closed disposition on every remaining entry and added four second-sweep
  roadmaps (review-mechanics, skill-quality-gates, workflow-contracts, and the
  second-sweep coverage file). Its load-bearing external mechanism claims were
  independently fact-checked against real source files (verbatim-confirmed). A
  parallel local exploration (gitignored drafts, another prefix) was reconciled
  in, not duplicated: its net-new mechanisms were folded here **anonymized**
  (its open-source-name drafts would trip the `check-no-external-sources` gate;
  its re-proposed numeric readiness score stays dropped per the council lock).
- A follow-up **depth-reconciliation pass** read the parallel exploration's full
  drafts (not just its summary) and folded the net-new planning-level grounding
  they carried: the census-honesty prerequisite + privacy constraint into
  `reliability-measurement`; the consumer-launch diagnostic promoted to its own
  `prelaunch-diagnostics` plate (score surfaced for council re-evaluation, not
  adopted); style/stance separation + a bring-your-own-checker loop-shape into
  `prose-authenticity`. Execution-level minutiae (exact file paths, JSON field
  lists) were left to execution time, not duplicated here.

---

## Priority order (council-ranked)

| Tier | Roadmap | Why here |
|---|---|---|
| **P1** | [`road-to-ecosystem-harvest-bug-security-rigor`](road-to-ecosystem-harvest-bug-security-rigor.md) ✅ shipped | The over-reporting gate is a live credibility fire — an over-flagging bug/security cluster damages trust today. |
| **P1** | [`road-to-ecosystem-harvest-reliability-measurement`](road-to-ecosystem-harvest-reliability-measurement.md) ✅ shipped | The loaded-vs-fired utilization report is the only mechanism that lets the suite **subtract** dead-weight skills — it enables the token-budget program. Golden-adversarial fixtures make review output testable. |
| **P1** | [`road-to-ecosystem-harvest-review-mechanics`](road-to-ecosystem-harvest-review-mechanics.md) ✅ shipped | Five verified upgrades to the review surface (ordering-bias, change-type routing, reasoned validation + dropped-FP transparency, two-tier triage, security deep-verify). *(Second sweep.)* |
| **P2** | [`road-to-ecosystem-harvest-skill-authoring-rigor`](road-to-ecosystem-harvest-skill-authoring-rigor.md) ✅ shipped | Spec alignment + a quantitative description-optimizer raise the quality floor of every future skill. |
| **P2** | [`road-to-ecosystem-harvest-skill-quality-gates`](road-to-ecosystem-harvest-skill-quality-gates.md) ✅ shipped | Deterministic gates: description-circularity lint, eval-schema v2 (tool-choice + trajectory), effort pinning, read-only-by-default scripts, host-loadability smoke. *(Second sweep.)* |
| **P2** | [`road-to-ecosystem-harvest-workflow-contracts`](road-to-ecosystem-harvest-workflow-contracts.md) ✅ shipped | Per-mode forbidden-lists with diff-checkable negatives, a host-neutral HANDOFF contract, plan-first merge-conflicts. *(Second sweep.)* |
| **P2** | [`road-to-ecosystem-harvest-prelaunch-diagnostics`](road-to-ecosystem-harvest-prelaunch-diagnostics.md) ✅ shipped | Consumer-launch diagnostic: stable finding IDs, Unknown ≠ Pass epistemics, findings regression gate, suppression-with-evidence. *(Second sweep; split from reliability-measurement.)* |
| **P2** | [`road-to-ecosystem-harvest-document-skills`](road-to-ecosystem-harvest-document-skills.md) ✅ shipped | Completes the document read→write cycle (a read skill already ships); scoped v1, CI-gated pptx. |
| **P2** | [`road-to-ecosystem-harvest-prose-authenticity`](../road-to-ecosystem-harvest-prose-authenticity.md) | A prose-level AI-ism taxonomy fills a real hole the code/UI slop rules don't cover. |
| **P2** | [`road-to-ecosystem-harvest-tool-pitfalls`](road-to-ecosystem-harvest-tool-pitfalls.md) ✅ shipped | Cheap, high-signal troubleshooting sections on the highest-burden shipped tool skills. |
| **P3** | [`road-to-ecosystem-harvest-product-gate`](road-to-ecosystem-harvest-product-gate.md) ✅ shipped | A tiny "should this exist?" demand check, one altitude above the engineering-fit gate. |
| **P3** | [`road-to-ecosystem-harvest-ergonomics`](road-to-ecosystem-harvest-ergonomics.md) ✅ shipped | Ergonomic dispatch + per-phase commands; nice-to-have, low risk. |
| **Watch** | [`road-to-ecosystem-harvest-domain-watch`](road-to-ecosystem-harvest-domain-watch.md) | New verticals (LLM-app engineering, cloud-native) — gated by `domain-adoption-policy`; one narrow exception adopted. |
| **Coverage** | [`road-to-ecosystem-harvest-second-sweep`](road-to-ecosystem-harvest-second-sweep.md) ✅ shipped | Closes disposition on **every** remaining catalog entry (the backing repo == this directory); fold-in patch list; introduces zero new workstreams. |

---

## Phase 0 — Adoption sequencing (accept plates in priority order)

Each checkbox = a maintainer go/no-go to schedule that plate. Accepting a plate
does not execute it; it moves the plate from "planned" to "cleared to start".

- [x] Accept **P1** plates (bug-security-rigor, reliability-measurement)
- [x] Accept **P2** plates (skill-authoring-rigor, document-skills, prose-authenticity, tool-pitfalls)
- [x] Accept **P3** plates (product-gate, ergonomics)
- [x] Confirm **domain-watch** dispositions (defer LLM-vertical + cloud-native to watch-notes; adopt only the narrow LLM-feature evaluator)
- [x] Accept the **second-sweep** cluster (review-mechanics, skill-quality-gates, workflow-contracts) + confirm the catalog is fully dispositioned
- [x] Ratify the § Reject-log (do not re-propose the rejected items without new evidence)

---

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o, 2 rounds, actual $0.14) converged on:

- **Grouping** — keep focused per-surface roadmaps (they adopt independently,
  which is the point), but prioritize hard and mark drops explicitly. Do not
  inflate scope; the roadmap set is a *plan*, not a mandate to ship all of it.
- **Document generation** — a capability *completion* of the existing
  read-side document skill, **not** a new vertical — BUT the CI-tooling gate of
  `domain-adoption-policy` still applies to the LibreOffice-dependent parts.
  Ship docx + pdf template-filling (pandoc, hermetic); gate pptx + the visual-QA
  loop behind a CI decision + a demand signal.
- **New domains** — cloud-native/K8s is a hard **no** (resume-driven, zero
  demand for a solo-founder consumer). The LLM-app vertical is a **category
  error** to open wholesale (that is building LangChain, not using the suite);
  adopt **only** a single black-box evaluator (a new `evaluate-llm-feature`,
  tracked in the domain-watch plate) and defer the rest to watch-notes.
- **Contested** — DROP Monte-Carlo reliability testing (redundant with the
  utilization report; theoretical for deterministic pattern-matching). DROP the
  0–100 readiness *score* (false precision, becomes a gaming target); keep only
  the evidence-gated binary go/no-go per checklist item. KEEP the "explain-the-why
  vs ALL-CAPS" register split as a small `skill-quality` addition, scoped to
  capability skills — the safety kernel stays imperative.
- **Priority** — P1 = the false-positive gate + the utilization report + golden
  fixtures.

The one live disagreement (document-gen: "new domain, gate it" vs "portable
completion") is resolved by the split above: portable in principle, CI-gated in
the parts that carry the system dependency.

---

## Reject-log (do NOT re-propose without new evidence)

| Rejected | Source | Why |
|---|---|---|
| "senior-*" persona-as-skill model (hollow stub scripts) | D | Suite personas (review lenses, tier/wing schema, `persona-governance`) are architecturally superior. |
| Breadth-as-strategy (~500 thin scaffolds) | D | Exactly the unowned-domain-rot failure `domain-adoption-policy` exists to prevent. |
| 30-slot auto-generated per-vendor pack grid (918 skills) | F | Quantity-over-quality; collides with `size-enforcement` + `skill-quality`. Topic *taxonomy* kept as a checklist only. |
| External cheaper-LLM delegation + quota gate | (small) | Deliberately not-adopted per prior decision (subagents Claude-only; provider budget balancer killed). Revisit-only. |
| Reflection / evaluator-optimizer self-critique library | H | Already-have, stronger (judge cluster + council + verify-repair-loop). |
| Behavioural-coding guideline restatement | (small) | Near-verbatim already-have (`minimal-safe-diff`, `think-before-action`, `improve-before-implement`). |
| Monte-Carlo reliability testing of activation | A | Redundant with the loaded-vs-fired utilization report; theoretical for deterministic triggers. Revisit-if a fixture library + a measured flakiness signal both exist. |
| 0–100 quantified readiness score | L | False precision / gaming target; keep the evidence-gated binary caps only. |
| Full RAG / embedding / vector / LLM-app-build vertical | A, D | Category error — building LLM apps ≠ using the suite. See domain-watch. |
| Cloud-native / K8s / GitOps / service-mesh vertical | A | No demand; Docker + terraform already cover the solo-founder case. See domain-watch. |

---

## Acceptance criteria

- [x] Every sibling roadmap exists under `agents/roadmaps/` with the shared prefix, each self-contained (own reality-check + plate + acceptance). <!-- 14 siblings: 13 shipped/archived + prose-authenticity (open, decision-blocked at U6). The stale "nine" count predated the second-sweep + depth-reconciliation passes; corrected. -->
- [x] Ratified 2026-07-19 (maintainer go/no-go, this session): 12 of 13 plates already shipped, domain-watch executed (#970); the sole unshipped sibling (prose-authenticity) is "cleared to start" per Phase 0, still blocked at U6. Accepting a plate ≠ executing it.
- [x] Every sibling cites only its own sources by letter and points here for full provenance.
- [x] Dashboard regenerated (`./agent-config roadmap:progress`).
- [x] No harvest-family artifact names a real external source — the index (anonymized Sources A–N + `ENC1:` provenance) and every sibling cite by-letter only; `langchain` in the LLM-vertical prose is a descriptive category mention, not on the denylist. <!-- note: the tree-wide check-no-external-sources gate is red on PRE-EXISTING, unrelated debt (three denylisted tokens in `agents/memory/product-rules.yml`, one in `agents/roadmaps/archive/road-to-opt-retrieval-and-memory.md`) that predates this work and is out of scope per minimal-safe-diff. The harvest family itself is clean. -->


---

## Provenance

Sources are anonymized above. Real identities are recoverable by the maintainer
via [`link_crypto`](../../src/scripts/_lib/link_crypto.ts) (`decrypt`):

- Source A — large multi-harness agentic plugin marketplace — `ENC1:2xHlaryC+PGyvba0a4+gNAPTPbFi4uT5e+lwBWsDBfPTN/JktLb2RQJPfgrvzCtQkc0toyyCbQ/Y3HwmUNSYSg==`
- Source B — official vendor skills repo — `ENC1:k8CjKuQbNoCPwi4XuSFA7rdVTnA5L6Zrq39+lMlbboPOx26LUfKuVpMGPZWmNPT0TqOgfHH8ivM37WV6ERf0NQ==`
- Source B-spec — the public Agent-Skills specification — `ENC1:FsMbAsY1ODveNO0kx8T+brAeYb6rLLHj7DMSUGTtCs8z1whrhuXcl0FM/qe3nbu2sIGKcOj5LMBK1DUGfYZqLA==`
- Source C — official vendor CLI plugin-dev skills — `ENC1:w9j3HhZvYJrnd0q6PbVCA9BtAAzH7indE6mvpcxyoh7YHTl8Lp6/xYDn3Qq6hN4oQEQEGaTMBIGzdwMLlJnnCA==`
- Source D — large CLI component-template catalog — `ENC1:tZMNr7Jq884BcvxPUm43Sg+MFXMNJrKbHC9ceLnHKUh+LAb8/fz/IJ67kVVXc2a/kGhqrl7e3/jN3GRM4ngsgw==`
- Source E — production slash-command collection — `ENC1:Jyco7vKef+Xrtg7kCsS0KXunN8OUnpZCNNtaPVUD3/zcOjt1bx0fNO60Qk+uWKJ9QlPxuuuJM+RAyERQMM8l5w==`
- Source F — large SaaS-pack plugin marketplace — `ENC1:kOWJR4/QcB65EMcJvZpNev5XKS0e0D0PHfopc5EvnI/m3s8MTdYejtxBSq3ggTRIHIYGukEu9lTKylW3O2DIcg==`
- Source G — security-firm skills repo — `ENC1:hZ6ivqcrzsezfyFddfBPRceGkZl3mDzzvBoGfnHvyXrB4RpD1r4m4WHQksDV7paHBJehCVvwgRNu9ZBw0vSNGg==`
- Source H — official code-host assistant skills repo — `ENC1:8t/eDHFg+x7JVU+/XhEnHsEjUOoR+A39o6KfuPwh2+pD+mqndrMYgnfIAfg8CkdOw7gyw90lr2xYtPQTLcmAQQ==`
- Source I — prose anti-slop humanizer skill — `ENC1:xK4nWAiXZkEdpXqaVHQQDI7yqH/4dEKX/boJqsb3XpiXqsX8akrhZ2kDcLvhTTb7NZeY+JdwvVAS3H9DXwb8SA==`
- Source J — pre-build product-demand gate skill — `ENC1:EpiAx5KHJ2c07ER1aB3+nsjJeqPebOHJQ7WrJhaGQFJXStQVVzFjBy44+x1+32lGHz/vU1A07EY3EdBs//rUwg==`
- Source K — loaded-vs-fired transcript pruner — `ENC1:34EBUkzq7jygn3bU3FFal0PrR0q+OdcX+fB5HdAHknPLupvVbgfKLwDmNS8ValtxY4Td3RtVo0lQs2gs/XFZpg==`
- Source L — production-readiness scoring skill — `ENC1:JKej0TiHC20KFStSusNrMlVz4TC2NK4iYtiS0CaGf+WeomhWzabYtGIep3VIxqBOxf1Gl5JZdPmxRcOnuPjORg==`
- Source M — PR-review MCP worked-example — `ENC1:zM+Y9hGxL9Yqw2zIaJzh5yal+Y4MwGpXIc3GsSUPONLhrIwDVB/pdgP0JqTG6irzajf7MTRDeppxj2DGQzDcLQ==`
- Source N — the aggregator directory — `ENC1:NPKra0DJ3jLvw5c+0dY+lLyCz5FYygifacb1HG0qQpcoIFY2owmaAxp5M7+Fu6aKzVzVIXthvN9lpdvYEy3KKA==`

Second-sweep sources (added 2026-07-11):

- Source O — a 3-persona PR-review skill — `ENC1:zkKLJL4UHD4xKS2RkcpBnltE5TsfHiHHhYE5jTmwf/VGwM6YfSpBKa0MQquhICSYY5lXOrDXxlIK1u2YcJkKLg==`
- Source P — a mobile-app repo's change-review skill — `ENC1:U5tBkwgukRXSjrUFO3aK9i6AWtRGNA7ZSo6BuPSQjRWnaKVE+XXLSJGkYv3tyKDnQRCKH+uzO7iG/iS2jB0amg==`
- Source Q — an RL-env repo's alignment-review skill — `ENC1:fUXZLKOTf6mZqpb4G57BSpWTHdj9ZHyAlj89lLM+YqXobr0A6EQPYDeB9BLnwsjRhgmO/gx4r3W19n9eswDymQ==`
- Source R — a credential-broker skill with a rich eval schema — `ENC1:YXiGR7seaokdTUxVLQDh/n93VEvaTnY1yi0Fb8o+cOuA8s53PinujOz4coOd6SQMr1OomP8KfqDVvoAEPmGRbg==`
- Source S — a quality-toolkit skill with pinned effort frontmatter — `ENC1:R4Yrix0e+8Wsfo2snlmyqBWuUKaVw+2gK/hK5G2vS64uKozSAjUVw7De/ZM/Q19nGwqoK5oGAh6atukiC17Wsw==`
- Source T — a read-only-by-default script skill — `ENC1:abLyVRd3Gl4rrzn9U/KjhVAMd6357yxPoQhIlSOqzs3sU6VbVRbHy66ua59KYkJLL9OBEjoUXiT3iAoD7RgxGg==`
- Source U — a 4-mode TDD state-machine skill — `ENC1:b4HABODTohxc6CpAb9lT+e2K44enjvpdBDdPXYvd8ql8KnfTl9Ce+FgzlHqL11cWlPvyVXoO+3+2G0XGeqEqqw==`
- Source V — a plan-first merge-conflict skill — `ENC1:V1v8RES6tPqUkn/NeRd7eQ/U8uTup4H5C5rBpruZmm1rjC4lIA65TlJ1AJhPzb/lH/hpoPwLCmj55vEa6dV0dA==`
- Source W — a cross-tool session-audit CLI — `ENC1:xseK+2aYtwmeI5+lBVjPNqXw9KtF1knmUytomXU+bgOFByPd2acpfwoB1dHYU+1xvOm2bY5AVCKNYp+Qmfrp+g==`
- Source Y — a container-tooling repo (otel-instrument) — `ENC1:WMs4sUBQ0ehy3zj5MNIKGNzY8UHumWV5X8dJ9262UVeV8xlX1Yz+aw2AAG2qp9EGZE4MxsFWH12gSgt4E/hBmw==`
- Source Z — a critical-planning-file safety skill — `ENC1:ZNVbKKTOfOG6DhBw3kbN1MH8ZFeFkPTn9pTp0v/jml9T6Hqk1HhMIhTf+qiR+pnUf9GJaRChvZZH4UUvR2yhrA==`
- Source AA — a canonical-skill→multi-adapter generator with a verify script — `ENC1:Z4wWTMphm8Tl654v16MSa7OAFJfrgUgTULDU8WBBog9dpotDD+VMolEZ8cetGuV0oVXGU0emw/wLMRAcYdKEPQ==`

<!-- redacted 2026-08-29: source identifiers replaced by codenames per ADR-250. No decision, measurement or count altered. -->
