# Quality & CI

## CI Pipeline

Run all checks before pushing:

```bash
task ci
```

This runs, in order:

1. **Sync check** — `.agent-src/` matches `.agent-src.uncompressed/` (non-`.md` files)
2. **Compression hashes** — Compressed `.md` hashes match source
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
- **Frontmatter schema** — Each artefact type has a JSON-Schema in `scripts/schemas/`; violations surface as `schema_<rule>` errors (see [frontmatter contract](../agents/docs/frontmatter-contract.md))
- **Anti-patterns** — Procedural rules in behavior rules, overlong skills, scope creep
- **Compression quality** — Key sections preserved after compression

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

## Compression System

Content flows from verbose (`.agent-src.uncompressed/`) to compressed (`.agent-src/`),
which is then projected into `.augment/` for Augment Code.

### Rules

- Source of truth is **always** `.agent-src.uncompressed/`
- Never edit `.agent-src/` or `.augment/` directly
- The `/compress` command produces token-efficient output
- Compression hashes track which files have been compressed

### Verification

```bash
task sync-check          # Non-.md files in sync?
task sync-check-hashes   # .md hashes current?
task check-compression   # Compression quality OK?
task lint-skills-pairs   # Source vs compressed comparison
```

### Fixing

```bash
task sync                # Copy non-.md files
task sync-mark-all-done  # Mark all hashes as current (after manual compress)
task consistency-fix     # Regenerate ALL derived outputs
```

---

## Runtime artifacts

Skills dispatched via `scripts/runtime_dispatcher.py run --skill NAME --output FILE`
write a typed `ExecutionResult` JSON (exit code, stdout, stderr, duration,
artifacts) to the given path. In CI, the two pilot skills `lint-skills`
and `check-refs` write to `agents/reports/runs/` and
`scripts/ci_summary.py` renders them into the GitHub Step Summary so
failures are visible on the PR page.

No data is auto-injected into agent context and no persistent metrics,
feedback, or audit logs are collected.

---

← [Back to README](../README.md)
