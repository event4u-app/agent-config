# logq

Query structured log records from the command line.

    logq [--level <lvl>] [--sort time|level] [--format text|json]

## Pipeline

`src/main.mjs` wires four stages; each option passes through all of them:

1. `src/cli/options.mjs` — option table + argv parsing (`--name value` and `--name=value`)
2. `src/config/validate.mjs` — turns raw strings into typed, checked config; throws `UsageError`
3. `src/exec/query.mjs` — filters and sorts records, returns `{ records, matched }`
4. `src/output/format.mjs` — renders text or json

`--help` is generated from the option table in `src/cli/help.mjs`.

## Output contract

Text output prints one line per record and a footer `-- <shown> of <matched> records`.
JSON output is `{ "meta": { "shown": <n>, "matched": <n> }, "records": [...] }`.

`matched` is always the number of records that passed the filters, **before**
any option that only shortens what is printed. A count-style option given the
value `0` means "no cap", never "print nothing".
