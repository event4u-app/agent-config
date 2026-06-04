"""Baseline-cache helpers for the package-impact A/B bench.

Phase 2 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

A daily `task bench:ab` run wants to skip re-running the `without` arm when
nothing the model would see has changed. We define "changed" by a three-part
key:

    (corpus_hash, claude_cli_version, target_shape_hash)

Cached `without` reports live under `internal/bench/reports/ab/`. Each report
header records the cache key inputs; this module reads the directory, picks
the latest matching report, and reports freshness.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"


@dataclass(frozen=True)
class CacheKey:
    corpus_hash: str
    claude_cli_version: str
    target_shape_hash: str

    def to_dict(self) -> dict[str, str]:
        return {
            "corpus_hash": self.corpus_hash,
            "claude_cli_version": self.claude_cli_version,
            "target_shape_hash": self.target_shape_hash,
        }

    @classmethod
    def from_dict(cls, data: dict[str, str]) -> "CacheKey":
        return cls(
            corpus_hash=data.get("corpus_hash", ""),
            claude_cli_version=data.get("claude_cli_version", ""),
            target_shape_hash=data.get("target_shape_hash", ""),
        )


@dataclass(frozen=True)
class CacheLookup:
    found: bool
    fresh: bool
    report_path: Path | None
    cached_key: CacheKey | None
    reason: str  # human-readable: "missing", "fresh", "stale: corpus", etc.


def hash_file(path: Path) -> str:
    """SHA-256 of a single file (used for corpus_hash)."""
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def claude_cli_version() -> str:
    """Best-effort: `claude --version` or fallback to the env CLAUDE_CLI_VERSION.

    When the CLI is missing, return "unavailable:<reason>" so the cache key
    still varies meaningfully when the CLI is later installed.
    """
    override = os.environ.get("CLAUDE_CLI_VERSION")
    if override:
        return override.strip()
    if shutil.which("claude") is None:
        return "unavailable:not-on-path"
    try:
        out = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as err:
        return f"unavailable:{type(err).__name__}"
    if out.returncode != 0:
        return f"unavailable:exit-{out.returncode}"
    return (out.stdout or out.stderr).strip().splitlines()[0] if out.stdout or out.stderr else "unknown"


def target_shape_hash() -> str:
    """Re-export the shape hash from the clone script for a single source of truth."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "bench_ab_clone", REPO_ROOT / "src" / "scripts" / "bench_ab_clone.py"
    )
    if spec is None or spec.loader is None:
        return "unknown"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.target_shape_hash()  # type: ignore[no-any-return]


def build_key(corpus_path: Path) -> CacheKey:
    return CacheKey(
        corpus_hash=hash_file(corpus_path),
        claude_cli_version=claude_cli_version(),
        target_shape_hash=target_shape_hash(),
    )


def iter_cached_reports(variant: str = "without") -> list[Path]:
    """Return all report JSON paths under reports/ab/ for the given variant.

    Filenames follow `{stamp}-{corpus}-{variant}.json` (Phase 2 Step 3).
    """
    if not REPORTS_DIR.exists():
        return []
    matches = sorted(REPORTS_DIR.glob(f"*-{variant}.json"))
    return list(matches)


def read_report_key(report_path: Path) -> CacheKey | None:
    try:
        data = json.loads(report_path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    raw = data.get("cache_key")
    if not isinstance(raw, dict):
        return None
    return CacheKey.from_dict({k: str(v) for k, v in raw.items()})


def lookup(corpus_path: Path) -> CacheLookup:
    """Find the latest cached `without` report and report freshness vs. the current key."""
    if not corpus_path.exists():
        return CacheLookup(False, False, None, None, f"missing corpus: {corpus_path}")
    current = build_key(corpus_path)
    candidates = iter_cached_reports("without")
    if not candidates:
        return CacheLookup(False, False, None, None, "no cached `without` report")
    # Reports sorted by filename — last is latest given UTC stamps
    latest = candidates[-1]
    cached_key = read_report_key(latest)
    if cached_key is None:
        return CacheLookup(True, False, latest, None, "cached report missing cache_key")
    if cached_key == current:
        return CacheLookup(True, True, latest, cached_key, "fresh")
    # Diagnose which input drifted
    drift_parts = []
    if cached_key.corpus_hash != current.corpus_hash:
        drift_parts.append("corpus")
    if cached_key.claude_cli_version != current.claude_cli_version:
        drift_parts.append("claude_cli_version")
    if cached_key.target_shape_hash != current.target_shape_hash:
        drift_parts.append("target_shape")
    return CacheLookup(True, False, latest, cached_key, "stale: " + ",".join(drift_parts))
