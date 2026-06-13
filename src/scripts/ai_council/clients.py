"""External-AI clients for the council.

Mirrors the contract from `scripts/skill_trigger_eval.py`:
- Tokens come exclusively from ``~/.event4u/agent-config/<provider>.key``
  (legacy ``~/.config/agent-config/<provider>.key`` is read as a
  fallback so pre-2.4 installs keep working until the user moves the
  files into the new namespace).
- File mode must be exactly 0o600. Drift is a hard abort.
- No environment-variable fallback. No keychain fallback.
- Real SDKs (`anthropic`, `openai`) are *soft* dependencies — the
  module imports cleanly without them; only `ask()` requires them.

Tests inject mock clients via the `client=` constructor argument and
never hit the real API.

Mode contract:
- `billable=True` clients (AnthropicClient, OpenAIClient, GeminiClient,
  XAIClient, PerplexityClient) participate in the cost gate — projected
  USD spend is checked before each call.
- `billable=False` clients (ManualClient, vendor-official CliClient
  subclasses — AnthropicCliClient, OpenAICliClient, GeminiCliClient)
  skip the USD cost gate entirely. Spend = $0 to us; provider-side
  limits are the user's concern.
- `billable=True` CLI subclasses (XAICliClient, PerplexityCliClient)
  wrap community-maintained CLIs that consume the same API key as
  their `api` counterparts — they participate in the USD cost gate.
  `mode: cli` here is an ergonomic shortcut, not a billing change.

CLI subclasses additionally consult the optional
`cli_call_budget.max_calls_per_day.<provider>` quota with state
persisted at `~/.event4u/agent-config/cli-calls.json` (daily UTC reset).
"""

from __future__ import annotations

import json
import shutil
import stat
import subprocess
import sys
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TextIO

from scripts._lib import user_global_paths

ANTHROPIC_KEY_FILENAME = "anthropic.key"
OPENAI_KEY_FILENAME = "openai.key"

#: Canonical write target under the new namespace. Reads route via
#: :func:`_resolve_key_path` so a key still sitting in the legacy
#: ``~/.config/agent-config/`` tree keeps working.
ANTHROPIC_KEY_PATH = user_global_paths.write_target(ANTHROPIC_KEY_FILENAME)
OPENAI_KEY_PATH = user_global_paths.write_target(OPENAI_KEY_FILENAME)


def _resolve_key_path(filename: str) -> Path:
    """Return the active key path, preferring the new namespace."""
    found = user_global_paths.resolve_with_fallback(filename)
    if found is not None:
        return found
    return user_global_paths.write_target(filename)

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"
DEFAULT_OPENAI_MODEL = "gpt-4o"
DEFAULT_GEMINI_MODEL = "gemini-2.5-pro"
DEFAULT_XAI_MODEL = "grok-4"
DEFAULT_PERPLEXITY_MODEL = "sonar-pro"

#: OpenAI-API-compatible endpoints. xAI and Perplexity both expose the
#: ``/v1/chat/completions`` shape, so their clients reuse the ``openai``
#: SDK with a custom ``base_url``. Gemini has its own SDK (``google-genai``).
XAI_BASE_URL = "https://api.x.ai/v1"
PERPLEXITY_BASE_URL = "https://api.perplexity.ai"

#: Per-call output budget when no caller-supplied value reaches `ask()`.
#: The CLI resolves the live default from `ai_council.max_output_tokens`
#: in `.agent-settings.yml`; this constant is only the abstract-base /
#: direct-API fallback when nothing else is wired up.
DEFAULT_MAX_TOKENS = 2048

#: Expansion target when the user sets `max_output_tokens: 0` ("unlimited")
#: in settings. Anthropic requires `max_tokens` to be a positive integer,
#: so 0 is widened to this safe ceiling before the SDK call. Big enough
#: for current frontier models (Sonnet/GPT-4o headroom ≥ 16k); raise
#: explicitly in settings if a larger budget is genuinely needed.
UNLIMITED_TOKENS_FALLBACK = 16384

# OpenAI reasoning models (o1, o3, o4 families) reject `max_tokens` and the
# `system` role; they require `max_completion_tokens` and accept only `user`
# (and `developer`) messages.
_REASONING_PREFIXES = ("o1", "o3", "o4")


def _is_reasoning_model(model: str) -> bool:
    name = model.lower()
    return any(name == p or name.startswith(p + "-") for p in _REASONING_PREFIXES)


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


