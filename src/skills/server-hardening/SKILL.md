---
model_tier: medium
name: server-hardening
description: "Use when hardening a Linux host you operate — SSH posture, a default-deny firewall baseline, and unattended security upgrades, each verified on the box rather than assumed from a config file."
domain: devops
workspaces:
  - engineering
packs:
  - engineering-base
---

# server-hardening

## When to use

Use when a host is yours to operate — a VPS, a bare-metal box, a long-lived VM —
and its own security posture is the question. Three surfaces: who may log in, what
may reach the network, and how patches arrive.

Do NOT use when:
- The workload runs on a managed runtime with no host you control — there is no
  host posture to set, and `operational-readiness` records that as `unavailable`
  with that reason
- Auditing application code for vulnerabilities (use `security-audit`)
- Application-level auth and authorization (use `security`, `authz-review`)
- Provisioning cloud infrastructure (use `terraform`, `aws-infrastructure`)
- Container image hardening (use `docker`)

## The three surfaces

### 1. SSH posture

The one remote-entry door. Harden in this order, and **keep an open session while
you change it** — a mistake here locks you out of the machine you are fixing.

| Setting | Target | Why |
|---|---|---|
| `PasswordAuthentication` | `no` | Ends credential-stuffing against the host outright |
| `PubkeyAuthentication` | `yes` | The replacement must work before passwords are removed |
| `PermitRootLogin` | `no` (or `prohibit-password`) | Forces an audit trail through a named account |
| `AllowUsers` / `AllowGroups` | Explicit allow-list | Default is every account on the box |
| Port | Non-default is optional | Cuts log noise, not risk — never the primary control |

Verify from a **second** connection before closing the first:

```bash
sudo sshd -t                                  # config parses; do this before reload
sudo systemctl reload ssh                     # or sshd, per distro
sudo sshd -T | grep -Ei 'passwordauth|permitrootlogin|pubkeyauth'
```

`sshd -T` prints the **effective** configuration. A file under
`sshd_config.d/` or a `Match` block can override what you just edited, so the
file you wrote is not evidence — the effective dump is.

### 2. Firewall baseline

Default-deny inbound, allow-list outbound where the workload permits.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH                        # before enabling, or you are locked out
sudo ufw enable
sudo ufw status verbose                       # the verification, not the intent
```

Two traps worth naming. A container runtime can write its own forwarding rules
that bypass the host firewall entirely — check the actual rule table
(`sudo iptables -S` / `sudo nft list ruleset`), not just the friendly front-end.
And a cloud security group sits *in front* of the host: both must agree, and the
narrower one is the effective policy.

Optionally add an SSH brute-force throttle (`fail2ban` or equivalent). It is
noise reduction and a small real gain once password auth is already off — never
a substitute for it.

### 3. Unattended security upgrades

Patches that require a human are patches that arrive late.

```bash
sudo apt install unattended-upgrades          # Debian/Ubuntu family
sudo dpkg-reconfigure -plow unattended-upgrades
sudo unattended-upgrade --dry-run --debug     # proves it would act
```

Decide and record two things, because the default is silence: whether the host
**reboots automatically** when a patch needs it, and where the **failure
notification** goes. An upgrade timer that has been failing for six weeks is
indistinguishable from one that is working, unless something reports it.

Security patches only. Automatic *feature* upgrades change behaviour under you,
which is a different risk with a different owner.

## Procedure: Harden a host

1. **Confirm the host is yours to harden.** Managed runtime with no shell → stop;
   there is no posture here, and that is a recordable `unavailable`.
2. **Open a second session and keep it open** for the whole SSH and firewall
   work. This is the entire rollback mechanism.
3. **Set the SSH posture**, then verify with `sshd -T` from the second session —
   effective config, not the file.
4. **Set the firewall baseline**, allowing SSH *before* enabling. Verify with
   `ufw status verbose` and against the raw rule table.
5. **Enable unattended security upgrades**, then prove with `--dry-run` that it
   would act. Record the reboot policy and the failure destination.
6. **Re-verify from a fresh connection.** Close every old session and reconnect.
   A posture that only holds inside an already-authenticated session is
   unverified.
7. **Report each surface as met, unmet or uninspected.** Uninspected is not met —
   `operational-readiness` reads an uninspected host posture as a red.

### Validate

- Verify `sshd -T` reports `passwordauthentication no`.
- Verify `sshd -T` reports `permitrootlogin no` or `prohibit-password`.
- Verify a key-based login succeeds from a **fresh** connection.
- Verify the firewall default is deny-inbound and SSH is explicitly allowed.
- Verify the raw rule table agrees with the front-end.
- Verify `unattended-upgrade --dry-run` reports it would act.
- Confirm the reboot policy and the failure-notification destination are recorded.

## Output format

1. One row per surface — SSH, firewall, unattended upgrades — with met / unmet /
   uninspected and the verifying command's output.
2. The reboot policy and where upgrade failures are reported.
3. Anything left unmet, with what would close it.

## Gotcha

- Changing SSH without a second open session is how a host becomes unreachable.
- The config file is not the posture. `sshd -T` is; a drop-in or `Match` block
  silently wins.
- Enabling a firewall before allowing SSH locks you out immediately.
- A container runtime's own rules can bypass the host firewall.
- A cloud security group and the host firewall must both allow a port; the
  narrower wins.
- A silently failing upgrade timer looks exactly like a working one.
- A non-default SSH port reduces log volume, not risk.

## Do NOT

- Do NOT disable password authentication before a key login is proven to work.
- Do NOT enable the firewall before allowing SSH.
- Do NOT enable automatic feature upgrades — security patches only.
- Do NOT treat an installed package as an enabled control; prove it acts.
- Do NOT report an uninspected surface as met.
- Do NOT rely on a non-default port as a control.

## Auto-trigger keywords

- server hardening
- host hardening
- ssh hardening
- firewall baseline
- unattended upgrades
- fail2ban
