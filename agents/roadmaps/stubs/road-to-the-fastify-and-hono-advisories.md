---
complexity: lightweight
review_by: 2026-11-01
---

# Stub: road to clearing the `fastify` and `hono` advisories

> **Stub — not active work.** Filed 2026-10-01 by the drain run that closed
> `road-to-a-kernel-that-guards-its-plumbing`, because `fix-what-you-see` gives
> a red check two dispositions and only two: fix it with its verification, or
> land a tracked follow-up in the same change. This is the second, and the
> reason it is the second is recorded below rather than assumed.

## What is red

`npm audit --omit=dev --audit-level=high`, run as its own step in the
**Static Checks** job of `tests.yml`, exits 1:

```
fastify  <=5.12.4   Severity: high      (5 advisories: HTTP/2 trailer DoS,
                                         async-validation body replacement,
                                         not-found-handler auth bypass,
                                         boolean-false schema bypass,
                                         header case-normalisation bypass)
hono     <4.13.7    Severity: moderate  (hono/jsx unescaped strings in
                                         boundary components → XSS)
2 vulnerabilities (1 moderate, 1 high)
```

## Why it is not this branch's to fix, measured rather than asserted

- **The branch touches no dependency file.** `git diff origin/main...HEAD --
  package.json package-lock.json` is empty.
- **The same reading reproduces off the unmodified tree.** `npm audit` reads
  the lockfile, which is byte-identical to `main`'s, so the finding is the
  trunk's.
- **It arrived mid-run.** The same job passed on this branch's first head at
  01:10 and failed at 02:40 with no dependency change in between — the
  advisories published inside that window. Every open PR is red on this step
  right now, and the next one to run will be too.
- A dependency bump on a branch about hook plumbing is the drive-by
  `minimal-safe-diff` forbids by name, and it changes a surface
  `scope-control` gates.

## What closes it

1. Decide the bump: `fastify` to ≥ 5.12.5 and `hono` to ≥ 4.13.7. Both are
   patch-range moves per the advisories' own `fix available via npm audit fix`.
2. **Do not run `npm audit fix` from a worktree.** `node_modules` is a symlink
   to the parent checkout there, and the command resolves through it and
   rewrites the shared tree. Bump from the main checkout.
3. Re-run the Static Checks job. The step is a plain `npm audit` with no
   allowlist, so a clean exit is the whole acceptance condition.
4. Check `fastify`'s own surface while there: the auth-bypass advisory
   (`GHSA-p68q-wchp-6fh7`) is about encapsulated not-found handlers, and this
   package runs a local Fastify server for the setup wizard. A version bump is
   the fix; whether any route shape in `src/server/` was reachable through it
   is a separate question worth one grep before the stub is closed.

## Why a stub and not a roadmap

Estate cost. `agents/roadmaps/stubs/` is outside both `active_roadmaps` (top
level only) and `later_roadmaps` (`later/` only), so filing here records the
defect without spending estate on a change whose whole content is a version
number. If the bump turns out to need code changes — item 4 — it earns a
roadmap then, with that as its evidence.
