/**
 * Recorded-ownership plumbing — road-to-a-conformance-check-that-can-fail
 * Phase 5.2.
 *
 * The plumbing half, tested on its own: reading recorded digests out of an
 * installed-tools manifest and comparing them against an on-disk digest. No
 * install behaviour is exercised here — the matrix wiring is a separate
 * commit with a separate test.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    NO_RECORDED_HASHES,
    classifyOwnership,
    readRecordedHashes,
    recordedHashesForRoot,
} from '../../src/install/recordedOwnership.js';

let tmp: string;

let priorManifestEnv: string | undefined;

beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'recorded-ownership-'));
    priorManifestEnv = process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
    delete process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
});

afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    if (priorManifestEnv === undefined) {
        delete process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
    } else {
        process.env['AGENT_CONFIG_INSTALLED_TOOLS'] = priorManifestEnv;
    }
});

function writeManifest(body: string): string {
    mkdirSync(join(tmp, 'agents'), { recursive: true });
    const p = join(tmp, 'agents', 'installed-tools.lock');
    writeFileSync(p, body);
    return p;
}

const MANIFEST = `schema_version: 2
agent_config_version: "1.0.0"
tools:
  - name: claude
    scope: project
    bridge_marker: false
    installed_at: "2026-09-13T00:00:00Z"
    files:
      - path: .claude/rules/a.md
        kind: deployed
        sha256: "aaa"
      - path: .cursorrules
        kind: bridge
        sha256: null
`;

describe('classifyOwnership', () => {
    it('is recorded-unchanged when the digests agree', () => {
        expect(classifyOwnership('aaa', 'aaa')).toBe('recorded-unchanged');
    });

    it('is recorded-modified when the digests differ', () => {
        expect(classifyOwnership('aaa', 'bbb')).toBe('recorded-modified');
    });

    it('is unknown when the path is not recorded at all', () => {
        expect(classifyOwnership(undefined, 'bbb')).toBe('unknown');
    });

    it('is unknown when the manifest recorded no digest (bridge)', () => {
        expect(classifyOwnership(null, 'bbb')).toBe('unknown');
    });

    it('is unknown when the on-disk digest could not be read', () => {
        expect(classifyOwnership('aaa', null)).toBe('unknown');
    });
});

describe('readRecordedHashes', () => {
    it('reads nested files[] entries the hand-rolled manifest parser drops', () => {
        const hashes = readRecordedHashes(writeManifest(MANIFEST), tmp);
        expect(hashes.get(resolve(tmp, '.claude/rules/a.md'))).toBe('aaa');
    });

    it('records a digest-less entry as null, not as absent', () => {
        const hashes = readRecordedHashes(writeManifest(MANIFEST), tmp);
        expect(hashes.has(resolve(tmp, '.cursorrules'))).toBe(true);
        expect(hashes.get(resolve(tmp, '.cursorrules'))).toBeNull();
    });

    it('resolves relative manifest paths against the project root', () => {
        const hashes = readRecordedHashes(writeManifest(MANIFEST), tmp);
        for (const key of hashes.keys()) {
            expect(key.startsWith(tmp)).toBe(true);
        }
    });

    it('keeps an absolute manifest path absolute', () => {
        const abs = process.platform === 'win32' ? 'C:/opt/x.md' : '/opt/x.md';
        const p = writeManifest(
            `tools:\n  - name: t\n    files:\n      - path: "${abs}"\n        kind: deployed\n        sha256: "zzz"\n`,
        );
        const hashes = readRecordedHashes(p, tmp);
        expect(hashes.get(resolve(abs))).toBe('zzz');
    });

    it('is empty when the manifest is absent', () => {
        expect(readRecordedHashes(join(tmp, 'nope.lock'), tmp)).toBe(NO_RECORDED_HASHES);
    });

    it('SABOTAGE: a corrupt manifest yields the empty map, never a throw', () => {
        const p = writeManifest('tools:\n  - name: [unclosed\n    files:\n');
        expect(() => readRecordedHashes(p, tmp)).not.toThrow();
        expect(readRecordedHashes(p, tmp).size).toBe(0);
    });

    it('SABOTAGE: a manifest whose tools is not a list yields the empty map', () => {
        const p = writeManifest('schema_version: 2\ntools: "nope"\n');
        expect(readRecordedHashes(p, tmp).size).toBe(0);
    });

    it('expands a leading ~ the way both existing readers do', () => {
        const p = writeManifest(
            'tools:\n  - name: t\n    files:\n      - path: "~/x.md"\n        kind: deployed\n        sha256: "yyy"\n',
        );
        const hashes = readRecordedHashes(p, tmp);
        expect(hashes.get(join(homedir(), 'x.md'))).toBe('yyy');
        expect(hashes.has(resolve(tmp, '~/x.md'))).toBe(false);
    });
});

describe('recordedHashesForRoot', () => {
    it('honours the AGENT_CONFIG_INSTALLED_TOOLS override', () => {
        const elsewhere = join(tmp, 'relocated.lock');
        writeFileSync(elsewhere, MANIFEST);
        try {
            process.env['AGENT_CONFIG_INSTALLED_TOOLS'] = elsewhere;
            // Nothing sits at the conventional location — without the
            // override this is the empty map and every file degrades to
            // `unknown` with no signal.
            expect(recordedHashesForRoot(tmp).get(resolve(tmp, '.claude/rules/a.md'))).toBe('aaa');
        } finally {
            delete process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
        }
    });

    it('reads the conventional location when no override is set', () => {
        writeManifest(MANIFEST);
        expect(recordedHashesForRoot(tmp).get(resolve(tmp, '.claude/rules/a.md'))).toBe('aaa');
    });

    it('is empty for a root that holds no manifest', () => {
        expect(recordedHashesForRoot(join(tmp, 'nowhere')).size).toBe(0);
    });
});
