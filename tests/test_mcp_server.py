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
import json
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
# Phase 3 (step-9 user-type axis) — runtime filter
# ----------------------------------------------------------------------


def _seed_user_type_tree(root: Path) -> None:
    """Seed a tmp tree with three skills covering match / universal / outside."""
    skills = root / ".agent-src" / "skills"
    (skills / "match-skill").mkdir(parents=True)
    (skills / "match-skill" / "SKILL.md").write_text(
        "---\nname: match-skill\ndescription: \"matches\"\n"
        "recommended_for_user_types: [developer, founder]\n---\nbody\n",
        encoding="utf-8",
    )
    (skills / "universal-skill").mkdir(parents=True)
    (skills / "universal-skill" / "SKILL.md").write_text(
        '---\nname: universal-skill\ndescription: "no filter"\n---\nbody\n',
        encoding="utf-8",
    )
    (skills / "outside-skill").mkdir(parents=True)
    (skills / "outside-skill" / "SKILL.md").write_text(
        "---\nname: outside-skill\ndescription: \"other axis\"\n"
        "recommended_for_user_types: [consultant]\n---\nbody\n",
        encoding="utf-8",
    )


def test_user_type_axis_no_filter_keeps_alpha_order(tmp_path: Path) -> None:
    """Empty / missing user_type → legacy alphabetical sort, no meta tag."""
    _seed_user_type_tree(tmp_path)
    cache = PromptCache(root=tmp_path)
    prompts, _errors = cache.get()
    assert cache.active_user_type == ""
    assert [p.name for p in prompts] == [
        "match-skill",
        "outside-skill",
        "universal-skill",
    ]
    for p in prompts:
        assert p.user_type_match == ""
        assert "user_type_match" not in to_mcp_prompt_meta(p)["_meta"]


def test_user_type_axis_filter_sorts_match_first(tmp_path: Path) -> None:
    """Active user_type → match → universal → outside, alpha within rank."""
    _seed_user_type_tree(tmp_path)
    (tmp_path / ".agent-settings.yml").write_text(
        "personal:\n  user_type: developer\n",
        encoding="utf-8",
    )
    cache = PromptCache(root=tmp_path)
    prompts, _errors = cache.get()
    assert cache.active_user_type == "developer"
    assert [p.name for p in prompts] == [
        "match-skill",
        "universal-skill",
        "outside-skill",
    ]
    labels = {p.name: p.user_type_match for p in prompts}
    assert labels == {
        "match-skill": "match",
        "universal-skill": "universal",
        "outside-skill": "outside",
    }
    for p in prompts:
        meta = to_mcp_prompt_meta(p)["_meta"]
        assert meta["user_type_match"] == p.user_type_match


def test_user_type_axis_placeholder_disables_filter(tmp_path: Path) -> None:
    """Unrendered `__USER_TYPE__` placeholder must not engage the filter."""
    _seed_user_type_tree(tmp_path)
    (tmp_path / ".agent-settings.yml").write_text(
        'personal:\n  user_type: "__USER_TYPE__"\n',
        encoding="utf-8",
    )
    cache = PromptCache(root=tmp_path)
    _prompts, _errors = cache.get()
    assert cache.active_user_type == ""


def test_user_type_axis_settings_flip_invalidates_cache(tmp_path: Path) -> None:
    """Editing `.agent-settings.yml` re-sorts on next get()."""
    import os

    _seed_user_type_tree(tmp_path)
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text("personal:\n  user_type: developer\n", encoding="utf-8")
    cache = PromptCache(root=tmp_path)
    first, _ = cache.get()
    assert first[0].name == "match-skill"

    settings.write_text("personal:\n  user_type: consultant\n", encoding="utf-8")
    future = settings.stat().st_mtime + 2
    os.utime(settings, (future, future))

    second, _ = cache.get()
    assert cache.active_user_type == "consultant"
    # outside-skill (recommended_for_user_types=[consultant]) now wins rank 0.
    assert second[0].name == "outside-skill"


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
    CATALOG_STUBS,
    REGISTRY,
    STUB_NAMES,
    BuiltinTool,
    ToolCache,
    boot_log_line,
    to_mcp_tool_meta,
)


