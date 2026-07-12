# Branch protection for `main` — prepared config (user-applied)

> The one reviewer point open since PR #223, repeated in every 8.11 review:
> "no code needed." Correct — and that is exactly why an agent never applies
> it: changing repository protection is a repo-admin, outward-facing action
> that affects every future merge. This page prepares the exact
> configuration; a human runs it. Blocker `branch-protection-apply` (owner:
> user) in `road-to-feedback-8.11-2` tracks the application.

## Design decisions (council 2026-07-12)

- **PR required, no direct pushes to `main`** — including the maintainer;
  the agent-side rules already treat `main` as a Hard-Floor trunk, this
  makes GitHub enforce the same.
- **No force-pushes, no branch deletion.**
- **Required checks = a MINIMAL STABLE CORE, not all ~59 checks.**
  Requiring everything turns every workflow/job rename into a lockout.
  Core = the suites that gate correctness on every PR:
  - `Static Checks (ESLint · typecheck · prepack)`
  - `Node Tests (ubuntu-latest, shard 1/4)` … `shard 4/4`
  - `Golden Tests (ubuntu-latest)`
  - `Install Aux Tests (ubuntu-latest)`
  (macOS twins stay unrequired — same code, second OS; they still run and
  still show red, they just don't lock the merge on a runner outage.)
- **Enforce for admins: yes** (otherwise the protection is decorative).
- **Required reviews: 0 for now** — the trailing-90-day distinct-reviewer
  count is 1 (bus-factor reality); requiring a second reviewer would block
  every merge. Revisit when a second maintainer exists
  (`road-to-maintainer-bus-factor`).

## Verify the current check names first (renames happen)

```bash
gh api repos/event4u-app/agent-config/commits/main/check-runs \
  --jq '.check_runs[].name' | sort -u
```

Adjust the `contexts` list below to the names that actually exist — this
doc is a preparation, the live names win.

## The ready-to-run command

```bash
gh api -X PUT repos/event4u-app/agent-config/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "Static Checks (ESLint · typecheck · prepack)",
      "Node Tests (ubuntu-latest, shard 1/4)",
      "Node Tests (ubuntu-latest, shard 2/4)",
      "Node Tests (ubuntu-latest, shard 3/4)",
      "Node Tests (ubuntu-latest, shard 4/4)",
      "Golden Tests (ubuntu-latest)",
      "Install Aux Tests (ubuntu-latest)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Notes: `strict: false` deliberately — with a single maintainer,
require-branches-up-to-date adds a rebase round-trip per merge with no
second-writer race to protect against; flip to `true` when there are
concurrent mergers. `required_pull_request_reviews: null` per the
bus-factor reality above.

## Rollback

```bash
gh api -X DELETE repos/event4u-app/agent-config/branches/main/protection
```

## After applying

- Verify: `gh api repos/event4u-app/agent-config/branches/main/protection --jq '{checks: .required_status_checks.contexts, admins: .enforce_admins.enabled}'`
- Update the blocker in `road-to-feedback-8.11-2` (resolved-when: this
  command ran, or the user records why not).
- Any future check rename: update the contexts list in the SAME PR that
  renames the job — a required check that no longer reports blocks every
  merge until an admin edits the list.
