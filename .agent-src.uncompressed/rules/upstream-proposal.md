---
type: "auto"
tier: "2a"
description: "After creating or significantly improving a skill, rule, guideline, or command — ask if it should be contributed upstream to the shared package"
alwaysApply: false
source: package
---

# Upstream Proposal

## When to activate

After the agent **creates or significantly improves** any of these in a consumer project:

- Skill (new or major update)
- Rule (new or major update)
- Guideline (new or major update)
- Command (new or major update)

**Also activate when:**

- A project-specific skill/rule could be **generalized** to benefit all consumers
- An override was created that improves on the shared version
- A learning was captured that produced a high-quality new artifact

**Do NOT activate when:**

- Working inside the agent-config package itself (no self-referential proposals)
- The change is a trivial fix (typo, formatting)
- The user already declined upstream for this exact item in this conversation

## Consent check

**⛔ MANDATORY: Always ask the user. Never skip this step.**

After completing the creation/improvement, evaluate:

1. **Is this universal?** Could other projects benefit from this?
2. **Is this generalizable?** Even if project-specific, can it be abstracted?
3. **Is this high-quality?** Does it pass the promotion gate from `capture-learnings`?

If ANY of these is YES → propose to the user:

### For universal content (directly applicable):

```
> 🔄 The [skill/rule/guideline] `{name}` you just created could benefit all projects
> using the shared agent-config package.
>
> 1. Yes — contribute upstream via PR
> 2. No — keep project-local only
```

### For project-specific content (needs generalization):

```
> 🔄 The [skill/rule/guideline] `{name}` is project-specific, but I could generalize
> it for the shared package. [Brief explanation of what would change]
>
> 1. Yes — generalize and contribute upstream
> 2. No — keep project-local only
```

## After user response

- **User picks 1** → invoke `upstream-contribute` skill (which has its own consent gate for repo access)
- **User picks 2** → stop. Do NOT ask again for this item.
- **Max 1 proposal per created artifact** — never nag.

## Important

- **Consent is non-negotiable** — the user decides, always.
- **Do NOT batch proposals** — ask for each artifact separately.
- **Do NOT interrupt flow** — only propose AFTER the creation/improvement is complete.
- **Do NOT propose for trivial changes** — formatting, typos, comment updates.
- **Respect "no"** — if the user declines, do not revisit unless they bring it up.
- **Token efficiency** — this rule costs zero tokens when not triggered (auto type).
