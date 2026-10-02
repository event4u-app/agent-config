# quality-tools — Python quality tools

> Mode body of the [`quality-tools`](../SKILL.md) skill. Load this file when
> the mode table in SKILL.md routes here. The cross-mode material — execution
> policy, environment, output discipline — stays in SKILL.md and is NOT
> repeated here.

# Python Quality Tools

## Detection

The resolver is the authority, not this table. `resolve_toolchain`
(`work_engine/stack/runner.ts`) reads `pyproject.toml` and returns the quality
commands it found; run those. The table says what each one is, so a reader can
tell a missing tool from an unknown one.

| Indicator in `pyproject.toml` | Tool | What it does |
|---|---|---|
| `[tool.ruff]` | **Ruff** | Linting and formatting in one binary; replaces flake8, isort, pyupgrade and (with `ruff format`) black |
| `[tool.mypy]` | **mypy** | Static type checking |
| `[tool.pytest.ini_options]` | **pytest** | Test runner — the resolver binds it as the test command, not as a quality command |

A repository with none of the three resolves an empty `quality` list. That
means **none was resolved**, never that none is needed — the same distinction
SKILL.md draws for ruby, jvm and dotnet.

## Ruff — linting and formatting

```bash
ruff check .              # lint, read-only
ruff check --fix .        # lint and apply the safe fixes
ruff format .             # format
ruff format --check .     # format check, read-only — what CI runs
```

Config lives in `[tool.ruff]` in `pyproject.toml` (or `ruff.toml`). The two
settings that change what the other commands mean:

- `line-length` — the formatter's wrap column; `ruff check` reports `E501`
  against the same number.
- `[tool.ruff.lint] select` / `ignore` — the rule set. An empty `select` is
  Ruff's default set, not "no rules".

**`--fix` is not a formatter.** `ruff check --fix` rewrites code to satisfy
lint rules; `ruff format` rewrites layout. A pipeline that runs only the first
leaves formatting drift that CI's `ruff format --check` then fails on.

## mypy — type checking

```bash
mypy .                    # check the package
mypy --strict .           # every optional strictness flag on
```

Config lives in `[tool.mypy]`. `strict = true` there is the same as `--strict`
on the command line, so passing the flag to a project that already sets it
changes nothing — and passing it to one that does not is a different check
from the one CI runs. Read the config before adding flags.

An error mypy reports on a file the current change did not touch is
pre-existing debt. Treat it the way SKILL.md's baseline policy treats a
PHPStan baseline entry: it is not this change's to clear silently.

## pytest — the test runner

Not a quality tool, listed here because the resolver finds it in the same
file and a reader looking for "the Python commands" expects it.

```bash
pytest                    # the resolver's bound command
pytest -q                 # quiet, what `addopts = "-q"` already sets
pytest -k '<expr>'        # filter by name — the targeted probe
pytest path/to/test.py    # filter by file
```

Run the filtered form when verifying one fix. The whole suite is the final
gate, never the per-iteration probe.

## Workflow sequence

1. `ruff format --check .` — fails fast and costs nothing.
2. `ruff check .` — lint.
3. `mypy .` — types.
4. `pytest -k '<the thing you changed>'` — targeted.
5. The full suite, once, at the end.

Each step is cheaper and narrower than the next, so running them out of order
spends the expensive verdict on a failure the cheap one would have named.

## Gotchas

- **A virtualenv the agent did not activate.** `ruff` and `mypy` installed in
  a project venv are not on `PATH` outside it. `python -m ruff` / `python -m
  mypy` run the installed copy; a bare `ruff` may run a different version or
  none.
- **`requirements.txt` only.** The resolver still binds pytest (at MEDIUM
  confidence) but finds no quality commands, because it reads them from
  `pyproject.toml`. An empty `quality` list on such a repository is correct
  output, not a detection bug.
- **`setup.cfg` and `tox.ini` carry config too.** Older projects keep flake8
  and mypy settings there. The resolver does not read them; if a project has
  no `[tool.*]` block and a populated `setup.cfg`, the tools are configured and
  the resolver's empty list is a gap in the resolver, worth reporting rather
  than working around.
