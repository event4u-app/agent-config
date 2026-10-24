/**
 * The provenance gate as the unattended run reaches it: the download, the
 * binding of the downloaded bytes to the registry's integrity and to the
 * attestations, and the file that is handed to the install step.
 *
 * The signature verification itself is injected here and tested against the
 * real 17.3.0 attestation in `tests/lib/sigstore_provenance.test.ts`; this file
 * pins the WIRING, which is the half that can silently not exist — a verified
 * digest that is not the digest of the bytes installed proves nothing.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    EXIT_REFUSED,
    type UnattendedDeps,
    run_unattended,
    verify_provenance_default,
} from '../../../src/scripts/_cli/upgrade_unattended.js';
import type { ReleaseToVerify } from '../../../src/scripts/_lib/sigstore_provenance.js';
import type { RegistryCandidate } from '../../../src/scripts/_lib/unattended_gates.js';

let tmp: string;
let out: string;
let err: string;
const written: string[] = [];

const NOW = new Date('2026-10-20T00:00:00Z');
const BYTES = Buffer.from('a tarball that is only bytes');
const ATT_URL = 'https://registry.npmjs.org/-/npm/v1/attestations/@event4u%2fagent-config@16.6.0';
const TGZ_URL = 'https://registry.npmjs.org/@event4u/agent-config/-/agent-config-16.6.0.tgz';
const ATTESTATIONS = { attestations: ['the registry document, as fetched'] };

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unattended-provenance-'));
    out = '';
    err = '';
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const f of written.splice(0)) fs.rmSync(path.dirname(f), { recursive: true, force: true });
});

const sri = (b: Buffer): string => `sha512-${crypto.createHash('sha512').update(b).digest('base64')}`;
const hex = (b: Buffer): string => crypto.createHash('sha512').update(b).digest('hex');

function candidate(over: Partial<RegistryCandidate> = {}): RegistryCandidate {
    return {
        version: '16.6.0',
        publishedAt: '2026-10-01T00:00:00Z',
        deprecated: undefined,
        engines: { node: '>=22' },
        provenance: true,
        impactMap: null,
        attestationsUrl: ATT_URL,
        tarballUrl: TGZ_URL,
        integrity: sri(BYTES),
        ...over,
    };
}

/** Serves the attestation document and the tarball; records every URL asked for. */
function registry(bytes: Buffer = BYTES, failStatus: number | null = null) {
    const asked: string[] = [];
    const fetch_impl = (async (url: string) => {
        asked.push(String(url));
        if (failStatus !== null) return { ok: false, status: failStatus } as Response;
        if (String(url) === ATT_URL) return { ok: true, status: 200, json: async () => ATTESTATIONS } as unknown as Response;
        return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-length': String(bytes.length) }),
            arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
        } as unknown as Response;
    }) as unknown as typeof fetch;
    return { fetch_impl, asked };
}

function recording(reason: string | null = null) {
    const seen: ReleaseToVerify[] = [];
    return { seen, verify: async (r: ReleaseToVerify) => (seen.push(r), reason) };
}

