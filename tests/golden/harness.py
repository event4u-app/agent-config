"""Replay each Golden Transcript and compare against the locked baseline.

Drives the same recipe modules used by ``tests.golden.capture`` against
the current ``scripts/work_engine`` and reports structural drift.

Comparison strategy (R1 roadmap, Phase 6 Step 1):

- **exit codes** per cycle — exact match.
- **state snapshot** per cycle — recursive *structure* match (key
  names, types, list lengths). Leaf strings may drift; the semantic
  ``questions`` list is validated separately as halt markers.
- **halt markers** per cycle — exit code + ``recipe_action`` exact,
  plus *Strict-Verb* shape on ``questions``: directive verb identity,
  classification of each line (directive / numbered / blockquote /
  text), and count of numbered options. Wording inside blockquotes
  and after ``> N. …`` may drift.
- **delivery report** — ``^## `` headings exact-equal as ordered list.

Used from pytest via ``tests/golden/test_replay.py`` and from the CLI
via ``python3 -m tests.golden.harness``.
"""
from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
import tempfile
from dataclasses import dataclass
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
    "tests.golden.sandbox.recipes.gt_u1_build_happy",
    "tests.golden.sandbox.recipes.gt_u2_improve_diff",
    "tests.golden.sandbox.recipes.gt_u3_audit_skipped",
    "tests.golden.sandbox.recipes.gt_u4_polish_ceiling",
    "tests.golden.sandbox.recipes.gt_u5_mixed_flow",
    "tests.golden.sandbox.recipes.gt_u6a_stack_blade",
    "tests.golden.sandbox.recipes.gt_u6b_stack_react",
    "tests.golden.sandbox.recipes.gt_u7_trivial_happy",
    "tests.golden.sandbox.recipes.gt_u8_trivial_reclassification",
    "tests.golden.sandbox.recipes.gt_u9_greenfield_scaffold",
    "tests.golden.sandbox.recipes.gt_u10_greenfield_bare",
    "tests.golden.sandbox.recipes.gt_u11_high_confidence",
    "tests.golden.sandbox.recipes.gt_u12_ambiguous",
)

GOLDEN_ROOT = Path(__file__).resolve().parent
BASELINE_ROOT = GOLDEN_ROOT / "baseline"


@dataclass(frozen=True)
class Diff:
    """One structural mismatch between baseline and replay."""

    path: str
    kind: str
    message: str

    def __str__(self) -> str:
        return f"[{self.kind}] {self.path}: {self.message}"


@dataclass
class ReplayResult:
    gt_id: str
    cycles_state: list[dict[str, Any]]
    cycles_exit: list[int]
    cycles_directive: list[str | None]
    cycles_recipe_action: list[str | None]
    delivery_report: str

    @property
    def halt_markers(self) -> list[dict[str, Any]]:
        markers: list[dict[str, Any]] = []
        for idx, state in enumerate(self.cycles_state, start=1):
            markers.append({
                "cycle": idx,
                "exit_code": self.cycles_exit[idx - 1],
                "directive": self.cycles_directive[idx - 1],
                "recipe_action": self.cycles_recipe_action[idx - 1],
                "questions": state.get("questions") or [],
            })
        return markers


@dataclass
class Baseline:
    gt_id: str
    exit_codes: list[int]
    halt_markers: list[dict[str, Any]]
    delivery_report: str
    state_snapshots: list[dict[str, Any]]


def _load_module_for(gt_id: str):
    for mod_name in RECIPE_MODULES:
        mod = importlib.import_module(mod_name)
        if mod.META["gt_id"] == gt_id:
            return mod
    raise KeyError(f"unknown GT id: {gt_id}")


def _resolve_inputs(
    meta: dict[str, Any],
) -> tuple[Path | None, Path | None, Path | None, Path | None]:
    """Return ``(ticket_file, prompt_file, diff_file, file_file)`` from META.

    Recipes declare exactly one of ``ticket_relpath`` (R1 ticket-mode),
    ``prompt_relpath`` (R2 prompt-mode), ``diff_relpath`` (R3 diff-mode)
    or ``file_relpath`` (R3 file-mode); the unused slots stay ``None``.
    The raised error matches what ``run_capture`` would say if any
    other count was forwarded — failing here surfaces the typo on the
    META rather than deep inside the runner.
    """
    ticket_rel = meta.get("ticket_relpath")
    prompt_rel = meta.get("prompt_relpath")
    diff_rel = meta.get("diff_relpath")
    file_rel = meta.get("file_relpath")
    supplied = [r for r in (ticket_rel, prompt_rel, diff_rel, file_rel) if r is not None]
    if len(supplied) != 1:
        raise ValueError(
            f"META for {meta.get('gt_id')!r} must declare exactly one of "
            "'ticket_relpath' / 'prompt_relpath' / 'diff_relpath' / "
            f"'file_relpath'; got ticket_relpath={ticket_rel!r}, "
            f"prompt_relpath={prompt_rel!r}, diff_relpath={diff_rel!r}, "
            f"file_relpath={file_rel!r}",
        )
    return (
        runner.SANDBOX_ROOT / ticket_rel if ticket_rel is not None else None,
        runner.SANDBOX_ROOT / prompt_rel if prompt_rel is not None else None,
        runner.SANDBOX_ROOT / diff_rel if diff_rel is not None else None,
        runner.SANDBOX_ROOT / file_rel if file_rel is not None else None,
    )


