#!/usr/bin/env python3
"""Redact captured hook payloads for the verified-platforms roadmap.

Reads JSON capture files written by ``dispatch_hook.py`` (when
``AGENT_HOOK_CAPTURE_DIR`` is set) and produces a redacted version
suitable for pasting into
``agents/roadmaps/road-to-verified-chat-history-platforms.md``.

Redaction policy (per the roadmap's Capture-and-redact protocol):

- Replace string values at known user-content paths with
  ``<REDACTED>``. Default field allowlist mirrors the fallback list
  in ``scripts/chat_history.py::_extract_hook_text`` plus Augment's
  nested ``conversation.*`` shape.
- Preserve envelope keys (``hook_event_name``, ``session_id``,
  ``platform``, ``event``, ``cwd``, ``workspace_roots``,
  ``transcript_path``, ``model``, ``cursor_version``, …) so the
  schema is reviewable.
- ``--strict`` redacts any string longer than ``--max-len`` (default
  120) chars regardless of key, as a safety net for unknown fields.

Usage:

    python3 scripts/redact_hook_capture.py <input> [--out <path>] [--strict]

Input may be a single JSON file or a directory; with a directory,
every ``*.json`` is redacted and written next to the original with
the suffix ``.redacted.json``.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REDACTED = "<REDACTED>"

# Field names that carry user / agent content (from
# scripts/chat_history.py::_extract_hook_text fallback list +
# nested Augment shape). Matched case-insensitively against the
# leaf key.
_USER_CONTENT_KEYS = {
    "prompt", "user_prompt", "userprompt", "first_user_msg",
    "firstusermsg", "usermessage", "user_message", "text",
    "response", "message", "content",
    # Augment Code with includeConversationData
    "agenttextresponse", "agent_text_response",
    "agentcoderesponse", "agent_code_response",
    # Cursor / generic
    "submitted_prompt", "submittedprompt",
    # Free-form transcript bodies (path stays — content is in another file)
    "transcript", "transcript_text",
}

# Keys whose value is a structural / schema marker — keep as-is even
# when --strict would otherwise redact long values.
_ENVELOPE_KEYS_KEEP = {
    "hook_event_name", "session_id", "transcript_path", "transcriptpath",
    "platform", "event", "native_event", "captured_at", "cwd",
    "workspace_roots", "model", "cursor_version", "user_email",
    "conversation_id", "generation_id", "agent", "type",
    "schema_version", "started_at", "completed_at", "_raw_text",
    "path", "changetype", "change_type",
}


def _redact_value(val: Any, *, key: str | None, strict: bool,
                  max_len: int) -> Any:
    """Recursively redact a value."""
    norm_key = (key or "").lower().replace("-", "_")
    if isinstance(val, dict):
        return {k: _redact_value(v, key=k, strict=strict, max_len=max_len)
                for k, v in val.items()}
    if isinstance(val, list):
        return [_redact_value(item, key=key, strict=strict, max_len=max_len)
                for item in val]
    if isinstance(val, str):
        if norm_key in _ENVELOPE_KEYS_KEEP:
            return val
        if norm_key in _USER_CONTENT_KEYS:
            return REDACTED
        if strict and len(val) > max_len:
            return REDACTED
        return val
    return val


def redact(record: dict, *, strict: bool = False, max_len: int = 120) -> dict:
    """Redact a single capture record. Top-level envelope is preserved."""
    out: dict = {}
    for k, v in record.items():
        if k == "raw_payload":
            out[k] = _redact_value(v, key=None, strict=strict,
                                   max_len=max_len)
        else:
            out[k] = _redact_value(v, key=k, strict=strict,
                                   max_len=max_len)
    return out


def _process_file(path: Path, *, out: Path | None, strict: bool,
                  max_len: int) -> Path:
    record = json.loads(path.read_text(encoding="utf-8"))
    redacted = redact(record, strict=strict, max_len=max_len)
    target = out or path.with_suffix(".redacted.json")
    target.write_text(json.dumps(redacted, indent=2) + "\n",
                      encoding="utf-8")
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="capture file or directory")
    parser.add_argument("--out", default=None,
                        help="output path (single-file mode only)")
    parser.add_argument("--strict", action="store_true",
                        help="redact any string longer than --max-len")
    parser.add_argument("--max-len", type=int, default=120,
                        help="strict-mode length threshold (default 120)")
    args = parser.parse_args(argv)

    src = Path(args.input).expanduser()
    if not src.exists():
        sys.stderr.write(f"redact: input not found: {src}\n")
        return 2

    if src.is_dir():
        if args.out:
            sys.stderr.write("redact: --out is single-file only\n")
            return 2
        files = sorted(p for p in src.glob("*.json")
                       if not p.name.endswith(".redacted.json"))
        for path in files:
            target = _process_file(path, out=None, strict=args.strict,
                                   max_len=args.max_len)
            print(f"redacted: {target}")
        return 0

    target = _process_file(src, out=Path(args.out) if args.out else None,
                           strict=args.strict, max_len=args.max_len)
    print(f"redacted: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
