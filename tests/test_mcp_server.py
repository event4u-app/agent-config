"""Phase 1 contract tests for `scripts/mcp_server/`.

Two layers:

1. **Loader layer** (`prompts.py`) — pure stdlib, runs under any Python
   that satisfies the project's >=3.10 minimum. No `mcp` SDK needed.
2. **Server layer** (`server.py`) — `mcp` SDK required. Skipped via
   `pytest.importorskip` when the SDK is absent (CI installs only
   `pytest pytest-xdist pyyaml` per `.github/workflows/tests.yml`).

The import-surface assertion (`test_no_unsafe_imports_in_loader`)
enforces the A0 contract documented in
`docs/contracts/mcp-phase-1-scope.md` — the loader must not pull
`subprocess`, `os.system`, or any HTTP client.
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path

import pytest

from scripts.mcp_server.prompts import (
    PHASE_1_SKILLS,
    PromptCache,
    SkillPrompt,
    load_all_prompts,
    load_phase_1_prompts,
    load_skill,
    scan_commands,
    scan_skills,
    to_mcp_prompt_meta,
)


REPO_ROOT = Path(__file__).resolve().parent.parent


# ----------------------------------------------------------------------
# Loader layer — Phase 1 A4
# ----------------------------------------------------------------------


def test_phase_1_skills_constant_is_5() -> None:
    """Roadmap A4 hand-picks exactly five stack-agnostic skills."""
    assert len(PHASE_1_SKILLS) == 5
    assert len(set(PHASE_1_SKILLS)) == 5  # no duplicates


def test_load_phase_1_prompts_returns_5_entries() -> None:
    prompts = load_phase_1_prompts()
    assert len(prompts) == 5
    names = {p.name for p in prompts}
    assert names == set(PHASE_1_SKILLS)


def test_each_prompt_has_non_empty_body_and_description() -> None:
    for prompt in load_phase_1_prompts():
        assert prompt.description.strip(), f"empty description: {prompt.name}"
        assert prompt.body.strip(), f"empty body: {prompt.name}"
        # Frontmatter must be stripped — body may not start with ---
        assert not prompt.body.startswith("---\n")


def test_load_skill_strips_frontmatter() -> None:
    prompt = load_skill("verify-completion-evidence")
    assert prompt.name == "verify-completion-evidence"
    assert "name:" not in prompt.body.split("\n")[0]
    assert "stability:" not in prompt.body.split("\n")[0]
    assert prompt.source in {"package", "project"}


def test_load_skill_missing_raises() -> None:
    with pytest.raises(FileNotFoundError):
        load_skill("definitely-not-a-skill-12345")


def test_to_mcp_prompt_meta_shape_for_skill() -> None:
    prompt = SkillPrompt(
        name="example",
        description="desc",
        body="body",
        source="package",
        kind="skill",
    )
    meta = to_mcp_prompt_meta(prompt)
    assert meta["name"] == "skill.example"
    assert meta["title"] == "example"
    assert meta["description"] == "desc"
    assert meta["arguments"] == []
    assert meta["_meta"] == {"source": "package", "kind": "skill"}


def test_to_mcp_prompt_meta_shape_for_command() -> None:
    """Command names use `:` in frontmatter; wire form converts to `.`."""
    prompt = SkillPrompt(
        name="research:report",
        description="desc",
        body="body",
        source="package",
        kind="command",
    )
    meta = to_mcp_prompt_meta(prompt)
    assert meta["name"] == "command.research.report"
    assert meta["title"] == "research:report"
    assert meta["_meta"] == {"source": "package", "kind": "command"}


# ----------------------------------------------------------------------
# Phase 2 — scan_skills, scan_commands, load_all_prompts, PromptCache
# ----------------------------------------------------------------------


def test_scan_skills_finds_all_skill_md() -> None:
    prompts, errors = scan_skills()
    assert errors == [], f"unexpected loader errors: {errors}"
    assert len(prompts) > 100, "expected >100 skills under .agent-src/skills/"
    for prompt in prompts:
        assert prompt.kind == "skill"
        assert prompt.description.strip()
        assert prompt.body.strip()


def test_scan_commands_finds_nested_commands() -> None:
    prompts, errors = scan_commands()
    assert errors == [], f"unexpected loader errors: {errors}"
    assert len(prompts) > 50, "expected >50 commands under .agent-src/commands/"
    names = {p.name for p in prompts}
    # Nested commands keep the `cluster:sub` shape from frontmatter.
    assert any(":" in n for n in names), "expected at least one nested command"
    for prompt in prompts:
        assert prompt.kind == "command"


def test_load_all_prompts_returns_sorted_unique() -> None:
    prompts, _errors = load_all_prompts()
    wire_names = [to_mcp_prompt_meta(p)["name"] for p in prompts]
    assert wire_names == sorted(wire_names), "prompts must be sorted by wire name"
    assert len(wire_names) == len(set(wire_names)), "wire names must be unique"


def test_load_all_prompts_skips_malformed(tmp_path: Path) -> None:
    """B3 — malformed frontmatter is logged, not fatal."""
    skills = tmp_path / ".agent-src" / "skills"
    good = skills / "good-skill"
    good.mkdir(parents=True)
    (good / "SKILL.md").write_text(
        '---\nname: good-skill\ndescription: "OK"\n---\nbody\n',
        encoding="utf-8",
    )
    bad = skills / "no-description"
    bad.mkdir(parents=True)
    (bad / "SKILL.md").write_text(
        "---\nname: no-description\n---\nbody\n",
        encoding="utf-8",
    )
    prompts, errors = load_all_prompts(root=tmp_path)
    assert [p.name for p in prompts] == ["good-skill"]
    assert any("missing frontmatter description" in e for e in errors)


def test_prompt_cache_hot_reloads_on_mtime_change(tmp_path: Path) -> None:
    """B5 — PromptCache re-scans when SKILL.md mtime changes."""
    skill_dir = tmp_path / ".agent-src" / "skills" / "demo"
    skill_dir.mkdir(parents=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(
        '---\nname: demo\ndescription: "v1"\n---\nbody-v1\n',
        encoding="utf-8",
    )
    cache = PromptCache(root=tmp_path)
    prompts1, _ = cache.get()
    assert prompts1[0].description == "v1"

    # Bump mtime forward (filesystems on macOS / Linux have ≥1s resolution).
    skill_md.write_text(
        '---\nname: demo\ndescription: "v2"\n---\nbody-v2\n',
        encoding="utf-8",
    )
    import os
    future = skill_md.stat().st_mtime + 2
    os.utime(skill_md, (future, future))

    prompts2, _ = cache.get()
    assert prompts2[0].description == "v2"


def test_prompt_cache_lookup_uses_wire_name(tmp_path: Path) -> None:
    skill_dir = tmp_path / ".agent-src" / "skills" / "demo"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        '---\nname: demo\ndescription: "desc"\n---\nbody\n',
        encoding="utf-8",
    )
    cache = PromptCache(root=tmp_path)
    assert cache.lookup("skill.demo") is not None
    assert cache.lookup("skill.missing") is None


# ----------------------------------------------------------------------
# Import-surface guard — A0 contract enforcement
# ----------------------------------------------------------------------


def test_no_unsafe_imports_in_loader() -> None:
    """`prompts.py` must not import subprocess / os.system / http clients.

    Phase 1 is read-only. A regression that pulls these modules triggers
    a CHANGELOG note before merge per the `experimental` stability bar.
    """
    source = (REPO_ROOT / "scripts" / "mcp_server" / "prompts.py").read_text()
    forbidden = [
        r"\bimport\s+subprocess\b",
        r"\bfrom\s+subprocess\b",
        r"\bos\.system\b",
        r"\bos\.popen\b",
        r"\bimport\s+requests\b",
        r"\bimport\s+httpx\b",
        r"\bimport\s+urllib\.request\b",
    ]
    for pattern in forbidden:
        assert not re.search(pattern, source), (
            f"Forbidden import in scripts/mcp_server/prompts.py: {pattern}"
        )


# ----------------------------------------------------------------------
# Server layer — requires the `mcp` SDK
# ----------------------------------------------------------------------
#
# Module-level `importorskip` would skip the loader tests above when the
# SDK is missing (CI installs only pytest + pytest-xdist + pyyaml per
# `.github/workflows/tests.yml`). Use a per-test fixture instead so the
# loader layer always runs.

try:  # pragma: no cover — import-time gate
    import mcp as _mcp  # noqa: F401
    import mcp.types as _mcp_types  # noqa: F401

    _MCP_AVAILABLE = True
except ImportError:
    _MCP_AVAILABLE = False

requires_mcp = pytest.mark.skipif(
    not _MCP_AVAILABLE, reason="mcp SDK not installed"
)


def _build_server_with_fixtures():
    from scripts.mcp_server.server import build_server

    prompts = load_phase_1_prompts()
    return build_server(prompts), prompts


@requires_mcp
def test_server_lists_5_prompts_with_skill_prefix() -> None:
    import mcp.types as mcp_types

    server, prompts = _build_server_with_fixtures()
    handler = server.request_handlers[mcp_types.ListPromptsRequest]

    request = mcp_types.ListPromptsRequest(method="prompts/list", params=None)
    result = asyncio.run(handler(request))

    listed = result.root.prompts
    assert len(listed) == len(prompts)
    for prompt in listed:
        assert prompt.name.startswith("skill.")
        assert prompt.description


@requires_mcp
def test_server_get_prompt_returns_skill_body() -> None:
    import mcp.types as mcp_types

    server, prompts = _build_server_with_fixtures()
    handler = server.request_handlers[mcp_types.GetPromptRequest]

    target = prompts[0]
    request = mcp_types.GetPromptRequest(
        method="prompts/get",
        params=mcp_types.GetPromptRequestParams(
            name=f"skill.{target.name}",
            arguments=None,
        ),
    )
    result = asyncio.run(handler(request))

    messages = result.root.messages
    assert len(messages) == 1
    assert messages[0].role == "user"
    text = messages[0].content.text
    assert text.strip()
    # Body matches the loader output verbatim (no client-side transforms).
    assert text == target.body


@requires_mcp
def test_server_get_prompt_unknown_name_errors() -> None:
    import mcp.types as mcp_types

    server, _ = _build_server_with_fixtures()
    handler = server.request_handlers[mcp_types.GetPromptRequest]

    request = mcp_types.GetPromptRequest(
        method="prompts/get",
        params=mcp_types.GetPromptRequestParams(
            name="skill.does-not-exist",
            arguments=None,
        ),
    )
    # Server contract: unknown name surfaces a JSON-RPC error. The
    # low-level Server forwards the handler's ValueError to the SDK
    # transport, which wraps it as -32603 over the wire. At the
    # in-process handler boundary we observe the bare exception.
    with pytest.raises(ValueError, match="Unknown prompt"):
        asyncio.run(handler(request))


# ----------------------------------------------------------------------
# Phase 2 — full-coverage server, pagination (B4), cache-backed loader (B5)
# ----------------------------------------------------------------------


@requires_mcp
def test_server_lists_all_prompts_skill_and_command() -> None:
    """B1/B2 — full-coverage list includes both skills and commands."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    prompts, _ = load_all_prompts()
    server = build_server(prompts, page_size=10_000)
    handler = server.request_handlers[mcp_types.ListPromptsRequest]

    request = mcp_types.ListPromptsRequest(method="prompts/list", params=None)
    result = asyncio.run(handler(request))

    names = [p.name for p in result.root.prompts]
    assert any(n.startswith("skill.") for n in names)
    assert any(n.startswith("command.") for n in names)
    assert len(names) == len(prompts)


