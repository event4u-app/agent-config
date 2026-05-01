# GT-U4 reproduction notes

- prompt fixture: `tests/golden/sandbox/prompts/gt-u4-polish-ceiling.txt`
- persona: `(default)`
- cycle cap: 9
- final outcome: `cycle_cap_reached`
- final exit code: `1`
- cycles recorded: 9

## How to regenerate

From the repo root:

```bash
python3 -m tests.golden.capture --scenarios GT-U4
```

The driver materialises the toy repo under a temporary
directory and invokes `./agent-config work` once
per cycle. Recipe steps mutate the persisted state file in
the same shape the agent would write.
