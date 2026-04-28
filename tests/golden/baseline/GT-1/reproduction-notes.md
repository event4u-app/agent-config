# GT-1 reproduction notes

- ticket fixture: `tests/golden/sandbox/tickets/gt-1-happy.json`
- persona: `(default)`
- cycle cap: 6
- final outcome: `success`
- final exit code: `0`
- cycles recorded: 5

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-1
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config implement-ticket` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
