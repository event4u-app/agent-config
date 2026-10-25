---
model_tier: medium
name: audit
pack: engineering-base
intent: "Check what this project uses for security advisories, and what its AI agents can do, and carry a finding to a fix"
routes_to: [dependency-upgrade]
replaces: []
visibility: advanced
cluster: audit
skills: [dependency-upgrade, finishing-a-development-branch, using-git-worktrees, authz-review, security-audit]
description: Security advisories, code and agent actions for this project
argument-hint: "deps [refresh|show|gaps|fix <id>|accept <id>] | code [diff|full|retest|show|matrix] | agents"
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

Three audits of the project — all distinct from `/security-audit-config`, which
audits the agent configuration itself:

- `/audit deps` — advisories, malware, end-of-support and pre-announced
  security releases for what the project **uses**.
- `/audit code` — security holes in the project's **own code**, each confirmed
  by a red test a second agent wrote (§ 7).
- `/audit agents` — what an AI agent, bot or MCP server in the project can
  **do**, and which of those actions nobody declared or let a model choose whose
  record it changes (§ 6).

## Examples

```text
/audit deps                       # refresh if stale, then the findings by tier
/audit deps fix CVE-2026-59948    # carry one finding to a verified PR
/audit deps gaps                  # what the project's own bots and CI could already cover
/audit code full                  # hunters per surface, a verifier per candidate, proof tests
/audit code show                  # the ledger: open, coverage, unreviewed, rejected
/audit agents                     # every tool registration vs. agents/settings/contexts/agent-actions.yml
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
A third-party private scope, an internal unscoped name or a package resolved
from a private registry host is NOT recognised as private; with any of those
in a lockfile, set `advisories.egress: none`.
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
That refusal is a phrase check: a reworded non-argument passes it, so an
acceptance is the owner's to review, never cleared by the tool.

### 6. `/audit agents` — what the project's agents can do

A claim in a conversation is an input, never an authorization: the subject of a
write comes from the authenticated principal, and the check lives where the
write happens. Same contract as `deps` — every finding names `file:line`,
`unknown` is said and never reported as clean, and the fix is a change the
owner merges.

```bash
./scripts-run src/scripts/agent_actions_detect --root <repo>   # --json for the raw report
```

Read-only, no model, no network. It recognises tool registrations of known SDK
shapes and compares them with `agents/settings/contexts/agent-actions.yml` (the
template ships beside `auth-model.md`). Findings:

| Kind | Means | Fix |
|---|---|---|
| `undeclared` | a registered tool missing from the inventory | add the entry with its authority block |
| `subject-argument` | a write tool whose input names `account` / `email` / `user_id` / … | take the subject from the session; walk it with [`authz-review`](../../../skills/authz-review/SKILL.md) |
| `unknown` | agent-tooling signals, no shape the detector knows | read the file by hand and declare what it registers |
| `invalid-inventory` | an entry missing a field, or `subject_source: argument` on a write | complete the entry |

No findings is "no finding at the last run" for the recognised shapes — never
"the agents are safe". Enforcement stays in the project's backend; this audit
finds where to look and does not block anything.

### 7. `/audit code` — a finding is confirmed by a test it fails

The procedure is [`security-audit`](../../../skills/security-audit/SKILL.md)
§ 1b and § 6; this section is its entry. Modes:

| Mode | Runs | Cost |
|---|---|---|
| `diff` | the diff judges over the branch diff (`/review-changes`, security lens) | cheapest — the default per PR |
| `full` | enumerate → one hunter per surface class → a fresh verifier per candidate → a red proof test per confirmed finding | model calls; before a launch or on request |
| `retest` | every proof test, `judge-security-auditor` over the fix diff only, and the ledger rows whose source changed | the suite plus one narrow judge |
| `show` | `agent-config audit:code show` | none |
| `matrix` | `agent-config audit:code matrix [--skeleton]` | none |

```bash
agent-config audit:code matrix --root .             # every API route × {anonymous, user A, user B}
agent-config audit:code matrix --root . --skeleton  # a draft test per route, failing until bound
agent-config audit:code validate                    # the newest ledger against the ledger rules
agent-config audit:code show                        # the report, derived from the ledger
```

The matrix reads the code graph's routes and calls no model: an anonymous
request expects `401`, the owner `2xx`, a second account `403|404` on a
parameterised path. It is the cheapest way to find a missing ownership check,
and its rows seed the proof tests. A public route will read as a false hole —
the verifier edits the expectation; the matrix is never run as a verdict.

The ledger (`agents/runtime/state/security/<run>/ledger.json`, gitignored —
an open finding is an exploit map) records surface × endpoint rows with their
enumeration source, and findings as `confirmed` / `needs_validation` /
`rejected`. Coverage counts only rows the graph or a file convention found; a ledger
with none reads "not enumerated", never "0 %" or clean.
"0 open findings" is never written without that figure; no ledger is "not
checked", never "no findings".

**Runs add up.** A follow-up `full` run receives the previous ledger and targets
its `unreviewed` rows and changed sources — never an identical restart. One run
by default, `--runs N` on request, and it stops when a run adds no `confirmed`.
Model spend follows the council's quota ask.
