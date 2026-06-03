"""6.0.0-D Phase 4 (Step 10) — src/domains command-source mapping + the
council-mandated logical-path COLLISION guard.

The structural command move preserves each command's LOGICAL identity
(`commands/<subpath>.md`) while relocating the file to the pack-physical
`src/domains/<pack>/<subpath>/command.md` home. These tests pin:

1. the path-based physical→logical mapping (lossless, incl. the 3-level
   `agents/user/*` outliers whose frontmatter `name` hyphenates);
2. that NO two source files map to the same logical path — the explicit
   collision detection the council required as a precondition for the
   preserve-logical-identity design (rollback criterion: >0 collisions
   blocks merge);
3. that every domains command round-trips through resolve_logical.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from _lib import agent_src  # noqa: E402


def test_domains_command_logical_mapping():
    cases = {
        "src/domains/git/commit/command.md": "commands/commit.md",
        "src/domains/engineering-base/fix/ci/command.md": "commands/fix/ci.md",
        "src/domains/meta/agents/user/accept/command.md": "commands/agents/user/accept.md",
        # non-command leaves map to None (the activation gate)
        "src/domains/laravel/pack.yaml": None,
        "src/domains/fun/FIRST_WIN.md": None,
        "src/domains/git/README.md": None,
    }
    for rel, expected in cases.items():
        assert agent_src.strip_source_prefix(rel) == expected, rel
        assert agent_src._domains_command_logical(agent_src.ROOT / rel) == expected, rel


def test_no_logical_path_collisions():
    """Council safeguard: no two source files share a logical path.

    iter_all_sources() dedups silently (first-win); this asserts the
    *underlying* set has no genuine duplicate so a real collision (two
    physical commands → one logical id) fails loudly instead of one
    silently shadowing the other.
    """
    counts: Counter[str] = Counter()
    # commands across both layouts
    for p in agent_src.iter_commands():
        counts[agent_src.logical_relpath(p)] += 1
    collisions = {rel: n for rel, n in counts.items() if n > 1}
    assert not collisions, f"command logical-path collisions: {collisions}"


def test_every_domains_command_round_trips():
    for p, logical in agent_src._iter_domains_commands():
        assert logical.startswith("commands/") and logical.endswith(".md")
        assert agent_src.resolve_logical(logical) == p, logical


def test_iter_commands_covers_the_full_surface():
    """The flat command count is stable and non-zero across the move."""
    cmds = list(agent_src.iter_commands())
    # 150 commands in the suite as of 6.0.0-D Phase 4; guard against a
    # scanner regression silently dropping the src/domains homes.
    assert len(cmds) >= 150
    assert all(p.name == "command.md" or "/commands/" in p.as_posix() for p in cmds)