def load_anthropic_key(path: Path | None = None) -> str:
    resolved = path if path is not None else _resolve_key_path(ANTHROPIC_KEY_FILENAME)
    return _load_key(resolved, "sk-ant-", "src/scripts/install_anthropic_key.sh")


def load_openai_key(path: Path | None = None) -> str:
    resolved = path if path is not None else _resolve_key_path(OPENAI_KEY_FILENAME)
    return _load_key(resolved, "sk-", "src/scripts/install_openai_key.sh")


class ExternalAIClient(ABC):
    """Abstract base for council members."""

    name: str = ""
    model: str = ""
    billable: bool = True  # API-mode subclasses spend money; manual doesn't.
    transport: str = "api"  # "api" | "cli" | "manual" — surfaced in session manifest.
    subscription_label: str = ""  # vendor-CLI label (e.g. "claude") for non-billable transports.

    @abstractmethod
    def ask(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = DEFAULT_MAX_TOKENS,
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

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> CouncilResponse:
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

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> CouncilResponse:
        t0 = time.monotonic()
        kwargs: dict[str, object] = {"model": self.model}
        if _is_reasoning_model(self.model):
            # o1/o3/o4 reasoning models reject `max_tokens` and `system` role.
            kwargs["max_completion_tokens"] = max_tokens
            kwargs["messages"] = [
                {"role": "user", "content": f"{system_prompt}\n\n---\n\n{user_prompt}"},
            ]
        else:
            kwargs["max_tokens"] = max_tokens
            kwargs["messages"] = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        try:
            response = self._client.chat.completions.create(**kwargs)
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


# ── Gemini / xAI / Perplexity (Phase 0 — Step 6) ─────────────────────


class GeminiClient(ExternalAIClient):
    """Google Gemini via the ``google-genai`` SDK.

    Lazy-imports ``google.genai`` on first ``ask()`` so disabled
    members do not require the SDK to be installed. Tests inject a
    mock client shaped like ``genai.Client(api_key=...)`` —
    ``self._client.models.generate_content(...)`` returns an object
    with ``.text`` and ``.usage_metadata.{prompt_token_count,
    candidates_token_count}``.
    """

    name = "gemini"
    billable = True

    def __init__(
        self,
        model: str = DEFAULT_GEMINI_MODEL,
        client: object = None,
        api_key: str | None = None,
    ):
        self.model = model
        if client is not None:
            self._client = client
            return
        if api_key is None:
            raise RuntimeError(
                "GeminiClient requires explicit api_key or injected client. "
                "Use `api_key_ref: env:GEMINI_API_KEY` in ~/.event4u/agent-config/.ai-council.yml."
            )
        try:
            from google import genai  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - exercised only with real SDK
            raise RuntimeError(
                "google-genai package not installed. `pip install google-genai`."
            ) from exc
        self._client = genai.Client(api_key=api_key)

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> CouncilResponse:
        t0 = time.monotonic()
        contents = f"{system_prompt}\n\n---\n\n{user_prompt}"
        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=contents,
                config={"max_output_tokens": max_tokens},
            )
        except Exception as exc:  # noqa: BLE001 - normalise all SDK errors
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error=f"{type(exc).__name__}: {exc}",
            )
        latency_ms = int((time.monotonic() - t0) * 1000)
        text = getattr(response, "text", "") or ""
        usage = getattr(response, "usage_metadata", None)
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=getattr(usage, "prompt_token_count", 0) if usage else 0,
            output_tokens=getattr(usage, "candidates_token_count", 0) if usage else 0,
            latency_ms=latency_ms,
        )


class _OpenAICompatibleClient(ExternalAIClient):
    """Shared shape for OpenAI-API-compatible providers (xAI, Perplexity).

    Both vendors implement ``/v1/chat/completions`` and accept the
    ``openai`` Python SDK with a custom ``base_url``. The reasoning-
    model branch from :class:`OpenAIClient` is intentionally omitted —
    neither xAI nor Perplexity ships a reasoning model that requires
    ``max_completion_tokens`` as of 2026-05-14.
    """

    billable = True
    base_url: str = ""

    def __init__(
        self,
        model: str,
        client: object = None,
        api_key: str | None = None,
    ):
        self.model = model
        if client is not None:
            self._client = client
            return
        if api_key is None:
            raise RuntimeError(
                f"{type(self).__name__} requires explicit api_key or injected client."
            )
        try:
            import openai  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - exercised only with real SDK
            raise RuntimeError(
                "openai package not installed. `pip install openai`."
            ) from exc
        self._client = openai.OpenAI(api_key=api_key, base_url=self.base_url)

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = DEFAULT_MAX_TOKENS) -> CouncilResponse:
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


