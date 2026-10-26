# Runtime facts in the map

`agent-config code-graph build` reads what the project runs into the map's
runtime area (`agents/map/runtime/`): compose services, ports, images, <!-- ref-ignore -->
volumes, Dockerfiles, devcontainer config, Make / Task targets. Files only — it
never talks to the Docker daemon, never runs a binary, keeps environment
entries as names and never reads a `.env` value; hostnames and IPs are
redacted. To give it the resolved model, the user runs `docker compose config`
and saves the output as `compose.resolved.yaml` (or `compose-config.yaml`).

Advice-only drift on those facts: **RT-1** host port collision · **RT-2**
database image engine differs from the data lane · **RT-3** env name read in
code but not declared · **RT-4** database port published beyond localhost ·
**RT-5** image on the `latest` tag · **RT-6** resource referenced but
undeclared. Before changing a service on the strength of a map fact, confirm it
(`agent-config code-graph confirm <id>`, see `code-intelligence`).
