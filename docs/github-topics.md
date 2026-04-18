# GitHub Topics

GitHub Topics improve repository discoverability. They are stored as **repository metadata**
on GitHub — they cannot be set via files in the repository. This page documents the
recommended topics so a maintainer can apply them via the GitHub UI or API.

## Recommended topics

Set on `github.com/event4u-app/agent-config` → **Settings → About → Topics**:

```
ai-coding
agent-skills
agent-rules
governance
laravel
php
devcontainer
augment-agent
claude-code
copilot
agentskills-standard
```

## Rationale

| Topic | Why |
|---|---|
| `ai-coding` | Primary category — discovered via "AI coding assistant" searches |
| `agent-skills` | Aligns with the [Agent Skills](https://agentskills.io) community spec |
| `agent-rules` | Complementary — rules govern behavior, skills provide expertise |
| `governance` | Differentiates from prompt collections |
| `laravel` | Primary domain — Laravel projects are the main audience |
| `php` | Broader PHP audience |
| `devcontainer` | One of our 4 core concerns |
| `augment-agent`, `claude-code`, `copilot` | Tool-specific discovery |
| `agentskills-standard` | SKILL.md format is compatible with the agentskills.io spec |

## How to apply

### Via GitHub UI

1. Open the repository on github.com.
2. Click the gear icon next to **About** on the right sidebar.
3. Add each topic under **Topics** (max 20 per repo).
4. Save.

### Via GitHub CLI

```bash
gh repo edit event4u-app/agent-config \
  --add-topic ai-coding \
  --add-topic agent-skills \
  --add-topic agent-rules \
  --add-topic governance \
  --add-topic laravel \
  --add-topic php \
  --add-topic devcontainer \
  --add-topic augment-agent \
  --add-topic claude-code \
  --add-topic copilot \
  --add-topic agentskills-standard
```

### Via GitHub REST API

```bash
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/event4u-app/agent-config/topics \
  -d '{"names":["ai-coding","agent-skills","agent-rules","governance","laravel","php","devcontainer","augment-agent","claude-code","copilot","agentskills-standard"]}'
```

## Verify

```bash
gh repo view event4u-app/agent-config --json repositoryTopics \
  --jq '.repositoryTopics[].name'
```

---

← [Back to README](../README.md)
