#!/usr/bin/env bash
# Install + upgrade, end to end, in a clean container: how long each takes, how
# much it prints, and whether it lands where it should.
#
# Two modes:
#   candidate (default) — this checkout, packed twice as X.Y.(Z+100) and
#       X.Y.(Z+101) and served by a throwaway registry inside the container, so
#       `upgrade` really moves 1 → 2 through `npm install -g …@latest`.
#   baseline — the published releases: a fresh `npx` install of BASELINE_TO and
#       an upgrade from BASELINE_FROM to whatever npm calls latest.
#
# Each mode runs both scenarios and prints one markdown row per scenario.
# Candidate mode also asserts the outcome and exits 1 on the first failure:
#   fresh   — exit 0, a version headline, a ready line, at most MAX_LINES lines,
#             content in ~/.claude/, nothing for a tool that was not asked for.
#   upgrade — exit 0, the new version on PATH and in the lockfile, only the
#             recorded tools redeployed, at most MAX_LINES lines.
#
# Env: TARBALL (skip `npm pack`), IMAGE (default node:22-bookworm),
#      BASELINE_FROM / BASELINE_TO, MAX_LINES (default 20), OUT_DIR (logs).
#
# Usage:
#   bash tests/docker/install_upgrade_bench.sh            # candidate
#   bash tests/docker/install_upgrade_bench.sh baseline
set -euo pipefail

MODE="${1:-candidate}"
IMAGE="${IMAGE:-node:22-bookworm}"
MAX_LINES="${MAX_LINES:-20}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${INSIDE_BENCH_CONTAINER:-}" != "1" ]]; then
    command -v docker >/dev/null || { echo "docker is required" >&2; exit 2; }
    WORK="$(mktemp -d)"
    trap 'rm -rf "$WORK"' EXIT
    # Outside $WORK: the logs are what a failure points at, so they outlive the run.
    OUT_DIR="${OUT_DIR:-$(mktemp -d)}"
    mkdir -p "$OUT_DIR" "$WORK/pkgs"
    if [[ "$MODE" == "candidate" ]]; then
        tarball="${TARBALL:-}"
        if [[ -z "$tarball" ]]; then
            (cd "$REPO_ROOT" && npm pack --silent --pack-destination "$WORK/pkgs" >/dev/null)
            tarball="$(ls "$WORK"/pkgs/*.tgz)"
        fi
        base="$(tar -xOzf "$tarball" package/package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).version))')"
        # Two versions of the same tree: the upgrade needs somewhere to go. Plain
        # patch numbers, not prerelease tags — the lockfile compares X.Y.Z only.
        IFS=. read -r major minor patch <<<"${base%%-*}"
        for n in 100 101; do
            dir="$WORK/v$n"
            mkdir -p "$dir"
            tar -xzf "$tarball" -C "$dir"
            node -e 'const f=process.argv[1];const p=JSON.parse(require("fs").readFileSync(f,"utf8"));p.version=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")' \
                "$dir/package/package.json" "$major.$minor.$((patch + n))"
            tar -czf "$WORK/pkgs/agent-config-$major.$minor.$((patch + n)).tgz" -C "$dir" package
            rm -rf "$dir"
        done
        [[ -n "${TARBALL:-}" ]] || rm -f "$tarball"
    fi
    echo "logs: $OUT_DIR" >&2
    docker run --rm \
        -e INSIDE_BENCH_CONTAINER=1 -e MAX_LINES="$MAX_LINES" \
        -e BASELINE_FROM="${BASELINE_FROM:-}" -e BASELINE_TO="${BASELINE_TO:-}" \
        -v "$REPO_ROOT/tests/docker/install_upgrade_bench.sh:/bench.sh:ro" \
        -v "$WORK/pkgs:/pkgs:ro" -v "$OUT_DIR:/out" \
        "$IMAGE" bash /bench.sh "$MODE"
    exit 0
fi

# --- inside the container ----------------------------------------------------

export npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
fails=0
fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }

now() { date +%s.%N; }
elapsed() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", b - a }'; }

