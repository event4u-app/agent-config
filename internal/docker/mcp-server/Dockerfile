# syntax=docker/dockerfile:1.7
# Phase-6 F3 — stdio-only MCP server image.
#
# Multi-stage Python 3.11 slim build. Ships:
#   - scripts/mcp_server/   (the server package + tools/metadata)
#   - scripts/skill_linter.py + scripts/chat_history.py (tool deps)
#   - .agent-src/           (prompts + resources content)
#   - docs/guidelines/      (resource content)
#   - package.json          (F1 packageVersion source)
#
# Entrypoint: `python -m scripts.mcp_server` over stdio.
# A0 contract unchanged: read-only except the two allowlisted tools.
# No HTTP/SSE transport in this image — defer per Phase-6 verdict.

# ---------- builder ----------
FROM python:3.11-slim AS builder

WORKDIR /build
COPY scripts/mcp_server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- runtime ----------
FROM python:3.11-slim AS runtime

# Run as non-root for defense-in-depth (A0 still binds on top).
RUN groupadd --system mcp \
 && useradd --system --gid mcp --create-home --home-dir /home/mcp mcp

WORKDIR /app

COPY --from=builder /install /usr/local

COPY scripts/mcp_server/ ./scripts/mcp_server/
COPY scripts/skill_linter.py scripts/chat_history.py ./scripts/
COPY .agent-src/ ./.agent-src/
COPY docs/guidelines/ ./docs/guidelines/
COPY package.json ./package.json

# `scripts/` is a flat directory — ensure it's importable as a package.
RUN test -f scripts/__init__.py || touch scripts/__init__.py \
 && chown -R mcp:mcp /app

USER mcp

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

# Stdio is the wire — `docker run -i` is mandatory at the call site.
ENTRYPOINT ["python", "-m", "scripts.mcp_server"]
