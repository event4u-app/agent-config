"""Bidirectional drift test — MCP Cloud contract <-> README auth surface.

Per Phase 1 Step 4 of `agents/roadmaps/road-to-distribution-maturity.md`.

Two directions:

1. **README -> contract.** Every auth-mode name the README mentions
   in the MCP section must be declared by the contract's
   `## Auth surface` section.
2. **Contract -> README.** Every active (non-`-deferred`) auth-mode
   name the contract declares must appear in the README's MCP section.
   Deferred modes (`hmac-deferred`, `cf-access-deferred`) are
   explicitly allowed to be README-silent — they are not yet shipped
   and the README must not name them as available.

Mode names are tokenised case-sensitively. The drift test does not
parse semantics; it asserts both sides agree on the **token set**.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
README_PATH = REPO_ROOT / "README.md"
CONTRACT_PATH = REPO_ROOT / "docs" / "contracts" / "mcp-cloud-scope.md"

DEFERRED_SUFFIX = "-deferred"


def _readme_mcp_section() -> str:
    """README MCP section — the band between the MCP heading and the
    Optional-memory section. Everything outside this band is unrelated
    to the cloud contract.
    """
    text = README_PATH.read_text(encoding="utf-8")
    start_match = re.search(r"^###\s+Self-hosted MCP on Cloudflare", text, re.MULTILINE)
    end_match = re.search(r"^###\s+Optional: persistent agent memory", text, re.MULTILINE)
    if not start_match or not end_match:
        raise AssertionError(
            "MCP section anchors not found in README — bidirectional drift "
            "test cannot scope the auth-mode search."
        )
    return text[start_match.start() : end_match.start()]


def _contract_auth_modes() -> set[str]:
    """Auth-mode names the contract declares under `## Auth surface`.

    Modes are declared by `### Mode \\`<name>\\`` headings inside the
    `## Auth surface` section.
    """
    text = CONTRACT_PATH.read_text(encoding="utf-8")
    auth_block = re.search(
        r"^##\s+Auth surface\s*$(.*?)^##\s+",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if not auth_block:
        raise AssertionError(
            "`## Auth surface` section not found in mcp-cloud-scope.md — "
            "Phase 1 Step 2 must declare modes before this test passes."
        )
    body = auth_block.group(1)
    return set(re.findall(r"^###\s+Mode\s+`([a-z0-9-]+)`", body, re.MULTILINE))


def _readme_mode_tokens(modes: set[str]) -> set[str]:
    """Subset of `modes` that the README MCP section names by token."""
    body = _readme_mcp_section()
    return {m for m in modes if re.search(rf"`{re.escape(m)}`", body)}


def test_contract_declares_at_least_one_active_mode():
    modes = _contract_auth_modes()
    active = {m for m in modes if not m.endswith(DEFERRED_SUFFIX)}
    assert active, (
        "Contract must declare at least one active (non-deferred) auth "
        f"mode. Found only: {sorted(modes)}."
    )


def test_readme_names_only_contract_declared_modes():
    """Direction 1: README must not name a mode the contract has not declared.

    Specifically catches placeholder phrasing like ``oauth-mode`` or
    ``cf-access-mode`` appearing in README before the contract declares them.
    """
    modes = _contract_auth_modes()
    body = _readme_mcp_section()
    candidate_pattern = re.compile(r"`([a-z][a-z0-9-]+(?:-auth|-deferred|public))`")
    readme_named = set(candidate_pattern.findall(body))
    undeclared = readme_named - modes
    assert not undeclared, (
        f"README names auth modes not declared by the contract: "
        f"{sorted(undeclared)}. Either add them to "
        f"`mcp-cloud-scope.md § Auth surface` or remove them from README."
    )


def test_contract_active_modes_appear_in_readme():
    """Direction 2: every active mode must appear in README MCP section.

    Deferred modes are intentionally README-silent — they are gated by
    the wake-up triggers in the contract and must not be advertised as
    available.
    """
    modes = _contract_auth_modes()
    active = {m for m in modes if not m.endswith(DEFERRED_SUFFIX)}
    named_in_readme = _readme_mode_tokens(active)
    missing = active - named_in_readme
    assert not missing, (
        f"Active auth modes declared by the contract are not named in "
        f"README MCP section: {sorted(missing)}. Each active mode must "
        f"be cited by name (backticked token) so operators know it is "
        f"available."
    )


def test_deferred_modes_are_not_marketed_in_readme():
    """Deferred modes must not be backticked-named alongside active ones
    in a way that suggests availability. Naming them as "deferred / not
    yet shipped" is allowed — the README's existing phrasing covers that.

    This test catches accidental promotion: a contract mode that still
    ends in `-deferred` but appears in README without the surrounding
    "deferred" / "not yet shipped" qualifier on the same line.
    """
    modes = _contract_auth_modes()
    deferred = {m for m in modes if m.endswith(DEFERRED_SUFFIX)}
    body = _readme_mcp_section()
    promoted: list[str] = []
    for mode in deferred:
        for line in body.splitlines():
            if f"`{mode}`" in line and not re.search(
                r"defer|not yet|wake-up|MVP-2", line, re.IGNORECASE
            ):
                promoted.append(f"{mode}: {line.strip()[:80]}")
    assert not promoted, (
        "Deferred auth modes are named in README without a deferred "
        "qualifier on the same line — these reads as available:\n"
        + "\n".join(promoted)
    )