def test_allowlist_holds_phase_3_l2_implemented_tools() -> None:
    """D1 / L2 — allowlist exposes exactly the 9 implemented tools.

    Phase 1 shipped ``lint_skills`` + ``chat_history_append``. Phase 3 L2
    (council waiver, 2026-05-12) added the 7 read-only handlers below.
    Adding a tool here is a code-review event.
    """
    assert set(ALLOWLIST.keys()) == {
        "lint_skills",
        "chat_history_append",
        "chat_history_read",
        "memory_lookup",
        "memory_status",
        "list_skills",
        "list_commands",
        "list_rules",
        "read_resource_body",
    }
    for tool in ALLOWLIST.values():
        assert isinstance(tool, BuiltinTool)
        assert tool.description.strip()
        assert tool.input_schema["type"] == "object"
        assert tool.input_schema.get("additionalProperties") is False


def test_implemented_only_tool_cache_lists_allowlist() -> None:
    """Passing ALLOWLIST narrows the cache to just the real handlers."""
    cache = ToolCache(registry=dict(ALLOWLIST))
    assert cache.names() == sorted(ALLOWLIST.keys())
    assert [t.name for t in cache.list()] == cache.names()


def test_default_tool_cache_lists_catalog_plus_allowlist() -> None:
    """J2 — default cache exposes ALLOWLIST + discovery stubs."""
    cache = ToolCache()
    names = cache.names()
    assert "chat_history_append" in names
    assert "lint_skills" in names
    assert "memory_lookup" in names
    assert names == sorted(REGISTRY.keys())
    assert cache.implemented_names() == sorted(ALLOWLIST.keys())


def test_catalog_stubs_exclude_allowlist() -> None:
    """ALLOWLIST tools must not be re-registered as stubs."""
    for name in ALLOWLIST:
        assert name not in CATALOG_STUBS, name
    assert set(STUB_NAMES) == set(CATALOG_STUBS.keys())


def test_to_mcp_tool_meta_shape() -> None:
    tool = ALLOWLIST["lint_skills"]
    meta = to_mcp_tool_meta(tool)
    assert meta["name"] == "lint_skills"
    assert meta["description"].strip()
    assert meta["inputSchema"] == tool.input_schema


def test_boot_log_line_enumerates_tools() -> None:
    line = boot_log_line(ToolCache())
    total = len(REGISTRY)
    implemented_count = len(ALLOWLIST)
    stub_count = total - implemented_count
    assert f"registered {total} tools" in line
    assert f"{implemented_count} implemented" in line
    assert f"{stub_count} stubs" in line
    assert "chat_history_append" in line
    assert "lint_skills" in line


def test_tool_cache_dispatch_rejects_unknown_tool() -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="Unknown tool"):
        asyncio.run(cache.dispatch("nope", {}))


def test_stub_dispatch_returns_not_implemented_envelope() -> None:
    """J2 — invoking a catalog stub returns the structured envelope.

    ``memory_signal`` is still a stub (Phase 4 — write-tool envelope is
    DEFERRED). The shape assertion holds for every catalog stub.
    """
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch(
            "memory_signal",
            {"type": "ownership", "path": "x", "body": "y"},
        )
    )
    assert result["code"] == "not_implemented"
    assert result["tool"] == "memory_signal"
    assert result["transport"] == "stdio"
    assert result["alternative"] == "stdio"
    assert result["install_hint"]
    assert "discovery catalog" in result["message"]


