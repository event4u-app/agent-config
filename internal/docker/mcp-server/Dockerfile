# syntax=docker/dockerfile:1.7
# Phase-6 F3 — stdio-only MCP server image (TypeScript runtime).
#
# Ported from the retired Python 3.11 image (ADR-200 python-to-typescript
# migration): the server is now the compiled CLI's native `mcp-server`
# command (ADR-085 turnkey read-only stdio server). Ships:
#   - dist/cli/            (compiled CLI — built in the builder stage)
#   - node_modules/        (production dependencies only)
#   - dist/agent-src/      (prompts + resources content; prebuilt in-repo)
#   - docs/guidelines/     (guideline:// resource content)
#   - package.json         (packageVersion source)
#
# Entrypoint: `node dist/cli/agent-config.js mcp-server` over stdio.
# A0 contract unchanged: read-only except the allowlisted tools.
# No HTTP/SSE transport in this image — defer per Phase-6 verdict.
#
# Build context is the REPO ROOT (dist/agent-src/ must be present — it is
# a committed projection, no extra build step needed):
#   docker build -f internal/docker/mcp-server/Dockerfile -t agent-config-mcp:local .

# ---------- builder ----------
FROM node:20-slim AS builder

WORKDIR /build
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src/ ./src/
# build:cli only (tsc + chmod) — the UI bundle and install bundle are not
# part of this image's surface.
RUN npm run build:cli \
 && npm prune --omit=dev

# ---------- runtime ----------
FROM node:20-slim AS runtime

# Run as non-root for defense-in-depth (A0 still binds on top).
RUN groupadd --system mcp \
 && useradd --system --gid mcp --create-home --home-dir /home/mcp mcp

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist/cli ./dist/cli
COPY dist/agent-src/ ./dist/agent-src/
COPY docs/guidelines/ ./docs/guidelines/
COPY package.json ./package.json

RUN chown -R mcp:mcp /app

USER mcp

ENV NODE_ENV=production

# Stdio is the wire — `docker run -i` is mandatory at the call site.
ENTRYPOINT ["node", "dist/cli/agent-config.js", "mcp-server"]
