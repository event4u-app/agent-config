## Description

<!-- What changed and why? -->

## Type of change

- [ ] New skill/rule/command/guideline
- [ ] Update existing skill/rule/command/guideline
- [ ] Linter/tooling improvement
- [ ] Documentation
- [ ] Bug fix

## Upstream Contribution Checklist

<!-- For changes to shared agent-config package (.augment/, scripts/, templates/) -->

### Promotion Gate
- [ ] Learning occurred 2+ times OR is clearly generalizable
- [ ] Improves correctness, reliability, or consistency
- [ ] Prevents a real, observed failure
- [ ] No existing rule/skill/guideline already covers this
- [ ] Update preferred over creation (checked existing first)

### Quality Gate
- [ ] `task lint-skills` — 0 FAIL
- [ ] `task lint-skills --pairs` — no orphaned or missing pairs
- [ ] All existing tests pass

### Universality Gate
- [ ] No project-specific assumptions (domain logic, local paths, FQDNs)
- [ ] Benefits ALL consumers of the package, not just one project
- [ ] Does not break or weaken existing guidance

### Completeness Gate
- [ ] Both uncompressed + compressed versions present
- [ ] Compressed preserves: triggers, validation, decisions, gotchas
- [ ] Symlinks regenerated (`task generate-tools`)

## Testing

<!-- How was this tested? -->

## Notes

<!-- Anything reviewers should know? -->
