# syntax=docker/dockerfile:1.7
# road-to-internal-ai-os-deployment Phase 1 Step 1.
#
# Multi-stage build for the @event4u/agent-config GUI server. Final
# image runs `agent-config-installer gui --host 0.0.0.0 --port 8787`
# under a non-root user. Bare-metal Compose first; Helm deferred to a
# v2 deployment roadmap (ADR-021).
#
# Image size budget: < 600 MB condensed. Stages:
#   1. node-builder  — install + tsc -p packages/core/installer
#   2. runtime       — slim Node base; carry installer dist + node_modules.
#                      Static GUI assets are inlined into
#                      `dist/gui/static-assets.js` — no static/ dir to copy.

# ---------- node-builder ----------
FROM node:20.11-slim AS node-builder

WORKDIR /build

# Copy only what the installer build needs. Avoids invalidating the
# Docker layer cache on unrelated package edits.
COPY package.json package-lock.json ./
COPY packages/core/installer/package.json packages/core/installer/
COPY packages/core/installer/tsconfig.json packages/core/installer/

# Root install — the installer's runtime deps (commander, js-yaml,
# @inquirer/prompts) live in the root package.json and resolve from
# /build/node_modules at runtime.
RUN npm ci --no-audit --no-fund --ignore-scripts

COPY packages/core/installer/src packages/core/installer/src

RUN cd packages/core/installer && npx tsc -p tsconfig.json

# ---------- runtime ----------
FROM node:20.11-slim AS runtime

# Defense-in-depth: non-root user, no shell login, fixed UID/GID for
# bind-mount stability on Compose hosts.
RUN groupadd --system --gid 10001 agentcfg \
 && useradd --system --uid 10001 --gid agentcfg --create-home \
            --home-dir /home/agentcfg --shell /usr/sbin/nologin agentcfg

WORKDIR /app

# Carry compiled CLI + static assets + the package manifest. The
# discovery manifest is generated at build time of the consumer
# package and shipped under dist/discovery/.
COPY --from=node-builder --chown=agentcfg:agentcfg \
     /build/packages/core/installer/dist ./packages/core/installer/dist
COPY --from=node-builder --chown=agentcfg:agentcfg \
     /build/node_modules ./node_modules
COPY --chown=agentcfg:agentcfg package.json ./package.json

# Discovery manifest — locked by ADR-015. The CLI walks up from cwd
# (WORKDIR /app) looking for dist/discovery/discovery-manifest.json.
COPY --chown=agentcfg:agentcfg dist/discovery ./dist/discovery

# Runtime dirs that need to be writable by the non-root user.
RUN mkdir -p /home/agentcfg/.event4u/agent-config \
 && mkdir -p /var/lib/agent-config/runtime \
 && chown -R agentcfg:agentcfg /home/agentcfg/.event4u /var/lib/agent-config

USER agentcfg

ENV NODE_ENV=production \
    BIND_HOST=0.0.0.0 \
    GUI_PORT=8787 \
    STORAGE_MODE=filesystem \
    SESSION_BACKEND=memory \
    AGENT_CONFIG_GUI_NO_OPEN=1 \
    AGENT_CONFIG_PROJECT_ROOT=/var/lib/agent-config/runtime

EXPOSE 8787

# Healthcheck — Step 4 endpoint. 1 rps cap is per-IP, not per-probe,
# so the 10 s docker default is well under the limit.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.GUI_PORT||8787)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Wrapper preserves env defaults but lets compose override GUI_PORT
# / BIND_HOST per-deployment without rebuilding the image.
ENTRYPOINT ["node", "packages/core/installer/dist/cli.js", "gui"]
CMD ["--host", "0.0.0.0", "--port", "8787", "--no-open", \
     "--project-root", "/var/lib/agent-config/runtime", \
     "--manifest", "/app/dist/discovery/discovery-manifest.json"]
