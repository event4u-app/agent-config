# Audit 1 — Consumer-contract surface

> Verdict: **✅ Pass.** Published consumer surface is fully enumerated. Phase 1 moves (`bench/`, `evals/`, `workers/` → `internal/`) are contract-safe. Phase 3 has clear "movable" vs "frozen" inventory.

## Method

1. Read `package.json#files` — the npm publish allowlist.
2. Read `.npmignore` — the negative surface.
3. Read `setup.sh` — the curl entrypoint (GitHub-tarball install path).
4. Grep `scripts/install.py` for all hardcoded source paths the installer reads.
5. Cross-reference Phase 1 dirs (`bench/`, `evals/`, `workers/`, `user-types/`) against the published surface.

## Findings

### Published surface (npm `files` array)

```
.agent-src/        .augment-plugin/   .claude-plugin/    config/
dist/              docs/              scripts/           templates/
AGENTS.md          CHANGELOG.md       CONTRIBUTING.md    LICENSE
README.md          llms.txt
```

Plus `bin: { "agent-config": "dist/cli/agent-config.js" }`.

### Negative surface (`.npmignore`)

`.agent-src.uncondensed/`, `agents/`, `.idea/`, `.vscode/`, `tmp/`, dev-only dirs.

### Curl entrypoint (`setup.sh`)

```
curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash
```

Downloads GitHub tarball → invokes `scripts/install.py`. Tarball ships **everything in git**, not just the npm `files` array — so `bench/`, `evals/`, `workers/` were technically reachable via the curl path even when not in `files`. But `scripts/install.py` never references them, so they were never **read** by consumers regardless of installation path.

### Installer hardcoded reads (`scripts/install.py`)

- `USER_TYPES_DIR = "user-types"` (line 52) — **frozen**, referenced by `--user-type=<id>` flag.
- Projection mappings from `.agent-src/<sub>` to host-tool anchors (lines 2174–2220):
  - `.agent-src/rules`, `.agent-src/skills`, `.agent-src/personas`, `.agent-src/commands`, `.agent-src/contexts`, `.agent-src/templates`
- These six paths are the **public projection contract**. Renaming `.agent-src/` itself requires installer-version-bump + deprecation window.

### Phase 1 dirs vs published surface

| Dir | In `package.json#files`? | Read by `install.py`? | Verdict |
|---|---|---|---|
| `bench/` | ❌ no | ❌ no | ✅ Movable (Phase 1 ✅) |
| `evals/` | ❌ no | ❌ no | ✅ Movable (Phase 1 ✅) |
| `workers/` | ❌ no | ❌ no | ✅ Movable (Phase 1 ✅) |
| `user-types/` | ⚠️ shipped via `.agent-src/` projection | ✅ yes (`USER_TYPES_DIR`) | 🔒 Frozen at root |

## Movability classification (for Phase 3)

- **🔒 Frozen at root** (breaking change to move): `scripts/`, `templates/`, `config/`, `dist/`, `docs/`, `AGENTS.md`, `LICENSE`, `README.md`, `CHANGELOG.md`, `setup.sh`, `user-types/`, `package.json`, `package-lock.json`, `.agent-src/` (root anchor of projection contract).
- **🟡 Internal-only** (movable with maintainer-only consequences): `agents/`, `bench/`, `evals/`, `workers/`, `tests/`, `taskfiles/`, `internal/` (now exists).
- **🟢 Generated** (movable if generator updated atomically): `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `dist/router.json`.

## Verdict: ✅ Pass

Phase 1 moves are zero-risk. Phase 3 has a clear inventory: any "frozen at root" entry in the table above is a no-go without an installer-version-bump + deprecation cycle. The eight ".agent-src/<sub>" projection paths are the structural lock-in.

## Evidence

- `package.json` lines 1–end (the `files:` array).
- `.npmignore` lines 1–end.
- `setup.sh` lines 1–60.
- `scripts/install.py` lines 52, 2174–2220, 880 (`./node_modules/@event4u/agent-config/plugin/agent-config`).
