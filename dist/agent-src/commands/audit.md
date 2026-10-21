---
model_tier: medium
name: audit
pack: engineering-base
intent: "Check what this project uses for security advisories and carry a finding to a fix"
routes_to: [dependency-upgrade]
replaces: []
visibility: advanced
skills: [dependency-upgrade, finishing-a-development-branch, using-git-worktrees]
description: Security advisories for the project's packages, runtimes and toolchain — by tier, with evidence; `deps fix <id>` carries one finding to a verified PR
argument-hint: "deps [refresh|show|gaps|fix <id>|accept <id>]"
suggestion:
  eligible: true
  trigger_description: "is anything we use vulnerable, check for security updates, which advisories affect this project, fix that CVE"
  trigger_context: "the user asks about security advisories, end-of-life runtimes or a security release for something the project uses"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /audit
## Instructions

`/audit deps` is the one audit today: advisories, malware, end-of-support and
pre-announced security releases for what the project **uses** — distinct from
`/security-audit-config`, which audits the agent configuration itself.

## Examples

```text
/audit deps                       # refresh if stale, then the findings by tier
/audit deps fix CVE-2026-59948    # carry one finding to a verified PR
/audit deps gaps                  # what the project's own bots and CI could already cover
```

**Why it works:** (`self-check-loop`) only `refresh` touches the network, and every finding names the
file and line it came from, so each line is checkable before anything changes.

## Flags

| Flag | Mode | Meaning |
|---|---|---|
| `--force` | `refresh` | refresh although the cache is younger than 20 hours |
| `--reason` | `accept` | why the vulnerable path is unreachable here — a sentence, never "grep found nothing" |
| `--expires` | `accept` | the day the acceptance lapses (YYYY-MM-DD) |

### 1. Know where the data comes from

```bash
agent-config audit:deps refresh   # the ONLY step that touches the network
agent-config audit:deps show      # findings by tier, each with file:line and IDs
```

`refresh` reads the lockfiles, declared runtimes, Dockerfiles, compose files and
CI workflows; sends **public** package names and versions to `api.osv.dev`;
reads runtime lifecycle data from `endoflife.date` and the PHP and Node release
feeds; downloads the whole CISA known-exploited catalog from `www.cisa.gov` and
matches it locally (`advisories.kev: off` skips it); and runs `npm audit` /
`composer audit` (each sends the lockfile's package list to its configured
registry) only for a lockfile that names no private package. Names under
the project's own npm scope, Composer vendor or GitHub owner count as private.
`advisories.egress: none` sends nothing. A cache younger than
20 hours is reused; `--force` refreshes anyway.

Read the result as the tool states it:

- **A source that did not answer** appears as `unknown`, never as "clear". Say
  which source and why, and never report "no vulnerabilities".
- **`pre-announced`** means a vendor announced a security release whose fixed
  versions are not named yet. Name the runtime, the date, and the files that pin
  it; do not invent a version.
- **No findings** is "no known findings at the last check", with its timestamp.

### 2. Tiers decide the tone

`T0` — act today (malware, a critical runtime pre-announcement, a critical fix
available for a direct runtime dependency, or a high one that is known-exploited
— KEV raises a finding one tier). `T1` — today. `T2` — the
digest. `T3` — the ledger. Lead with T0, then T1; mention the T2 count; leave T3
unless asked.

### 3. `gaps` — what the project's own tooling could already cover

```bash
agent-config audit:deps gaps
```

Each line is an offer (an update bot, ungrouped security updates, a cooldown,
`composer config.audit`, a CI audit step, `npm ci`). **Never write the config
unasked**; show the change and let the user take it.

### 4. `fix <id>` — carry one finding to a PR

Follow the "Security fix" section of [`dependency-upgrade`](../../../skills/dependency-upgrade/SKILL.md)
end to end. In short: the smallest fixing change, the route the routing table
picks (this branch, or a separate worktree, branch and PR), proof by the same
source that reported it, the project's tests, a PR that carries the evidence,
and — for a library — a patch-release draft. Merge, tag, publish and deploy are
the owner's.

### 5. `accept <id>` — only with a reason and an expiry

```bash
agent-config audit:deps accept <id> --reason="<why the vulnerable path is unreachable here>" --expires=YYYY-MM-DD
```

The tool refuses an acceptance without an expiry, and refuses a reason that is
only the absence of a search hit — "grep found nothing" is not unreachability.
