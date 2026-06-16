---
adr: 060
status: accepted
date: 2026-06-07
decision: comfyui-sandbox-model
supersedes: —
superseded_by: —
phase: video deferred design (road-to-video-deferred-design, Phase 2)
type: structural
---

# ADR-060 — ComfyUI local adapter: container-primary sandbox, pinned nodes, shipped templates only

## Status

**Accepted** · 2026-06-07. Design converged via two-round AI-council debate
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode + peer review,
2026-06-07): container-primary isolation with a remote escape hatch, hard
pinned-node allowlist, package-shipped workflow templates only. The one
divergence (soft-warn vs hard-refuse on unpinned nodes) resolved to
**hard-refuse** — any escape hatch defeats the threat model. The adapter
ships only after this design.

## Context

A local ComfyUI adapter is the local-free render path for GPU users
(Wan2.2 TI2V-5B, Apache-2.0, as default template; LTX-2 for audio-sync).
The prior council round (2026-06-06) ruled ComfyUI *"a hard no until
sandboxed"*: custom nodes are arbitrary Python fetched from the internet, a
workflow JSON can reference any node, and a stock ComfyUI server has full
host-filesystem access. This package is a shell-first skill suite — it can
*require* and *verify* a posture, but cannot enforce kernel-level isolation
from a shell adapter. The design must name the smallest enforceable surface
and the residual risk.

## Decision

### 1. Isolation — container-primary, remote escape hatch (hybrid a + d)

- **Default (the only documented install path): containerized ComfyUI**
  (Docker/Podman, NVIDIA container toolkit for CUDA):
  - read-only image; `--cap-drop ALL --cap-add SYS_NICE` (GPU scheduling
    needs SYS_NICE; nothing else is granted);
  - **no host mounts** except two explicit volumes: models (read-only) and
    a per-project artifacts volume (the only writable surface);
  - `--network none` at generation time; `COMFYUI_ALLOW_NETWORK=true` is
    the visible opt-in for model-download sessions ("download once, then
    air-gap"). No egress allowlist in this ADR — domain allowlists for
    model hosts are unenforceable false precision from a shell suite; the
    network-off default is the policy lever.
- **Remote escape hatch:** the adapter MAY target an operator-run ComfyUI
  endpoint (`<endpoint>` in `agents/.ai-video.xml`). The package takes
  **no responsibility for isolating a remote endpoint** — that posture is
  the operator's, and the config requires the explicit marker
  `<unsandboxed>accepted</unsandboxed>` for any endpoint the adapter
  cannot verify as the shipped container. Refuse-and-surface otherwise.
- **macOS:** no CUDA → the container path is **reference-only on macOS**
  (domain-adoption-policy Gate 3 wording); the remote escape hatch is the
  macOS path.

### 2. Custom nodes — pinned allowlist, hard-refuse

- The package ships `scripts/ai-video/lib/comfyui-nodes.allowlist.json`:
  every entry pins **repo URL + git commit SHA** and carries a
  `risk_tier: low|medium|high` field driving audit cadence (high =
  monthly, low = quarterly review).
- A workflow referencing a node outside the allowlist is **hard-refused**
  (exit 7, named node). There is **no** `--allow-unaudited-nodes` flag and
  no soft-warn mode — an escape hatch defeats the threat model (council
  round 2, explicit convergence).
- Kill-switch criteria: a node with >2 CVSS-≥7 CVEs in 90 days is removed
  from the allowlist and dependent templates marked deprecated; a
  demonstrated container escape against the documented constraint set
  yanks the adapter from the default pack manifest pending ADR revision.

### 3. Workflow templates — package-shipped only

- Only the templates under `scripts/ai-video/lib/comfyui-templates/`
  (Wan2.2 TI2V-5B default; LTX-2 audio-sync) are executable. Operator-
  supplied workflow JSONs are rejected — the prompt surface is **parameter
  substitution into the shipped template** via `jq --arg` (structured,
  never string-spliced), with a charset whitelist on every substituted
  value (the `model_id` tainted-input rule from contract v2 generalized).

### 4. Filesystem + network boundary

- Models directory: read-only mount. Output: per-project artifacts volume
  only; the adapter validates every returned path with
  `aiv_validate_artifact_path` against the project root (contract v2
  unchanged — a local provider is still untrusted output).
- Generation-time network: off by default (§ 1). The adapter itself talks
  to ComfyUI's HTTP API on a loopback/container port only.

### 5. Contract fit (v2)

- `submit` → POST `/prompt` (returns `prompt_id`); `poll` → GET
  `/history/<prompt_id>` (stateless); `fetch` → download via
  `aiv_fetch_url` from `/view` into the scene dir. The async triple fits
  without contract changes.
- **Local-source rule (additive contract note):** a `kind="local"`
  provider consumes local *input* paths (validated project-scoped) instead
  of the https-only rule written for hosted lip-sync inputs — the https
  rule exists because hosted providers must fetch the bytes; a local
  engine reads the shared volume.
- `cost_estimate`: a local render is priceable at **`0.0`** (no provider
  charge — a *known* zero, distinct from an omitted/unknown estimate; the
  cost gate continues to treat *missing* as `unknown`, never `0`).
- GPU absence: detected at `submit` (ComfyUI unreachable / container not
  running) → exit 3 with the setup hint, never a hang.

## Residual risk (explicit)

A malicious pinned node could still act within the container (CPU/GPU
abuse, poisoning outputs on the shared artifacts volume). Mitigations:
allowlist audit cadence by `risk_tier`, read-only model mount, network-off
default. A kernel-grade guarantee is out of scope for a config suite — the
container constraint set + pinned nodes + shipped-templates-only is the
smallest enforceable surface that keeps "arbitrary Python from the
internet" out of the execution path.

## Consequences

- The adapter (`scripts/ai-video/adapters/comfyui.sh`) ships
  `lifecycle: experimental`, dry-run-first like every other adapter; the
  live path requires the container posture above.
- New lib artifacts: `comfyui-nodes.allowlist.json`,
  `comfyui-templates/` (Wan2.2 TI2V-5B, LTX-2), each test-locked.
- Setup documentation (container run line, model download session) lives
  in the adapter header — docs-over-code where enforcement is impossible.

## Alternatives considered

- **OS-level sandbox (firejail/bwrap/sandbox-exec)** — rejected: per-OS
  divergence, weaker GPU story, harder to verify from a shell adapter.
- **Trusted-local (no sandbox, audited nodes only)** — rejected: "audited"
  without isolation still executes arbitrary Python on the host; violates
  the 2026-06-06 hard-no.
- **Remote-only (no local story)** — rejected as the *only* mode: the
  local-free path for GPU users is the feature; remote stays as the
  escape hatch with explicit operator-owned risk.
- **Soft-warn on unpinned nodes** — rejected (round-2 convergence): any
  bypass flag reopens the arbitrary-Python door the sandbox exists to
  close.

## References

- Council artefact: two-round debate 2026-06-07 (members above), design
  mode, peer review on — convergence summarized inline per
  `no-roadmap-references`.
- ADR-059 — sibling design (resume) from the same roadmap phase.
- `src/scripts/media/lib/adapter-contract.md` — v2 contract the
  adapter implements; local-source rule lands there as an additive note.
- Roadmap: road-to-video-deferred-design, Phase 2 (transient layer —
  not path-linked per `no-roadmap-references`).