@requires_mcp
def test_server_list_prompts_paginates_with_cursor() -> None:
    """B4 — cursor-based pagination returns nextCursor on the wire."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    prompts, _ = load_all_prompts()
    server = build_server(prompts, page_size=5)
    handler = server.request_handlers[mcp_types.ListPromptsRequest]

    seen: list[str] = []
    cursor: str | None = None
    pages = 0
    while True:
        params = mcp_types.PaginatedRequestParams(cursor=cursor)
        request = mcp_types.ListPromptsRequest(
            method="prompts/list", params=params
        )
        result = asyncio.run(handler(request))
        page = result.root.prompts
        assert len(page) <= 5
        seen.extend(p.name for p in page)
        cursor = result.root.nextCursor
        pages += 1
        if cursor is None:
            break
        assert pages < 1000, "pagination did not terminate"
    assert pages > 1, "expected multiple pages at page_size=5"
    assert len(seen) == len(prompts)
    assert len(set(seen)) == len(seen), "pages must not overlap"


@requires_mcp
def test_server_accepts_loader_callable_for_hot_reload(tmp_path: Path) -> None:
    """build_server accepts a `() -> (prompts, errors)` callable (B5 hook)."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    skill_dir = tmp_path / ".agent-src" / "skills" / "demo"
    skill_dir.mkdir(parents=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(
        '---\nname: demo\ndescription: "v1"\n---\nbody-v1\n',
        encoding="utf-8",
    )
    cache = PromptCache(root=tmp_path)
    server = build_server(cache.get, page_size=100)
    handler = server.request_handlers[mcp_types.ListPromptsRequest]

    request = mcp_types.ListPromptsRequest(method="prompts/list", params=None)
    result1 = asyncio.run(handler(request))
    descriptions1 = [p.description for p in result1.root.prompts]
    assert descriptions1 == ["v1"]

    skill_md.write_text(
        '---\nname: demo\ndescription: "v2"\n---\nbody-v2\n',
        encoding="utf-8",
    )
    import os
    future = skill_md.stat().st_mtime + 2
    os.utime(skill_md, (future, future))

    result2 = asyncio.run(handler(request))
    descriptions2 = [p.description for p in result2.root.prompts]
    assert descriptions2 == ["v2"]
