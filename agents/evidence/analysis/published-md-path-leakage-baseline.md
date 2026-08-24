<!-- evidence-type: analysis -->

# Absolute paths in published `.md` — the population is 12, and none of them is a leak

Measured 2026-08-24. Discharges Phase 0.1 of
`road-to-inbox-harvest-2026-08-e-command-surface-legibility`, and **falsifies
Phase 0.3's target of 0**.

## Method, reproducible

"Published `.md`" is derived from `package.json` `files[]` rather than guessed, so
the population is the one the tarball actually ships: every tracked `.md` under
`dist/agent-src/`, `docs/guidelines/`, `src/scripts/`, `src/agent-src/`,
`agents/templates/`, `src/templates/`, `src/config/`, plus the nine named
root/contract files.

The four patterns are `check_bundle_path_leakage.ts`'s own — `macos-linux-home`,
`private-or-opt-root`, `windows-drive`, `worktree-path` — copied verbatim from
`LEAK_PATTERNS` so the baseline is measured with the same regexes the extension
would apply. (`parent-relative-node-modules` and `absolute-node-modules` are
bundle-shaped and cannot occur in prose; they were not run.)

```bash
git ls-files | grep '\.md$'   # then filter to the files[] roots above
# and apply LEAK_PATTERNS from src/scripts/check_bundle_path_leakage.ts
```

## The population

**947 published `.md` scanned · 12 hits · 9 distinct files.**

| Pattern | Hits |
|---|---|
| `macos-linux-home` | 7 |
| `private-or-opt-root` | 3 |
| `worktree-path` | 1 |
| `absolute-node-modules` | 1 |
| `windows-drive` | 0 |

### Two corrections to this file's own first numbers, recorded rather than overwritten

**It is 12, not 11, and the miss was a stated assumption that turned out false.**
The first pass ran four of the gate's six patterns and said so —
`parent-relative-node-modules` and `absolute-node-modules` were skipped as
*"bundle-shaped and cannot occur in prose"*. Running the real gate found
`commands/optimize/augmentignore.md:99` carrying `/node_modules/` inside a
sentence about what an ignore file should cover. The assumption was wrong in the
direction that under-reports, which is the worse direction, and the lesson is the
narrow one: run the gate rather than re-implementing its patterns.

**The population is 947, not 1,079.** The first pass scanned `src/agent-src/`
wholesale; `package.json` `files[]` ships only `src/agent-src/scripts/` and
`src/agent-src/templates/scripts/`. Caught by the gate's own new test, which
asserts every declared root is inside `files[]` — 132 files were being counted
that no consumer receives.

| File:line | Match | What it actually is |
|---|---|---|
| `commands/knowledge/forget.md:63` | `/Users/maintainer/clients/acme` | a documentation **example** path |
| `commands/knowledge/list.md:58` | `/Users/maintainer/clients/acme` | same example |
| `commands/package/test.md:69` | `/Users/me/projects/my-package` | a documentation example |
| `rules/doc-screenshot-hygiene.md:62` | `/Users/<realname>/…` | the rule **forbidding** real-name paths, quoting the shape it forbids |
| `skills/screenshot-hygiene/SKILL.md:71` | `/Users/<realname>/…` | same, in the skill that implements it |
| `skills/screenshot-hygiene/SKILL.md:72` | `/home/<realname>/…` | same |
| `skills/screenshot-hygiene/SKILL.md:78` | `/Users/<handle>/…` | same — the *allowed* variant, contrasted with the forbidden one |
| `rules/low-impact-corpus-privacy-floor.md:46` | `` `/opt/ `` | the rule **listing the patterns it detects**, in a backticked enumeration |
| `rules/low-impact-corpus-privacy-floor.md:46` | `` `/private/ `` | same line, same enumeration |
| `skills/traefik/SKILL.md:60` | `/opt/homebrew/etc/dnsmasq.conf` | a **real and correct** Homebrew path a consumer edits |
| `skills/worktree-lifecycle/SKILL.md:141` | `.claude/worktrees/` | the skill documenting **this package's own** worktree convention |
| `commands/optimize/augmentignore.md:99` | `/node_modules/` | prose about what an ignore file should cover — found by the gate, missed by this file's first pass |

## The finding — zero leaks, and the target of 0 is wrong

**Not one of the eleven is a build-machine path leak.** They are three classes,
and each has a different reason to stay:

1. **Documentation examples** (3) — `/Users/maintainer/…`, `/Users/me/…`. Already
   anonymised placeholders. A gate cannot tell them from a real path by regex,
   because they are *shaped* like one on purpose.
2. **The rules that forbid the pattern, quoting it** (6). This is the sharp case:
   `doc-screenshot-hygiene` exists to stop `/Users/<realname>/…` reaching a
   shipped artefact, and `low-impact-corpus-privacy-floor` lists `/opt/` and
   `/private/` as the patterns it detects. **A gate that reds on these makes the
   rule unwritable.** Same shape as `lint_deterministic_time`, whose own docstring
   names the construct it bans and which therefore had to exempt comments and
   string literals from its own matcher.
3. **Legitimately absolute paths** (2) — `/opt/homebrew/etc/dnsmasq.conf` is where
   the file is, and `.claude/worktrees/` is this package's own convention being
   documented by the skill that owns it.

So Phase 0.3's *"the existing population melts down, target 0"* describes a target
that **cannot be reached without deleting correct content**. Class 3 is
permanently legitimate; class 2 is permanently legitimate *and* is the rule layer
this repository's own privacy discipline rests on.

## What an extension would need instead

A forward-only ratchet is still the right shape — a **real** leak in a new file
should red. What the baseline shows is that the ratchet's floor is not 0 and the
gate needs a way to say *"this occurrence is the pattern being documented, not
committed"*. Three mechanisms already exist in this tree for exactly that shape:

- an inline marker (`# secret-allow`'s form, or `<!-- ref-ignore -->`),
- a repo-root allow file (`.secret-allow`'s form, line-pinned so drift reds),
- or the `lint_deterministic_time` approach: exempt matches inside backticks and
  fenced blocks, which covers class 2 mechanically and needs no per-site marker.

Choosing among them is a design decision, not a measurement, and is put to the
council rather than decided here.

## What this measurement does NOT establish

- **Nothing about untracked or generated output.** Only tracked `.md` inside
  `files[]` was scanned. `dist/install/`'s bundle roots — the gate's current
  scope — are untouched by this and were not re-measured.
- ~~**Nothing about `parent-relative-node-modules` / `absolute-node-modules`.**~~
  **Withdrawn.** That exemption was this file's own assumption and it was wrong:
  `absolute-node-modules` has one prose hit. `parent-relative-node-modules` has
  none, which is now a measurement rather than a prediction.
- **Nothing about whether the three example paths SHOULD be anonymised further.**
  `/Users/maintainer/` and `/Users/me/` are already placeholders; whether a
  convention should force a non-path-shaped form instead is a separate question
  this file does not answer.
