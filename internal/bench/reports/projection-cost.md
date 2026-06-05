# Initial-context token audit

- generated: `2026-06-05T03:13:10+00:00`
- token method: tokens_gpt: proxy (chars/4.0, tiktoken not installed); tokens_claude: proxy (chars/3.6)

## 0B.2 — always-on rule footprint per tool

| tool | files | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| `.claude` | 79 | 239,131 | 59,783 | 66,425 |
| `.augment` | 79 | 239,131 | 59,783 | 66,425 |

## 0B.4 — description-catalog cost (eager)

| catalog | entries | chars | GPT tok | Claude tok |
|---|--:|--:|--:|--:|
| skills_projected | 359 | 62,371 | 15,593 | 17,325 |
| skills_core_source | 214 | 42,133 | 10,533 | 11,704 |
| commands_core_source | 149 | 20,912 | 5,228 | 5,809 |

## 1.3 — top-10 longest rules (token trim candidates)

| rule | GPT tok | chars |
|---|--:|--:|
| `roadmap-progress-sync` | 1,943 | 7,771 |
| `autonomous-execution` | 1,889 | 7,556 |
| `domain-safety-disclaimer` | 1,828 | 7,314 |
| `domain-adoption-policy` | 1,796 | 7,184 |
| `roadmap-ci-steps-policy` | 1,591 | 6,364 |
| `no-roadmap-references` | 1,570 | 6,278 |
| `domain-safety-pii` | 1,564 | 6,255 |
| `persona-governance` | 1,445 | 5,779 |
| `framework-neutrality-in-generic-skills` | 1,393 | 5,573 |
| `context-hygiene` | 1,391 | 5,565 |
