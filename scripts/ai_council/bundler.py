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
