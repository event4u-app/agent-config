# Initial-context token audit

- generated: `2026-06-16T03:12:51+00:00`
- token method: tokens_gpt: proxy (chars/4.0, tiktoken not installed); tokens_claude: proxy (chars/3.6)

## 0B.2 — always-on rule footprint per tool

| tool | files | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|

## 0B.4 — description-catalog cost (eager)

| catalog | entries | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| skills_projected | 0 | 0 | 0 | 0 |
| skills_core_source | 238 | 46,680 | 11,670 | 12,967 |
| commands_core_source | 155 | 22,358 | 5,590 | 6,211 |

## 1.3 — top-10 longest rules (token trim candidates)

| rule | GPT tok | chars |
|---|--:|--:|

## MCP — tool-schema cost per server (always-loaded for connected clients)

| server | tools | chars | GPT tok | Claude tok | over-subscribed? |
|---|--:|--:|--:|--:|:--:|
| `agent-config` | 20 | 13,925 | 3,482 | 3,867 | no |

### `agent-config` — top-10 tools by schema cost

| tool | GPT tok | chars |
|---|--:|--:|
| `chat_history_append` | 396 | 1,585 |
| `memory_lookup` | 262 | 1,048 |
| `chat_history_read` | 254 | 1,014 |
| `memory_signal` | 222 | 887 |
| `lint_skills` | 198 | 793 |
| `skill_trigger_eval` | 194 | 774 |
| `update_form_request_messages` | 194 | 774 |
| `sync_agent_settings` | 170 | 678 |
| `compile_router` | 167 | 668 |
| `suggest_command` | 167 | 669 |
