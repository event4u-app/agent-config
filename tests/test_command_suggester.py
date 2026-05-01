"""Tests for scripts/command_suggester/* — the suggestion engine.

Coverage areas:

* `match.py` — phrase substring, structural bonus, token overlap, eligibility filter.
* `rank.py` — confidence floor, blocklist, vague-input + lonely-band suppression.
* `cooldown.py` — duration parsing, per-conversation suppression, explicit-invocation reset.
* `render.py` — numbered-options block, as-is escape hatch, single-source recommendation line.
* `loader.py` — frontmatter → CommandSpec conversion, ineligible flag preserved.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from command_suggester import (  # noqa: E402
    CommandSpec,
    CooldownStore,
    Match,
    Settings,
    apply_cooldown,
    detect_disable_directive,
    load_commands,
    load_settings,
    match,
    rank,
    render,
    sanitize_context,
    sanitize_message,
    strip_code_blocks,
    strip_suggestion_echo,
)
from command_suggester.cooldown import parse_cooldown  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
COMMANDS_DIR = REPO_ROOT / ".agent-src.uncompressed" / "commands"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _spec(
    name: str,
    *,
    eligible: bool = True,
    description: str = "",
    trigger_description: str = "",
    trigger_context: str = "",
    floor: float | None = None,
    cooldown: str | None = None,
) -> CommandSpec:
    return CommandSpec(
        name=name,
        description=description or f"{name} description",
        eligible=eligible,
        trigger_description=trigger_description,
        trigger_context=trigger_context,
        confidence_floor=floor,
        cooldown=cooldown,
    )


@pytest.fixture
def specs() -> list[CommandSpec]:
    """Hand-rolled spec set — independent of real command frontmatter."""
    return [
        _spec(
            "implement-ticket",
            description="Drive a ticket end-to-end",
            trigger_description="setze ticket x um, implement ticket, work on ticket",
            trigger_context="user message contains a ticket key like ABC-123 or PROJ-42",
        ),
        _spec(
            "commit",
            description="Stage and commit all changes",
            trigger_description="commit my changes, please commit, save to git",
            trigger_context="uncommitted changes are present in the working tree",
        ),
        _spec(
            "fix-ci",
            description="Fetch CI errors and fix them",
            trigger_description="ci is failing, fix the ci pipeline, github actions failed",
            trigger_context="github actions workflow is in a failed state",
        ),
        _spec(
            "onboard",
            eligible=False,
            description="First-run setup",
        ),
    ]


@pytest.fixture
def specs_by_name(specs: list[CommandSpec]) -> dict[str, CommandSpec]:
    return {s.name: s for s in specs}


@pytest.fixture
def settings() -> Settings:
    return Settings()


# ---------------------------------------------------------------------------
# match.py
# ---------------------------------------------------------------------------


def test_match_skips_ineligible_commands(specs: list[CommandSpec]) -> None:
    out = match("first-run setup wizard please", [], specs)
    assert all(m.command != "onboard" for m in out)


def test_match_long_phrase_clears_floor_alone(specs: list[CommandSpec]) -> None:
    out = match("commit my changes please", [], specs)
    top = next(m for m in out if m.command == "commit")
    assert top.score >= 0.6
    assert top.matched_trigger in {"description", "both"}


def test_match_structural_bonus_on_ticket_key(specs: list[CommandSpec]) -> None:
    out = match("Setze ticket ABC-123 um", [], specs)
    top = next(m for m in out if m.command == "implement-ticket")
    assert top.has_structural_bonus is True
    assert "ABC-123" in top.evidence


def test_match_returns_empty_for_unrelated_input(specs: list[CommandSpec]) -> None:
    out = match("the weather is nice today", [], specs)
    assert out == []


def test_match_sorted_descending_by_score(specs: list[CommandSpec]) -> None:
    out = match("commit my changes and push to git", [], specs)
    scores = [m.score for m in out]
    assert scores == sorted(scores, reverse=True)



# ---------------------------------------------------------------------------
# rank.py
# ---------------------------------------------------------------------------


def test_rank_drops_below_floor(specs_by_name, settings) -> None:
    raw = [
        Match(command="commit", score=0.55, matched_trigger="both", evidence="x"),
        Match(command="fix-ci", score=0.85, matched_trigger="both", evidence="y"),
    ]
    out = rank(raw, settings, specs_by_name, raw_message="long enough message here")
    names = [m.command for m in out]
    assert names == ["fix-ci"]


def test_rank_blocklist_filters_out(specs_by_name) -> None:
    raw = [Match(command="commit", score=0.9, matched_trigger="both", evidence="x")]
    settings = Settings(blocklist=("commit",))
    assert rank(raw, settings, specs_by_name, raw_message="commit my changes now") == []


def test_rank_disabled_returns_empty(specs_by_name) -> None:
    raw = [Match(command="commit", score=0.9, matched_trigger="both", evidence="x")]
    settings = Settings(enabled=False)
    assert rank(raw, settings, specs_by_name, raw_message="commit my changes now") == []


def test_rank_per_command_floor_overrides_global(specs_by_name) -> None:
    specs_by_name = dict(specs_by_name)
    specs_by_name["commit"] = _spec(
        "commit",
        trigger_description="commit my changes",
        floor=0.9,
    )
    raw = [Match(command="commit", score=0.7, matched_trigger="both", evidence="x")]
    out = rank(raw, Settings(), specs_by_name, raw_message="commit my changes today")
    assert out == []


def test_rank_lonely_match_just_above_floor_suppressed(specs_by_name) -> None:
    raw = [Match(command="commit", score=0.62, matched_trigger="both", evidence="x")]
    out = rank(raw, Settings(), specs_by_name, raw_message="commit my changes today")
    assert out == []


def test_rank_lonely_match_with_structural_bonus_kept(specs_by_name) -> None:
    raw = [
        Match(
            command="implement-ticket",
            score=0.62,
            matched_trigger="both",
            evidence="ABC-123",
            has_structural_bonus=True,
        )
    ]
    out = rank(raw, Settings(), specs_by_name, raw_message="ABC-123 work")
    assert [m.command for m in out] == ["implement-ticket"]


def test_rank_vague_short_input_suppressed(specs_by_name) -> None:
    raw = [
        Match(command="commit", score=0.7, matched_trigger="both", evidence="x"),
        Match(command="fix-ci", score=0.7, matched_trigger="both", evidence="y"),
        Match(command="implement-ticket", score=0.7, matched_trigger="both", evidence="z"),
    ]
    out = rank(raw, Settings(), specs_by_name, raw_message="do it now")
    assert out == []


def test_rank_vague_input_with_structural_bonus_kept(specs_by_name) -> None:
    raw = [
        Match(command="implement-ticket", score=0.7, matched_trigger="both",
              evidence="ABC-123", has_structural_bonus=True),
        Match(command="commit", score=0.7, matched_trigger="both", evidence="x"),
        Match(command="fix-ci", score=0.7, matched_trigger="both", evidence="y"),
    ]
    out = rank(raw, Settings(), specs_by_name, raw_message="ABC-123 jetzt")
    assert any(m.command == "implement-ticket" for m in out)


def test_rank_caps_at_max_options(specs_by_name) -> None:
    raw = [
        Match(command=f"cmd{i}", score=0.9 - i * 0.01, matched_trigger="description",
              evidence="x") for i in range(10)
    ]
    out = rank(raw, Settings(max_options=3), specs_by_name,
               raw_message="long enough message here for sure")
    assert len(out) == 3


def test_rank_tie_break_structural_bonus_wins(specs_by_name) -> None:
    """On a score tie, the structural-bonus match outranks the generic one."""
    raw = [
        Match(command="commit", score=0.8, matched_trigger="description",
              evidence="commit"),
        Match(command="implement-ticket", score=0.8, matched_trigger="both",
              evidence="ABC-123", has_structural_bonus=True),
    ]
    out = rank(raw, Settings(), specs_by_name,
               raw_message="commit ABC-123 jetzt please run")
    assert [m.command for m in out] == ["implement-ticket", "commit"]


def test_rank_tie_break_longer_evidence_wins(specs_by_name) -> None:
    """No structural bonus → longer evidence (more specific match) wins."""
    raw = [
        Match(command="commit", score=0.8, matched_trigger="description",
              evidence="commit my changes"),
        Match(command="fix-ci", score=0.8, matched_trigger="description",
              evidence="ci"),
    ]
    out = rank(raw, Settings(), specs_by_name,
               raw_message="commit my changes and check ci pipeline")
    assert [m.command for m in out] == ["commit", "fix-ci"]


def test_rank_lonely_match_at_old_threshold_now_suppressed(specs_by_name) -> None:
    """Phase 4: lonely-band threshold raised from 0.05 to 0.1.

    Score 0.65 (long phrase alone, no other signal) used to survive
    when the band was 0.05 — now it must suppress unless paired with
    a structural bonus.
    """
    raw = [Match(command="commit", score=0.65, matched_trigger="description",
                 evidence="commit my changes")]
    out = rank(raw, Settings(), specs_by_name,
               raw_message="commit my changes please now")
    assert out == []


def test_rank_lonely_match_clears_band_kept(specs_by_name) -> None:
    raw = [Match(command="commit", score=0.71, matched_trigger="both",
                 evidence="commit my changes")]
    out = rank(raw, Settings(), specs_by_name,
               raw_message="commit my changes please now")
    assert [m.command for m in out] == ["commit"]


@pytest.mark.parametrize("msg", [
    "ok",
    "Ok.",
    "weiter",
    "mach weiter",
    "continue",
    "go on",
    "ja",
    "  yes!  ",
])
def test_rank_continuation_phrase_suppressed(specs_by_name, msg: str) -> None:
    raw = [
        Match(command="commit", score=0.9, matched_trigger="both",
              evidence="commit changes"),
        Match(command="fix-ci", score=0.85, matched_trigger="both",
              evidence="ci"),
    ]
    out = rank(raw, Settings(), specs_by_name, raw_message=msg)
    assert out == []


def test_rank_continuation_with_structural_bonus_kept(specs_by_name) -> None:
    """`weiter mit ABC-123` is a fresh intent signal, not a follow-through."""
    raw = [
        Match(command="implement-ticket", score=0.85, matched_trigger="both",
              evidence="ABC-123", has_structural_bonus=True),
    ]
    out = rank(raw, Settings(), specs_by_name, raw_message="weiter mit ABC-123")
    assert [m.command for m in out] == ["implement-ticket"]




# ---------------------------------------------------------------------------
# cooldown.py
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "value,expected",
    [
        ("10m", 600),
        ("30s", 30),
        ("1h", 3600),
        ("2d", 172800),
        ("", 600),
        (None, 600),
        ("garbage", 600),
    ],
)
def test_parse_cooldown_units(value, expected) -> None:
    assert parse_cooldown(value, default_seconds=600) == expected


def test_apply_cooldown_suppresses_recent_match(specs_by_name) -> None:
    now = [1000.0]
    store = CooldownStore(now=lambda: now[0])
    store.record_shown([Match(command="commit", score=0.9,
                              matched_trigger="both", evidence="changes")])
    now[0] = 1100.0  # 100s later, well within default 600s window
    raw = [Match(command="commit", score=0.9,
                 matched_trigger="both", evidence="changes")]
    out = apply_cooldown(raw, store, Settings(), specs_by_name)
    assert out == []


def test_apply_cooldown_releases_after_window(specs_by_name) -> None:
    now = [1000.0]
    store = CooldownStore(now=lambda: now[0])
    store.record_shown([Match(command="commit", score=0.9,
                              matched_trigger="both", evidence="changes")])
    now[0] = 1000.0 + 700  # past the 600s default
    raw = [Match(command="commit", score=0.9,
                 matched_trigger="both", evidence="changes")]
    out = apply_cooldown(raw, store, Settings(), specs_by_name)
    assert [m.command for m in out] == ["commit"]


def test_apply_cooldown_explicit_invocation_clears(specs_by_name) -> None:
    store = CooldownStore()
    store.record_shown([Match(command="commit", score=0.9,
                              matched_trigger="both", evidence="changes")])
    store.record_explicit_invocation("commit")
    raw = [Match(command="commit", score=0.9,
                 matched_trigger="both", evidence="changes")]
    out = apply_cooldown(raw, store, Settings(), specs_by_name)
    assert [m.command for m in out] == ["commit"]


def test_apply_cooldown_disabled_for_conversation(specs_by_name) -> None:
    store = CooldownStore()
    store.state.disabled_for_conversation = True
    raw = [Match(command="commit", score=0.9,
                 matched_trigger="both", evidence="changes")]
    assert apply_cooldown(raw, store, Settings(), specs_by_name) == []


# ---------------------------------------------------------------------------
# render.py
# ---------------------------------------------------------------------------


def test_render_empty_matches_returns_empty_string(specs_by_name) -> None:
    assert render([], specs_by_name) == ""


def test_render_includes_as_is_option_last(specs_by_name) -> None:
    matches = [Match(command="commit", score=0.9,
                     matched_trigger="both", evidence="commit my changes")]
    out = render(matches, specs_by_name)
    lines = out.splitlines()
    option_lines = [ln for ln in lines if ln.startswith("> ")]
    assert option_lines[-1].endswith("Just run the prompt as-is, no command")


def test_render_recommendation_line_present_for_clear_winner(specs_by_name) -> None:
    matches = [
        Match(command="commit", score=0.9, matched_trigger="both",
              evidence="commit my changes"),
        Match(command="fix-ci", score=0.7, matched_trigger="both", evidence="ci"),
    ]
    out = render(matches, specs_by_name)
    assert "**Recommendation: 1 — /commit**" in out


def test_render_recommendation_omitted_on_tight_tie(specs_by_name) -> None:
    matches = [
        Match(command="commit", score=0.71, matched_trigger="both", evidence="x"),
        Match(command="fix-ci", score=0.70, matched_trigger="both", evidence="y"),
    ]
    out = render(matches, specs_by_name)
    assert "Recommendation:" not in out


# ---------------------------------------------------------------------------
# loader.py — exercises real frontmatter
# ---------------------------------------------------------------------------


def test_load_commands_returns_specs_for_real_directory() -> None:
    specs = load_commands(COMMANDS_DIR)
    assert len(specs) > 50
    by_name = {s.name: s for s in specs}
    eligible = [s for s in specs if s.eligible]
    assert eligible, "at least one command must be eligible"
    onboard = by_name.get("onboard")
    assert onboard is not None and onboard.eligible is False


def test_load_commands_eligible_have_triggers() -> None:
    specs = load_commands(COMMANDS_DIR)
    for spec in specs:
        if not spec.eligible:
            continue
        assert spec.trigger_description, f"{spec.name} missing trigger_description"
        assert spec.trigger_context, f"{spec.name} missing trigger_context"



# ---------------------------------------------------------------------------
# settings.py — read commands.suggestion.* from .agent-settings.yml (Phase 5)
# ---------------------------------------------------------------------------


def _write_settings(tmp_path, body: str) -> Path:
    p = tmp_path / ".agent-settings.yml"
    p.write_text(body, encoding="utf-8")
    return p


def test_load_settings_missing_file_returns_defaults(tmp_path) -> None:
    out = load_settings(tmp_path / "does-not-exist.yml")
    assert out == Settings()


def test_load_settings_no_section_returns_defaults(tmp_path) -> None:
    p = _write_settings(tmp_path, "personal:\n  user_name: alice\n")
    out = load_settings(p)
    assert out == Settings()


def test_load_settings_full_block(tmp_path) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n"
        "  suggestion:\n"
        "    enabled: false\n"
        "    confidence_floor: 0.75\n"
        "    cooldown_seconds: 120\n"
        "    max_options: 3\n"
        "    blocklist:\n"
        "      - /commit\n"
        "      - /create-pr\n",
    )
    out = load_settings(p)
    assert out.enabled is False
    assert out.confidence_floor == pytest.approx(0.75)
    assert out.cooldown_seconds == 120
    assert out.max_options == 3
    assert out.blocklist == ("/commit", "/create-pr")


def test_load_settings_partial_keeps_defaults(tmp_path) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n  suggestion:\n    enabled: false\n",
    )
    out = load_settings(p)
    assert out.enabled is False
    # Untouched keys stay at default.
    assert out.confidence_floor == Settings().confidence_floor
    assert out.max_options == Settings().max_options
    assert out.blocklist == ()


def test_load_settings_floor_clamped(tmp_path) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n  suggestion:\n    confidence_floor: 1.5\n",
    )
    out = load_settings(p)
    assert out.confidence_floor == 1.0


def test_load_settings_negative_floor_clamped(tmp_path) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n  suggestion:\n    confidence_floor: -0.2\n",
    )
    out = load_settings(p)
    assert out.confidence_floor == 0.0


def test_load_settings_garbage_int_falls_back(tmp_path) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n"
        "  suggestion:\n"
        "    cooldown_seconds: not-a-number\n"
        "    max_options: nope\n",
    )
    out = load_settings(p)
    assert out.cooldown_seconds == Settings().cooldown_seconds
    assert out.max_options == Settings().max_options


def test_load_settings_blocklist_filters_non_strings(tmp_path) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n"
        "  suggestion:\n"
        "    blocklist:\n"
        "      - /commit\n"
        "      - 42\n"
        "      - ''\n"
        "      - /create-pr\n",
    )
    out = load_settings(p)
    assert out.blocklist == ("/commit", "/create-pr")


def test_load_settings_malformed_yaml_returns_defaults(tmp_path) -> None:
    p = _write_settings(tmp_path, ":\n  this is: not\nvalid yaml: [\n")
    out = load_settings(p)
    assert out == Settings()


def test_load_settings_then_rank_honours_blocklist(tmp_path, specs_by_name) -> None:
    """End-to-end: settings loaded from disk drive `rank()`."""
    p = _write_settings(
        tmp_path,
        "commands:\n  suggestion:\n    blocklist:\n      - commit\n",
    )
    settings = load_settings(p)
    raw = [
        Match(command="commit", score=0.9, matched_trigger="both",
              evidence="commit my changes"),
        Match(command="fix-ci", score=0.85, matched_trigger="both",
              evidence="fix the ci"),
    ]
    out = rank(raw, settings, specs_by_name,
               raw_message="commit my changes and fix the ci")
    assert [m.command for m in out] == ["fix-ci"]


def test_load_settings_disabled_short_circuits_rank(tmp_path, specs_by_name) -> None:
    p = _write_settings(
        tmp_path,
        "commands:\n  suggestion:\n    enabled: false\n",
    )
    settings = load_settings(p)
    raw = [Match(command="commit", score=0.95, matched_trigger="both",
                 evidence="commit my changes")]
    out = rank(raw, settings, specs_by_name,
               raw_message="commit my changes please now")
    assert out == []


# ---------------------------------------------------------------------------
# Per-conversation opt-out directive (Phase 5)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("msg", [
    "/command-suggestion-off",
    "  /command-suggestion-off  ",
    "please /command-suggestion-off thanks",
    "/COMMAND-SUGGESTION-OFF",
])
def test_detect_disable_directive_off(msg: str) -> None:
    assert detect_disable_directive(msg) is True


@pytest.mark.parametrize("msg", [
    "/command-suggestion-on",
    "re-enable: /command-suggestion-on",
])
def test_detect_disable_directive_on(msg: str) -> None:
    assert detect_disable_directive(msg) is False


@pytest.mark.parametrize("msg", [
    "",
    "implement the feature",
    "command-suggestion-off without a slash",
    "/command-suggestion-offline",  # word boundary required
])
def test_detect_disable_directive_none(msg: str) -> None:
    assert detect_disable_directive(msg) is None


def test_detect_disable_directive_last_wins() -> None:
    """Off then on in the same message → finally on (`False`)."""
    assert detect_disable_directive(
        "/command-suggestion-off then later /command-suggestion-on"
    ) is False


def test_directive_disables_for_conversation(specs_by_name) -> None:
    """The agent flips `disabled_for_conversation`, then `apply_cooldown` returns []."""
    store = CooldownStore()
    if detect_disable_directive("/command-suggestion-off"):
        store.state.disabled_for_conversation = True
    raw = [Match(command="commit", score=0.9, matched_trigger="both",
                 evidence="commit my changes")]
    out = apply_cooldown(raw, store, Settings(), specs_by_name)
    assert out == []


def test_directive_re_enable_clears_disabled(specs_by_name) -> None:
    store = CooldownStore()
    store.state.disabled_for_conversation = True
    if detect_disable_directive("/command-suggestion-on") is False:
        store.state.disabled_for_conversation = False
    raw = [Match(command="commit", score=0.9, matched_trigger="both",
                 evidence="commit my changes")]
    out = apply_cooldown(raw, store, Settings(), specs_by_name)
    assert [m.command for m in out] == ["commit"]



# ---------------------------------------------------------------------------
# sanitize.py — Phase 6 hardening (Step 4: no echo-trigger; Step 6: adversarial)
# ---------------------------------------------------------------------------


def test_strip_code_blocks_removes_fenced() -> None:
    msg = "before\n```bash\ngit commit -m fix\n```\nafter"
    out = strip_code_blocks(msg)
    assert "git commit" not in out
    assert "before" in out
    assert "after" in out


def test_strip_code_blocks_removes_inline() -> None:
    msg = "use `/implement-ticket` somehow"
    out = strip_code_blocks(msg)
    assert "/implement-ticket" not in out
    assert "use" in out and "somehow" in out


def test_strip_code_blocks_preserves_plain_text() -> None:
    msg = "commit my changes please now"
    assert strip_code_blocks(msg) == msg


def test_strip_code_blocks_handles_multiple_fences() -> None:
    msg = "```a\ncommit\n```\nmid\n```b\nfix-ci\n```"
    out = strip_code_blocks(msg)
    assert "commit" not in out and "fix-ci" not in out
    assert "mid" in out


def test_strip_suggestion_echo_removes_full_block() -> None:
    block = (
        "> 💡 Your request matches a command. Pick one or run the prompt as-is:\n"
        ">\n"
        "> 1. /implement-ticket — drive ticket end-to-end\n"
        "> 2. /refine-ticket — tighten AC\n"
        "> 3. Just run the prompt as-is, no command\n"
        "\n"
        "**Recommendation: 1 — /implement-ticket** — the request matches.\n"
    )
    out = strip_suggestion_echo(block).strip()
    # All four shapes removed; only the empty `>` divider survives.
    assert "/implement-ticket" not in out
    assert "/refine-ticket" not in out
    assert "Recommendation:" not in out
    assert "Just run the prompt" not in out


def test_strip_suggestion_echo_preserves_user_quotes() -> None:
    """A user quote that mentions a command name without the engine's
    `> N. /command —` shape must NOT be stripped."""
    msg = "> the docs say '/commit stages everything'"
    assert strip_suggestion_echo(msg) == msg


def test_sanitize_message_combines_both() -> None:
    msg = (
        "please look at this output:\n"
        "```\n"
        "ci is failing on main\n"
        "```\n"
        "> 1. /fix-ci — fetch CI errors and fix them\n"
        "> 2. Just run the prompt as-is, no command\n"
    )
    out = sanitize_message(msg)
    assert "fix-ci" not in out
    assert "ci is failing" not in out
    assert "please look at this output" in out


def test_sanitize_context_drops_empty_lines() -> None:
    ctx = [
        "real intent: commit my changes",
        "```\nirrelevant\n```",
        "> 1. /commit — Stage and commit\n> 2. Just run the prompt as-is, no command",
    ]
    out = sanitize_context(ctx)
    assert any("commit my changes" in line for line in out)
    # Lines that became pure whitespace after stripping are dropped.
    assert all(line.strip() for line in out)


# ---------------------------------------------------------------------------
# Adversarial inputs at the matcher level (Phase 6 Step 6)
# ---------------------------------------------------------------------------


def test_match_ignores_command_inside_fenced_code(specs: list[CommandSpec]) -> None:
    """User pastes a code snippet mentioning `/implement-ticket` — no trigger."""
    msg = (
        "what does this script do?\n"
        "```bash\n"
        "./agent-config /implement-ticket ABC-123\n"
        "```"
    )
    out = match(msg, [], specs)
    assert all(m.command != "implement-ticket" for m in out)


def test_match_ignores_command_inside_inline_code(specs: list[CommandSpec]) -> None:
    msg = "explain `/commit` versus `/commit-in-chunks`"
    out = match(msg, [], specs)
    assert all(m.command != "commit" for m in out)


def test_match_ignores_previous_suggestion_block_in_context(
    specs: list[CommandSpec],
) -> None:
    """Echo-trigger defense: prior suggestion block in context must not
    re-surface the same command on the next turn."""
    prev = (
        "> 💡 Your request matches a command.\n"
        "> 1. /commit — Stage and commit all changes\n"
        "> 2. Just run the prompt as-is, no command\n"
        "**Recommendation: 1 — /commit** — both match (`commit`)."
    )
    out = match("the weather is nice today", [prev], specs)
    assert out == []


def test_match_render_roundtrip_does_not_re_trigger(
    specs: list[CommandSpec], specs_by_name
) -> None:
    """Render output → next-turn context → no new matches."""
    matches_in = match("commit my changes please", [], specs)
    block = render(matches_in, specs_by_name)
    assert block, "fixture must produce a non-empty block"
    out = match("the cat sat on the mat", [block], specs)
    assert out == []


def test_match_sanitize_off_exposes_raw_path(specs: list[CommandSpec]) -> None:
    """`sanitize=False` reveals the unfiltered scoring — proves the
    sanitizer is the one shielding adversarial input."""
    msg = "see `commit my changes` literal"
    raw = match(msg, [], specs, sanitize=False)
    assert any(m.command == "commit" for m in raw)
    safe = match(msg, [], specs, sanitize=True)
    assert all(m.command != "commit" for m in safe)


# ---------------------------------------------------------------------------
# Rule-contract self-check (Phase 6 Steps 1, 5)
# ---------------------------------------------------------------------------

RULE_PATH = REPO_ROOT / ".agent-src.uncompressed" / "rules" / "command-suggestion.md"


def test_rule_contains_iron_law_no_auto_execute() -> None:
    """Step 1 hardening — rule must literally state the never-invoke contract."""
    body = RULE_PATH.read_text(encoding="utf-8")
    assert "SUGGEST. NEVER INVOKE." in body
    assert "auto-execute" in body.lower()


def test_rule_lists_subordination_targets() -> None:
    """Step 5 hardening — rule must name the senior rules it yields to."""
    body = RULE_PATH.read_text(encoding="utf-8").lower()
    for target in (
        "scope-control",
        "ask-when-uncertain",
        "verify-before-complete",
        "role-mode-adherence",
    ):
        assert target in body, f"rule must reference {target}"


def test_rule_states_as_is_option_always_present() -> None:
    """Step 3 hardening — `run as-is` option is non-negotiable."""
    body = RULE_PATH.read_text(encoding="utf-8")
    assert "as-is" in body.lower()
    assert "always last" in body.lower() or "always present" in body.lower()
