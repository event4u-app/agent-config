#!/usr/bin/env python3
"""Local knowledge ingestion — file walk, redaction, chunking, manifest.

Implements ``docs/contracts/local-knowledge-ingestion.md`` (Phase 2,
``road-to-employee-product-and-external-proof.md``).

Local-only by design. No network calls. Inputs must resolve to local
paths; remote URLs are rejected at command entry. Binary formats (PDF,
DOCX, XLSX, EPUB, PPTX, images) are routed through the peer-side
``markitdown`` MCP server — this module never embeds the converter.

Storage::

    agents/memory/knowledge/
        <ingest-id>/
            manifest.json   # source, counts, timestamps, redactions
            chunks/<n>.md   # 2 KB markdown chunks (post-redaction)

CLI::

    knowledge_ingest.py ingest <path> [--no-redact] [--markitdown=<bin>]
    knowledge_ingest.py list [--format=json|table] [--pin <id>]
    knowledge_ingest.py forget <ingest-id-prefix>
    knowledge_ingest.py unpin <ingest-id-prefix>

Bounds (non-negotiable — hard reject on cross)::

    Document count        ≤ 1000 per call
    Per-file size         ≤ 20 MB
    Namespace footprint   ≤ 500 MB (LRU eviction by last_touched)
    Traversal depth       ≤ 10 directories
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable

# Sibling import: running this file as a script puts its directory on
# sys.path[0]; the test loader (importlib spec_from_file_location) does not,
# so add it explicitly to keep ``import workspace_secrets`` robust either way.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import workspace_secrets  # noqa: E402

# --- Bounds (contract §Bounds) ---------------------------------------------

KNOWLEDGE_ROOT = Path("agents/memory/knowledge")

MAX_DOCS = 1000
MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_NAMESPACE_BYTES = 500 * 1024 * 1024
MAX_DEPTH = 10
CHUNK_BYTES = 2 * 1024
OCR_CONFIDENCE_FLOOR = 0.7

REMOTE_SCHEMES = ("http://", "https://", "s3://", "gs://", "azure://", "ftp://")

# --- MIME routing (contract §Supported MIME types) -------------------------

PASSTHROUGH_EXT = {".md", ".markdown", ".txt"}
MARKITDOWN_EXT = {
    ".pdf", ".docx", ".xlsx", ".pptx", ".epub",
    ".png", ".jpg", ".jpeg",
}


@dataclass
class FileEntry:
    path: str
    mime: str
    bytes: int
    chunks: int
    adapter: str
    ocr_low_confidence: bool = False


@dataclass
class IngestManifest:
    ingest_id: str
    source: str
    created_at: str
    last_touched: str
    documents: int = 0
    chunks: int = 0
    bytes_stored: int = 0
    redacted: bool = True
    pinned: bool = False
    pii_redacted: dict = field(default_factory=dict)
    secrets_redacted: int = 0
    skipped: list = field(default_factory=list)
    files: list = field(default_factory=list)
    contains_redactions: bool = False


# --- uuid7 (RFC 9562 §5.7 — time-ordered, 48-bit ms timestamp) -------------


def uuid7() -> str:
    """Return a uuid7 string. Timestamp recoverable from the first 48 bits."""
    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = secrets.randbits(12)
    rand_b = secrets.randbits(62)
    # Layout: <48-bit-ts>-<ver=7|12-bit rand_a>-<var=10|62-bit rand_b>
    hi = (ms << 16) | (0x7 << 12) | rand_a
    lo = (0b10 << 62) | rand_b
    s = f"{hi:016x}{lo:016x}"
    return f"{s[0:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:32]}"


def uuid7_ts(value: str) -> int:
    """Recover the 48-bit ms timestamp from a uuid7 string."""
    hex_str = value.replace("-", "")
    return int(hex_str[:12], 16)


# --- Redaction (contract §Redaction defaults) -------------------------------

_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_RE_PHONE = re.compile(
    r"(?:(?<=\s)|(?<=^))"
    r"(?:\+?\d{1,3}[\s.\-]?)?"
    r"(?:\(\d{2,4}\)[\s.\-]?|\d{2,4}[\s.\-])"
    r"\d{2,4}[\s.\-]?\d{2,4}(?:[\s.\-]?\d{2,4})?"
)
_RE_IBAN = re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b")
_RE_CC = re.compile(r"\b(?:\d[ \-]?){13,19}\b")
_RE_SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# Secret patterns live in the shared leaf module ``workspace_secrets`` so the
# ingestion redactor and the per-store pre-write guard stay in lock-step.


def redact(text: str, counters: dict) -> tuple[str, int]:
    """Replace PII and secret patterns with class placeholders.

    Returns ``(redacted_text, secrets_count)``. Counter keys are the
    placeholder names without brackets so the manifest can sum them.
    """

    def _bump(name: str, n: int = 1) -> None:
        counters[name] = counters.get(name, 0) + n

    # Secrets first — never stored, manifest counter incremented. The shared
    # module replaces every match with ``[SECRET]`` (both tiers).
    text, secrets_count = workspace_secrets.scrub(text)
    # PII placeholders.
    for pat, tag in (
        (_RE_IBAN, "IBAN"),
        (_RE_CC, "CC"),
        (_RE_SSN, "SSN"),
        (_RE_EMAIL, "EMAIL"),
        (_RE_PHONE, "PHONE"),
    ):
        text, n = pat.subn(f"[{tag}]", text)
        if n:
            _bump(tag, n)
    return text, secrets_count


# --- Chunking ---------------------------------------------------------------


def chunk_text(text: str, target_bytes: int = CHUNK_BYTES) -> list[str]:
    """Split ``text`` at paragraph boundaries into ~``target_bytes`` chunks.

    A paragraph larger than ``target_bytes`` is hard-split. Trailing
    whitespace is stripped. Empty chunks are dropped.
    """
    paras = re.split(r"\n\s*\n", text)
    out: list[str] = []
    buf = ""
    for p in paras:
        p = p.strip()
        if not p:
            continue
        candidate = f"{buf}\n\n{p}" if buf else p
        if len(candidate.encode("utf-8")) > target_bytes and buf:
            out.append(buf)
            buf = p
        else:
            buf = candidate
    if buf:
        out.append(buf)
    # Hard-split oversized chunks.
    final: list[str] = []
    for c in out:
        b = c.encode("utf-8")
        if len(b) <= target_bytes * 2:
            final.append(c)
            continue
        for i in range(0, len(b), target_bytes):
            final.append(b[i : i + target_bytes].decode("utf-8", errors="ignore"))
    return [c for c in final if c.strip()]


# --- Input validation -------------------------------------------------------


class IngestError(RuntimeError):
    """Raised on contract violation. Message names the bound + observed value."""


def _resolve_input(spec: str) -> Path:
    if any(spec.startswith(s) for s in REMOTE_SCHEMES):
        raise IngestError(f"remote scheme rejected: {spec} — /knowledge:ingest is local-only by design")
    p = Path(spec).expanduser()
    if not p.exists():
        raise IngestError(f"path does not exist: {spec}")
    return p.resolve()


def _classify(path: Path) -> tuple[str | None, str]:
    """Return ``(adapter, mime)``. ``adapter`` is None when unsupported."""
    ext = path.suffix.lower()
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if ext in PASSTHROUGH_EXT:
        return "passthrough", mime
    if ext in MARKITDOWN_EXT:
        return "markitdown", mime
    return None, mime


def _walk(root: Path) -> Iterable[Path]:
    """Yield files under ``root`` up to MAX_DEPTH. Symlinks not followed."""
    root_parts = len(root.parts)
    if root.is_file():
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        depth = len(Path(dirpath).parts) - root_parts
        if depth > MAX_DEPTH:
            dirnames[:] = []
            continue
        # Skip hidden dirs by convention.
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            yield Path(dirpath) / name


def _check_bounds(files: list[Path]) -> None:
    if len(files) > MAX_DOCS:
        raise IngestError(f"document count exceeds bound: {len(files)} > {MAX_DOCS}")
    for f in files:
        size = f.stat().st_size
        if size > MAX_FILE_BYTES:
            raise IngestError(
                f"per-file size exceeds bound: {f} = {size} bytes > {MAX_FILE_BYTES}"
            )



# --- Conversion -------------------------------------------------------------


def _read_text(path: Path) -> str:
    """UTF-8 only. Other encodings are rejected per contract §MIME."""
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as e:
        raise IngestError(f"non-UTF-8 file rejected: {path} — {e.reason}") from e


def _convert_via_markitdown(path: Path, markitdown_bin: str | None) -> str:
    """Invoke peer-side ``markitdown`` CLI. Returns markdown.

    The MCP server is the canonical surface but the CLI ships in the
    same upstream package and is the simplest local interface. If
    ``markitdown`` is not on PATH, the file is reported as skipped.
    """
    binary = markitdown_bin or shutil.which("markitdown")
    if not binary:
        raise IngestError(
            f"markitdown not installed peer-side; cannot convert {path} — "
            "see skills/markitdown for install recipes"
        )
    proc = subprocess.run(
        [binary, str(path)],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if proc.returncode != 0:
        raise IngestError(f"markitdown failed for {path}: {proc.stderr.strip()[:200]}")
    return proc.stdout


# --- Ingest -----------------------------------------------------------------


def _namespace_bytes() -> int:
    if not KNOWLEDGE_ROOT.exists():
        return 0
    total = 0
    for p in KNOWLEDGE_ROOT.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total


def _evict_lru(target_bytes: int) -> int:
    """Drop oldest non-pinned ingests until below ``target_bytes``. Returns evicted count."""
    if not KNOWLEDGE_ROOT.exists():
        return 0
    ingests = []
    for d in KNOWLEDGE_ROOT.iterdir():
        manifest = d / "manifest.json"
        if not manifest.exists():
            continue
        try:
            m = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if m.get("pinned"):
            continue
        ingests.append((m.get("last_touched", ""), d))
    ingests.sort()
    evicted = 0
    while _namespace_bytes() > target_bytes and ingests:
        _, d = ingests.pop(0)
        shutil.rmtree(d, ignore_errors=True)
        evicted += 1
    return evicted


def ingest(
    spec: str,
    *,
    redact_pii: bool = True,
    markitdown_bin: str | None = None,
    root: Path | None = None,
) -> IngestManifest:
    """Ingest a file or directory. Returns the persisted manifest."""
    base = root or KNOWLEDGE_ROOT
    source = _resolve_input(spec)
    files = sorted(_walk(source))
    _check_bounds(files)

    ingest_id = uuid7()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    target = base / ingest_id
    chunks_dir = target / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    manifest = IngestManifest(
        ingest_id=ingest_id,
        source=str(source),
        created_at=now,
        last_touched=now,
        redacted=redact_pii,
    )

    chunk_counter = 0
    bytes_stored = 0
    pii_counters: dict = {}

    for f in files:
        adapter, mime = _classify(f)
        if adapter is None:
            manifest.skipped.append({"path": str(f), "reason": f"unsupported:{mime}"})
            continue
        try:
            if adapter == "passthrough":
                text = _read_text(f)
            else:
                text = _convert_via_markitdown(f, markitdown_bin)
        except IngestError as e:
            manifest.skipped.append({"path": str(f), "reason": str(e)[:120]})
            continue

        secrets_for_file = 0
        if redact_pii:
            text, secrets_for_file = redact(text, pii_counters)
            manifest.secrets_redacted += secrets_for_file

        pieces = chunk_text(text)
        for piece in pieces:
            chunk_counter += 1
            chunk_path = chunks_dir / f"{chunk_counter:04d}.md"
            chunk_path.write_text(piece, encoding="utf-8")
            bytes_stored += len(piece.encode("utf-8"))

        manifest.files.append(
            asdict(
                FileEntry(
                    path=str(f),
                    mime=mime,
                    bytes=f.stat().st_size,
                    chunks=len(pieces),
                    adapter=adapter,
                )
            )
        )
        manifest.documents += 1

    manifest.chunks = chunk_counter
    manifest.bytes_stored = bytes_stored
    manifest.pii_redacted = pii_counters
    manifest.contains_redactions = bool(pii_counters) or manifest.secrets_redacted > 0

    (target / "manifest.json").write_text(
        json.dumps(asdict(manifest), indent=2, sort_keys=True), encoding="utf-8"
    )

    if base == KNOWLEDGE_ROOT:
        _evict_lru(MAX_NAMESPACE_BYTES)

    return manifest



# --- List / forget / pin ----------------------------------------------------


def _load_manifests(root: Path | None = None) -> list[dict]:
    base = root or KNOWLEDGE_ROOT
    if not base.exists():
        return []
    out = []
    for d in sorted(base.iterdir()):
        manifest = d / "manifest.json"
        if not manifest.exists():
            continue
        try:
            m = json.loads(manifest.read_text(encoding="utf-8"))
            out.append(m)
        except (OSError, json.JSONDecodeError):
            continue
    return out


def list_ingests(root: Path | None = None) -> list[dict]:
    """Return all ingest manifests sorted by ``created_at`` ascending."""
    return sorted(_load_manifests(root), key=lambda m: m.get("created_at", ""))


def _find_by_prefix(prefix: str, root: Path | None = None) -> Path:
    base = root or KNOWLEDGE_ROOT
    matches = [d for d in base.iterdir() if d.is_dir() and d.name.startswith(prefix)]
    if not matches:
        raise IngestError(f"no ingest matches prefix: {prefix}")
    if len(matches) > 1:
        raise IngestError(
            f"ambiguous prefix {prefix} — matches {len(matches)} ingests; "
            "use a longer prefix"
        )
    return matches[0]


def forget(prefix: str, root: Path | None = None) -> str:
    """Drop the ingest matching ``prefix``. Returns the ingest_id removed."""
    target = _find_by_prefix(prefix, root)
    ingest_id = target.name
    shutil.rmtree(target, ignore_errors=False)
    return ingest_id


def set_pin(prefix: str, pinned: bool, root: Path | None = None) -> str:
    """Toggle the ``pinned`` flag on the ingest matching ``prefix``."""
    target = _find_by_prefix(prefix, root)
    manifest_path = target / "manifest.json"
    m = json.loads(manifest_path.read_text(encoding="utf-8"))
    m["pinned"] = pinned
    manifest_path.write_text(
        json.dumps(m, indent=2, sort_keys=True), encoding="utf-8"
    )
    return target.name


# --- CLI --------------------------------------------------------------------


def _format_table(manifests: list[dict]) -> str:
    if not manifests:
        return "(no ingests)"
    rows = [("ID", "DOCS", "CHUNKS", "BYTES", "PINNED", "REDACTED", "CREATED", "SOURCE")]
    for m in manifests:
        rows.append(
            (
                m.get("ingest_id", "")[:8],
                str(m.get("documents", 0)),
                str(m.get("chunks", 0)),
                str(m.get("bytes_stored", 0)),
                "yes" if m.get("pinned") else "no",
                "yes" if m.get("redacted") else "no",
                m.get("created_at", ""),
                m.get("source", "")[:60],
            )
        )
    widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    lines = []
    for r in rows:
        lines.append("  ".join(r[i].ljust(widths[i]) for i in range(len(r))))
    return "\n".join(lines)


def _cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="knowledge_ingest")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ingest = sub.add_parser("ingest", help="ingest a local path")
    p_ingest.add_argument("path")
    p_ingest.add_argument("--no-redact", action="store_true")
    p_ingest.add_argument("--markitdown", default=None, help="path to markitdown binary")

    p_list = sub.add_parser("list", help="list ingested namespaces")
    p_list.add_argument("--format", choices=("json", "table"), default="table")
    p_list.add_argument("--pin", default=None, help="pin an ingest by id prefix")
    p_list.add_argument("--unpin", default=None, help="unpin an ingest by id prefix")

    p_forget = sub.add_parser("forget", help="drop an ingest by id prefix")
    p_forget.add_argument("prefix")

    args = parser.parse_args(argv)

    try:
        if args.cmd == "ingest":
            m = ingest(
                args.path,
                redact_pii=not args.no_redact,
                markitdown_bin=args.markitdown,
            )
            print(json.dumps(asdict(m), indent=2, sort_keys=True))
            return 0
        if args.cmd == "list":
            if args.pin:
                pid = set_pin(args.pin, True)
                print(f"pinned {pid}")
                return 0
            if args.unpin:
                pid = set_pin(args.unpin, False)
                print(f"unpinned {pid}")
                return 0
            manifests = list_ingests()
            if args.format == "json":
                print(json.dumps(manifests, indent=2, sort_keys=True))
            else:
                print(_format_table(manifests))
            return 0
        if args.cmd == "forget":
            removed = forget(args.prefix)
            print(f"forgot {removed}")
            return 0
    except IngestError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    return 1


if __name__ == "__main__":
    raise SystemExit(_cli())
