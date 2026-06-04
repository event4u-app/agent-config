"""Tests for scripts/validate_safe_paths.py — Phase 0 sensitive-path denylist."""
from __future__ import annotations

import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "src" / "scripts" / "validate_safe_paths.py"

_SPEC = importlib.util.spec_from_file_location("validate_safe_paths", SCRIPT)
assert _SPEC and _SPEC.loader
vsp = importlib.util.module_from_spec(_SPEC)
sys.modules["validate_safe_paths"] = vsp
_SPEC.loader.exec_module(vsp)


# One positive fixture per denylist entry. Covers every clause in the
# SENSITIVE_BASENAME_REGEX, the SENSITIVE_PATH_COMPONENTS set, and the
# SENSITIVE_NAME_TOKENS substring fallback.
SENSITIVE_FIXTURES = [
    # .env*
    ".env",
    ".env.local",
    ".env.production",
    # .netrc
    ".netrc",
    # credentials*
    "credentials",
    "credentials.json",
    # secrets* / passwords*
    "secret",
    "secrets.txt",
    "password.yaml",
    "passwords.csv",
    # SSH key pairs
    "id_rsa",
    "id_rsa.pub",
    "id_ed25519",
    "id_ecdsa.pub",
    "id_dsa",
    # SSH state
    "authorized_keys",
    "known_hosts",
    # cert / key bundles
    "server.pem",
    "tls.key",
    "client.p12",
    "bundle.pfx",
    "cert.crt",
    "ca.cer",
    "trust.jks",
    "keystore.keystore",
    "signed.asc",
    "encrypted.gpg",
    # path-component matches
    ".ssh/known_hosts",
    ".aws/credentials",
    ".gnupg/private-keys-v1.d/foo.key",
    ".kube/config",
    ".docker/config.json",
    # substring-token matches with creative separators
    "prod-secret-token.txt",
    "my_api_key.yaml",
    "ApiKey.json",
    "user.password.txt",
    "private-key-backup.bin",
]


NEGATIVE_FIXTURES = [
    "README.md",
    "docs/contracts/telegraph-speak.md",
    "templates/AGENTS.md",
    "src/scripts/condense.py",
    "tests/test_validate_safe_paths.py",
    ".agent-src/rules/commit-policy.md",
    "agents/roadmaps/step-16-telegraph-substance.md",
    "Taskfile.yml",
]


class TestIsSensitive(unittest.TestCase):
    def test_positive_fixtures_are_flagged(self) -> None:
        for rel in SENSITIVE_FIXTURES:
            with self.subTest(path=rel):
                self.assertTrue(
                    vsp.is_sensitive(Path(rel)),
                    f"expected {rel} to be flagged as sensitive",
                )

    def test_negative_fixtures_pass(self) -> None:
        for rel in NEGATIVE_FIXTURES:
            with self.subTest(path=rel):
                self.assertFalse(
                    vsp.is_sensitive(Path(rel)),
                    f"expected {rel} to be safe",
                )

    def test_case_insensitivity(self) -> None:
        self.assertTrue(vsp.is_sensitive(Path(".ENV.LOCAL")))
        self.assertTrue(vsp.is_sensitive(Path("CREDENTIALS.json")))
        self.assertTrue(vsp.is_sensitive(Path("ID_RSA")))


class TestAssertSafe(unittest.TestCase):
    def test_raises_on_sensitive(self) -> None:
        with self.assertRaises(vsp.SensitivePathError):
            vsp.assert_safe(Path(".env.local"))

    def test_silent_on_safe(self) -> None:
        # Returns None; no raise.
        self.assertIsNone(vsp.assert_safe(Path("README.md")))

    def test_error_is_value_error(self) -> None:
        # SensitivePathError inherits ValueError so callers can catch broadly.
        self.assertTrue(issubclass(vsp.SensitivePathError, ValueError))


class TestCLI(unittest.TestCase):
    def _run(self, arg: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), arg],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_cli_rejects_sensitive(self) -> None:
        result = self._run(".env.local")
        self.assertEqual(result.returncode, 2)
        self.assertIn("SensitivePathError", result.stderr)

    def test_cli_accepts_safe(self) -> None:
        result = self._run("README.md")
        self.assertEqual(result.returncode, 0)
        self.assertIn("safe", result.stdout)


if __name__ == "__main__":
    unittest.main()
