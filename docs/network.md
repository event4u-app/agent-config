# What leaves your machine

Every network call the installed package can make, whether it runs by
default, and how to switch it off. Settings named below are keys in the
settings cascade (template: [`src/config/agent-settings.template.yml`](../src/config/agent-settings.template.yml));
`agent-config settings:get <key>` prints the value in effect and the file it
came from. Calls your AI tool makes on its own are the tool's business and
are not listed here.

| Call | What is sent, and to whom | Default | Switch it off | Source |
|---|---|---|---|---|
| Update check | A version lookup for `@event4u/agent-config` against the npm registry, at most once per 24 hours; the result is a two-line banner after a command finishes | **on** | `update_check.enabled: false`, or `AGENT_CONFIG_NO_UPDATE_CHECK=1`; CI and non-interactive output never show it | template § Update check |
| Unattended upgrade | Downloads a release tarball and its attestations from npm and verifies them against trust material pinned in the installed package; nothing about you is sent | **off** (`update.mode: notify` tells you, never installs) | keep `update.mode` at `notify` or `off` | template § Update install mode; [`SECURITY.md`](../SECURITY.md) § Unattended upgrades |
| Security advisory refresh | Names and versions of your project's *public* packages to `api.osv.dev`; runtime lifecycle data from endoflife.date; the PHP and Node release feeds; the CISA known-exploited catalog, downloaded whole and matched locally. A private package name is never sent | runs only when you run `agent-config audit:deps refresh`; a session start reads the local cache only | `advisories.egress: none` (sends nothing), `advisories.kev: off`, `advisories.mode: off` | template § Security advisories |
| Retro merge probe | Asks GitHub, through your own `gh` login, whether a pushed pull request merged (repository and PR number only) | **on** | `retro.enabled: false` | template `retro.enabled` |
| AI council | Your question and the files you choose go to the AI providers you configured, with your own API keys | **off** — nothing runs until you create `~/.event4u/agent-config/settings/.ai-council.yml` | do not configure it, or delete that file | template § AI Council; [`docs/contracts/ai-council-config.md`](contracts/ai-council-config.md) |
| Cloud MCP server | Requests from your AI tool to the hosted MCP endpoint | **off** — only if you add the endpoint to your tool | remove it from your tool's MCP config; the local server runs over stdio with no network | [`setup/mcp-cloud-setup.md`](setup/mcp-cloud-setup.md), [`getting-started-local-stdio.md`](getting-started-local-stdio.md) |
| Telemetry | One record per skill use, with no free-form content, to an organisation's endpoint | **off** — needs an org pack's `endpoint`, `org_id` and `salt`, none of which has a default | leave `telemetry.remote` unset | [`SECURITY.md`](../SECURITY.md) § Telemetry |
| Install and upgrade | `npx` / `npm` fetch the package from the npm registry; `setup.sh` fetches a GitHub tarball | when you run them | — | [`installation.md`](installation.md) |

The monthly request to star the repository is text only: no network call and
no GitHub account lookup (template § Star ask).