class XAIClient(_OpenAICompatibleClient):
    """xAI Grok via the OpenAI-compatible endpoint at api.x.ai/v1."""

    name = "xai"
    base_url = XAI_BASE_URL

    def __init__(
        self,
        model: str = DEFAULT_XAI_MODEL,
        client: object = None,
        api_key: str | None = None,
    ):
        super().__init__(model=model, client=client, api_key=api_key)


class PerplexityClient(_OpenAICompatibleClient):
    """Perplexity via the OpenAI-compatible endpoint at api.perplexity.ai."""

    name = "perplexity"
    base_url = PERPLEXITY_BASE_URL

    def __init__(
        self,
        model: str = DEFAULT_PERPLEXITY_MODEL,
        client: object = None,
        api_key: str | None = None,
    ):
        super().__init__(model=model, client=client, api_key=api_key)


# ── CLI transport (step-1 Phase 1+) ──────────────────────────────────


CLI_CALLS_FILENAME = "cli-calls.json"

#: Default subprocess timeout for a single CLI call. Long enough for the
#: largest frontier models to think; short enough to surface a hung
#: subprocess without freezing the council run.
DEFAULT_CLI_TIMEOUT_SECONDS = 120.0


class CliClientError(RuntimeError):
    """Raised when a CLI member cannot be constructed (binary missing, etc.)."""


def _cli_calls_state_path() -> Path:
    """Return the canonical write target for the daily-quota counter."""
    return user_global_paths.write_target(CLI_CALLS_FILENAME)


def _today_utc_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def load_cli_call_counts(path: Path | None = None) -> dict[str, int]:
    """Return today's per-provider call counts. Empty dict on UTC rollover."""
    p = path if path is not None else _cli_calls_state_path()
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(data, dict) or data.get("date") != _today_utc_iso():
        return {}
    counts = data.get("counts", {})
    if not isinstance(counts, dict):
        return {}
    return {str(k): int(v) for k, v in counts.items() if isinstance(v, (int, str))}


def record_cli_call(provider: str, path: Path | None = None) -> int:
    """Increment today's call count for `provider`. Returns new total."""
    p = path if path is not None else _cli_calls_state_path()
    counts = load_cli_call_counts(p)
    counts[provider] = counts.get(provider, 0) + 1
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        json.dumps({"date": _today_utc_iso(), "counts": counts}, indent=2),
        encoding="utf-8",
    )
    return counts[provider]


def reset_cli_call_counts(
    provider: str | None = None,
    path: Path | None = None,
) -> dict[str, int]:
    """Reset the per-provider call counter (step-8 P1, `council quota --reset`).

    ``provider=None`` clears all providers (today's record). Otherwise
    only the named provider's count is removed; other providers and
    the UTC date marker are preserved. Returns the post-reset counts.
    """
    p = path if path is not None else _cli_calls_state_path()
    counts = load_cli_call_counts(p)
    if provider is None:
        counts = {}
    else:
        counts.pop(provider, None)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(
        json.dumps({"date": _today_utc_iso(), "counts": counts}, indent=2),
        encoding="utf-8",
    )
    return counts


def quota_summary_line(
    clients: "list[CliClient]",
    *,
    cli_calls_path: Path | None = None,
) -> tuple[str, list[str]]:
    """Build the pre-run quota summary line (step-8 P1, D1 + D4).

    Returns ``(summary, warn_providers)`` where ``summary`` is the
    formatted one-liner (empty string when no CLI member has a
    configured cap) and ``warn_providers`` is the subset whose
    ``used / max_calls_per_day`` ratio crossed ``warn_at``. Uncapped
    providers (``max_calls_per_day is None``) are omitted from the
    summary entirely — they cannot exceed a threshold that does not
    exist.

    Tested in ``tests/test_cli_quota_warn.py``.
    """
    capped = [c for c in clients if getattr(c, "max_calls_per_day", None)]
    if not capped:
        return "", []
    # Read state once for the whole summary — call counts only mutate
    # inside ``CliClient.ask`` (sequential per-member dispatch), so the
    # pre-run snapshot is always consistent with what's about to fire.
    counts = load_cli_call_counts(cli_calls_path)
    parts: list[str] = []
    warn: list[str] = []
    for c in capped:
        name = getattr(c, "name", "?")
        used = int(counts.get(name, 0))
        limit = int(c.max_calls_per_day)
        parts.append(f"{name} {used}/{limit}")
        ratio = used / limit if limit > 0 else 0.0
        warn_at = float(getattr(c, "warn_at", 0.8))
        if ratio >= warn_at:
            warn.append(name)
    prefix = "⚠️  " if warn else ""
    return f"{prefix}council:quota · " + " · ".join(parts), warn


