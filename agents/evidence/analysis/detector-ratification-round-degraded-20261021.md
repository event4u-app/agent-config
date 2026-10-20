<!-- evidence-type: analysis -->

# The detector branch's ratification round came back 0/2, and the quota is spent

Recorded so the next session does not re-run it and find out the same way.

## What was attempted

`drain/road-to-one-detector-senders-20261020` carries 21 commits and touches
three gated surfaces — `_lib/egress_rules.ts`, `_lib/egress_text.ts`,
`hooks/dispatch_hook.ts` — so `check_kernel_edit_ratified` refuses the push
without a `verdict: ratified` artefact. The lane that wrote the work prepared
**four** question files and died before running any of them.

Round `a1` was run on 2026-10-21:

```
council:quorum · after the run · 0/2 present, needed 1 — INCONCLUSIVE
  ⚠️  DEGRADED — 2 member(s) did not answer; this is not convergence.
council:quota · anthropic 48/50 · openai 46/50   (both WARN · near limit)
```

**0/2 present is not a verdict.** It is not a refusal either, and it must not
be recorded as one.

## What it cost, measured rather than estimated

The quota stood at **32/50 on both seats** before the round and at **48/50
and 46/50** after. One round therefore consumed **16 anthropic calls and 14
openai calls and produced nothing.** Two and four remain.

## The likely cause, stated as a hypothesis

The `a1` prompt is **21,354 bytes**, and the three unrun siblings are larger
still (`a2` is the biggest of the four). A seat that does not answer at all —
rather than answering badly — is the shape of a request that did not complete,
so prompt size is the first thing to test. It is NOT established: nothing here
measured a size threshold, and a transport failure would look identical.

## What the next session should do, in this order

1. **Do not re-run `a1` as written.** Two calls remain on one seat; a repeat
   would exhaust it and still produce nothing if size is the cause.
2. Wait for the daily quota reset.
3. Split `a1` before resending, or send the smallest of the four first as a
   probe — one small round that concludes tells you size was the cause, and
   costs two calls to learn it.
4. Only then run the remaining rounds and write the artefact.

## The work is not at risk, and that is worth stating precisely

The 21 commits live on the local branch `drain/road-to-one-detector-senders-20261020`
at `bfcf50cea`, in the repository's own object store. They have **no remote**
— `git push` is refused by the pre-push ratification gate, correctly, because
the change is unratified. So they are durable against a crash and not durable
against a `git worktree remove` or a branch deletion. Nobody should prune that
worktree until the branch is pushed.
