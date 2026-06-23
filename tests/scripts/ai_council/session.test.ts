// Tests for src/scripts/ai_council/session.ts (py2ts Phase 1, ADR-094).
//
// session persists a council call to a sessions dir: manifest.json (JSON),
// response.md (orchestrator.render output), raw-text.md (concatenated raw
// member text). It also prunes old session subdirs (timestamp-named) and old
// root files / non-timestamp dirs (mtime-based).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    prune_old_artifacts,
    prune_old_sessions,
} from '../../../src/scripts/ai_council/session.js';

// ── tmp-dir bookkeeping ────────────────────────────────────────────────────
const _tmpDirs: string[] = [];

function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'session-ts-'));
    _tmpDirs.push(d);
    return d;
}

afterEach(() => {
    for (const d of _tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

// ── Pinned mtimes / now for the prune unit tests ────────────────────────────
const OLD_MTIME = Date.UTC(2020, 0, 1, 0, 0, 0) / 1000; // far in the past
const NOW_MS = Date.UTC(2026, 5, 14, 12, 0, 0);

// ── Unit-level behaviour ─────────────────────────────────────────────────────

describe('session.prune_old_sessions — unit', () => {
    it('returns [] for a missing sessions dir', () => {
        expect(prune_old_sessions(path.join(mkTmp(), 'nope'), 7)).toEqual([]);
    });

    it('skips non-timestamp directory names', () => {
        const base = mkTmp();
        fs.mkdirSync(path.join(base, 'custom-folder'));
        fs.mkdirSync(path.join(base, '2020-01-01T00-00-00Z'));
        const removed = prune_old_sessions(base, 7, { now: new Date(NOW_MS) });
        expect(removed.map((p) => path.basename(p))).toEqual(['2020-01-01T00-00-00Z']);
        expect(fs.existsSync(path.join(base, 'custom-folder'))).toBe(true);
    });
});

describe('session.prune_old_artifacts — unit', () => {
    it('skips timestamp subdirs (owned by prune_old_sessions)', () => {
        const base = mkTmp();
        const tsDir = path.join(base, '2020-01-01T00-00-00Z');
        fs.mkdirSync(tsDir);
        fs.utimesSync(tsDir, OLD_MTIME, OLD_MTIME);
        const removed = prune_old_artifacts(base, 7, { now: new Date(NOW_MS) });
        expect(removed).toEqual([]);
        expect(fs.existsSync(tsDir)).toBe(true);
    });
});
