"""Tests for the pack-ai-image scaffold adapters (src/scripts/ai-image/adapters/).

Phase A.2 (provider layer) of road-to-image-brand-typography. Proves the
shared media substrate extracted in A.1 (scripts/media/lib) drives a NEW
image domain end-to-end: each scaffold-tier adapter resolves through the
domain-neutral smoke harness, runs capability + dry-run without network/spend,
emits a contract-shaped stdout pointing at a real fixture, and validates that
artifact path against the v2 trust boundary.

Live submit/poll/fetch are NOT wired at scaffold tier (an honest "not wired"
failure); promotion to stable is a maintainer Hard-Floor smoke trace.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "src" / "scripts" / "ai-video" / "smoke-trace.sh"
ADAPTER_DIR = ROOT / "src" / "scripts" / "ai-image" / "adapters"
IMAGE_PROVIDERS = ["gemini-image", "ideogram", "flux", "recraft"]

pytestmark = pytest.mark.skipif(
    not (shutil.which("jq") and shutil.which("bash")),
    reason="smoke-trace harness needs bash + jq",
)


def _run(tmp_path: Path, provider: str):
    res = subprocess.run(
        ["bash", str(HARNESS), "--provider", provider, "--out", str(tmp_path)],
        capture_output=True, text=True, cwd=ROOT,
    )
    traces = list(tmp_path.glob(f"{provider}-dry-run-*.json"))
    assert traces, f"no trace written for {provider}: {res.stderr}"
    return res, json.loads(traces[0].read_text())


@pytest.mark.parametrize("provider", IMAGE_PROVIDERS)
def test_dry_run_resolves_and_writes_valid_trace(tmp_path, provider):
    """The domain-neutral harness resolves the ai-image adapter and runs dry-run."""
    res, trace = _run(tmp_path, provider)
    assert res.returncode == 0, res.stderr
    assert trace["provider"] == provider
    assert trace["mode"] == "dry-run"
    assert trace["success"] is True
    # Scaffold tier — declared in the adapter's Lifecycle: header.
    assert trace["lifecycle_tier"] == "experimental"
    # The image artifact path resolved from the fixture and passed the
    # v2 trust-boundary validation (real file, under root, no traversal).
    assert trace["artifact_path_validated"] == "true"


@pytest.mark.parametrize("provider", IMAGE_PROVIDERS)
def test_dry_run_emits_image_artifact(tmp_path, provider):
    """dry-run stdout points at a real fixture image/SVG under the repo root."""
    res = subprocess.run(
        ["bash", str(ADAPTER_DIR / f"{provider}.sh"), "dry-run"],
        capture_output=True, text=True, cwd=ROOT,
    )
    assert res.returncode == 0, res.stderr
    payload = json.loads(res.stdout)
    assert "image_path" in payload, f"{provider}: dry-run missing image_path"
    artifact = ROOT / payload["image_path"]
    assert artifact.is_file(), f"{provider}: missing fixture {artifact}"


@pytest.mark.parametrize("provider", IMAGE_PROVIDERS)
def test_sources_shared_substrate_and_scaffold_only(provider):
    """Each adapter sources the neutral media substrate and refuses live calls."""
    body = (ADAPTER_DIR / f"{provider}.sh").read_text()
    assert "media/lib/adapter-common.sh" in body, (
        f"{provider}: must source the shared scripts/media/lib substrate"
    )
    assert "Lifecycle: experimental" in body, f"{provider}: scaffold tier not declared"
    # Live path must be an honest "not wired" refusal at scaffold tier.
    res = subprocess.run(
        ["bash", str(ADAPTER_DIR / f"{provider}.sh"), "submit"],
        input='{}', capture_output=True, text=True, cwd=ROOT,
    )
    assert res.returncode != 0, f"{provider}: live submit must fail at scaffold tier"
    assert "not wired" in res.stderr.lower()
