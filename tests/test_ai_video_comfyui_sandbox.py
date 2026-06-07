"""ADR-060 — ComfyUI sandbox-model invariants.

The local ComfyUI adapter is only acceptable under the ADR-060 sandbox
model. These tests pin the load-bearing properties so a future edit
cannot silently reopen the arbitrary-Python door:

1. Shipped templates only — every manifest entry's ``template`` resolves
   inside ``lib/comfyui-templates/`` and parses.
2. Pinned-node allowlist — every ``class_type`` referenced by a shipped
   template is allowlisted (core or a pinned custom node). This is the
   hard-refuse invariant; an unpinned node in a template is a test
   failure before it can ever be a runtime hole.
3. Allowlist hygiene — custom-node entries (when any exist) pin
   ``repo`` + 40-hex ``commit`` and carry a ``risk_tier``.
4. No bypass flag — the adapter source contains no
   ``allow-unaudited-nodes`` style escape hatch.
5. Posture gate — a non-loopback endpoint without
   ``<unsandboxed>accepted</unsandboxed>`` is refused (exit 6) before
   any network call.
6. Local render cost — the dry-run fixture reports the known-zero
   ``cost_estimate`` of 0.0 (never omitted-as-unknown for local).
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
LIB_DIR = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib"
ADAPTER = REPO_ROOT / "src" / "scripts" / "ai-video" / "adapters" / "comfyui.sh"
ALLOWLIST = LIB_DIR / "comfyui-nodes.allowlist.json"
MANIFEST = LIB_DIR / "model-capabilities" / "comfyui.json"
TEMPLATE_DIR = LIB_DIR / "comfyui-templates"


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _allowed_class_types() -> set[str]:
    allowlist = _load(ALLOWLIST)
    allowed = set(allowlist["core_class_types"])
    for node in allowlist.get("custom_nodes", []):
        allowed.update(node.get("class_types", []))
    return allowed


# ---------------------------------------------------------------------------
# Templates — shipped only, parseable, fully allowlisted
# ---------------------------------------------------------------------------

def test_manifest_templates_resolve_inside_template_dir() -> None:
    models = _load(MANIFEST)["models"]
    assert models, "comfyui manifest must list at least one model"
    for model_id, entry in models.items():
        rel = entry["template"]
        assert rel.startswith("comfyui-templates/"), (
            f"{model_id}: template must live under comfyui-templates/ (got {rel})"
        )
        assert (LIB_DIR / rel).is_file(), f"{model_id}: missing template {rel}"


@pytest.mark.parametrize("template", sorted(TEMPLATE_DIR.glob("*.json")), ids=lambda p: p.stem)
def test_every_template_node_is_allowlisted(template: Path) -> None:
    """ADR-060 §2 hard-refuse invariant, enforced at test time too."""
    data = _load(template)
    allowed = _allowed_class_types()
    used = {node["class_type"] for node in data["prompt"].values()}
    unknown = used - allowed
    assert not unknown, (
        f"{template.name} references non-allowlisted node(s): {sorted(unknown)} — "
        f"pin them in {ALLOWLIST.name} (ADR-060: no bypass flag)"
    )


@pytest.mark.parametrize("template", sorted(TEMPLATE_DIR.glob("*.json")), ids=lambda p: p.stem)
def test_template_meta_carries_unverified_flag_and_aspect_map(template: Path) -> None:
    meta = _load(template)["_meta"]
    assert meta["verified"] is False, (
        f"{template.name}: verified must stay false until re-exported from a live ComfyUI"
    )
    assert meta["aspect_map"], f"{template.name}: aspect_map required"
    for aspect, dims in meta["aspect_map"].items():
        assert set(dims) == {"width", "height"}, f"{template.name}: bad aspect entry {aspect}"


# ---------------------------------------------------------------------------
# Allowlist hygiene
# ---------------------------------------------------------------------------

def test_custom_node_entries_are_pinned() -> None:
    for node in _load(ALLOWLIST).get("custom_nodes", []):
        assert node.get("repo", "").startswith("https://"), f"unpinned repo: {node}"
        commit = node.get("commit", "")
        assert len(commit) == 40 and all(c in "0123456789abcdef" for c in commit), (
            f"custom node must pin a 40-hex git commit SHA: {node}"
        )
        assert node.get("risk_tier") in {"low", "medium", "high"}, (
            f"custom node must carry risk_tier low|medium|high: {node}"
        )
        assert node.get("class_types"), f"custom node must declare its class_types: {node}"


def test_adapter_has_no_bypass_flag() -> None:
    source = ADAPTER.read_text(encoding="utf-8")
    assert "allow-unaudited-nodes" not in source.replace("no bypass", "")
    # The hard-refuse path must exist and name the allowlist.
    assert "non-allowlisted node" in source
    assert "comfyui-nodes.allowlist.json" in source


# ---------------------------------------------------------------------------
# Posture gate + local cost semantics (bash)
# ---------------------------------------------------------------------------

bash_required = pytest.mark.skipif(
    shutil.which("bash") is None or shutil.which("jq") is None,
    reason="adapter execution requires bash + jq",
)


def _run_adapter(*argv: str, env: dict[str, str], stdin: str | None = None):
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(ADAPTER), *argv],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin", **env},
        check=False,
    )


@bash_required
def test_non_loopback_endpoint_without_marker_is_refused(tmp_path: Path) -> None:
    if shutil.which("xmllint") is None:
        pytest.skip("posture-gate XML test requires xmllint")
    config = tmp_path / "ai-video.xml"
    config.write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<ai-video version="1">
  <provider id="comfyui" kind="video">
    <lifecycle>experimental</lifecycle>
    <enabled>true</enabled>
    <endpoint>http://10.0.0.5:8188</endpoint>
    <default-model>wan22-ti2v-5b</default-model>
  </provider>
</ai-video>
"""
    )
    res = _run_adapter(
        "submit",
        env={"AIV_DRYRUN": "false", "AIV_CONFIG_PATH": str(config)},
        stdin='{"prompt":{"subject":"x","action":"y"}}',
    )
    assert res.returncode == 6, res.stderr
    assert "unsandboxed" in res.stderr


@bash_required
def test_live_submit_refused_under_dryrun_default() -> None:
    res = _run_adapter(
        "submit", env={"AIV_DRYRUN": "true"}, stdin='{"prompt":{"subject":"x","action":"y"}}'
    )
    assert res.returncode == 4


def test_dry_run_fixture_reports_known_zero_cost() -> None:
    fixture = _load(LIB_DIR / "fixtures" / "comfyui" / "result.json")
    assert fixture["cost_estimate"] == 0.0
    assert fixture["audio_embedded"] is False
