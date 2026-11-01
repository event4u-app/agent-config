---
title: Requirements
description: What you need before installing Agent Config — Node 22.6 or newer, macOS, Linux or WSL2, and at least one AI coding tool.
---

You need Node 22.6 or newer and one AI coding tool. Check your Node version first:

```bash
node --version   # v22.6.0 or newer
```

| Requirement | Version | Notes |
|---|---|---|
| **Node.js** | 22.6.0 or newer | The floor in `package.json` `engines`. Every install path needs it, the curl fallback included. |
| **An AI coding tool** | any supported | Claude Code, Cursor, Copilot, Codex, Windsurf, Gemini CLI and others — see [Which install do I get?](/agent-config/tools/overview/) |
| **Operating system** | macOS · Linux · WSL2 | Git Bash on Windows needs Developer Mode for symlinks; native PowerShell and cmd are not supported. |
| **git** | any recent | Used to find your repository root. |
| **curl** or **wget** | any | Only for the curl install fallback. |
| **A browser** | any | Only for the setup wizard; `init --yes` installs without one. |

Python is not required.

## API keys

None for the core install — your AI tool brings the model. An Anthropic or OpenAI key is needed only for the optional [second opinion from other AI models](/agent-config/features/second-opinion/).

## Next

- [Install](/agent-config/getting-started/installation/)
