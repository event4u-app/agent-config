# Initial-context token audit

- generated: `2026-06-01T08:44:40+00:00`
- token method: tokens_gpt: proxy (chars/4.0, tiktoken not installed); tokens_claude: proxy (chars/3.6)

## 0B.2 — always-on rule footprint per tool

| tool | files | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| `.claude` | 79 | 237,436 | 59,359 | 65,954 |
| `.augment` | 79 | 237,436 | 59,359 | 65,954 |
| `.cursor` | 79 | 237,436 | 59,359 | 65,954 |
| `.windsurfrules` | 1 | 198,676 | 49,669 | 55,188 |

## 0B.4 — description-catalog cost (eager)

| catalog | entries | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| skills_projected | 353 | 61,417 | 15,354 | 17,060 |
| skills_core_source | 122 | 23,997 | 5,999 | 6,666 |
| commands_core_source | 144 | 20,162 | 5,040 | 5,601 |

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
