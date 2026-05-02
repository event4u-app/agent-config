#!/usr/bin/env python3
"""End-to-end release automation for `event4u/agent-config`.

Invoked via `task release`. The bump level (major/minor/patch) is
auto-detected from Conventional Commits since the last tag; pass
`--as {major,minor,patch}` to force, or `--version X.Y.Z` to pin.

Pipeline:
    1. Preflight         — on main, clean tree, origin in sync, gh available,
                           target tag doesn't exist yet.
    2. Plan              — compute new version, parse Conventional Commits
                           since the last tag, render CHANGELOG section.
    3. Confirm           — show preview, ask once (skippable with --yes).
    4. Branch + bump     — create `release/X.Y.Z`, update package.json,
                           .claude-plugin/marketplace.json, CHANGELOG.md.
    5. Commit + push     — `release: X.Y.Z`, push branch, open PR.
    6. Wait for CI       — `gh pr checks --watch` (skippable with --no-wait).
    7. Merge             — `gh pr merge --merge --delete-branch`.
    8. Tag main          — fast-forward main, tag the merge commit,
                           push the tag (this triggers publish-npm.yml).
    9. GitHub Release    — `gh release create X.Y.Z --notes <changelog>`.

Idempotency: pass `--resume` to recover from a partial failure. Each
step then probes existing state (branch, commit, PR, tag, GitHub
Release) and skips work that is already done, instead of erroring out.
Without `--resume` the pipeline still mutates git/network state, so
re-running on a dirty tree needs `--resume` (or a manual cleanup).
Each step prints what it's about to do before doing it, so a crash
leaves a recoverable trail.

Stdlib-only (Python 3.10+). No third-party runtime dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import date as _date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PACKAGE_JSON = REPO_ROOT / "package.json"
MARKETPLACE_JSON = REPO_ROOT / ".claude-plugin" / "marketplace.json"
CHANGELOG = REPO_ROOT / "CHANGELOG.md"
MAIN_BRANCH = "main"
REMOTE = "origin"
REPO_SLUG = "event4u-app/agent-config"

# Conventional Commit types and how they map into CHANGELOG sections.
# Order in this tuple determines order in the rendered entry.
SECTIONS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("Features", "minor", ("feat",)),
    ("Bug Fixes", "patch", ("fix",)),
    ("Performance", "patch", ("perf",)),
    ("Reverts", "patch", ("revert",)),
    ("Documentation", None, ("docs",)),
    ("Refactoring", None, ("refactor",)),
    ("Tests", None, ("test",)),
    ("Build", None, ("build",)),
    ("CI", None, ("ci",)),
    ("Chores", None, ("chore",)),
)
BREAKING_RE = re.compile(r"^([a-z]+)(\([^)]+\))?!:")
CONVENTIONAL_RE = re.compile(
    r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]+)\))?(?P<bang>!)?: (?P<subject>.+)$"
)


# ─── dataclasses ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Commit:
    sha: str
    type: str
    scope: str | None
    subject: str
    breaking: bool


@dataclass(frozen=True)
class Plan:
    current: str
    target: str
    bump: str  # "major" | "minor" | "patch"
    commits: list[Commit]
    last_tag: str | None
    changelog_body: str  # rendered body (without the heading)
    changelog_entry: str  # full entry including heading, for CHANGELOG.md


# ─── utilities ────────────────────────────────────────────────────────────────


def die(msg: str, code: int = 2) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def run(
    *args: str,
    check: bool = True,
    capture: bool = False,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Thin subprocess wrapper with sane defaults.

    When ``check`` and ``capture`` are both True and the command fails,
    Python's default behaviour swallows stderr — callers only see a
    ``CalledProcessError`` with no hint of what went wrong. We catch that
    path and die with the actual stderr so release preflight failures are
    diagnosable without re-running with a debugger.
    """
    try:
        return subprocess.run(
            list(args),
            check=check,
            cwd=cwd or REPO_ROOT,
            text=True,
            capture_output=capture,
        )
    except subprocess.CalledProcessError as err:
        if capture:
            cmd = " ".join(args)
            out = (err.stderr or err.stdout or "").strip()
            die(f"command failed ({err.returncode}): {cmd}\n{out}")
        raise


