---
type: "auto"
tier: "mechanical-already"
description: "Naming an external repo as something this package copied, harvested, compared against, or was inspired by — keep the tracked tree source-anonymous"
alwaysApply: false
triggers:
  - path_prefix: "src/skills/"
  - path_prefix: "src/rules/"
  - path_prefix: "src/domains/"
  - path_prefix: "docs/"
  - path_prefix: "agents/evidence/"
  - path_prefix: "agents/roadmaps/"
  - intent: "adopt or harvest from an external repo"
  - intent: "compare against another package"
  - intent: "attribute an idea to an external source"
validator_ignore:
  - type: "substring"
    pattern: "external_sources_denylist"
    reason: "Rule names the linter/denylist asset that necessarily holds the tokens."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Source Confidentiality

## The Iron Law

```
NEVER WRITE THAT THIS PACKAGE COPIED / FORKED / PORTED / ADAPTED /
WAS-INSPIRED-BY / COMPARED-AGAINST A NAMED EXTERNAL SOURCE
INTO A TRACKED ARTIFACT.
RECOMMENDING OR INTEGRATING A TOOL IS FINE. DERIVATION-ATTRIBUTION IS NOT.
A RETAINED SOURCE LINK IS STORED ENCRYPTED, NEVER IN PLAINTEXT.
```

Tracked tree must not reveal which third-party packages seeded ideas
(2026-06-13 source-confidentiality sweep). Git history not rewritten — rule +
backstop guard **new** commits only.

## Fires when

Authoring/editing a skill, rule, command, guideline, context, ADR, doc,
roadmap, changelog, or script and about to name an external repo / project as
something we learned from, harvested, compared against, or copied.

## Allowed — do NOT scrub

- **Recommending / integrating** a tool or registry ("install X", "submit to
  the Y registry", "wraps the Z CLI"). Naming the tool is fine.
- **License-required attribution** for genuinely vendored Apache/MIT code —
  the one place an upstream name legitimately stays (see `ADR-061`; vendored
  cluster carved out in `external_sources_denylist.json`).

## Required instead

- Drop the source name — say "an external reference" or omit.
- Retain a real link → encrypt via `src/scripts/_lib/link_crypto.py` (key in
  gitignored `.agent-settings.yml` `secrets.link_encryption_key`,
  project-then-global).
- Pure harvest / comparison / competitive evidence stays **local-only**
  (gitignored) — never tracked.

## Backstop

The `check-no-external-sources` CI gate
(`src/scripts/check_no_external_sources.py` + `external_sources_denylist.json`)
runs in the package CI pipeline, fails the build on any denied source token in
a non-carve-out tracked file. Deterministic net, not a substitute for not
writing the attribution.

## See also

- [`source-of-truth`](source-of-truth.md) — edit `src/`, never projections.
- [`augment-edit-discipline`](augment-edit-discipline.md) — portability + cross-ref sync.
- `src/scripts/_lib/link_crypto.py` — encrypted link storage.
