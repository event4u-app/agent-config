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
    SkillPrompt,
    load_phase_1_prompts,
    load_skill,
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


def test_to_mcp_prompt_meta_shape() -> None:
    prompt = SkillPrompt(
        name="example",
        description="desc",
        body="body",
        source="package",
    )
    meta = to_mcp_prompt_meta(prompt)
    assert meta["name"] == "skill.example"
    assert meta["title"] == "example"
    assert meta["description"] == "desc"
    assert meta["arguments"] == []
    assert meta["_meta"] == {"source": "package"}


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
