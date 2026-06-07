---
stability: beta
keep-beta-until: 2026-09-07
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
  relative path**: `python3 <skills-root>/<name>/scripts/<tool>.py …`.
  `<skills-root>` = `~/.claude/skills` (Claude Code consumer install),
  the tool-specific projection dir for other agents, or `src/skills`
  inside this repo.
- The consumer's working directory is **arbitrary** — scripts MUST work
  from any cwd. Writing output uses caller-supplied paths (flags), never
  cwd-implicit locations, except where a flag explicitly defaults to cwd.
- Cross-skill references (one skill invoking another's bundled engine)
  resolve via the common skills root (e.g. `design-intelligence` passing
  its `data/manifest.json` to `corpus-grounding/scripts/ground.py`).
  Sibling deployment is guaranteed by stage 4 (whole-directory copies of
  every installed skill into one root).
- Bundled scripts are **pure stdlib** unless the skill's frontmatter
  declares an `execution` block gating anything heavier
  (`runtime-safety`); no network and no subprocess by default.

## What this contract does NOT cover

- Repo-root `scripts/` (e.g. `council_cli.py`) — **maintainer-only**,
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
