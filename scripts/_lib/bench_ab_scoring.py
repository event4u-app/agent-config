"""Structural success criteria for Track B.

Phase 4 Step 3 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

No LLM-judge. Each criterion is a syntactic or behavioural check executable
against the post-run working tree + the captured transcript. If the structural
signal turns out too weak, a separate follow-up roadmap adds an LLM judge —
not this one.

Per-category criteria, expressed as keys in the task's `success_criteria`
dict (see internal/bench/corpora/ab-trackb.yaml):

- `target_file_modified`: <path>            — file at <path> changed between
  the pre-run snapshot and the post-run snapshot.
- `regex_in_target`: <pattern>              — pattern found in the named
  target_file (case-insensitive).
- `regex_in_any`: <pattern>                 — pattern found in any modified file.
- `new_test_file_exists`: <path>            — new test file present after the run.
- `test_assertion_added`: <path>            — file contains at least one
  `assert` / `expect(` / `test(` call.
- `one_of_files_modified`: [<paths>]        — at least one path modified.
- `preserves_public_api`: [<names>]         — each name still exported / present.
- `transcript_contains_one_of`: [<strings>] — any string appears in the
  transcript (case-insensitive).
- `no_file_write_before_audit`: bool        — if true, transcript shows an
  audit reference before the first write tool call (UI-audit category).
- `no_existing_test_removed`: [<names>]     — pre-existing test names still
  present in the file.
- `min_test_count`: int                     — at least N `test(` /
  `it(` / `describe(` calls.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any


def _read(path: Path) -> str:
    try:
        return path.read_text(errors="replace")
    except OSError:
        return ""


def _file_changed(pre: dict[str, str], post: dict[str, str], rel: str) -> bool:
    return pre.get(rel) != post.get(rel)


def _has_regex(text: str, pattern: str) -> bool:
    return bool(re.search(pattern, text, re.IGNORECASE | re.MULTILINE))


def _count_regex(text: str, pattern: str) -> int:
    return len(re.findall(pattern, text, re.IGNORECASE | re.MULTILINE))


def score_task(
    task: dict[str, Any],
    *,
    pre_snapshot: dict[str, str],
    post_snapshot: dict[str, str],
    clone_root: Path,
    transcript: str,
) -> dict[str, Any]:
    """Score one task. Returns {passed: bool, checks: [{name, ok, reason}]}."""
    crit = task.get("success_criteria") or {}
    checks: list[dict[str, Any]] = []

    def add(name: str, ok: bool, reason: str = "") -> None:
        checks.append({"name": name, "ok": bool(ok), "reason": reason})

    # target_file_modified
    target_modified_path = crit.get("target_file_modified")
    if target_modified_path:
        ok = _file_changed(pre_snapshot, post_snapshot, target_modified_path)
        add("target_file_modified", ok, f"file: {target_modified_path}")

    # regex_in_target — uses target_file_modified path, or the new_test_file_exists path
    regex_target_pattern = crit.get("regex_in_target")
    if regex_target_pattern:
        target_rel = (
            crit.get("target_file_modified")
            or crit.get("new_test_file_exists")
            or ""
        )
        body = _read(clone_root / target_rel) if target_rel else ""
        ok = _has_regex(body, regex_target_pattern)
        add(
            "regex_in_target",
            ok,
            f"pattern={regex_target_pattern!r} in {target_rel!r}",
        )

    # regex_in_any
    regex_any_pattern = crit.get("regex_in_any")
    if regex_any_pattern:
        modified_files = [
            rel for rel in post_snapshot if _file_changed(pre_snapshot, post_snapshot, rel)
        ]
        ok = any(
            _has_regex(_read(clone_root / rel), regex_any_pattern)
            for rel in modified_files
        )
        add(
            "regex_in_any",
            ok,
            f"pattern={regex_any_pattern!r} across {len(modified_files)} modified files",
        )

    # new_test_file_exists
    new_test = crit.get("new_test_file_exists")
    if new_test:
        ok = (clone_root / new_test).exists() and new_test not in pre_snapshot
        add("new_test_file_exists", ok, f"path={new_test}")

    # test_assertion_added
    test_target = crit.get("test_assertion_added")
    if test_target:
        body = _read(clone_root / test_target)
        ok = _has_regex(body, r"assert|expect\(|test\(|it\(")
        add("test_assertion_added", ok, f"in {test_target}")

    # one_of_files_modified
    one_of = crit.get("one_of_files_modified")
    if isinstance(one_of, list) and one_of:
        ok = any(_file_changed(pre_snapshot, post_snapshot, rel) for rel in one_of)
        add("one_of_files_modified", ok, f"any of: {one_of}")

    # preserves_public_api
    api = crit.get("preserves_public_api")
    if isinstance(api, list) and api and target_modified_path:
        body = _read(clone_root / target_modified_path)
        missing = [name for name in api if name not in body]
        add(
            "preserves_public_api",
            not missing,
            f"missing: {missing}" if missing else "all present",
        )

    # transcript_contains_one_of
    transcript_one_of = crit.get("transcript_contains_one_of")
    if isinstance(transcript_one_of, list) and transcript_one_of:
        lt = (transcript or "").lower()
        ok = any(s.lower() in lt for s in transcript_one_of)
        add(
            "transcript_contains_one_of",
            ok,
            f"any of: {transcript_one_of}",
        )

    # no_file_write_before_audit
    audit_first = crit.get("no_file_write_before_audit")
    if audit_first:
        ok = _no_write_before_audit(transcript)
        add(
            "no_file_write_before_audit",
            ok,
            "audit reference precedes any write tool call",
        )

    # no_existing_test_removed
    keep_tests = crit.get("no_existing_test_removed")
    if isinstance(keep_tests, list) and keep_tests and target_modified_path:
        body = _read(clone_root / target_modified_path)
        missing = [name for name in keep_tests if name not in body]
        add(
            "no_existing_test_removed",
            not missing,
            f"missing: {missing}" if missing else "all present",
        )

    # min_test_count
    min_tests = crit.get("min_test_count")
    if isinstance(min_tests, int) and min_tests > 0 and (new_test or test_target):
        path = new_test or test_target
        body = _read(clone_root / path) if path else ""
        count = _count_regex(body, r"\btest\s*\(|\bit\s*\(|\bdescribe\s*\(")
        add(
            "min_test_count",
            count >= min_tests,
            f"found={count}, required={min_tests}",
        )

    passed = bool(checks) and all(c["ok"] for c in checks)
    return {"passed": passed, "checks": checks}


def _no_write_before_audit(transcript: str) -> bool:
    """Best-effort: scan the transcript for any string suggesting an audit
    reference; require it to appear before any write/edit tool call.

    Without a structured tool-call log this is a heuristic; the task runner
    emits a structured `events` list (Phase 4 Step 2) that the scorer can
    later consume directly when we want a stricter check.
    """
    if not transcript:
        # Empty transcript = nothing fired = treat as not-failed-yet (will fail other checks)
        return False
    lt = transcript.lower()
    audit_markers = ["existing-ui-audit", "ui_audit", "audit"]
    write_markers = ["str-replace-editor", "save-file", "edit(", "write("]
    audit_idx = min((lt.find(m) for m in audit_markers if m in lt), default=-1)
    write_idx = min((lt.find(m) for m in write_markers if m in lt), default=-1)
    if audit_idx == -1:
        return False
    if write_idx == -1:
        return True
    return audit_idx < write_idx
