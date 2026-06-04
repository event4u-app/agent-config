#!/usr/bin/env python3
"""Input-side memory condensation — Phase 2 of step-16-telegraph-substance.

Rewrites memory files (AGENTS.md, CLAUDE.md, .cursorrules, ...) to telegraph
grammar (drop articles / auxiliaries) while preserving carve-outs byte-for-byte
(code blocks, numbered-options, status markers, Iron-Law ALL-CAPS, backtick
spans). Writes `.original.md` backup before mutating. Gated by Phase 0
`validate_safe_paths.assert_safe`. Idempotency guard: `original_sha256:` +
`condensed_at:` frontmatter refuse re-condensation on body-hash drift.

CLI: `condense_memory.py <path> [--check|--decondense]`. Stdlib-only.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from validate_safe_paths import SensitivePathError, assert_safe  # noqa: E402

__all__ = ["condense_text", "condense_file", "decondense_file", "CondensationRefused"]


class CondensationRefused(RuntimeError):
    """Raised when the target is already condensed and body hash diverged."""


# Carve-out region patterns — mirrors telegraph-speak.md § Carve-outs (1–7).
RE_FENCE = re.compile(r"^```")
RE_NUMBERED = re.compile(r"^>?\s*\d+\.\s")
RE_STATUS = re.compile(r"^\s*(?:❌|⚠️|✅)")
RE_IRONLAW = re.compile(r"^[A-Z][A-Z0-9 ,.\-_/']{3,}$")
RE_BACKTICK_SPAN = re.compile(r"`[^`\n]+`")
# Spans frozen byte-for-byte inside prose lines. Backtick spans first so a
# slash-bearing span inside backticks is captured whole; then any non-whitespace
# run containing `/` or `\` — bare URLs, markdown link/image targets, and file
# paths whose segments (`is`, `the`, `a`) would otherwise be eaten as drop-tokens.
RE_PRESERVE_SPAN = re.compile(r"`[^`\n]+`|\S*[/\\]\S*")
RE_FRONTMATTER = re.compile(r"^---\s*$")
WORD_RE = re.compile(r"\b[A-Za-z]+\b")
DROP_TOKENS = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
               "being", "that", "which"}


def _condense_words(text: str) -> str:
    out = WORD_RE.sub(lambda m: "" if m.group(0).lower() in DROP_TOKENS else m.group(0), text)
    out = re.sub(r"[ \t]{2,}", " ", out)
    return re.sub(r" +([,.;:!?])", r"\1", out)


def _condense_prose_line(line: str) -> str:
    """Condense a prose line; preserve backtick spans, URLs, link targets, and
    slash-bearing paths byte-for-byte (see ``RE_PRESERVE_SPAN``)."""
    parts: list[str] = []
    last = 0
    for span in RE_PRESERVE_SPAN.finditer(line):
        parts.append(_condense_words(line[last:span.start()]))
        parts.append(span.group(0))
        last = span.end()
    parts.append(_condense_words(line[last:]))
    return "".join(parts)


def condense_text(body: str) -> str:
    """Condense a memory-file body. Idempotent on already-telegraph text."""
    out: list[str] = []
    in_fence = False
    for raw in body.splitlines(keepends=True):
        stripped = raw.rstrip("\r\n")
        if RE_FENCE.match(stripped):
            in_fence = not in_fence
            out.append(raw)
            continue
        if in_fence or RE_NUMBERED.match(stripped) or RE_STATUS.match(stripped) \
                or RE_IRONLAW.match(stripped.strip()):
            out.append(raw)
            continue
        out.append(_condense_prose_line(raw))
    return "".join(out)


def _split_frontmatter(text: str) -> tuple[str, str]:
    lines = text.splitlines(keepends=True)
    if not lines or not RE_FRONTMATTER.match(lines[0].rstrip()):
        return "", text
    for idx in range(1, len(lines)):
        if RE_FRONTMATTER.match(lines[idx].rstrip()):
            return "".join(lines[: idx + 1]), "".join(lines[idx + 1:])
    return "", text


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _has_sha_marker(fm: str) -> bool:
    return bool(re.search(r"^original_sha256:\s*[0-9a-f]{64}\s*$", fm, re.MULTILINE))


def _inject_frontmatter(fm: str, sha: str, ts: str) -> str:
    drop = re.compile(r"^(original_sha256|condensed_at):.*$", re.MULTILINE)
    inner = drop.sub("", fm.strip().strip("-").strip()).strip() if fm else ""
    body = inner + ("\n" if inner else "")
    return f"---\n{body}original_sha256: {sha}\ncondensed_at: {ts}\n---\n"


def _backup_path(target: Path) -> Path:
    return target.parent / (target.name + ".original.md")


def condense_file(target: Path) -> Path:
    assert_safe(target)
    text = target.read_text(encoding="utf-8")
    fm, body = _split_frontmatter(text)
    if _has_sha_marker(fm):
        if _sha256(condense_text(body)) != _sha256(body):
            raise CondensationRefused(
                f"{target}: body hash diverged; decondense first "
                f"(`scripts/condense_memory.py {target} --decondense`)."
            )
        return target
    backup = _backup_path(target)
    backup.write_text(text, encoding="utf-8")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    target.write_text(
        _inject_frontmatter(fm, _sha256(body), ts) + condense_text(body),
        encoding="utf-8",
    )
    return backup


def decondense_file(target: Path) -> Path:
    assert_safe(target)
    backup = _backup_path(target)
    if not backup.is_file():
        raise FileNotFoundError(f"no backup at {backup}")
    target.write_text(backup.read_text(encoding="utf-8"), encoding="utf-8")
    backup.unlink()
    return target


def _main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Condense memory files to telegraph grammar.")
    ap.add_argument("path", type=Path)
    grp = ap.add_mutually_exclusive_group()
    grp.add_argument("--check", action="store_true", help="exit 0 if safe; no writes")
    grp.add_argument("--decondense", action="store_true", help="restore .original.md")
    args = ap.parse_args(argv)
    try:
        if args.check:
            assert_safe(args.path)
            return 0
        if args.decondense:
            decondense_file(args.path)
            print(f"decondenseed: {args.path}")
            return 0
        backup = condense_file(args.path)
        print(f"condensed: {args.path}  (backup: {backup})")
        return 0
    except SensitivePathError as exc:
        print(f"error: refused: {exc}", file=sys.stderr)
        return 2
    except CondensationRefused as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 3
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 4


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
