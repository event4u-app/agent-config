# Corpus-grounding authoring guide — qualification, shape, governance

> The gate every new domain corpus passes before it enters
> `src/skills/<skill>/data/`. Architecture: ADR-061; engine + manifest
> contract: [`corpus-grounding`](../../../src/skills/corpus-grounding/SKILL.md).

## 1. Qualification checklist — ALL must hold

- [ ] **Decision-rule utility test.** The domain's *selection/constraint*
  decision is externalizable as auditable rules that **beat the agent's
  priors**. 8 rows with strong conditionals beat 300 flat rows — row
  count is never the argument.
- [ ] **Before-action test.** Grounding constrains the option space
  *before* the agent acts. Mid-action lookup is **reference** (→
  `references/` / RAG); post-action checking is **validation** (→ a
  rule/linter); the procedure itself is **method** (→ a framework skill).
  Route each to its mechanism — never the corpus.
- [ ] **"Fits in 5 lines" test.** If the knowledge compresses into ≤5
  lines of an always-on rule, write the rule. A corpus that thin is
  grounding theater.
- [ ] **Owner + cadence.** A named maintainer and a refresh cadence are
  declared in the manifest (`owner`, `refresh_cadence`) — the engine's
  schema validator refuses manifests without them. Unowned corpora rot;
  they are not merged (domain-adoption Gate 2).
- [ ] **Provenance pin.** `upstream{repo, sha, last_checked}` names the
  authoritative source and its version (git SHA, spec version like
  "ATT&CK v16" / "WCAG 2.2", or vendor-doc date).
- [ ] **Evidence gate for conditional candidates.** Domains on the
  *conditional* list (architecture-pattern selection, finance method
  selection) additionally require the change-my-mind anchor: the corpus
  measurably beats the existing framework skill over **≥10 real
  sessions**. Until then they stay `[~]` deferred.

## 2. Shape — what a domain ships

```
src/skills/<domain-skill>/data/
  manifest.json     # schema-agnostic plug-in (see corpus-grounding SKILL.md)
  <axis>.csv        # the corpus — domain declares its OWN columns
```

- Tier honestly: `lookup-only` (search + rule columns the agent applies)
  is the right starting tier for most domains; `conditional-grounding`
  (engine-evaluated reasoning map + decision rules) only when a natural
  category→rules two-stage exists; `constraint-emission` only for mature
  directive-integrated domains (frontend).
- Every output carries `confidence` + `evidence_gap` — engine-enforced.
- Consultation default (Tier 1): the skill queries, proposes grounded
  options, the human confirms. Directive integration is the exception,
  not the goal ("directive engines everywhere" = orchestration envy).
- Validate before merge:
  `python3 src/skills/corpus-grounding/scripts/ground.py validate --manifest …`
  plus a smoke query, plus an eval-fixture test under `tests/`.

## 3. Governance per shipped corpus (Step 9.8)

| Obligation | Mechanism |
|---|---|
| Named owner + cadence | `manifest.json` keys — schema-validator-enforced |
| Staleness visibility | `upstream.last_checked` bumped on every refresh; quarterly default |
| Link integrity | `Docs URL` / source columns are plain URLs; `check-refs` + the quarterly refresh catch 404s |
| Eval lock | one `tests/test_<domain>_corpus.py` with representative queries |
| License | source obligations recorded in the owning skill (ATTRIBUTION pattern) |

## 4. Rejected domains — recorded, do not relitigate (Step 9.7)

Per ADR-061 §5 and the 2026-06-03 council (3-model deep debate, no
split), the following are **rejected as corpora**:

| Candidate | Why rejected | Right mechanism |
|---|---|---|
| People/org practices (hiring loops, comp, 1:1 cadence) | Volatile, culturally specific ("fads"); rules don't beat priors stably | Framework skills (`hiring-loop-design`, `comp-banding`, …) |
| GTM playbooks | Same volatility; context dominates selection | Framework skills + discovery interviews |
| Founder-strategy verdicts | Verdicts are human decisions (strategy-safety-floor); no auditable selection rule | Framework skills + safety floors |
| Formula/spec lookup (WACC, WCAG criterion text, API param lists) | Mid-action **reference**, not pre-action grounding | `references/` docs / RAG |
| Lint-able conventions (no hardcoded hex, commit format) | Post-action **validation** | Rules / linters (`tokens.py validate`, commit lints) |
| Anything ≤5 always-on lines | Grounding theater | A rule |

Conditional (deferred, evidence-gated — NOT rejected): finance *method
selection*, architecture-pattern selection. Watch note:
`agents/settings/contexts/domain-watch/conditional-grounding-candidates.md`.

## 5. Shipped domain corpora (registry)

| Domain | Skill / manifest | Tier | Source pin |
|---|---|---|---|
| Frontend design | `design-intelligence/data/manifest.json` | conditional-grounding | external reference @ b7e3af80 |
| Security / threat-modeling | `threat-modeling/data/manifest.json` | conditional-grounding | MITRE ATT&CK v16 + OWASP ASVS 4.0 (derived) |
| API design | `api-design/data/manifest.json` | lookup-only | RFC 9110/9457 + field-standard practice (derived) |
| DB-query tuning | `database/data/manifest.json` | lookup-only | PostgreSQL 16 / MySQL 8 docs (derived) |
| Accessibility patterns | `accessibility-auditor/data/manifest.json` | lookup-only | W3C ARIA APG + WCAG 2.2 (derived) |
