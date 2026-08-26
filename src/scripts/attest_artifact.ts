#!/usr/bin/env tsx
/**
 * Content attestation for any artifact a hook would INJECT.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 5, Steps 6-7, and the
 * ordering in that step is the argument: attestation is the **precondition** for
 * auto-injection, not a follow-up to it.
 *
 * ── The threat, concretely ──────────────────────────────────────────────────
 * A hook that reads a tracked file and injects its contents into the model's
 * context turns that file into a **standing injection amplifier**. Whoever can
 * write the file can write the agent's instructions, on every session, without
 * a review — which is `untrusted-input-defense`'s found-instructions case
 * arriving through a file the repository itself vouches for. The file being
 * tracked is not the control: a tracked file changes in a pull request, and a
 * pull request that changes an injected file is indistinguishable in the diff
 * from one that changes documentation.
 *
 * ── The contract ────────────────────────────────────────────────────────────
 * An injectable artifact carries a sidecar `<file>.attest.json` holding the
 * sha256 of its bytes and the date the attestation was recorded. Before
 * injecting, a caller asks {@link verifyArtifact}:
 *
 *   - hash matches   → `ok`, inject.
 *   - hash differs   → `mismatch`, REFUSE. The content changed since a human
 *     vouched for it; re-attesting is a deliberate act with a diff.
 *   - no sidecar     → `unattested`, REFUSE. **Not "allow because nothing said
 *     no"** — that default makes the whole mechanism opt-out, and the file an
 *     attacker adds is exactly the one with no sidecar.
 *   - file missing   → `absent`, REFUSE.
 *
 * ── What this does NOT claim ────────────────────────────────────────────────
 * The sidecar is committed beside the artifact, so an attacker who can write
 * both can write a consistent pair. This is NOT a cryptographic signature and
 * does not pretend to be one. What it buys is that the change becomes VISIBLE:
 * a diff that touches an injected file must also touch its attestation, and a
 * hash line changing in a review is a question, where a prose change in the same
 * file is not. Making a change reviewable is the honest claim; making it
 * impossible would need a key this repository does not have.
 *
 * Exit codes: 0 verified · 1 refused (mismatch / unattested / absent) · 2 usage.
 *
 * Usage:
 *     ./scripts-run src/scripts/attest_artifact --record <file>
 *     ./scripts-run src/scripts/attest_artifact --verify <file>
 *     ./scripts-run src/scripts/attest_artifact --verify <file> --json
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** Sidecar suffix. Beside the artifact, so a move takes the attestation with it. */
export const ATTEST_SUFFIX = '.attest.json';

export type AttestStatus = 'ok' | 'mismatch' | 'unattested' | 'absent';

export interface Attestation {
    schema_version: 1;
    /** sha256 of the artifact's bytes, hex. */
    sha256: string;
    /** `YYYY-MM-DD` the attestation was recorded. */
    recorded_at: string;
    /** Bytes at record time — a cheap second signal that costs nothing to store. */
    bytes: number;
}

export interface Verdict {
    status: AttestStatus;
    /** True only for `ok`. Every other status refuses. */
    inject: boolean;
    detail: string;
    expected?: string;
    actual?: string;
}

export function sidecarPath(artifact: string): string {
    return `${artifact}${ATTEST_SUFFIX}`;
}

export function hashFile(artifact: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
}

/**
 * Verify an artifact against its sidecar.
 *
 * Every non-`ok` status sets `inject: false`. That is the whole safety property
 * and it is expressed as data rather than left to each caller's `if`: a caller
 * that reads `verdict.inject` cannot accidentally treat `unattested` as
 * permissive, which is the mistake an `status === 'mismatch'` check invites.
 */
export function verifyArtifact(artifact: string, today?: string): Verdict {
    void today;
    if (!fs.existsSync(artifact)) {
        return { status: 'absent', inject: false, detail: `${artifact} does not exist` };
    }
    const side = sidecarPath(artifact);
    if (!fs.existsSync(side)) {
        return {
            status: 'unattested',
            inject: false,
            detail:
                `${artifact} has no ${ATTEST_SUFFIX} sidecar — REFUSED. An unattested artifact is ` +
                'not "allowed because nothing said no": that default makes attestation opt-out, and ' +
                'the file an attacker adds is precisely the one with no sidecar.',
        };
    }
    let att: Partial<Attestation>;
    try {
        att = JSON.parse(fs.readFileSync(side, 'utf8')) as Partial<Attestation>;
    } catch (e) {
        return {
            status: 'unattested',
            inject: false,
            detail: `${side} does not parse (${e instanceof Error ? e.message : String(e)}) — treated as absent`,
        };
    }
    const actual = hashFile(artifact);
    if (typeof att.sha256 !== 'string' || att.sha256 === '') {
        return { status: 'unattested', inject: false, detail: `${side} carries no sha256`, actual };
    }
    if (att.sha256 !== actual) {
        return {
            status: 'mismatch',
            inject: false,
            detail:
                `${artifact} changed since it was attested — REFUSED. Re-attest deliberately ` +
                `(--record) so the new hash lands in a diff a reviewer sees.`,
            expected: att.sha256,
            actual,
        };
    }
    return { status: 'ok', inject: true, detail: `${artifact} matches its attestation`, expected: att.sha256, actual };
}

/** Record (or re-record) an attestation. Deliberate, and it lands in a diff. */
export function recordAttestation(artifact: string, today = new Date().toISOString().slice(0, 10)): Attestation {
    const att: Attestation = {
        schema_version: 1,
        sha256: hashFile(artifact),
        recorded_at: today,
        bytes: fs.statSync(artifact).size,
    };
    fs.writeFileSync(sidecarPath(artifact), `${JSON.stringify(att, null, 2)}\n`, 'utf8');
    return att;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const usage =
        'usage: attest_artifact (--record | --verify) <file> [--json]\n' +
        '  --verify exits 1 on mismatch, unattested or absent. Refusal is the default.\n';
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(usage);
        return 0;
    }
    const asJson = argv.includes('--json');
    const record = argv.includes('--record');
    const verify = argv.includes('--verify');
    const file = argv.find((a) => !a.startsWith('--'));
    if (record === verify || file === undefined) {
        process.stderr.write(`attest_artifact: error: exactly one of --record / --verify plus a file\n${usage}`);
        return 2;
    }
    const target = path.resolve(file);
    if (record) {
        if (!fs.existsSync(target)) {
            process.stderr.write(`attest_artifact: ${file} does not exist\n`);
            return 2;
        }
        const att = recordAttestation(target);
        process.stdout.write(`✅  attested ${file} — sha256 ${att.sha256.slice(0, 16)}… (${String(att.bytes)} bytes)\n`);
        return 0;
    }
    const v = verifyArtifact(target);
    if (asJson) {
        process.stdout.write(`${JSON.stringify(v, null, 2)}\n`);
    } else if (v.inject) {
        process.stdout.write(`✅  ${v.detail}\n`);
    } else {
        process.stderr.write(`❌  [${v.status}] ${v.detail}\n`);
    }
    return v.inject ? 0 : 1;
}

/* c8 ignore start */
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href) {
    process.exit(main());
}
/* c8 ignore stop */
