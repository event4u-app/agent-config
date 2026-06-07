"""Toolchain resolution — pick the right test/quality runner per stack.

Sibling of :mod:`work_engine.stack.detect` (which labels the *frontend*
stack). This module answers a different question: *given a project root,
which test runner and quality tools does this stack actually use, and
what is the exact command to invoke them?* It is the engine behind
6.1.0 Step 6 — the toolchain resolver that lets one set of commands
(`/tests execute`, `/tests create`, `/quality-fix`, `/review-changes`,
`/work`) adapt to phpunit / pest / vitest / jest / playwright / pytest /
go / cargo instead of exploding into per-stack command variants.

Detection is filesystem-cheap and **never crashes**: a malformed
manifest, a missing file, or an unknown stack degrades to a LOW-confidence
empty result rather than raising — a wrong toolchain label is recoverable
(the agent can ask), a crash mid-run is not. This mirrors the
recoverable-error contract in :mod:`detect`.

Three opt-in flags shape the *selected* command set (the monorepo guard):

* ``include_e2e`` — by default e2e suites (playwright / cypress) are
  excluded; fast unit tests run first. Pass to add them.
* ``include_slow`` — by default a script tagged ``test:slow`` /
  ``test:integration`` is excluded. Pass to add it.
* ``php_only`` — keep only the PHP ecosystem (the ``--php`` narrowing the
  roadmap calls for; "only genuine PHP-space commands stay PHP-locked").

The full per-stack inventory is always returned (``runners``); the
``selected`` tuple is what a command should actually run after applying
the flags + the fast-by-default monorepo guard.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

KNOWN_RUNNERS: frozenset[str] = frozenset(
    {
        "pest",
        "phpunit",
        "vitest",
        "jest",
        "playwright",
        "cypress",
        "pytest",
        "go-test",
        "cargo-test",
    },
)
"""Every test-runner label the resolver can emit.

