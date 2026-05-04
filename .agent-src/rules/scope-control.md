---
type: "always"
tier: "safety-floor"
description: "Scope control — no unsolicited architectural changes, refactors, or library replacements"
alwaysApply: true
source: package
load_context:
  - .agent-src.uncompressed/contexts/authority/scope-mechanics.md
---

# Scope Control

- Do NOT introduce architectural changes unless explicitly requested.
- Do NOT replace existing patterns with alternatives.
- Do NOT refactor existing code solely to comply with current rules.
- Do NOT suggest new libraries unless explicitly requested.
- Existing code should only be modified if directly related to the current change, required for bug fixes, security, or explicitly requested.
- New or newly modified code MUST follow all coding rules.
- Stay within the established project structure and conventions.
- When unsure about the scope, ask the user.

## Git operations — permission-gated

The user decides the git shape of the work. Never improvise.

> **Commit specifics:** see the canonical [`commit-policy`](commit-policy.md)
> rule — narrower than the general "no git ops without permission"
> below (covers the never-ask-about-committing default and the
> roadmap-authorized exception).

- NEVER commit, push, merge, rebase, or force-push without explicit user permission.
- NEVER create a new branch, switch to a different branch, or delete a
  branch without explicit user permission. This includes spike, scratch,
  throwaway, and worktree branches.
- NEVER create, close, reopen, or change the target of a pull request
  without explicit user permission.
- NEVER push a tag or create a release without explicit user permission.
- NEVER include version numbers, target releases, deprecation dates,
  release-tied milestones, or git tags inside roadmaps, plans, tickets,
  or any other planning artifact. Roadmaps plan **work**; releases and
  tags are a separate decision the user makes outside the roadmap.
  Never surface "which release should this ship in?" as an option in
  numbered choices, ADRs, or roadmap text. If the user wants a release
  pinned to a milestone, they will say so explicitly.
- If a task seems to need a separate branch or PR, STOP and **brief
  the user before asking** — see
  [`scope-mechanics`](../contexts/authority/scope-mechanics.md)
  § Brief-before-asking for the required Why / What / How sequence.

"Explicit permission" means the user said so **in this turn or in a
standing instruction they have not revoked**. Earlier permission for a
different operation does not carry over.

## Production, infrastructure, bulk-destructive — Hard Floor

A subset of the operations above is **never** autonomous and never
auto-permitted by a standing autonomy directive. Canonical rule:
[`non-destructive-by-default`](non-destructive-by-default.md). The
trigger list (production-branch merges, deploys / releases, prod
data / infra, bulk-destructive ops) and the
"authorization is this turn, not earlier" clarification live in
[`scope-mechanics`](../contexts/authority/scope-mechanics.md)
§ Production, infrastructure, bulk-destructive.

## Decline = silence — no re-asking on the same task

After the user **declines** a proposal (branch switch, PR creation,
tag/release entry, separate worktree, version pinning in a roadmap),
do **not** raise the same proposal again on the same task. The decline
stands until the user reopens the topic themselves.

Timing and "is this worth asking?" guidance lives in
[`scope-mechanics`](../contexts/authority/scope-mechanics.md)
§ Decline = silence — context.

## Fenced step — user-set review gates

When the user explicitly fences off the next step — *"don't implement
yet"*, *"plan only"*, *"just write the roadmap, I'll review"*,
*"review first"*, *"erst Roadmap, ich schau drüber"*, *"nichts
implementieren"*, *"nur planen"*, *"erstmal nur X, dann ich"* — the
agent's reply is **the deliverable plus a handoff**, never the
deliverable plus *"shall we start?"*.

```
USER FENCED OFF EXECUTION → DELIVER + HAND BACK.
NO NUMBERED OPTION OFFERING TO BEGIN WORK.
NO "READY TO IMPLEMENT?" RE-ASK.
NO "STARTEN WIR MIT PHASE 1?" PIVOT.
```

The fence stands until the user reopens the topic themselves, exactly
like `Decline = silence` above. Permitted follow-up questions on the
same turn cover **the deliverable** (adjust scope, fix wording, add a
section), never **its execution**.

For the failure-mode catalog (Option 1 = "start now", re-asking after
delivery, hand-off-to-execution drift, inferring acceptance from a
thumbs-up) and the explicit bypass phrases that lift the fence, see
[`scope-mechanics`](../contexts/authority/scope-mechanics.md)
§ Fenced step.
