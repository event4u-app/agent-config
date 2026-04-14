---
name: devcontainer
description: "Use when setting up or modifying DevContainers, GitHub Codespaces, custom images, secrets management, or workspace configuration."
source: package
---

# devcontainer

## When to use

DevContainer config, Codespaces, dev env standardization. NOT for: local Docker (`docker`), production (`aws-infrastructure`).

## Before: `devcontainer.json`, `.devcontainer/` dir, project overrides.

## Architecture: pre-built image (GHCR/ECR), features (git, gh, docker-in-docker), secrets (file mounts/Codespaces secrets/env vars), workspace in `/workspace`.

## Conventions: secrets → `devcontainer.json` + bind mount + document. Base image: prefer features over modification. Env vars in `devcontainer.env`, secrets in `.devcontainer/.secrets/` (gitignored).

## Auto-trigger keywords

- DevContainer
- Codespaces
- dev environment
- container setup

## Gotcha

- DevContainer rebuilds are slow — test configuration changes incrementally, not all at once.
- Secrets in devcontainer.json are visible in version control — use Codespaces secrets instead.
- Extensions in devcontainer.json install on EVERY rebuild — keep the list short.

## Do NOT

- Do NOT commit secret files — they should be gitignored.
- Do NOT change the workspace mount path without updating all related configs.
- Do NOT remove required secrets without checking which services depend on them.
- Do NOT switch base images without team approval.

## Related

- **Skill:** `docker` — Docker setup, multi-stage Dockerfile, compose services
- **Skill:** `traefik` — local reverse proxy with real domains and HTTPS
- **Rule:** `docker-commands.md` — commands run inside Docker
