# Spike B — Outcome-Signal Availability (API-only, no new credentials)

Fixture set: the same 20 repos frozen in
[`spike-c-fixture-set.md`](spike-c-fixture-set.md). Question: with only the
existing `gh` auth (the baseline — no new credentials, no app install), can a
machine read each signal class? "Availability" = the API call succeeds and
returns interpretable data (including a legitimate empty result), not
whether the underlying event (a revert, a change-request) happened to occur.

## Signal-trust tier table

| Tier | Definition | Signals in this spike |
|---|---|---|
| **Tier 1** | Deterministic CI/VCS facts — a machine fact with no human judgment in the loop | CI red/green (Actions runs / check-runs), revert-of-commit |
| **Tier 2** | Platform review metadata — human judgment, but structured and platform-recorded | PR merged-without-change-request (GitHub PR reviews) |
| **Tier 3** | Human-authored labels | Not measured in this spike (no issue/PR label taxonomy probed) |
| **Tier 4** | Model self-assessment | **Excluded by principle** — a model's own claim about its output quality is not an outcome signal; it is not probed here and would not count toward availability even if easy to fetch |

## Tier-1 — CI red/green on the default branch

**Method.** `gh api repos/{owner}/{repo}/actions/runs?per_page=5` per repo
(1 call). Availability = `total_count > 0` **and** at least one run has
`status: completed` with a non-null `conclusion`. For the 2 repos with
`total_count = 0` (no GitHub Actions configured), a fallback check was run:
`gh api repos/{owner}/{repo}` → `default_branch`, then
`gh api repos/{owner}/{repo}/commits/{default_branch}/check-runs` — to catch
CI wired through an external check-runs provider (Travis, CircleCI, etc.)
instead of Actions.

| repo | Actions `total_count` | sample conclusions | fallback check-runs | available? |
|---|---:|---|---|---|
| coollabsio/coolify | 13081 | success, failure, success | — | yes |
| livewire/livewire | 2970 | failure, failure, success | — | yes |
| krayin/laravel-crm | 1903 | success, success, success | — | yes |
| whitecube/laravel-cookie-consent | 108 | success ×3 | — | yes |
| leandrocfe/filament-apex-charts | 142 | success, failure, success | — | yes |
| shipmonk-rnd/dead-code-detector | 1552 | success ×3 | — | yes |
| GrahamCampbell/Laravel-TestBench | 72 | success ×3 | — | yes |
| bnussbau/laravel-trmnl | 186 | success ×3 | — | yes |
| clash-verge-rev/clash-verge-rev | 10292 | success ×3 | — | yes |
| shadcn-ui/ui | 14601 | action_required, action_required, success | — | yes |
| modelcontextprotocol/servers | 13501 | success, success, skipped | — | yes |
| obsidianmd/obsidian-maps | 0 | — | `total_count=0` on `master` tip too | **no** |
| webcomponents/custom-elements-manifest | 17 | success ×3 | — | yes |
| mxstbr/mxstbr.com | 386 | success ×3 | — | yes |
| nuxt-community/imagemin-module | 0 | — | `total_count=0` on `main` tip too | **no** |
| fmaclen/svelte-currency-input | 69 | success, success, failure | — | yes |
| pterodactyl/panel | 425 | action_required, action_required, success | — | yes |
| MohmmedAshraf/laravel-translations | 99 | success ×3 | — | yes |
| spatie/laravel-typescript-transformer | 300 | success ×3 | — | yes |
| h3ravel/h3ravel | 69 | success ×3 | — | yes |

**Tier-1 CI availability: 18 / 20 = 90%.**

## Tier-1 (bonus datum) — revert-of-commit signal via local history

**Method as specified in the task**: `git log --oneline -200` inside each
clone, grep `^[a-f0-9]+ (Revert|revert ")`. Result: **0/20 reverts found —
but this is a methodology artifact, not a real measurement.**

**Caveat (reported honestly rather than silently passed through).** All 20
clones were made with `git clone --depth 1` (per the task's own clone
instruction, shared with Spike C). A depth-1 shallow clone's local
`git log` shows exactly **one** commit — the tip — regardless of the repo's
real history length (verified: `git log --oneline | wc -l` → `1` for every
clone, e.g. `livewire/livewire` at commit `9c14507…`). The
"repo's history is readable" premise in the task holds only for a **full**
clone; for a shallow clone, "availability" of this specific signal via local
`git log` is **not meaningfully testable** as constructed — re-fetching with
full history for all 20 repos was skipped to stay within the session's
bandwidth/time budget on top of the gh rate-limit pacing already in effect.
This bonus datum is therefore reported as **not measured** (0/20 is not a
finding), not as "0 reverts observed." It does not affect the pre-registered
tier-1 verdict below, which is based on the CI signal, not this one.