def git(*args: str, capture: bool = False) -> str:
    r = run("git", *args, capture=capture)
    return r.stdout.strip() if capture else ""


def gh(*args: str, capture: bool = False, check: bool = True) -> str:
    r = run("gh", *args, capture=capture, check=check)
    return r.stdout.strip() if capture else ""


def watch_pr_checks() -> None:
    """Watch PR checks and tolerate the 'no checks' case.

    ``gh pr checks --watch`` exits 1 both on real failures and when no
    checks are reported at all (no workflow triggered, no required
    checks configured in branch protection). The latter must not block
    the release — we warn and continue. Real failures still die.

    A short grace period gives GitHub time to register workflow runs
    on a freshly-pushed branch.
    """
    time.sleep(5)
    proc = subprocess.run(
        ["gh", "pr", "checks", "--watch"],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
    )
    output = ((proc.stdout or "") + (proc.stderr or "")).strip()
    if proc.returncode == 0:
        if output:
            print(output)
        return
    if "no checks reported" in output.lower():
        print(f"⚠️  {output}")
        print(
            "   Continuing without check validation — configure required "
            "checks in branch protection to enforce this gate."
        )
        return
    if output:
        print(output, file=sys.stderr)
    die(f"PR checks failed (exit {proc.returncode})")


def have(bin: str) -> bool:
    return (
        subprocess.run(
            ["which", bin], capture_output=True, text=True
        ).returncode
        == 0
    )


# ─── resume-mode state probes ────────────────────────────────────────────────


def _branch_exists_local(branch: str) -> bool:
    r = run(
        "git", "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}",
        check=False, capture=True,
    )
    return r.returncode == 0


def _branch_exists_remote(branch: str) -> bool:
    r = run(
        "git", "ls-remote", "--exit-code", "--heads", REMOTE, branch,
        check=False, capture=True,
    )
    return r.returncode == 0


def _tag_exists_local(tag: str) -> bool:
    return tag in git("tag", "-l", tag, capture=True).splitlines()


def _tag_exists_remote(tag: str) -> bool:
    r = run(
        "git", "ls-remote", "--exit-code", "--tags", REMOTE, tag,
        check=False, capture=True,
    )
    return r.returncode == 0


def _pr_for_branch(branch: str) -> dict | None:
    """Most recent PR (any state) with `release/X.Y.Z` as head, or None."""
    r = run(
        "gh", "pr", "list",
        "--head", branch,
        "--state", "all",
        "--json", "number,state,url",
        "--limit", "1",
        check=False, capture=True,
    )
    if r.returncode != 0:
        return None
    try:
        items = json.loads(r.stdout or "[]")
    except json.JSONDecodeError:
        return None
    return items[0] if items else None


def _release_exists(tag: str) -> bool:
    r = run("gh", "release", "view", tag, check=False, capture=True)
    return r.returncode == 0


# ─── version math ─────────────────────────────────────────────────────────────


SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def parse_version(s: str) -> tuple[int, int, int]:
    m = SEMVER_RE.match(s.strip())
    if not m:
        die(f"not a bare semver (X.Y.Z): {s!r}")
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def bump_version(current: str, kind: str) -> str:
    major, minor, patch = parse_version(current)
    if kind == "major":
        return f"{major + 1}.0.0"
    if kind == "minor":
        return f"{major}.{minor + 1}.0"
    if kind == "patch":
        return f"{major}.{minor}.{patch + 1}"
    die(f"unknown bump kind: {kind}")
    return ""  # unreachable


