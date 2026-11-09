<!-- evidence-type: analysis -->
# Adapted layer — gate diagnosis, 2026-11-09

For `road-to-the-adapted-layer-on-main` steps 1.1 and 1.2. Tree: `main@14a2d4f134`
with `ced3e99b3b` and `51add0fc53` cherry-picked, hook bundle built.

## Gate 1 — `check_startup_contracts`

Two failures, one cause:

```
❌  downstream-changes: carries a startup contract or an audit entry but is not a consequence-class or safety-floor rule
❌  think-before-action: carries a startup contract or an audit entry but is not a consequence-class or safety-floor rule
```

`contractProblems` (`src/scripts/check_startup_contracts.ts`, near line 95)
refuses a contract on any rule outside `requiredRules`, which is the
consequence class (`src/config/rule-consequence-class.json` `members`) plus
`tier: safety-floor`, kernel excluded. Both rules sit in that file's
`excluded` list ("A missed caller is a broken build, which is loud and
recoverable"; "Analysis discipline. Violating it wastes work."). The check has
no notion of an optional contract that a rule earns by measurement.

Once that assertion passes, the same function asks for a clause audit per rule
in `src/config/startup-contract-clauses.json`, which the payload does not
carry. The contract wording is not what fails.

## Gate 2 — `check_session_start_budget`

| Tree | Chars at session start | Files |
|---|---:|---:|
| `main@14a2d4f134` | 79,845 | 101 |
| + the two commits | 81,544 | 101 |

Default install into a scratch HOME: layer thinned, carrier probe reached.
Headroom on main was 155 chars; the adapted form adds 1,699.

Candidates outside the two benchmarked contracts:

| Candidate | Δ chars | Contracts byte-identical | Note |
|---|---:|---|---|
| Drop the `dist/agent-src/rules/` prefix from each installed file's `source_path:` | −2,200 | yes | installer format change; every reader of `source_path` checked first |
| Install the three pack floors (finance 1,819, strategy 1,884, legal 1,776) only when their pack is installed | −5,479 | yes | changes when a safety floor is delivered; every benchmark arm carried them |
| Drop the per-file frontmatter block (9,624 over 101 files) | up to −9,624 | yes | `package:` is how uninstall finds its files; needs a replacement marker |
| Raise the budget to 82,000 | +2,000 allowance | yes | host-limit allowance falls from 38,456 to 36,456 chars |

## What this does not show

It does not show that any candidate leaves behaviour unchanged. The decision
rule of the roadmap's Phase 1 covers only the two contracts' wording; a trim
elsewhere changes the layer that was measured, which the owner weighs in 1.3.
