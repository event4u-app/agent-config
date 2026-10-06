<!-- evidence-type: analysis -->

# The real opted-in thinned total, measured against AC-1's own number

> Evidence for `road-to-an-installed-layer-that-is-thinned`, steps 3.2 and
> AC-1. Pinned to `main` @ `a75bb3210` (the branch head this run started from).

## The question

Phase 1 of this roadmap (steps 1.1–1.4) is closed, and its own unit tests
("`npx vitest run tests/scripts/install_thin_layer.test.ts`") pass — but every
one of those cases runs over a SYNTHETIC fixture package root (four or five
rules), not the real `dist/agent-src/rules` corpus (`tests/scripts/
install_thin_layer.test.ts:1-16` states this deliberately: "pinning them to the
live corpus would make them restate whatever the corpus happens to contain
today"). Nobody had yet pointed the real installer, with the opt-in set, at the
real corpus and read the number AC-1 asks for: "stands under 75,000
package-owned characters, read by the installed-layer report."

## The method

A real `bash src/scripts/install --global --tools=claude-code --yes --quiet`
run (same orchestrator `tests/install/global_install_hooks_smoke.test.ts`
drives), against a fresh `mkdtemp` `HOME`, with
`<HOME>/.event4u/agent-config/settings/.agent-settings.yml` carrying:

```yaml
lean_projection:
  mode: delivery
  hosts:
    - claude-code
```

— the opt-in layer step 1.1 reads (`load_agent_settings` honours
`EVENT4U_CONFIG_HOME` first). Then `buildInstalledLayerReport({ home,
projectRoot })` from `src/scripts/_lib/installed_layer.ts` over the resulting
`<HOME>/.claude/rules`, and separately a byte classification of every installed
file via `is_thin_entry` (`src/scripts/_lib/thin_rules.ts`) against
`ruleBody` (`src/scripts/_lib/rule_law_section.ts`).

A fresh, empty, nothing-else-installed `HOME` means package-owned and total are
the same number — there is no foreign content for the ownership split to
subtract. (The report's own `manifest_present: false` branch reads every file
as "foreign" when no ownership manifest path is supplied; that is an input to
`buildInstalledLayerReport`, not evidence that the installed files are not
ours — in a scratch `HOME` with nothing else ever written to it, 100% of the
total IS package-owned.)

## The result

**111,197 characters, 105 files, `claude-code` global scope.**

- 89 files are thinned (`is_thin_entry` true): 52,925 chars, ~594 chars/file —
  the stub-plus-law form working as designed.
- 16 files are kept FULL by `project_thin_rules`'s own predicate (kernel,
  path-only, or trigger-less — ADR-267 decision 5): 58,272 chars. The sixteen,
  largest first: `design-review-after-ui-write` (7,588), `autonomous-execution`
  (6,146), `ui-audit-gate` (6,113), `legal-safety-floor` (5,583),
  `non-destructive-by-default` (3,938), `tool-safety` (3,572),
  `scope-control` (3,565), `no-cheap-questions` (3,282), `direct-answers`
  (3,123), `language-and-tone` (3,035), `commit-policy` (2,805),
  `question-not-instruction` (2,435), `verify-before-complete` (2,375),
  `ask-when-uncertain` (2,306), `agent-authority` (1,275),
  `runtime-safety` (1,131).

52,925 + 58,272 = 111,197.

## What this means for the roadmap

**AC-1 ("stands under 75,000 package-owned characters") does not hold on the
real corpus today.** The thinning mechanism itself is correct — the 89
thinned files average well under the law-section ceiling — but the 16
full-bodied rules alone (58,272 chars) already consume 78% of the 75,000 hard
target before a single thinned stub is counted, and together the two halves
land 48% over the hard ceiling (111,197 / 75,000 ≈ 1.48×) and 71% over the
65,000 target.

This is NOT a defect in Phase 1's own claims — 1.1–1.4's `verify:` lines are
about the MECHANISM (thinning reduces a given rule, rollback restores it,
upgrades converge, the receipt warns), and all four hold. It is new evidence
that the roadmap's own "Done means" bar — reachable per its Goal section only
once the full set of rules is accounted for — is not reachable by Phase 1–2 of
THIS roadmap alone, because the sixteen full-bodied rules are explicitly out of
this roadmap's scope ("What this roadmap deliberately does not do" names no
kernel-plus-index layer and protects ADR-267 decision 5's file set).

Two consequences taken in this same change, both conservative:

1. **Step 3.2 ("the ceiling becomes required") is left open rather than
   implemented as a hard-failing CI gate.** A gate enforcing "never above
   75,000" would be red from the moment it merged, against a corpus this
   roadmap does not touch — landing it here would break CI for every
   subsequent PR over a problem this file's scope excludes. The step's own
   text assumes the ceiling is reachable; this measurement shows it presently
   is not, by a wide enough margin that the fix is a different, larger piece
   of work (reducing the 16 full-bodied rules, which already has an
   in-progress sibling effort per `worktree-kernel-budget-trim` on this
   machine).
2. **AC-1 stays `[ ]`.** Closing it would assert a bar this measurement shows
   is not cleared.

## Reproduce

```bash
# from the repo root, any branch at or after this file's pinned commit
HOME=$(mktemp -d)
mkdir -p "$HOME/.event4u/agent-config/settings"
printf 'lean_projection:\n  mode: delivery\n  hosts:\n    - claude-code\n' \
  > "$HOME/.event4u/agent-config/settings/.agent-settings.yml"
EVENT4U_CONFIG_HOME="$HOME/.event4u/agent-config" AGENT_CONFIG_NO_UI=1 CI=1 \
  bash src/scripts/install --global --tools=claude-code --yes --quiet
./scripts-run src/scripts/installed_layer_report --home "$HOME" --project "$(mktemp -d)"
```

The `claude-code (global)` row's total is the number this file cites, modulo
whatever the corpus looks like on the day it is re-run — the figure is a
measurement of a moving tree, not a fixed constant, which is the entire reason
step 3.2 wants a stored, shrink-only baseline once the real number is under the
ceiling it is supposed to enforce.