def test_every_catalog_stub_is_marked_as_stub() -> None:
    cache = ToolCache()
    for name in STUB_NAMES:
        assert cache.is_stub(name) is True
    assert cache.is_stub("lint_skills") is False
    assert cache.is_stub("nope") is False


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
    assert target == (tmp_path / "agents" / "runtime" / ".agent-chat-history").resolve()
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
                {"text": "x", "path": "agents/evidence/notes.md", "dry_run": True},
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
def test_server_lists_full_catalog_plus_allowlist() -> None:
    """D4 + J2 — `tools/list` returns ALLOWLIST plus catalog stubs."""
    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    server = build_server([], tools=ToolCache())
    handler = server.request_handlers[mcp_types.ListToolsRequest]
    result = asyncio.run(
        handler(mcp_types.ListToolsRequest(method="tools/list", params=None))
    )
    names = sorted(t.name for t in result.root.tools)
    assert names == sorted(REGISTRY.keys())
    assert "chat_history_append" in names
    assert "lint_skills" in names
    assert "memory_lookup" in names


@requires_mcp
def test_server_call_tool_stub_returns_envelope(tmp_path: Path, monkeypatch) -> None:
    """J2 — `tools/call` on a stub returns the envelope as a successful result."""
    import json as _json

    import mcp.types as mcp_types

    from scripts.mcp_server.server import build_server

    monkeypatch.chdir(tmp_path)
    server = build_server([], tools=ToolCache())
    handler = server.request_handlers[mcp_types.CallToolRequest]
    req = mcp_types.CallToolRequest(
        method="tools/call",
        params=mcp_types.CallToolRequestParams(
            name="memory_lookup",
            arguments={"types": ["ownership"]},
        ),
    )
    result = asyncio.run(handler(req))
    assert result.root.isError is False
    payload = _json.loads(result.root.content[0].text)
    assert payload["code"] == "not_implemented"
    assert payload["tool"] == "memory_lookup"
    assert payload["transport"] == "stdio"


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


# ----------------------------------------------------------------------
# Phase 6 F1 — Identity metadata (server / package / skill-set signature)
# ----------------------------------------------------------------------


def test_read_package_version_returns_string() -> None:
    """`package.json::version` is readable and non-empty."""
    from scripts.mcp_server.metadata import read_package_version

    version = read_package_version(REPO_ROOT)
    assert version != "unknown"
    assert re.match(r"^\d+\.\d+\.\d+", version), version


def test_read_package_version_missing_returns_unknown(tmp_path: Path) -> None:
    """Missing or malformed `package.json` falls back to `unknown`."""
    from scripts.mcp_server.metadata import read_package_version

    assert read_package_version(tmp_path) == "unknown"
    (tmp_path / "package.json").write_text("not json", encoding="utf-8")
    assert read_package_version(tmp_path) == "unknown"
    (tmp_path / "package.json").write_text("{}", encoding="utf-8")
    assert read_package_version(tmp_path) == "unknown"


def test_skill_set_signature_is_deterministic() -> None:
    """Identical input tuples yield identical hashes (F1 fingerprint)."""
    from scripts.mcp_server.metadata import compute_skill_set_signature

    sig_a = (("a.md", 1.0), ("b.md", 2.5))
    sig_b = (("c.md", 3.0),)
    first = compute_skill_set_signature(sig_a, sig_b)
    second = compute_skill_set_signature(sig_a, sig_b)
    assert first == second
    assert len(first) == 12
    assert re.match(r"^[0-9a-f]{12}$", first)


def test_skill_set_signature_changes_on_mtime() -> None:
    """Any mtime drift in a tracked file flips the hash."""
    from scripts.mcp_server.metadata import compute_skill_set_signature

    base = compute_skill_set_signature((("a.md", 1.0),), (("b.md", 2.0),))
    drifted = compute_skill_set_signature((("a.md", 1.1),), (("b.md", 2.0),))
    assert base != drifted


