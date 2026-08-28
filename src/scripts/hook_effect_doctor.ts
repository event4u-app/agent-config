#!/usr/bin/env tsx
/**
 * `hook-effect doctor` — is any of this configuration taking EFFECT on this host?
 * (`road-to-delivered-cost-truth` Phase 3.)
 *
 * THREE DOCTORS, AND THE DISTINCTION IS THE POINT. This is the third, and it
 * exists because the first two answer different questions:
 *
 *   `doctorShell`          the ENVIRONMENT — Node version, package-root
 *                          resolution, whether the Bash dispatcher exists. It
 *                          says so in its own scope note.
 *   `hooks_doctor`         the MANIFEST — which concerns are declared, their
 *                          fail-closed posture, whether their scripts and
 *                          per-platform trampolines exist on disk, and the last
 *                          recorded dispatcher feedback. Read-only over
 *                          declarations and artefacts.
 *   `hook_effect_doctor`   whether a bound concern actually FIRES here, and
 *                          whether its output survives.
 *
 * The second is exactly option (b) of the `how-far-the-effect-probe-may-reach`
 * blocker — a static probe of the manifest plus the host registry — which both
 * council seats rejected as insufficient because it "cannot distinguish `bound`
 * from `effective`, which is the entire question". This module is option (c),
 * and it deliberately does not touch `hooks_doctor`: a declaration report and an
 * execution report are different instruments, and merging them would make the
 * cheap one expensive.
 *
 * HOW A CONCERN BECOMES ELIGIBLE FOR A REAL DISPATCH. Not by declaring itself
 * safe — measured. Each concern is run once against a SCRATCH project root with
 * a synthetic event; the scratch tree is hashed before and after. A concern that
 * wrote anything is ineligible and reported `unknown`; one that wrote nothing is
 * eligible, and its observed exit code and output decide between `effective`,
 * `bound-discarded` and `bound-not-fired`.
 *
 * Replacing the declaration with a measurement is stricter than the council
 * verdict it implements, and deliberately so: both seats said a self-declared
 * purity nothing verifies is a weak control here, and both asked for the
 * sandbox anyway — which makes the declaration redundant rather than load-bearing.
 *
 * Class A: in-process, per-invocation, no network. It DOES execute concern
 * scripts, in a scratch root, which is the whole point and is why the eligibility
 * measurement runs first.
 *
 * Usage:
 *   ./scripts-run src/scripts/hooks_doctor [--host <name>] [--format text|json]
 *     [--root <path>] [--limit <n>]
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { buildHostReport, type ConcernProbe, type HostReport } from './_lib/hook_effect_probe.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

interface Manifest {
    concerns: Record<string, { script?: unknown; args?: unknown }>;
    platforms: Record<string, Record<string, string[]>>;
}

function loadManifest(root: string): Manifest {
    const raw = fs.readFileSync(path.join(root, 'src', 'scripts', 'hook_manifest.yaml'), 'utf-8');
    const out = spawnSync(
        process.execPath,
        ['-e', 'const y=require("js-yaml");let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=y.load(s);process.stdout.write(JSON.stringify({concerns:d.concerns||{},platforms:d.platforms||{}}))})'],
        { input: raw, encoding: 'utf-8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    if (out.status !== 0 || !out.stdout) throw new Error(`hook_manifest.yaml could not be parsed: ${out.stderr || 'no output'}`);
    return JSON.parse(out.stdout) as Manifest;
}

/** A content hash of every file under `dir`, so a write of any kind is visible. */
function treeHash(dir: string): string {
    const h = crypto.createHash('sha256');
    const walk = (d: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                h.update(`D:${path.relative(dir, p)}\n`);
                walk(p);
            } else {
                let stat: fs.Stats;
                try {
                    stat = fs.statSync(p);
                } catch {
                    continue;
                }
                h.update(`F:${path.relative(dir, p)}:${String(stat.size)}:${String(stat.mtimeMs)}\n`);
            }
        }
    };
    walk(dir);
    return h.digest('hex');
}

const SYNTHETIC_EVENT = JSON.stringify({
    session_id: 'hooks-doctor-synthetic',
    transcript_path: null,
    tool_name: 'Read',
    tool_input: { file_path: 'README.md' },
});

