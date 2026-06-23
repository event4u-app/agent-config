// Tests for work_engine/migration/v0_to_v1.ts (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer).
//
// Coverage: constants, and migrate_file round-trip (default destination,
// --no-backup, backup rotation, refuse-overwrite, missing source, invalid
// JSON). Temp dirs are created per-test and removed.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BACKUP_SUFFIX,
    DEFAULT_V0_FILENAME,
    DEFAULT_V1_FILENAME,
    migrate_file,
} from '../../../src/agent-src/templates/scripts/work_engine/migration/v0_to_v1.js';
import { SchemaError } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v0to1-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('migrate_payload — constants', () => {
    it('exposes the canonical filenames + suffix', () => {
        expect(DEFAULT_V0_FILENAME).toBe('.implement-ticket-state.json');
        expect(DEFAULT_V1_FILENAME).toBe('.work-state.json');
        expect(BACKUP_SUFFIX).toBe('.bak');
    });
});

describe('migrate_file — round-trip', () => {
    it('writes v1 next to the source and backs up the v0 file', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-1', title: 'Do' } }), 'utf-8');
        const target = migrate_file(src);
        expect(target).toBe(path.join(tmp, DEFAULT_V1_FILENAME));
        expect(fs.existsSync(target)).toBe(true);
        expect(fs.existsSync(src)).toBe(false);
        expect(fs.existsSync(src + BACKUP_SUFFIX)).toBe(true);
        // Trailing newline contract.
        expect(fs.readFileSync(target, 'utf-8').endsWith('\n')).toBe(true);
    });

    it('--no-backup leaves the source in place', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-2' } }), 'utf-8');
        migrate_file(src, { backup: false });
        expect(fs.existsSync(src)).toBe(true);
    });

    it('rotates the backup when .bak is taken', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-3' } }), 'utf-8');
        fs.writeFileSync(src + BACKUP_SUFFIX, 'old', 'utf-8');
        migrate_file(src);
        expect(fs.existsSync(src + BACKUP_SUFFIX + '.1')).toBe(true);
    });

    it('refuses to overwrite an existing destination', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        const dst = path.join(tmp, DEFAULT_V1_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-4' } }), 'utf-8');
        fs.writeFileSync(dst, '{}', 'utf-8');
        expect(() => migrate_file(src)).toThrow(SchemaError);
    });

    it('raises on a missing source', () => {
        expect(() => migrate_file(path.join(tmp, 'nope.json'))).toThrow(SchemaError);
    });

    it('raises on invalid JSON', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, 'not json', 'utf-8');
        expect(() => migrate_file(src)).toThrow(SchemaError);
    });
});
