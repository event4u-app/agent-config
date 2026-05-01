# GT-U3 reproduction notes

- prompt fixture: `tests/golden/sandbox/prompts/gt-u3-audit-skipped.txt`
- persona: `(default)`
- cycle cap: 3
- final outcome: `cycle_cap_reached`
- final exit code: `1`
- cycles recorded: 3

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-U3
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config work` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
