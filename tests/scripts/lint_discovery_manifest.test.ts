
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as dm from '../../src/scripts/lint_discovery_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_discovery_manifest.ts');
const MANIFEST = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function manifestExists(): boolean {
    try {
        fs.statSync(MANIFEST);
        return true;
    } catch {
        return false;
    }
}

describe('lint_discovery_manifest._serialize', () => {
    it('produces sorted-key, 2-space-indented JSON + trailing newline', () => {
        const out = dm._serialize({ b: 2, a: [1, 2], c: { z: 1, y: 2 } });
        expect(out).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": 2,\n  "c": {\n    "y": 2,\n    "z": 1\n  }\n}\n');
    });
});

describe('lint_discovery_manifest._check_checksum', () => {
    it('flags a malformed checksum value', () => {
        const err = dm._check_checksum({ checksum: 'not-a-hash' });
        expect(err).not.toBeNull();
        expect(err).toContain('checksum: malformed value');
    });
    it('flags a checksum mismatch', () => {
        const err = dm._check_checksum({ checksum: 'sha256:' + '0'.repeat(64) });
        expect(err).not.toBeNull();
        expect(err).toContain('checksum mismatch');
    });
});
