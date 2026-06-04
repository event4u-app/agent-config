"""Entrypoint — `python -m scripts.mcp_server`.

Required by Claude Desktop / Zed / Continue stdio-server config.
The wrapper forwards to `server.main()`; keep this file flat so
crash tracebacks point at server.py, not the bootstrap.
"""
from __future__ import annotations

from .server import main

if __name__ == "__main__":
    main()
