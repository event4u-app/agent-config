"""Tests for scripts/memory_lookup.py — file-based retrieval fallback."""

from __future__ import annotations

import json
import os
import sys
import textwrap
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import memory_lookup  # noqa: E402


def _chdir(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    # Ensure the module picks up the new cwd-based paths.
    monkeypatch.setattr(memory_lookup, "MEMORY_ROOT",
                        Path("agents/memory"))
    monkeypatch.setattr(memory_lookup, "INTAKE_ROOT",
                        Path("agents/memory/intake"))


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content), encoding="utf-8")


def test_no_memory_dir_returns_empty(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    assert memory_lookup.retrieve(["ownership"], ["anything"]) == []


def test_curated_single_file_layout(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/ownership.yml", """
        version: 1
        entries:
          - id: own-1
            status: active
            confidence: high
            source: ["docs/teams.md"]
            owner: team-payments
            last_validated: 2026-01-01
            review_after_days: 180
            path: "app/Http/Controllers/Billing/**"
    """)
    hits = memory_lookup.retrieve(["ownership"], ["billing"], limit=5)
    assert len(hits) == 1
    assert hits[0].id == "own-1"
    assert hits[0].source == "curated"
    assert hits[0].score > 0


def test_content_addressed_layout(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/domain-invariants/abc123.yml", """
        id: di-1
        status: active
        confidence: high
        source: ["docs/domain.md"]
        owner: team-x
        last_validated: 2026-01-01
        review_after_days: 180
        rule: "invoice total equals sum of line items"
        feature: "billing"
    """)
    hits = memory_lookup.retrieve(["domain-invariants"], ["billing"])
    assert len(hits) == 1
    assert hits[0].id == "di-1"
    assert hits[0].source == "curated"


def test_intake_jsonl_basic(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    intake = tmp_path / "agents/memory/intake/learnings.jsonl"
    intake.parent.mkdir(parents=True)
    intake.write_text(
        json.dumps({"id": "i-1", "entry_type": "historical-patterns",
                    "path": "app/Http/Foo.php", "body": "off-by-one"}) + "\n"
    )
    hits = memory_lookup.retrieve(["historical-patterns"], ["foo.php"])
    assert len(hits) == 1
    assert hits[0].source == "intake"
    # Intake entries are discounted vs curated.
    assert hits[0].score > 0 and hits[0].score < 0.9


def test_intake_supersede_chain(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    intake = tmp_path / "agents/memory/intake/learnings.jsonl"
    intake.parent.mkdir(parents=True)
    intake.write_text("\n".join([
        json.dumps({"id": "i-1", "entry_type": "incident-learnings",
                    "path": "queue", "body": "old"}),
        json.dumps({"id": "i-2", "entry_type": "incident-learnings",
                    "path": "queue", "body": "new"}),
        json.dumps({"type": "supersede", "supersedes": "i-1"}),
    ]) + "\n")
    hits = memory_lookup.retrieve(["incident-learnings"], ["queue"])
    ids = [h.id for h in hits]
    assert "i-2" in ids
    assert "i-1" not in ids, "superseded entries must not be returned"


def test_unknown_type_is_ignored(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/ownership.yml", """
        version: 1
        entries:
          - id: own-1
            path: "x"
    """)
    # Mixed types — the unknown one is silently skipped.
    hits = memory_lookup.retrieve(["ownership", "not-a-type"], ["x"])
    assert len(hits) == 1
    assert hits[0].type == "ownership"


def test_limit_applied(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    entries = "\n".join(
        f"  - id: own-{i}\n    path: \"src/{i}\"" for i in range(10)
    )
    _write(tmp_path / "agents/memory/ownership.yml",
           f"version: 1\nentries:\n{entries}\n")
    hits = memory_lookup.retrieve(["ownership"], ["src/"], limit=3)
    assert len(hits) == 3


# ---------------------------------------------------------------------------
# Package-backed operational provider (the `present` path)
# ---------------------------------------------------------------------------


def test_synthesize_query_joins_keys():
    assert memory_lookup._synthesize_query(
        ["app/Http", "billing"]
    ) == "app/Http billing"


def test_synthesize_query_drops_empty_and_non_strings():
    assert memory_lookup._synthesize_query(
        ["", "  ", "real", None, 42]  # type: ignore[list-item]
    ) == "real"


def test_synthesize_query_returns_empty_when_all_keys_empty():
    assert memory_lookup._synthesize_query(["", "  "]) == ""


def _fake_memory_cli(tmp_path: Path, body: str) -> Path:
    """Create an executable shell script that mimics the `memory` CLI."""
    import stat
    fake = tmp_path / "memory"
    fake.write_text(body)
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return fake


def test_cli_operational_provider_happy_path(tmp_path):
    envelope = {
        "contract_version": 1,
        "status": "ok",
        "entries": [
            {
                "id": "op-1",
                "type": "ownership",
                "source": "operational",
                "confidence": 0.72,
                "body": {"path": "app/Http/Foo.php", "owner": "team-x"},
            },
        ],
    }
    fake = _fake_memory_cli(tmp_path, f"""#!/bin/sh
echo '{{"level":30,"msg":"Database connected"}}' >&2
cat <<'EOF'
{json.dumps(envelope)}
EOF
""")
    hits = list(memory_lookup._cli_operational_provider(
        ["ownership"], ["billing"], cli_path=str(fake),
    ))
    assert len(hits) == 1
    assert hits[0].id == "op-1"
    assert hits[0].source == "operational"
    assert hits[0].score == 0.72
    assert hits[0].entry["owner"] == "team-x"


def test_cli_operational_provider_drops_empty_query(tmp_path):
    fake = _fake_memory_cli(tmp_path, "#!/bin/sh\nexit 1\n")
    # Empty keys → no query → provider yields nothing without invoking CLI.
    hits = list(memory_lookup._cli_operational_provider(
        ["ownership"], [], cli_path=str(fake),
    ))
    assert hits == []


def test_cli_operational_provider_handles_nonzero_exit(tmp_path):
    fake = _fake_memory_cli(tmp_path, "#!/bin/sh\necho 'boom' >&2\nexit 3\n")
    # Failure mode is silent: caller gets file-fallback only.
    hits = list(memory_lookup._cli_operational_provider(
        ["ownership"], ["billing"], cli_path=str(fake),
    ))
    assert hits == []


def test_cli_operational_provider_handles_garbage_stdout(tmp_path):
    fake = _fake_memory_cli(tmp_path,
                            "#!/bin/sh\necho 'not json at all'\n")
    hits = list(memory_lookup._cli_operational_provider(
        ["ownership"], ["billing"], cli_path=str(fake),
    ))
    assert hits == []


def test_package_operational_provider_returns_none_when_absent(monkeypatch):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
    import memory_status  # noqa: E402
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    monkeypatch.delenv(memory_status._CACHE_ENV, raising=False)
    assert memory_lookup.package_operational_provider() is None


def test_package_operational_provider_returns_callable_when_present(
    monkeypatch, tmp_path,
):
    import stat
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
    import memory_status  # noqa: E402
    fake = tmp_path / "memory"
    fake.write_text("#!/bin/sh\nexit 0\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    monkeypatch.setattr(memory_status, "_CACHE_FILE",
                        tmp_path / ".agent-memory" / "status.cache")
    monkeypatch.delenv(memory_status._CACHE_ENV, raising=False)
    provider = memory_lookup.package_operational_provider()
    assert provider is not None
    assert callable(provider)
