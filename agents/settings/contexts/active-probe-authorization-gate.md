# Active-Probe Authorization Gate — design note (latent)

**Status:** design note only — the suite ships **no** active/external
scanning surface today. This note becomes binding the moment any skill,
command, or script gains the ability to send probe traffic at a target the
agent does not own (port scan, fuzzing, exploit verification, external
endpoint probing). No code lands before that surface exists.

## The gate (specialization of `non-destructive-by-default`)

Any active-probe run requires a **two-step attestation** — both, always:

1. **Explicit in-chat confirmation on the same turn** — the user names the
   exact target (host/CIDR/URL) and the probe class; a standing autonomy
   directive or roadmap step never substitutes.
2. **An `--authorized` CLI flag** on the invocation itself.

**No environment-variable fallback.** CI variables are attacker-settable
(fork PRs, injected workflow env) — an env var like `PROBE_AUTHORIZED=1`
would let untrusted content authorize a probe, which is exactly the
confused-deputy shape `lethal-trifecta-guard` exists to break.

## Carve-outs

- **RFC1918 / loopback targets** (`10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`, `127.0.0.0/8`, `::1`) may skip step 1 (in-chat
  confirmation) when the target is the project's own local dev environment;
  the `--authorized` flag is still required.
- Reading public metadata without sending crafted traffic (a plain `GET` on
  a documented health endpoint) is not a probe; the gate does not fire.

## Rationale

Authorization for offensive-adjacent tooling must be unforgeable by
untrusted content. Chat confirmation binds it to the human; the flag binds
it to the invocation; the missing env-var path removes the one channel an
attacker can set remotely. Two independent factors, one of which cannot be
automated away.

## See also

- `src/rules/non-destructive-by-default.md` — the Hard Floor this specializes.
- `src/rules/lethal-trifecta-guard.md` — the egress/confused-deputy rationale.
- `src/skills/agent-security-review/SKILL.md` — CI-agent injection chain
  (why env vars are attacker-settable).