class CliClient(ExternalAIClient):
    """Shell-out council member — subscription-authed transport.

    Spawns a locally-installed provider CLI via ``subprocess.run``. Auth
    is delegated to the binary itself (Claude CLI, Codex CLI, Gemini
    CLI, etc. use the user's logged-in subscription session). Spend is
    $0 from this loader's perspective — ``billable=False`` keeps the
    USD cost gate from firing.

    Provider subscription quotas (Claude Pro 5h windows, ChatGPT Plus
    message caps, Gemini free-tier limits) are guarded by the optional
    ``cli_call_budget.max_calls_per_day.<provider>`` config. Counter
    state lives at ``~/.event4u/agent-config/cli-calls.json`` and
    resets on UTC date rollover.

    Subclass contract:

    - ``name``: provider key (`anthropic`, `openai`, `gemini`, …).
    - ``default_binary``: executable name resolved via ``shutil.which``
      when the member-level ``binary:`` field is not set.
    - ``_build_command(system_prompt, user_prompt, max_tokens)``:
      return the argv list to execute.
    - ``_parse_output(stdout, stderr)``: return a partial
      ``CouncilResponse`` (``provider``, ``model``, ``text``,
      ``input_tokens``, ``output_tokens``, ``metadata``). The base
      ``ask()`` fills in ``latency_ms``.

    Construction validates the binary up front — a missing CLI fails
    fast with ``CliClientError`` so the loader can surface a structured
    "skip member with reason" entry rather than crashing the run.

    Stderr heuristics map known failure shapes to short error codes:

    - ``auth_expired`` — authentication / login / unauthorized.
    - ``timeout`` — subprocess timeout or deadline exceeded.
    - ``cli_quota_exhausted`` — rate-limit / quota messaging from the
      provider, OR the local counter has hit ``max_calls_per_day``.
    - ``parse_failed`` — non-zero exit absent + stdout was not parseable.
    - ``exit_<N>`` — fallback for any non-zero exit code without a known
      stderr pattern.
    """

    billable = False
    transport = "cli"
    default_binary: str = ""

    _AUTH_FAILURE_PATTERNS = (
        "authentication", "unauthorized", "auth failed", "auth_error",
        "login", "not logged in", "session expired", "invalid credentials",
    )
    _TIMEOUT_PATTERNS = ("timeout", "timed out", "deadline exceeded")
    _QUOTA_PATTERNS = (
        "rate limit", "rate_limit", "rate-limit", "quota exceeded",
        "too many requests", "429", "usage limit",
    )

    def __init__(
        self,
        *,
        model: str,
        binary: str | None = None,
        timeout_seconds: float = DEFAULT_CLI_TIMEOUT_SECONDS,
        max_calls_per_day: int | None = None,
        warn_at: float = 0.8,
        cli_calls_path: Path | None = None,
    ):
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.max_calls_per_day = max_calls_per_day
        self.warn_at = warn_at
        self._cli_calls_path = cli_calls_path
        if binary is not None:
            self.binary = binary
        else:
            if not self.default_binary:
                raise CliClientError(
                    f"{type(self).__name__}: no `default_binary` set on subclass; "
                    f"either fix the class or pass `binary=` explicitly."
                )
            resolved = shutil.which(self.default_binary)
            if resolved is None:
                raise CliClientError(
                    f"{type(self).__name__}: binary {self.default_binary!r} "
                    f"not found on PATH. Install the provider CLI or set "
                    f"`members.{self.name}.binary:` in ~/.event4u/agent-config/.ai-council.yml."
                )
            self.binary = resolved

    # ── subclass hooks ────────────────────────────────────────────

    @abstractmethod
    def _build_command(
        self, system_prompt: str, user_prompt: str, max_tokens: int
    ) -> list[str]:
        """Return the argv list the subprocess should execute.

        ``self.binary`` is already resolved to an absolute path. Subclasses
        return ``[self.binary, ...flags...]`` and pass the prompt either
        via argv (small) or via stdin (large) — see ``_stdin_payload``.
        """

    @abstractmethod
    def _parse_output(
        self, stdout: str, stderr: str
    ) -> CouncilResponse:
        """Parse provider-specific stdout into a CouncilResponse.

        ``latency_ms`` and ``error`` are set by the base ``ask()`` wrapper;
        subclasses populate ``provider``, ``model``, ``text``,
        ``input_tokens``, ``output_tokens``, and any ``metadata``.
        """

    def _stdin_payload(self, system_prompt: str, user_prompt: str) -> str | None:
        """Return text to send on stdin, or ``None`` to inherit caller's stdin.

        Default: ``None`` — subclasses that prefer stdin-piped prompts
        override (typical for long prompts that would blow argv limits).
        """
        return None

    # ── ask() ──────────────────────────────────────────────────────

    def ask(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> CouncilResponse:
        t0 = time.monotonic()

        # 1. quota gate — local counter check before spawning anything.
        if self.max_calls_per_day is not None:
            counts = load_cli_call_counts(self._cli_calls_path)
            used = counts.get(self.name, 0)
            if used >= self.max_calls_per_day:
                # step-8 D3 — record the block on the persistent events
                # log. Lazy import to keep clients.py independent of the
                # CLI layer at module load time.
                try:
                    from scripts.ai_council.events_log import append_event
                    append_event({
                        "lens": "",
                        "invocation": "",
                        "action": "block_quota",
                        "verdict": "",
                        "provider_caps": {
                            self.name: {
                                "mode": "cli", "model": self.model,
                            },
                        },
                        "original_ask": user_prompt,
                        "cli_calls_used": used,
                        "cli_calls_max": self.max_calls_per_day,
                    })
                except Exception:  # pragma: no cover — never crash ask()
                    pass
                return CouncilResponse(
                    provider=self.name, model=self.model, text="",
                    latency_ms=int((time.monotonic() - t0) * 1000),
                    error="cli_quota_exhausted",
                    metadata={
                        "cli": True,
                        "cli_calls_used": used,
                        "cli_calls_max": self.max_calls_per_day,
                    },
                )

        # 2. build command + spawn.
        cmd = self._build_command(system_prompt, user_prompt, max_tokens)
        stdin_payload = self._stdin_payload(system_prompt, user_prompt)
        try:
            proc = subprocess.run(
                cmd,
                input=stdin_payload,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error="timeout",
                metadata={"cli": True, "timeout_seconds": self.timeout_seconds},
            )
        except FileNotFoundError:
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error="binary_missing",
                metadata={"cli": True, "binary": self.binary},
            )
        except OSError as exc:
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=int((time.monotonic() - t0) * 1000),
                error=f"os_error: {type(exc).__name__}",
                metadata={"cli": True},
            )

        # 3. record the call — even failures count against the quota so
        #    a broken CLI cannot burn the whole budget in a tight loop.
        try:
            record_cli_call(self.name, self._cli_calls_path)
        except OSError:  # state-file write failure is non-fatal here.
            pass

        latency_ms = int((time.monotonic() - t0) * 1000)

        # 4. non-zero exit → classify and bail.
        if proc.returncode != 0:
            code = self._classify_stderr(proc.stderr or "", proc.returncode)
            return CouncilResponse(
                provider=self.name, model=self.model, text="",
                latency_ms=latency_ms,
                error=code,
                metadata={
                    "cli": True,
                    "returncode": proc.returncode,
                    "stderr_tail": (proc.stderr or "")[-500:],
                },
            )

        # 5. parse stdout via the subclass hook.
        try:
            response = self._parse_output(proc.stdout or "", proc.stderr or "")
        except Exception as exc:  # noqa: BLE001 — defensive: parse must never crash the run.
            return CouncilResponse(
                provider=self.name, model=self.model,
                text=proc.stdout or "",
                latency_ms=latency_ms,
                error=f"parse_failed: {type(exc).__name__}",
                metadata={"cli": True, "stderr_tail": (proc.stderr or "")[-500:]},
            )
        response.latency_ms = latency_ms
        meta = dict(response.metadata)
        meta.setdefault("cli", True)
        response.metadata = meta
        return response

    @classmethod
    def _classify_stderr(cls, stderr: str, returncode: int) -> str:
        haystack = stderr.lower()
        if any(p in haystack for p in cls._AUTH_FAILURE_PATTERNS):
            return "auth_expired"
        if any(p in haystack for p in cls._TIMEOUT_PATTERNS):
            return "timeout"
        if any(p in haystack for p in cls._QUOTA_PATTERNS):
            return "cli_quota_exhausted"
        return f"exit_{returncode}"


