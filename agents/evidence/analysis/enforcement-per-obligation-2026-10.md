# Which obligations the sixteen gated rules actually refuse

<!-- evidence-type: analysis -->

> **Produced by:** `./scripts-run src/scripts/check_enforcement_coverage` (the
> two `obligations` lines of the summary) and
> `./scripts-run src/scripts/check_enforcement_coverage --json` (the per-rule
> `obligation` block), on branch
> `drain/road-to-enforcement-per-obligation-20261007`, 2026-10-07. Phase 4 of
> `road-to-enforcement-per-obligation`. The ids and bindings live in
> `src/config/rule-obligations.json`; re-run either command to reproduce every
> number below.

## What changed in the counting

Before this change a rule was credited as gated when its strongest
`enforced_by` entry resolved to something that can fail a build, and that
credit covered every obligation the rule states. Now each non-kernel rule
declares stable obligation ids, and an entry is bound to the ids it refuses.
The rule-level counts are unchanged and still printed first; the obligation
counts sit beside them:

```
enforcement coverage · 16/121 rules (13.2%) have a backstop that fails a CI build
  obligations: 18/290 bound to a backstop that fails a CI build · 0 observer · 272 not bound
  obligation frame: 11 rule(s) still credited by an unbound entry · 9 kernel rule(s) at rule granularity · 0 rule(s) without ids
```

No `--check` ratchet reads the obligation counts, and the exit code is the same
as before.

## The sixteen, before and after

"Before" is the rule-level credit: every obligation of a gated rule counted as
gated. "After" is what the bound entries refuse, read from each gate's own code.

| Rule | Obligations | Gated before | Gated after | Refused after | Entry and what it refuses |
|---|---:|---:|---:|---|---|
| code-comment-discipline | 4 | 4 | 1 | no-provenance-comments | `lint_code_comments.ts` refuses its `provenance-comment` class; its other two classes (German comments, report-shaped blocks) are not obligations of this rule. `hook:comment-discipline` is advisory (exit 0 always). |
| framework-neutrality-in-generic-skills | 1 | 1 | 1 | no-framework-mandate-in-generic-artifacts | `lint_framework_leakage.ts` exits 1 on a non-allowlisted hit. |
| git-history-discipline | 4 | 4 | 1 | no-hook-bypass | `hook:block-no-verify` refuses `--no-verify` and `core.hooksPath`. Unsolicited rebase, squash, amend and dropped commits are refused by nothing. |
| language-and-tone | — | rule | rule | — | Kernel rule; stays at rule granularity (no ids). |
| lethal-trifecta-guard | 1 | 1 | 0 | — | `lint_skill_frontmatter_safety.ts` refuses wildcard tool grants and consent bypass. It does not see whether a path combines all three legs; bound to `[]`. |
| media-governance-routing | 1 | 1 | 0 | — | `lint_media_policy_linkage.ts` refuses an orphan policy file. The obligation is to consult the policies before a prompt; bound to `[]`. |
| no-roadmap-references | 2 | 2 | 2 | no-roadmap-file-links, no-council-artefact-links | `check_no_roadmap_refs.ts` and `check_council_references.ts`, one id each. |
| output-discipline | 2 | 2 | 1 | no-placeholder-prose | `lint_output_slop.ts` exits 2 on six placeholder patterns. The PAUSED-marker obligation is refused by nothing. |
| persona-governance | 4 | 4 | 1 | per-domain-specialist-cap | `lint_persona_governance.ts` fails only on the cap; the citation floor is a warning. |
| preservation-guard | 5 | 5 | 3 | every-passage-stays, iron-law-headings-verbatim, fences-byte-for-byte | `check_condensation.ts` asserts `dist == rewrite(src)` byte for byte, which refuses a lost passage, heading or fence in the projection. `skill_linter.ts`'s condensation-quality check emits warnings only; bound to `[]`. |
| secret-vcs-guard | 4 | 4 | 1 | no-credential-in-tracked-file | `check_secret_leak.ts` fails on a high-confidence finding. Detect-show-ask, never-strip and rotate-first are agent behaviour. |
| skill-quality | 1 | 1 | 1 | executable-validated-self-contained-skills | `skill_linter.ts` errors. |
| source-confidentiality | 3 | 3 | 1 | no-derivation-attribution | `check_no_external_sources.ts` refuses a denied source name. Encrypted links and anonymised harvest roadmaps are not decided by it. |
| source-of-truth | 2 | 2 | 2 | no-edits-in-projections, edit-src-then-condense | `check_condensation.ts`: a hand edit and a stale projection both break `dist == rewrite(src)`. |
| token-optimizer-maintenance | 1 | 1 | 1 | update-optimizer-row-with-asset | `check_token_optimizer_freshness.ts` fails on a missing target or keyword drift. |
| tool-safety | 6 | 6 | 2 | deny-by-default-tools, scoped-grants-over-bare-names | `lint_agent_security.ts` runs the dangerous-frontmatter linter (automated execution without `allowed_tools`, wildcard and bare-`Bash` grants). Its MCP-config linter refuses an inline secret in a shipped MCP config, not in a skill file, so no-hidden-credentials is not credited. Read-first, the registry allowlist and no-arbitrary-execution are not refused. |
| **Total (15 non-kernel)** | **41** | **41** | **18** | | |