describe('verify_provenance_default', () => {
    it('hands back a private file holding exactly the bytes whose digest was verified', async () => {
        const reg = registry();
        const v = recording();
        const result = await verify_provenance_default(candidate(), reg.fetch_impl, 1000, v.verify);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        written.push(result.tarball);
        expect(fs.readFileSync(result.tarball).equals(BYTES)).toBe(true);
        expect(fs.statSync(result.tarball).mode & 0o777).toBe(0o600);
        expect(v.seen).toEqual([{ version: '16.6.0', tarballSha512Hex: hex(BYTES), attestations: ATTESTATIONS }]);
    });

    it('refuses bytes that do not match the integrity the registry records, before verifying anything', async () => {
        const v = recording();
        const result = await verify_provenance_default(candidate(), registry(Buffer.from('other bytes')).fetch_impl, 1000, v.verify);
        expect(result).toEqual({ ok: false, reason: expect.stringContaining('does not match the integrity') });
        expect(v.seen).toEqual([]);
    });

    it('refuses — and writes no file — when the attestations do not verify', async () => {
        const before = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('agent-config-upgrade-')).length;
        const result = await verify_provenance_default(candidate(), registry().fetch_impl, 1000, recording('a forged bundle').verify);
        expect(result).toEqual({ ok: false, reason: '16.6.0: a forged bundle' });
        expect(fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('agent-config-upgrade-')).length).toBe(before);
    });

    it('refuses a url on another host, before fetching anything', async () => {
        for (const over of [{ attestationsUrl: 'http://169.254.169.254/att' }, { tarballUrl: 'https://evil.example/x.tgz' }]) {
            const reg = registry();
            const result = await verify_provenance_default(candidate(over), reg.fetch_impl, 1000, recording().verify);
            expect(result).toEqual({ ok: false, reason: expect.stringContaining('is not on https://registry.npmjs.org') });
            expect(reg.asked).toEqual([]);
        }
    });

    it('refuses when the registry names no attestation, no tarball, or no sha512 integrity', async () => {
        for (const over of [{ attestationsUrl: null }, { tarballUrl: null }, { integrity: null }, { integrity: 'sha1-abc' }]) {
            const result = await verify_provenance_default(candidate(over), registry().fetch_impl, 1000, recording().verify);
            expect(result.ok).toBe(false);
        }
    });

    it('refuses — never passes — when a download fails', async () => {
        const result = await verify_provenance_default(candidate(), registry(BYTES, 503).fetch_impl, 1000, recording().verify);
        expect(result).toEqual({ ok: false, reason: expect.stringContaining('503') });
    });
});

describe('the unattended run consults the provenance gate', () => {
    it('refuses and installs nothing when provenance does not verify', async () => {
        const cmds: string[][] = [];
        const code = await run_unattended(
            deps({
                verifyProvenance: async () => ({ ok: false, reason: '16.6.0: the attestation does not verify' }),
                run: (cmd: string[]) => {
                    cmds.push(cmd);
                    return { rc: 0, stderr: '' };
                },
            }),
        );
        expect(code).toBe(EXIT_REFUSED);
        expect(cmds).toEqual([]);
        expect(out + err).toContain('does not verify');
    });
});

function packument() {
    return {
        'dist-tags': { latest: '16.6.0' },
        time: { '16.6.0': new Date(NOW.getTime() - 100 * 3600 * 1000).toISOString() },
        versions: {
            '16.5.0': { version: '16.5.0' },
            '16.6.0': {
                version: '16.6.0',
                dist: { attestations: { url: ATT_URL, provenance: { predicateType: 'https://slsa.dev/provenance/v1' } } },
                engines: { node: '>=20.11.0' },
                agentConfig: { impact: { '16.6.0': { impact: 'automatic' } } },
            },
        },
    };
}

function deps(over: Partial<UnattendedDeps> = {}): UnattendedDeps {
    return {
        fetchPackument: async () => ({ ok: true, doc: packument() }) as never,
        verifyProvenance: async () => ({ ok: false, reason: 'not stubbed' }),
        run: () => ({ rc: 0, stderr: '' }),
        readInstalled: () => '16.5.0',
        readBinary: () => '16.5.0',
        interrupted: () => false,
        origin: 'global',
        agentConfigBin: '/global/bin/agent-config',
        globalSettings: [path.join(tmp, '.agent-settings.yml')],
        lockPath: path.join(tmp, 'upgrade-unattended.lock'),
        skipPath: path.join(tmp, 'upgrade-skip.json'),
        env: { ci: false, noUpdateCheck: false, nodeVersion: 'v22.11.0' },
        now: () => NOW,
        pid: 4242,
        isAlive: () => true,
        dryRun: false,
        activationBlocked: null,
        out: { write: (t: string) => (out += t) },
        err: { write: (t: string) => (err += t) },
        ...over,
    } as UnattendedDeps;
}