class AnthropicCliClient(CliClient):
    """Claude via the official `claude` CLI (subscription-authed).

    Invokes ``claude --print --output-format json`` and consumes the
    structured envelope: ``{"result": str, "usage": {"input_tokens":
    int, "output_tokens": int}, "session_id": str, ...}``. The prompt
    is piped on stdin so it never collides with argv length limits.

    Auth is delegated to the CLI's own session — the user runs
    ``claude /login`` once and the orchestrator inherits the
    subscription. No API key flows through this process.
    """

    name = "anthropic"
    default_binary = "claude"
    subscription_label = "claude-pro"

    def __init__(
        self,
        *,
        model: str = "claude-sonnet-4-5",
        binary: str | None = None,
        timeout_seconds: float = DEFAULT_CLI_TIMEOUT_SECONDS,
        max_calls_per_day: int | None = None,
        warn_at: float = 0.8,
        cli_calls_path: Path | None = None,
    ):
        super().__init__(
            model=model,
            binary=binary,
            timeout_seconds=timeout_seconds,
            max_calls_per_day=max_calls_per_day,
            warn_at=warn_at,
            cli_calls_path=cli_calls_path,
        )

    def _build_command(
        self, system_prompt: str, user_prompt: str, max_tokens: int  # noqa: ARG002
    ) -> list[str]:
        return [
            self.binary,
            "--print",
            "--output-format", "json",
            "--model", self.model,
            "--append-system-prompt", system_prompt,
        ]

    def _stdin_payload(self, system_prompt: str, user_prompt: str) -> str | None:  # noqa: ARG002
        return user_prompt

    def _parse_output(self, stdout: str, stderr: str) -> CouncilResponse:  # noqa: ARG002
        envelope = json.loads(stdout)
        if not isinstance(envelope, dict):
            raise ValueError("expected JSON object at the top level of claude CLI output")
        text = str(envelope.get("result", "")).strip()
        usage = envelope.get("usage") or {}
        if not isinstance(usage, dict):
            usage = {}
        meta: dict[str, object] = {}
        session_id = envelope.get("session_id")
        if session_id:
            meta["session_id"] = str(session_id)
        total_cost = envelope.get("total_cost_usd")
        if total_cost is not None:
            meta["reported_cost_usd"] = total_cost
        duration_ms = envelope.get("duration_ms")
        if duration_ms is not None:
            meta["reported_duration_ms"] = duration_ms
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=int(usage.get("input_tokens", 0) or 0),
            output_tokens=int(usage.get("output_tokens", 0) or 0),
            metadata=meta,
        )


