#!/usr/bin/env python3
"""Build `dist/mcp/registry-manifest.json` + the two rendered payloads.

Reads three on-disk sources:
  * `package.json`                          — name, version, description, homepage, repository
  * `.github/topics.yml`                    — topics list (for registries that accept tags)
  * `internal/workers/mcp/content.json`     — `tool_catalog` (tools_count, install_hint_stdio)
  * `dist/discovery/discovery-manifest.json` — artefact_count + scanner_version (HARD prereq per AI-Council R5)

Emits:
  * `dist/mcp/registry-manifest.json`            — source-of-truth manifest
  * `dist/mcp/awesome-mcp-servers.row.md`        — single Markdown row
  * `dist/mcp/mcp-cloudflare-catalogue.json`     — single JSON catalogue entry

Lifecycle state (`status`, `submitted_at`, `pr_url`, `last_verified`) is
**preserved** from the previous manifest. First-time generation seeds
`status=pending` and nulls the rest. Status transitions are hand-edits
under maintainer review — see `docs/distribution/mcp-submission-checklist.md`.

CLI: `--write` / `--strict` / `--quiet` — matches the discovery scanner shape.

Schema: `docs/contracts/mcp-registry-manifest.schema.json`
Roadmap: agents/roadmaps/strategic-visibility-mcp-topics-positioning.md Phase 2.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[2]
PKG_FILE = ROOT / "package.json"
TOPICS_FILE = ROOT / ".github" / "topics.yml"
CONTENT_FILE = ROOT / "internal" / "workers" / "mcp" / "content.json"
DISCOVERY_FILE = ROOT / "dist" / "discovery" / "discovery-manifest.json"
OUT_DIR = ROOT / "dist" / "mcp"
OUT_MANIFEST = OUT_DIR / "registry-manifest.json"
OUT_ROW_MD = OUT_DIR / "awesome-mcp-servers.row.md"
OUT_CF_JSON = OUT_DIR / "mcp-cloudflare-catalogue.json"

REGISTRIES_SEED = [
    {
        "id": "awesome-mcp-servers",
        "label": "punkpeye/awesome-mcp-servers",
        "listing_format": "markdown-row",
        "submission_url": "https://github.com/punkpeye/awesome-mcp-servers",
        "rendered_payload": "dist/mcp/awesome-mcp-servers.row.md",
    },
    {
        "id": "mcp-cloudflare-catalogue",
        "label": "Cloudflare MCP catalogue",
        "listing_format": "json-entry",
        "submission_url": "https://github.com/cloudflare/mcp-server-cloudflare",
        "rendered_payload": "dist/mcp/mcp-cloudflare-catalogue.json",
    },
]


def _repo_url(pkg: dict[str, Any]) -> str:
    raw = (pkg.get("repository") or {}).get("url") or ""
    return re.sub(r"^git\+|\.git$", "", raw)


def _build(now_utc: _dt.datetime) -> dict[str, Any]:
    pkg = json.loads(PKG_FILE.read_text(encoding="utf-8"))
    topics_doc = yaml.safe_load(TOPICS_FILE.read_text(encoding="utf-8")) or {}
    content = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
    if not DISCOVERY_FILE.exists():
        sys.exit(
            "ERROR: dist/discovery/discovery-manifest.json missing. R3 (discovery) "
            "is a hard prerequisite per the AI-Council external review. "
            "Run `npm run build:discovery` first."
        )
    discovery = json.loads(DISCOVERY_FILE.read_text(encoding="utf-8"))

    tc = content["tool_catalog"]
    prior = json.loads(OUT_MANIFEST.read_text(encoding="utf-8")) if OUT_MANIFEST.exists() else {}
    prior_reg = {r["id"]: r for r in (prior.get("registries") or [])}

    registries: list[dict[str, Any]] = []
    for seed in REGISTRIES_SEED:
        prev = prior_reg.get(seed["id"], {})
        registries.append({
            **seed,
            "status": prev.get("status", "pending"),
            "submitted_at": prev.get("submitted_at"),
            "pr_url": prev.get("pr_url"),
            "last_verified": prev.get("last_verified"),
        })

    return {
        "version": 1,
        "generated_at": now_utc.strftime("%Y-%m-%d"),
        "package": {
            "name": pkg["name"],
            "version": pkg["version"],
            "description": pkg["description"],
            "homepage": pkg["homepage"],
            "repository": _repo_url(pkg),
        },
        "server": {
            "name": "agent-config-mcp",
            "transports": ["stdio", "worker"],
            "tools_count": len(tc["tools"]),
            "install_hint_stdio": tc["install_hint_stdio"],
        },
        "topics": sorted(topics_doc.get("topics") or []),
        "discovery": {
            "artefact_count": len(discovery["artefacts"]),
            "scanner_version": discovery["scanner_version"],
        },
        "registries": registries,
    }


def _render_row_md(m: dict[str, Any]) -> str:
    pkg = m["package"]
    srv = m["server"]
    transports = ", ".join(srv["transports"])
    return (
        f"| [{pkg['name']}]({pkg['homepage']}) "
        f"| {pkg['description']} "
        f"| {srv['tools_count']} tools ({transports}) "
        f"| `{srv['install_hint_stdio']}` |\n"
    )


def _render_cf_json(m: dict[str, Any]) -> str:
    pkg = m["package"]
    srv = m["server"]
    payload = {
        "name": srv["name"],
        "description": pkg["description"],
        "homepage": pkg["homepage"],
        "repository": pkg["repository"],
        "transports": srv["transports"],
        "tools_count": srv["tools_count"],
        "install_hint_stdio": srv["install_hint_stdio"],
        "topics": m["topics"],
    }
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--write", action="store_true", help="write outputs to disk (default: print to stdout)")
    ap.add_argument("--strict", action="store_true", help="exit 2 if on-disk outputs would change")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    now_utc = _dt.datetime.now(_dt.timezone.utc)
    manifest = _build(now_utc)
    manifest_text = json.dumps(manifest, indent=2, sort_keys=True) + "\n"
    row_md = _render_row_md(manifest)
    cf_json = _render_cf_json(manifest)

    outputs = [(OUT_MANIFEST, manifest_text), (OUT_ROW_MD, row_md), (OUT_CF_JSON, cf_json)]
    changed = [p for p, t in outputs if not p.exists() or p.read_text(encoding="utf-8") != t]

    if args.write:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        for p, t in outputs:
            p.write_text(t, encoding="utf-8")
        if not args.quiet:
            verb = "wrote" if changed else "unchanged"
            print(f"\u2705  {verb} {len(outputs)} file(s) under dist/mcp/")
    else:
        if not args.quiet:
            print(manifest_text, end="")

    return 2 if (args.strict and changed and not args.write) else 0


if __name__ == "__main__":
    raise SystemExit(main())
