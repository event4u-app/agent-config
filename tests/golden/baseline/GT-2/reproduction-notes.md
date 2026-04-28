# GT-2 reproduction notes

- ticket fixture: `tests/golden/sandbox/tickets/gt-2-ambiguity.json`
- persona: `(default)`
- cycle cap: 1
- final outcome: `halt_unhandled:_no_directive`
- final exit code: `1`
- cycles recorded: 1

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-2
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config implement-ticket` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
