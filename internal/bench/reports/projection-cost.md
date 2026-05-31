# Initial-context token audit

- generated: `2026-05-31T08:30:08+00:00`
- token method: tokens_gpt: proxy (chars/4.0, tiktoken not installed); tokens_claude: proxy (chars/3.6)

## 0B.2 — always-on rule footprint per tool

| tool | files | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| `.claude` | 78 | 234,692 | 58,673 | 65,192 |
| `.augment` | 78 | 234,692 | 58,673 | 65,192 |
| `.cursor` | 78 | 234,692 | 58,673 | 65,192 |
| `.windsurfrules` | 1 | 196,510 | 49,128 | 54,586 |

## 0B.4 — description-catalog cost (eager)

| catalog | entries | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| skills_projected | 347 | 60,366 | 15,092 | 16,768 |
| skills_core_source | 122 | 23,997 | 5,999 | 6,666 |
| commands_core_source | 140 | 19,524 | 4,881 | 5,423 |

## 1.3 — top-10 longest rules (token trim candidates)

| rule | GPT tok | chars |
|---|--:|--:|
| `autonomous-execution` | 1,889 | 7,556 |
| `domain-safety-disclaimer` | 1,828 | 7,314 |
| `domain-adoption-policy` | 1,796 | 7,184 |
| `roadmap-ci-steps-policy` | 1,591 | 6,364 |
| `roadmap-progress-sync` | 1,579 | 6,315 |
| `no-roadmap-references` | 1,570 | 6,278 |
| `domain-safety-pii` | 1,564 | 6,255 |
| `persona-governance` | 1,445 | 5,779 |
| `framework-neutrality-in-generic-skills` | 1,393 | 5,573 |
| `context-hygiene` | 1,391 | 5,565 |