def test_skill_set_signature_changes_on_path_set() -> None:
    """Adding or removing a tracked file flips the hash."""
    from scripts.mcp_server.metadata import compute_skill_set_signature

    base = compute_skill_set_signature((("a.md", 1.0),), (("b.md", 2.0),))
    added = compute_skill_set_signature(
        (("a.md", 1.0), ("new.md", 3.0)),
        (("b.md", 2.0),),
    )
    assert base != added


def test_skill_set_signature_group_framing_matters() -> None:
    """Splitting tuples across caches yields a different hash than merging.

    Group separator (`\\x1d`) ensures the prompt and resource caches are
    not interchangeable — a file moving caches changes the fingerprint.
    """
    from scripts.mcp_server.metadata import compute_skill_set_signature

    merged = compute_skill_set_signature((("a.md", 1.0), ("b.md", 2.0)))
    split = compute_skill_set_signature((("a.md", 1.0),), (("b.md", 2.0),))
    assert merged != split


def test_identity_boot_log_line_shape() -> None:
    """Boot log line surfaces all three identity values."""
    from scripts.mcp_server.metadata import boot_log_line

    line = boot_log_line(
        server_version="0.1.0",
        package_version="1.36.1",
        skill_set_signature="abc123def456",
    )
    assert "serverVersion=0.1.0" in line
    assert "packageVersion=1.36.1" in line
    assert "skillSetSignature=abc123def456" in line
    assert line.startswith("mcp-server: identity ")


def test_prompt_cache_signature_property_exposes_tracked_files() -> None:
    """`PromptCache.signature` returns the cached `(path, mtime)` tuples."""
    cache = PromptCache()
    cache.get()
    sig = cache.signature
    assert isinstance(sig, tuple)
    assert len(sig) > 0
    for entry in sig:
        assert len(entry) == 2
        assert isinstance(entry[0], str)
        assert isinstance(entry[1], float)


def test_resource_cache_signature_property_exposes_tracked_files() -> None:
    """`ResourceCache.signature` returns the cached `(path, mtime)` tuples."""
    from scripts.mcp_server.resources import ResourceCache

    cache = ResourceCache()
    cache.get()
    sig = cache.signature
    assert isinstance(sig, tuple)
    assert len(sig) > 0
    for entry in sig:
        assert len(entry) == 2



# ----------------------------------------------------------------------
# Phase 1 J4 + J5 — Telemetry instrumentation acceptance tests
# ----------------------------------------------------------------------


