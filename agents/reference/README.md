# agents/reference/ — tracking justification

Deliberately **tracked** (decision 2026-07-12, road-to-opt-hygiene-and-debt
Phase 3): 37 files, ~0.1 MB — the on-disk directory is larger only through
gitignored local content.

Why tracked:

- `ai-video/` — provider smoke traces + worked scene examples. The
  provider-lifecycle contract requires maintainer-captured real-API smoke
  traces to live here as promotion evidence
  (`docs/contracts/provider-lifecycle.md` § promotion path); the banana-arc
  scene examples are the reference fixtures the video skills cite.
- `docs/` — durable reference notes consumed by skills/contexts.
- `ghostwriter/` — reference fixture for the write-engine contract.

Anything bulky or regenerable stays gitignored next to these (same
directory, local-only). New subdirectories state their consumer here or
move to `docs/`.
