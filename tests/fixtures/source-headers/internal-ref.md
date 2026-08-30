<!--
`**Source:**` headers pointing INSIDE this repository. Every line MUST score
zero: a repo path, a roadmap slug, an ADR id and a PR reference are all
`owner/repo`-shaped and name nothing external. Two of these are the exact
strings that made the first narrowed matcher over-report — a middle segment of
a longer path reads like a slug unless you look at what surrounds it.
-->

> **Source:** agents/evidence/analysis/consolidation-lineage-census-2026-08-26.md

> **Source:** PR #1016 review (maintainer, 2026-07-27)

> **Source:** road-to-product-adoption.md Phase 5 Step 1

> **Source:** under inventory:** `.agent-src.uncondensed/rules/autonomous-execution.md` (192 lines)

> **Source:** packages/installer/src/index.ts

> **Source:** docs/contracts/rule-router.md

> **Source:** evals/results/2026-04-21T08.json

> **Source:** src/scripts/_lib/source_shape.ts

<!--
Added with the recall-hole fix: internal paths whose FILE EXTENSION collides
with a TLD used to be reported as leaked domains, because the domain branch ran
before the internal-path check and no branch but the slug one applied it.
`.sh` is the sharp one — `agents/tooling/setup.sh` produced `setup.sh` at block
tier. Documentation subdomains of vendors the rule explicitly permits naming
were flagged for the neighbouring reason: the host allowlist matched exactly.
-->

> **Source:** agents/tooling/setup.sh

> **Source:** docs/design/logo.ai

> **Source:** docs.anthropic.com/en/docs/agents

> **Source:** the @anthropic-ai/claude-code package

> **Source:** raw.githubusercontent.com/event4u-app/agent-config/main/README.md