if [[ "$MODE" == "candidate" ]]; then
    # A registry that knows one package, served from /pkgs; every other package
    # still comes from npmjs.
    cat >/registry.js <<'JS'
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const files = fs.readdirSync('/pkgs').filter((f) => f.endsWith('.tgz'));
const versions = {};
for (const f of files) {
    const v = /^agent-config-(.+)\.tgz$/.exec(f)[1];
    const buf = fs.readFileSync(path.join('/pkgs', f));
    const manifest = JSON.parse(require('child_process').execSync(`tar -xOzf /pkgs/${f} package/package.json`));
    versions[v] = { ...manifest, version: v, dist: { tarball: `http://127.0.0.1:4873/t/${f}`,
        integrity: 'sha512-' + crypto.createHash('sha512').update(buf).digest('base64'),
        shasum: crypto.createHash('sha1').update(buf).digest('hex') } };
}
const num = (v) => v.split('.').map(Number);
const latest = Object.keys(versions).sort((a, b) => { const x = num(a), y = num(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }).pop();
http.createServer((req, res) => {
    if (req.url.startsWith('/t/')) { res.end(fs.readFileSync(path.join('/pkgs', path.basename(req.url)))); return; }
    if (decodeURIComponent(req.url).replace(/^\//, '') === '@event4u/agent-config') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ name: '@event4u/agent-config', 'dist-tags': { latest }, versions }));
        return;
    }
    res.statusCode = 404; res.end('{}');
}).listen(4873, '127.0.0.1');
JS
    node /registry.js &
    for _ in $(seq 50); do curl -fs http://127.0.0.1:4873/@event4u%2fagent-config >/dev/null && break; sleep 0.1; done
    npm config set --location=global @event4u:registry http://127.0.0.1:4873/
    FROM="$(ls /pkgs | sed -n 's/^agent-config-\(.*\)\.tgz$/\1/p' | sort -V | head -1)"
    TO="$(ls /pkgs | sed -n 's/^agent-config-\(.*\)\.tgz$/\1/p' | sort -V | tail -1)"
else
    FROM="${BASELINE_FROM:-20.2.0}"
    TO="${BASELINE_TO:-$(npm view @event4u/agent-config version)}"
fi

row() { printf '| %s | %s | %s → %s | %s s | %s |\n' "$MODE" "$1" "$2" "$3" "$4" "$5"; }

# fresh: the documented first command, in a fresh home and an empty repo.
export HOME=/home/fresh && mkdir -p "$HOME/proj" && cd "$HOME/proj" && git init -q
t0="$(now)"
set +e
npx -y "@event4u/agent-config@$TO" init --tools=claude-code,cursor >/out/fresh.log 2>&1
rc=$?
set -e
t1="$(now)"
lines="$(grep -c . /out/fresh.log || true)"
row fresh '—' "$TO" "$(elapsed "$t0" "$t1")" "$lines lines, exit $rc"
if [[ "$MODE" == "candidate" ]]; then
    [[ $rc -eq 0 ]] || fail "fresh: exit $rc"
    grep -q "agent-config $TO" /out/fresh.log || fail "fresh: no version headline"
    grep -q "ready" /out/fresh.log || fail "fresh: no ready line"
    [[ $lines -le $MAX_LINES ]] || fail "fresh: $lines lines > $MAX_LINES"
    [[ -d "$HOME/.claude/rules" ]] || fail "fresh: nothing in ~/.claude/rules"
    [[ ! -e "$HOME/.kiro" ]] || fail "fresh: deployed to kiro, which was not asked for"
fi

# upgrade: an existing install of FROM with two tools, then `agent-config upgrade`.
export HOME=/home/upgrade && mkdir -p "$HOME/proj" && cd "$HOME/proj" && git init -q
npm install -g --silent "@event4u/agent-config@$FROM" >/out/upgrade-setup.log 2>&1
agent-config init --tools=claude-code,cursor --no-ui >>/out/upgrade-setup.log 2>&1
t0="$(now)"
set +e
agent-config upgrade >/out/upgrade.log 2>&1
rc=$?
set -e
t1="$(now)"
lines="$(grep -c . /out/upgrade.log || true)"
after="$(agent-config --version 2>/dev/null | tail -1)"
row upgrade "$FROM" "$TO" "$(elapsed "$t0" "$t1")" "$lines lines, exit $rc, now $after"
if [[ "$MODE" == "candidate" ]]; then
    [[ $rc -eq 0 ]] || fail "upgrade: exit $rc"
    [[ "$after" == *"$TO"* ]] || fail "upgrade: on PATH is '$after', want $TO"
    grep -Eq "^agent_config_version: *\"?$TO\"?\$" "$HOME/.event4u/agent-config/installed.lock" \
        || fail "upgrade: lockfile does not record $TO"
    [[ ! -e "$HOME/.kiro" ]] || fail "upgrade: deployed to kiro, which the install never recorded"
    [[ $lines -le $MAX_LINES ]] || fail "upgrade: $lines lines > $MAX_LINES"
fi

[[ $fails -eq 0 ]] || { echo "$fails assertion(s) failed — logs in /out" >&2; exit 1; }
