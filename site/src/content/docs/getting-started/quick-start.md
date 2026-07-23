---
title: Quick Start
description: Try the 30-second read-only wedge, then run your first real task with the full install.
---

## The 30-second wedge

Drop one read-only subagent into any repo and watch it gate "done" — no wizard,
no lock-in, nothing else installed:

```bash
npx -y @event4u/agent-config init --tools=claude-code --profile=minimal
```

Then, in Claude Code:

```text
@production-validator check this branch is actually done
```

`production-validator` is read-only and single-purpose — it audits that no mock,
stub, TODO or placeholder remains on the shipped path and that the change ran
against real systems, not just green tests over hollow code.

## First real task

After a full install (`npx -y @event4u/agent-config init` → pick your
[experience](/agent-config/configuration/profiles/) and tools in the wizard →
**Finish**), start a normal task. The agent refines the request, plans it,
implements, and verifies — governed by the always-active
[rules](/agent-config/architecture/overview/) for your profile.

Two entry commands cover most work:

- `/work "<free-form prompt>"` — drive a prompt end-to-end (refine → plan →
  implement → test → verify), confidence-gated, no automatic git.
- `/implement-ticket` — the same loop, driven from a Jira/Linear ticket.

## The onboarding gate

On the **first turn** in a project, if onboarding has not completed
(`onboarding.onboarded: false`), the agent will ask you to run
`agent-config setup` before anything else. Finishing the wizard flips the flag
and silences the prompt. In headless/CI contexts (no `.agent-settings.yml`) the
gate stays inert.

## Next

- [Profiles & Packs](/agent-config/getting-started/profiles-and-packs/) — pick
  how much governance loads.
- [CLI Commands](/agent-config/cli/overview/) · [Agent Commands](/agent-config/agent-commands/overview/)
