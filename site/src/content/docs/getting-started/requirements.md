---
title: Requirements
description: Node, downloader and platform prerequisites for installing and building agent-config.
---

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | **≥ 20.11.0** | Authoritative (`package.json` `engines`). Runs the bundled installer and CLI — on **every** install path, the curl one-liner included. |
| Node (docs site build) | ≥ 22.12 | Only if you build the Starlight docs site locally (Astro 7). |
| Downloader | `curl` or `wget` | For the curl one-liner install path. |
| git | any recent | Repo-root resolution walks to the nearest `.git`. |
| Platform | macOS 12.3+ · Linux · WSL2 | Git Bash needs Developer Mode for symlinks; native PowerShell/cmd is unsupported. |

> Some older prose in the repo mentions "Node 18" — the authoritative floor is
> **Node ≥ 20.11.0** (`package.json` `engines`).

> **Python is not required.** Older pages listed Python 3.10+ for a "bridge
> stage"; that stage has been TypeScript since ADR-200, and a CI guard
> (`no-python-in-src`) keeps `src/` Python-free.

## Next

- [Installation](/agent-config/getting-started/installation/)
- [Quick Start](/agent-config/getting-started/quick-start/)
