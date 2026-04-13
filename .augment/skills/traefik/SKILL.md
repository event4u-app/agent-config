---
name: traefik
description: "Use when setting up Traefik as a local reverse proxy — real domains on 127.0.0.1, trusted HTTPS via mkcert, automatic service discovery, and multi-project routing."
---

# Traefik Skill

## When to use

Local reverse proxy: real domains, HTTPS (mkcert/ACME), multi-project routing, Grafana embedding.

## Overview: Browser → DNS (127.0.0.1) → Traefik (443) → Docker container (via labels).

## DNS: `/etc/hosts` (simple) or dnsmasq (wildcard, preferred: `address=/.local.example.dev/127.0.0.1`).

## Certs: self-signed (openssl), mkcert (easiest), ACME/Namecheap (lego DNS-01), ACME/Route53.

### Self-signed (openssl)

```bash
mkdir -p traefik/certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout traefik/certificates/_.${CERT_DOMAIN}.key \
  -out traefik/certificates/_.${CERT_DOMAIN}.crt \
  -subj "/CN=*.${CERT_DOMAIN}" \
  -addext "subjectAltName=DNS:*.${CERT_DOMAIN},DNS:${CERT_DOMAIN}"

# Trust on macOS
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain traefik/certificates/tls.crt
```

### mkcert (simplest for local dev)

```bash
brew install mkcert && mkcert -install
mkcert "local.example.dev" "*.local.example.dev"
```

### ACME via Lego container (real certs)

```yaml
# docker-compose.yml
lego:
  image: goacme/lego:latest
  profiles: [manual]   # Only run on demand
  volumes:
    - ./traefik/certificates:/etc/lego
```

```bash
# Namecheap DNS-01
docker compose run --rm \
  -e NAMECHEAP_API_USER -e NAMECHEAP_API_KEY \
  lego --dns namecheap \
  --domains "*.${CERT_DOMAIN}" --email "admin@${CERT_DOMAIN}" \
  --path /etc/lego run

# AWS Route53 DNS-01
docker compose run --rm \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_REGION \
  lego --dns route53 \
  --domains "*.${CERT_DOMAIN}" --email "admin@${CERT_DOMAIN}" \
  --path /etc/lego run
```

### Taskfile integration for cert management

```yaml
# certificates/generate.yml (included in main Taskfile)
tasks:
  selfsigned:
    desc: Generate self-signed certificate for ${CERT_DOMAIN}
    cmds: [...]

  namecheap:
    desc: Generate ACME certificate via Namecheap DNS-01
    cmds: [...]

  aws:
    desc: Generate ACME certificate via AWS Route53 DNS-01
    cmds: [...]
```

```yaml
# Main Taskfile
trust:
  desc: Add cert to macOS keychain
  cmds:
    - sudo security add-trusted-cert -d -r trustRoot \
        -k /Library/Keychains/System.keychain traefik/certificates/tls.crt

untrust:
  desc: Remove cert from macOS keychain
  cmds:
    - sudo security delete-certificate -c "*.${CERT_DOMAIN}" \
        /Library/Keychains/System.keychain

cert:setup:
  desc: Generate and trust self-signed certificate
  deps: [generate:selfsigned, trust]
```

## Traefik Container

```yaml
traefik:
  image: traefik:v3.2   # or v2.11 for older setups
  command:
    - --providers.docker=true
    - --providers.docker.exposedbydefault=false
    - --providers.file.directory=/etc/traefik/dynamic
    - --providers.file.watch=true
    - --entrypoints.web.address=:80
    - --entrypoints.websecure.address=:443
  ports:
    - "${TRAEFIK_HTTP_PORT:-80}:80"
    - "${TRAEFIK_HTTPS_PORT:-443}:443"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./traefik/dynamic:/etc/traefik/dynamic:ro
    - ./traefik/certificates:/certs:ro
```

### TLS dynamic config

```yaml
# traefik/dynamic/tls.yml
tls:
  certificates:
    - certFile: /certs/tls.crt
      keyFile: /certs/tls.key
```

## Service Labels

### Basic pattern (HTTP → HTTPS redirect + TLS)

```yaml
my-service:
  labels:
    - "traefik.enable=true"
    # HTTP router (redirect to HTTPS)
    - "traefik.http.routers.myapp.rule=Host(`${CERT_HOST}`)"
    - "traefik.http.routers.myapp.entrypoints=web"
    - "traefik.http.routers.myapp.middlewares=myapp-https-redirect"
    - "traefik.http.middlewares.myapp-https-redirect.redirectscheme.scheme=https"
    - "traefik.http.middlewares.myapp-https-redirect.redirectscheme.port=${TRAEFIK_HTTPS_PORT}"
    # HTTPS router
    - "traefik.http.routers.myapp-secure.rule=Host(`${CERT_HOST}`)"
    - "traefik.http.routers.myapp-secure.entrypoints=websecure"
    - "traefik.http.routers.myapp-secure.tls=true"
    - "traefik.http.services.myapp.loadbalancer.server.port=80"
```

### Subdomain routing

```yaml
grafana:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.grafana-secure.rule=Host(`grafana.${CERT_HOST}`)"
    - "traefik.http.routers.grafana-secure.entrypoints=websecure"
    - "traefik.http.routers.grafana-secure.tls=true"
    - "traefik.http.services.grafana.loadbalancer.server.port=3000"
```

### Path-based routing

```yaml
horizon:
  labels:
    - "traefik.http.routers.horizon-secure.rule=Host(`${CERT_HOST}`) && PathPrefix(`/horizon`)"
```

## Integration: with NGINX (Traefik→NGINX→PHP-FPM), standalone (Traefik→app), multi-project (shared `traefik-public` network).

## Middleware: rate limiting, basic auth, CORS — via Docker labels.

## Related: `docker`, `devcontainer`, `grafana`, `dashboard-design`

## Gotcha: missing label = no routing, mkcert needs `mkcert -install`, must add Traefik network to services.

## Do NOT: expose without auth, self-signed when mkcert available.
