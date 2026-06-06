"""Prompt loader — reads `dist/agent-src/skills/` and `dist/agent-src/commands/`.

Phase 1 (A4) exposed 5 hand-picked, stack-agnostic skills. Phase 2
(B1–B3) extends to the full set: every `SKILL.md` under
`dist/agent-src/skills/` plus every `*.md` under `dist/agent-src/commands/`.

Frontmatter `name` + `description` map to MCP prompt metadata; the
body (frontmatter stripped) is the prompt content. Frontmatter
`source:` is forwarded verbatim into the MCP `_meta` field so clients
can filter package-vs-project entries on the wire.

Project-overrides resolution: `dist/agent-src/` is the already-merged
view at sync time; the runtime loader does not re-merge.

Frontmatter validation (B3): entries missing `name` or `description`
are skipped and surfaced in the second tuple element of `scan_*`
helpers (caller decides whether to log).
"""
from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from pathlib import Path
try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib.agent_settings import project_settings_path
except ModuleNotFoundError:  # pragma: no cover
    from _lib.agent_settings import project_settings_path
from typing import Any, Literal

# Phase 1 hand-picked skills — kept for the Phase-1 entrypoint
# (`load_phase_1_prompts`) and as the contract-test fixture set. The
# roadmap originally listed `verify-before-complete`, which lives as
# a rule, not a skill; its skill counterpart is
# `verify-completion-evidence` (same evidence-gate obligation).
PHASE_1_SKILLS: tuple[str, ...] = (
    "verify-completion-evidence",
    "systematic-debugging",
    "test-driven-development",
    "refine-ticket",
    "conventional-commits-writing",
)

PromptKind = Literal["skill", "command"]
UserTypeMatch = Literal["", "match", "universal", "outside"]


@dataclass(frozen=True)
class SkillPrompt:
    """Resolved Markdown prompt ready for MCP exposure.

    `kind` distinguishes the two Phase-2 source families. The name
    field is the frontmatter `name:` value verbatim (e.g.
    `test-driven-development` or `research:report`); MCP wire names
    are derived in `to_mcp_prompt_meta` with `kind`-aware prefixing.

    `recommended_for_user_types` mirrors the SKILL.md frontmatter
    array (step-9 user-type axis). Empty tuple = universal (no
    user-type constraint declared). `user_type_match` is the
    cache-computed match label against the active `personal.user_type`
    in `.agent-settings.yml`; empty string means filtering is disabled.
    """

    name: str
    description: str
    body: str
    source: str
    kind: PromptKind = "skill"
    recommended_for_user_types: tuple[str, ...] = ()
    user_type_match: UserTypeMatch = ""


def _project_root() -> Path:
    """Walk up from this file to the repo root (parent of `scripts/`)."""
    return Path(__file__).resolve().parent.parent.parent.parent


