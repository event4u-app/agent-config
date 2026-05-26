# internal/

Maintainer-only tooling. **Not shipped to consumers.** Convention pinned to
[`docs/decisions/ADR-028-root-layout.md`](../docs/decisions/ADR-028-root-layout.md).

Nothing under this directory is part of the public contract:

- not symlinked by `scripts/install.py`
- not projected by `scripts/compress.py`
- not referenced by any installer or projector path constant
- not consumed by the `dist/router.json` runtime

## Contents

| Path | Purpose |
|---|---|
| [`bench/`](bench/) | Unified bench orchestrator — corpora, pricing, reports |
| [`evals/`](evals/) | Skill-trigger evaluation runs (gitignored runtime output) |
| [`workers/`](workers/) | Cloudflare MCP worker source (`internal/workers/mcp/`) |
| [`docker/`](docker/) | Maintainer-only Dockerfiles (e.g. `internal/docker/mcp-server/Dockerfile`) |
| [`schemas/`](schemas/) | Maintainer-only JSON Schemas (`retrieval-v1.schema.json`, `wizard-apply-payload.schema.json`); `scripts/schemas/` is the published artefact-schema tree |
| `.compression-hashes.json` | Hash ledger for `scripts/compress.py` (rewritten on every sync) |

## Placement rule

Any new maintainer-only tool — bench harness, eval driver, deploy worker,
research scratchpad — **lives here**, not at root. If unsure whether a
new directory belongs at root or under `internal/`, the test is: *would
a consumer of `@event4u/agent-config` ever need to reference this path?*
If no, it belongs under `internal/`.