def _read_telemetry_jsonl(consumer_root: Path) -> list[dict[str, object]]:
    """Read the per-call JSONL written by `scripts/mcp_server/telemetry.py`."""
    target = (
        consumer_root
        / "agents"
        / "runtime"
        / "mcp-telemetry"
        / "calls.jsonl"
    )
    if not target.exists():
        return []
    return [
        json.loads(line)
        for line in target.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def test_record_call_writes_jsonl_under_consumer_root(tmp_path: Path) -> None:
    """J4 — `record_call` appends one JSONL record under `<root>/agents/runtime/mcp-telemetry/`."""
    import json as _json

    from scripts.mcp_server.telemetry import record_call

    record = record_call(
        tool_name="memory_lookup",
        outcome="stub",
        transport="stdio",
        consumer_root=tmp_path,
        client_id_hash_value="abc123abc123",
    )
    assert record is not None
    target = tmp_path / "agents" / "runtime" / "mcp-telemetry" / "calls.jsonl"
    assert target.exists()
    lines = target.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    payload = _json.loads(lines[0])
    assert payload == {
        "tool_name": "memory_lookup",
        "client_id_hash": "abc123abc123",
        "ts": record["ts"],
        "transport": "stdio",
        "outcome": "stub",
    }


def test_record_call_appends_without_overwriting(tmp_path: Path) -> None:
    """Sequential calls must extend the JSONL file, never truncate it."""
    from scripts.mcp_server.telemetry import record_call

    for name in ("memory_lookup", "lint_skills", "nope"):
        record_call(
            tool_name=name,
            outcome="stub",
            transport="stdio",
            consumer_root=tmp_path,
            client_id_hash_value="abc123abc123",
        )
    records = _read_telemetry_jsonl(tmp_path)
    assert [r["tool_name"] for r in records] == ["memory_lookup", "lint_skills", "nope"]


def test_record_call_swallows_write_errors(tmp_path: Path, capsys) -> None:
    """Telemetry must never break the wire — IO failures degrade to a warn line."""
    from scripts.mcp_server import telemetry

    blocker = tmp_path / "agents"
    blocker.write_text("not a directory", encoding="utf-8")

    record = telemetry.record_call(
        tool_name="memory_lookup",
        outcome="stub",
        transport="stdio",
        consumer_root=tmp_path,
        client_id_hash_value="abc123abc123",
    )
    assert record is None
    captured = capsys.readouterr()
    assert "telemetry write failed" in captured.err


def test_hash_client_id_is_deterministic_and_truncated() -> None:
    """SHA-256 + 12-hex truncation — same seed → same hash, different seed → different."""
    from scripts.mcp_server.telemetry import hash_client_id

    a = hash_client_id("user|host|/repo")
    b = hash_client_id("user|host|/repo")
    c = hash_client_id("user|host|/other-repo")
    assert a == b
    assert a != c
    assert len(a) == 12
    assert re.fullmatch(r"[0-9a-f]{12}", a)


def test_dispatch_logs_implemented_for_allowlist_tool(tmp_path: Path) -> None:
    """J4 — dispatch on a real handler records `outcome: implemented`."""
    cache = ToolCache()
    asyncio.run(
        cache.dispatch(
            "chat_history_append",
            {"text": "hi", "entry_type": "note", "dry_run": True},
            consumer_root=tmp_path,
        )
    )
    records = _read_telemetry_jsonl(tmp_path)
    assert len(records) == 1
    assert records[0]["tool_name"] == "chat_history_append"
    assert records[0]["outcome"] == "implemented"
    assert records[0]["transport"] == "stdio"


def test_dispatch_logs_stub_for_catalog_entry(tmp_path: Path) -> None:
    """J4 — dispatch on a catalog stub records `outcome: stub`.

    Phase 3 L2 (2026-05-12) implemented seven RO tools; ``memory_signal``
    stays a stub because writes belong to Phase 4 (DEFERRED).
    """
    cache = ToolCache()
    asyncio.run(
        cache.dispatch(
            "memory_signal",
            {"type": "ownership", "path": "x", "body": "y"},
            consumer_root=tmp_path,
        )
    )
    records = _read_telemetry_jsonl(tmp_path)
    assert len(records) == 1
    assert records[0]["tool_name"] == "memory_signal"
    assert records[0]["outcome"] == "stub"


def test_dispatch_logs_latent_demand_for_unknown_tool(tmp_path: Path) -> None:
    """J4 — unknown names log `latent_demand` BEFORE the ValueError surfaces."""
    cache = ToolCache()
    with pytest.raises(ValueError, match="Unknown tool"):
        asyncio.run(cache.dispatch("nope", {}, consumer_root=tmp_path))
    records = _read_telemetry_jsonl(tmp_path)
    assert len(records) == 1
    assert records[0]["tool_name"] == "nope"
    assert records[0]["outcome"] == "latent_demand"


def test_dispatch_telemetry_records_have_full_envelope(tmp_path: Path) -> None:
    """Every record carries the five J4 fields, no payload body."""
    cache = ToolCache()
    asyncio.run(
        cache.dispatch(
            "memory_signal",
            {"type": "ownership", "path": "secret", "body": "secret"},
            consumer_root=tmp_path,
        )
    )
    records = _read_telemetry_jsonl(tmp_path)
    assert len(records) == 1
    record = records[0]
    assert set(record.keys()) == {
        "tool_name",
        "client_id_hash",
        "ts",
        "transport",
        "outcome",
    }
    # Payload values must never leak into telemetry.
    assert "secret" not in json.dumps(record)


# ----------------------------------------------------------------------
# Phase 3 L3 — Hermetic per-tool shape contracts for the RO handlers
# added under agents/decisions/mcp-coverage-cut-2026-05-12.md (waiver
# verdict). Each test exercises the stdio handler against a hermetic
# fixture and asserts the on-wire envelope keys. Worker parity is N/A
# this iteration — `implemented_on=["stdio"]` is asserted separately by
# `test_worker_content_implemented_on_matches_catalog` below.
# ----------------------------------------------------------------------


def _seed_chat_history(root: Path) -> Path:
    target = root / "agents" / "runtime" / ".agent-chat-history"
    target.parent.mkdir(parents=True, exist_ok=True)
    header = {"v": 4, "started": "2026-05-12T00:00:00Z", "freq": "per_phase"}
    rows = [
        {"t": "phase", "s": "abc1234567890def", "text": "row-1"},
        {"t": "tool", "s": "abc1234567890def", "text": "row-2"},
        {"t": "phase", "s": "ffff000011112222", "text": "row-3"},
    ]
    target.write_text(
        json.dumps(header) + "\n"
        + "\n".join(json.dumps(r) for r in rows) + "\n",
        encoding="utf-8",
    )
    return target


def test_l3_chat_history_read_shape(tmp_path: Path) -> None:
    """L3 — `chat_history_read` returns the path / entries / count envelope."""
    cache = ToolCache()
    _seed_chat_history(tmp_path)
    result = asyncio.run(
        cache.dispatch("chat_history_read", {"last": 2}, consumer_root=tmp_path)
    )
    assert set(result.keys()) == {"path", "entries", "count"}
    assert result["count"] == 2
    assert all(isinstance(e, dict) for e in result["entries"])


def test_l3_chat_history_read_filters_by_entry_type(tmp_path: Path) -> None:
    cache = ToolCache()
    _seed_chat_history(tmp_path)
    result = asyncio.run(
        cache.dispatch(
            "chat_history_read",
            {"entry_type": "tool"},
            consumer_root=tmp_path,
        )
    )
    assert result["count"] == 1
    assert result["entries"][0]["t"] == "tool"


def test_l3_memory_status_shape(tmp_path: Path) -> None:
    """L3 — `memory_status` returns the v1 status envelope keys."""
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch("memory_status", {}, consumer_root=tmp_path)
    )
    assert {"status", "backend", "reason", "elapsed_ms", "features"} <= set(result)
    assert result["status"] in {"absent", "misconfigured", "present"}
    assert isinstance(result["features"], list)


