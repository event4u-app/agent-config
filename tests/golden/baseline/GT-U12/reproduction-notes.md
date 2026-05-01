# GT-U12 reproduction notes

- prompt fixture: `tests/golden/sandbox/prompts/gt-u12-ambiguous.txt`
- persona: `(default)`
- cycle cap: 4
- final outcome: `success`
- final exit code: `0`
- cycles recorded: 3

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-U12
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config work` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
