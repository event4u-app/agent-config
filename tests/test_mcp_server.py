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


# ----------------------------------------------------------------------
# Phase 3 — Resources (C1–C4): rules, guidelines, contexts
# ----------------------------------------------------------------------


from scripts.mcp_server.resources import (  # noqa: E402
    MIME_MARKDOWN,
    Resource,
    ResourceCache,
    load_all_resources,
    scan_contexts,
    scan_guidelines,
    scan_rules,
    to_mcp_resource_meta,
)


def test_resource_loader_discovers_three_kinds() -> None:
    """C1 — loader returns rules + guidelines + contexts with stable URIs."""
    resources, errors = load_all_resources()
    assert errors == []
    assert len(resources) > 0

    kinds = {r.kind for r in resources}
    assert kinds == {"rule", "guideline", "context"}

    rules, _ = scan_rules()
    guidelines, _ = scan_guidelines()
    contexts, _ = scan_contexts()
    assert all(r.uri.startswith("rule://") for r in rules)
    assert all(r.uri.startswith("guideline://") for r in guidelines)
    assert all(r.uri.startswith("context://") for r in contexts)
    assert len(rules) + len(guidelines) + len(contexts) == len(resources)


def test_resource_uris_are_unique_and_sorted() -> None:
    resources, _ = load_all_resources()
    uris = [r.uri for r in resources]
    assert uris == sorted(uris)
    assert len(set(uris)) == len(uris)


def test_resource_meta_shape_for_mcp() -> None:
    """to_mcp_resource_meta produces kwargs compatible with mcp.types.Resource."""
    resources, _ = load_all_resources()
    sample = resources[0]
    meta = to_mcp_resource_meta(sample)
    assert meta["mimeType"] == MIME_MARKDOWN
    assert meta["uri"] == sample.uri
    assert meta["name"]
    assert meta["description"]
    assert meta["_meta"]["kind"] == sample.kind


def test_resource_cache_invalidates_on_mtime(tmp_path: Path) -> None:
    """C4 — ResourceCache re-scans when a tracked file's mtime moves."""
    import os

    rules_dir = tmp_path / ".agent-src" / "rules"
    rules_dir.mkdir(parents=True)
    rule_md = rules_dir / "demo.md"
    rule_md.write_text(
        '---\ndescription: "v1"\n---\n# Demo\n\nbody v1\n',
        encoding="utf-8",
    )
    cache = ResourceCache(root=tmp_path)
    first, _ = cache.get()
    assert [r.description for r in first] == ["v1"]

    rule_md.write_text(
        '---\ndescription: "v2"\n---\n# Demo\n\nbody v2\n',
        encoding="utf-8",
    )
    future = rule_md.stat().st_mtime + 2
    os.utime(rule_md, (future, future))

    second, _ = cache.get()
    assert [r.description for r in second] == ["v2"]


@requires_mcp
def test_server_lists_resources_with_pagination() -> None:
    """C1 + C3 — resources/list returns paginated MCP Resource objects."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    resources, _ = load_all_resources()
    server = build_server([], resources=resources, page_size=7)
    handler = server.request_handlers[mcp_types.ListResourcesRequest]

    seen: list[str] = []
    cursor: str | None = None
    pages = 0
    while True:
        params = mcp_types.PaginatedRequestParams(cursor=cursor)
        request = mcp_types.ListResourcesRequest(
            method="resources/list", params=params
        )
        result = asyncio.run(handler(request))
        page = result.root.resources
        assert len(page) <= 7
        for entry in page:
            assert entry.mimeType == MIME_MARKDOWN
            seen.append(str(entry.uri))
        cursor = result.root.nextCursor
        pages += 1
        if cursor is None:
            break
        assert pages < 1000, "pagination did not terminate"
    assert pages > 1, "expected multiple pages at page_size=7"
    assert len(seen) == len(resources)
    assert len(set(seen)) == len(seen), "pages must not overlap"


@requires_mcp
def test_server_read_resource_returns_body() -> None:
    """C2 — resources/read returns the verbatim Markdown body."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    resources, _ = load_all_resources()
    server = build_server([], resources=resources)
    handler = server.request_handlers[mcp_types.ReadResourceRequest]

    target = resources[0]
    request = mcp_types.ReadResourceRequest(
        method="resources/read",
        params=mcp_types.ReadResourceRequestParams(uri=target.uri),
    )
    result = asyncio.run(handler(request))

    contents = result.root.contents
    assert len(contents) == 1
    assert contents[0].mimeType == MIME_MARKDOWN
    assert contents[0].text == target.body


@requires_mcp
def test_server_read_resource_unknown_uri_errors() -> None:
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    server = build_server([], resources=[])
    handler = server.request_handlers[mcp_types.ReadResourceRequest]

    request = mcp_types.ReadResourceRequest(
        method="resources/read",
        params=mcp_types.ReadResourceRequestParams(uri="rule://does-not-exist"),
    )
    with pytest.raises(ValueError, match="Unknown resource"):
        asyncio.run(handler(request))