class OpenAICliClient(CliClient):
    """OpenAI via the official `codex` CLI (subscription-authed).

    Invokes ``codex exec --json <prompt>`` and consumes the
    newline-delimited JSON event stream. The user prompt rides on
    argv (Codex does not read prompts from stdin in ``exec`` mode);
    the system prompt is passed via ``--system`` when non-empty.

    Auth is delegated to the CLI's own session — the user runs
    ``codex login`` once and the orchestrator inherits the
    subscription. No API key flows through this process.

    Output shape: one JSON object per line. The terminal event has
    ``type == "item.completed"`` with the final assistant message in
    ``item.content[0].text``; a separate ``type == "turn.completed"``
    event carries token usage in ``usage.input_tokens`` /
    ``usage.output_tokens``. Robust against the order of events and
    against unknown event types (silently skipped).
    """

    name = "openai"
    default_binary = "codex"
    subscription_label = "chatgpt-plus"

    _AUTH_FAILURE_PATTERNS = CliClient._AUTH_FAILURE_PATTERNS + (
        "codex login", "auth_required", "401",
    )

    def __init__(
        self,
        *,
        model: str = "gpt-5",
        binary: str | None = None,
        timeout_seconds: float = DEFAULT_CLI_TIMEOUT_SECONDS,
        max_calls_per_day: int | None = None,
        warn_at: float = 0.8,
        cli_calls_path: Path | None = None,
    ):
        super().__init__(
            model=model,
            binary=binary,
            timeout_seconds=timeout_seconds,
            max_calls_per_day=max_calls_per_day,
            warn_at=warn_at,
            cli_calls_path=cli_calls_path,
        )

    def _build_command(
        self, system_prompt: str, user_prompt: str, max_tokens: int  # noqa: ARG002
    ) -> list[str]:
        cmd = [self.binary, "exec", "--json", "--model", self.model]
        if system_prompt:
            cmd.extend(["--system", system_prompt])
        cmd.append(user_prompt)
        return cmd

    def _parse_output(self, stdout: str, stderr: str) -> CouncilResponse:  # noqa: ARG002
        text = ""
        input_tokens = 0
        output_tokens = 0
        meta: dict[str, object] = {}
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(event, dict):
                continue
            event_type = event.get("type")
            if event_type == "item.completed":
                item = event.get("item") or {}
                if isinstance(item, dict):
                    content = item.get("content") or []
                    if isinstance(content, list):
                        chunks: list[str] = []
                        for entry in content:
                            if isinstance(entry, dict) and entry.get("text"):
                                chunks.append(str(entry["text"]))
                        if chunks:
                            text = "\n".join(chunks).strip()
                    if item.get("id"):
                        meta["item_id"] = str(item["id"])
            elif event_type == "turn.completed":
                usage = event.get("usage") or {}
                if isinstance(usage, dict):
                    input_tokens = int(usage.get("input_tokens", 0) or 0)
                    output_tokens = int(usage.get("output_tokens", 0) or 0)
            elif event_type == "session.created":
                if event.get("session_id"):
                    meta["session_id"] = str(event["session_id"])
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=input_tokens, output_tokens=output_tokens,
            metadata=meta,
        )