## Tier-2 — PR merged-without-change-request

**Method.** `gh api repos/{owner}/{repo}/pulls?state=closed&per_page=10` per
repo (1 call) → filter to `merged_at != null` → take the most recent merged
PR → `gh api repos/{owner}/{repo}/pulls/{number}/reviews` (1 more call).
Availability here means: did the pulls-list call and the reviews call both
return valid, interpretable JSON (including a legitimate empty review list)?

| repo | merged PRs in last 10 closed | most recent merged # | reviews readable? | review states | merged w/o CHANGES_REQUESTED |
|---|---:|---:|---|---|---|
| GrahamCampbell/Laravel-TestBench | 5 | #36 | yes | (none) | yes |
| MohmmedAshraf/laravel-translations | 9 | #184 | yes | (none) | yes |
| bnussbau/laravel-trmnl | 10 | #23 | yes | (none) | yes |
| clash-verge-rev/clash-verge-rev | 9 | #7591 | yes | APPROVED | yes |
| coollabsio/coolify | 3 | #11029 | yes | (none) | yes |
| fmaclen/svelte-currency-input | 9 | #99 | yes | (none) | yes |
| h3ravel/h3ravel | 1 | #6 | yes | (none) | yes |
| krayin/laravel-crm | 10 | #2603 | yes | (none) | yes |
| leandrocfe/filament-apex-charts | 9 | #167 | yes | (none) | yes |
| livewire/livewire | 8 | #10444 | yes | (none) | yes |
| modelcontextprotocol/servers | 4 | #4480 | yes | APPROVED | yes |
| mxstbr/mxstbr.com | 8 | #210 | yes | (none) | yes |
| nuxt-community/imagemin-module | **0** | — | **n/a — no merged PR in last 10 closed** | — | — |
| obsidianmd/obsidian-maps | 6 | #46 | yes | (none) | yes |
| pterodactyl/panel | 4 | #5644 | yes | COMMENTED | yes |
| shadcn-ui/ui | 8 | #11290 | yes | (none) | yes |
| shipmonk-rnd/dead-code-detector | 10 | #400 | yes | (none) | yes |
| spatie/laravel-typescript-transformer | 10 | #90 | yes | (none) | yes |
| webcomponents/custom-elements-manifest | 6 | #132 | yes | APPROVED | yes |
| whitecube/laravel-cookie-consent | 9 | #115 | yes | (none) | yes |

**Tier-2 readability: 19 / 19 examinable repos (100%)** — every pulls-list
and reviews call succeeded and returned interpretable JSON.
`nuxt-community/imagemin-module` is excluded from this denominator: its last
10 closed PRs contained zero merged PRs (all closed-without-merge), so there
was no "most recent merged PR" to examine — a fixture-set gap, not an API
readability failure. Note the low absolute rate of formal GitHub review
approvals across this sample (most merges carry **zero** recorded reviews) —
common for maintainer-merge-own-PR workflows in small/mid OSS projects; the
signal is readable, but real-world review coverage is thin, which matters
for any downstream use of this signal as a quality proxy.

## Pre-registered rule, applied in writing

```
<50% tier-1 availability → feedback_signals stays parked.
```

**Measured tier-1 (CI) availability: 18/20 = 90%.**

**Verdict: the rule does NOT trigger.** Tier-1 availability is well above
the 50% floor, so — per the pre-registered rule — `feedback_signals` is
**not** required to stay parked on this evidence. This is not a recommendation
to build it; it only says the specific parking condition set in advance was
not met. Tier-2 (PR review readability) is separately 100% (19/19
examinable), reinforcing that the outcome-signal surface is generally
API-readable with the existing `gh` auth and no new credentials — but the
thin real-world review-approval rate (few repos show any recorded review at
all) is a signal-*quality* caveat that a build decision would still need to
weigh, separate from the availability question this rule gates.

Tier-4 (model self-assessment) was excluded by principle throughout — no
call was made to probe it, and no partial credit was given for it in either
tier-1 or tier-2 availability.
