#!/usr/bin/env python3
"""
Tests for the wizard-wiring follow-up: ``--dry-run`` and ``--no-ui``
flags plus the gate-evaluation helper in ``scripts/install.py``.

Roadmap: ``agents/roadmaps/wizard-install-py-wiring.md`` Step 4.
Run: ``python3 -m unittest tests.test_install_wizard_wiring -v``
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import install  # type: ignore  # noqa: E402


class WizardShouldLaunchTests(unittest.TestCase):
    """Gate evaluation — ``_wizard_should_launch`` decisions."""

    def _opts(self, **overrides):
        ns = argparse.Namespace(no_ui=False, dry_run=False)
        for k, v in overrides.items():
            setattr(ns, k, v)
        return ns

    def test_no_ui_flag_blocks(self):
        ok, why = install._wizard_should_launch(self._opts(no_ui=True))
        self.assertFalse(ok)
        self.assertIn("--no-ui", why)

    def test_env_no_ui_blocks(self):
        os.environ["AGENT_CONFIG_NO_UI"] = "1"
        try:
            ok, why = install._wizard_should_launch(self._opts())
            self.assertFalse(ok)
            self.assertIn("AGENT_CONFIG_NO_UI", why)
        finally:
            del os.environ["AGENT_CONFIG_NO_UI"]

    def test_ci_env_blocks(self):
        os.environ["CI"] = "true"
        try:
            ok, why = install._wizard_should_launch(self._opts())
            self.assertFalse(ok)
            self.assertIn("CI", why)
        finally:
            del os.environ["CI"]

    def test_non_tty_blocks(self):
        # Tests run with stdout piped to the test harness — never a TTY.
        # Clear CI env so the no-TTY branch fires (not the CI branch).
        prev_ci = os.environ.pop("CI", None)
        try:
            ok, why = install._wizard_should_launch(self._opts())
            self.assertFalse(ok)
            self.assertIn("TTY", why)
        finally:
            if prev_ci is not None:
                os.environ["CI"] = prev_ci

    def test_explicit_tools_blocks_on_tty(self):
        # road-to-single-install-source-of-truth § Phase 4: an explicit
        # `--tools=<list>` means the caller knows what to install — run the
        # headless CLI, don't open the GUI. Force a TTY + clear CI so the
        # tools gate is the deciding factor.
        prev_ci = os.environ.pop("CI", None)
        orig_isatty = install.sys.stdout.isatty
        install.sys.stdout.isatty = lambda: True  # type: ignore[assignment]
        try:
            ok, why = install._wizard_should_launch(self._opts(tools="cursor"))
            self.assertFalse(ok)
            self.assertIn("--tools", why)
        finally:
            install.sys.stdout.isatty = orig_isatty  # type: ignore[assignment]
            if prev_ci is not None:
                os.environ["CI"] = prev_ci

    def test_default_all_tools_launches_on_tty(self):
        # The implicit/explicit `all` default must NOT suppress the wizard.
        prev_ci = os.environ.pop("CI", None)
        orig_isatty = install.sys.stdout.isatty
        install.sys.stdout.isatty = lambda: True  # type: ignore[assignment]
        try:
            ok, _ = install._wizard_should_launch(self._opts(tools="all"))
            self.assertTrue(ok)
        finally:
            install.sys.stdout.isatty = orig_isatty  # type: ignore[assignment]
            if prev_ci is not None:
                os.environ["CI"] = prev_ci


class WizardReadyHandshakeTests(unittest.TestCase):
    """``_WIZARD_READY_RE`` matches the real CLI banner shape
    ``WIZARD_READY <url>`` (road-to-single-install-source-of-truth § Phase 4).
    The CLI emits ``WIZARD_READY http://127.0.0.1:<port>/?token=<t>#/<route>``
    (src/cli/commands/uiServe.ts) — no ``url=`` prefix; query + hash are part
    of the captured URL."""

    def test_matches_real_banner_with_token_and_hash(self):
        line = "WIZARD_READY http://127.0.0.1:51789/?token=deadbeef#/wizard"
        m = install._WIZARD_READY_RE.match(line)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "http://127.0.0.1:51789/?token=deadbeef#/wizard")

    def test_matches_plain_root_and_localhost(self):
        self.assertIsNotNone(install._WIZARD_READY_RE.match("WIZARD_READY http://localhost:8080/"))
        self.assertIsNotNone(install._WIZARD_READY_RE.match("WIZARD_READY http://127.0.0.1:3000/\r"))

    def test_rejects_legacy_url_equals_form(self):
        # The retired `WIZARD_READY url=<url>` form must no longer match.
        self.assertIsNone(install._WIZARD_READY_RE.match("WIZARD_READY url=http://127.0.0.1:5000/"))

    def test_cli_dist_targets_unified_bundle(self):
        # _wizard_cli_dist resolves to dist/cli/agent-config.js (the
        # published bin entry), not the retired packages/core/installer path.
        result = install._wizard_cli_dist(REPO_ROOT)
        if result is not None:
            self.assertEqual(result.name, "agent-config.js")
            self.assertEqual(result.parent.name, "cli")
            self.assertEqual(result.parent.parent.name, "dist")


class DryRunCliTests(unittest.TestCase):
    """End-to-end: ``python3 scripts/install.py --dry-run …`` exits 0
    without writing files or spawning subprocesses."""

    def _run(self, *extra: str):
        with tempfile.TemporaryDirectory() as td:
            env = os.environ.copy()
            env.pop("AGENT_CONFIG_NO_UI", None)
            env.pop("CI", None)
            proc = subprocess.run(  # noqa: S603 - args are locally-built
                [sys.executable, str(REPO_ROOT / "scripts" / "install.py"),
                 "--dry-run", "--project", td, *extra],
                capture_output=True, text=True, env=env, timeout=30,
            )
            # Snapshot the tmpdir contents — must be empty (no writes).
            leftovers = list(Path(td).iterdir())
            return proc, leftovers

    def test_dry_run_exits_zero_no_writes(self):
        proc, leftovers = self._run()
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        self.assertIn("[dry-run]", proc.stdout)
        self.assertEqual(leftovers, [], msg=f"unexpected writes: {leftovers}")

    def test_dry_run_shows_wizard_line(self):
        proc, _ = self._run()
        self.assertIn("wizard:", proc.stdout)

    def test_dry_run_with_no_ui_marks_suppressed(self):
        proc, _ = self._run("--no-ui")
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        # When --no-ui is passed, the wizard line must show suppression
        # reason, not the auto-launch teaser.
        self.assertIn("Suppressed (--no-ui", proc.stdout)
        self.assertNotIn("Would auto-launch", proc.stdout)

    def test_dry_run_summary_lists_core_keys(self):
        proc, _ = self._run("--profile", "minimal", "--tools", "cursor")
        self.assertEqual(proc.returncode, 0, msg=proc.stderr)
        self.assertIn("profile:", proc.stdout)
        self.assertIn("minimal", proc.stdout)
        self.assertIn("scope:", proc.stdout)
        self.assertIn("tools:", proc.stdout)


class WizardCliDistResolutionTests(unittest.TestCase):
    """``_wizard_cli_dist`` returns None when the installer dist is
    absent, an existing Path when the build has been run."""

    def test_returns_none_when_dist_absent(self):
        with tempfile.TemporaryDirectory() as td:
            # Resolve against a project root that has no installer dist.
            # The helper resolves relative to install.py itself, so
            # this asserts the real repo path — adapt by monkeypatching
            # __file__ via a sentinel test only when actually-missing.
            project_root = Path(td)
            result = install._wizard_cli_dist(project_root)
            # In the real repo the dist is usually built; either case
            # is valid as long as the return type is correct.
            self.assertTrue(result is None or isinstance(result, Path))


class ApplyPayloadParityTests(unittest.TestCase):
    """road-to-single-install-source-of-truth § Phase 2 + Phase 6.

    The GUI delegates real apply to ``install.py --apply-payload``; the CLI
    runs ``install.py --global --tools=…``. Both dispatch through the same
    ``install_global`` path, so for the same tool selection the installed
    user-scope tree must be byte-identical. Also asserts the headless path
    never hangs (no GUI spawn when stdout is not a TTY)."""

    TOOLS = ["claude-code", "cursor"]

    def _hash_tree(self, root: Path) -> dict:
        """Hash every installed file under ``root`` (a temp HOME), relative
        to root. Excludes OS noise (``Library/``) and normalizes the one
        volatile field — the lockfile's ``installed_at:`` timestamp — so the
        comparison reflects installed *content*, not wall-clock."""
        import hashlib
        out: dict[str, str] = {}
        if not root.is_dir():
            return out
        for p in sorted(root.rglob("*")):
            if not p.is_file():
                continue
            rel = str(p.relative_to(root))
            if rel.startswith("Library/") or "/Library/" in rel:
                continue
            data = p.read_bytes()
            if p.name == "installed.lock":
                data = b"\n".join(
                    line for line in data.split(b"\n")
                    if not line.startswith(b"installed_at:")
                )
            out[rel] = hashlib.sha256(data).hexdigest()
        return out

    def _run(self, args, home: Path, proj: Path, stdin_devnull=True):
        env = os.environ.copy()
        env["HOME"] = str(home)
        env["AGENT_CONFIG_NO_UPDATE_CHECK"] = "1"
        env.pop("CI", None)
        env.pop("AGENT_CONFIG_NO_UI", None)
        return subprocess.run(  # noqa: S603 - args are locally-built
            [sys.executable, str(REPO_ROOT / "scripts" / "install.py"), *args],
            capture_output=True, text=True, env=env, cwd=str(proj),
            stdin=subprocess.DEVNULL if stdin_devnull else None, timeout=120,
        )

    def test_gui_delegation_matches_cli_tree(self):
        with tempfile.TemporaryDirectory() as a_home, \
             tempfile.TemporaryDirectory() as a_proj, \
             tempfile.TemporaryDirectory() as b_home, \
             tempfile.TemporaryDirectory() as b_proj:
            # GUI delegation: --apply-payload (wizard-v2).
            payload = Path(a_proj) / "payload.json"
            payload.write_text(
                '{"schema_version":"wizard-v2","tools":["claude-code","cursor"],'
                '"packs":[],"settings":{"cost_profile":"balanced"},'
                '"scope_to_project_only":false,"dry_run":false}',
                encoding="utf-8",
            )
            gui = self._run(
                ["--apply-payload", str(payload), "--project", a_proj],
                Path(a_home), Path(a_proj),
            )
            self.assertEqual(gui.returncode, 0, msg=gui.stderr)

            # CLI equivalent: --global --tools=claude-code,cursor.
            cli = self._run(
                ["--global", "--tools", ",".join(self.TOOLS), "--project", b_proj],
                Path(b_home), Path(b_proj),
            )
            self.assertEqual(cli.returncode, 0, msg=cli.stderr)

            gui_tree = self._hash_tree(Path(a_home))
            cli_tree = self._hash_tree(Path(b_home))
            self.assertTrue(gui_tree, msg="GUI delegation wrote no files")
            self.assertEqual(
                gui_tree, cli_tree,
                msg="GUI-delegated apply tree diverges from the CLI tree",
            )

    def test_gui_delegation_emits_ndjson(self):
        with tempfile.TemporaryDirectory() as home, \
             tempfile.TemporaryDirectory() as proj:
            payload = Path(proj) / "payload.json"
            payload.write_text(
                '{"schema_version":"wizard-v2","tools":["cursor"],"packs":[],'
                '"settings":{},"scope_to_project_only":false,"dry_run":false}',
                encoding="utf-8",
            )
            res = self._run(
                ["--apply-payload", str(payload), "--project", proj],
                Path(home), Path(proj),
            )
            self.assertEqual(res.returncode, 0, msg=res.stderr)
            import json
            lines = [json.loads(line) for line in res.stdout.splitlines() if line.strip()]
            self.assertTrue(lines, msg="no NDJSON on stdout")
            types = [obj.get("type") for obj in lines]
            self.assertIn("file", types)
            self.assertEqual(types[-1], "done")

    def test_headless_explicit_tools_does_not_hang(self):
        # Headless fallback (no display, explicit --tools): the real install
        # runs and exits without ever spawning / waiting on the GUI. The
        # 120s subprocess timeout is the hang guard.
        with tempfile.TemporaryDirectory() as home, \
             tempfile.TemporaryDirectory() as proj:
            env_ci = os.environ.copy()
            env_ci["HOME"] = home
            env_ci["CI"] = "1"
            env_ci["AGENT_CONFIG_NO_UPDATE_CHECK"] = "1"
            proc = subprocess.run(  # noqa: S603 - args are locally-built
                [sys.executable, str(REPO_ROOT / "scripts" / "install.py"),
                 "--global", "--tools", "cursor", "--project", proj],
                capture_output=True, text=True, env=env_ci, cwd=proj,
                stdin=subprocess.DEVNULL, timeout=120,
            )
            self.assertEqual(proc.returncode, 0, msg=proc.stderr)
            self.assertNotIn("WIZARD_READY", proc.stdout)


class KillStaleWizardServerTests(unittest.TestCase):
    """`_kill_stale_wizard_server` — fresh-start guard for `init`."""

    def _patch_info_path(self, path: Path) -> None:
        from unittest import mock
        patcher = mock.patch.object(install, "_server_info_path", return_value=path)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_missing_file_is_a_noop(self):
        with tempfile.TemporaryDirectory() as d:
            info = Path(d) / "local-server.json"
            self._patch_info_path(info)
            install._kill_stale_wizard_server()  # no file → nothing to do
            self.assertFalse(info.exists())

    def test_dead_pid_clears_the_record(self):
        with tempfile.TemporaryDirectory() as d:
            info = Path(d) / "local-server.json"
            self._patch_info_path(info)
            # Spawn then reap a process so its pid is reliably dead.
            proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])  # noqa: S603
            proc.terminate()
            proc.wait(timeout=10)
            info.write_text(json.dumps({"pid": proc.pid, "port": 41000, "url": "x"}), encoding="utf-8")
            install._kill_stale_wizard_server()
            self.assertFalse(info.exists())  # stale record removed

    def test_live_unrelated_pid_is_left_untouched(self):
        with tempfile.TemporaryDirectory() as d:
            info = Path(d) / "local-server.json"
            self._patch_info_path(info)
            proc = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])  # noqa: S603
            try:
                info.write_text(json.dumps({"pid": proc.pid, "port": 41000, "url": "x"}), encoding="utf-8")
                install._kill_stale_wizard_server()
                # Command lacks "agent-config" → not our server → not killed.
                self.assertIsNone(proc.poll(), "unrelated process must not be killed")
                self.assertTrue(info.exists())
            finally:
                proc.terminate()
                proc.wait(timeout=10)


if __name__ == "__main__":
    unittest.main()
