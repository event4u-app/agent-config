<!-- evidence-type: analysis -->

# Council — code review of the advisories, security-fix and worktree-removal code (2026-10-21)

AI council, `anthropic` + `openai`, CLI seats, $0.00. Three runs, each a
two-round review over one slice of the branch diff, after the R2 completion
review's 26 findings were fixed:

| Run | Slice | Seats present |
|---|---|---|
| a | `worktree_cleanup_check.ts`, the `session_start` wiring | 2/2 |
| b1 | `advisory_sources.ts`, `advisory_notice.ts` | 2/2 |
| b2 | `security_fix.ts`, `security_fix_context.ts`, `check_update_banner.ts` | 1/2 (degraded: openai returned no text) |

Both seats in run a and b1 said **do not ship as written**; b2's one seat said
the same. Every finding below was checked against the code at the reviewed head
before it was fixed or declined. A finding already fixed by the R2 round is
marked so rather than counted twice.

## Worktree removal (run a)

| Finding | Disposition |
|---|---|
| The pre-removal re-check reads the inventoried branch ref, not the worktree's current `HEAD`; a tree switched to a clean detached commit is removed | **fixed** — the entry and `HEAD` are re-read under the lock; a changed branch or `HEAD` keeps the tree. Test seen red under sabotage. |
| A "generated" comment vouches for later rules in the same block | **fixed** — only the comment group directly above the rule counts. Test seen red under sabotage. |
| A PR merged into another base counts as trunk proof | **fixed** — `baseRefName` is read; only PRs into the trunk count |
| A forge proof without a readable `mergedAt` skips the merge delay | **fixed** — an unreadable merge time keeps the tree |
| Branch names reach session-start context | **fixed** — the daily line carries a count; the CLI keeps the names |
| Journal written after the removal | **fixed** — write-ahead `intent` line with the tip, then `outcome` |
| Repository-wide `git worktree prune` acts outside the safe set | **fixed** — removed from the automated path |
| Stale-lock takeover lets the old holder release the new lock | **fixed** — token-owned lock, released only by its holder |
| `ranToday` outside the guarded region | **fixed** |
| Journal records the inventory's evidence, not the re-check's | **fixed** |
| Re-check reuses the session snapshot | already fixed by R2 #16 |
| Ignored file created between the check and `git worktree remove` | **declined, recorded** as an accepted residual in ADR-295 — quarantine-and-restore weighed, the window is two adjacent synchronous calls |
| The three-second budget is not a hard bound | **documented** in ADR-295: it bounds subprocesses, not local file I/O |
| `isRepoSibling` path heuristic | no change — eligibility also needs a merge proof (D2) |
| Unversioned journal | **fixed** — `v: 1` |

## Advisory sources and the notice (run b1)

| Finding | Disposition |
|---|---|
| A failed source erases findings it reported last time | **fixed** — `carryForward`: a previous finding all of whose sources failed is kept, while the same version is installed. Test seen red under sabotage. |
| A truncated OSV `results` array reads the missing packages as clean | **fixed** — result count must equal query count. Test seen red under sabotage. |
| A detail for another ID is trusted and cached | **fixed** — validated before it is cached; a mismatch marks the source |
| Native audit on a lockfile other than `package-lock.json` / `composer.lock` | **fixed** — exactly those two names reach an audit |
| A killed or timed-out audit's parseable stdout is accepted | **fixed** — killed (`-2`) is never read |
| Per-request timeout is no operation bound | **fixed** — a shared query deadline |
| `smallestFix` ignores the ecosystem | **fixed** |
| One critical pre-announcement marks every release critical; first release in feed order wins | **fixed** — smallest newer release; critical only when a critical pre-announcement preceded that release in the window |
| Cache validated by `schema` alone | **fixed** — shape check at the read boundary |
| Invalid or future timestamps suppress the stale and silence lines | **fixed** — both read as unreadable, never as fresh |
| The shown-stamp misses same-day changes | **fixed** — keyed by the rendered lines' hash and the day |
| Unbounded silence lines | **fixed** — capped, and the notice as a whole at eight lines |
| Two projects with the same package double the query | **fixed** — one query per ecosystem/name/version |
| `safeField` 120 vs 200; failed detail fetch reported ok; remediation text unvalidated | already fixed by R2 #25, #4, #13 |
| Malformed URL bypasses `assertAllowed` | no bypass existed (`new URL` throws); the error now names the refusal |
| Feed parsing is not an XML parser | declined — the two feeds are fixed, recorded in fixtures; an unparsed feed yields no announcement, which the silence line reports |
| No backoff against OSV rate limits | declined — a 429 now fails the source and the previous findings are carried |

## Security-fix routing (run b2)

| Finding | Disposition |
|---|---|
| An open bot PR outranks a dependency this branch introduced | **fixed** — the branch's own bug routes first |
| A non-registry name (`../x`) or version reaches an install command | **fixed** — registry name and version grammars; no command otherwise |
| Install scripts run before the diff is inspected | **fixed** — `--ignore-scripts`, `--no-scripts --no-plugins` |
| `composer update --with-dependencies` is not the smallest change | **fixed** — one package; `-w` only when Composer names a dependency |
| A second session overwrites a merged remediation | **fixed** — only a failed fix starts over |
| `advance()` accepts any transition | **fixed** — forward-only table |
| `key.split` without a package part | **fixed** |
| `gh pr list --search <package>` sends the name to GitHub | no change — the search runs against the user's own repository on its own forge, which already holds the lockfile; private names never become findings (OSV is queried for public names only, a native audit is skipped on a lockfile with a private entry) |
| `reopenMitigations` has no rate limit | declined — a reopened mitigation is the intended signal that a fix now exists |
| `#` in a PR title auto-links | declined — the title is built from a registry name, which cannot hold `#` after the grammar check |
| `isLibrary` misses ESM-only packages | declined — `exports` is already one of the three markers |
