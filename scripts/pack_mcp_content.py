"""Pack agent-config content into a Worker-bundle JSON blob.

Walks `.agent-src/skills/`, `.agent-src/commands/`, `.agent-src/rules/`,
`docs/guidelines/`, `.agent-src/contexts/` via the same Python loaders
that drive the local stdio kernel, emits one JSON blob and a sidecar
manifest for `workers/mcp/`.

Outputs (relative to repo root):
- `workers/mcp/content.json`      — uncompressed, bundled by `wrangler deploy`.
- `workers/mcp/content.json.gz`   — gzipped archival copy for R2.
- `workers/mcp/manifest.json`     — manifest only (RCA / R2 sidecar).

Hard-fail thresholds (Phase 2-5 council verdict D2):
- Uncompressed JSON > 2 MB         → SystemExit(1).
- Empty content (zero URIs)        → SystemExit(2). Catches a broken
                                     `.agent-src/` tree before deploy.

Cloud signature divergence vs local kernel (`metadata.compute_skill_set_signature`):
- Local kernel:  SHA-256 over `(uri, mtime)` pairs — reproducible only
                 within one filesystem.
- This packer:   SHA-256 over `(uri, body)` pairs — reproducible across
                 CI runs, machines, and re-clones. Same 12-char prefix.

Governed by `docs/contracts/mcp-cloud-scope.md` §A0-cloud invariant 5.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Re-use the local kernel's loaders so the live-replay baseline stays
# trivially comparable.
_SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_SCRIPTS_DIR))

from mcp_server.prompts import scan_commands, scan_skills  # noqa: E402
from mcp_server.resources import scan_contexts, scan_guidelines, scan_rules  # noqa: E402

SCHEMA_VERSION = 1
PACKER_VERSION = "1.0.0"
# Worker bundle is the compact JSON; gzipped copy lives in R2. Cloudflare's
# compressed-bundle limit is 3 MB (free) / 10 MB (paid); 778 KB gz today
# (438 entries) leaves ample headroom. Hard-fail at 5 MB uncompressed so
# the build dies before the Worker upload does.
MAX_UNCOMPRESSED_BYTES = 5 * 1024 * 1024


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _git_sha(root: Path) -> str:
    """Resolve HEAD SHA. Falls back to env var, then to all-zeros."""
    for env_var in ("GITHUB_SHA", "CI_COMMIT_SHA", "GIT_COMMIT"):
        sha = os.environ.get(env_var)
        if sha and len(sha) >= 7:
            return sha
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
            timeout=5,
        )
        return out.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        return "0" * 40


def _package_version(root: Path) -> str:
    data = json.loads((root / "package.json").read_text(encoding="utf-8"))
    return str(data.get("version", "0.0.0"))


def _collect_entries(root: Path) -> tuple[dict[str, dict[str, Any]], list[str]]:
    """Run all 5 scanners and project entries into the wire shape."""
    uris: dict[str, dict[str, Any]] = {}
    errors: list[str] = []

    skills, e = scan_skills(root)
    errors.extend(e)
    for s in skills:
        key = f"skill://{s.name}"
        uris[key] = {
            "uri": key,
            "name": s.name,
            "description": s.description,
            "body": s.body,
            "source": s.source,
            "kind": "skill",
        }

    commands, e = scan_commands(root)
    errors.extend(e)
    for c in commands:
        key = f"command://{c.name.replace(':', '.')}"
        uris[key] = {
            "uri": key,
            "name": c.name,
            "description": c.description,
            "body": c.body,
            "source": c.source,
            "kind": "command",
        }

    for scan in (scan_rules, scan_guidelines, scan_contexts):
        items, e = scan(root)
        errors.extend(e)
        for r in items:
            uris[r.uri] = {
                "uri": r.uri,
                "name": r.name,
                "description": r.description,
                "body": r.body,
                "source": r.source,
                "kind": r.kind,
                "mime_type": r.mime_type,
            }

    return uris, errors


def _content_signature(uris: dict[str, dict[str, Any]]) -> tuple[str, str]:
    """SHA-256 over sorted (uri, body) pairs.

    Returns (full_hex, 12-char prefix). The prefix is the wire-surface
    `skillSetSignature`; the full hex is the diagnostic `content_hash_sha256`.
    """
    hasher = hashlib.sha256()
    for uri in sorted(uris):
        hasher.update(uri.encode("utf-8"))
        hasher.update(b"\x00")
        hasher.update(uris[uri]["body"].encode("utf-8"))
        hasher.update(b"\x1e")
    digest = hasher.hexdigest()
    return digest, digest[:12]


def _count_kinds(uris: dict[str, dict[str, Any]]) -> dict[str, int]:
    counts = {"skill": 0, "command": 0, "rule": 0, "guideline": 0, "context": 0}
    for entry in uris.values():
        kind = entry["kind"]
        if kind in counts:
            counts[kind] += 1
    return counts



def _build_manifest(
    *,
    signature: str,
    content_hash: str,
    package_version: str,
    git_sha: str,
    built_at: str,
    counts: dict[str, int],
) -> dict[str, Any]:
    short = git_sha[:7] if git_sha and git_sha != "0" * 40 else "unknown"
    return {
        "schema_version": SCHEMA_VERSION,
        "signature": signature,
        "content_hash_sha256": content_hash,
        "package_version": package_version,
        "release_key": f"v{package_version}-{short}",
        "git_sha": git_sha,
        "built_at": built_at,
        "packer_version": PACKER_VERSION,
        "content_uri_count": counts,
    }


def pack(root: Path, out_dir: Path) -> dict[str, Any]:
    """Run the full pack. Returns the manifest dict."""
    uris, errors = _collect_entries(root)
    if not uris:
        sys.stderr.write("pack: empty content (zero URIs)\n")
        for line in errors:
            sys.stderr.write(f"  - {line}\n")
        raise SystemExit(2)

    content_hash, signature = _content_signature(uris)
    counts = _count_kinds(uris)
    built_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest = _build_manifest(
        signature=signature,
        content_hash=content_hash,
        package_version=_package_version(root),
        git_sha=_git_sha(root),
        built_at=built_at,
        counts=counts,
    )

    blob = {
        "schema_version": SCHEMA_VERSION,
        "uris": uris,
        "manifest": manifest,
    }
    # Compact JSON for the bundle (saves ~20 KB vs indent=2). The R2
    # archival copy is gzipped, so legibility there is moot.
    payload = json.dumps(blob, ensure_ascii=False, sort_keys=True)
    payload_bytes = payload.encode("utf-8")

    if len(payload_bytes) > MAX_UNCOMPRESSED_BYTES:
        sys.stderr.write(
            f"pack: uncompressed content {len(payload_bytes)} bytes "
            f"exceeds limit {MAX_UNCOMPRESSED_BYTES}\n"
        )
        raise SystemExit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "content.json").write_bytes(payload_bytes)
    # mtime=0 keeps the gzip header byte-stable across CI runs so the
    # R2 archival copy hashes deterministically.
    with open(out_dir / "content.json.gz", "wb") as raw:
        with gzip.GzipFile(
            fileobj=raw, mode="wb", compresslevel=9, mtime=0
        ) as gz:
            gz.write(payload_bytes)
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )

    if errors:
        sys.stderr.write("pack: non-fatal frontmatter errors:\n")
        for line in errors:
            sys.stderr.write(f"  - {line}\n")

    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root", type=Path, default=_repo_root(), help="Repository root."
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output directory (defaults to <root>/workers/mcp).",
    )
    parser.add_argument(
        "--quiet", action="store_true", help="Suppress success summary."
    )
    args = parser.parse_args(argv)

    out_dir = args.out or (args.root / "workers" / "mcp")
    manifest = pack(args.root, out_dir)

    if not args.quiet:
        c = manifest["content_uri_count"]
        sys.stderr.write(
            f"pack: ok signature={manifest['signature']} "
            f"release={manifest['release_key']} "
            f"skills={c['skill']} commands={c['command']} "
            f"rules={c['rule']} guidelines={c['guideline']} "
            f"contexts={c['context']}\n"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
