
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as sv from '../../src/skills/corpus-grounding/scripts/schema_validator.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'skills', 'corpus-grounding', 'scripts');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-sv-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

const VALID: Record<string, unknown> = {
    manifest_version: 1,
    domain: 'design',
    tier: 'lookup-only',
    owner: 'o',
    refresh_cadence: 'q',
    upstream: { repo: 'r', sha: 's', last_checked: 'l' },
    domains: { color: { file: 'c.csv', search_cols: ['Name'], output_cols: ['Name'] } },
};

describe('schema_validator — validate_manifest', () => {
    it('accepts a minimal valid manifest', () => {
        expect(sv.validate_manifest(VALID)).toEqual([]);
    });

    it('non-object input is rejected', () => {
        expect(sv.validate_manifest(42)).toEqual(['manifest must be a JSON object']);
        expect(sv.validate_manifest([1, 2])).toEqual(['manifest must be a JSON object']);
    });

    it('missing top-level keys short-circuit (no further checks)', () => {
        expect(sv.validate_manifest({ manifest_version: 2 })).toEqual([
            "missing required key: 'domain'",
            "missing required key: 'tier'",
            "missing required key: 'domains'",
        ]);
    });

    it('reports version / tier / provenance violations with Python repr()', () => {
        expect(sv.validate_manifest({ manifest_version: 2, domain: 'd', tier: 'x', domains: {} })).toEqual([
            'manifest_version 2 unsupported (engine speaks v1)',
            "tier 'x' not in ('lookup-only', 'conditional-grounding', 'constraint-emission')",
            'domains must be a non-empty object',
            "missing provenance key: 'owner' (ADR-061 §6)",
            "missing provenance key: 'refresh_cadence' (ADR-061 §6)",
            "missing provenance key: 'upstream' (ADR-061 §6)",
        ]);
    });

    it('reasoning-present-on-lookup-only + non-empty-list + bad upstream', () => {
        expect(
            sv.validate_manifest({
                manifest_version: 1,
                domain: 'd',
                tier: 'lookup-only',
                domains: { a: { file: 'f', search_cols: [], output_cols: ['x'] } },
                owner: 'o',
                refresh_cadence: 'c',
                upstream: 'bad',
                reasoning: {},
            }),
        ).toEqual([
            'domains.a.search_cols must be a non-empty list',
            'reasoning block present but tier is lookup-only',
            "reasoning missing 'file'",
            "reasoning missing 'match_column'",
            "reasoning missing 'plan'",
            'upstream must be an object {repo, sha, last_checked}',
        ]);
    });
});

describe('schema_validator — load_manifest + resolve_data_path', () => {
    it('load_manifest throws ManifestError on a missing file', () => {
        expect(() => sv.load_manifest('/nope/missing.json')).toThrow(sv.ManifestError);
        expect(() => sv.load_manifest('/nope/missing.json')).toThrow('Manifest not found: /nope/missing.json');
    });

    it('load_manifest attaches _manifest_dir (symlink-resolved)', () => {
        const d = mkTmp();
        const p = path.join(d, 'manifest.json');
        fs.writeFileSync(p, JSON.stringify(VALID));
        const m = sv.load_manifest(p);
        // Python str(path.resolve().parent) — equals the realpath of the dir.
        expect(m._manifest_dir).toBe(fs.realpathSync.native(d));
    });

    it('resolve_data_path refuses absolute + parent-escape paths', () => {
        const m = { _manifest_dir: '/base' };
        expect(() => sv.resolve_data_path(m, '/etc/passwd')).toThrow(
            "corpus path must be manifest-relative: '/etc/passwd'",
        );
        expect(() => sv.resolve_data_path(m, '../escape.csv')).toThrow(
            "corpus path must be manifest-relative: '../escape.csv'",
        );
    });

    it('resolve_data_path joins base + data_dir + relative', () => {
        const d = mkTmp();
        const m = { _manifest_dir: d };
        expect(sv.resolve_data_path(m, 'corpus.csv')).toBe(path.join(fs.realpathSync.native(d), 'corpus.csv'));
    });
});
