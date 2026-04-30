# GT-P4 reproduction notes

- prompt fixture: `tests/golden/sandbox/prompts/gt-p4-ui-rejection.txt`
- persona: `(default)`
- cycle cap: 1
- final outcome: `halt_unhandled:_no_directive`
- final exit code: `1`
- cycles recorded: 1

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-P4
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config work` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
