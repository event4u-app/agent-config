# Quality & CI

## CI Pipeline

Run all checks before pushing:

```bash
task ci
```

This runs, in order:

1. **Sync check** — `.agent-src/` matches `.agent-src.uncondensed/` (non-`.md` files)
2. **Condensation hashes** — Condensed `.md` hashes match source
3. **Reference check** — No broken cross-references between files
4. **Portability check** — No project-specific paths in shared files
5. **Schema validation** — Frontmatter of every skill/rule/command/persona matches its JSON-Schema contract
6. **Skill linter** — All skills, rules, commands pass structural validation
7. **README linter** — README passes quality checks
8. **Tests** — All bash + Python tests pass
9. **Consistency** — No uncommitted changes from generated outputs

---

## Skill Linter

The linter (`scripts/skill_linter.py`) validates:

- **Required structure** — YAML frontmatter, description, triggers
- **Frontmatter schema** — Each artefact type has a JSON-Schema in `scripts/schemas/`; violations surface as `schema_<rule>` errors (see [frontmatter contract](../agents/reference/docs/frontmatter-contract.md))
- **Anti-patterns** — Procedural rules in behavior rules, overlong skills, scope creep
- **Condensation quality** — Key sections preserved after condensation

Schema validation also runs standalone via `task validate-schema` — fast
fail before the full linter.

### Quality levels

| Level | Meaning |
|---|---|
| **PASS** | Meets all requirements |
| **WARN** | Advisory — may need attention but not blocking |
| **FAIL** | Must be fixed before merge |

### CI integration

- GitHub Actions runs the linter on every PR
- Results are posted as PR comments with quality counts
- **0 FAIL required** — no merge with failures

---

## Condensation System

Content flows from verbose (`.agent-src.uncondensed/`) to condensed (`.agent-src/`),
which is then projected into `.augment/` for Augment Code.

### Rules

- Source of truth is **always** `.agent-src.uncondensed/`
- Never edit `.agent-src/` or `.augment/` directly
- The `/condense` command produces token-efficient output
- Condensation hashes track which files have been condensed

### Verification

```bash
task sync-check          # Non-.md files in sync?
task sync-check-hashes   # .md hashes current?
task check-condensation   # Condensation quality OK?
task lint-skills-pairs   # Source vs condensed comparison
```

### Fixing

```bash
task sync                # Copy non-.md files
task sync-mark-all-done  # Mark all hashes as current (after manual condense)
task consistency-fix     # Regenerate ALL derived outputs
```

---

## Runtime artifacts

Skills dispatched via `scripts/runtime_dispatcher.py run --skill NAME --output FILE`
write a typed `ExecutionResult` JSON (exit code, stdout, stderr, duration,
artifacts) to the given path. In CI, the two pilot skills `lint-skills`
and `check-refs` write to `agents/runtime/reports/runs/` and
`scripts/ci_summary.py` renders them into the GitHub Step Summary so
failures are visible on the PR page.

No data is auto-injected into agent context and no persistent metrics,
feedback, or audit logs are collected.

---

← [Back to README](../README.md)
