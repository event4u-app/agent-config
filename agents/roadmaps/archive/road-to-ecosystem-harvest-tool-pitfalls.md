---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Tool Known-Pitfalls

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**F** = a SaaS-pack marketplace, **G** = a
security-firm repo); full provenance in the index § Provenance.

**Priority: P2.** Cheap, high-signal: the suite's tool skills teach the happy
path; none carries a "gotchas that silently fail or cost money" troubleshooting
section.

## Goal

Add a hand-authored **Known-Pitfalls (Symptom → Root-cause → Fix)** section to
the highest-support-burden shipped tool skills — and explicitly **reject** the
auto-generator that would sprawl 30 near-identical skills per tool.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Tool skills (happy-path) | Shipped | `grafana`, `sentry-integration`, `cloudflare`, `traefik`, `terraform`, `terragrunt`, `docker`, `laravel-*` |
| A structured "reject the rationalization" lookup pattern | Shipped (security) | the fp-check gate in the bug-security-rigor roadmap uses the same shape |
| Auto-generated per-tool pitfall grids | **Reject** | Source F's 30-slot generator = 918-skill sprawl vs `size-enforcement` |

- [x] Reality check complete — the gap is a **hand-authored troubleshooting section**, not a generator.

## Phase 1 — Adopt-now plate (3 tools, bounded)

- [ ] **U1 — Author a `## Known pitfalls` section standard.** Define the micro-format once: a short **Symptom → Root-cause → Fix** table + a "Quick-reference anti-pattern checklist" (Anti-pattern | cost/impact | fix difficulty). *Source F (hand-tuned instances), G.* Verify: the format documented in `skill-writing` as an optional section.
- [ ] **U2 — Retrofit the 3 highest-burden tool skills.** Pick the 3 tools with the largest real support surface (candidates: `docker`, `terraform`, `laravel`); add **≤ 5 entries each**, each sourced from a genuinely common failure (a high-vote community question is the demand signal — not invented pitfalls). *Source F.* Verify: each entry names a concrete symptom + a fix a user can act on.
- [ ] **U3 — Guard against sprawl.** Record in `size-enforcement` / `domain-adoption-policy` context that per-tool pitfall content is a **section on an existing skill**, never a new skill per pitfall and never generated. Verify: the guard note exists so the pattern can't be abused into the rejected generator.

## Rejected (council)

- The 30-slot Jinja per-vendor generator (918 skills) — quantity-over-quality;
  the *topic taxonomy* (install-auth, webhooks, rate-limits, cost-tuning,
  incident-runbook) is kept only as a **checklist for authoring one good skill**,
  never as 30 thin ones. *Source F.*

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) bounded this hard: adopt for **3 tools,
≤ 5 entries each, community-vote-sourced** (the vote count IS the demand
signal); reject the generator outright.

## Acceptance criteria

- [ ] `## Known pitfalls` format documented once; 3 tool skills carry ≤ 5 real, sourced entries each.
- [ ] No new pitfall-only skills created; no generator introduced.
- [ ] Dashboard regenerated.
