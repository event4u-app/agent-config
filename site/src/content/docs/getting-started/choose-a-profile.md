---
title: Choose a profile
description: Pick the Agent Config profile for your role — developer, founder, content creator, agency, finance or ops — and switch later with one command.
---

Your profile decides which skills and workflows your agent gets first. The setup wizard asks for it; you can switch any time:

```bash
npx -y @event4u/agent-config use --profile founder
```

| Profile | For | Starts you with |
|---|---|---|
| `developer` (default) | Engineers who ship code | `/work`, `/implement-ticket`, `/review:changes`, `/fix`, `/commit` |
| `founder` | Solo and early-stage founders | `/work`, `/feature`, `/challenge-me`, a second opinion from other AI models; skills for vision, prioritisation and runway |
| `content_creator` | Writers, ghostwriters, marketers | `/work`, `/ghostwriter`, `/post-as`, the video storyboard commands; skills for voice and editorial planning |
| `agency` | Shops delivering for several clients | `/work`, `/implement-ticket`, `/refine-ticket`, `/feature`, `/roadmap` |
| `finance` | CFOs, fractional finance, FP&A | `/work`, `/challenge-me`, a second opinion; skills for forecasting, scenarios and unit economics |
| `ops` | RevOps, support, SRE-adjacent work | `/work`, `/threat-model`, `/review:changes`, `/fix`; skills for incidents, dashboards and logging |

Five of the six profiles are not engineering roles. Each installs a focused set of skills for that role instead of the whole catalog. You still start the wizard from a terminal.

## Profile is not cost

The profile you pick here changes **which** skills you get. **How much** the agent loads on every task — and so how many tokens it spends — is a separate setting chosen at install time with `--profile minimal | balanced | full`. [Benchmark & cost, explained](/agent-config/trust/benchmark-and-cost/) shows what each one costs.

There are four settings that share the word "profile"; [The four profiles](/agent-config/configuration/profiles/) tells them apart.

## Next

- [Skill sets for your role](/agent-config/configuration/packs/) — add a set of skills for another domain.
- [Your first task](/agent-config/getting-started/first-task/)
