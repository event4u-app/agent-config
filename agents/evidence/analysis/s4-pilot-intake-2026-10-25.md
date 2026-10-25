<!-- evidence-type: analysis -->

# S4 pilot — supply-chain intake and threat model

**Roadmap:** `road-to-a-pilot-benchmark-against-s4` steps 2.1 and 2.2.
**Pinned commit:** `e49479937753c8aca5a09aa76dbe2eea1b68f187`, MIT licence. Read
only, never executed, before any run. The checkout and the isolation env file live
outside the tree (the operator points `BENCH_NEIGHBOUR_PLUGIN_DIR` and
`BENCH_NEIGHBOUR_ENV_FILE` at them).

## What the plugin makes the host load

- Skills (311), commands (97) and agents (71) — prompt text.
- 27 hook commands across every lifecycle event. Each is an inline resolver that
  runs the plugin's own scripts from the plugin root the host sets.
- No MCP server by its manifest. A root-level MCP file in the checkout would start
  a browser-automation server through `npx` if it were ever picked up.

## What its hooks do — the executables the intake named

| Class | Finding |
|---|---|
| Writes outside the run | Session summaries, metrics, learned skills and an observation log under the user's home; one hook prunes old session files there. |
| State carried between runs | A session-start hook injects prior-session summaries and learned material as context. |
| Process spawning | Session-end and pre-compact hooks start a second model call under the user's auth; others run formatters, a type checker and `npx`. |
| Tool-call changes | Hooks deny the first edit until "facts" are given, block config edits, rewrite dev-server commands. |
| Credentials | No hook reads SSH, cloud, keychain or token material. |
| Network | Only MCP health probes, loopback HTTP and `npx` downloads. |

**At every hook profile, minimal included, the first three rows hold.**

## Threat model for the `neighbour` arm, and each control

| Threat | Control | Asserted by |
|---|---|---|
| Plugin writes into the user's home | Its hooks are OFF; every data-store location it honours points into a per-run temp directory | the isolation env file; the three home locations it would create are checked absent after the run |
| State leaks between benchmark runs | Hooks off; session-start context off; a fresh temp directory per run | `neighbour_env` (one directory per `run_one`) |
| A plugin-started MCP server or download | `--strict-mcp-config` | `live_args` test |
| The plugin installed into the user's host | Loaded by `--plugin-dir` for one process; nothing is installed | `live_args` test |
| The neighbour arm silently running without its plugin | The run refuses to start when the plugin dir or env file is missing | `neighbour_plugin_dir` / `neighbour_env` tests |
| Prompt text steering the model to destructive commands | The fixture is a throwaway clone; the same permissions apply to every arm | `bench_ab_v2_run` fixture reset |

**Residual risk, stated:** up to 27 short `node` processes per turn still start
from the checkout and read stdin before the off switch returns; module-scope code
of every module one dispatcher loads was not audited line by line.

**Measured after the shakedown:** the three home locations the hooks would create
were absent before and still absent after.

## What this means for the result

S4 is measured without its hooks. Its hook layer is part of what it offers, so a
result here is about its skills, agents, commands and rules on this host — not a
verdict on the whole package.
