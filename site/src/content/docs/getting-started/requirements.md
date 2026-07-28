---
title: Requirements
description: Node, Python, downloader and platform prerequisites for installing and building agent-config.
---

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | **≥ 20.11.0** | Authoritative (`package.json` `engines`). Runs the bundled installer and CLI. |
| Node (docs site build) | ≥ 22.12 | Only if you build the Starlight docs site locally (Astro 7). |
| Python | 3.10+ | **Bridge stage only** — if missing, the installer skips host bridges. |
| Downloader | `curl` or `wget` | For the curl one-liner install path. |
| git | any recent | Repo-root resolution walks to the nearest `.git`. |
| Platform | macOS 12.3+ · Linux · WSL2 | Git Bash needs Developer Mode for symlinks; native PowerShell/cmd is unsupported. |

> Some older prose in the repo mentions "Node 18" — the authoritative floor is
> **Node ≥ 20.11.0** (`package.json` `engines`).

## Next

- [Installation](/agent-config/getting-started/installation/)
- [Quick Start](/agent-config/getting-started/quick-start/)
