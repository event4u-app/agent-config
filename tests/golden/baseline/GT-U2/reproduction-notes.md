# GT-U2 reproduction notes

- diff fixture: `tests/golden/sandbox/diffs/gt-u2-improve-diff.diff`
- persona: `(default)`
- cycle cap: 8
- final outcome: `success`
- final exit code: `0`
- cycles recorded: 6

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-U2
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config work` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
