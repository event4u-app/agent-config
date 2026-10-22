<!-- evidence-type: analysis -->


# A released-surface fixture modified outside a release cut — how to repair the single-writer test

## Facts (all verified against the tree on 2026-10-22)

- `tests/fixtures/settings_surface_released.json` records the settings surface
  as the last release cut shipped it. Its header says `"version": "16.5.0"`.
  The only intended writer is the release cut (`writeReleasedSurface`, called
  from `src/scripts/release.ts`), which also bumps `package.json`.
- `tests/scripts/release_settings_delta.test.ts`, test "single-writer: the
  committed file is written by the cut and nothing else", asserts two things:
  1. the set of source files calling `writeReleasedSurface(` is exactly two
     files (works everywhere);
  2. history: every commit returned by
     `git log --diff-filter=M -- tests/fixtures/settings_surface_released.json`
     also touches `package.json` (i.e. is a release cut). If `git log` throws
     (no history reachable) the test returns early.
- Commit `3a9b54d4c7e20bee6476b2ca83e38949b93c779e` (#2449, a squash merge,
  "Brand the tree can check…") modified the fixture without touching
  `package.json`. The diff adds one entry, `egress.placeholders.mode`
  (`type: string`, `default: "off"`, enum `off|observe|protect|strict`).
- Tag `16.5.0`'s `src/server/schemas/settings.ts` has no `egress.placeholders`
  key. So the fixture currently claims 16.5.0 shipped a key it never shipped.
  The live schema on main does carry the key, with a default.
- Consequence today: the test fails in every checkout with full history (local
  runs on main). CI is green only because its shallow fetch makes the history
  half have nothing to read.
- The 17.0.0 cut is imminent. It rewrites the fixture from the live schema via
  `writeReleasedSurface` (and bumps `package.json`), so after the cut the
  fixture's content is correct regardless of what happens now.
- Effect of the wrong entry on the cut's own assertion (`classifySettingsDelta`,
  released vs live): with the entry present, `egress.placeholders.mode` is not
  seen as a 17.0.0 addition; with it removed, it is seen as an addition with a
  default, which the cut accepts. Neither state makes the cut refuse.
- Merges into main are squash merges. A fix commit on a PR branch gets a new
  sha when it lands on main, so a test cannot name the landing sha of the fix
  commit in advance.

## Options (no preference implied)

- **(A)** Remove the wrongly added entry from the fixture now, and record
  `3a9b54d4c` as a single named historical exception in the test (exact sha +
  reason), with an assertion that the exception list never grows beyond the
  recorded entries.
- **(B)** Leave the fixture as it is (the 17.0.0 cut rewrites it) and only record
  the historical exception, with the same never-grows assertion.
- **(C)** Something else you propose.

## Questions

1. Which option, and why?
2. Under (A): is the removal commit itself another non-cut writer that the
   history assertion would flag? If yes, how should the test treat it, given
   the landing sha is unknown before the squash merge (e.g. a second exception
   added after merge, an exemption keyed on something other than the sha, or
   a rule such as "a non-cut commit whose resulting fixture is byte-identical
   to an earlier cut-written state is allowed")?
3. Whatever the option, what must the test keep doing so that a NEW non-cut
   writer is still detected? Name any assertion that must not be weakened.
4. Should CI's shallow-fetch early return be addressed in this change, or is it
   out of scope?

Answer with a chosen option, the concrete test shape, and any condition you
attach.
