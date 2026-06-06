# Pipeline D — Claude.ai cloud bundle

> **Scope:** package shipped skills into Anthropic Skills ZIP bundles
> for upload to Claude.ai Web or the Skills API. Cloud-side surfaces
> have no filesystem access, so the builder applies sandbox-aware
> transformations not needed in the on-disk projections.

## Input → Transform → Output

```
dist/agent-src/skills/<id>/SKILL.md     ← Condensed skill (+ supporting assets)
    ↓ scripts/build_cloud_bundle.py
dist/cloud/<skill>.zip              ← Anthropic Skills bundle (Claude.ai Web / Skills API)
```

Per-skill tier classification comes from
[`scripts/audit_cloud_compatibility.py`](../../src/scripts/audit_cloud_compatibility.py):

| Tier | Bundle action |
|---|---|
| **T1** | Bundle as-is — pure guidance, sandbox-safe |
| **T2** | Bundle with prepended sandbox note + package-internal path-swap |
| **T3-S** | Same as T2; optional script calls degrade gracefully on cloud |
| **T3-H** | **Skipped** — cloud-aware variant required before bundling |

Cloud-side caps enforced by the builder:

- `description` ≤ 200 chars (Claude.ai Web display limit).
- 1024-char hard cap (Anthropic Skills API spec).
- Sandbox note explains to the agent that `dist/agent-src/`, `agents/`,
  and `task …` references are descriptive — the host has no
  filesystem access.

## Entry points

| Surface | Command |
|---|---|
| Build one skill | `task build-cloud-bundle -- SKILL=<id>` ([`taskfiles/engine.yml:184`](../../taskfiles/engine.yml)) |
| Build all eligible | `task build-cloud-bundles-all` ([`taskfiles/engine.yml:189`](../../taskfiles/engine.yml)) |
| CI dry-run | `task ci-cloud-bundle` ([`taskfiles/engine.yml:194`](../../taskfiles/engine.yml)) |
| Tier audit only | `task audit-cloud` ([`taskfiles/engine.yml:199`](../../taskfiles/engine.yml)) |

## Invariants

1. **No T3-H bundles** — high-coupling skills are skipped, never
   silently bundled with broken expectations.
2. **Description budget enforced** — overlong descriptions fail
   the build (and CI via `ci-cloud-bundle --check`).
3. **Package-internal paths swapped** — references to `dist/agent-src/`,
   `scripts/`, `agents/` are rewritten to descriptive form so the
   cloud agent does not attempt filesystem access.
4. **`mcp_scope: lite`** — bundles tagged `lite` may not reference
   MCP servers that require local stdio (per
   [`docs/contracts/mcp-cloud-scope.md`](../contracts/mcp-cloud-scope.md)).
5. **Deterministic ZIP** — same skill input produces identical
   archive bytes (modulo timestamps, normalized in the builder).

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `ci-cloud-bundle` fails on a skill | description > 200 chars, or T3-H detected | shorten frontmatter, or add cloud variant |
| `frontmatter.description` reflows to the prompt unexpectedly | over the 200-char Claude.ai cap (hard 1024) | tighten the description |
| Bundle references `dist/agent-src/` in body | path-swap rule missing | extend `build_cloud_bundle.py` rewrite table |
| Skill silently dropped from `dist/cloud/` | T3-H tier (cloud-unsafe) | author a cloud-aware variant, re-classify |

## Proving the pipeline

- [`tests/test_build_cloud_bundle.py`](../../tests/test_build_cloud_bundle.py)
  — covers tier filtering, sandbox-note injection, path-swap, and
  description-cap enforcement.
- [`tests/test_claude_desktop_bundler.py`](../../tests/test_claude_desktop_bundler.py)
  — complementary coverage for the Claude Desktop bundle surface.
- CI gate: `task ci-cloud-bundle` runs the builder in `--check` mode
  on every PR.

← [Architecture overview](../architecture.md)
