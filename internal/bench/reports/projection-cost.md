# Initial-context token audit

- generated: `2026-07-05T17:11:18+00:00`
- token method: tokens_gpt: exact (tiktoken cl100k_base); tokens_claude: proxy (chars/3.6)

## 0B.2 — always-on rule footprint per tool

| tool | files | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| `.claude` | 93 | 302,525 | 75,076 | 84,035 |
| `.augment` | 93 | 301,087 | 74,753 | 83,635 |
| `.cursor` | 93 | 302,525 | 75,076 | 84,035 |
| `.windsurfrules` | 1 | 254,664 | 61,858 | 70,740 |

## 0B.4 — description-catalog cost (eager)

| catalog | entries | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| skills_projected | 416 | 73,243 | 15,828 | 20,345 |
| skills_core_source | 261 | 50,932 | 11,053 | 14,148 |
| commands_core_source | 162 | 23,436 | 5,005 | 6,510 |

## 1.3 — top-10 longest rules (token trim candidates)

| rule | GPT tok | chars |
|---|--:|--:|
| `legal-safety-floor` | 2,920 | 12,083 |
| `roadmap-progress-sync` | 2,597 | 9,983 |
| `git-history-discipline` | 2,133 | 8,423 |
| `domain-safety-pii` | 2,055 | 7,912 |
| `autonomous-execution` | 2,004 | 8,430 |
| `domain-safety-disclaimer` | 1,770 | 7,368 |
| `domain-adoption-policy` | 1,727 | 7,188 |
| `roadmap-ci-steps-policy` | 1,656 | 6,364 |
| `framework-neutrality-in-generic-skills` | 1,489 | 5,573 |
| `no-roadmap-references` | 1,483 | 6,262 |

## MCP — tool-schema cost per server (always-loaded for connected clients)

| server | tools | chars | GPT tok | Claude tok | over-subscribed? |
|---|--:|--:|--:|--:|:--:|
| `agent-config` | 20 | 13,925 | 2,942 | 3,867 | no |

### `agent-config` — top-10 tools by schema cost

| tool | GPT tok | chars |
|---|--:|--:|
| `chat_history_append` | 335 | 1,585 |
| `memory_lookup` | 232 | 1,048 |
| `chat_history_read` | 220 | 1,014 |
| `memory_signal` | 191 | 887 |
| `lint_skills` | 175 | 793 |
| `update_form_request_messages` | 157 | 774 |
| `read_resource_body` | 151 | 652 |
| `skill_trigger_eval` | 147 | 774 |
| `compile_router` | 141 | 668 |
| `sync_agent_settings` | 137 | 678 |