# ─── commit parsing + changelog rendering ────────────────────────────────────


def commits_since(tag: str | None) -> list[Commit]:
    """Return non-merge commits after `tag` (or all of history if tag is None)."""
    rev = f"{tag}..HEAD" if tag else "HEAD"
    raw = git("log", rev, "--no-merges", "--format=%H%x1f%s", capture=True)
    out: list[Commit] = []
    for line in raw.splitlines():
        if "\x1f" not in line:
            continue
        sha, subject = line.split("\x1f", 1)
        m = CONVENTIONAL_RE.match(subject)
        if not m:
            out.append(Commit(sha, "other", None, subject, False))
            continue
        breaking = bool(m.group("bang")) or "BREAKING CHANGE" in subject
        out.append(
            Commit(
                sha=sha,
                type=m.group("type"),
                scope=m.group("scope"),
                subject=m.group("subject"),
                breaking=breaking,
            )
        )
    return out


def infer_bump(commits: list[Commit]) -> str:
    """Derive the semver bump from commit types (for preview only)."""
    if any(c.breaking for c in commits):
        return "major"
    for _label, level, types in SECTIONS:
        if level == "minor" and any(c.type in types for c in commits):
            return "minor"
    return "patch"


def latest_tag() -> str | None:
    r = run(
        "git", "describe", "--tags", "--abbrev=0", "--match", "[0-9]*.[0-9]*.[0-9]*",
        check=False, capture=True,
    )
    tag = r.stdout.strip()
    return tag or None


def render_changelog_entry(
    version: str,
    prev: str | None,
    commits: list[Commit],
    today: str,
) -> tuple[str, str]:
    """Return (heading-aware full entry, body-only for GitHub Release notes)."""
    if prev:
        heading = (
            f"## [{version}](https://github.com/{REPO_SLUG}/compare/"
            f"{prev}...{version}) ({today})"
        )
    else:
        heading = f"## {version} ({today})"

    # Group by section; commits of unknown type drop into "Other".
    grouped: dict[str, list[Commit]] = {label: [] for label, _, _ in SECTIONS}
    grouped["BREAKING CHANGES"] = []
    other: list[Commit] = []
    for c in commits:
        if c.breaking:
            grouped["BREAKING CHANGES"].append(c)
            continue
        placed = False
        for label, _level, types in SECTIONS:
            if c.type in types:
                grouped[label].append(c)
                placed = True
                break
        if not placed:
            other.append(c)

    body_lines: list[str] = []
    ordered_labels = ["BREAKING CHANGES"] + [label for label, _, _ in SECTIONS]
    for label in ordered_labels:
        bucket = grouped.get(label) or []
        if not bucket:
            continue
        body_lines.append("")
        body_lines.append(f"### {label}")
        body_lines.append("")
        for c in bucket:
            body_lines.append(_changelog_line(c))
    if other:
        body_lines.append("")
        body_lines.append("### Other")
        body_lines.append("")
        for c in other:
            body_lines.append(_changelog_line(c))

    body = "\n".join(body_lines).lstrip("\n")
    full = heading + "\n\n" + body + "\n"
    return full, body


def _changelog_line(c: Commit) -> str:
    scope = f"**{c.scope}:** " if c.scope else ""
    short = c.sha[:7]
    link = f"https://github.com/{REPO_SLUG}/commit/{c.sha}"
    return f"* {scope}{c.subject} ([{short}]({link}))"


def prepend_changelog(path: Path, entry: str) -> None:
    """Insert `entry` directly above the most recent `## [` heading."""
    text = path.read_text(encoding="utf-8")
    marker_re = re.compile(r"^## \[?\d+\.\d+\.\d+", re.MULTILINE)
    m = marker_re.search(text)
    if not m:
        # No prior release heading — append after the introduction.
        path.write_text(text.rstrip() + "\n\n" + entry, encoding="utf-8")
        return
    before = text[: m.start()]
    after = text[m.start() :]
    path.write_text(before + entry + "\n" + after, encoding="utf-8")



