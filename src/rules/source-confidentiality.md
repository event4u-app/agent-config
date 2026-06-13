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

The tracked tree must not reveal which third-party packages seeded ideas
(established by the 2026-06-13 source-confidentiality sweep). Git history is
not rewritten — this rule and its backstop guard **new** commits only.

## Fires when

Authoring or editing a skill, rule, command, guideline, context, ADR, doc,
roadmap, changelog, or script and about to name an external repo / project as
something we learned from, harvested, compared against, or copied.

## Allowed — do NOT scrub

- **Recommending / integrating** a tool or registry ("install X", "submit to
  the Y registry", "wraps the Z CLI"). Naming the tool is fine.
- **License-required attribution** for genuinely vendored Apache/MIT code —
  the one place an upstream name legitimately stays (see `ADR-061`; the
  vendored cluster is carved out in `external_sources_denylist.json`).

## Required instead

- Drop the source name — say "an external reference" or omit it.
- To retain a real source link, encrypt it via
  `src/scripts/_lib/link_crypto.py` (key in the gitignored `.agent-settings.yml`
  under `secrets.link_encryption_key`, resolved project-then-global).
- **Raw named evidence** that cannot be understood without the source names
  (clone dumps, full competitor audits, scraped comparison tables) stays
  **local-only** — gitignored (`agents/tmp/`, `agents/.harvest-local/`), never
  tracked.

## Harvest / comparison / borrow ROADMAPS go in `agents/roadmaps/` — anonymized, not hidden

An actionable harvest / comparison / borrow **roadmap** belongs in the normal
tracked `agents/roadmaps/` directory so the roadmap-progress dashboard tracks it
and its completion is visible. Make it tracked-safe by **anonymizing**, not by
hiding it in `agents/.harvest-local/`:

- Reference sources as **Source A / B / C** (or a neutral descriptor like "an
  external operator-runtime reference") — never the repo / org / author name.
- Retain real links as `ENC1:` tokens (`link_crypto.py`) in a Provenance block —
  maintainer-recoverable, opaque in the tree.
- The borrow *items* are this package's own features; they never need the source
  name in the first place.

```
A ROADMAP THAT CITES A SOURCE IS ANONYMIZED AND TRACKED IN agents/roadmaps/.
IT IS NEVER HIDDEN IN .harvest-local/ JUST BECAUSE IT MENTIONS A SOURCE.
.harvest-local/ IS FOR RAW EVIDENCE THAT CANNOT BE ANONYMIZED — NOT FOR PLANS.
```

## Backstop

The `check-no-external-sources` CI gate
(`src/scripts/check_no_external_sources.py` + `external_sources_denylist.json`)
runs in the package CI pipeline and fails the build on any denied source token
in a non-carve-out tracked file. The linter is a deterministic net, not a
substitute for not writing the attribution in the first place.

## See also

- [`source-of-truth`](source-of-truth.md) — edit `src/`, never the projections.
- [`augment-edit-discipline`](augment-edit-discipline.md) — portability + cross-ref sync.
- `src/scripts/_lib/link_crypto.py` — encrypted link storage.
