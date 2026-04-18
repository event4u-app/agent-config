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
5. **Skill linter** — All skills, rules, commands pass structural validation
6. **README linter** — README passes quality checks
7. **Tests** — All bash + Python tests pass
8. **Consistency** — No uncommitted changes from generated outputs

---

## Skill Linter

The linter (`scripts/skill_linter.py`) validates:

- **Required structure** — YAML frontmatter, description, triggers
- **Anti-patterns** — Procedural rules in behavior rules, overlong skills, scope creep
- **Compression quality** — Key sections preserved after compression

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

## Observability

The system collects structured data for debugging and improvement:

| File | Content |
|---|---|
| `metrics.json` | Execution timing, token counts, skill usage |
| `feedback.json` | Outcome classification (success/failure/partial) |
| `tool-audit.json` | Tool adapter calls and results |

> **Important:** These files are collected but **never auto-injected** into agent context
> unless `runtime_auto_read_reports: true` is set in `.agent-settings`.
> Default `cost_profile` is `minimal` — zero token overhead.

### Reports

```bash
task report-stdout       # Health dashboard to stdout
task lifecycle-report    # Skill lifecycle states
task lifecycle-health    # Skill health scores
```

---

← [Back to README](../README.md)
