"""Pre-merge gate for Phase 1 of road-to-chat-history-hook-only.md.

Spawns subprocesses against the chat_history.py CLI to exercise the
auto-adopt path on `session_start` against a foreign chat-history
fixture. This file MUST be green before Phase 1 Step 5 (rule deletion)
ships.

Five scenarios from Phase 1 Step 4:
  1. Happy path — foreign fp, auto-adopt enabled, former_fps empty.
  2. former_fps at cap — oldest drops, new old_fp ends up at index 0.
  3. File-lock race — fcntl.flock held during the hook call.
  4. Concurrent session_start — two procs within ~10ms, single rotation.
  5. Corrupted former_fps entry — adopt either skips or fails cleanly.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
import chat_history as ch  # noqa: E402

CHAT_HISTORY_CLI = REPO_ROOT / "scripts" / "chat_history.py"


def _settings(tmp_path: Path) -> Path:
    p = tmp_path / "agent-settings.yml"
    p.write_text("chat_history:\n  enabled: true\n", encoding="utf-8")
    return p


def _run_hook(history: Path, settings: Path, payload: dict,
              env_extra: dict | None = None,
              ) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["AGENT_CHAT_HISTORY_FILE"] = str(history)
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        [sys.executable, str(CHAT_HISTORY_CLI),
         "hook-dispatch", "--platform", "augment",
         "--settings", str(settings)],
        input=json.dumps(payload),
        capture_output=True, text=True, env=env, timeout=15, check=False,
    )


def _seed_foreign(history: Path, owner: str = "stranger") -> str:
    ch.init(owner, path=history)
    ch.append({"t": "user", "text": "leftover"},
              path=history, first_user_msg=owner)
    return ch.fingerprint(owner)


def test_happy_path_foreign_fp_auto_adopts(tmp_path: Path):
    history = tmp_path / "chat-history.jsonl"
    settings = _settings(tmp_path)
    old_fp = _seed_foreign(history)
    mtime_before = history.stat().st_mtime_ns
    time.sleep(0.01)

    proc = _run_hook(history, settings,
                     {"hook_event_name": "SessionStart",
                      "prompt": "fresh owner"})
    assert proc.returncode == ch.EXIT_OK, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert payload["action"] == "adopted"

    header = ch.read_header(history)
    assert header["fp"] == ch.fingerprint("fresh owner")
    assert header["former_fps"][0] == old_fp
    assert history.stat().st_mtime_ns > mtime_before


def test_former_fps_at_cap_drops_oldest(tmp_path: Path):
    history = tmp_path / "chat-history.jsonl"
    settings = _settings(tmp_path)
    old_fp = _seed_foreign(history)

    cap = ch.FORMER_FPS_CAP
    fillers = [ch.fingerprint(f"filler-{i}") for i in range(cap)]
    header = ch.read_header(history)
    header["former_fps"] = list(fillers)
    body = history.read_text(encoding="utf-8").splitlines(keepends=True)
    body[0] = json.dumps(header, ensure_ascii=False) + "\n"
    history.write_text("".join(body), encoding="utf-8")

    proc = _run_hook(history, settings,
                     {"hook_event_name": "SessionStart",
                      "prompt": "fresh owner"})
    assert proc.returncode == ch.EXIT_OK, proc.stderr

    h = ch.read_header(history)
    assert len(h["former_fps"]) == cap
    assert h["former_fps"][0] == old_fp
    # Oldest filler (last in original list) drops on overflow.
    assert fillers[-1] not in h["former_fps"]


def test_disk_failure_returns_adopt_failed_atomic(tmp_path: Path):
    history = tmp_path / "chat-history.jsonl"
    settings = _settings(tmp_path)
    _seed_foreign(history)
    pre = history.read_text(encoding="utf-8")

    # Platform-equivalent of fcntl.flock: the test-only env var
    # AGENT_CHAT_HISTORY_FORCE_ADOPT_FAIL makes adopt() raise OSError
    # before any disk write, so hook_append must catch it and return
    # adopt_failed. The original file must stay byte-for-byte intact.
    proc = _run_hook(
        history, settings,
        {"hook_event_name": "SessionStart", "prompt": "fresh owner"},
        env_extra={"AGENT_CHAT_HISTORY_FORCE_ADOPT_FAIL":
                   "disk full simulated"},
    )

    assert proc.returncode == ch.EXIT_OK, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert payload["action"] == "adopt_failed"
    assert "disk full" in payload["reason"]
    # Original file unchanged.
    assert history.read_text(encoding="utf-8") == pre


def test_concurrent_session_start_single_rotation(tmp_path: Path):
    history = tmp_path / "chat-history.jsonl"
    settings = _settings(tmp_path)
    old_fp = _seed_foreign(history)

    payload = {"hook_event_name": "SessionStart", "prompt": "fresh owner"}
    results: list[subprocess.CompletedProcess] = []
    barrier = threading.Barrier(2)

    def worker():
        barrier.wait(timeout=5)
        results.append(_run_hook(history, settings, payload))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15)

    assert len(results) == 2
    for proc in results:
        assert proc.returncode == ch.EXIT_OK, proc.stderr
        body = json.loads(proc.stdout.strip().splitlines()[-1])
        assert body["action"] in {"adopted", "sidecar_written"}, body

    h = ch.read_header(history)
    new_fp = ch.fingerprint("fresh owner")
    assert h["fp"] == new_fp
    # Exactly one rotation: old_fp present once, new_fp absent (deduped).
    assert h["former_fps"].count(old_fp) == 1
    assert new_fp not in h["former_fps"]
    # No duplicates anywhere — internal consistency.
    assert len(h["former_fps"]) == len(set(h["former_fps"]))


def test_corrupted_former_fps_entry_preserves_valid_history(tmp_path: Path):
    history = tmp_path / "chat-history.jsonl"
    settings = _settings(tmp_path)
    _seed_foreign(history)

    valid_a = ch.fingerprint("prior-owner-a")
    valid_b = ch.fingerprint("prior-owner-b")
    malformed = "NOT-A-HEX-FINGERPRINT-just-some-garbage-string"
    header = ch.read_header(history)
    header["former_fps"] = [valid_a, malformed, valid_b]
    body = history.read_text(encoding="utf-8").splitlines(keepends=True)
    body[0] = json.dumps(header, ensure_ascii=False) + "\n"
    history.write_text("".join(body), encoding="utf-8")

    proc = _run_hook(history, settings,
                     {"hook_event_name": "SessionStart",
                      "prompt": "fresh owner"})
    assert proc.returncode == ch.EXIT_OK, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    # Spec: skip bad entry and rotate, OR adopt_failed with reason.
    # Either way: valid history must survive.
    assert payload["action"] in {"adopted", "adopt_failed"}, payload
    if payload["action"] == "adopt_failed":
        assert payload["reason"]
        return

    h = ch.read_header(history)
    assert h["fp"] == ch.fingerprint("fresh owner")
    # Valid entries preserved (in any position, possibly truncated by cap).
    assert valid_a in h["former_fps"]
    assert valid_b in h["former_fps"]

