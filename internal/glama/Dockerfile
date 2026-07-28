# Local reproduction of glama.ai's MCP-server build/run environment.
#
# This is NOT glama's Dockerfile. glama generates its own and git-clones a
# pinned commit; this one `COPY`s the local working tree so `task mcp:glama-test`
# validates internal/glama/{build,run} against UNCOMMITTED changes, offline.
#
# Scope (AI-council 2026-06-09, anthropic/claude-sonnet-4-5 + openai/gpt-4o —
# converged on COPY-over-clone): this verifies the build/run scripts boot the
# stdio MCP server in a Debian + mcp-proxy env — the failure surface WE own
# (the 2026-06-04 scripts/ -> src/scripts/ move broke exactly these path refs).
# It deliberately does NOT reproduce glama's git-clone stage, and the pinned
# toolchain below is a DATED SNAPSHOT of glama's generated Dockerfile, not a
# live mirror. See internal/glama/README.md before trusting it for glama
# sync debugging.
# Node 24 comes from the official node image, NOT the nodesource apt repo:
# deb.nodesource.com's setup script fails with a swallowed curl 403 and exits
# 0 (first seen 2026-07-27), leaving apt to resolve Debian's distro nodejs
# 20.x — which ships WITHOUT npm, so the image broke with `npm: not found`.
# The multi-stage copy is hermetic (Docker Hub only, no third-party apt repo)
# and keeps glibc parity: both stages are trixie. The `command -v npm` probe
# fails the build loudly if the toolchain ever silently regresses again.
FROM node:24-trixie-slim AS node24
FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive
COPY --from=node24 /usr/local /usr/local
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git \
    && command -v npm \
    && npm install -g mcp-proxy@6.4.3 pnpm@10.14.0 \
    && node --version \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
WORKDIR /app
COPY . /app
RUN bash /app/internal/glama/build
# Mirrors glama's launch (CMD field). `task mcp:glama-test` overrides this with
# the smoke client to assert the MCP handshake.
CMD ["mcp-proxy","--","bash","/app/internal/glama/run"]
