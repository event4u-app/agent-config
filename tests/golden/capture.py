"""Generate Capture Packs for every Golden Transcript scenario.

Run from the repo root::

    python3 -m tests.golden.capture

The script is **not** part of the locked baseline. It produces the
artefacts under ``tests/golden/baseline/GT-N/`` and refreshes the
checksum manifest. Whenever the engine's observable behaviour
changes, the maintainer re-runs this driver and reviews the diff
against the previous baseline before committing the new lock.

The driver is also re-runnable as a regression check: produce a
fresh ``tests/golden/.staging/`` tree, diff it against the locked
baseline, fail if they disagree. That mode is wired in
``tests/golden/test_lock.py``.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import shutil
import sys
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .sandbox import runner

RECIPE_MODULES = (
    "tests.golden.sandbox.recipes.gt1_happy",
    "tests.golden.sandbox.recipes.gt2_ambiguity",
    "tests.golden.sandbox.recipes.gt3_recovery",
    "tests.golden.sandbox.recipes.gt4_persona_refusal",
    "tests.golden.sandbox.recipes.gt5_state_resume",
    "tests.golden.sandbox.recipes.gt_p1_high",
    "tests.golden.sandbox.recipes.gt_p2_medium",
    "tests.golden.sandbox.recipes.gt_p3_low",
    "tests.golden.sandbox.recipes.gt_p4_ui_rejection",
)

GOLDEN_ROOT = Path(__file__).resolve().parent
BASELINE_ROOT = GOLDEN_ROOT / "baseline"
CHECKSUM_FILE = GOLDEN_ROOT / "CHECKSUMS.txt"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="golden-capture")
    parser.add_argument(
        "--target",
        type=Path,
        default=BASELINE_ROOT,
        help="Where to write Capture Packs (default: tests/golden/baseline).",
    )
    parser.add_argument(
        "--checksums",
        type=Path,
        default=CHECKSUM_FILE,
        help="Where to write the SHA256 manifest.",
    )
    parser.add_argument(
        "--scenarios",
        nargs="*",
        default=None,
        help="Optional GT ids to run (default: all five).",
    )
    args = parser.parse_args(argv)

    if args.target.exists():
        shutil.rmtree(args.target)
    args.target.mkdir(parents=True, exist_ok=True)

    selected = set(args.scenarios) if args.scenarios else None
    summary: list[dict[str, Any]] = []
    for module_name in RECIPE_MODULES:
        module = importlib.import_module(module_name)
        meta = module.META
        if selected and meta["gt_id"] not in selected:
            continue
        print(f"=== {meta['gt_id']} ({module_name}) ===", file=sys.stderr)
        result = _run_one(module)
        pack_dir = args.target / meta["gt_id"]
        _write_pack(pack_dir, result, meta)
        summary.append({
            "gt_id": meta["gt_id"],
            "outcome": result.final_outcome,
            "exit_code": result.final_exit_code,
            "cycles": len(result.cycles),
        })

    (args.target / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )
    _write_checksums(args.target, args.checksums)
    print(f"\nwrote {len(summary)} capture pack(s) to {args.target}",
          file=sys.stderr)
    print(f"checksum manifest: {args.checksums}", file=sys.stderr)
    return 0


def _run_one(module) -> runner.CaptureResult:
    meta = module.META
    ticket_file, prompt_file = _resolve_inputs(meta)

    with tempfile.TemporaryDirectory(prefix=f"golden-{meta['gt_id']}-") as tmp:
        workspace = Path(tmp) / "ws"
        recipe = module.build_recipe(workspace)
        return runner.run_capture(
            gt_id=meta["gt_id"],
            ticket_file=ticket_file,
            prompt_file=prompt_file,
            workspace=workspace,
            recipe=recipe,
            persona=meta.get("persona"),
            cycle_cap=meta.get("cycle_cap", runner.DEFAULT_CYCLE_CAP),
        )


def _resolve_inputs(meta: dict[str, Any]) -> tuple[Path | None, Path | None]:
    """Mirror of :func:`tests.golden.harness._resolve_inputs`.

    Two implementations is the lesser evil here — capture and harness
    share no module above the sandbox runner, and reaching across into
    the harness from capture (or vice versa) would couple them by
    import order. The contract is one line; keeping it duplicated is
    cheaper than introducing a new shared module just for this helper.
    """
    ticket_rel = meta.get("ticket_relpath")
    prompt_rel = meta.get("prompt_relpath")
    if (ticket_rel is None) == (prompt_rel is None):
        raise ValueError(
            f"META for {meta.get('gt_id')!r} must declare exactly one of "
            "'ticket_relpath' / 'prompt_relpath'; got "
            f"ticket_relpath={ticket_rel!r}, prompt_relpath={prompt_rel!r}",
        )
    if ticket_rel is not None:
        return runner.SANDBOX_ROOT / ticket_rel, None
    return None, runner.SANDBOX_ROOT / prompt_rel


def _write_pack(pack_dir: Path, result: runner.CaptureResult, meta: dict) -> None:
    pack_dir.mkdir(parents=True, exist_ok=True)
    snapshots_dir = pack_dir / "state-snapshots"
    snapshots_dir.mkdir(exist_ok=True)
    fixture_dir = pack_dir / "fixture"
    fixture_dir.mkdir(exist_ok=True)

    transcript = runner.serialise_capture(result)
    (pack_dir / "transcript.json").write_text(
        json.dumps(transcript, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    halt_markers = []
    exit_codes = []
    for cycle in result.cycles:
        snap_path = snapshots_dir / f"cycle-{cycle.index:02d}.json"
        snap_path.write_text(
            json.dumps(cycle.state_after, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        halt_markers.append({
            "cycle": cycle.index,
            "exit_code": cycle.exit_code,
            "directive": cycle.directive,
            "recipe_action": cycle.recipe_action,
            "questions": cycle.state_after.get("questions") or [],
        })
        exit_codes.append({
            "cycle": cycle.index,
            "exit_code": cycle.exit_code,
        })

    (pack_dir / "halt-markers.json").write_text(
        json.dumps(halt_markers, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    (pack_dir / "exit-codes.json").write_text(
        json.dumps(exit_codes, indent=2) + "\n",
        encoding="utf-8",
    )

    final_state = result.cycles[-1].state_after if result.cycles else {}
    report = final_state.get("report") or ""
    (pack_dir / "delivery-report.md").write_text(
        report.rstrip() + "\n" if report else "_(no delivery report — flow halted)_\n",
        encoding="utf-8",
    )

    fixture_relpath = meta.get("ticket_relpath") or meta.get("prompt_relpath")
    fixture_src = runner.SANDBOX_ROOT / fixture_relpath
    shutil.copy2(fixture_src, fixture_dir / Path(fixture_relpath).name)

    notes = _reproduction_notes(meta, result)
    (pack_dir / "reproduction-notes.md").write_text(notes, encoding="utf-8")


def _reproduction_notes(meta: dict, result: runner.CaptureResult) -> str:
    ticket_rel = meta.get("ticket_relpath")
    prompt_rel = meta.get("prompt_relpath")
    if ticket_rel is not None:
        fixture_line = f"- ticket fixture: `tests/golden/sandbox/{ticket_rel}`"
        invocation = "`./agent-config implement-ticket`"
    else:
        fixture_line = f"- prompt fixture: `tests/golden/sandbox/{prompt_rel}`"
        invocation = "`./agent-config work`"
    lines = [
        f"# {meta['gt_id']} reproduction notes",
        "",
        fixture_line,
        f"- persona: `{meta.get('persona') or '(default)'}`",
        f"- cycle cap: {meta.get('cycle_cap', runner.DEFAULT_CYCLE_CAP)}",
        f"- final outcome: `{result.final_outcome}`",
        f"- final exit code: `{result.final_exit_code}`",
        f"- cycles recorded: {len(result.cycles)}",
        "",
        "## How to regenerate",
        "",
        "From the repo root:",
        "",
        "```bash",
        f"python3 -m tests.golden.capture --scenarios {meta['gt_id']}",
        "```",
        "",
        "The driver materialises the toy repo under a temporary",
        f"directory and invokes {invocation} once",
        "per cycle. Recipe steps mutate the persisted state file in",
        "the same shape the agent would write.",
        "",
    ]
    return "\n".join(lines)


def _write_checksums(target: Path, manifest_path: Path) -> None:
    """Write a sorted SHA256 manifest covering every file in ``target``.

    Manifest paths are emitted relative to the repo root so the
    manifest can be verified with ``sha256sum -c`` from there. Both
    absolute and relative ``target`` arguments are supported.
    """
    repo_root = GOLDEN_ROOT.parent.parent.resolve()
    target_resolved = target.resolve()
    rows: list[tuple[str, str]] = []
    for path in sorted(target_resolved.rglob("*")):
        if path.is_file() and path.name != manifest_path.name:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            rel = path.relative_to(repo_root)
            rows.append((digest, str(rel)))
    manifest_path.write_text(
        "\n".join(f"{d}  {p}" for d, p in rows) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    raise SystemExit(main())