Single source of truth so the state schema, fixtures, and tests validate
against one set without re-deriving it."""

# Speed buckets. ``fast`` runs by default; ``slow`` needs ``include_slow``;
# ``e2e`` needs ``include_e2e``. The monorepo guard reads this.
SPEED_FAST = "fast"
SPEED_SLOW = "slow"
SPEED_E2E = "e2e"

# Confidence tiers — declarative, mirrors the non-interactive-contract
# tiers (HIGH = deterministic dependency/marker; MEDIUM = heuristic;
# LOW = nothing matched).
HIGH = "HIGH"
MEDIUM = "MEDIUM"
LOW = "LOW"

_MANIFESTS = (
    "composer.json",
    "package.json",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "Makefile",
    "Taskfile.yml",
    "Taskfile.yaml",
)


@dataclass(frozen=True)
class RunnerResult:
    """One detected test runner for one ecosystem.

    ``command`` is the exact invocation to run the suite (a task-runner
    wrapper like ``make test`` when one exists, otherwise the direct
    tool). ``speed`` is one of :data:`SPEED_FAST` / :data:`SPEED_SLOW` /
    :data:`SPEED_E2E`; the monorepo guard filters on it. ``basis`` names
    the concrete signal that matched (dependency, binary, marker file)
    so the routing decision is auditable, exactly like the
    non-interactive-contract's ``basis`` column.
    """

    ecosystem: str
    runner: str
    command: str
    speed: str = SPEED_FAST
    confidence: str = HIGH
    basis: str = ""


@dataclass(frozen=True)
class ToolchainResult:
    """Outcome of one toolchain-resolution pass over a project root.

    ``runners`` is the full inventory (every ecosystem detected, every
    speed bucket). ``selected`` is what a command should actually run
    after the flags + fast-by-default guard. ``quality`` is the ordered
    list of quality/lint commands per detected ecosystem. ``confidence``
    is the overall tier (HIGH when ≥1 runner matched deterministically
    and no cross-ecosystem conflict; LOW when nothing matched).
    ``mtime`` is the latest manifest mtime, used for cache invalidation
    just like :class:`detect.StackResult`.
    """

    ecosystems: tuple[str, ...]
    runners: tuple[RunnerResult, ...]
    selected: tuple[RunnerResult, ...]
    quality: tuple[str, ...]
    confidence: str
    mtime: float

    def to_config(self) -> dict[str, object]:
        """Serialise to the auto-generated project-config shape.

        Written to ``agents/runtime/state/toolchain.json`` by
        :func:`write_config` so the per-stack commands are captured once
        and re-read cheaply (keyed on ``mtime``) instead of re-detected
        every turn.
        """
        return {
            "ecosystems": list(self.ecosystems),
            "confidence": self.confidence,
            "mtime": self.mtime,
            "runners": [
                {
                    "ecosystem": r.ecosystem,
                    "runner": r.runner,
                    "command": r.command,
                    "speed": r.speed,
                    "confidence": r.confidence,
                    "basis": r.basis,
                }
                for r in self.runners
            ],
            "selected": [r.command for r in self.selected],
            "quality": list(self.quality),
        }


def resolve_toolchain(
    project_root: Path,
    *,
    include_slow: bool = False,
    include_e2e: bool = False,
    php_only: bool = False,
) -> ToolchainResult:
    """Inspect ``project_root`` and resolve its test/quality toolchain.

    Parameters
    ----------
    project_root:
        Directory carrying the manifests (``composer.json`` /
        ``package.json`` / ``pyproject.toml`` / ``go.mod`` /
        ``Cargo.toml``). The resolver does not walk upwards — the caller
        picks the scope, matching :func:`detect.detect_stack`.
    include_slow, include_e2e:
        Monorepo guard. Off by default → ``selected`` carries only fast
        unit suites. Turn on to add the slow / e2e buckets.
    php_only:
        The ``--php`` narrowing — keep only the PHP ecosystem in
        ``selected`` (the full inventory is still returned in
        ``runners``).

    Returns
    -------
    ToolchainResult
        Never raises. No manifest / unknown stack → an empty result with
        ``confidence == LOW`` so the caller can fall back to asking.
    """
    runners: list[RunnerResult] = []
    quality: list[str] = []

    composer = _read_json(project_root / "composer.json")
    package = _read_json(project_root / "package.json")
    has_composer = (project_root / "composer.json").is_file()
    has_package = (project_root / "package.json").is_file()
    pyproject_text = _read_text(project_root / "pyproject.toml")
    has_python = bool(pyproject_text) or (project_root / "requirements.txt").is_file() \
        or (project_root / "setup.cfg").is_file() or (project_root / "pytest.ini").is_file()
    has_go = (project_root / "go.mod").is_file()
    has_cargo = (project_root / "Cargo.toml").is_file()

    wrappers = _task_runner_wrappers(project_root, package)

    if has_composer:
        runners.extend(_php_runners(project_root, composer, wrappers))
        quality.extend(_php_quality(project_root, composer, wrappers))
    if has_package:
        runners.extend(_js_runners(package, wrappers))
        quality.extend(_js_quality(package, wrappers))
    if has_python:
        runners.extend(_python_runners(pyproject_text))
        quality.extend(_python_quality(pyproject_text))
    if has_go:
        runners.append(
            RunnerResult("go", "go-test", "go test ./...", SPEED_FAST, HIGH, "go.mod present"),
        )
        quality.append("go vet ./...")
    if has_cargo:
        runners.append(
            RunnerResult("rust", "cargo-test", "cargo test", SPEED_FAST, HIGH, "Cargo.toml present"),
        )
        quality.append("cargo clippy")

    ecosystems = tuple(dict.fromkeys(r.ecosystem for r in runners))
    selected = _apply_guard(
        runners, include_slow=include_slow, include_e2e=include_e2e, php_only=php_only,
    )
    confidence = _overall_confidence(runners)

    return ToolchainResult(
        ecosystems=ecosystems,
        runners=tuple(runners),
        selected=tuple(selected),
        quality=tuple(dict.fromkeys(quality)),
        confidence=confidence,
        mtime=latest_manifest_mtime(project_root),
    )


def write_config(project_root: Path, result: ToolchainResult) -> Path:
    """Persist ``result`` to ``agents/runtime/state/toolchain.json``.

    The auto-generated per-stack config the roadmap calls for. Best-effort:
    returns the path written; never raises on a read-only or missing
    parent (the resolver is a routing aid, not a hard dependency).
    """
    target = project_root / "agents" / "runtime" / "state" / "toolchain.json"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(result.to_config(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    except OSError:
        pass
    return target


def latest_manifest_mtime(project_root: Path) -> float:
    """Latest mtime across every manifest the resolver consults.

    Cache-invalidation hook: when the persisted value no longer matches
    the live value the cached toolchain is stale and resolution re-runs.
    ``0.0`` when no manifest exists (greenfield) — a stable sentinel, not
    a missing-file error.
    """
    mtimes = [
        (project_root / name).stat().st_mtime
        for name in _MANIFESTS
        if (project_root / name).is_file()
    ]
    return max(mtimes) if mtimes else 0.0


# --------------------------------------------------------------------------
# Ecosystem resolvers
# --------------------------------------------------------------------------

def _php_runners(
    root: Path, composer: dict[str, object], wrappers: dict[str, str],
) -> list[RunnerResult]:
    deps = _all_dependencies(composer, "require", "require-dev")
    if "pestphp/pest" in deps or (root / "vendor" / "bin" / "pest").is_file():
        cmd = wrappers.get("php-test") or "vendor/bin/pest"
        basis = "pestphp/pest in composer require" if "pestphp/pest" in deps \
            else "vendor/bin/pest present"
        return [RunnerResult("php", "pest", cmd, SPEED_FAST, HIGH, basis)]
    if (root / "artisan").is_file():
        cmd = wrappers.get("php-test") or "php artisan test"
        return [RunnerResult("php", "phpunit", cmd, SPEED_FAST, HIGH, "artisan present (Laravel)")]
    if "phpunit/phpunit" in deps or (root / "vendor" / "bin" / "phpunit").is_file():
        cmd = wrappers.get("php-test") or "vendor/bin/phpunit"
        return [RunnerResult("php", "phpunit", cmd, SPEED_FAST, HIGH, "phpunit/phpunit detected")]
    # composer.json with no test dependency — phpunit is the safe PHP default.
    cmd = wrappers.get("php-test") or "vendor/bin/phpunit"
    return [RunnerResult("php", "phpunit", cmd, SPEED_FAST, MEDIUM, "composer.json present, no explicit runner")]


def _js_runners(package: dict[str, object], wrappers: dict[str, str]) -> list[RunnerResult]:
    deps = _all_dependencies(
        package, "dependencies", "devDependencies", "peerDependencies", "optionalDependencies",
    )
    scripts = package.get("scripts") if isinstance(package.get("scripts"), dict) else {}
    pm_test = wrappers.get("js-test")
    out: list[RunnerResult] = []

    # Fast unit runner — vitest beats jest when both present (vitest is the
    # modern default), but only one fast runner is selected.
    if "vitest" in deps:
        cmd = pm_test if pm_test and _script_uses(scripts, "test", "vitest") else "npx vitest run"
        out.append(RunnerResult("js", "vitest", cmd, SPEED_FAST, HIGH, "vitest in package deps"))
    elif "jest" in deps:
        cmd = pm_test if pm_test and _script_uses(scripts, "test", "jest") else "npx jest"
        out.append(RunnerResult("js", "jest", cmd, SPEED_FAST, HIGH, "jest in package deps"))
    elif pm_test:
        out.append(RunnerResult("js", "jest", pm_test, SPEED_FAST, MEDIUM, "package.json test script, runner unclear"))

    # e2e runner — separate bucket, excluded unless --include-e2e.
    if "@playwright/test" in deps or "playwright" in deps:
        cmd = _script_command(scripts, ("test:e2e", "e2e", "playwright")) or "npx playwright test"
        out.append(RunnerResult("js", "playwright", cmd, SPEED_E2E, HIGH, "@playwright/test in package deps"))
    elif "cypress" in deps:
        cmd = _script_command(scripts, ("test:e2e", "e2e", "cypress")) or "npx cypress run"
        out.append(RunnerResult("js", "cypress", cmd, SPEED_E2E, HIGH, "cypress in package deps"))

    # slow bucket — an explicit slow/integration script.
    slow_cmd = _script_command(scripts, ("test:slow", "test:integration"))
    if slow_cmd:
        out.append(RunnerResult("js", "vitest" if "vitest" in deps else "jest", slow_cmd, SPEED_SLOW, MEDIUM, "test:slow/integration script"))
    return out


def _python_runners(pyproject_text: str) -> list[RunnerResult]:
    if "pytest" in pyproject_text or pyproject_text == "":
        conf = HIGH if "pytest" in pyproject_text else MEDIUM
        basis = "pytest in pyproject" if "pytest" in pyproject_text else "python project, no explicit runner"
        return [RunnerResult("python", "pytest", "pytest", SPEED_FAST, conf, basis)]
    return [RunnerResult("python", "pytest", "pytest", SPEED_FAST, MEDIUM, "python project, no explicit runner")]


def _php_quality(root: Path, composer: dict[str, object], wrappers: dict[str, str]) -> list[str]:
    deps = _all_dependencies(composer, "require", "require-dev")
    out: list[str] = []
    if "phpstan/phpstan" in deps or (root / "vendor" / "bin" / "phpstan").is_file():
        out.append("vendor/bin/phpstan analyse")
    if "laravel/pint" in deps or (root / "vendor" / "bin" / "pint").is_file():
        out.append("vendor/bin/pint")
    return out


def _js_quality(package: dict[str, object], wrappers: dict[str, str]) -> list[str]:
    deps = _all_dependencies(
        package, "dependencies", "devDependencies", "peerDependencies", "optionalDependencies",
    )
    out: list[str] = []
    if "typescript" in deps:
        out.append("npx tsc --noEmit")
    if "eslint" in deps:
        out.append("npx eslint .")
    return out


def _python_quality(pyproject_text: str) -> list[str]:
    out: list[str] = []
    if "ruff" in pyproject_text:
        out.append("ruff check")
    if "mypy" in pyproject_text:
        out.append("mypy .")
    return out


# --------------------------------------------------------------------------
# Task-runner wrappers (Makefile / Taskfile / package scripts)
# --------------------------------------------------------------------------

def _task_runner_wrappers(root: Path, package: dict[str, object]) -> dict[str, str]:
    """Map logical roles to a wrapper command when one exists.

    Wrappers win over direct tool invocation (they handle container
    access, env, parallelism) — the architecture rule's "Build / Task
    Runner Detection". Returns role → command; absent roles fall through
    to the direct tool.
    """
    out: dict[str, str] = {}
    makefile = _read_text(root / "Makefile")
    taskfile = _read_text(root / "Taskfile.yml") or _read_text(root / "Taskfile.yaml")
    if makefile and re.search(r"(?m)^test\s*:", makefile):
        out["php-test"] = "make test"
    elif taskfile and re.search(r"(?m)^\s*test\s*:", taskfile):
        out["php-test"] = "task test"
    scripts = package.get("scripts") if isinstance(package.get("scripts"), dict) else {}
    if isinstance(scripts, dict) and "test" in scripts:
        out["js-test"] = f"{_package_manager(root)} test"
    return out


def _package_manager(root: Path) -> str:
    if (root / "pnpm-lock.yaml").is_file():
        return "pnpm"
    if (root / "yarn.lock").is_file():
        return "yarn"
    return "npm"


# --------------------------------------------------------------------------
# Monorepo guard + confidence
# --------------------------------------------------------------------------

def _apply_guard(
    runners: list[RunnerResult], *, include_slow: bool, include_e2e: bool, php_only: bool,
) -> list[RunnerResult]:
    out: list[RunnerResult] = []
    for r in runners:
        if php_only and r.ecosystem != "php":
            continue
        if r.speed == SPEED_E2E and not include_e2e:
            continue
        if r.speed == SPEED_SLOW and not include_slow:
            continue
        out.append(r)
    return out


def _overall_confidence(runners: list[RunnerResult]) -> str:
    if not runners:
        return LOW
    if any(r.confidence == HIGH for r in runners):
        return HIGH
    return MEDIUM


# --------------------------------------------------------------------------
# Shared readers (mirror detect.py's recoverable-error contract)
# --------------------------------------------------------------------------

def _read_json(path: Path) -> dict[str, object]:
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def _all_dependencies(manifest: dict[str, object], *keys: str) -> dict[str, object]:
    merged: dict[str, object] = {}
    for key in keys:
        section = manifest.get(key)
        if isinstance(section, dict):
            merged.update(section)
    return merged


def _script_uses(scripts: dict[str, object], name: str, tool: str) -> bool:
    value = scripts.get(name)
    return isinstance(value, str) and tool in value


def _script_command(scripts: dict[str, object], names: tuple[str, ...]) -> str:
    for name in names:
        if isinstance(scripts.get(name), str):
            return f"npm run {name}"
    return ""


__all__ = [
    "HIGH",
    "KNOWN_RUNNERS",
    "LOW",
    "MEDIUM",
    "RunnerResult",
    "SPEED_E2E",
    "SPEED_FAST",
    "SPEED_SLOW",
    "ToolchainResult",
    "latest_manifest_mtime",
    "resolve_toolchain",
    "write_config",
]
