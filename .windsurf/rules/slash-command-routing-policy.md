---
trigger: model_decision
description: When user types a slash command like /create-pr, /commit, or pastes command file content
globs: 
---

# Slash Command Routing Policy

**Iron Law.** On a slash-command invocation or pasted command body, route to the matching command file; never improvise.

Body migrated to `skill:command-routing` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
