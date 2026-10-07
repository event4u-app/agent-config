<!-- evidence-type: analysis -->

# How does `update_strategy` find the commit it is read at?

> Council record for decision D10 of
> `road-to-a-git-convention-that-reaches-every-checkout`. Run 2026-10-07.
> Verdict: option (B) — the target is the explicit `--base`, else the default
> branch; forge and offline detection are removed. Recorded in ADR-283
> § Target resolution.

## Attendance, honestly

**2/2 convergent.** Both seats answered in the same run, independently, and
both chose (B).

| Seat | Transport | Verdict |
|---|---|---|
| `anthropic/claude-sonnet-4-5` | CLI, subscription | (B), with fail-closed pull-request callers |
| `openai/codex-default` | CLI, subscription | (B), with fail-closed pull-request callers |

## The question

Seven R2 review rounds of the git-convention branch found 12, 10, 6, 6, 6, 5
and 10 findings. Most of the later ones were in one place: working out, without
`--base`, which pull request the branch belongs to (host matching against
`github.com`, `gh` authentication and timeouts, `url.insteadOf` aliases) and
whether the remote was offline (a full fetch used as a probe). Each fix opened
the next case. Three options were put:

- **(A)** keep patching the detection;
- **(B)** remove it — `--base` when given, else the default branch — and make
  every pull-request caller pass its base;
- **(C)** freeze with the residue documented and declare the next review
  binding regardless of its count.

## Verdict — both seats chose (B)

**`anthropic/claude-sonnet-4-5`.** Called the non-convergence dispositive: the
detection is a mechanism-selection problem dressed as data resolution, so every
new forge, URL form or authentication setup is a new case. A caller acting on a
pull request already has its base; passing it makes detection irrelevant. It
pinned the line between the two failure exits: a target that cannot be
*found* is exit 1, a target found whose commit cannot be *retrieved* is the
`unverified` path (exit 0, nothing mutated) — which already is the offline
tolerance, without inferring "offline" from a timed-out fetch. Revisit only
when a concrete pull-request caller cannot pass its base.

**`openai/codex-default`.** Agreed, and made the tightening explicit: a
pull-request path must never silently fall back to the default branch, because
for a stacked pull request that reads a valid file at the wrong commit and
enforces the wrong strategy with exit 0. `show --key update_strategy` should
judge only the requested key, so a broken `branch_pattern` does not stop
`/pr:merge`. It disagreed that (B) loses nothing: it loses automatic handling
for a human who runs `sync` or `show` on a non-default or stacked pull request
without `--base`, and that loss should be stated as an intentional contract
change. SHA-256 repositories should be supported explicitly or rejected
explicitly, never fail by accident.

## What was implemented

- Target: `--base`, else the default branch (`origin/HEAD` from the server,
  then the local ref). The `gh` lookup, the host matching and the offline probe
  are gone.
- Exits, decided in one function (`strategyExit` in
  `src/scripts/sync_pr_branch.ts`): target names no commit — no `--base` and no
  default branch, a ref the server does not know, no origin, origin unreachable
  at the ref lookup — exit 1; target named but its commit not fetched —
  `unverified`, exit 0, nothing merged; a refusing carrier or developer file —
  exit 4.
- Every pull-request call site in the shipped commands and skills passes
  `--base origin/<base>`; a test fails on a call site that drops it.
- `git:convention show --key KEY` (repeatable) limits the read and the exit to
  the named keys; `/pr:merge` § 2 uses `show --key update_strategy --base`.
- SHA-256 is supported explicitly: a 64-hex SHA is accepted wherever a 40-hex
  one is.

## The stated loss

A direct human `sync` or `show` on a stacked or release-line pull request
without `--base` now targets the default branch. That path is documented as for
operations that are not about a pull request.

## Revisit if

- a pull-request caller is found that cannot determine or pass its base. Any
  renewed detection is forge-agnostic, separately scoped, and never substitutes
  the default branch silently.

The raw responses are gitignored runtime artefacts and are not committed; the
substance of each seat's answer is reproduced above.
