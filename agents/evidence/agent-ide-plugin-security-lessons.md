# Security lessons for `agent-ide-plugin` (harvest backlog pointer)

> Roadmap `road-to-operator-runtime-harvest`, Phase plugin. The runtime/security
> work this suite **rejected for its own core** (no-runtime identity) is genuinely
> valuable in the sibling **`agent-ide-plugin`** repo, whose NDJSON-stdio sidecar
> has a runtime trust boundary. This is a **pointer for that repo's backlog**, not
> work in this suite. Source referenced source-anonymously per `source-confidentiality`.

Source A (an external operator-runtime / Claude-Code skill-pack reference) hardens
its headless-browser sidecar with a layered model. The transferable lessons, for
the plugin's sidecar to consider — most valuable first:

1. **Canary token + rolling-buffer detection.** Plant a secret canary in the
   system prompt; scan outbound/streamed content for it with a rolling buffer.
   A leak → **deterministic session BLOCK**. Cheap, high-signal session-exfil
   guard — stronger than a regex denylist (the plugin's current permission model
   per the last review).
2. **Port-separation over header-inference.** If the sidecar opens a local port,
   separate listeners by *port*, not by inferring trust from request headers
   (header inference is spoofable).
3. **Egress sanitization.** Strip lone surrogates / invalid Unicode before any
   outbound API call — one malformed page can otherwise kill a whole session via
   a provider 400.
4. **Content-security layering / datamarking.** Treat fetched/tool content as
   data, mark its boundaries, and keep it off the instruction path (the
   `untrusted-input-defense` / `lethal-trifecta-guard` discipline, applied at the
   sidecar's ingestion point).
5. **Daemon hardening (if a local daemon exists):** 0600 state file, Bearer-token
   auth, health-check liveness (not PID), no plaintext secrets at rest.

**Why not in this suite:** all of the above presuppose a runtime component (a
daemon / sidecar / live egress). This configuration suite has none — adopting
them here would breach the no-runtime identity (`domain-adoption-policy`). They
belong where there *is* a runtime trust boundary: the plugin.

**Action:** open a tracking issue in `agent-ide-plugin` from items 1–5; this file
is the durable hand-off record so the lesson is not lost.
