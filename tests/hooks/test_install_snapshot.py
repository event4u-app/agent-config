"""Install-output snapshot tests — Phase 7.11 layer (b).

Freezes the structural shape of every per-platform hook config that
`install.py` writes. Companion layers:

- (a) `tests/hooks/test_dispatcher_parser.py` — pure parser unit.
- (c) `tests/hooks/test_event_shape_contract.py` — per-platform native
      payload → envelope contract.

Goal: a breaking change to install.py (renamed binding, dropped event,
shifted CLI flag) trips one of these tests with a useful diff. Per-bridge
behaviour (idempotency, force-overwrite) lives in `test_install_py.py`;
this file only freezes the snapshot.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import install  # noqa: E402


class _Base(unittest.TestCase):
    def setUp(self) -> None:
        self._td = TemporaryDirectory()
        self.project = Path(self._td.name) / "consumer"
        self.project.mkdir()
        # Mirror the agent-config CLI shim install.py expects to find.
        (self.project / "agent-config").write_text("#!/usr/bin/env bash\nexit 0\n")
        (self.project / "agent-config").chmod(0o755)
        self.addCleanup(self._td.cleanup)


class CursorSnapshot(_Base):
    """Cursor `.cursor/hooks.json` schema is locked to event-keyed
    arrays of `{command: "<sh>"}` entries that invoke the dispatcher
    via `./agent-config dispatch:hook`."""

    def test_snapshot(self) -> None:
        install.ensure_cursor_bridge(self.project, force=False)
        data = json.loads((self.project / ".cursor" / "hooks.json").read_text())
        self.assertEqual(data.get("version"), 1, "cursor hooks.json missing version: 1")
        hooks = data["hooks"]
        bound_native = {n for _, n in install.CURSOR_DISPATCHER_BINDINGS}
        self.assertEqual(set(hooks.keys()), bound_native,
                         "cursor hook events drifted from CURSOR_DISPATCHER_BINDINGS")
        for ac_event, native in install.CURSOR_DISPATCHER_BINDINGS:
            self.assertEqual(len(hooks[native]), 1)
            cmd = hooks[native][0]["command"]
            self.assertIn("./agent-config dispatch:hook", cmd)
            self.assertIn("--platform cursor", cmd)
            self.assertIn(f"--event {ac_event}", cmd)
            self.assertIn(f"--native-event {native}", cmd)


class ClineSnapshot(_Base):
    """Cline writes one executable script per binding under
    `.clinerules/hooks/<HookName>`. Filename = native event name,
    body invokes `./agent-config dispatch:hook --platform cline`."""

    def test_snapshot(self) -> None:
        install.ensure_cline_bridge(self.project, force=False)
        hooks_dir = self.project / ".clinerules" / "hooks"
        bound_native = {n for _, n in install.CLINE_DISPATCHER_BINDINGS}
        on_disk = {p.name for p in hooks_dir.iterdir() if p.is_file()}
        self.assertEqual(on_disk, bound_native,
                         "cline hook scripts drifted from CLINE_DISPATCHER_BINDINGS")
        for ac_event, native in install.CLINE_DISPATCHER_BINDINGS:
            script = hooks_dir / native
            self.assertTrue(script.stat().st_mode & 0o111, f"{native}: not executable")
            body = script.read_text()
            self.assertIn("./agent-config dispatch:hook", body)
            self.assertIn("--platform cline", body)
            self.assertIn(f"--event {ac_event}", body)
            self.assertIn(f"--native-event {native}", body)


class WindsurfSnapshot(_Base):
    """Windsurf writes `.windsurf/hooks.json` with one entry per
    binding pointing at `windsurf-dispatcher.sh` via the agent-config
    CLI."""

    def test_snapshot(self) -> None:
        install.ensure_windsurf_bridge(self.project, force=False)
        data = json.loads((self.project / ".windsurf" / "hooks.json").read_text())
        hooks = data["hooks"]
        bound_native = {n for _, n in install.WINDSURF_DISPATCHER_BINDINGS}
        self.assertEqual(set(hooks.keys()), bound_native,
                         "windsurf hook events drifted from WINDSURF_DISPATCHER_BINDINGS")
        for ac_event, native in install.WINDSURF_DISPATCHER_BINDINGS:
            entries = hooks[native]
            self.assertEqual(len(entries), 1, f"{native}: expected 1 entry")
            entry = entries[0]
            self.assertIs(entry.get("show_output"), False,
                          f"{native}: show_output must be false")
            cmd = entry["command"]
            self.assertIn("./agent-config dispatch:hook", cmd)
            self.assertIn("--platform windsurf", cmd)
            self.assertIn(f"--event {ac_event}", cmd)
            self.assertIn(f"--native-event {native}", cmd)


class GeminiSnapshot(_Base):
    """Gemini `.gemini/settings.json` uses the nested
    `hooks → EventName → [{matcher, hooks: [{type, command}]}]` shape
    Gemini docs require."""

    def test_snapshot(self) -> None:
        install.ensure_gemini_bridge(self.project, force=False)
        data = json.loads((self.project / ".gemini" / "settings.json").read_text())
        hooks = data["hooks"]
        bound_native = {n for _, n, _m in install.GEMINI_DISPATCHER_BINDINGS}
        self.assertTrue(bound_native.issubset(hooks.keys()),
                        "gemini bound native events missing from settings.json")
        for ac_event, native, matcher in install.GEMINI_DISPATCHER_BINDINGS:
            groups = hooks[native]
            self.assertEqual(len(groups), 1)
            group = groups[0]
            self.assertEqual(group["matcher"], matcher)
            entry = group["hooks"][0]
            self.assertEqual(entry["type"], "command")
            cmd = entry["command"]
            self.assertIn("./agent-config dispatch:hook", cmd)
            self.assertIn("--platform gemini", cmd)
            self.assertIn(f"--event {ac_event}", cmd)
            self.assertIn(f"--native-event {native}", cmd)


class BindingCoverageSnapshot(unittest.TestCase):
    """Each platform binding table covers the manifest's platform block.
    Drift between install.py and `scripts/hook_manifest.yaml` is the
    silent-no-op failure mode the orphan check guards on the manifest
    side; this layer guards from the install side."""

    def test_bindings_cover_manifest_events(self) -> None:
        sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))
        import dispatch_hook  # noqa: E402

        manifest = dispatch_hook._load_yaml(REPO_ROOT / "scripts" / "hook_manifest.yaml")
        platforms = manifest.get("platforms") or {}

        def _ac_events(bindings: tuple) -> set[str]:
            return {b[0] for b in bindings}

        for platform, bindings in [
            ("cursor", install.CURSOR_DISPATCHER_BINDINGS),
            ("cline",  install.CLINE_DISPATCHER_BINDINGS),
            ("windsurf", install.WINDSURF_DISPATCHER_BINDINGS),
            ("gemini", install.GEMINI_DISPATCHER_BINDINGS),
        ]:
            with self.subTest(platform=platform):
                manifest_events = {
                    e for e in (platforms.get(platform) or {}).keys()
                    if e != "fallback_only"
                }
                self.assertTrue(manifest_events.issubset(_ac_events(bindings)),
                                f"{platform}: manifest events {manifest_events} "
                                f"not covered by install bindings {_ac_events(bindings)}")
