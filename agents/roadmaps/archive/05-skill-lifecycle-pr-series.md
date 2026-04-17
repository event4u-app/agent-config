# Skill Lifecycle — Concrete PR Series

**Status: ✅ COMPLETE**

## Goal

Introduce lifecycle management so skills can evolve safely over time.

## Outcome after this series

The system should support:

- [x] versioned skills
- [x] lifecycle states
- [x] deprecation warnings
- [x] migration hints
- [x] cleanup strategy

---

# PR 1 — Version and status metadata ✅

## Objective

Add lifecycle metadata to skills.

## Files to update

- skill frontmatter format documentation
- `scripts/skill_linter.py`
- `skill-writing`
- `skill-reviewer`
- sample skills

## Metadata proposal

```yaml
version: 1.0.0
status: active | deprecated | superseded
replaced_by: skill-name
```

## Linter changes

- validate version format
- validate allowed statuses
- require `replaced_by` when status is `superseded`

## Acceptance criteria

- lifecycle metadata is supported
- invalid lifecycle metadata fails lint

---

# PR 2 — Usage tracking integration ✅

## Objective

Tie lifecycle to real usage and change data.

## Files to create/update

- `scripts/usage_tracking.py`
- `tests/test_usage_tracking.py`
- observability integration points

## Features

Track:
- recently used skills
- frequently failing skills
- rarely used skills
- deprecated skill usage

## Acceptance criteria

- usage data exists in structured form
- lifecycle decisions can use actual evidence

---

# PR 3 — Deprecation warnings and migration hints ✅

## Objective

Make lifecycle visible to maintainers and users.

## Files to update

- `scripts/skill_linter.py`
- `scripts/runtime_registry.py`

## Behavior

Warn when:
- deprecated skill is still used
- superseded skill is selected without migration note
- replacement skill exists but old one remains in use

## Acceptance criteria

- deprecated/superseded use is visible
- replacements are discoverable

---

# PR 4 — Migration tooling ✅

## Objective

Support safe transitions between old and new skills.

## Files to create

- `scripts/skill_migration_report.py`
- `tests/test_skill_migration_report.py`
- `docs/skill-migration.md`

## Features

- list deprecated skills
- show replacements
- detect missing migration targets
- report skills lacking lifecycle completeness

## Acceptance criteria

- maintainers can plan migrations intentionally
- no deprecated skill remains invisible

---

# PR 5 — Cleanup policy and archival ✅

## Objective

Define when old skills can be removed or archived.

## Files to create/update

- `.augment.uncompressed/rules/skill-lifecycle.md`
- `docs/cleanup-policy.md`

## Policy examples

- deprecated for N releases → archive candidate
- superseded + zero usage in N windows → removal candidate
- breaking replacement must include migration note

## Acceptance criteria

- cleanup decisions are policy-based
- skills do not accumulate indefinitely

---

# Suggested sequencing notes

- do not add lifecycle metadata without tooling support
- do not deprecate aggressively before usage tracking exists
- use warnings before removals
