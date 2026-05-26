#!/usr/bin/env python3
"""Sensitive-path denylist — refuses files that almost certainly hold secrets or PII.

Phase 0 of step-16-telegraph-substance. Gates Phase 2 (`scripts/condense_memory.py`):
any consumer-supplied path must pass `assert_safe()` before bytes are read or
shipped to a third-party API.

Ported from Telegraph `plugins/telegraph/skills/telegraph-condense/scripts/condense.py`
(upstream `63a91ec`). Adapted to repo conventions: explicit `SensitivePathError`,
CLI entry point, no `anthropic` import.

Public API:
    is_sensitive(path: pathlib.Path) -> bool
    assert_safe(path: pathlib.Path) -> None     # raises SensitivePathError

CLI:
    python3 scripts/validate_safe_paths.py <path>   # exit 0 = safe, 2 = sensitive
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

__all__ = ["SensitivePathError", "is_sensitive", "assert_safe"]


class SensitivePathError(ValueError):
    """Raised when a path matches the sensitive-file denylist."""


# Filenames that almost certainly hold secrets or PII. Matched against the
# basename only (case-insensitive). Condenseing or shipping these to an LLM API
# is a third-party data boundary developers on sensitive codebases cannot cross.
SENSITIVE_BASENAME_REGEX = re.compile(
    r"(?ix)^("
    r"\.env(\..+)?"
    r"|\.netrc"
    r"|credentials(\..+)?"
    r"|secrets?(\..+)?"
    r"|passwords?(\..+)?"
    r"|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?"
    r"|authorized_keys"
    r"|known_hosts"
    r"|.*\.(pem|key|p12|pfx|crt|cer|jks|keystore|asc|gpg)"
    r")$"
)

# Path components (any segment, case-insensitive) that mark a sensitive
# directory. Catches `~/.ssh/known_hosts` even when the basename slips past the
# regex above.
SENSITIVE_PATH_COMPONENTS = frozenset({".ssh", ".aws", ".gnupg", ".kube", ".docker"})

# Substring tokens checked against the normalised basename (separators stripped
# so `api-key`, `api_key`, `apikey` all match). Catches creative renames like
# `prod-secret-token.txt` that bypass the explicit basename regex.
SENSITIVE_NAME_TOKENS = (
    "secret",
    "credential",
    "password",
    "passwd",
    "apikey",
    "accesskey",
    "token",
    "privatekey",
)

_SEP_STRIP_RE = re.compile(r"[_\-\s.]")


def is_sensitive(path: Path) -> bool:
    """Return True if `path` matches the sensitive-file denylist."""
    name = path.name
    if SENSITIVE_BASENAME_REGEX.match(name):
        return True
    lowered_parts = {p.lower() for p in path.parts}
    if lowered_parts & SENSITIVE_PATH_COMPONENTS:
        return True
    lower = _SEP_STRIP_RE.sub("", name.lower())
    return any(tok in lower for tok in SENSITIVE_NAME_TOKENS)


def assert_safe(path: Path) -> None:
    """Raise `SensitivePathError` if `path` matches the denylist.

    Intended as a hard guard at the top of any function that reads bytes from
    a consumer-supplied path and ships them to a third-party API. Override is
    intentional: the user must rename the file if the heuristic is wrong.
    """
    if is_sensitive(path):
        raise SensitivePathError(
            f"Refusing to operate on {path}: filename or path looks sensitive "
            "(credentials, keys, secrets, or known private directories). "
            "Rename the file if this is a false positive."
        )


def _main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] in ("-h", "--help"):
        print(
            "usage: validate_safe_paths.py <path>\n"
            "  exit 0 — path is safe\n"
            "  exit 2 — path matches the sensitive-file denylist",
            file=sys.stderr,
        )
        return 0 if (len(argv) == 2 and argv[1] in ("-h", "--help")) else 2
    target = Path(argv[1])
    try:
        assert_safe(target)
    except SensitivePathError as exc:
        print(f"SensitivePathError: {exc}", file=sys.stderr)
        return 2
    print(f"safe: {target}")
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv))