class GeminiCliClient(CliClient):
    """Google Gemini via the official `gemini` CLI (free-tier subscription).

    Invokes ``gemini --prompt <prompt> --output-format json`` and
    consumes the structured envelope: ``{"response": str, "stats":
    {"models": {"<model>": {"tokens": {"prompt": int, "candidates":
    int}}}}, ...}``. Prompt is piped on stdin to dodge argv limits.

    Auth is delegated to the CLI's own session — the user runs
    ``gemini`` once interactively to set up OAuth, then the
    orchestrator inherits the consent. Free-tier quotas apply at the
    Google account level; ``cli_call_budget`` enforces a local mirror.
    """

    name = "gemini"
    default_binary = "gemini"
    subscription_label = "gemini-pro"

    _AUTH_FAILURE_PATTERNS = CliClient._AUTH_FAILURE_PATTERNS + (
        "interactive consent could not be obtained",
        "please run `gemini`",
        "oauth",
    )

    def __init__(
        self,
        *,
        model: str = "gemini-2.5-pro",
        binary: str | None = None,
        timeout_seconds: float = DEFAULT_CLI_TIMEOUT_SECONDS,
        max_calls_per_day: int | None = None,
        warn_at: float = 0.8,
        cli_calls_path: Path | None = None,
    ):
        super().__init__(
            model=model,
            binary=binary,
            timeout_seconds=timeout_seconds,
            max_calls_per_day=max_calls_per_day,
            warn_at=warn_at,
            cli_calls_path=cli_calls_path,
        )

    def _build_command(
        self, system_prompt: str, user_prompt: str, max_tokens: int  # noqa: ARG002
    ) -> list[str]:
        cmd = [
            self.binary,
            "--output-format", "json",
            "--model", self.model,
        ]
        if system_prompt:
            cmd.extend(["--system", system_prompt])
        return cmd

    def _stdin_payload(self, system_prompt: str, user_prompt: str) -> str | None:  # noqa: ARG002
        return user_prompt

    def _parse_output(self, stdout: str, stderr: str) -> CouncilResponse:  # noqa: ARG002
        envelope = json.loads(stdout)
        if not isinstance(envelope, dict):
            raise ValueError("expected JSON object at the top level of gemini CLI output")
        text = str(envelope.get("response", "")).strip()
        input_tokens = 0
        output_tokens = 0
        stats = envelope.get("stats") or {}
        if isinstance(stats, dict):
            models = stats.get("models") or {}
            if isinstance(models, dict):
                # gemini emits per-model token counts; pick the configured model
                # if present, else sum across all models in the envelope.
                model_stats = models.get(self.model)
                if not isinstance(model_stats, dict):
                    model_stats = next(
                        (v for v in models.values() if isinstance(v, dict)),
                        {},
                    )
                tokens = (model_stats.get("tokens") or {}) if isinstance(model_stats, dict) else {}
                if isinstance(tokens, dict):
                    input_tokens = int(tokens.get("prompt", 0) or 0)
                    output_tokens = int(tokens.get("candidates", 0) or 0)
        meta: dict[str, object] = {}
        session_id = envelope.get("sessionId") or envelope.get("session_id")
        if session_id:
            meta["session_id"] = str(session_id)
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=input_tokens, output_tokens=output_tokens,
            metadata=meta,
        )