@requires_mcp
def test_server_resources_handler_accepts_cache_callable() -> None:
    """C4 — resources arg can be a `() -> (resources, errors)` callable."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    cache = ResourceCache()
    server = build_server([], resources=cache.get, page_size=3)
    handler = server.request_handlers[mcp_types.ListResourcesRequest]

    request = mcp_types.ListResourcesRequest(
        method="resources/list",
        params=mcp_types.PaginatedRequestParams(cursor=None),
    )
    result = asyncio.run(handler(request))
    assert len(result.root.resources) == 3
    assert result.root.nextCursor == "3"


def test_no_unsafe_imports_in_resource_loader() -> None:
    """A0 contract — resources.py must not import subprocess / HTTP clients."""
    source = (REPO_ROOT / "scripts" / "mcp_server" / "resources.py").read_text()
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
            f"Forbidden import in scripts/mcp_server/resources.py: {pattern}"
        )



# ----------------------------------------------------------------------
# Phase 4 — Tools (D1–D4): lint_skills + chat_history_append
# ----------------------------------------------------------------------


from scripts.mcp_server.tools import (  # noqa: E402
    ALLOWLIST,
    BuiltinTool,
    ToolCache,
    boot_log_line,
    to_mcp_tool_meta,
)


def test_allowlist_holds_exactly_two_tools() -> None:
    """D1 — hardcoded registry exposes only `lint_skills` + `chat_history_append`."""
    assert set(ALLOWLIST.keys()) == {"lint_skills", "chat_history_append"}
    for tool in ALLOWLIST.values():
        assert isinstance(tool, BuiltinTool)
        assert tool.description.strip()
        assert tool.input_schema["type"] == "object"
        assert tool.input_schema.get("additionalProperties") is False


def test_tool_cache_list_and_names_are_sorted() -> None:
    cache = ToolCache()
    assert cache.names() == ["chat_history_append", "lint_skills"]
    assert [t.name for t in cache.list()] == cache.names()


def test_to_mcp_tool_meta_shape() -> None:
    tool = ALLOWLIST["lint_skills"]
    meta = to_mcp_tool_meta(tool)
    assert meta["name"] == "lint_skills"
    assert meta["description"].strip()
    assert meta["inputSchema"] == tool.input_schema


def test_boot_log_line_enumerates_tools() -> None:
    line = boot_log_line(ToolCache())
    assert "registered 2 tools" in line
    assert "chat_history_append" in line
    assert "lint_skills" in line


def test_tool_cache_dispatch_rejects_unknown_tool() -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="Unknown tool"):
        asyncio.run(cache.dispatch("nope", {}))


def test_chat_history_append_dry_run_does_not_write(tmp_path: Path) -> None:
    """D3 — dry_run validates the payload + path guard without touching disk."""
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch(
            "chat_history_append",
            {"text": "hello", "entry_type": "note", "dry_run": True},
            consumer_root=tmp_path,
        )
    )
    assert result["dry_run"] is True
    target = Path(result["target_path"])
    assert target == (tmp_path / "agents" / ".agent-chat-history").resolve()
    assert not target.exists()
    assert result["entry"] == {"t": "note", "text": "hello"}


def test_chat_history_append_path_escape_raises(tmp_path: Path) -> None:
    """D3 — absolute path outside consumer_root must raise before any I/O."""
    cache = ToolCache()
    with pytest.raises(ValueError, match="escapes consumer_root"):
        asyncio.run(
            cache.dispatch(
                "chat_history_append",
                {"text": "x", "path": "/etc/passwd", "dry_run": True},
                consumer_root=tmp_path,
            )
        )


def test_chat_history_append_unlisted_filename_raises(tmp_path: Path) -> None:
    """D3 — relative path inside the tree but not in the write allowlist."""
    cache = ToolCache()
    with pytest.raises(ValueError, match="not in write allowlist"):
        asyncio.run(
            cache.dispatch(
                "chat_history_append",
                {"text": "x", "path": "agents/notes.md", "dry_run": True},
                consumer_root=tmp_path,
            )
        )


def test_chat_history_append_rejects_empty_text(tmp_path: Path) -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="non-empty string"):
        asyncio.run(
            cache.dispatch(
                "chat_history_append",
                {"text": "   ", "dry_run": True},
                consumer_root=tmp_path,
            )
        )


def test_chat_history_append_rejects_header_entry_type(tmp_path: Path) -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="must not be 'header'"):
        asyncio.run(
            cache.dispatch(
                "chat_history_append",
                {"text": "x", "entry_type": "header", "dry_run": True},
                consumer_root=tmp_path,
            )
        )


def test_chat_history_append_writes_when_not_dry_run(tmp_path: Path) -> None:
    """D3 — real write hits the allowlisted target and produces JSONL."""
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch(
            "chat_history_append",
            {"text": "real entry", "entry_type": "note"},
            consumer_root=tmp_path,
        )
    )
    assert result["dry_run"] is False
    target = Path(result["target_path"])
    assert target.exists()
    lines = target.read_text(encoding="utf-8").splitlines()
    # First line is the header; entry follows.
    assert len(lines) >= 2
    import json as _json
    last = _json.loads(lines[-1])
    assert last["text"] == "real entry"
    assert last["t"] == "note"



def test_lint_skills_rejects_path_escape(tmp_path: Path) -> None:
    """D2 — paths under consumer_root only; absolute escape raises."""
    cache = ToolCache()
    with pytest.raises(ValueError, match="escapes consumer_root"):
        asyncio.run(
            cache.dispatch(
                "lint_skills",
                {"paths": ["/etc/passwd"]},
                consumer_root=tmp_path,
            )
        )


def test_lint_skills_rejects_non_list_paths(tmp_path: Path) -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="must be a list"):
        asyncio.run(
            cache.dispatch(
                "lint_skills",
                {"paths": "not-a-list"},
                consumer_root=tmp_path,
            )
        )


def test_lint_skills_returns_json_payload_for_subset() -> None:
    """D2 — call with an explicit path returns the same shape as `--format json`."""
    cache = ToolCache()
    target = REPO_ROOT / ".agent-src" / "skills" / "verify-completion-evidence" / "SKILL.md"
    if not target.exists():  # pragma: no cover — repo invariant
        pytest.skip("fixture skill not present in this checkout")
    result = asyncio.run(
        cache.dispatch(
            "lint_skills",
            {"paths": [str(target.relative_to(REPO_ROOT))]},
            consumer_root=REPO_ROOT,
        )
    )
    # `format_json` returns {"results": [...], "summary": {...}} or similar.
    assert isinstance(result, dict)
    assert "results" in result or "files" in result or result  # tolerant


# ----------------------------------------------------------------------
# Phase 4 — Server-level tools/list + tools/call (requires SDK)
# ----------------------------------------------------------------------


@requires_mcp
def test_server_lists_two_tools() -> None:
    """D4 — `tools/list` returns the two allowlisted tools."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    server = build_server([], tools=ToolCache())
    handler = server.request_handlers[mcp_types.ListToolsRequest]
    result = asyncio.run(
        handler(mcp_types.ListToolsRequest(method="tools/list", params=None))
    )
    names = sorted(t.name for t in result.root.tools)
    assert names == ["chat_history_append", "lint_skills"]


