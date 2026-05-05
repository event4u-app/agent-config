#!/usr/bin/env python3
"""Universal hook dispatcher — single entry point for every platform.

Per `docs/contracts/hook-architecture-v1.md`. Reads the manifest at
`scripts/hook_manifest.yaml`, resolves which concerns fire on the given
(platform, event) tuple, and runs each concern sequentially with the
stdin envelope contract. Reduces concern exit codes per the spec
(0=allow, 1=block, 2=warn, ≥3=error → fail-open unless concern is
fail_closed).

Invocation:

    python3 scripts/hooks/dispatch_hook.py \\
        --platform <name> \\
        --event <agent-config-event> \\
        [--native-event <platform-event>] \\
        < platform-payload.json

Per-platform shell trampolines under `scripts/hooks/<platform>-dispatcher.sh`
extract the workspace root from the platform payload, cd there, then call
this script. Trampolines never read the manifest themselves.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "scripts" / "hook_manifest.yaml"

# Lazy import — we want this module to be importable even if the
# hooks package state_io has changed (test isolation).
sys.path.insert(0, str(Path(__file__).resolve().parent))
from state_io import atomic_write_json, feedback_dir  # noqa: E402

EXIT_ALLOW = 0
EXIT_BLOCK = 1
EXIT_WARN = 2

# Per Council Round 2 (Q3): `agent_error` covers agent-level crashes
# that are not concern-triggered, so chat-history can checkpoint
# partial sessions on abnormal exit.
EVENT_VOCABULARY = {
    "session_start", "session_end",
    "user_prompt_submit",
    "pre_tool_use", "post_tool_use",
    "stop", "pre_compact",
    "agent_error",
}

_SEVERITY_BY_EXIT = {
    EXIT_ALLOW: "allow",
    EXIT_BLOCK: "block",
    EXIT_WARN: "warn",
}


def _severity_for(rc: int) -> str:
    return _SEVERITY_BY_EXIT.get(rc, "error")


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _resolve_session_id(envelope: dict) -> str:
    sid = envelope.get("session_id") or ""
    if sid:
        return str(sid)
    # Fallback so the feedback dir always has a unique slot per
    # invocation. Format: dispatch-<unix_ts>-<pid>. Not stable
    # across invocations — that is the point.
    return f"dispatch-{int(time.time())}-{os.getpid()}"


def _parse_concern_stdout(stdout_text: str) -> dict:
    """Concern stdout MAY be a JSON object with decision/reason. Tolerate
    empty / non-JSON / non-dict output per the contract."""
    text = (stdout_text or "").strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        return {"_raw_stdout": text[:500]}
    return parsed if isinstance(parsed, dict) else {"_raw": parsed}


def _load_yaml(path: Path) -> dict:
    """Minimal manifest loader — prefers PyYAML, falls back to a stub
    parser so the dispatcher works even before consumer projects pip-install
    PyYAML. The fallback is deliberately narrow: it understands only the
    flat dict / list-of-strings / null shape the manifest uses."""
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore[import-not-found]
        return yaml.safe_load(text) or {}
    except ImportError:
        pass
    return _fallback_yaml(text)


def _fallback_yaml(text: str) -> dict:  # noqa: C901 — flat parser is unavoidably long
    """Indent-aware mini-parser for the manifest's flat shape only.
    Handles: scalars, `key: null`, `key: true/false`, `key: [a, b]`.
    Drops comments + blank lines. Two-space indent assumed."""
    root: dict = {}
    stack: list[tuple[int, dict]] = [(-1, root)]
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(" "))
        while stack and stack[-1][0] >= indent:
            stack.pop()
        parent = stack[-1][1] if stack else root
        body = line.strip()
        if ":" not in body:
            continue
        key, _, val = body.partition(":")
        key, val = key.strip(), val.strip()
        if not val:
            new: dict = {}
            parent[key] = new
            stack.append((indent, new))
        elif val.lower() in ("null", "~", ""):
            parent[key] = None
        elif val.lower() == "true":
            parent[key] = True
        elif val.lower() == "false":
            parent[key] = False
        elif val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            parent[key] = [s.strip() for s in inner.split(",") if s.strip()] if inner else []
        elif val.lstrip("-").isdigit():
            parent[key] = int(val)
        else:
            parent[key] = val.strip("'\"")
    return root


def _resolve_concerns(manifest: dict, platform: str, event: str) -> list[dict]:
    """Return the ordered concern definitions for (platform, event)."""
    platforms = manifest.get("platforms") or {}
    block = platforms.get(platform)
    if not block:
        return []
    if isinstance(block, dict) and block.get("fallback_only"):
        return []
    names = (block or {}).get(event) or []
    if not isinstance(names, list):
        return []
    concerns_def = manifest.get("concerns") or {}
    out: list[dict] = []
    for name in names:
        spec = concerns_def.get(name)
        if not spec:
            sys.stderr.write(f"dispatch_hook: unknown concern '{name}' in manifest\n")
            continue
        out.append({"name": name, **spec})
    return out


def _maybe_capture_payload(args: argparse.Namespace, payload_text: str) -> None:
    """Write the raw stdin payload to a capture directory when
    ``AGENT_HOOK_CAPTURE_DIR`` is set. Used by the verified-platforms
    discovery roadmap (`agents/roadmaps/road-to-verified-chat-history-platforms.md`)
    to lock real payload shapes before extractor branches are added.

    Fail-silent: any IO / JSON error must not break dispatch.
    """
    capture_dir = os.environ.get("AGENT_HOOK_CAPTURE_DIR", "").strip()
    if not capture_dir:
        return
    try:
        target = Path(capture_dir).expanduser()
        target.mkdir(parents=True, exist_ok=True)
        try:
            payload = json.loads(payload_text) if payload_text.strip() else {}
        except (ValueError, TypeError):
            payload = {"_raw_text": payload_text}
        record = {
            "captured_at": _now_iso(),
            "platform": args.platform,
            "event": args.event,
            "native_event": args.native_event or "",
            "raw_payload": payload,
        }
        ts = int(time.time() * 1000)
        native = (args.native_event or args.event).replace("/", "_")
        fname = f"{args.platform}__{native}__{ts}__{os.getpid()}.json"
        (target / fname).write_text(
            json.dumps(record, indent=2) + "\n", encoding="utf-8")
    except OSError:
        return


def _build_envelope(args: argparse.Namespace, payload_text: str) -> dict:
    try:
        payload = json.loads(payload_text) if payload_text.strip() else {}
        if not isinstance(payload, dict):
            payload = {"_raw": payload}
    except (ValueError, TypeError):
        payload = {"_raw": payload_text}
    return {
        "schema_version": 1,
        "platform": args.platform,
        "event": args.event,
        "native_event": args.native_event or "",
        "session_id": payload.get("session_id") or os.environ.get("AGENT_SESSION_ID", ""),
        "workspace_root": str(Path.cwd()),
        "payload": payload,
        "settings": {},
    }


def _run_concern(concern: dict, envelope: dict) -> tuple[int, str, str, int]:
    """Invoke one concern with the envelope on stdin.

    Returns (rc, stderr_text, stdout_text, duration_ms).

    Concerns run with CWD = consumer workspace (envelope.workspace_root),
    NOT the agent-config package root — concerns resolve `agents/state/`
    and other consumer-local paths relative to CWD. The script *itself*
    lives in the package (REPO_ROOT), so we resolve it absolutely.
    """
    script = REPO_ROOT / concern["script"]
    cmd = [sys.executable, str(script), *(concern.get("args") or [])]
    cmd.extend(["--platform", envelope.get("platform", "generic")])
    workspace = envelope.get("workspace_root") or str(Path.cwd())
    started = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            input=json.dumps(envelope),
            capture_output=True,
            text=True,
            cwd=workspace,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        elapsed = int((time.monotonic() - started) * 1000)
        return (3, f"{concern.get('name')}: {exc}", "", elapsed)
    elapsed = int((time.monotonic() - started) * 1000)
    return (proc.returncode, proc.stderr or "", proc.stdout or "", elapsed)


def _reduce(rcs: list[int]) -> int:
    if any(rc == EXIT_BLOCK for rc in rcs):
        return EXIT_BLOCK
    if any(rc == EXIT_WARN for rc in rcs):
        return EXIT_WARN
    return EXIT_ALLOW


def _write_feedback(envelope: dict, session_id: str, entries: list[dict],
                    final_rc: int, started_at: str) -> None:
    """Write per-concern feedback files + summary rollup.

    Per Council Round 2 (Q1): exit-code reduction collapses the
    severity ladder to a single platform-native code; this dir
    surfaces the per-concern detail to humans / `task hooks-status`.

    Errors writing feedback are non-fatal — feedback is observability,
    not control flow. We only swallow IO errors here; fail-open
    matches the dispatcher's overall posture.
    """
    workspace = envelope.get("workspace_root") or str(Path.cwd())
    state_root = Path(workspace) / "agents" / "state"
    fb_dir = feedback_dir(state_root, session_id)
    try:
        fb_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        sys.stderr.write(f"dispatch_hook: feedback dir unavailable: {exc}\n")
        return
    for entry in entries:
        target = fb_dir / f"{entry['concern']}.json"
        try:
            atomic_write_json(target, entry)
        except OSError as exc:
            sys.stderr.write(f"dispatch_hook: feedback write failed for "
                             f"{entry['concern']}: {exc}\n")
    summary = {
        "schema_version": 1,
        "session_id": session_id,
        "platform": envelope.get("platform"),
        "event": envelope.get("event"),
        "native_event": envelope.get("native_event") or "",
        "started_at": started_at,
        "completed_at": _now_iso(),
        "final_exit_code": final_rc,
        "final_severity": _severity_for(final_rc),
        "concerns": [
            {k: v for k, v in e.items()
             if k in {"concern", "exit_code", "severity", "decision",
                      "reason", "duration_ms"}}
            for e in entries
        ],
    }
    try:
        atomic_write_json(fb_dir / "summary.json", summary)
    except OSError as exc:
        sys.stderr.write(f"dispatch_hook: summary write failed: {exc}\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", required=True)
    parser.add_argument("--event", required=True)
    parser.add_argument("--native-event", default="")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH))
    parser.add_argument("--dry-run", action="store_true",
                        help="Resolve concerns and print plan; do not invoke them.")
    args = parser.parse_args(argv)

    if args.event not in EVENT_VOCABULARY:
        sys.stderr.write(f"dispatch_hook: unknown event '{args.event}'; allowed: "
                         f"{sorted(EVENT_VOCABULARY)}\n")
        return EXIT_ALLOW  # fail-open per contract for unknown events

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        sys.stderr.write(f"dispatch_hook: manifest missing at {manifest_path}\n")
        return EXIT_ALLOW
    manifest = _load_yaml(manifest_path)

    payload_text = "" if sys.stdin.isatty() else sys.stdin.read()
    _maybe_capture_payload(args, payload_text)
    concerns = _resolve_concerns(manifest, args.platform, args.event)

    if args.dry_run:
        plan = {"platform": args.platform, "event": args.event,
                "concerns": [c["name"] for c in concerns]}
        print(json.dumps(plan, indent=2))
        return EXIT_ALLOW

    if not concerns:
        return EXIT_ALLOW  # platform unsupported / fallback-only / empty slot

    envelope = _build_envelope(args, payload_text)
    session_id = _resolve_session_id(envelope)
    started_at = _now_iso()
    rcs: list[int] = []
    feedback_entries: list[dict] = []
    for concern in concerns:
        concern_started = _now_iso()
        rc, stderr_text, stdout_text, duration_ms = _run_concern(concern, envelope)
        raw_rc = rc
        if rc >= 3:
            if not concern.get("fail_closed"):
                rc = EXIT_ALLOW  # fail-open
            else:
                rc = EXIT_BLOCK
            if stderr_text:
                sys.stderr.write(stderr_text)
        rcs.append(rc)
        reply = _parse_concern_stdout(stdout_text)
        feedback_entries.append({
            "concern": concern["name"],
            "exit_code": rc,
            "raw_exit_code": raw_rc,
            "severity": _severity_for(rc),
            "decision": reply.get("decision") or _severity_for(rc),
            "reason": reply.get("reason"),
            "duration_ms": duration_ms,
            "started_at": concern_started,
            "completed_at": _now_iso(),
            "fail_closed": bool(concern.get("fail_closed")),
        })
    final_rc = _reduce(rcs)
    _write_feedback(envelope, session_id, feedback_entries, final_rc, started_at)
    return final_rc


if __name__ == "__main__":
    raise SystemExit(main())
