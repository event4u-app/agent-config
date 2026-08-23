<!-- evidence-type: analysis -->

# Pre-state — what the suite says about a component *library* today

Pinned at `cc1e0376b` (main after PR #1589), measured 2026-08-23, before any Phase-1 skill
existed. Fixture: `tests/fixtures/library/ui-lib-vite/`.

## Method — and why it is a grep, not a transcript

Step 0.2 says *"run `existing-ui-audit` and `project-analysis-react` against the fixture and
file the outputs"*. Both are **prose skills**: their "output" is whatever an agent produces
after reading them, which is not reproducible and not evidence anyone can re-derive. So the
pre-state recorded here is what those two skills **instruct an agent to look for** — read
off the skill bodies at the pinned commit, reproducible by anyone with a grep.

Recording it this way is the point rather than a shortcut: the roadmap's expected finding is
that *neither skill names the package surface*, and a skill's own text is exactly where that
is decidable. A transcript would have added a model's improvisation on top and made the
absence unprovable.

## The measurement

| Term | `existing-ui-audit/SKILL.md` | `project-analysis-react/SKILL.md` |
|---|---|---|
| `exports` | **2 hits, neither about a package** | 0 |
| `peerDependencies` | 0 | 0 |
| `stories` | 0 | 0 |
| `storybook` | 0 | 0 |

Both `exports` hits are the component-descriptor field, not the manifest key:

- `SKILL.md:82` — *"Capture each component/template as: `{path, name, kind: …, exports?: [props]}`"*
- `SKILL.md:247` — *"array of component/template descriptors (path, name, kind, exports)"*

That is a component's **props**, not a package's public surface. The confirmed finding
stands: at this commit **no skill in the suite reads a library's `exports` map, its
`peerDependencies`, or its stories.** The audit inventories components; nothing inventories
the package around them.

## What this establishes, and what it does not

- **Establishes:** the gap Phase 1 fills is real and was not covered elsewhere under a
  different name. The two skills nearest to the subject do not name any of the four terms.
- **Does not establish** that an agent given the fixture would produce a poor answer. An
  agent can read a `package.json` without a skill telling it to; what is missing is the
  *instruction* to, and the criteria for judging what it finds.
- **Does not measure** a real library. The fixture is a two-root metadata fixture with a
  hand-authored `dist/` — see its README for what that deliberately does not prove.

## Reproduce

```bash
git checkout cc1e0376b
for t in exports peerDependencies stories storybook; do
  printf '%-18s audit=%s react=%s\n' "$t" \
    "$(grep -ic "$t" src/skills/existing-ui-audit/SKILL.md)" \
    "$(grep -ic "$t" src/skills/project-analysis-react/SKILL.md)"
done
```

## Reopening condition

Re-measure if either skill gains a package-surface section, or if a third skill starts
naming these terms — at which point the gap this roadmap fills may have moved rather than
closed.
