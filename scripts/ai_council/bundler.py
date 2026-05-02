"""Context bundling for council consultations.

Takes a raw artefact (free-form prompt, roadmap path, diff range, or
file set) and produces a `CouncilContext` — a redacted, size-bounded
text bundle plus a manifest describing exactly what was included.

Hard rules:
- Redaction is fail-closed. If a redaction pattern fires, the line is
  scrubbed *before* the bundle is built.
- Size guard is fail-loud. > MAX_BUNDLE_BYTES → raises BundleTooLarge,
  never silently truncates (would mislead council members).
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

MAX_BUNDLE_BYTES = 50 * 1024  # 50 KB hard ceiling; user must narrow scope on hit.


class BundleTooLarge(RuntimeError):
    """Raised when the assembled bundle exceeds MAX_BUNDLE_BYTES."""


@dataclass
class CouncilContext:
    mode: str  # one of: prompt, roadmap, diff, files
    text: str
    manifest: list[str] = field(default_factory=list)
    excluded: list[str] = field(default_factory=list)


# ── redaction patterns ───────────────────────────────────────────────────
# Each pattern is matched line-wise; matching lines are replaced with the
# placeholder. Order matters — the most specific pattern goes first.

_REDACTION_LINE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r".*~?/?\.config/agent-config/[^/\s]+\.key.*"),
     "[redacted: agent-config key path]"),
    (re.compile(r"^\s*Authorization:\s.*", re.IGNORECASE),
     "[redacted: Authorization header]"),
    (re.compile(r"(?i).*(api[_-]?key|secret|token|password)\s*[:=].*"),
     "[redacted: secret-like assignment]"),
    (re.compile(r"sk-ant-[A-Za-z0-9_\-]{8,}"), "[redacted: anthropic-key-like token]"),
    (re.compile(r"sk-[A-Za-z0-9_\-]{20,}"), "[redacted: openai-key-like token]"),
]


def redact(text: str) -> str:
    """Apply redaction patterns to a multi-line text buffer."""
    out: list[str] = []
    for line in text.splitlines():
        replaced = line
        for pattern, placeholder in _REDACTION_LINE_PATTERNS:
            if pattern.search(replaced):
                replaced = placeholder
                break
        out.append(replaced)
    return "\n".join(out)


def _enforce_size(text: str, mode: str) -> str:
    encoded = text.encode("utf-8")
    if len(encoded) > MAX_BUNDLE_BYTES:
        raise BundleTooLarge(
            f"Bundle for {mode!r} mode is {len(encoded)} bytes "
            f"(> {MAX_BUNDLE_BYTES} hard ceiling). "
            "Narrow the scope (smaller diff, fewer files, shorter prompt)."
        )
    return text


def bundle_prompt(text: str) -> CouncilContext:
    redacted = redact(text)
    return CouncilContext(
        mode="prompt",
        text=_enforce_size(redacted, "prompt"),
        manifest=["<inline prompt>"],
    )


def bundle_roadmap(path: str | Path) -> CouncilContext:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Roadmap not found: {p}")
    raw = p.read_text(encoding="utf-8")
    redacted = redact(raw)
    return CouncilContext(
        mode="roadmap",
        text=_enforce_size(redacted, "roadmap"),
        manifest=[str(p)],
        excluded=["<linked contracts/skills not included by default>"],
    )


def bundle_diff(base_ref: str, head_ref: str = "HEAD", cwd: str | Path | None = None) -> CouncilContext:
    cmd = ["git", "diff", f"{base_ref}..{head_ref}"]
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, check=True, capture_output=True, text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"git diff {base_ref}..{head_ref} failed: {exc.stderr.strip()}"
        ) from exc
    redacted = redact(proc.stdout)
    return CouncilContext(
        mode="diff",
        text=_enforce_size(redacted, "diff"),
        manifest=[f"git diff {base_ref}..{head_ref}"],
    )


# ── smart diff context (D4) ─────────────────────────────────────────────────
# Language-agnostic signature detection. Order matters — most specific first.

_SIGNATURE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^\s*(?:async\s+)?def\s+\w+\s*\("),  # Python
    re.compile(r"^\s*class\s+\w+\b"),  # Python / PHP / JS class
    re.compile(r"^\s*(?:public|protected|private|static|abstract|final)\s+(?:static\s+)?function\s+\w+"),  # PHP method
    re.compile(r"^\s*function\s+\w+\s*\("),  # PHP free function / JS
    re.compile(r"^\s*export\s+(?:default\s+)?(?:async\s+)?function\s+\w+"),  # TS/JS export fn
    re.compile(r"^\s*export\s+(?:default\s+)?class\s+\w+"),  # TS/JS export class
    re.compile(r"^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?\("),  # TS arrow fn
    re.compile(r"^\s*(?:public|private|protected)\s+\w+\s*\("),  # TS method
]

_HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@")
_DIFF_FILE = re.compile(r"^\+\+\+ b/(.+)$")


def _parse_diff_hunks(diff_text: str) -> list[tuple[str, int]]:
    """Return [(file_path, new_start_line), ...] per hunk in input order."""
    out: list[tuple[str, int]] = []
    current_file: str | None = None
    for line in diff_text.splitlines():
        m = _DIFF_FILE.match(line)
        if m:
            current_file = m.group(1)
            continue
        h = _HUNK_HEADER.match(line)
        if h and current_file and current_file != "/dev/null":
            out.append((current_file, int(h.group(1))))
    return out


def _enclosing_signature(
    file_text: str, target_line: int,
) -> tuple[int, str] | None:
    """Walk backwards from `target_line` (1-based) to nearest signature."""
    lines = file_text.splitlines()
    start = min(target_line - 1, len(lines) - 1)
    for idx in range(start, -1, -1):
        line = lines[idx]
        for pat in _SIGNATURE_PATTERNS:
            if pat.match(line):
                return (idx + 1, line.rstrip())
    return None


def bundle_diff_with_context(
    base_ref: str,
    head_ref: str = "HEAD",
    cwd: str | Path | None = None,
    *,
    max_context_bytes: int = 8 * 1024,
) -> CouncilContext:
    """Bundle a diff plus the nearest enclosing signatures for each hunk.

    Appends a `## Surrounding signatures` section after the raw diff.
    Signatures are detected by regex across PY / PHP / JS / TS. Reads
    files from the working tree (correct when `head_ref` == HEAD); if
    a touched file is missing on disk it is silently dropped from the
    context section (the diff itself still shows the change).

    Hard cap: `max_context_bytes` for the signature section. Combined
    output still goes through `_enforce_size`, so the `BundleTooLarge`
    behaviour is unchanged.
    """
    base = bundle_diff(base_ref, head_ref, cwd=cwd)
    hunks = _parse_diff_hunks(base.text)
    if not hunks:
        return base

    root = Path(cwd) if cwd else Path(".")
    seen: set[tuple[str, int]] = set()  # (file, signature_line)
    by_file: dict[str, list[tuple[int, str]]] = {}

    for file_path, new_start in hunks:
        target = root / file_path
        try:
            file_text = target.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        sig = _enclosing_signature(file_text, new_start)
        if sig is None:
            continue
        key = (file_path, sig[0])
        if key in seen:
            continue
        seen.add(key)
        by_file.setdefault(file_path, []).append(sig)

    if not by_file:
        return base

    out_lines: list[str] = ["", "## Surrounding signatures", ""]
    truncated = False
    used = 0
    for file_path, sigs in by_file.items():
        header = f"### {file_path}"
        sig_block = "\n".join(f"    L{ln}: {text}" for ln, text in sorted(sigs))
        chunk = f"{header}\n\n{sig_block}\n\n"
        if used + len(chunk.encode("utf-8")) > max_context_bytes:
            truncated = True
            break
        out_lines.append(header)
        out_lines.append("")
        out_lines.append(sig_block)
        out_lines.append("")
        used += len(chunk.encode("utf-8"))

    if truncated:
        out_lines.append(f"[truncated: signature section capped at {max_context_bytes} bytes]")

    combined = base.text + "\n" + "\n".join(out_lines)
    redacted = redact(combined)
    return CouncilContext(
        mode="diff",
        text=_enforce_size(redacted, "diff"),
        manifest=base.manifest + [f"+ surrounding signatures for {len(by_file)} file(s)"],
    )


def bundle_files(paths: list[str | Path]) -> CouncilContext:
    parts: list[str] = []
    manifest: list[str] = []
    excluded: list[str] = []
    for raw_path in paths:
        p = Path(raw_path)
        if not p.exists():
            excluded.append(f"{p} (not found)")
            continue
        try:
            content = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            excluded.append(f"{p} ({type(exc).__name__})")
            continue
        parts.append(f"### {p}\n\n{content}\n")
        manifest.append(str(p))
    bundled = "\n".join(parts)
    redacted = redact(bundled)
    return CouncilContext(
        mode="files",
        text=_enforce_size(redacted, "files"),
        manifest=manifest,
        excluded=excluded,
    )
