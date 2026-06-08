# syntax=docker/dockerfile:1.7
# Phase-6 F3 — stdio-only MCP server image.
#
# Multi-stage Python 3.11 slim build. Ships (paths per ADR-050 src/ layout):
#   - src/scripts/          (the server package + its in-tree deps:
#                            _lib/, memory_*, skill_linter, chat_history —
#                            copied whole; the wire surface stays import-
#                            bounded and is enforced by test_no_unsafe_imports)
#   - dist/agent-src/       (prompts + resources content)
#   - docs/guidelines/      (resource content)
#   - package.json          (F1 packageVersion source)
#
# Entrypoint: `python -m scripts.mcp_server` over stdio.
# A0 contract unchanged: read-only except the two allowlisted tools.
# No HTTP/SSE transport in this image — defer per Phase-6 verdict.

# ---------- builder ----------
FROM python:3.11-slim AS builder

WORKDIR /build
COPY src/scripts/mcp_server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- runtime ----------
FROM python:3.11-slim AS runtime

# Run as non-root for defense-in-depth (A0 still binds on top).
RUN groupadd --system mcp \
 && useradd --system --gid mcp --create-home --home-dir /home/mcp mcp

WORKDIR /app

COPY --from=builder /install /usr/local

COPY src/scripts/ ./src/scripts/
COPY dist/agent-src/ ./dist/agent-src/
COPY docs/guidelines/ ./docs/guidelines/
COPY package.json ./package.json

RUN chown -R mcp:mcp /app

USER mcp

# PYTHONPATH=/app/src so `scripts.mcp_server` imports as a namespace
# package; the loader resolves content as 4 parents up from prompts.py
# (/app/src/scripts/mcp_server/ -> /app), i.e. /app/dist/agent-src + /app/docs.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src

# Stdio is the wire — `docker run -i` is mandatory at the call site.
ENTRYPOINT ["python", "-m", "scripts.mcp_server"]