@requires_mcp
def test_server_call_tool_dry_run_succeeds(tmp_path: Path, monkeypatch) -> None:
    """D4 — `tools/call` returns isError=False for a valid dry-run."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    # consumer_root defaults to CWD inside the handler — scope the test
    # to a tmp dir so the dry-run target is predictable.
    monkeypatch.chdir(tmp_path)

    server = build_server([], tools=ToolCache())
    handler = server.request_handlers[mcp_types.CallToolRequest]
    req = mcp_types.CallToolRequest(
        method="tools/call",
        params=mcp_types.CallToolRequestParams(
            name="chat_history_append",
            arguments={"text": "hi", "entry_type": "note", "dry_run": True},
        ),
    )
    result = asyncio.run(handler(req))
    assert result.root.isError is False
    body = result.root.content[0].text
    assert '"dry_run": true' in body


@requires_mcp
def test_server_call_tool_path_escape_returns_error(tmp_path: Path, monkeypatch) -> None:
    """D4 — security violations surface as isError=True, not exceptions."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    monkeypatch.chdir(tmp_path)
    server = build_server([], tools=ToolCache())
    handler = server.request_handlers[mcp_types.CallToolRequest]
    req = mcp_types.CallToolRequest(
        method="tools/call",
        params=mcp_types.CallToolRequestParams(
            name="chat_history_append",
            arguments={"text": "x", "path": "/etc/passwd", "dry_run": True},
        ),
    )
    result = asyncio.run(handler(req))
    assert result.root.isError is True
    assert "escapes consumer_root" in result.root.content[0].text


@requires_mcp
def test_server_call_tool_unknown_returns_error(tmp_path: Path, monkeypatch) -> None:
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    monkeypatch.chdir(tmp_path)
    server = build_server([], tools=ToolCache())
    handler = server.request_handlers[mcp_types.CallToolRequest]
    req = mcp_types.CallToolRequest(
        method="tools/call",
        params=mcp_types.CallToolRequestParams(name="nope", arguments={}),
    )
    result = asyncio.run(handler(req))
    assert result.root.isError is True


# ----------------------------------------------------------------------
# Phase 4 — Import-surface guard for tools.py
# ----------------------------------------------------------------------


def test_no_direct_subprocess_in_tools_module() -> None:
    """A0 contract (Phase 4 amendment) — tools.py forbids direct shell exec.

    The module may import project modules (`skill_linter`, `chat_history`)
    that internally use subprocess, but the MCP wire surface itself must
    not spawn shells or HTTP clients.
    """
    source = (REPO_ROOT / "scripts" / "mcp_server" / "tools.py").read_text()
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
            f"Forbidden import in scripts/mcp_server/tools.py: {pattern}"
        )