def replay(gt_id: str) -> ReplayResult:
    """Run the recipe for ``gt_id`` against the live engine."""
    module = _load_module_for(gt_id)
    meta = module.META
    ticket_file, prompt_file, diff_file, file_file = _resolve_inputs(meta)
    with tempfile.TemporaryDirectory(prefix=f"replay-{gt_id}-") as tmp:
        workspace = Path(tmp) / "ws"
        recipe = module.build_recipe(workspace)
        seed_state_fn = getattr(module, "seed_state", None)
        seed = seed_state_fn(workspace) if seed_state_fn is not None else None
        cap = runner.run_capture(
            gt_id=gt_id,
            ticket_file=ticket_file,
            prompt_file=prompt_file,
            diff_file=diff_file,
            file_file=file_file,
            workspace=workspace,
            recipe=recipe,
            persona=meta.get("persona"),
            cycle_cap=meta.get("cycle_cap", runner.DEFAULT_CYCLE_CAP),
            seed_state=seed,
        )
    cycles_state = [c.state_after for c in cap.cycles]
    final_state = cycles_state[-1] if cycles_state else {}
    return ReplayResult(
        gt_id=gt_id,
        cycles_state=cycles_state,
        cycles_exit=[c.exit_code for c in cap.cycles],
        cycles_directive=[c.directive for c in cap.cycles],
        cycles_recipe_action=[c.recipe_action for c in cap.cycles],
        delivery_report=final_state.get("report") or "",
    )


def load_baseline(gt_id: str, *, baseline_root: Path = BASELINE_ROOT) -> Baseline:
    """Read the locked Capture Pack for ``gt_id``."""
    pack = baseline_root / gt_id
    exit_codes = [
        entry["exit_code"]
        for entry in json.loads((pack / "exit-codes.json").read_text("utf-8"))
    ]
    halt_markers = json.loads((pack / "halt-markers.json").read_text("utf-8"))
    delivery_report = (pack / "delivery-report.md").read_text("utf-8")
    snap_dir = pack / "state-snapshots"
    snapshots = [
        json.loads(p.read_text("utf-8"))
        for p in sorted(snap_dir.glob("cycle-*.json"))
    ]
    return Baseline(
        gt_id=gt_id,
        exit_codes=exit_codes,
        halt_markers=halt_markers,
        delivery_report=delivery_report,
        state_snapshots=snapshots,
    )


# ---------------------------------------------------------------------------
# Comparators
# ---------------------------------------------------------------------------

# Top-level state keys handled by dedicated comparators (skip in shape walk).
_STATE_DELEGATED = frozenset({"questions", "report"})


def _classify_question(line: Any) -> tuple[str, ...]:
    """Structural class of one ``questions`` entry — see module docstring."""
    if not isinstance(line, str):
        return ("invalid",)
    if line.startswith("@agent-directive:"):
        rest = line.split(":", 1)[1].strip()
        verb = rest.split()[0] if rest else ""
        return ("directive", verb)
    m = re.match(r"^> (\d+)\.", line)
    if m:
        return ("numbered", int(m.group(1)))
    if line.startswith("> "):
        return ("blockquote",)
    return ("text",)


def _shape_diff(
    base: Any, repl: Any, path: str, *, skip_top_keys: frozenset[str] = frozenset(),
) -> list[Diff]:
    """Recursive *structure* comparison — types, keys, list lengths."""
    diffs: list[Diff] = []
    if type(base) is not type(repl):  # noqa: E721 — exact type identity
        diffs.append(Diff(
            path=path,
            kind="state.shape",
            message=f"type {type(base).__name__} → {type(repl).__name__}",
        ))
        return diffs

    if isinstance(base, dict):
        base_keys = set(base.keys()) - skip_top_keys
        repl_keys = set(repl.keys()) - skip_top_keys
        missing = sorted(base_keys - repl_keys)
        added = sorted(repl_keys - base_keys)
        if missing:
            diffs.append(Diff(path, "state.keys",
                              f"keys missing in replay: {missing}"))
        if added:
            diffs.append(Diff(path, "state.keys",
                              f"unexpected keys in replay: {added}"))
        for key in sorted(base_keys & repl_keys):
            diffs += _shape_diff(base[key], repl[key], f"{path}.{key}")
        return diffs

    if isinstance(base, list):
        if len(base) != len(repl):
            diffs.append(Diff(
                path=path,
                kind="state.length",
                message=f"len {len(base)} → {len(repl)}",
            ))
            return diffs
        for idx, (b, r) in enumerate(zip(base, repl)):
            diffs += _shape_diff(b, r, f"{path}[{idx}]")
        return diffs

    # Primitives — accept any leaf value drift (str/int/bool/None).
    return diffs


