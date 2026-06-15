"""lint_workflow_security — WARN-ONLY GitHub Actions workflow security linter.

Scans .github/workflows/*.yml for known security anti-patterns and reports
findings.  Default mode always exits 0 (advisory/warn-only).  Pass --strict
to exit 1 on HIGH findings (future CI-gate promotion path).

Severity model (council-locked 2026-06-13):
  HIGH  — pull_request_target / workflow_run + checkout of untrusted ref;
           permissions: write-all;
           npm install / npm ci without --ignore-scripts in a
           pull_request_target workflow.
  MEDIUM — third-party actions pinned by mutable tag instead of full SHA
           (first-party actions/* are skipped).

Script-injection detection (regex-based) is intentionally deferred — it
requires an AST-aware pass to avoid false positives on quoted / escaped
expressions.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print(
        "PyYAML is required.  Run: pip install pyyaml",
        file=sys.stderr,
    )
    raise SystemExit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WORKFLOWS_DIR = REPO_ROOT / ".github" / "workflows"
ALLOWLIST_PATH = Path(__file__).resolve().parent / "lint_workflow_security_allowlist.json"
ALLOWLIST_CAP = 20

# Triggers that expose the repository token to untrusted pull-request context
DANGEROUS_TRIGGERS = {"pull_request_target", "workflow_run"}

# First-party action owners — mutable tags on these are acceptable
FIRST_PARTY_OWNERS = {"actions", "github"}


# ---------------------------------------------------------------------------
# Allowlist
# ---------------------------------------------------------------------------

def load_allowlist() -> list[dict]:
    if not ALLOWLIST_PATH.is_file():
        return []
    data = json.loads(ALLOWLIST_PATH.read_text(encoding="utf-8"))
    entries = data.get("findings", [])
    if len(entries) > ALLOWLIST_CAP:
        print(
            f"❌  lint_workflow_security: allowlist has {len(entries)} entries "
            f"(> {ALLOWLIST_CAP}).  Per the autonomous-execution allowlist-growth "
            f"antipattern, this means the linter is wrong, not the content — "
            f"tighten the heuristic or narrow scope instead of growing this list.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return entries


def is_allowlisted(allowlist: list[dict], workflow: str, rule: str) -> bool:
    for entry in allowlist:
        if entry.get("workflow") == workflow and entry.get("rule") == rule:
            return True
    return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _triggers(on_block: Any) -> set[str]:
    """Return the set of trigger names from the `on:` block."""
    if on_block is None:
        return set()
    if isinstance(on_block, str):
        return {on_block}
    if isinstance(on_block, list):
        return set(on_block)
    if isinstance(on_block, dict):
        return set(on_block.keys())
    return set()


def _has_untrusted_ref_checkout(jobs: dict) -> bool:
    """Return True if any step checks out via github.event.pull_request.head.*
    or github.event.workflow_run.* — the canonical pwn-request pattern."""
    untrusted_patterns = (
        "github.event.pull_request.head.",
        "github.event.workflow_run.",
    )
    for job in jobs.values():
        if not isinstance(job, dict):
            continue
        for step in job.get("steps", []) or []:
            if not isinstance(step, dict):
                continue
            uses = step.get("uses", "") or ""
            with_block = step.get("with") or {}
            # look at all with: values for the ref key or any value containing
            # the untrusted expression
            if "checkout" in uses.lower():
                for val in with_block.values():
                    val_str = str(val) if val is not None else ""
                    if any(p in val_str for p in untrusted_patterns):
                        return True
                # also check env: and run: for expression injection
            run_text = step.get("run", "") or ""
            env_block = step.get("env") or {}
            combined = run_text + " ".join(str(v) for v in env_block.values())
            if any(p in combined for p in untrusted_patterns):
                return True
    return False


def _has_npm_without_ignore_scripts(jobs: dict) -> bool:
    """Return True if any run step calls npm install/ci without --ignore-scripts."""
    for job in jobs.values():
        if not isinstance(job, dict):
            continue
        for step in job.get("steps", []) or []:
            if not isinstance(step, dict):
                continue
            run = step.get("run", "") or ""
            for line in run.splitlines():
                stripped = line.strip()
                if ("npm install" in stripped or "npm ci" in stripped) and \
                        "--ignore-scripts" not in stripped:
                    return True
    return False


def _mutable_third_party_actions(doc: dict, workflow_name: str) -> list[dict]:
    """Return per-step findings for third-party actions pinned by mutable tag."""
    findings: list[dict] = []
    jobs = doc.get("jobs") or {}
    for job_name, job in jobs.items():
        if not isinstance(job, dict):
            continue
        for i, step in enumerate(job.get("steps", []) or []):
            if not isinstance(step, dict):
                continue
            uses = step.get("uses", "") or ""
            if not uses or "@" not in uses:
                continue
            action_ref, _, pin = uses.partition("@")
            owner = action_ref.split("/")[0] if "/" in action_ref else action_ref
            if owner.lower() in FIRST_PARTY_OWNERS:
                continue
            # A full SHA pin is 40 hex chars; anything else is mutable
            if len(pin) == 40 and all(c in "0123456789abcdef" for c in pin.lower()):
                continue
            line_hint = f"job:{job_name}/step:{i + 1}"
            findings.append({
                "severity": "MEDIUM",
                "rule": "mutable-action-tag",
                "detail": f"{uses} — pin to a full commit SHA for supply-chain safety",
                "location": line_hint,
            })
    return findings


# ---------------------------------------------------------------------------
# Per-workflow scan
# ---------------------------------------------------------------------------

def scan_workflow(path: Path, allowlist: list[dict]) -> list[dict]:
    findings: list[dict] = []
    workflow_name = path.name

    try:
        raw = path.read_text(encoding="utf-8")
        doc = yaml.safe_load(raw) or {}
    except Exception as exc:
        findings.append({
            "severity": "HIGH",
            "rule": "parse-error",
            "workflow": workflow_name,
            "location": "—",
            "detail": str(exc),
            "allowlisted": False,
        })
        return findings

    on_block = doc.get("on") or doc.get(True)  # YAML `on:` may parse as True
    triggers = _triggers(on_block)
    jobs = doc.get("jobs") or {}

    # --- HIGH: dangerous trigger + untrusted ref checkout -------------------
    dangerous = triggers & DANGEROUS_TRIGGERS
    if dangerous and _has_untrusted_ref_checkout(jobs):
        rule = "dangerous-trigger-untrusted-ref"
        findings.append({
            "severity": "HIGH",
            "rule": rule,
            "workflow": workflow_name,
            "location": "on:",
            "detail": (
                f"trigger(s) {sorted(dangerous)} combined with checkout of an "
                "untrusted ref (github.event.pull_request.head.* or "
                "github.event.workflow_run.*) — classic pwn-request pattern"
            ),
            "allowlisted": is_allowlisted(allowlist, workflow_name, rule),
        })

    # --- HIGH: permissions: write-all ---------------------------------------
    global_perms = doc.get("permissions")
    if global_perms == "write-all":
        rule = "permissions-write-all"
        findings.append({
            "severity": "HIGH",
            "rule": rule,
            "workflow": workflow_name,
            "location": "permissions:",
            "detail": (
                "permissions: write-all grants the GITHUB_TOKEN every scope — "
                "restrict to the minimum required scopes"
            ),
            "allowlisted": is_allowlisted(allowlist, workflow_name, rule),
        })
    # also check job-level permissions
    for job_name, job in jobs.items():
        if not isinstance(job, dict):
            continue
        if job.get("permissions") == "write-all":
            rule = "permissions-write-all"
            findings.append({
                "severity": "HIGH",
                "rule": rule,
                "workflow": workflow_name,
                "location": f"jobs.{job_name}.permissions",
                "detail": (
                    "permissions: write-all grants the GITHUB_TOKEN every scope — "
                    "restrict to the minimum required scopes"
                ),
                "allowlisted": is_allowlisted(allowlist, workflow_name, rule),
            })

    # --- HIGH: npm install/ci without --ignore-scripts in dangerous trigger --
    if dangerous and _has_npm_without_ignore_scripts(jobs):
        rule = "npm-install-without-ignore-scripts"
        findings.append({
            "severity": "HIGH",
            "rule": rule,
            "workflow": workflow_name,
            "location": "jobs",
            "detail": (
                f"npm install / npm ci without --ignore-scripts in a "
                f"{sorted(dangerous)} workflow — postinstall scripts from "
                "untrusted PRs execute with repository write access"
            ),
            "allowlisted": is_allowlisted(allowlist, workflow_name, rule),
        })

    # --- MEDIUM: mutable third-party action tags ----------------------------
    for finding in _mutable_third_party_actions(doc, workflow_name):
        rule = finding["rule"]
        finding["workflow"] = workflow_name
        finding["allowlisted"] = is_allowlisted(allowlist, workflow_name, rule)
        findings.append(finding)

    return findings


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument(
        "--strict",
        action="store_true",
        help="exit 1 on HIGH findings (post-promotion CI gate)",
    )
    ap.add_argument("--quiet", action="store_true", help="suppress per-finding output")
    ap.add_argument("--json", type=Path, metavar="PATH", help="write findings as JSON")
    args = ap.parse_args(argv)

    allowlist = load_allowlist()

    if not WORKFLOWS_DIR.is_dir():
        if not args.quiet:
            print(f"No workflows directory found at {WORKFLOWS_DIR}", file=sys.stderr)
        return 0

    all_findings: list[dict] = []
    for wf_path in sorted(WORKFLOWS_DIR.glob("*.yml")):
        all_findings.extend(scan_workflow(wf_path, allowlist))
    for wf_path in sorted(WORKFLOWS_DIR.glob("*.yaml")):
        all_findings.extend(scan_workflow(wf_path, allowlist))

    if args.json:
        args.json.write_text(
            json.dumps(all_findings, indent=2), encoding="utf-8"
        )

    high = [f for f in all_findings if f["severity"] == "HIGH" and not f.get("allowlisted")]
    medium = [f for f in all_findings if f["severity"] == "MEDIUM" and not f.get("allowlisted")]
    allowlisted = [f for f in all_findings if f.get("allowlisted")]

    if not args.quiet:
        for f in all_findings:
            tag = f["severity"]
            al = " [allowlisted]" if f.get("allowlisted") else ""
            loc = f.get("location", "—")
            print(f"  [{tag}]{al} {f['workflow']}:{loc}  {f['rule']} — {f['detail']}")

        print()
        print(
            f"workflow-security: {len(high)} HIGH, {len(medium)} MEDIUM, "
            f"{len(allowlisted)} allowlisted"
        )
        if high or medium:
            print(
                "  (warn-only — run with --strict to make HIGH findings block CI)"
            )
        else:
            print("  no non-allowlisted findings")

    if args.strict and high:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