/** Probe one concern. Sandbox first; a writer is never dispatched for real. */
export function probeConcern(
    root: string,
    host: string,
    slot: string,
    concern: string,
    scriptRel: string,
    args: readonly string[],
): ConcernProbe {
    const abs = path.join(root, scriptRel);
    if (!fs.existsSync(abs)) {
        return { concern, slot, state: 'unknown', reason: `script ${scriptRel} does not exist in this checkout`, wrote_in_sandbox: null };
    }

    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-doctor-'));
    try {
        fs.mkdirSync(path.join(sandbox, 'agents', 'runtime', 'state'), { recursive: true });
        const before = treeHash(sandbox);
        const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
        const res = spawnSync(tsx, [abs, ...args, '--project-dir', sandbox], {
            input: SYNTHETIC_EVENT,
            encoding: 'utf-8',
            timeout: 20_000,
            cwd: sandbox,
            env: { ...process.env, AGENT_CONFIG_REPLAY: '0', CLAUDE_PROJECT_DIR: sandbox },
            maxBuffer: 16 * 1024 * 1024,
        });
        const after = treeHash(sandbox);
        const wrote = before !== after;

        if (res.error !== undefined) {
            return {
                concern,
                slot,
                state: 'unknown',
                reason: `the synthetic dispatch could not run: ${res.error.message}`,
                wrote_in_sandbox: wrote,
            };
        }
        if (wrote) {
            return {
                concern,
                slot,
                state: 'unknown',
                reason: 'the concern wrote to the scratch root, so it is not eligible for a real dispatch — measured, not assumed',
                wrote_in_sandbox: true,
            };
        }

        // Eligible. The exit code is the host contract: 2 with output is a
        // reported concern the host may honour; 0 is a silent pass.
        const status = res.status ?? -1;
        const emitted = (res.stdout ?? '').trim().length > 0 || (res.stderr ?? '').trim().length > 0;
        if (status === 2 && emitted) {
            return { concern, slot, state: 'effective', reason: 'fired and emitted a payload the host forwards', wrote_in_sandbox: false };
        }
        if (status === 2 && !emitted) {
            return { concern, slot, state: 'bound-discarded', reason: 'fired at report severity but emitted nothing to forward', wrote_in_sandbox: false };
        }
        if (status === 0) {
            return { concern, slot, state: 'bound-not-fired', reason: 'ran and stayed silent on the synthetic event — bound, no observable effect', wrote_in_sandbox: false };
        }
        return { concern, slot, state: 'unknown', reason: `exited ${String(status)}, which this probe does not map to a state`, wrote_in_sandbox: false };
    } finally {
        fs.rmSync(sandbox, { recursive: true, force: true });
    }
}

export function buildReport(root: string, host: string, limit: number): HostReport {
    const m = loadManifest(root);
    const slots = m.platforms[host];
    if (slots === undefined) {
        return buildHostReport(host, []);
    }
    const probes: ConcernProbe[] = [];
    for (const [slot, names] of Object.entries(slots)) {
        if (!Array.isArray(names)) continue;
        for (const name of names) {
            if (probes.length >= limit) break;
            const spec = m.concerns[name];
            const rel = typeof spec?.script === 'string' ? spec.script : null;
            if (rel === null) {
                probes.push({ concern: name, slot, state: 'unbound', reason: 'bound on this host but declares no script', wrote_in_sandbox: null });
                continue;
            }
            const args = Array.isArray(spec?.args) ? (spec.args as string[]) : [];
            probes.push(probeConcern(root, host, slot, name, rel, args));
        }
    }
    return buildHostReport(host, probes);
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1)}%`;
}

export function renderText(r: HostReport): string {
    const out: string[] = [];
    out.push(`hook-effect doctor — does this configuration take effect on '${r.host}'?`);
    out.push(`  verdict: ${r.verdict}`);
    out.push(`  ${r.reason}`);
    out.push('');
    out.push('  coverage — a report can be truthful per concern and still mislead:');
    out.push(`    dispatch_rate:    ${pct(r.coverage.dispatch_rate)}  (a synthetic dispatch was attempted)`);
    out.push(`    known_state_rate: ${pct(r.coverage.known_state_rate)}  (a state was established at all)`);
    out.push(`    verified_rate:    ${pct(r.coverage.verified_rate)}  (observed effective or discarded)`);
    out.push('');
    const byState = new Map<string, number>();
    for (const p of r.probes) byState.set(p.state, (byState.get(p.state) ?? 0) + 1);
    out.push('  states:');
    for (const [state, n] of [...byState].sort()) out.push(`    ${state.padEnd(16)} ${String(n)}`);
    if (r.inert_slots.length > 0) {
        out.push('');
        out.push(`  inert slot(s): ${r.inert_slots.join(', ')}`);
    }
    out.push('');
    out.push('  `unknown` is never rendered as `effective`. A run that established nothing');
    out.push('  reports `unknown`, not a working configuration.');
    return out.join('\n') + '\n';
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let host = 'claude';
    let format: 'text' | 'json' = 'text';
    let root = REPO_ROOT;
    let limit = 200;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--host') host = argv[++i] ?? host;
        else if (a === '--format') format = (argv[++i] as 'text' | 'json') ?? format;
        else if (a === '--root') root = path.resolve(argv[++i] ?? root);
        else if (a === '--limit') limit = Number(argv[++i]) || limit;
    }
    let report: HostReport;
    try {
        report = buildReport(root, host, limit);
    } catch (err) {
        process.stderr.write(`❌  hooks_doctor: ${(err as Error).message}\n`);
        return 2;
    }
    process.stdout.write(format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderText(report));
    // An `inert` or `unknown` verdict is information, not a build failure: this
    // is a diagnostic a consumer runs, and a host that legitimately binds
    // nothing is not a defect in this repository.
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
