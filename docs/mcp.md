# MCP config generation

One `mcp.json` at your repo root, one `task mcp:render`, three tools configured.
No hand-editing Claude Desktop, Cursor, and Windsurf files in parallel. No
secrets committed.

## What this solves

MCP servers are configured per tool today: `.cursor/mcp.json`, a Windsurf
equivalent, and `~/.config/claude-desktop/claude_desktop_config.json`. Each
file has the same server list, duplicated. Secrets land in plaintext if you
commit them, out of reach if you don't.

The renderer fixes both:

- One source of truth (`mcp.json`) → three target files.
- `${env:VAR}` placeholders resolved at render time from the environment.
- Missing `${env:VAR}` → non-zero exit, no partial files written.

## Schema

`mcp.json` at the repo root:

```json
{
  "servers": {
    "<server-name>": {
      "command": "string",
      "args":    ["string", "..."],
      "env":     { "KEY": "string" },
      "cwd":     "string"
    }
  }
}
```

- `command` and `args` are required per server.
- `env` and `cwd` are optional.
- Every string value accepts `${env:VAR_NAME}` placeholders. The renderer
  replaces them with the value of `VAR_NAME` from the process environment.
- `${env:VAR}` may appear anywhere in a string; multiple placeholders per
  string are supported.
- The source file uses `servers` as the top-level key; the renderer emits
  `mcpServers` because that is what all three targets expect.

Internal references like `${ref:path.to.value}` are **not** supported. Keep
values literal, or resolve them from the environment.

## Usage

**Consumer projects** — use the `./agent-config` CLI installed into the
project root:

```bash
./agent-config mcp:render                    # write in-project targets
./agent-config mcp:render --claude-desktop   # also write user-scope Claude Desktop
./agent-config mcp:check                     # dry-run; exit 1 if targets are stale
```

**Package maintainers** — the same commands are available through Taskfile:

```bash
task mcp:render
task mcp:render -- --claude-desktop
task mcp:check
```

Or invoke the script directly (maintainer workflow, inside the package repo):

```bash
python3 scripts/mcp_render.py [--source PATH] [--claude-desktop] [--check]
```

Default output paths:

| Target          | Path                                                      | Scope          |
|-----------------|-----------------------------------------------------------|----------------|
| Cursor          | `.cursor/mcp.json`                                        | repo, commit it |
| Windsurf        | `.windsurf/mcp.json`                                      | repo, commit it |
| Claude Desktop  | `~/.config/claude-desktop/claude_desktop_config.json`     | user, opt-in    |

## Worked example

`mcp.json`:

```json
{
  "servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GH_TOKEN}" }
    },
    "jira": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "mcp/jira:latest"],
      "env": {
        "JIRA_TOKEN": "${env:JIRA_TOKEN}",
        "JIRA_HOST":  "example.atlassian.net"
      }
    }
  }
}
```

Then:

```bash
export GH_TOKEN=ghp_xxx
export JIRA_TOKEN=jira_yyy
task mcp:render
```

Produces `.cursor/mcp.json` and `.windsurf/mcp.json` with the secrets
substituted inline and the root key renamed to `mcpServers`.

## Failure modes

- **Missing `mcp.json`** — exit 1, message naming the expected path.
- **Invalid JSON** — exit 1, message with the parser error.
- **Missing `servers` key** — exit 1, shape rejected at load time.
- **Unresolved `${env:VAR}`** — exit 1, grouped report listing every missing
  variable and every path in the config where it is used. **No target file
  is written**, not even a partial one. Set the variable(s) and re-run.
- **`task mcp:check` disagrees with on-disk targets** — exit 1; run
  `task mcp:render` to regenerate.

## What this is not

The renderer is one-way: `mcp.json` → tool configs. It does not read or diff
pre-existing tool configs. Remove stale entries from your source file and
re-render.

Keychain backends (`security`, `secret-tool`, Bitwarden CLI) are **out of
scope**. The environment is the only secret surface. Pipe from whatever
secret tool you already use into the process environment before you run
`task mcp:render`.

## Related

- [`.agent-src.uncompressed/skills/mcp/SKILL.md`](../.agent-src.uncompressed/skills/mcp/SKILL.md) — MCP server
  selection and usage patterns.
- [`agents/roadmaps/archive/road-to-mcp.md`](../agents/roadmaps/archive/road-to-mcp.md) — archived roadmap that produced this feature.
- Reference substitution implementation: [`kdcllc/agents_config`](https://github.com/kdcllc/agents_config/blob/master/app/agents_config/base.py).
