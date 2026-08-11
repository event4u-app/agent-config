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
    SessionManifest,
    prune_old_artifacts,
    prune_old_sessions,
    save,
} from '../../../src/scripts/ai_council/session.js';
import { CouncilResponse } from '../../../src/scripts/ai_council/clients.js';
import { evaluateQuorum } from '../../../src/scripts/ai_council/quorum.js';

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

// ── road-to-always-on-orchestration Phase 3.2/3.3 — save() additions ─────

function readManifest(sessionDir: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(sessionDir, 'manifest.json'), 'utf-8')) as Record<
        string,
        unknown
    >;
}

describe('session.save — absent_members / quorum (Phase 3.2/3.3)', () => {
    it('omitting both writes an empty array and a null — same shape an old caller always got, plus two keys', () => {
        const base = mkTmp();
        const manifest = new SessionManifest({
            mode: 'prompt',
            artefact: '<inline>',
            original_ask: 'hi',
            members: ['anthropic/claude-x'],
        });
        const responses = [new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'ok' })];
        const dir = save({ manifest, responses, sessions_dir: base, retention_days: 0 });
        const payload = readManifest(dir);
        expect(payload['absent_members']).toEqual([]);
        expect(payload['quorum']).toBeNull();
    });

    it('serialises populated absent_members with their machine-readable reason', () => {
        const base = mkTmp();
        const manifest = new SessionManifest({
            mode: 'prompt',
            artefact: '<inline>',
            original_ask: 'hi',
            members: ['anthropic/claude-x'],
            absent_members: [
                { member: 'openai', reason: 'no_binary', detail: 'codex is not on PATH' },
                { member: 'gemini', reason: null, detail: 'unclassified failure' },
            ],
        });
        const responses = [new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'ok' })];
        const dir = save({ manifest, responses, sessions_dir: base, retention_days: 0 });
        const payload = readManifest(dir);
        expect(payload['absent_members']).toEqual([
            { member: 'openai', reason: 'no_binary', detail: 'codex is not on PATH' },
            { member: 'gemini', reason: null, detail: 'unclassified failure' },
        ]);
    });

    it('serialises an inconclusive quorum verdict', () => {
        const base = mkTmp();
        const quorum = evaluateQuorum(2, 0);
        const manifest = new SessionManifest({
            mode: 'prompt',
            artefact: '<inline>',
            original_ask: 'hi',
            members: [],
            quorum,
        });
        const dir = save({ manifest, responses: [], sessions_dir: base, retention_days: 0 });
        const payload = readManifest(dir);
        expect(payload['quorum']).toEqual({ status: 'inconclusive', threshold: 1, total: 2, present: 0, heldByFloor: false });
    });

    it('a caller-supplied `extra` key still wins over the new fields on a name collision', () => {
        const base = mkTmp();
        const manifest = new SessionManifest({
            mode: 'prompt',
            artefact: '<inline>',
            original_ask: 'hi',
            members: [],
            extra: { quorum: 'overridden-by-extra' },
        });
        const dir = save({ manifest, responses: [], sessions_dir: base, retention_days: 0 });
        const payload = readManifest(dir);
        expect(payload['quorum']).toBe('overridden-by-extra');
    });
});

describe('session.save — served-model attribution on the response row (ledger-truth 1.2)', () => {
    function mkManifest() {
        return new SessionManifest({
            mode: 'prompt',
            artefact: '<inline>',
            original_ask: 'hi',
            members: ['anthropic/claude-sonnet-4-5'],
        });
    }

    it('persists model_served beside the requested model, and NOT in the manifest', () => {
        const base = mkTmp();
        const responses = [
            new CouncilResponse({
                provider: 'anthropic',
                model: 'claude-sonnet-4-5',
                model_served: 'claude-sonnet-4-5-20260101',
                text: 'ok',
            }),
        ];
        const dir = save({ manifest: mkManifest(), responses, sessions_dir: base, retention_days: 0 });
        const payload = readManifest(dir);
        const rows = (payload['responses_per_round'] as Array<Array<Record<string, unknown>>>)[0]!;
        expect(rows[0]!['model']).toBe('claude-sonnet-4-5');
        expect(rows[0]!['model_served']).toBe('claude-sonnet-4-5-20260101');
        // The surplus the roadmap flagged and left to this change: the field
        // belongs on the response row it describes, not hoisted to the
        // manifest as if it were a session-level fact.
        expect(payload['model_served']).toBeUndefined();
    });

    it("a transport that reports no served id persists '' — additive, absent-safe", () => {
        const base = mkTmp();
        const responses = [new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'ok' })];
        const dir = save({ manifest: mkManifest(), responses, sessions_dir: base, retention_days: 0 });
        const rows = (readManifest(dir)['responses_per_round'] as Array<Array<Record<string, unknown>>>)[0]!;
        expect(rows[0]!['model_served']).toBe('');
    });
});
