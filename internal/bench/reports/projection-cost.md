# Initial-context token audit

- generated: `2026-06-26T09:20:20+00:00`
- token method: tokens_gpt: exact (tiktoken cl100k_base); tokens_claude: proxy (chars/3.6)

## 0B.2 — always-on rule footprint per tool

| tool | files | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| `.claude` | 91 | 291,714 | 72,409 | 81,032 |
| `.augment` | 93 | 299,529 | 74,317 | 83,202 |

## 0B.4 — description-catalog cost (eager)

| catalog | entries | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| skills_projected | 412 | 72,852 | 15,733 | 20,237 |
| skills_core_source | 258 | 50,762 | 10,999 | 14,101 |
| commands_core_source | 162 | 23,412 | 4,998 | 6,503 |

## 1.3 — top-10 longest rules (token trim candidates)

| rule | GPT tok | chars |
|---|--:|--:|
| `legal-safety-floor` | 2,920 | 12,077 |
| `roadmap-progress-sync` | 2,597 | 9,983 |
| `git-history-discipline` | 2,133 | 8,423 |
| `autonomous-execution` | 2,004 | 8,430 |
| `domain-safety-pii` | 1,972 | 7,567 |
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