Two rules lose all obligation credit while keeping their rule-level credit:
`lethal-trifecta-guard` and `media-governance-routing`. Both are recorded with an
explicit empty binding, which the report treats as a finding and not as an
unbound entry.

## What is still unbound

The 11 rules still credited by an unbound entry are the kernel rule
`language-and-tone` and the ten rules whose strongest entry resolves to
`observer`. Phase 4 binds the gated set only. An observer entry refuses nothing,
so binding it would move ids into the `observer` column and leave `blocking`
where it is; the candidates below are the obligations where an existing
backstop could move an id into `blocking`.

## Observer candidates

Obligations in the observer set that an existing backstop could refuse. Nothing
here is wired; each row names the backstop and the slot an `enforced_by` entry
plus a binding would use.

| Obligation | Existing backstop | Slot | Note |
|---|---|---|---|
| evaluator-independence.no-verdict-in-evaluator-prompt | `src/scripts/hooks/evidence_independence.ts` | `hook:evidence-independence` (pre_tool_use) | Declared today, resolves to observer because the manifest sets `fail_closed: false`; it denies on the one host that honours a deny. |
| evaluator-independence.prompt-recorded-with-verdict | `src/scripts/check_review_prompt_binding.ts` | `validator:` | Runs in `taskfiles/ci-fast.yml`; not declared on the rule. |
| evaluator-independence.no-silent-test-weakening | `src/scripts/check_test_weakening.ts` | `validator:` | Runs in `.github/workflows/tests.yml`; not declared on the rule. |
| roadmap-progress-sync.park-blocked-roadmaps-in-later | `src/scripts/lint_roadmap_later_disposition.ts` | `validator:` | Refuses `status: later` outside `agents/roadmaps/later/`. |
| roadmap-progress-sync.archive-in-completing-pr | `src/agent-src/scripts/update_roadmap_progress.ts --check` | `validator:` | Reached from `task roadmap-progress-check` only, so it would resolve to `validator-local`, not blocking. |
| roadmap-progress-sync.no-silent-archive-with-deferred | `src/agent-src/scripts/update_roadmap_progress.ts --archive` | `validator:` | The archive sweep skips a roadmap with deferred items; same taskfile-only reach. |

## Limits

- Bindings are read from gate code once, on this date. Nothing fails when a
  gate later stops refusing a bound id; the council considered a validator for
  that and did not adopt it (blocker `obligation-granularity`).
- Obligation boundaries are editorial. Splitting or merging an id moves the
  share without any gate changing; the per-rule table is the reviewable diff.
