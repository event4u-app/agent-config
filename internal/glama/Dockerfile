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
FROM debian:trixie-slim
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g mcp-proxy@6.4.3 pnpm@10.14.0 \
    && curl -LsSf https://astral.sh/uv/install.sh | UV_INSTALL_DIR="/usr/local/bin" sh \
    && uv python install 3.11 --default --preview \
    && ln -s "$(uv python find)" /usr/local/bin/python \
    && node --version && python --version \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
WORKDIR /app
COPY . /app
RUN bash /app/internal/glama/build
# Mirrors glama's launch (CMD field). `task mcp:glama-test` overrides this with
# the smoke client to assert the MCP handshake.
CMD ["mcp-proxy","--","bash","/app/internal/glama/run"]
