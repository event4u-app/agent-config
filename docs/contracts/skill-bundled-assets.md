---
stability: beta
keep-beta-until: 2026-09-01
---

# Skill-bundled assets — `skills/<name>/{scripts,data}/` delivery contract

> Sanctions and pins the pattern introduced by ADR-061: a skill may bundle
> executable Python under `scripts/` and corpus/config files under `data/`
> (plus `references/` docs), and those assets **reach and run at consumer
> runtime**. Locked by `tests/test_skill_bundled_assets.py`.

## The delivery chain (verified)

| Stage | Mechanism | Guarantee |
|---|---|---|
| 1. Authoring | `src/skills/<name>/{scripts,data,references}/` | Source of truth; `.md` prose is condensed, everything else is data. |
| 2. Sync | `src/scripts/condense.py::sync_non_md` (`task sync`) | Every non-`.md` skill asset is copied byte-identical into `dist/agent-src/skills/<name>/…`. |
| 3. Packaging | `package.json` ships `dist/agent-src/` | Assets are inside the published npm artifact. |
| 4. Install | `install.py::_copy_dir_dereferencing_symlinks` | Whole skill directories (including `scripts/` + `data/`) are deployed to the consumer scope, e.g. `~/.claude/skills/<name>/…`, with symlinks dereferenced so the copy survives npx cache eviction. |

## Invocation contract — skill-relative, never project-relative

```
A BUNDLED SCRIPT RESOLVES EVERY SIBLING ASSET VIA ITS OWN FILE LOCATION
(Path(__file__).resolve().parent…), NEVER VIA $PWD OR THE PROJECT ROOT.
```

- The agent invokes bundled scripts with an **absolute or skills-root-
  relative path**: `node_modules/.bin/tsx <skills-root>/<name>/scripts/<tool>.ts …`.
  `<skills-root>` = `~/.claude/skills` (Claude Code consumer install),
  the tool-specific projection dir for other agents, or `src/skills`
  inside this repo.
- The consumer's working directory is **arbitrary** — scripts MUST work
  from any cwd. Writing output uses caller-supplied paths (flags), never
  cwd-implicit locations, except where a flag explicitly defaults to cwd.
- Cross-skill references (one skill invoking another's bundled engine)
  resolve via the common skills root (e.g. `design-intelligence` passing
  its `data/manifest.json` to `corpus-grounding/scripts/ground.ts`).
  Sibling deployment is guaranteed by stage 4 (whole-directory copies of
  every installed skill into one root).
- Bundled scripts are **pure stdlib** unless the skill's frontmatter
  declares an `execution` block gating anything heavier
  (`runtime-safety`); no network and no subprocess by default.

## What this contract does NOT cover

- Repo-root `scripts/` (e.g. `council_cli.ts`) — **maintainer-only**,
  never shipped to consumers. Do not confuse the two layers.
- `.md` files inside skills — they pass through condensation (prose is
  rewritten); do not put load-bearing machine-read data in skill `.md`.
- Binary assets — allowed by the chain, but keep corpora text-based
  (CSV/JSON) so diffs and license review stay possible.

## Regression lock

`tests/test_skill_bundled_assets.py` builds a fixture skill
(`scripts/probe.py` + `data/fixture.csv`), simulates the install copy into
a temp skills root, invokes the script from an unrelated cwd, and asserts
it finds its sibling data — plus runs the real `corpus-grounding` engine
from a foreign cwd. If that test goes red, the grounding layer is theater
at consumer runtime (road-to-frontend-design-intelligence Step 1.0).

## Port invariants — the behaviours a re-implementation must keep

The delivery chain above makes a bundled asset portable by construction: it is
copied verbatim into the consumer scope, where anyone can read it, rewrite it,
or ask an agent to re-implement it in another language. That last case is where
hardening disappears, and it disappears silently — the re-implementation runs,
produces plausible output, and reports success.

The field evidence is **Source D**: a generated site produced by an agent from
another skill's method, which re-implemented a bundled engine and lost the
refusals and defaults the original author had paid for. The descriptor is
neutral on purpose (`source-confidentiality` — this tree records no readable
harvest-source names); the pinned reference is the `ENC1:` token in the
`## Provenance` row below.

So: **a skill that bundles an executable asset lists `port_invariants:` in that
asset's own header** — the behaviours that must survive a re-implementation.

- **In the asset's header, not in a separate doc.** A ported file is read; a
  sibling document is not.
- **Each entry names the behaviour AND what breaks without it.** "Fails loudly"
  is a slogan; "exits non-zero before any work, and never falls through to a
  near-miss" is checkable.
- **Only properties whose loss is silent.** A signature change breaks the
  caller immediately and needs no invariant. A changed default does not.
- **Three to five entries.** A list nobody finishes reading is not a control.
- **Not an API contract and not a style guide.** Argument shapes, exit-code
  tables and output schemas belong in the asset's usage block.

This is a **documentation** obligation with no gate behind it: nothing can
inspect a re-implementation that lives in someone else's repository. The
invariants are what a porter reads before deciding what is safe to change.

### Pilot — `stitch.sh` (the `/video:*` clip concatenator)

Its header carries exactly these three, and
`tests/scripts/ai_video_stitch_handoff.test.ts` asserts they are still there:

```
port_invariants:
  1. hard-cut default — `--mode cut` is the default and stream-copies
     (`-c copy`). A port that re-encodes by default has changed the output of
     every existing caller without telling anyone.
  2. refusal over silent downgrade — an unimplemented or out-of-bounds request
     exits non-zero BEFORE any work and never falls through to a near-miss.
     Reporting success for output the caller did not ask for is the one failure
     this script exists to not have.
  3. handoff frame = rendered frame — a handoff seam joins clips where the later
     one was conditioned on the earlier one's RENDERED last frame, never on its
     own still. A port that re-conditions from the source still produces a
     plausible-looking chain that does not actually continue the shot.
```

Invariant 2 is the one with a recorded cost: the flag it names once printed a
notice and concatenated anyway, so a caller asking for a transition got a hard
cut and exit 0 — and the notice sat after the dry-run exit, which is the default
mode, so in the default mode the request was accepted in total silence.

### Scope note — the pilot sits outside the chain above

`stitch.sh` lives under `src/scripts/`, which "What this contract does NOT
cover" excludes: it is maintainer-only and is **not** copied into the consumer
scope. Its `/video:*` commands are, so a consumer holds the instructions to run
a script they do not have — which is exactly the re-implementation prompt
Source D describes, and why it is the honest pilot rather than a mismatched one.
The invariants section therefore governs **executable assets a consumer may
re-implement**, and the skill-bundled ones are the subset the delivery chain
above hands over intact.

## Provenance

Neutral descriptors with `ENC1:` pins (`src/scripts/_lib/link_crypto.ts`;
decrypt with the maintainer key). No source code is borrowed — the citation is
for a field observation, so no licence obligation arises here.

| Ref | Neutral descriptor | Pinned reference |
|---|---|---|
| Source D | Not a skill — a generated site produced by an agent from another skill's method, and the field evidence that a re-implemented engine loses the hardening the original author paid for. | `ENC1:HZOvYuwy9+J+8ZVdGDYleNskEFXJdF0MzqwSS0uS/chBGIvScK11YFvMesd51EUAnSr+viVtHa3k+E5qpA0QIQ==` |
