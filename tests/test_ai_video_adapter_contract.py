"""Phase 4 Step 4 — AI-video adapter contract tests.

Every adapter under ``scripts/ai-video/adapters/`` MUST honour the
single-source-of-truth contract at
``scripts/media/lib/adapter-contract.md``. These tests pin the
load-bearing properties so a future adapter cannot silently drift:

1. Strict-mode shebang + ``set -euo pipefail`` + sourcing the common lib.
2. ``capability`` subcommand returns a JSON object with an ``audio``
   field whose value is one of ``native | none | per-model``.
3. ``dry-run`` subcommand emits the canonical stdout JSON shape
   without a network call (``AIV_DRYRUN=true`` is the default).
4. ``audio_embedded`` in the dry-run fixture matches the declared
   ``audio`` capability (native → true, none → false).
5. ``AIV_DRYRUN=true`` refuses a live ``submit`` with exit 4 and a
   redacted stderr message.
6. Unknown subcommand exits 2 with a named error on stderr
   (fail-closed dispatch).
7. Every adapter carries a ``Lifecycle:`` marker in its header
   comment so the agent can surface the tier before defaulting.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
ADAPTER_DIR = REPO_ROOT / "src" / "scripts" / "ai-video" / "adapters"
COMMON_LIB = REPO_ROOT / "src" / "scripts" / "media" / "lib" / "adapter-common.sh"
CONTRACT = REPO_ROOT / "src" / "scripts" / "media" / "lib" / "adapter-contract.md"

ADAPTERS = sorted(p.stem for p in ADAPTER_DIR.glob("*.sh"))
VALID_AUDIO = {"native", "none", "per-model"}
VALID_LIFECYCLE = {"experimental", "beta", "stable", "deprecated"}


pytestmark = pytest.mark.skipif(
    shutil.which("bash") is None,
    reason="adapter contract requires bash; not available on this host.",
)


def _adapter_path(adapter_id: str) -> Path:
    return ADAPTER_DIR / f"{adapter_id}.sh"


def _run_adapter(
    adapter_id: str, *argv: str, env_dryrun: str = "true"
) -> subprocess.CompletedProcess[str]:
    """Invoke an adapter subcommand. Default ``AIV_DRYRUN=true``."""
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(_adapter_path(adapter_id)), *argv],
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": "/usr/bin:/bin", "AIV_DRYRUN": env_dryrun},
        check=False,
    )


# ---------------------------------------------------------------------------
# Discovery + structural shape
# ---------------------------------------------------------------------------

def test_adapter_directory_is_populated() -> None:
    """Smoke-check: the adapter directory has at least one script.

    Catches an accidental directory wipe / rename — the rest of the
    tests would parametrize over an empty set and silently pass.
    """
    assert ADAPTERS, f"no adapters discovered under {ADAPTER_DIR}"


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_adapter_uses_strict_mode_and_sources_common_lib(adapter: str) -> None:
    """Every adapter MUST start with the strict-mode shebang and source
    ``adapter-common.sh`` — that is the single contract surface.
    """
    body = _adapter_path(adapter).read_text(encoding="utf-8")
    assert body.startswith("#!/usr/bin/env bash"), (
        f"{adapter}: missing bash shebang"
    )
    assert "set -euo pipefail" in body, (
        f"{adapter}: missing strict-mode flags (set -euo pipefail)"
    )
    assert "adapter-common.sh" in body, (
        f"{adapter}: does not source adapter-common.sh — common contract "
        "dispatch + redaction wiring lost"
    )


# ---------------------------------------------------------------------------
# Capability subcommand
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_capability_returns_valid_audio_flag(adapter: str) -> None:
    """``capability`` subcommand returns a JSON object whose ``audio``
    field is one of the three contract values.
    """
    result = _run_adapter(adapter, "capability")
    assert result.returncode == 0, (
        f"{adapter}: capability exit={result.returncode} "
        f"stderr={result.stderr!r}"
    )
    payload = json.loads(result.stdout)
    assert "audio" in payload, f"{adapter}: capability JSON missing 'audio'"
    assert payload["audio"] in VALID_AUDIO, (
        f"{adapter}: audio={payload['audio']!r} not in {VALID_AUDIO}"
    )


# ---------------------------------------------------------------------------
# Dry-run subcommand
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_dry_run_emits_contract_shaped_stdout(adapter: str) -> None:
    """``dry-run`` emits the contract JSON (``video_path``,
    ``audio_embedded``) without a network call. The fixture file must
    exist on disk so the orchestrator can mux it.
    """
    result = _run_adapter(adapter, "dry-run")
    assert result.returncode == 0, (
        f"{adapter}: dry-run exit={result.returncode} "
        f"stderr={result.stderr!r}"
    )
    payload = json.loads(result.stdout)
    assert "video_path" in payload, f"{adapter}: dry-run missing video_path"
    assert "audio_embedded" in payload, (
        f"{adapter}: dry-run missing audio_embedded"
    )
    assert isinstance(payload["audio_embedded"], bool), (
        f"{adapter}: audio_embedded must be a bool"
    )
    fixture = REPO_ROOT / payload["video_path"]
    assert fixture.is_file(), (
        f"{adapter}: dry-run points at missing fixture {fixture}"
    )


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_dry_run_surfaces_cost_estimate(adapter: str) -> None:
    """Phase 3 — cost transparency. ``dry-run`` MUST surface a numeric
    ``cost_estimate`` (modeled per-job USD) so the batch cost gate can sum
    it across scenes before any live call and the ``--max-spend-usd``
    kill-switch has a number to enforce against. The contract treats a
    *missing* estimate as ``unknown`` (never ``0``); the committed fixtures
    carry a representative modeled value so the dry-run gate is exercisable.
    """
    payload = json.loads(_run_adapter(adapter, "dry-run").stdout)
    assert "cost_estimate" in payload, (
        f"{adapter}: dry-run missing cost_estimate (batch cost gate would "
        f"show this scene as 'unknown')"
    )
    cost = payload["cost_estimate"]
    assert isinstance(cost, (int, float)) and not isinstance(cost, bool), (
        f"{adapter}: cost_estimate must be a number, got {cost!r}"
    )
    assert cost >= 0, f"{adapter}: cost_estimate must be non-negative, got {cost}"


def test_contract_documents_cost_estimate() -> None:
    """The contract is the single source of truth for the field."""
    text = CONTRACT.read_text()
    assert "cost_estimate" in text, "adapter-contract.md must document cost_estimate"
    assert "--max-spend-usd" in text or "max-spend" in text.lower(), (
        "adapter-contract.md must reference the spend cap the field feeds"
    )


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_capability_and_dry_run_audio_embedded_are_coherent(adapter: str) -> None:
    """``capability.audio`` and ``dry-run.audio_embedded`` MUST agree:

    - ``native`` → fixture is muxed → ``audio_embedded: true``.
    - ``none`` → fixture is video-only → ``audio_embedded: false``.
    - ``per-model`` is skipped (audio is preset-dependent and surfaced
      via ``capability --preset <name>`` per the contract).
    """
    cap = json.loads(_run_adapter(adapter, "capability").stdout)
    if cap["audio"] == "per-model":
        pytest.skip(f"{adapter}: per-model audio is preset-dependent")
    dry = json.loads(_run_adapter(adapter, "dry-run").stdout)
    expected = cap["audio"] == "native"
    assert dry["audio_embedded"] is expected, (
        f"{adapter}: capability.audio={cap['audio']!r} disagrees with "
        f"dry-run.audio_embedded={dry['audio_embedded']!r}"
    )


# ---------------------------------------------------------------------------
# Live-call safety + fail-closed dispatch
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_live_submit_refused_under_dryrun(adapter: str) -> None:
    """``AIV_DRYRUN=true`` MUST block any network-bound subcommand.

    The shared ``aiv_assert_dryrun`` exits 4 with a redacted message.
    Adapters that collapse submit/poll/fetch into ``run`` (e.g.
    openai-images) refuse on ``run`` instead.
    """
    body = _adapter_path(adapter).read_text(encoding="utf-8")
    sub = "run" if "aiv_cmd_run" in body else "submit"
    result = _run_adapter(adapter, sub)
    assert result.returncode == 4, (
        f"{adapter}: live {sub} not refused under AIV_DRYRUN=true "
        f"(exit={result.returncode} stderr={result.stderr!r})"
    )
    assert "live call refused" in result.stderr, (
        f"{adapter}: refusal message missing 'live call refused' "
        f"sentinel (stderr={result.stderr!r})"
    )


@pytest.mark.parametrize("adapter", ADAPTERS)
def test_unknown_subcommand_is_rejected_fail_closed(adapter: str) -> None:
    """An unknown subcommand MUST exit 2 with a named error so the
    orchestrator cannot silently no-op on a typo.
    """
    result = _run_adapter(adapter, "nonsense-subcommand")
    assert result.returncode == 2, (
        f"{adapter}: unknown subcommand not rejected with exit 2 "
        f"(exit={result.returncode} stderr={result.stderr!r})"
    )
    assert "unknown subcommand" in result.stderr, (
        f"{adapter}: rejection message missing 'unknown subcommand' "
        f"sentinel (stderr={result.stderr!r})"
    )


# ---------------------------------------------------------------------------
# Lifecycle marker — provider-lifecycle-discipline
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("adapter", ADAPTERS)
def test_adapter_declares_lifecycle_tier(adapter: str) -> None:
    """Every adapter MUST carry a ``Lifecycle:`` header so the agent can
    surface the tier (experimental / beta / stable / deprecated) before
    defaulting to that provider. Enforces
    ``provider-lifecycle-discipline``.
    """
    body = _adapter_path(adapter).read_text(encoding="utf-8")
    marker = None
    for line in body.splitlines()[:30]:
        stripped = line.lstrip("# ").strip()
        if stripped.lower().startswith("lifecycle:"):
            marker = stripped.split(":", 1)[1].strip().split()[0].lower().rstrip(",.;")
            break
    assert marker is not None, (
        f"{adapter}: no 'Lifecycle:' marker in the first 30 lines"
    )
    assert marker in VALID_LIFECYCLE, (
        f"{adapter}: lifecycle tier {marker!r} not in {VALID_LIFECYCLE}"
    )


# --- Audio-ownership contract surfaces (issue #180) -----------------------


def test_audio_ownership_contract_is_documented() -> None:
    """The three-layer audio ownership (blueprint = intent, encoder =
    translation, orchestrator = validation) must stay documented in
    the adapter contract — it is the semantic counterpart of the
    structural capability ↔ dry-run coherence test above.
    """
    text = CONTRACT.read_text(encoding="utf-8")
    assert "## Audio ownership" in text, (
        "adapter-contract.md lost the § Audio ownership section (issue #180)"
    )
    for phrase in (
        "contract commitment",
        "AUDIO DOWNGRADE",
        "requires.audio_native",
    ):
        assert phrase in text, (
            f"adapter-contract.md § Audio ownership lost the {phrase!r} clause"
        )


def test_encoder_documents_mandatory_downgrade_warning() -> None:
    """motion-choreographer must mandate the AUDIO DOWNGRADE warning
    block for the audio=none + dialogue case — silent dialogue loss is
    the failure mode issue #180 closes.
    """
    sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
    from _lib.agent_src import resolve_logical

    mc = resolve_logical("skills/motion-choreographer/SKILL.md")
    assert mc is not None, "motion-choreographer SKILL.md not found"
    text = mc.read_text(encoding="utf-8")
    assert "AUDIO DOWNGRADE" in text, (
        "motion-choreographer lost the mandatory AUDIO DOWNGRADE warning"
    )
    assert "never validates" in text or "NEVER silently strips" in text, (
        "motion-choreographer must state the translator-not-validator boundary"
    )


def test_orchestrator_documents_audio_preflight_gate() -> None:
    """The /video:scene flow must carry the audio pre-flight gate —
    the runtime guard that surfaces dialogue loss before spend.
    """
    sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
    from _lib.agent_src import resolve_logical

    cmd = resolve_logical("commands/video/scene.md")
    assert cmd is not None, "video/scene command not found"
    text = cmd.read_text(encoding="utf-8")
    assert "Audio pre-flight gate" in text, (
        "/video:scene lost the audio pre-flight gate step (issue #180)"
    )
    assert "audio-native provider" in text and "override and attempt anyway" in text, (
        "/video:scene audio gate lost its numbered options"
    )
