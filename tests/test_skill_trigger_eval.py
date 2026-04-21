"""Tests for scripts/skill_trigger_eval.py.

All tests use the MockRouter or a stub Anthropic client. No test makes
a real API call — trigger evals against Claude are manual, budgeted,
and out of CI scope by design (see road-to-trigger-evals.md Phase 3.2).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from skill_trigger_eval import (  # noqa: E402
    AnthropicRouter,
    ConfirmationAborted,
    KeyGateError,
    MockRouter,
    Query,
    QueryResult,
    SkillMeta,
    _extract_field,
    _parse_frontmatter,
    _parse_would_load,
    build_confirmation_summary,
    compute_metrics,
    estimate_cost,
    load_anthropic_key,
    load_skill_metas,
    load_triggers,
    main,
    pre_estimate_cost,
    require_confirmation,
    run_eval,
    write_result,
)


# -- frontmatter parsing --------------------------------------------------

def test_extract_field_quoted():
    block = 'name: foo\ndescription: "Use when doing X"\n'
    assert _extract_field(block, "name") == "foo"
    assert _extract_field(block, "description") == "Use when doing X"


def test_extract_field_single_quoted():
    assert _extract_field("description: 'hello'\n", "description") == "hello"


def test_extract_field_missing():
    assert _extract_field("name: foo\n", "description") is None


def test_parse_frontmatter_reads_real_skill():
    path = PROJECT_ROOT / ".agent-src.uncompressed" / "skills" / "eloquent" / "SKILL.md"
    meta = _parse_frontmatter(path)
    assert meta is not None
    assert meta.name == "eloquent"
    assert "Eloquent" in meta.description


def test_parse_frontmatter_without_frontmatter(tmp_path: Path):
    f = tmp_path / "no-fm.md"
    f.write_text("# plain markdown\n", encoding="utf-8")
    assert _parse_frontmatter(f) is None


def test_load_skill_metas_real_repo():
    metas = load_skill_metas()
    names = {m.name for m in metas}
    assert {"eloquent", "php-coder", "skill-writing"}.issubset(names)
    assert all(m.description for m in metas)


# -- triggers.json loading ------------------------------------------------

def test_load_triggers_parses_pilot(tmp_path: Path):
    f = tmp_path / "triggers.json"
    f.write_text(
        json.dumps(
            {
                "skill": "demo",
                "queries": [
                    {"q": "a", "trigger": True},
                    {"q": "b", "trigger": False},
                ],
            }
        ),
        encoding="utf-8",
    )
    skill, queries = load_triggers(f)
    assert skill == "demo"
    assert len(queries) == 2
    assert queries[0] == Query(q="a", trigger=True)


def test_load_triggers_rejects_empty_queries(tmp_path: Path):
    f = tmp_path / "triggers.json"
    f.write_text(json.dumps({"skill": "demo", "queries": []}), encoding="utf-8")
    with pytest.raises(ValueError, match="zero queries"):
        load_triggers(f)


# -- metrics math ---------------------------------------------------------

def _qr(expected: bool, observed: bool) -> QueryResult:
    return QueryResult(
        q="q", expected=expected, observed=observed, loaded_skills=[], passed=expected == observed
    )


def test_compute_metrics_perfect():
    m = compute_metrics([_qr(True, True), _qr(True, True), _qr(False, False), _qr(False, False)])
    assert m.precision == 1.0 and m.recall == 1.0
    assert m.true_positive == 2 and m.false_positive == 0


def test_compute_metrics_misses_are_captured():
    # 1 TP, 1 FN, 1 FP, 1 TN
    m = compute_metrics([_qr(True, True), _qr(True, False), _qr(False, True), _qr(False, False)])
    assert m.precision == 0.5  # 1 / (1+1)
    assert m.recall == 0.5     # 1 / (1+1)
    assert m.false_positive == 1
    assert m.false_negative == 1


def test_compute_metrics_empty_safe():
    m = compute_metrics([])
    assert m.precision == 0.0 and m.recall == 0.0


def test_estimate_cost_known_model():
    cost = estimate_cost("claude-sonnet-4-5", 1_000_000, 1_000_000)
    assert cost == pytest.approx(3.0 + 15.0)


def test_estimate_cost_unknown_model_falls_back():
    cost = estimate_cost("some-new-model", 1_000_000, 0)
    assert cost == pytest.approx(3.0)  # default input price



# -- MockRouter + run_eval end-to-end -------------------------------------

def test_mock_router_returns_configured_list():
    def decide(_q, _s):
        return ["a", "b"]

    router = MockRouter(decide)
    loaded, in_tok, out_tok = router.route("any", [SkillMeta("a", "desc")])
    assert loaded == ["a", "b"]
    assert in_tok > 0 and out_tok == 16


def test_run_eval_with_mock_router_perfect():
    queries = [Query("pos", True), Query("neg", False)]
    skills = [SkillMeta("pilot", "d"), SkillMeta("other", "d")]

    def decide(q, _skills):
        return ["pilot"] if q == "pos" else ["other"]

    result = run_eval("pilot", queries, MockRouter(decide), skills, model="claude-sonnet-4-5")
    assert result.router == "mock"
    assert result.metrics.precision == 1.0
    assert result.metrics.recall == 1.0
    assert result.queries[0].observed is True
    assert result.queries[1].observed is False


def test_run_eval_with_mock_router_catches_false_positive():
    queries = [Query("pos", True), Query("neg", False)]
    skills = [SkillMeta("pilot", "d")]

    def decide(_q, _skills):  # always fires — overtriggers
        return ["pilot"]

    result = run_eval("pilot", queries, MockRouter(decide), skills)
    assert result.metrics.recall == 1.0
    assert result.metrics.precision == 0.5  # 1 TP / (1 TP + 1 FP)
    assert result.metrics.false_positive == 1


# -- AnthropicRouter with injected fake client ----------------------------

class _FakeUsage:
    def __init__(self, input_tokens: int, output_tokens: int):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class _FakeBlock:
    def __init__(self, text: str):
        self.text = text


class _FakeResponse:
    def __init__(self, text: str, in_tok: int = 100, out_tok: int = 20):
        self.content = [_FakeBlock(text)]
        self.usage = _FakeUsage(in_tok, out_tok)


class _FakeMessages:
    def __init__(self, canned_text: str):
        self._canned = canned_text
        self.last_kwargs: dict | None = None

    def create(self, **kwargs):
        self.last_kwargs = kwargs
        return _FakeResponse(self._canned)


class _FakeClient:
    def __init__(self, canned_text: str):
        self.messages = _FakeMessages(canned_text)


def test_anthropic_router_parses_clean_json():
    client = _FakeClient('{"would_load": ["pilot", "other"]}')
    router = AnthropicRouter(client=client)
    loaded, in_tok, out_tok = router.route("q", [SkillMeta("pilot", "d")])
    assert loaded == ["pilot", "other"]
    assert in_tok == 100 and out_tok == 20
    # Prompt carried the skill catalogue
    assert "pilot :: d" in client.messages.last_kwargs["system"]


def test_anthropic_router_tolerates_code_fence():
    client = _FakeClient('```json\n{"would_load": ["x"]}\n```')
    loaded, _, _ = AnthropicRouter(client=client).route("q", [])
    assert loaded == ["x"]


def test_parse_would_load_rejects_garbage():
    assert _parse_would_load("not json at all") == []
    assert _parse_would_load('{"something_else": []}') == []
    assert _parse_would_load('{"would_load": "not a list"}') == []


# -- CLI smoke test -------------------------------------------------------

def test_main_dry_run_on_real_pilot(tmp_path: Path, capsys):
    """End-to-end: runs main(--dry-run) against the committed eloquent
    triggers.json. MockRouter returns the pilot only for expected-True
    queries, so the run is 100% pass by construction. Validates wiring,
    not routing quality."""
    output = tmp_path / "run.json"
    exit_code = main(["--skill", "eloquent", "--dry-run", "--output", str(output)])
    assert exit_code == 0
    captured = capsys.readouterr()
    assert "Precision: 1.0" in captured.out
    assert "Recall:    1.0" in captured.out
    data = json.loads(output.read_text(encoding="utf-8"))
    assert data["skill"] == "eloquent"
    assert data["router"] == "mock"
    assert len(data["queries"]) == 10


def test_main_exits_2_on_missing_triggers_file():
    exit_code = main(["--skill", "nonexistent-skill-xyz", "--dry-run"])
    assert exit_code == 2


def test_write_result_produces_valid_json(tmp_path: Path):
    queries = [Query("x", True)]
    skills = [SkillMeta("pilot", "d")]
    result = run_eval("pilot", queries, MockRouter(lambda _q, _s: ["pilot"]), skills)
    out = tmp_path / "nested" / "last-run.json"
    write_result(result, out)
    assert out.exists()
    assert json.loads(out.read_text(encoding="utf-8"))["skill"] == "pilot"


# -- key gate -------------------------------------------------------------
#
# These tests cover the on-disk contract that install_anthropic_key.sh
# establishes and that load_anthropic_key() re-checks on every live run.

def _write_key(path: Path, content: str, mode: int = 0o600) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    path.chmod(mode)
    return path


def test_load_anthropic_key_happy_path(tmp_path: Path):
    key_path = _write_key(tmp_path / "k", "sk-ant-test-abc\n")
    assert load_anthropic_key(key_path) == "sk-ant-test-abc"


def test_load_anthropic_key_missing_file(tmp_path: Path):
    with pytest.raises(KeyGateError, match="not found"):
        load_anthropic_key(tmp_path / "absent")


def test_load_anthropic_key_rejects_group_readable(tmp_path: Path):
    key_path = _write_key(tmp_path / "k", "sk-ant-test\n", mode=0o640)
    with pytest.raises(KeyGateError, match="Unsafe permissions"):
        load_anthropic_key(key_path)


def test_load_anthropic_key_rejects_world_readable(tmp_path: Path):
    key_path = _write_key(tmp_path / "k", "sk-ant-test\n", mode=0o644)
    with pytest.raises(KeyGateError, match="Unsafe permissions"):
        load_anthropic_key(key_path)


def test_load_anthropic_key_rejects_empty(tmp_path: Path):
    key_path = _write_key(tmp_path / "k", "   \n")
    with pytest.raises(KeyGateError, match="empty"):
        load_anthropic_key(key_path)


def test_load_anthropic_key_rejects_wrong_prefix(tmp_path: Path):
    key_path = _write_key(tmp_path / "k", "sk-foo-bar\n")
    with pytest.raises(KeyGateError, match="sk-ant-"):
        load_anthropic_key(key_path)


# -- confirmation gate ----------------------------------------------------

class _TTY:
    """Fake stdin that reports as a tty and yields a canned line."""

    def __init__(self, line: str):
        self._line = line

    def isatty(self) -> bool:
        return True

    def readline(self) -> str:
        return self._line + "\n"


class _NonTTY:
    def isatty(self) -> bool:
        return False

    def readline(self) -> str:  # pragma: no cover - should never be called
        raise AssertionError("readline on non-tty must never be reached")


def test_require_confirmation_rejects_non_tty():
    import io
    with pytest.raises(ConfirmationAborted, match="interactive tty"):
        require_confirmation("x", stdin=_NonTTY(), stdout=io.StringIO())


def test_require_confirmation_rejects_wrong_answer():
    import io
    with pytest.raises(ConfirmationAborted, match="Aborted"):
        require_confirmation("x", stdin=_TTY("y"), stdout=io.StringIO())


def test_require_confirmation_rejects_empty():
    import io
    with pytest.raises(ConfirmationAborted):
        require_confirmation("x", stdin=_TTY(""), stdout=io.StringIO())


def test_require_confirmation_is_case_sensitive():
    import io
    with pytest.raises(ConfirmationAborted):
        require_confirmation("x", stdin=_TTY("YES"), stdout=io.StringIO())


def test_require_confirmation_accepts_exact_yes():
    import io
    out = io.StringIO()
    # Returns None on success; any exception = failure.
    require_confirmation("banner", stdin=_TTY("yes"), stdout=out)
    assert "banner" in out.getvalue()


# -- pre-estimate + summary -----------------------------------------------

def test_pre_estimate_cost_shape():
    skills = [SkillMeta(f"s{i}", f"desc {i} " * 5) for i in range(10)]
    queries = [Query("q " * 10, True) for _ in range(5)]
    in_tok, out_tok, cost = pre_estimate_cost("claude-sonnet-4-5", skills, queries)
    assert in_tok > 0 and out_tok > 0 and cost > 0
    # Linear in queries: doubling queries doubles both token counts.
    in2, out2, _ = pre_estimate_cost("claude-sonnet-4-5", skills, queries * 2)
    assert in2 == 2 * in_tok
    assert out2 == 2 * out_tok


def test_build_confirmation_summary_contains_key_fields(tmp_path: Path):
    s = build_confirmation_summary(
        model="claude-sonnet-4-5",
        skill="pilot",
        query_count=10,
        catalogue_size=100,
        input_tokens=12_345,
        output_tokens=600,
        cost_usd=0.04,
        key_path=tmp_path / "anthropic.key",
    )
    assert "claude-sonnet-4-5" in s
    assert "pilot" in s
    assert "10" in s  # query count
    assert "12,345" in s  # formatted tokens
    assert "$0.04" in s
    assert str(tmp_path / "anthropic.key") in s


# -- AnthropicRouter API-key contract -------------------------------------

def test_anthropic_router_requires_api_key_or_client():
    with pytest.raises(RuntimeError, match="explicit api_key"):
        AnthropicRouter(model="claude-sonnet-4-5")


def test_anthropic_router_accepts_injected_client():
    # Injected client path bypasses the api_key requirement. Used by
    # unit tests that exercise routing logic without an SDK dependency.
    class _FakeClient:
        pass
    router = AnthropicRouter(model="claude-sonnet-4-5", client=_FakeClient())
    assert router is not None


# -- main() live-path gates -----------------------------------------------

def test_main_live_aborts_when_key_missing(tmp_path: Path, capsys):
    """Live path (no --dry-run) must fail fast if the key file is absent,
    before any router is instantiated or API call is attempted."""
    exit_code = main([
        "--skill", "eloquent",
        "--key-path", str(tmp_path / "absent"),
    ])
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "not found" in err