# ─── file mutations ───────────────────────────────────────────────────────────


def set_package_version(path: Path, version: str) -> None:
    """Update the top-level `version` field; preserve 4-space indentation."""
    data = json.loads(path.read_text(encoding="utf-8"))
    data["version"] = version
    path.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")


def set_marketplace_version(path: Path, version: str) -> None:
    """Update `metadata.version`; preserve 2-space indentation + UTF-8."""
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("metadata", {})["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


# ─── preflight ────────────────────────────────────────────────────────────────


def preflight(target: str, *, resume: bool = False) -> None:
    """Fail fast on conditions that would break the release mid-flight.

    In ``--resume`` mode two invariants are relaxed:

    * The starting branch may be ``release/{target}`` in addition to
      ``main`` — both are valid resume positions (mid-pipeline crash
      after step 1 leaves you on the release branch).
    * The target-tag-exists check is dropped — execute() probes for
      existing tags/releases and skips them.

    Tree cleanliness, gh auth, and ``main`` in-sync with origin are
    still enforced, so resuming has the same starting posture as a
    fresh run; only step-level outcomes differ.
    """
    for b in ("git", "gh"):
        if not have(b):
            die(f"{b!r} not found on PATH")

    # Probe the active token directly via an authenticated API call. `gh auth
    # status` returns non-zero if *any* account in the keyring is broken, even
    # when the active one is fine — so we'd rather ask "does the token the
    # release will actually use work?" than parse multi-account status output.
    r = run("gh", "api", "user", "--jq", ".login", check=False, capture=True)
    if r.returncode != 0:
        die("gh is not authenticated; run `gh auth login` first")

    branch = git("rev-parse", "--abbrev-ref", "HEAD", capture=True)
    release_branch = f"release/{target}"
    allowed = {MAIN_BRANCH, release_branch} if resume else {MAIN_BRANCH}
    if branch not in allowed:
        if resume:
            die(
                f"resume must run from {MAIN_BRANCH!r} or {release_branch!r}, "
                f"currently on {branch!r}"
            )
        die(f"release must run from {MAIN_BRANCH!r}, currently on {branch!r}")

    porcelain = git("status", "--porcelain", capture=True)
    if porcelain:
        die("working tree is not clean; commit or stash first")

    # --force lets the remote's tag positions win over stale local tags.
    # The release consumes the remote view as source of truth, and we're
    # about to create a new tag anyway — local drift (e.g. from renamed
    # release-please tags) should not block the fetch.
    run("git", "fetch", REMOTE, "--tags", "--prune", "--force", capture=True)

    # The local-in-sync-with-origin check only applies to main; if we're
    # already on the release branch in resume mode, the relevant invariant
    # is "main hasn't moved beyond what release/X.Y.Z branched off", which
    # `git pull --ff-only` enforces in step 8 anyway.
    if branch == MAIN_BRANCH:
        local = git("rev-parse", "HEAD", capture=True)
        remote = git("rev-parse", f"{REMOTE}/{MAIN_BRANCH}", capture=True)
        if local != remote:
            die(
                f"local {MAIN_BRANCH} is not in sync with "
                f"{REMOTE}/{MAIN_BRANCH}; pull or push first"
            )

    if not resume:
        tags = git("tag", "-l", target, capture=True).splitlines()
        if target in tags:
            die(f"tag {target!r} already exists; nothing to release")


# ─── plan ─────────────────────────────────────────────────────────────────────


def print_preview(plan: Plan) -> None:
    print()
    print("═" * 72)
    print(f"  Release preview — {plan.current} → {plan.target} ({plan.bump})")
    print("═" * 72)
    print()
    print(f"Previous tag:   {plan.last_tag or '(none)'}")
    print(f"New tag:        {plan.target}")
    print(f"Commits:        {len(plan.commits)} since {plan.last_tag or 'start'}")
    detected = infer_bump(plan.commits) if plan.commits else "patch"
    if detected != plan.bump:
        print(
            f"NOTE:           commits suggest a {detected!r} bump, "
            f"you picked {plan.bump!r}"
        )
    print()
    print("Files to change:")
    print(f"  · {PACKAGE_JSON.relative_to(REPO_ROOT)}")
    print(f"  · {MARKETPLACE_JSON.relative_to(REPO_ROOT)}")
    print(f"  · {CHANGELOG.relative_to(REPO_ROOT)}")
    print()
    print("Changelog section:")
    print("─" * 72)
    print(plan.changelog_entry.rstrip())
    print("─" * 72)
    print()


def confirm(prompt: str) -> bool:
    ans = input(f"{prompt} [y/N] ").strip().lower()
    return ans in {"y", "yes"}


# ─── orchestration ────────────────────────────────────────────────────────────


def _step(n: int, total: int, msg: str) -> None:
    print(f"[{n}/{total}] {msg}")


def execute(
    plan: Plan,
    *,
    wait_for_checks: bool,
    dry_run: bool,
    resume: bool = False,
) -> None:
    branch = f"release/{plan.target}"
    total = 9

    if dry_run:
        print("(dry-run) no git/gh mutations will be performed.")
        return

    # Probe the world once at the top so each step skip-decision is cheap.
    pr_info = _pr_for_branch(branch) if resume else None
    pr_state = (pr_info or {}).get("state")
    pr_merged = pr_state == "MERGED"

    # ─── 1. branch ──────────────────────────────────────────────────────────
    if pr_merged:
        _step(1, total, f"PR for {branch} already merged — staying on {MAIN_BRANCH}")
        if git("rev-parse", "--abbrev-ref", "HEAD", capture=True) != MAIN_BRANCH:
            run("git", "checkout", MAIN_BRANCH)
        run("git", "pull", "--ff-only", REMOTE, MAIN_BRANCH)
    elif resume and _branch_exists_local(branch):
        _step(1, total, f"Branch {branch} exists locally — checkout")
        run("git", "checkout", branch)
    elif resume and _branch_exists_remote(branch):
        _step(1, total, f"Branch {branch} exists on {REMOTE} — fetch + checkout")
        run("git", "fetch", REMOTE, branch)
        run("git", "checkout", "-b", branch, f"{REMOTE}/{branch}")
    else:
        _step(1, total, f"Create branch {branch}")
        run("git", "checkout", "-b", branch)

    # ─── 2. file mutations ──────────────────────────────────────────────────
    if pr_merged:
        _step(2, total, "PR already merged — skip file bumps")
    else:
        current_pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8")).get("version")
        if resume and current_pkg == plan.target:
            _step(2, total, f"Files already at {plan.target} — skip bump")
        else:
            _step(2, total, "Bump package.json + marketplace.json, prepend CHANGELOG")
            set_package_version(PACKAGE_JSON, plan.target)
            set_marketplace_version(MARKETPLACE_JSON, plan.target)
            prepend_changelog(CHANGELOG, plan.changelog_entry)

    # ─── 3. commit ──────────────────────────────────────────────────────────
    if pr_merged:
        _step(3, total, "PR already merged — skip commit")
    else:
        last_msg = git("log", "-1", "--format=%s", capture=True)
        porcelain = git("status", "--porcelain", capture=True)
        if resume and last_msg == f"release: {plan.target}" and not porcelain:
            _step(3, total, f"Last commit already `release: {plan.target}` and tree clean — skip")
        else:
            _step(3, total, f"Commit `release: {plan.target}`")
            run("git", "add", str(PACKAGE_JSON), str(MARKETPLACE_JSON), str(CHANGELOG))
            run("git", "commit", "-m", f"release: {plan.target}")

    # ─── 4. push ────────────────────────────────────────────────────────────
    if pr_merged:
        _step(4, total, "PR already merged — skip push")
    else:
        # `git push -u` is naturally idempotent — it prints "Everything
        # up-to-date" when remote already matches. No probe needed.
        _step(4, total, f"Push {branch} to {REMOTE}")
        run("git", "push", "-u", REMOTE, branch)

    # ─── 5. PR ──────────────────────────────────────────────────────────────
    if pr_merged:
        _step(5, total, f"PR #{pr_info.get('number')} already merged — skip")
    elif resume and pr_state == "OPEN":
        _step(5, total, f"PR already open: {pr_info.get('url')}")
    else:
        _step(5, total, "Open pull request")
        pr_body = (
            f"Release {plan.target}.\n\n"
            f"{plan.changelog_body}\n\n"
            "Created by `scripts/release.py`."
        )
        run(
            "gh", "pr", "create",
            "--base", MAIN_BRANCH,
            "--head", branch,
            "--title", f"release: {plan.target}",
            "--body", pr_body,
        )

    # ─── 6. wait for checks ─────────────────────────────────────────────────
    if pr_merged:
        _step(6, total, "PR already merged — skip checks wait")
    elif wait_for_checks:
        _step(6, total, "Wait for PR checks")
        watch_pr_checks()
    else:
        _step(6, total, "Skip waiting for checks (--no-wait)")

    # ─── 7. merge ───────────────────────────────────────────────────────────
    if pr_merged:
        _step(7, total, f"PR #{pr_info.get('number')} already merged — skip")
    else:
        _step(7, total, "Merge pull request (merge commit) and delete branch")
        run("gh", "pr", "merge", "--merge", "--delete-branch")

    # ─── 8. tag main + push tag ─────────────────────────────────────────────
    # Always idempotent — even outside resume mode this prevents a mid-flight
    # crash on step 9 from leaving a half-tagged release that subsequent
    # `task release` invocations can't recover from without `--resume`.
    if git("rev-parse", "--abbrev-ref", "HEAD", capture=True) != MAIN_BRANCH:
        run("git", "checkout", MAIN_BRANCH)
    run("git", "pull", "--ff-only", REMOTE, MAIN_BRANCH)

    if _tag_exists_local(plan.target):
        if _tag_exists_remote(plan.target):
            _step(8, total, f"Tag {plan.target} already on {REMOTE} — skip")
        else:
            _step(8, total, f"Tag {plan.target} exists locally — push only")
            run("git", "push", REMOTE, plan.target)
    else:
        _step(8, total, f"Tag merge commit and push {plan.target}")
        run("git", "tag", plan.target)
        run("git", "push", REMOTE, plan.target)

    # ─── 9. GitHub Release ──────────────────────────────────────────────────
    if _release_exists(plan.target):
        _step(9, total, f"GitHub Release {plan.target} already exists — skip")
    else:
        _step(9, total, "Create GitHub Release (triggers publish-npm on the tag)")
        notes = plan.changelog_body or f"Release {plan.target}"
        run(
            "gh", "release", "create", plan.target,
            "--title", plan.target,
            "--notes", notes,
        )

    print()
    print(f"✅  Released {plan.target}")
    print(f"   https://github.com/{REPO_SLUG}/releases/tag/{plan.target}")
    print("   npm publish runs asynchronously via publish-npm.yml on the tag.")


# ─── entrypoint ───────────────────────────────────────────────────────────────


def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument(
        "--as",
        dest="bump_override",
        choices=("major", "minor", "patch"),
        default=None,
        help=(
            "Force a specific bump level. Default is auto-detect from "
            "Conventional Commits since the last tag."
        ),
    )
    p.add_argument(
        "--version",
        dest="explicit",
        default=None,
        help="Use an explicit X.Y.Z instead of the auto-detected bump.",
    )
    p.add_argument(
        "--yes", "-y", action="store_true",
        help="Skip the confirmation prompt.",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Print the plan and exit without touching git/gh.",
    )
    p.add_argument(
        "--no-wait", action="store_true",
        help="Merge immediately without waiting for PR checks to pass.",
    )
    p.add_argument(
        "--resume", action="store_true",
        help=(
            "Recover from a partial run. Each step probes existing state "
            "(branch, commit, PR, tag, GitHub Release) and skips work that "
            "is already done. Use this when an earlier `task release` "
            "crashed mid-pipeline."
        ),
    )
    return p.parse_args(argv)


def resolve_bump(override: str | None, commits: list[Commit]) -> str:
    """Override wins; otherwise auto-detect from commits (or 'patch' if empty)."""
    if override:
        return override
    return infer_bump(commits)


_RELEASE_BRANCH_RE = re.compile(r"^release/(\d+\.\d+\.\d+)$")


def _detect_in_flight_target() -> str | None:
    """Find the in-flight release target from existing release branches.

    Resume mode needs to know which `release/X.Y.Z` is being recovered,
    not what the next bump would be. The release branch name is the
    canonical anchor: it was committed by step 1 of an earlier run and
    is the only state guaranteed to survive a partial pipeline.

    Local branches win over remote, current-branch wins over both — if
    you ran `git checkout release/1.15.0`, that's the target. Returns
    None if no release branch exists; caller falls back to the regular
    bump-inference path.
    """
    head = git("rev-parse", "--abbrev-ref", "HEAD", capture=True)
    m = _RELEASE_BRANCH_RE.match(head)
    if m:
        return m.group(1)

    local_raw = git("for-each-ref", "--format=%(refname:short)", "refs/heads/release/", capture=True)
    candidates = [
        m.group(1)
        for line in local_raw.splitlines()
        if (m := _RELEASE_BRANCH_RE.match(line.strip()))
    ]
    remote_raw = git(
        "for-each-ref", "--format=%(refname:short)",
        f"refs/remotes/{REMOTE}/release/", capture=True,
    )
    for line in remote_raw.splitlines():
        bare = line.strip().removeprefix(f"{REMOTE}/")
        if (m := _RELEASE_BRANCH_RE.match(bare)):
            candidates.append(m.group(1))

    if not candidates:
        return None
    # Sort semver-aware so 1.10.0 > 1.9.0 (lexicographic would lose).
    candidates.sort(key=parse_version)
    return candidates[-1]


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(list(sys.argv[1:] if argv is None else argv))

    current = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))["version"]
    parse_version(current)

    prev = latest_tag()
    commits = commits_since(prev)
    bump = resolve_bump(args.bump_override, commits)

    # Resume mode: prefer an existing `release/X.Y.Z` over computed bump,
    # so we don't accidentally start a 1.16.0 release while 1.15.0 is
    # still in flight. Explicit --version still wins.
    in_flight = _detect_in_flight_target() if args.resume else None
    if args.explicit:
        target = args.explicit
    elif in_flight:
        target = in_flight
        print(f"(resume) detected in-flight release branch release/{in_flight}")
    else:
        target = bump_version(current, bump)
    parse_version(target)

    if not args.dry_run:
        preflight(target, resume=args.resume)

    today = _date.today().isoformat()
    full, body = render_changelog_entry(target, prev, commits, today)
    plan = Plan(
        current=current,
        target=target,
        bump=bump,
        commits=commits,
        last_tag=prev,
        changelog_body=body,
        changelog_entry=full,
    )
    print_preview(plan)
    if args.resume:
        print("(resume) probing existing state — completed steps will be skipped.")

    if args.dry_run:
        return 0

    if not args.yes and not confirm(f"Proceed with release {plan.target}?"):
        print("aborted.")
        return 1

    execute(
        plan,
        wait_for_checks=not args.no_wait,
        dry_run=False,
        resume=args.resume,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
