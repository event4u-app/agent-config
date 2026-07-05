# Optional media tooling (B8 recorded demos)

The package ships **no bundled binaries** and never installs system tools
silently (`missing-tool-handling`). A small set of tools is *optional* — needed
only for the B8 recorded proof-page demos, not for day-to-day maintenance.
Install them **on demand**, when the check tells you to.

## The tools

| Tool | What it does |
|---|---|
| `asciinema` | Records a terminal session to a compact `.cast` file (timestamped JSON of what was typed + printed). Replayable / embeddable — no backend, fits the no-runtime floor. |
| `agg` | Converts a `.cast` → animated GIF (asciinema's gif generator), for embedding a short run on the proof page. |

## When you need them

- Only for **B8** — recording a real wedge / skill run for the proof page.
- Once B8 lands, its falsifiability lock regenerates each recording **in CI from
  a real run**, so the CI job (and any maintainer refreshing a demo) needs them.
- Nothing else in the suite uses terminal recording — this is not a daily tool.

## Check before recording (never a silent install)

```bash
task check-media-deps
```

It detects `asciinema` + `agg`, and if either is missing prints the exact
platform install command and exits non-zero — the same detect-and-instruct
shape as the docker check in `taskfiles/mcp.yml`. It never installs anything
for you.

## Install (only when the check asks)

| Platform | Command |
|---|---|
| macOS | `brew install asciinema agg` |
| Linux | `pipx install asciinema` · `cargo install --locked agg` (or a release binary) |
| Other | see each tool's own install docs |

## Why not auto-install with the maintainer package

Three reasons the base setup does **not** pull these in:

1. **The suite's own floor** (`missing-tool-handling`) forbids silent system-binary installs — detect + prompt only.
2. **Cross-platform fragility + surface** — `asciinema` (brew / pipx) and `agg` (brew / cargo / release binary) install differently per OS; a config package that brings in system binaries on setup is invasive.
3. **YAGNI** — a single, gated feature does not justify a base-setup dependency.

The `check-media-deps` gate gives every maintainer the same on-demand path
without any of the above — which is exactly what "install on demand" means here.