def compare_exit_codes(base: Baseline, repl: ReplayResult) -> list[Diff]:
    if base.exit_codes != repl.cycles_exit:
        return [Diff(
            path="exit_codes",
            kind="exit",
            message=f"{base.exit_codes} → {repl.cycles_exit}",
        )]
    return []


def compare_state_snapshots(base: Baseline, repl: ReplayResult) -> list[Diff]:
    diffs: list[Diff] = []
    if len(base.state_snapshots) != len(repl.cycles_state):
        return [Diff(
            path="state_snapshots",
            kind="state.length",
            message=f"cycles {len(base.state_snapshots)} → {len(repl.cycles_state)}",
        )]
    for idx, (b, r) in enumerate(
        zip(base.state_snapshots, repl.cycles_state), start=1
    ):
        diffs += _shape_diff(
            b, r, f"cycle-{idx:02d}", skip_top_keys=_STATE_DELEGATED,
        )
    return diffs


def compare_halt_markers(base: Baseline, repl: ReplayResult) -> list[Diff]:
    diffs: list[Diff] = []
    repl_markers = repl.halt_markers
    if len(base.halt_markers) != len(repl_markers):
        return [Diff(
            path="halt_markers",
            kind="halt.length",
            message=f"cycles {len(base.halt_markers)} → {len(repl_markers)}",
        )]
    for b, r in zip(base.halt_markers, repl_markers):
        cyc = b["cycle"]
        prefix = f"halt[cycle-{cyc:02d}]"
        for field in ("exit_code", "directive", "recipe_action"):
            if b.get(field) != r.get(field):
                diffs.append(Diff(
                    path=f"{prefix}.{field}",
                    kind="halt.field",
                    message=f"{b.get(field)!r} → {r.get(field)!r}",
                ))
        b_q = b.get("questions") or []
        r_q = r.get("questions") or []
        if len(b_q) != len(r_q):
            diffs.append(Diff(
                path=f"{prefix}.questions",
                kind="halt.questions",
                message=f"len {len(b_q)} → {len(r_q)}",
            ))
            continue
        for i, (bl, rl) in enumerate(zip(b_q, r_q)):
            bc = _classify_question(bl)
            rc = _classify_question(rl)
            if bc != rc:
                diffs.append(Diff(
                    path=f"{prefix}.questions[{i}]",
                    kind="halt.questions.shape",
                    message=f"{bc} → {rc}",
                ))
    return diffs


def _headings(report: str) -> list[str]:
    return [line.rstrip() for line in report.splitlines() if line.startswith("## ")]


def compare_delivery_report(base: Baseline, repl: ReplayResult) -> list[Diff]:
    base_h = _headings(base.delivery_report)
    repl_h = _headings(repl.delivery_report)
    if base_h != repl_h:
        return [Diff(
            path="delivery_report.headings",
            kind="report.headings",
            message=f"{base_h} → {repl_h}",
        )]
    return []


def compare(base: Baseline, repl: ReplayResult) -> list[Diff]:
    """Run all four comparators and concatenate their diffs."""
    return (
        compare_exit_codes(base, repl)
        + compare_halt_markers(base, repl)
        + compare_state_snapshots(base, repl)
        + compare_delivery_report(base, repl)
    )


def replay_and_compare(
    gt_id: str, *, baseline_root: Path = BASELINE_ROOT,
) -> tuple[Baseline, ReplayResult, list[Diff]]:
    base = load_baseline(gt_id, baseline_root=baseline_root)
    repl = replay(gt_id)
    return base, repl, compare(base, repl)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def all_gt_ids() -> list[str]:
    return [importlib.import_module(m).META["gt_id"] for m in RECIPE_MODULES]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="golden-harness")
    parser.add_argument(
        "--scenarios",
        nargs="*",
        default=None,
        help="Optional GT ids to replay (default: all five).",
    )
    parser.add_argument(
        "--baseline-root",
        type=Path,
        default=BASELINE_ROOT,
        help="Where the locked Capture Packs live (default: tests/golden/baseline).",
    )
    args = parser.parse_args(argv)

    selected = args.scenarios or all_gt_ids()
    failures: dict[str, list[Diff]] = {}
    for gt_id in selected:
        print(f"=== {gt_id} ===", file=sys.stderr)
        _, _, diffs = replay_and_compare(gt_id, baseline_root=args.baseline_root)
        if diffs:
            failures[gt_id] = diffs
            for d in diffs:
                print(f"  {d}", file=sys.stderr)
        else:
            print("  ok", file=sys.stderr)

    if failures:
        print(
            f"\n{len(failures)} scenario(s) drifted: {sorted(failures)}",
            file=sys.stderr,
        )
        return 1
    print(f"\nall {len(selected)} scenario(s) match the locked baseline.",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
