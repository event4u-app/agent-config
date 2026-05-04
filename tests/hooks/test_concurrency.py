"""Concurrency regression test for the shared dispatcher state lock.

Asserts the contract from `docs/contracts/hook-architecture-v1.md` § Concurrency
and roadmap step 7.4: parallel writers under
`agents/state/.dispatcher.lock` may interleave but MUST NOT produce torn
files. The end state of the target file must always be a complete JSON
document matching exactly one of the writers' payloads.

The test runs two scenarios:

1. Multi-process — `multiprocessing.Process` spawns N workers that each
   call `atomic_write_json` against the same target. After joining,
   the file is loaded with `json.loads` and compared against the set
   of expected payloads.
2. Multi-thread — same writers in `threading.Thread` form. Threads
   contend on the same lock file via `fcntl.flock`; the write-tmp +
   `os.replace` pattern guarantees POSIX-atomic publication.

Both scenarios run with payload bodies large enough (~200 KB) that
naive `write_text` would tear under contention without the lock.
"""
from __future__ import annotations

import json
import multiprocessing
import sys
import threading
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from hooks.state_io import atomic_write_json  # noqa: E402


def _payload(seed: int) -> dict:
    """Build a payload heavy enough that an unlocked writer would tear."""
    return {
        "writer": seed,
        "filler": ["x" * 4096 for _ in range(50)],  # ~200 KB
        "tail": f"writer-{seed}-end",
    }


def _write_once(target: Path, seed: int) -> None:
    atomic_write_json(target, _payload(seed))


def _writer_loop(target: Path, seed: int, iters: int) -> None:
    for _ in range(iters):
        _write_once(target, seed)


def _verify_complete(target: Path, expected_seeds: set[int]) -> None:
    """File must be valid JSON and match one full payload exactly."""
    data = json.loads(target.read_text(encoding="utf-8"))
    assert isinstance(data, dict)
    assert data["writer"] in expected_seeds
    assert data["tail"] == f"writer-{data['writer']}-end"
    assert len(data["filler"]) == 50
    assert all(s == "x" * 4096 for s in data["filler"])


@pytest.mark.skipif(
    sys.platform.startswith("win"),
    reason="fcntl-based lock is POSIX-only; Windows path tracked separately.",
)
def test_atomic_write_no_torn_files_multithreaded(tmp_path: Path) -> None:
    """Multi-thread contention must never corrupt the destination file."""
    target = tmp_path / "agents" / "state" / "concurrent.json"
    seeds = list(range(8))
    threads = [
        threading.Thread(target=_writer_loop, args=(target, seed, 10))
        for seed in seeds
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    _verify_complete(target, set(seeds))


@pytest.mark.skipif(
    sys.platform.startswith("win"),
    reason="fcntl-based lock is POSIX-only; Windows path tracked separately.",
)
def test_atomic_write_no_torn_files_multiprocess(tmp_path: Path) -> None:
    """Cross-process contention (the real hook scenario) is the harder
    case — two platforms can fire dispatchers in the same workspace."""
    target = tmp_path / "agents" / "state" / "concurrent.json"
    seeds = list(range(6))
    ctx = multiprocessing.get_context("fork")
    procs = [
        ctx.Process(target=_writer_loop, args=(target, seed, 8))
        for seed in seeds
    ]
    for p in procs:
        p.start()
    for p in procs:
        p.join(timeout=30)
        assert p.exitcode == 0, f"writer {p.pid} exited {p.exitcode}"
    _verify_complete(target, set(seeds))


def test_atomic_write_creates_state_dir(tmp_path: Path) -> None:
    """The helper must auto-create `agents/state/` so concerns don't
    have to repeat the mkdir dance."""
    target = tmp_path / "deeper" / "agents" / "state" / "fresh.json"
    assert not target.parent.exists()
    atomic_write_json(target, {"hello": "world"})
    assert target.is_file()
    assert json.loads(target.read_text())["hello"] == "world"
    # Lock file appears alongside, also under gitignored agents/state/.
    assert (target.parent / ".dispatcher.lock").exists()


def test_atomic_write_overwrites_cleanly(tmp_path: Path) -> None:
    """Repeated writes do not leak `.tmp.<pid>` siblings."""
    target = tmp_path / "agents" / "state" / "overwrite.json"
    for i in range(5):
        atomic_write_json(target, {"i": i})
    assert json.loads(target.read_text())["i"] == 4
    siblings = sorted(p.name for p in target.parent.iterdir())
    # Only the lock file and the target itself may remain.
    leftover = [n for n in siblings
                if n not in {target.name, ".dispatcher.lock"}]
    assert leftover == [], f"unexpected leftovers: {leftover}"
