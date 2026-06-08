"""Tests for ``src/cli/python/workspace_render.py`` (ADR-069 prompt renderer).

The renderer fills ``{{name}}`` placeholders in a role prompt from a caller
input map. Council-fixed behaviour (2026-06-08): missing-required → error,
missing-optional → empty string (heading stays), unknown placeholder → error,
single-pass literal substitution, skill_hint carried through (never appended).
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_render.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_render", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_render"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def wr():
    return _load()


def _write_prompt(root: Path, role: str, name: str, body: str) -> Path:
    d = root / role / "prompts"
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{name}.md"
    p.write_text(body, encoding="utf-8")
    return p


PROMPT = """---
name: memo
intent: "Frame a decision."
inputs:
  - name: context
    required: true
    shape: "one paragraph"
  - name: known_constraints
    required: false
    shape: "free text"
skill_hint: scenario-modeling
---
Decision context:

{{context}}

**Constraints**

{{known_constraints}}
"""


def test_render_fills_required_and_carries_skill_hint(wr, tmp_path):
    _write_prompt(tmp_path, "lead", "memo", PROMPT)
    out = wr.render("lead", "memo", {"context": "Ship or wait?", "known_constraints": "tight budget"}, root=tmp_path)
    assert "Ship or wait?" in out["rendered"]
    assert "tight budget" in out["rendered"]
    assert "{{" not in out["rendered"]
    assert out["skill_hint"] == "scenario-modeling"          # carried, NOT appended
    assert "## Skill context" not in out["rendered"]         # renderer stays pure


def test_missing_optional_becomes_empty_heading_stays(wr, tmp_path):
    _write_prompt(tmp_path, "lead", "memo", PROMPT)
    out = wr.render("lead", "memo", {"context": "X"}, root=tmp_path)
    assert "**Constraints**" in out["rendered"]              # heading NOT stripped
    assert "{{known_constraints}}" not in out["rendered"]    # placeholder gone (empty)


def test_missing_required_raises(wr, tmp_path):
    _write_prompt(tmp_path, "lead", "memo", PROMPT)
    with pytest.raises(wr.PromptError, match="context"):
        wr.render("lead", "memo", {}, root=tmp_path)


def test_blank_required_counts_as_missing(wr, tmp_path):
    _write_prompt(tmp_path, "lead", "memo", PROMPT)
    with pytest.raises(wr.PromptError, match="context"):
        wr.render("lead", "memo", {"context": "   "}, root=tmp_path)


def test_unknown_placeholder_raises(wr, tmp_path):
    _write_prompt(tmp_path, "lead", "bad", """---
name: bad
inputs:
  - name: a
    required: true
---
{{a}} and {{undeclared}}
""")
    with pytest.raises(wr.PromptError, match="undeclared"):
        wr.render("lead", "bad", {"a": "x"}, root=tmp_path)


def test_single_pass_no_reexpansion(wr, tmp_path):
    # A value that itself contains a brace token must NOT be re-expanded.
    _write_prompt(tmp_path, "lead", "inj", """---
name: inj
inputs:
  - name: a
    required: true
  - name: b
    required: false
---
{{a}} | {{b}}
""")
    out = wr.render("lead", "inj", {"a": "{{b}}", "b": "SECRET"}, root=tmp_path)
    # The literal `{{b}}` injected via a's value is NOT re-expanded; the real
    # `{{b}}` placeholder in the template IS filled. Single pass = no recursion.
    assert out["rendered"].strip() == "{{b}} | SECRET"


def test_missing_prompt_raises(wr, tmp_path):
    (tmp_path / "lead").mkdir()
    with pytest.raises(wr.PromptError, match="not found"):
        wr.render("lead", "ghost", {}, root=tmp_path)


def test_load_prompt_parses_inputs_spec(wr, tmp_path):
    _write_prompt(tmp_path, "lead", "memo", PROMPT)
    spec = wr.load_prompt("lead", "memo", root=tmp_path)
    assert spec["name"] == "memo"
    assert spec["skill_hint"] == "scenario-modeling"
    names = [i["name"] for i in spec["inputs"]]
    assert names == ["context", "known_constraints"]
    assert spec["inputs"][0]["required"] is True
    assert spec["inputs"][1]["required"] is False


# --- CLI surface -----------------------------------------------------------

def test_cli_root_must_be_roles_dir(wr, tmp_path):
    bad = tmp_path / "not-roles"
    bad.mkdir()
    with pytest.raises(SystemExit, match="roles"):
        wr.main(["render", "--role", "lead", "--prompt", "memo", "--root", str(bad)])


def test_cli_render_with_inputs_json(wr, tmp_path, capsys):
    roles = tmp_path / "roles"
    _write_prompt(roles, "lead", "memo", PROMPT)
    inputs = tmp_path / "in.json"
    inputs.write_text(json.dumps({"context": "CLI ctx"}), encoding="utf-8")
    rc = wr.main(["render", "--role", "lead", "--prompt", "memo",
                  "--inputs-json", str(inputs), "--root", str(roles), "--json"])
    assert rc == 0
    res = json.loads(capsys.readouterr().out)
    assert "CLI ctx" in res["rendered"]
    assert res["skill_hint"] == "scenario-modeling"


def test_cli_render_missing_required_exits_1(wr, tmp_path, capsys):
    roles = tmp_path / "roles"
    _write_prompt(roles, "lead", "memo", PROMPT)
    rc = wr.main(["render", "--role", "lead", "--prompt", "memo", "--root", str(roles)])
    assert rc == 1
    assert "context" in capsys.readouterr().err


def test_cli_inspect_json(wr, tmp_path, capsys):
    roles = tmp_path / "roles"
    _write_prompt(roles, "lead", "memo", PROMPT)
    rc = wr.main(["inspect", "--role", "lead", "--prompt", "memo", "--root", str(roles), "--json"])
    assert rc == 0
    meta = json.loads(capsys.readouterr().out)
    assert meta["skill_hint"] == "scenario-modeling"
    assert len(meta["inputs"]) == 2


def test_render_against_real_shipped_prompt(wr):
    # Locks the parse against a real role prompt (risk-analysis-memo, leadership).
    out = wr.render(
        "leadership", "risk-analysis-memo",
        {"context": "C", "decision_on_table": "D", "known_constraints": "K"},
    )
    assert "C" in out["rendered"] and "D" in out["rendered"]
    assert out["skill_hint"] == "scenario-modeling"