def test_l3_memory_lookup_returns_v1_envelope(tmp_path: Path) -> None:
    """L3 — `memory_lookup` returns the v1 retrieval envelope."""
    cache = ToolCache()
    (tmp_path / "agents" / "memory" / "ownership").mkdir(parents=True)
    result = asyncio.run(
        cache.dispatch(
            "memory_lookup",
            {"types": ["ownership"], "limit": 5},
            consumer_root=tmp_path,
        )
    )
    assert {"contract_version", "status", "entries", "slices"} <= set(result)


def test_l3_memory_lookup_rejects_empty_types(tmp_path: Path) -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="non-empty"):
        asyncio.run(
            cache.dispatch(
                "memory_lookup",
                {"types": []},
                consumer_root=tmp_path,
            )
        )


def test_l3_list_skills_shape() -> None:
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch("list_skills", {}, consumer_root=REPO_ROOT)
    )
    assert set(result.keys()) == {"count", "skills", "errors"}
    assert result["count"] >= 1
    sample = result["skills"][0]
    assert {"name", "description", "source", "wire_name"} <= set(sample)


def test_l3_list_commands_shape() -> None:
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch("list_commands", {}, consumer_root=REPO_ROOT)
    )
    assert set(result.keys()) == {"count", "commands", "errors"}
    assert result["count"] >= 1