class XAICliClient(CliClient):
    """xAI Grok via the community `grok` CLI (Superagent project).

    Community-maintained wrapper around the xAI API — **not** an
    official subscription transport. The CLI consumes ``XAI_API_KEY``
    from its own environment, so every call is paid per-token exactly
    as ``XAIClient`` (api transport) would be. ``mode: cli`` here is
    an ergonomic shortcut for users who already drive Grok from the
    shell; it does NOT bypass the USD cost gate.

    Invokes ``grok -p <prompt>``. Output is plain text — no JSON
    envelope. ``_parse_output`` returns the trimmed stdout and
    estimates token counts heuristically (chars / 4) for the
    audit-trail; estimates feed the post-call spend tracker, not the
    pre-call gate (the orchestrator's ``estimate()`` already projects
    cost from the prompt before this client is invoked).
    """

    name = "xai"
    default_binary = "grok"
    billable = True  # community CLI consumes an API key — billable applies

    _AUTH_FAILURE_PATTERNS = CliClient._AUTH_FAILURE_PATTERNS + (
        "xai_api_key", "401", "unauthorized",
    )

    def __init__(
        self,
        *,
        model: str = DEFAULT_XAI_MODEL,
        binary: str | None = None,
        timeout_seconds: float = DEFAULT_CLI_TIMEOUT_SECONDS,
        max_calls_per_day: int | None = None,
        warn_at: float = 0.8,
        cli_calls_path: Path | None = None,
    ):
        super().__init__(
            model=model,
            binary=binary,
            timeout_seconds=timeout_seconds,
            max_calls_per_day=max_calls_per_day,
            warn_at=warn_at,
            cli_calls_path=cli_calls_path,
        )

    def _build_command(
        self, system_prompt: str, user_prompt: str, max_tokens: int  # noqa: ARG002
    ) -> list[str]:
        cmd = [self.binary, "-p", user_prompt]
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd

    def _parse_output(self, stdout: str, stderr: str) -> CouncilResponse:  # noqa: ARG002
        text = stdout.strip()
        # Plain-text CLIs surface no token usage — estimate from text
        # length so the audit trail and post-call tracker stay populated.
        # chars / 4 mirrors `pricing.estimate_input_tokens`.
        output_tokens = max(1, len(text) // 4) if text else 0
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=0, output_tokens=output_tokens,
            metadata={"cli_output_format": "plain_text", "tokens_estimated": True},
        )


class PerplexityCliClient(CliClient):
    """Perplexity via the community `perplexity` CLI (npm package).

    Community-maintained wrapper around the Perplexity API — **not**
    an official subscription transport. The CLI consumes
    ``PERPLEXITY_API_KEY`` from its own environment, so every call is
    paid per-token exactly as ``PerplexityClient`` (api transport)
    would be. ``mode: cli`` here is an ergonomic shortcut; it does
    NOT bypass the USD cost gate.

    Invokes ``perplexity -p <prompt>``. Output is plain text — no
    JSON envelope. Token counts are estimated heuristically for the
    audit trail; the pre-call cost gate uses the orchestrator's
    prompt-side estimate.
    """

    name = "perplexity"
    default_binary = "perplexity"
    billable = True  # community CLI consumes an API key — billable applies

    _AUTH_FAILURE_PATTERNS = CliClient._AUTH_FAILURE_PATTERNS + (
        "perplexity_api_key", "401", "unauthorized",
    )

    def __init__(
        self,
        *,
        model: str = DEFAULT_PERPLEXITY_MODEL,
        binary: str | None = None,
        timeout_seconds: float = DEFAULT_CLI_TIMEOUT_SECONDS,
        max_calls_per_day: int | None = None,
        warn_at: float = 0.8,
        cli_calls_path: Path | None = None,
    ):
        super().__init__(
            model=model,
            binary=binary,
            timeout_seconds=timeout_seconds,
            max_calls_per_day=max_calls_per_day,
            warn_at=warn_at,
            cli_calls_path=cli_calls_path,
        )

    def _build_command(
        self, system_prompt: str, user_prompt: str, max_tokens: int  # noqa: ARG002
    ) -> list[str]:
        cmd = [self.binary, "-p", user_prompt]
        if self.model:
            cmd.extend(["--model", self.model])
        return cmd

    def _parse_output(self, stdout: str, stderr: str) -> CouncilResponse:  # noqa: ARG002
        text = stdout.strip()
        output_tokens = max(1, len(text) // 4) if text else 0
        return CouncilResponse(
            provider=self.name, model=self.model, text=text,
            input_tokens=0, output_tokens=output_tokens,
            metadata={"cli_output_format": "plain_text", "tokens_estimated": True},
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
    transport = "manual"

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
        max_tokens: int = DEFAULT_MAX_TOKENS,  # noqa: ARG002 — accepted for ABC parity
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
