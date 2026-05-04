"""Per-platform event-shape contract tests — Phase 7.11 layer (c).

Freezes a representative native payload for each platform and asserts
the dispatcher's envelope contract (`docs/contracts/hook-architecture-v1.md`
§ "Stdin contract") holds without subprocess overhead. Companion layers:

- (a) `tests/hooks/test_dispatcher_parser.py` — pure parser unit.
- (b) `tests/hooks/test_install_snapshot.py` — install-output shape.

Each platform sample is a canonical envelope payload as documented at
the platform's hook-reference page (Cursor, Cline, Windsurf, Gemini)
or as observed from the host (Augment, Claude). Sample shapes deliberately
include the keys our chat-history and roadmap concerns actually consume
— `session_id`, `workspace_root`, `tool_name`, `cwd` — so any contract
drift surfaces here, not in production.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402

MANIFEST = dispatch_hook._load_yaml(REPO_ROOT / "scripts" / "hook_manifest.yaml")
ALIASES = MANIFEST.get("native_event_aliases") or {}


# Frozen sample payloads — keep these as plain JSON strings so a
# breaking platform-doc change is a one-line diff with provenance.
SAMPLES: dict[str, list[tuple[str, str, str]]] = {
    # (native_event, ac_event, payload_json)
    "augment": [
        ("SessionStart", "session_start",
         '{"session_id": "aug-1", "source": "startup", "cwd": "/work"}'),
        ("Stop", "stop",
         '{"session_id": "aug-1", "stop_reason": "end_turn"}'),
        ("PostToolUse", "post_tool_use",
         '{"session_id": "aug-1", "tool_name": "view"}'),
    ],
    "claude": [
        ("SessionStart", "session_start",
         '{"session_id": "cl-1", "transcript_path": "/tmp/t.json"}'),
        ("UserPromptSubmit", "user_prompt_submit",
         '{"session_id": "cl-1", "prompt": "hello"}'),
        ("PostToolUse", "post_tool_use",
         '{"session_id": "cl-1", "tool_name": "Read"}'),
    ],
    "cursor": [
        ("sessionStart", "session_start",
         '{"session_id": "cu-1", "workspace_roots": ["/work"]}'),
        ("beforeSubmitPrompt", "user_prompt_submit",
         '{"session_id": "cu-1", "prompt": "hi"}'),
        ("postToolUse", "post_tool_use",
         '{"session_id": "cu-1", "tool_name": "edit_file"}'),
    ],
    "cline": [
        ("TaskStart", "session_start",
         '{"taskId": "cli-1", "session_id": "cli-1", '
         '"workspaceRoots": ["/work"], "model": "claude-sonnet"}'),
        ("TaskResume", "session_start",
         '{"taskId": "cli-1", "session_id": "cli-1"}'),
        ("UserPromptSubmit", "user_prompt_submit",
         '{"taskId": "cli-1", "session_id": "cli-1", "prompt": "go"}'),
    ],
    "windsurf": [
        ("post_setup_worktree", "session_start",
         '{"session_id": "ws-1", "workspace_path": "/work"}'),
        ("pre_user_prompt", "user_prompt_submit",
         '{"session_id": "ws-1", "prompt": "ping"}'),
        ("post_cascade_response", "stop",
         '{"session_id": "ws-1"}'),
    ],
    "gemini": [
        ("SessionStart", "session_start",
         '{"session_id": "gem-1", "cwd": "/work"}'),
        ("BeforeAgent", "user_prompt_submit",
         '{"session_id": "gem-1", "prompt": "build it"}'),
        ("AfterAgent", "stop",
         '{"session_id": "gem-1"}'),
        ("AfterTool", "post_tool_use",
         '{"session_id": "gem-1", "tool_name": "ReadFile"}'),
    ],
}


def _build(platform: str, event: str, native: str, payload_json: str) -> dict:
    args = argparse.Namespace(platform=platform, event=event, native_event=native)
    return dispatch_hook._build_envelope(args, payload_json)


def test_native_event_aliases_resolve_to_ac_event_per_sample() -> None:
    """Every sample's native event must resolve to its declared AC event
    via the manifest's `native_event_aliases` table."""
    for platform, samples in SAMPLES.items():
        platform_aliases = ALIASES.get(platform) or {}
        for native, ac_event, _payload in samples:
            assert platform_aliases.get(native) == ac_event, (
                f"{platform}: native '{native}' does not alias to '{ac_event}' "
                f"(manifest says: {platform_aliases.get(native)!r})"
            )


def test_envelope_preserves_native_payload_verbatim() -> None:
    """`payload` must be a verbatim passthrough — concerns extract via
    their own helpers, the dispatcher does not normalise."""
    for platform, samples in SAMPLES.items():
        for native, ac_event, payload_json in samples:
            env = _build(platform, ac_event, native, payload_json)
            assert env["payload"] == json.loads(payload_json), (
                f"{platform}/{native}: payload mutated by dispatcher"
            )


def test_envelope_carries_required_top_level_keys() -> None:
    required = {"schema_version", "platform", "event", "native_event",
                "session_id", "workspace_root", "payload", "settings"}
    for platform, samples in SAMPLES.items():
        for native, ac_event, payload_json in samples:
            env = _build(platform, ac_event, native, payload_json)
            assert required.issubset(env.keys()), (
                f"{platform}/{native}: missing keys "
                f"{required - set(env.keys())}"
            )
            assert env["schema_version"] == 1
            assert env["platform"] == platform
            assert env["event"] == ac_event
            assert env["native_event"] == native


def test_envelope_session_id_extracted_from_payload() -> None:
    """When the platform's native payload carries `session_id`, the
    envelope must surface it as a top-level field so concerns can route
    state writes to the right per-session slot."""
    for platform, samples in SAMPLES.items():
        for native, ac_event, payload_json in samples:
            env = _build(platform, ac_event, native, payload_json)
            payload = json.loads(payload_json)
            if "session_id" in payload:
                assert env["session_id"] == payload["session_id"], (
                    f"{platform}/{native}: session_id not lifted from payload"
                )


def test_ac_events_in_samples_match_event_vocabulary() -> None:
    for platform, samples in SAMPLES.items():
        for _native, ac_event, _payload in samples:
            assert ac_event in dispatch_hook.EVENT_VOCABULARY, (
                f"{platform}: '{ac_event}' not in EVENT_VOCABULARY"
            )
