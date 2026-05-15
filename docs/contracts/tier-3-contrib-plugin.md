---
stability: beta
keep-beta-until: 2026-08-12
---

# Tier-3 contrib plugin pattern

**Purpose.** Document the deferred-implementation contract for
**Tier-3 community AIs** — surfaces that have been named in scoping
discussions or council rounds but have **not yet been requested by
a real user**. Tier-3 ships when the first user request lands, not
on speculation.

**Scope.** Defines the candidate list, the manifest shape, the
promotion path from Tier-3 → Tier-2, and the non-implementation
guarantee. Does **not** ship code: `agents/manifests/contrib/` is
unmanifested until a user asks for an entry by name.

Last refreshed: 2026-05-12.

## Tier definitions

| Tier | Status | Trigger | Implementation |
|---|---|---|---|
| **Tier-1** | Shipped | First-class surfaces with daily users | Imperative bridge in `scripts/install.py` |
| **Tier-2** | Shipped | Named in roadmaps + has plausible audience | Imperative bridge, same pattern as Tier-1 |
| **Tier-3** | **Deferred** | Named in scoping/council but zero user demand | Manifest YAML in `agents/manifests/contrib/` (not yet implemented) |

Phase 2.1 + 2.2 of the `road-to-global-first-install` roadmap
(under `agents/roadmaps/`) closed Tier-1 and Tier-2 at **16 AIs**.
Tier-3 is the explicit overflow bucket.

## Candidate list (frozen at proposal time)

The following surfaces are Tier-3 candidates as of 2026-05-12. They
were surfaced during the
[`2026-05-12-installer-expansion`](../../agents/council-sessions/2026-05-12-installer-expansion/synthesis.md)
council round and have **no entries** in `_VALID_TOOLS`,
`USER_SCOPE_PATHS`, `SCOPE_SUPPORT`, or the bash `VALID_TOOLS` set.

- `qoder` — community fork, no public adoption signal
- `trae` — ByteDance IDE, behind login wall
- `opencode` — bundled into VS Code variants; coverage already via `vscode`
- `codebuddy` — Tencent-internal, no public install path
- `droid` — proposed CLI agent, alpha
- `warp` — terminal-with-AI; integration shape unclear (PTY vs file marker)
- `antigravity` — Google research project, no shipping surface

Inclusion in this list is **not** a commitment to ship. Promotion
requires a real user asking by name (issue, PR, council session, or
recorded ask).

## Manifest shape (when implemented)

When the first user request lands, the responder MUST:

1. Create `agents/manifests/contrib/<tool-id>.yml` matching the
   schema below.
2. Add the tool ID to `_VALID_TOOLS`, `USER_SCOPE_PATHS`,
   `SCOPE_SUPPORT`, and the bash `VALID_TOOLS` set.
3. Implement `ensure_<tool>_bridge` in `scripts/install.py` (≤60 LOC
   — if larger, escalate via ADR per Phase 2.5 gate).
4. Append a row to the `README.md` "Supported Tools" table.
5. Re-run `task lint-skills` + `python3 -m pytest tests/test_install_py.py`.

```yaml
# agents/manifests/contrib/<tool-id>.yml
tool_id: <slug>           # lowercase, hyphen-separated
display_name: <Pretty>    # for README + CLI catalog
scope: project | global | both
discovery: marker | hook | config-merge
marker_path: <relative>   # e.g. .tool-id/agent-config.md
requested_by: <ref>       # GitHub issue, PR, council session, etc.
requested_date: YYYY-MM-DD
notes: |
  Short rationale, integration shape, known limitations.
```

## Non-implementation guarantee

`agents/manifests/contrib/` does **not** exist until needed. CI does
not enforce its presence. The pattern is documented, not scaffolded.

This prevents two failure modes:

1. **Empty-shell drift** — a directory of YAML stubs with no
   corresponding code, where the manifest claims support but the
   installer silently no-ops.
2. **Speculative breadth** — adding 7 IDs to `_VALID_TOOLS` "in
   case" a user asks, then carrying maintenance cost on dead code.

## Promotion path

Tier-3 → Tier-2 promotion happens in a single PR:

1. The first user request anchors the PR (link in commit body).
2. Manifest YAML lands alongside the bridge.
3. README + roadmap update in the same commit.
4. After two reported successful installs (or one release cycle of
   no bug reports), the tool moves out of `contrib/` and the manifest
   YAML is deleted — the bridge stands on its own under the Tier-2
   contract.

There is no Tier-3 → Tier-3 churn: a candidate either gets
requested and promoted, or stays unimplemented indefinitely. We do
not "preemptively scaffold" Tier-3 entries.

## Out of scope

- **Capability matrices** — the manifest does not describe what the
  tool _can_ do, only what the installer must emit. Capability docs
  live in the consumer tool's own documentation.
- **Auto-discovery** — there is no plugin loader. The installer is
  imperative (see Phase 2.5 gate); manifests are a documentation
  contract, not a runtime input.
- **Third-party contribution channel** — this contract governs the
  package maintainer's response to user requests, not a community
  plugin marketplace. External plugins would require ADR-009+ to
  introduce a stable extension surface.

## Cross-references

- [`ADR-007`](../decisions/ADR-007-agent-discovery-scopes.md) —
  project / global / both scope taxonomy that Tier-3 entries inherit.
- [`ADR-008`](../decisions/ADR-008-installed-tools-manifest.md) —
  `agents/installed-tools.lock` for per-project state, distinct
  from this maintainer-side contract.
- The `road-to-global-first-install` roadmap (under
  `agents/roadmaps/`) Phase 2.6 — completion trigger for this contract.