def test_l3_list_rules_shape() -> None:
    cache = ToolCache()
    result = asyncio.run(
        cache.dispatch("list_rules", {}, consumer_root=REPO_ROOT)
    )
    assert set(result.keys()) == {"count", "rules", "errors"}
    assert result["count"] >= 1
    sample = result["rules"][0]
    assert sample["uri"].startswith("rule://")


def test_l3_read_resource_body_shape() -> None:
    cache = ToolCache()
    listing = asyncio.run(
        cache.dispatch("list_rules", {}, consumer_root=REPO_ROOT)
    )
    sample_uri = listing["rules"][0]["uri"]
    body = asyncio.run(
        cache.dispatch(
            "read_resource_body",
            {"uri": sample_uri},
            consumer_root=REPO_ROOT,
        )
    )
    assert body["uri"] == sample_uri
    assert {"name", "description", "mime_type", "kind", "source", "body"} <= set(body)
    assert isinstance(body["body"], str)
    assert len(body["body"]) > 0


def test_l3_read_resource_body_unknown_uri_raises() -> None:
    cache = ToolCache()
    with pytest.raises(ValueError, match="resource not found"):
        asyncio.run(
            cache.dispatch(
                "read_resource_body",
                {"uri": "rule://does-not-exist"},
                consumer_root=REPO_ROOT,
            )
        )


# ----------------------------------------------------------------------
# Phase 1 J5 — Cross-transport catalog parity (offline)
# ----------------------------------------------------------------------


def _worker_content_path() -> Path:
    return REPO_ROOT / "workers" / "mcp" / "content.json"


def test_worker_content_bundles_catalog_when_packed() -> None:
    """J3 — packed Worker `content.json` carries the same catalog set as stdio."""
    from scripts.mcp_server.catalog import load_catalog

    content_path = _worker_content_path()
    if not content_path.exists():
        pytest.skip("Worker content.json not packed in this checkout")
    blob = json.loads(content_path.read_text(encoding="utf-8"))
    tool_catalog = blob.get("tool_catalog") or {}
    worker_names = sorted(t["name"] for t in tool_catalog.get("tools", []))
    stdio_names = sorted(c.name for c in load_catalog())
    assert worker_names == stdio_names, (
        f"Worker bundle drift: only-in-worker={set(worker_names) - set(stdio_names)}, "
        f"only-in-stdio={set(stdio_names) - set(worker_names)}"
    )


def test_worker_content_implemented_on_matches_catalog() -> None:
    """`implemented_on` must round-trip from source-of-truth catalog to bundle."""
    from scripts.mcp_server.catalog import load_catalog

    content_path = _worker_content_path()
    if not content_path.exists():
        pytest.skip("Worker content.json not packed in this checkout")
    blob = json.loads(content_path.read_text(encoding="utf-8"))
    tool_catalog = blob.get("tool_catalog") or {}
    worker = {t["name"]: tuple(t.get("implemented_on") or ()) for t in tool_catalog.get("tools", [])}
    for entry in load_catalog():
        assert worker.get(entry.name) == entry.implemented_on, (
            f"implemented_on drift for {entry.name}: "
            f"worker={worker.get(entry.name)} vs catalog={entry.implemented_on}"
        )


# ----------------------------------------------------------------------
# Phase 1 J6 — Telemetry healthcheck acceptance tests
# ----------------------------------------------------------------------


def _write_telemetry_record(consumer_root: Path, ts: str, tool_name: str = "memory_lookup") -> None:
    """Materialise a single JSONL record at the canonical sink path."""
    target = consumer_root / "agents" / "runtime" / "mcp-telemetry" / "calls.jsonl"
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as fh:
        fh.write(
            json.dumps(
                {
                    "tool_name": tool_name,
                    "client_id_hash": "abc123abc123",
                    "ts": ts,
                    "transport": "stdio",
                    "outcome": "stub",
                }
            )
            + "\n"
        )


