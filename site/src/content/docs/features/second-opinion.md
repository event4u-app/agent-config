---
title: Get a second opinion from other AI models
description: Ask Anthropic and OpenAI models outside your session to critique a plan, a diff or a pull request — with a cost preview first and nothing spent until you confirm.
---

Ask other AI models to critique your plan, diff or pull request — preview the cost first:

```bash
agent-config council:estimate "Should the export run in a background job?"
```

In your AI tool:

```text
/council:default prompt:"Should the export run in a background job?"
/council:pr 482
```

## What it does

Agent Config sends your question — a prompt, a roadmap, a diff or a set of files — to models from other providers than the one you are working with, then collects their answers side by side. Each member sees a neutral, redacted framing, not your agent's opinion of the answer. The result is advice; nothing is changed or posted for you.

- `/council:default` — a plan, a prompt, a roadmap, a diff or files.
- `/council:pr <number>` — a GitHub pull request; read-only unless you ask it to comment.
- `/council:design`, `/council:optimize`, `/council:debate` — the same with a lens for design, optimisation or a structured debate.
- `/roadmap:ai-council` — challenges a roadmap before you start it.

## When to use it

For decisions that are expensive to get wrong: an architecture choice, a migration plan, a pull request on a sensitive path. Not for routine changes — every call costs money.

## What it needs

- An API key for **Anthropic**, **OpenAI** or both, stored once for your user:

  ```bash
  agent-config keys:install-anthropic
  agent-config keys:install-openai
  ```

- `agent-config council:status` shows whether a council is configured, without spending anything.

## Cost

`council:estimate` previews the cost and makes no API call. `council:run` spends only with `--confirm`, and a daily per-provider cap stops runaway use. Your keys and the council settings live in your user folder, `~/.event4u/agent-config/`, never in a repository.

## Limits

- Other models disagree too: a split answer is information, not a verdict.
- Your question, and the files or diff you choose, are sent to the providers you configured. [What leaves your machine](/agent-config/trust/network/).
