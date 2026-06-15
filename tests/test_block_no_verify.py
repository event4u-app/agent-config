"""Adversarial tests for src/scripts/hooks/block_no_verify.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "block_no_verify",
    REPO_ROOT / "src" / "scripts" / "hooks" / "block_no_verify.py",
)
assert SPEC and SPEC.loader
bnv = importlib.util.module_from_spec(SPEC)
sys.modules["block_no_verify"] = bnv
SPEC.loader.exec_module(bnv)


def _check(cmd: str) -> bool:
    blocked, _ = bnv._check_command(cmd)
    return blocked


# --- BLOCKS ---
def test_blocks_commit_no_verify():
    assert _check("git commit --no-verify") is True


def test_blocks_commit_no_verify_with_message():
    assert _check('git commit --no-verify -m "fix"') is True


def test_blocks_push_no_verify():
    assert _check("git push --no-verify") is True


def test_blocks_commit_short_n():
    assert _check("git commit -n") is True


def test_blocks_commit_short_n_with_message():
    assert _check('git commit -n -m "foo"') is True


def test_blocks_hooks_path_override():
    assert _check("git -c core.hooksPath=/dev/null commit") is True


def test_blocks_hooks_path_empty():
    assert _check("git -c core.hooksPath= commit") is True


def test_blocks_env_prefixed():
    assert _check("FOO=1 git commit --no-verify") is True


def test_blocks_env_prefixed_multiple():
    assert _check("FOO=1 BAR=2 git push --no-verify") is True


def test_blocks_chained_and():
    assert _check("echo hi && git push --no-verify") is True


def test_blocks_chained_semicolon():
    assert _check("git status; git commit --no-verify") is True


def test_blocks_hooks_path_null():
    assert _check("git -c core.hooksPath=/dev/null push") is True


# --- ALLOWS ---
def test_allows_commit_no_verify_in_message():
    """'no-verify' inside a quoted message arg is not a flag."""
    assert _check('git commit -m "no-verify mentioned in message"') is False


def test_allows_git_status():
    assert _check("git status") is False


def test_allows_plain_push():
    assert _check("git push origin main") is False


def test_allows_npm_no_verify():
    """npm --no-verify is not a git command."""
    assert _check("npm publish --no-verify") is False


def test_allows_non_git():
    assert _check("echo --no-verify") is False


def test_allows_git_commit_with_message():
    assert _check('git commit -m "my message"') is False


def test_allows_empty_command():
    assert _check("") is False


# --- FAIL-CLOSED ---
def test_fail_closed_malformed_git_command():
    """A malformed shell command containing 'git' must block, not allow."""
    blocked, reason = bnv._check_command("git commit -m 'unclosed quote")
    assert blocked is True
    assert "fail-closed" in reason or "parse" in reason.lower()


def test_fail_closed_malformed_non_git():
    """A malformed command without 'git' is allowed."""
    blocked, _ = bnv._check_command("echo 'unclosed quote")
    assert blocked is False