def _strip_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Split a Markdown file with `---` frontmatter into (meta, body).

    Tiny YAML-ish parser sufficient for our flat key/value frontmatter.
    Avoids a `pyyaml` dependency for Phase 1; the frontmatter shape is
    enforced by `task lint-skills` upstream.
    """
    if not text.startswith("---\n"):
        return {}, text
    try:
        _, fm, body = text.split("---\n", 2)
    except ValueError:
        return {}, text
    meta: dict[str, str] = {}
    for line in fm.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"').strip("'")
    return meta, body.lstrip("\n")


def _parse_inline_array(value: str) -> tuple[str, ...]:
    """Parse `[a, b, c]` inline-array frontmatter value into a tuple.

    Returns `()` for any malformed or empty value. Quotes around items
    are stripped. This is intentionally a tiny parser — the canonical
    schema for skill frontmatter is enforced upstream by
    `task lint-skills` / `scripts/validate_frontmatter.py`.
    """
    v = value.strip()
    if not (v.startswith("[") and v.endswith("]")):
        return ()
    inner = v[1:-1].strip()
    if not inner:
        return ()
    items: list[str] = []
    for raw in inner.split(","):
        item = raw.strip().strip('"').strip("'")
        if item:
            items.append(item)
    return tuple(items)


def _load_active_user_type(root: Path) -> str:
    """Read `personal.user_type` from `.agent-settings.yml`.

    Returns `""` when the file is missing, the key is unset, or the
    value is still the install-time placeholder (`__USER_TYPE__`).
    Empty string disables the runtime filter (legacy behavior — every
    skill surfaces with its native sort order).

    Tiny line-based parser to avoid a `pyyaml` runtime dependency for
    the loader (consistent with `_strip_frontmatter`). Only matches
    `user_type:` directly under the top-level `personal:` block.
    """
    settings = project_settings_path(root)
    if not settings.is_file():
        return ""
    try:
        text = settings.read_text(encoding="utf-8")
    except OSError:
        return ""
    in_personal = False
    for raw in text.splitlines():
        if not raw or raw.lstrip().startswith("#"):
            continue
        if not raw[0].isspace():
            # Top-level key — flip in_personal based on whether it's `personal:`.
            head = raw.split("#", 1)[0].strip().rstrip(":")
            in_personal = head == "personal"
            continue
        if not in_personal:
            continue
        stripped = raw.strip()
        if not stripped.startswith("user_type:"):
            continue
        _, _, value = stripped.partition(":")
        value = value.split("#", 1)[0].strip().strip('"').strip("'")
        if value.startswith("__") and value.endswith("__"):
            return ""
        return value
    return ""


def load_skill(name: str, root: Path | None = None) -> SkillPrompt:
    """Load a single skill by name. Raises FileNotFoundError if missing."""
    base = root or _project_root()
    path = base / "dist/agent-src" / "skills" / name / "SKILL.md"
    if not path.exists():
        raise FileNotFoundError(f"SKILL.md not found: {path}")
    return _load_file(path, kind="skill", fallback_name=name)


def _load_file(
    path: Path,
    *,
    kind: PromptKind,
    fallback_name: str,
) -> SkillPrompt:
    text = path.read_text(encoding="utf-8")
    meta, body = _strip_frontmatter(text)
    return SkillPrompt(
        name=meta.get("name", fallback_name),
        description=meta.get("description", "").strip(),
        body=body.rstrip() + "\n",
        source=meta.get("source", "package"),
        kind=kind,
        recommended_for_user_types=_parse_inline_array(
            meta.get("recommended_for_user_types", "")
        ),
    )


def load_phase_1_prompts(root: Path | None = None) -> list[SkillPrompt]:
    """Load every skill listed in PHASE_1_SKILLS.

    Kept for backward compatibility with Phase-1 tests and as a
    minimal smoke path. Production entrypoint is `load_all_prompts`.
    """
    prompts: list[SkillPrompt] = []
    errors: list[str] = []
    for name in PHASE_1_SKILLS:
        try:
            prompts.append(load_skill(name, root=root))
        except FileNotFoundError as exc:
            errors.append(str(exc))
    if errors and not prompts:
        raise RuntimeError(
            "No Phase 1 skills loaded. Errors:\n  - "
            + "\n  - ".join(errors)
        )
    return prompts


def scan_skills(
    root: Path | None = None,
) -> tuple[list[SkillPrompt], list[str]]:
    """Enumerate every `dist/agent-src/skills/*/SKILL.md`.

    Returns `(prompts, errors)`. Files missing `name` or
    `description` frontmatter are skipped with a one-line reason in
    `errors`. Files that fail to read are surfaced the same way.
    """
    base = root or _project_root()
    skills_root = base / "dist/agent-src" / "skills"
    prompts: list[SkillPrompt] = []
    errors: list[str] = []
    if not skills_root.is_dir():
        return prompts, errors
    for skill_dir in sorted(skills_root.iterdir()):
        path = skill_dir / "SKILL.md"
        if not path.is_file():
            continue
        try:
            prompt = _load_file(path, kind="skill", fallback_name=skill_dir.name)
        except OSError as exc:
            errors.append(f"{path}: read failed ({exc})")
            continue
        if not prompt.description:
            errors.append(f"{path}: missing frontmatter description")
            continue
        prompts.append(prompt)
    return prompts, errors


def scan_commands(
    root: Path | None = None,
) -> tuple[list[SkillPrompt], list[str]]:
    """Enumerate every `dist/agent-src/commands/**/*.md`.

    Same return contract as `scan_skills`. Command frontmatter `name:`
    values use `:` as cluster/sub separator (e.g. `research:report`);
    the value is preserved verbatim and translated to MCP wire form
    in `to_mcp_prompt_meta`.
    """
    base = root or _project_root()
    cmd_root = base / "dist/agent-src" / "commands"
    prompts: list[SkillPrompt] = []
    errors: list[str] = []
    if not cmd_root.is_dir():
        return prompts, errors
    for path in sorted(cmd_root.rglob("*.md")):
        if not path.is_file():
            continue
        rel = path.relative_to(cmd_root).with_suffix("")
        fallback = str(rel).replace("/", ":")
        try:
            prompt = _load_file(path, kind="command", fallback_name=fallback)
        except OSError as exc:
            errors.append(f"{path}: read failed ({exc})")
            continue
        if not prompt.description:
            errors.append(f"{path}: missing frontmatter description")
            continue
        prompts.append(prompt)
    return prompts, errors


def load_all_prompts(
    root: Path | None = None,
) -> tuple[list[SkillPrompt], list[str]]:
    """Phase 2 entrypoint — all skills + all commands.

    Result is sorted by MCP wire name (deterministic across boots)
    and de-duplicated: if the same wire name appears in both lists
    (should not happen in a clean tree) the skill copy wins and the
    duplicate is reported in `errors`.
    """
    skills, skill_errors = scan_skills(root)
    commands, command_errors = scan_commands(root)
    errors = list(skill_errors) + list(command_errors)
    seen: dict[str, SkillPrompt] = {}
    for prompt in skills + commands:
        wire = to_mcp_prompt_meta(prompt)["name"]
        if wire in seen:
            errors.append(
                f"duplicate MCP name {wire!r}: keeping {seen[wire].kind}, "
                f"skipping {prompt.kind}"
            )
            continue
        seen[wire] = prompt
    merged = sorted(seen.values(), key=lambda p: to_mcp_prompt_meta(p)["name"])
    return merged, errors


def to_mcp_prompt_meta(prompt: SkillPrompt) -> dict[str, Any]:
    """Project a SkillPrompt into MCP `Prompt` constructor kwargs.

    Wire-name shape:
        skill.<frontmatter-name>            (skills)
        command.<frontmatter-name with : → .>  (commands)
    Colons in command names (e.g. `research:report`) become `.` so
    the wire identifier is a single-segment dotted path that survives
    every MCP client we have tested.

    When the user-type axis is active (`PromptCache` resolves a
    non-empty `personal.user_type`), each prompt carries a
    `user_type_match` label and the projected `_meta` surfaces it so
    MCP clients can render the "outside <id> filter" collapse group.
    Absent / empty label means filtering is off — meta is unchanged
    from the legacy shape, preserving back-compat.
    """
    if prompt.kind == "command":
        wire = f"command.{prompt.name.replace(':', '.')}"
    else:
        wire = f"skill.{prompt.name}"
    meta: dict[str, Any] = {"source": prompt.source, "kind": prompt.kind}
    if prompt.user_type_match:
        meta["user_type_match"] = prompt.user_type_match
    return {
        "name": wire,
        "title": prompt.name,
        "description": prompt.description,
        "arguments": [],
        "_meta": meta,
    }


def _user_type_rank(prompt: SkillPrompt, user_type: str) -> tuple[int, UserTypeMatch]:
    """Return `(sort_rank, match_label)` for the step-9 axis.

    Ranks (lower sorts first):
        0 = match     — user_type is in `recommended_for_user_types`
        1 = universal — prompt declares no recommended_for_user_types
        2 = outside   — declared, but user_type is not in the list

    Caller must guarantee `user_type` is non-empty (filter is on).
    """
    declared = prompt.recommended_for_user_types
    if not declared:
        return (1, "universal")
    if user_type in declared:
        return (0, "match")
    return (2, "outside")


class PromptCache:
    """In-memory cache with mtime-based invalidation (B5 hot-reload).

    `get()` re-scans `dist/agent-src/skills/` and `dist/agent-src/commands/`
    when any tracked SKILL.md / command file has changed mtime since
    the previous scan. New / removed files also trigger a refresh
    (the set of tracked paths is part of the staleness key).

    The cache is intentionally simple: no inotify, no debounce, no
    background thread. The server calls `get()` once per
    `prompts/list` request, which is the natural rate-limiter.
    """

    def __init__(self, root: Path | None = None) -> None:
        self._root = root or _project_root()
        self._prompts: list[SkillPrompt] = []
        self._errors: list[str] = []
        self._signature: tuple[tuple[str, float], ...] = ()
        self._index: dict[str, SkillPrompt] = {}
        self._active_user_type: str = ""

    def _current_signature(self) -> tuple[tuple[str, float], ...]:
        entries: list[tuple[str, float]] = []
        skills_root = self._root / "dist/agent-src" / "skills"
        if skills_root.is_dir():
            for skill_dir in sorted(skills_root.iterdir()):
                path = skill_dir / "SKILL.md"
                if path.is_file():
                    entries.append((str(path), path.stat().st_mtime))
        cmd_root = self._root / "dist/agent-src" / "commands"
        if cmd_root.is_dir():
            for path in sorted(cmd_root.rglob("*.md")):
                if path.is_file():
                    entries.append((str(path), path.stat().st_mtime))
        # `.agent-settings.yml` participates in the signature so a
        # user_type flip (re-run install with a different --user-type)
        # invalidates the cache without needing a SKILL.md touch.
        settings = self._root / ".agent-settings.yml"
        if settings.is_file():
            entries.append((str(settings), settings.stat().st_mtime))
        return tuple(entries)

    def _refresh(self) -> None:
        prompts, errors = load_all_prompts(self._root)
        user_type = _load_active_user_type(self._root)
        self._active_user_type = user_type
        if user_type:
            # Tag every prompt with its match label and resort:
            #   match (0) → universal (1) → outside (2), then wire name.
            tagged: list[SkillPrompt] = []
            for prompt in prompts:
                _rank, label = _user_type_rank(prompt, user_type)
                tagged.append(dataclasses.replace(prompt, user_type_match=label))
            prompts = sorted(
                tagged,
                key=lambda p: (
                    _user_type_rank(p, user_type)[0],
                    to_mcp_prompt_meta(p)["name"],
                ),
            )
        self._prompts = prompts
        self._errors = errors
        self._index = {to_mcp_prompt_meta(p)["name"]: p for p in prompts}

    def get(self) -> tuple[list[SkillPrompt], list[str]]:
        """Return cached prompts + errors, refreshing on mtime change."""
        signature = self._current_signature()
        if signature != self._signature:
            self._signature = signature
            self._refresh()
        return self._prompts, self._errors

    @property
    def signature(self) -> tuple[tuple[str, float], ...]:
        """Cached `(path, mtime)` tuples (Phase-6 F1 input). Call `get()` first."""
        return self._signature

    @property
    def active_user_type(self) -> str:
        """Currently resolved `personal.user_type` (or `""` if no filter)."""
        return self._active_user_type

    def lookup(self, wire_name: str) -> SkillPrompt | None:
        """Resolve an MCP wire name to its SkillPrompt, refreshing first."""
        self.get()
        return self._index.get(wire_name)
