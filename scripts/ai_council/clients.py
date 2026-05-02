"""External-AI clients for the council.

Mirrors the contract from `scripts/skill_trigger_eval.py`:
- Tokens come exclusively from ~/.config/agent-config/<provider>.key.
- File mode must be exactly 0o600. Drift is a hard abort.
- No environment-variable fallback. No keychain fallback.
- Real SDKs (`anthropic`, `openai`) are *soft* dependencies — the
  module imports cleanly without them; only `ask()` requires them.

Tests inject mock clients via the `client=` constructor argument and
never hit the real API.

Mode contract (Phase 2b):
- `billable=True` clients (AnthropicClient, OpenAIClient) participate
  in the cost gate — projected USD spend is checked before each call.
- `billable=False` clients (ManualClient, future PlaywrightClient)
  skip the cost gate entirely. Spend = $0 to us; provider-side rate
  limits are the user's concern.
"""

from __future__ import annotations

import stat
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import TextIO

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
    billable: bool = True  # API-mode subclasses spend money; manual/playwright don't.

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
    billable = True

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
    billable = True

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


# ── Manual mode (Phase 2b) ───────────────────────────────────────────


MANUAL_END_MARKER = "END"  # line containing only this terminates a paste block.


def _read_until_marker(stream: TextIO, marker: str) -> str:
    """Read lines from `stream` until a line equal to `marker` (after strip).

    Returns the joined body without the marker line. EOF before the
    marker is treated as end-of-input — the body collected so far is
    returned; callers decide whether that counts as abort.
    """
    body: list[str] = []
    for raw in stream:
        line = raw.rstrip("\n")
        if line.strip() == marker:
            break
        body.append(line)
    return "\n".join(body).strip()


class ManualClient(ExternalAIClient):
    """Copy-paste council member — user is the transport.

    `ask()` renders the system prompt + artefact as one Markdown block,
    prints it to `stdout`, and reads pasted replies from `stdin`. After
    each pasted reply, surfaces a 1/2/3 menu (more · next · abort) per
    `user-interaction`. Loops until the user picks 2 or 3.

    Spend is $0 — `billable=False` makes the orchestrator skip the cost
    gate for this member regardless of the price table.

    Tests inject `stdin` / `stdout` `TextIO` streams. Production usage
    falls back to `sys.stdin` / `sys.stdout`.
    """

    billable = False

    def __init__(
        self,
        *,
        name: str = "manual",
        model: str = "manual",
        provider_label: str = "your LLM web UI",
        stdin: TextIO | None = None,
        stdout: TextIO | None = None,
        end_marker: str = MANUAL_END_MARKER,
    ):
        self.name = name
        self.model = model
        self.provider_label = provider_label
        self._stdin = stdin if stdin is not None else sys.stdin
        self._stdout = stdout if stdout is not None else sys.stdout
        self._end_marker = end_marker

    def ask(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1024,  # noqa: ARG002 — accepted for ABC parity
    ) -> CouncilResponse:
        t0 = time.monotonic()
        rounds: list[str] = []
        block = self._render_block(system_prompt, user_prompt, follow_up=None)
        self._emit(block)

        try:
            while True:
                reply = _read_until_marker(self._stdin, self._end_marker)
                rounds.append(reply)
                choice = self._ask_menu(reply_chars=len(reply))

                if choice == "2":  # done with this member
                    break
                if choice == "3":  # abort the council run
                    return CouncilResponse(
                        provider=self.name, model=self.model, text="",
                        latency_ms=int((time.monotonic() - t0) * 1000),
                        error="manual_aborted",
                        metadata={"rounds": len(rounds), "manual": True},
                    )
                # choice == "1": collect follow-up, re-emit context block.
                follow_up = self._read_follow_up()
                if not follow_up:
                    break  # empty follow-up → treat as "done with this member"
                rounds.append(f"[follow-up sent]\n{follow_up}")
                block = self._render_block(system_prompt, user_prompt, follow_up=follow_up)
                self._emit(block)
        except Exception as exc:  # noqa: BLE001 — never break the council on a stdin glitch
            return CouncilResponse(
                provider=self.name, model=self.model, text="\n\n".join(rounds),
                latency_ms=int((time.monotonic() - t0) * 1000),
                error=f"{type(exc).__name__}: {exc}",
                metadata={"rounds": len(rounds), "manual": True},
            )

        text = "\n\n---\n\n".join(rounds).strip()
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            latency_ms=int((time.monotonic() - t0) * 1000),
            metadata={"rounds": len(rounds), "manual": True},
        )

    # ── helpers ──────────────────────────────────────────────────────

    def _emit(self, text: str) -> None:
        self._stdout.write(text)
        self._stdout.write("\n")
        self._stdout.flush()

    def _render_block(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        follow_up: str | None,
    ) -> str:
        bar = "═" * 67
        head = (
            f"{bar}\n"
            f"Manual council member: {self.provider_label}\n"
            f"Paste this block into the web UI · then paste the reply below.\n"
            f"{bar}"
        )
        if follow_up is not None:
            body = (
                f"[Follow-up — paste this into the SAME chat thread]\n\n"
                f"{follow_up}"
            )
        else:
            body = f"{system_prompt}\n\n---\n\n{user_prompt}"
        tail = (
            f"{bar}\n"
            f"End your pasted reply with a line containing only: {self._end_marker}\n"
            f"{bar}"
        )
        return f"{head}\n\n{body}\n\n{tail}"

    def _ask_menu(self, *, reply_chars: int) -> str:
        prompt = (
            f"\nReply received ({reply_chars} chars). Now what?\n"
            f"  1. More feedback for this member (continue this thread)\n"
            f"  2. Done with this member, move to the next\n"
            f"  3. Abort the council run\n\n"
            f"Choose 1/2/3: "
        )
        self._stdout.write(prompt)
        self._stdout.flush()
        line = self._stdin.readline().strip()
        if line in {"1", "2", "3"}:
            return line
        # unknown input → treat as "next" so we never block forever in tests / piped runs.
        return "2"

    def _read_follow_up(self) -> str:
        self._emit(
            f"\nType your follow-up question, end with a line containing only: {self._end_marker}"
        )
        return _read_until_marker(self._stdin, self._end_marker)
