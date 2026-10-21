<!-- evidence-type: analysis -->

<!-- The final (round 5) prompt given to the council on 2026-10-21 for steps
3.3 and 3.4 of road-to-a-retro-the-merge-runs, committed verbatim up to its diff.
The diff it carried was `git diff origin/main...6063f6bd4 -- src tests docs`
(origin/main at 5200f6bdf), reproducible from the branch history. -->

# Review request, round 5: wiring the retro's daily probe into session start

Repository: event4u/agent-config. Branch `drain/retro-the-merge-20261021`; the complete diff against `origin/main` for `src/`, `tests/`, `docs/` is below, nothing omitted. One unchanged helper is quoted in full after this section.

## Context

The retro's daily probe (`retroDailyProbe`, `src/scripts/retro_sweep.ts`) runs on the first session start of a local day from the existing `session-register` concern's `session_start` slot (no new concern), throttled once per workspace and day. It reads session pointers from the git common directory, asks GitHub through the user's own `gh` login whether PRs with open merge markers merged (repo + PR number only), triages finished sessions deterministically (no model, no spawn), enqueues at most 3 units and returns a one-line context block. On by default; `retro.enabled: false` stops it (ADR-292 records the switch and the network read).

Claim tokens have the form `<generation>:<pid>-<16 hex chars>@<day>`; hex that appears redacted is the transport's redactor.

## Earlier rounds today (anthropic + openai)

- Round 1: anthropic `ship`; openai `refused` (lease-only takeover could supersede a suspended live holder; throttle stamped after a superseded sweep; no takeover-during-write test; `originSlug` cost unseen).
- Round 2: anthropic `ship`; openai `ship-with-fixes` (per-day claim files were not exclusive across days).
- Round 3: anthropic `ship`; openai `refused` — a 24-hour age escape still let a suspended live holder be superseded and resume writing; asked to never supersede a living process (or use a non-reusable process identity) and to test a takeover attempt between the sweep's ownership check and its writes.

- Round 4: anthropic did not answer (timeout); openai `ship-with-fixes` — a claimant that read generation N and paused could recreate generation N+1 after a rival acquired N+1, released via N+2 and a third claim pruned N+1; the stale claimant would then get a token and run discovery before `holdsSweepDay` stopped it. Asked for a post-create newest-generation check and an acquire-release-prune regression test.

## What changed since round 4

`claimSweepDay` now verifies, right after its exclusive create and before it prunes or returns, that the generation it created is the newest; if not, it removes its own file and returns `null` (so the probe does no discovery). New test: inside the claimant's `beforeCreate` seam a rival acquires, releases and a further claim prunes; the waiting claimant returns `null`, the rival holds, and only the newest claim file remains. Disabling the check turns the test red.

## What changed between round 3 and round 4

1. The age escape is removed. The newest claim generation is taken over only when it is older than the 60 s lease AND its holder pid does not exist (`process.kill(pid, 0)`, EPERM counts as alive). A claim naming no parseable pid past the lease (a create whose few-byte write never finished) is treated as unheld. So a holder whose process exists is never superseded at any age.
2. The cost of that choice is stated rather than hidden: a pid reused by an unrelated long-lived process blocks the daily sweep until that process exits. `/retro status` now names a claim held past the lease (pid and minutes) and tells the user how to clear it; `/retro` by hand is unaffected; unprocessed sessions stay within the 5-day catch-up window and expire after it.
3. New test: the sweep's injected clock is read inside its triage loop — after its first ownership check and before any enqueue or state write — and a rival claimant is run there at a month's age; every rival attempt returns `null` and the sweep completes with its one unit. Making the liveness check always false turns this test red.
4. Unchanged from round 3: one repository-wide claim sequence `claim.<generation>` whose every transition (acquire, take over, release) exclusively creates the next generation; claim before discovery; stamp only a non-superseded sweep; every `git` and `gh` call bounded by the probe's 3 s deadline, a cut-short fact read discarded.

## Unchanged helper, quoted

`originSlug(root)` reads `<git common dir>/config` as a file and parses the `origin` URL with a regex; it makes no process call.

```ts
export function budgetedGhPrState(
    root: string,
    budgetMs: number,
    run: (args: string[], timeoutMs: number) => string = (args, timeoutMs) =>
        execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: timeoutMs }),
): (pr: number) => PrState {
    const started = Date.now();
    return (pr) => {
        const left = budgetMs - (Date.now() - started);
        if (left <= 0) return { state: 'unread' };
        try {
            const body = JSON.parse(run(['pr', 'view', String(pr), '--json', 'state,mergeCommit'], left)) as {
                state?: string;
                mergeCommit?: { oid?: string } | null;
            };
            if (body.state === 'MERGED') return { state: 'MERGED', merge_sha: body.mergeCommit?.oid ?? null };
            if (body.state === 'CLOSED') return { state: 'CLOSED' };
            if (body.state === 'OPEN') return { state: 'OPEN' };
            return { state: 'unread' };
        } catch {
            return { state: 'unread' };
        }
    };
}
```

## The question

Review the diff for correctness, concurrency, bounding of session-start cost, and authority. State any defect you find with file and line. Then give exactly one verdict line:

`VERDICT: ship` — the session-start wiring may land as is;
`VERDICT: ship-with-fixes` — it may land once the named, bounded fixes are made (list them);
`VERDICT: refused` — it must not land (say what would change that).

If you could not see something you needed, say so and limit your verdict to what you saw.

## Diff

(diff omitted here; see the comment at the top)
