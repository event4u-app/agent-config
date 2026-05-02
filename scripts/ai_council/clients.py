"""External-AI clients for the council.

Mirrors the contract from `scripts/skill_trigger_eval.py`:
- Tokens come exclusively from ~/.config/agent-config/<provider>.key.
- File mode must be exactly 0o600. Drift is a hard abort.
- No environment-variable fallback. No keychain fallback.
- Real SDKs (`anthropic`, `openai`) are *soft* dependencies — the
  module imports cleanly without them; only `ask()` requires them.

Tests inject mock clients via the `client=` constructor argument and
never hit the real API.
"""

from __future__ import annotations

import stat
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

ANTHROPIC_KEY_PATH = Path.home() / ".config" / "agent-config" / "anthropic.key"
OPENAI_KEY_PATH = Path.home() / ".config" / "agent-config" / "openai.key"

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"
DEFAULT_OPENAI_MODEL = "gpt-4o"


class KeyGateError(RuntimeError):
    """Raised when a provider key file violates the 0600 contract."""


@dataclass
class CouncilResponse:
    """Normalised output from a single council member."""

    provider: str
    model: str
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    error: str | None = None
    metadata: dict[str, object] = field(default_factory=dict)


def _load_key(path: Path, prefix: str, install_script: str) -> str:
    """Shared 0600-gated key loader. Refuses anything outside the contract."""
    if not path.exists():
        raise KeyGateError(
            f"Key not found at {path}.\n"
            f"    Install it with: bash {install_script}"
        )
    st = path.stat()
    mode = stat.S_IMODE(st.st_mode)
    if mode != 0o600:
        raise KeyGateError(
            f"Unsafe permissions on {path}: got {oct(mode)}, expected 0o600.\n"
            f"    Fix:  chmod 600 {path}"
        )
    key = path.read_text(encoding="utf-8").strip()
    if not key:
        raise KeyGateError(f"{path} is empty.")
    if not key.startswith(prefix):
        raise KeyGateError(
            f"{path} does not look like a {prefix!r}-prefixed key."
        )
    return key


def load_anthropic_key(path: Path = ANTHROPIC_KEY_PATH) -> str:
    return _load_key(path, "sk-ant-", "scripts/install_anthropic_key.sh")


def load_openai_key(path: Path = OPENAI_KEY_PATH) -> str:
    return _load_key(path, "sk-", "scripts/install_openai_key.sh")


class ExternalAIClient(ABC):
    """Abstract base for council members."""

    name: str = ""
    model: str = ""

    @abstractmethod
    def ask(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1024,
    ) -> CouncilResponse:
        """Send one independent query. Must never raise on network/API
        failure — return a `CouncilResponse` with `error` set instead.
        Other members should not be blocked by one failure."""


class AnthropicClient(ExternalAIClient):
    name = "anthropic"

    def __init__(
        self,
        model: str = DEFAULT_ANTHROPIC_MODEL,
        client: object = None,
        api_key: str | None = None,
    ):
        self.model = model
        if client is not None:
            self._client = client
            return
        if api_key is None:
            raise RuntimeError(
                "AnthropicClient requires explicit api_key or injected client. "
                "Use load_anthropic_key() — no env-var fallback."
            )
        try:
            import anthropic  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - exercised only with real SDK
            raise RuntimeError(
                "anthropic package not installed. `pip install anthropic`."
            ) from exc
        self._client = anthropic.Anthropic(api_key=api_key)

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        t0 = time.monotonic()
        try:
            response = self._client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception as exc:  # noqa: BLE001 - normalise all SDK errors
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error=f"{type(exc).__name__}: {exc}",
            )
        latency_ms = int((time.monotonic() - t0) * 1000)
        text = ""
        content = getattr(response, "content", None)
        if content:
            text = getattr(content[0], "text", "") or ""
        usage = getattr(response, "usage", None)
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=getattr(usage, "input_tokens", 0) if usage else 0,
            output_tokens=getattr(usage, "output_tokens", 0) if usage else 0,
            latency_ms=latency_ms,
        )


class OpenAIClient(ExternalAIClient):
    name = "openai"

    def __init__(
        self,
        model: str = DEFAULT_OPENAI_MODEL,
        client: object = None,
        api_key: str | None = None,
    ):
        self.model = model
        if client is not None:
            self._client = client
            return
        if api_key is None:
            raise RuntimeError(
                "OpenAIClient requires explicit api_key or injected client. "
                "Use load_openai_key() — no env-var fallback."
            )
        try:
            import openai  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - exercised only with real SDK
            raise RuntimeError(
                "openai package not installed. `pip install openai`."
            ) from exc
        self._client = openai.OpenAI(api_key=api_key)

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        t0 = time.monotonic()
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
        except Exception as exc:  # noqa: BLE001 - normalise all SDK errors
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error=f"{type(exc).__name__}: {exc}",
            )
        latency_ms = int((time.monotonic() - t0) * 1000)
        text = ""
        choices = getattr(response, "choices", None)
        if choices:
            msg = getattr(choices[0], "message", None)
            text = getattr(msg, "content", "") if msg else ""
        usage = getattr(response, "usage", None)
        return CouncilResponse(
            provider=self.name, model=self.model, text=text or "",
            input_tokens=getattr(usage, "prompt_tokens", 0) if usage else 0,
            output_tokens=getattr(usage, "completion_tokens", 0) if usage else 0,
            latency_ms=latency_ms,
        )
