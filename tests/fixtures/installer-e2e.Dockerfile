# tests/fixtures/installer-e2e.Dockerfile
#
# Container e2e for the installer + browser-wizard apply path. Proves that a
# pristine container (no host PYTHONPATH / venv leakage — the exact condition
# that broke in the field) can run the installer end-to-end AND drive the real
# wizard server over HTTP, with files actually landing on disk.
#
# Build context = repo root (`.dockerignore` trims node_modules / dist / bench).
# Usage (from repo root):
#   docker build -f tests/fixtures/installer-e2e.Dockerfile -t installer-e2e:latest .
#   docker run --rm installer-e2e:latest
#
# Exit 0 means: both apply scenarios installed a populated tree inside the
# container. Driven in CI by tests/test_e2e_container_install.py.
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates curl bash coreutils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /pkg

# Copy the whole repo (`.dockerignore` drops node_modules / dist/cli|server /
# .git / internal/bench). `dist/agent-src` IS kept — it is the deployable
# content the global install lays down. src/config + src/templates are needed
# by the installer too, so a selective COPY is brittle; copy the lot.
COPY . .

# Full install (devDeps carry tsc), then rebuild the CLI + server bundles
# (dist/cli + dist/server were excluded from the context on purpose).
RUN npm ci --no-audit --no-fund \
    && npm run build:cli \
    && chmod +x tests/fixtures/installer-e2e/run-scenarios.sh

ENTRYPOINT ["bash", "/pkg/tests/fixtures/installer-e2e/run-scenarios.sh"]