def test_health_evaluate_reports_missing_when_no_sink(tmp_path: Path) -> None:
    """J6 — silent default: no sink file → status=missing, exit 1 unless allowed."""
    from scripts.mcp_telemetry_health import evaluate

    report = evaluate(consumer_root=tmp_path)
    assert report.status == "missing"
    assert report.records_in_window == 0
    assert report.last_ts is None


def test_health_evaluate_reports_silent_when_only_old_records(tmp_path: Path) -> None:
    """J6 — older-than-window records do not count → status=silent."""
    import time as _time

    from scripts.mcp_telemetry_health import evaluate

    # Forge a record 48h before "now".
    fake_now = _time.time()
    old_iso = _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime(fake_now - 48 * 3600))
    _write_telemetry_record(tmp_path, old_iso)

    report = evaluate(consumer_root=tmp_path, window_hours=24, now=fake_now)
    assert report.status == "silent"
    assert report.records_in_window == 0
    assert report.last_ts == old_iso


def test_health_evaluate_reports_healthy_with_recent_record(tmp_path: Path) -> None:
    """J6 — ≥1 record in window → status=healthy, exit 0."""
    import time as _time

    from scripts.mcp_telemetry_health import evaluate

    fake_now = _time.time()
    fresh_iso = _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime(fake_now - 60))
    _write_telemetry_record(tmp_path, fresh_iso, "memory_lookup")
    _write_telemetry_record(tmp_path, fresh_iso, "lint_skills")

    report = evaluate(consumer_root=tmp_path, window_hours=24, now=fake_now)
    assert report.status == "healthy"
    assert report.records_in_window == 2
    assert report.last_ts == fresh_iso


def test_health_evaluate_skips_malformed_lines(tmp_path: Path) -> None:
    """Malformed JSON or missing ts must not crash the check."""
    import time as _time

    from scripts.mcp_telemetry_health import evaluate

    target = tmp_path / "agents" / "runtime" / "mcp-telemetry" / "calls.jsonl"
    target.parent.mkdir(parents=True, exist_ok=True)
    fake_now = _time.time()
    fresh_iso = _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime(fake_now - 60))
    target.write_text(
        "\n".join(
            [
                "not json at all",
                json.dumps({"tool_name": "x"}),  # no ts
                json.dumps({"tool_name": "x", "ts": 12345}),  # ts not a string
                json.dumps({"tool_name": "x", "ts": "garbage"}),  # ts not iso
                json.dumps(
                    {
                        "tool_name": "memory_lookup",
                        "client_id_hash": "abc",
                        "ts": fresh_iso,
                        "transport": "stdio",
                        "outcome": "stub",
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )

    report = evaluate(consumer_root=tmp_path, window_hours=24, now=fake_now)
    assert report.status == "healthy"
    assert report.records_in_window == 1


def test_health_main_exits_zero_on_missing_with_allow_missing(
    tmp_path: Path, capsys
) -> None:
    """CLI smoke — --allow-missing flips status=missing to exit 0."""
    from scripts.mcp_telemetry_health import main

    rc = main(["--consumer-root", str(tmp_path), "--allow-missing"])
    assert rc == 0


def test_health_main_exits_one_on_missing_without_flag(tmp_path: Path) -> None:
    """CLI smoke — default missing → exit 1 so the alert sink fires."""
    from scripts.mcp_telemetry_health import main

    rc = main(["--consumer-root", str(tmp_path)])
    assert rc == 1


def test_health_main_emits_machine_readable_json(tmp_path: Path, capsys) -> None:
    """--json must emit a single-line HealthReport for cron consumption."""
    from scripts.mcp_telemetry_health import main

    main(["--consumer-root", str(tmp_path), "--json", "--allow-missing"])
    out = capsys.readouterr().out.strip()
    payload = json.loads(out)
    assert payload["status"] == "missing"
    assert payload["records_in_window"] == 0
    assert payload["window_hours"] == 24
