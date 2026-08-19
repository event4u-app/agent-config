## Acceptance criteria

- [ ] The fresh-projection census is committed with its projection shape as a
      required field.
- [ ] ADR-226 carries `superseded_by`, and the successor records the partition
      decision and its owner.
- [ ] `<repo>/.claude/rules/` carries exactly the exclusively-package-only set and
      `<repo>/.claude/skills/` is empty, after a normal
      `task sync && task generate-tools`.
- [ ] `check_standing_rule_delivery` reports overlap 0.
- [ ] Neither `scope_guard.sh` nor `install-scopes.md` states that same-version
      duplication is free.
- [ ] One check asserts the partition for every artefact type, counting scope
      defeat separately.
- [ ] Both Phase-5 questions carry a recorded decision or a recorded null.
