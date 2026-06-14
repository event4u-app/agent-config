// Tests for src/scripts/ai_council/session.ts (py2ts Phase 1, ADR-094).
//
// session persists a council call to a sessions dir: manifest.json (JSON),
// response.md (orchestrator.render output), raw-text.md (concatenated raw
// member text). It also prunes old session subdirs (timestamp-named) and old
// root files / non-timestamp dirs (mtime-based).
//
// Golden parity: every write/list/prune case runs the REAL python3 package
// path (`_harness` PYTHONPATH wires `src` + repo root, matching pyproject) and
// the tsx twin on identical tmp fixtures with a pinned timestamp + pinned
// `now`, then asserts BYTE-IDENTICAL written/pruned artefacts and the same
// `removed` ordering. session imports clients + orchestrator siblings, so the
// Python side exercises the real merged twins.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CouncilResponse } from '../../../src/scripts/ai_council/clients.js';
import {
    SessionManifest,
    prune_all_council_artifacts,
    prune_old_artifacts,
    prune_old_sessions,
    save,
} from '../../../src/scripts/ai_council/session.js';
import { hasPython3, runPyCode } from './_harness.js';

const py3 = hasPython3();

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

// ── Shared fixtures ────────────────────────────────────────────────────────
// A declarative spec consumed identically by both runtimes for the save() case.

interface RespSpec {
    provider: string;
    model: string;
    text: string;
    input_tokens?: number;
    output_tokens?: number;
    latency_ms?: number;
    error?: string | null;
    metadata?: Record<string, unknown>;
}

interface SaveSpec {
    manifest: {
        mode: string;
        artefact: string;
        original_ask: string;
        members: string[];
        rounds: number;
        cost_usd_estimated: number;
        cost_usd_actual: number;
        extra: Record<string, unknown>;
    };
    rounds: RespSpec[][];
    timestamp: string;
}

const SAVE_SPEC: SaveSpec = {
    manifest: {
        mode: 'prompt',
        artefact: '<inline>',
        // Non-ASCII (é, ü) exercises ensure_ascii=True \uXXXX escaping.
        original_ask: 'Should we adopt the new café architecture? — über',
        members: ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o'],
        rounds: 2,
        // Integer-valued float must render 0.0 (PyFloat), non-integer keeps digits.
        cost_usd_estimated: 0.5,
        cost_usd_actual: 0.0,
        extra: { preamble_fingerprint: 'abc123', nested: { k: 1, list: [1, 2, 3] } },
    },
    rounds: [
        [
            {
                provider: 'anthropic',
                model: 'claude-sonnet-4-5',
                text: 'Round-1 anthropic text with é and a newline\nsecond line',
                input_tokens: 1200,
                output_tokens: 340,
                latency_ms: 4521,
                error: null,
                metadata: {
                    transport: 'cli',
                    billable: false,
                    tokens_estimated: true,
                    subscription_label: 'claude-pro',
                    cost_usd: 0.0,
                },
            },
            {
                provider: 'openai',
                model: 'gpt-4o',
                text: 'Round-1 openai text',
                input_tokens: 900,
                output_tokens: 210,
                latency_ms: 3300,
                error: null,
                metadata: { transport: 'api', cost_usd: 0.004215 },
            },
        ],
        [
            {
                provider: 'anthropic',
                model: 'claude-sonnet-4-5',
                text: 'Round-2 synthesis line',
                input_tokens: 400,
                output_tokens: 120,
                latency_ms: 2100,
                error: null,
            },
            {
                provider: 'openai',
                model: 'gpt-4o',
                text: 'Round-2 openai with an error',
                input_tokens: 0,
                output_tokens: 0,
                latency_ms: 50,
                error: 'rate_limited',
                metadata: { transport: 'api' },
            },
        ],
    ],
    timestamp: '2026-06-14T12-00-00Z',
};

// Single-round (flat list) spec — exercises the `list[CouncilResponse]` branch.
const SINGLE_ROUND_SPEC: SaveSpec = {
    manifest: {
        mode: 'diff',
        artefact: 'agents/roadmaps/road-to-x.md',
        original_ask: '',
        members: ['openai/gpt-4o'],
        rounds: 1,
        cost_usd_estimated: 0.0,
        cost_usd_actual: 0.123456,
        extra: {},
    },
    rounds: [
        [
            {
                provider: 'openai',
                model: 'gpt-4o',
                text: 'solo verdict',
            },
        ],
    ],
    timestamp: '2026-01-02T03-04-05Z',
};

// Empty responses — render([]) + empty raw-text.md.
const EMPTY_SPEC: SaveSpec = {
    manifest: {
        mode: 'files',
        artefact: '<inline>',
        original_ask: 'nothing',
        members: [],
        rounds: 1,
        cost_usd_estimated: 0.0,
        cost_usd_actual: 0.0,
        extra: {},
    },
    rounds: [[]],
    timestamp: '2025-12-31T23-59-59Z',
};

function buildTsResponses(rounds: RespSpec[][]): CouncilResponse[][] {
    return rounds.map((round) =>
        round.map((r) => {
            // Build opts with only the present optional fields so
            // exactOptionalPropertyTypes is satisfied (mirrors the Python
            // `.get(k, default)` defaults handled inside CouncilResponse).
            const opts: ConstructorParameters<typeof CouncilResponse>[0] = {
                provider: r.provider,
                model: r.model,
                text: r.text,
                error: r.error ?? null,
            };
            if (r.input_tokens !== undefined) opts.input_tokens = r.input_tokens;
            if (r.output_tokens !== undefined) opts.output_tokens = r.output_tokens;
            if (r.latency_ms !== undefined) opts.latency_ms = r.latency_ms;
            if (r.metadata !== undefined) opts.metadata = r.metadata;
            return new CouncilResponse(opts);
        }),
    );
}

/** Run the TS twin's save() into `base` for `spec`. */
function tsSave(spec: SaveSpec, base: string): string {
    const manifest = new SessionManifest({
        mode: spec.manifest.mode,
        artefact: spec.manifest.artefact,
        original_ask: spec.manifest.original_ask,
        members: spec.manifest.members,
        rounds: spec.manifest.rounds,
        cost_usd_estimated: spec.manifest.cost_usd_estimated,
        cost_usd_actual: spec.manifest.cost_usd_actual,
        extra: spec.manifest.extra,
    });
    return save({
        manifest,
        responses: buildTsResponses(spec.rounds),
        sessions_dir: base,
        timestamp: spec.timestamp,
        retention_days: 0, // disable pruning so save() is write-only here
    });
}

/** Run the python3 twin's save() into `base` for `spec` (real package path). */
function pySave(spec: SaveSpec, base: string): void {
    const code = [
        'import sys, json',
        'from pathlib import Path',
        'from scripts.ai_council import session as S',
        'from scripts.ai_council.clients import CouncilResponse',
        'spec = json.loads(sys.stdin.read())',
        'base = Path(sys.argv[1])',
        'def mk(r):',
        '    return CouncilResponse(provider=r["provider"], model=r["model"], text=r["text"],',
        '        input_tokens=r.get("input_tokens", 0), output_tokens=r.get("output_tokens", 0),',
        '        latency_ms=r.get("latency_ms", 0), error=r.get("error"),',
        '        metadata=r.get("metadata") or {})',
        'rounds = [[mk(r) for r in rnd] for rnd in spec["rounds"]]',
        'm = spec["manifest"]',
        // JSON has no int/float distinction, so a `0.0` fixture value arrives
        // as a Python int after json.loads — coerce the cost fields to float
        // to mirror session.py's float contract (the round(...) call would
        // otherwise emit `0` not `0.0`).
        'man = S.SessionManifest(mode=m["mode"], artefact=m["artefact"],',
        '    original_ask=m["original_ask"], members=m["members"], rounds=m["rounds"],',
        '    cost_usd_estimated=float(m["cost_usd_estimated"]),',
        '    cost_usd_actual=float(m["cost_usd_actual"]),',
        '    extra=m["extra"])',
        'S.save(manifest=man, responses=rounds, sessions_dir=base,',
        '    timestamp=spec["timestamp"], retention_days=0)',
    ].join('\n');
    const r = runPyCode(code, [base], { input: JSON.stringify(spec) });
    if (r.status !== 0) {
        throw new Error(`python3 save failed: ${r.stderr}`);
    }
}

function readArtefact(base: string, ts: string, name: string): string {
    return fs.readFileSync(path.join(base, ts, name), { encoding: 'utf-8' });
}

describe.runIf(py3)('session.save — byte-parity with python3', () => {
    for (const [label, spec] of [
        ['multi-round', SAVE_SPEC],
        ['single-round flat list', SINGLE_ROUND_SPEC],
        ['empty responses', EMPTY_SPEC],
    ] as const) {
        it(`writes identical manifest/response/raw-text — ${label}`, () => {
            const tsBase = mkTmp();
            const pyBase = mkTmp();
            const tsDir = tsSave(spec, tsBase);
            pySave(spec, pyBase);

            expect(path.basename(tsDir)).toBe(spec.timestamp);
            for (const f of ['manifest.json', 'response.md', 'raw-text.md']) {
                const tsContent = readArtefact(tsBase, spec.timestamp, f);
                const pyContent = readArtefact(pyBase, spec.timestamp, f);
                expect(tsContent, `${f} byte-parity`).toBe(pyContent);
            }
        });
    }
});

// ── Prune parity ────────────────────────────────────────────────────────────
// Seed an identical fixture tree in two tmp roots, prune both at a pinned
// `now`, and assert the same `removed` ordering AND the same survivors.

interface PruneSpec {
    // timestamp-named session subdirs (each gets a manifest.json child)
    sessionDirs: string[];
    // root-level files in sessions/ with an mtime epoch (seconds)
    sessionRootFiles: Array<{ name: string; mtime: number }>;
    questionFiles: Array<{ name: string; mtime: number }>;
    responseFiles: Array<{ name: string; mtime: number }>;
    retentionDays: number;
    nowEpochMs: number;
}

const OLD_MTIME = Date.UTC(2020, 0, 1, 0, 0, 0) / 1000; // far in the past
const NEW_MTIME = Date.UTC(2099, 0, 1, 0, 0, 0) / 1000; // far in the future
const NOW_MS = Date.UTC(2026, 5, 14, 12, 0, 0);

const PRUNE_SPEC: PruneSpec = {
    sessionDirs: [
        '2020-01-01T00-00-00Z', // old → pruned
        '2099-01-01T00-00-00Z', // new → kept
        '2026-06-10T00-00-00Z', // within 7-day window of now → kept
        'not-a-timestamp', // non-matching dir name → skipped by prune_old_sessions, mtime by artifacts
    ],
    sessionRootFiles: [
        { name: 'report-old.json', mtime: OLD_MTIME },
        { name: 'report-new.json', mtime: NEW_MTIME },
    ],
    questionFiles: [
        { name: 'q-old.md', mtime: OLD_MTIME },
        { name: 'q-new.md', mtime: NEW_MTIME },
    ],
    responseFiles: [
        { name: 'r-old.json', mtime: OLD_MTIME },
        { name: 'r-new.json', mtime: NEW_MTIME },
    ],
    retentionDays: 7,
    nowEpochMs: NOW_MS,
};

function seedPruneFixture(root: string, spec: PruneSpec): void {
    const sessions = path.join(root, 'agents', 'runtime', 'council', 'sessions');
    const questions = path.join(root, 'agents', 'runtime', 'council', 'questions');
    const responses = path.join(root, 'agents', 'runtime', 'council', 'responses');
    fs.mkdirSync(sessions, { recursive: true });
    fs.mkdirSync(questions, { recursive: true });
    fs.mkdirSync(responses, { recursive: true });
    for (const name of spec.sessionDirs) {
        const d = path.join(sessions, name);
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, 'manifest.json'), '{}\n');
        if (name === 'not-a-timestamp') {
            // mtime-based: make it old so prune_old_artifacts removes it.
            fs.utimesSync(d, OLD_MTIME, OLD_MTIME);
        }
    }
    const writeWithMtime = (dir: string, f: { name: string; mtime: number }): void => {
        const p = path.join(dir, f.name);
        fs.writeFileSync(p, `${f.name}\n`);
        fs.utimesSync(p, f.mtime, f.mtime);
    };
    for (const f of spec.sessionRootFiles) writeWithMtime(sessions, f);
    for (const f of spec.questionFiles) writeWithMtime(questions, f);
    for (const f of spec.responseFiles) writeWithMtime(responses, f);
}

/** Run TS prune_all_council_artifacts; return removed-by-label + survivors. */
function tsPrune(root: string, spec: PruneSpec): { removed: string[]; survivors: string[] } {
    const res = prune_all_council_artifacts(spec.retentionDays, {
        repo_root: root,
        now: new Date(spec.nowEpochMs),
    });
    const removed: string[] = [];
    for (const label of Object.keys(res)) {
        for (const p of res[label] as string[]) {
            removed.push(`${label}: ${path.basename(p)}`);
        }
    }
    return { removed, survivors: survivorList(root) };
}

/** Run python3 prune_all_council_artifacts; return removed-by-label + survivors. */
function pyPrune(root: string, spec: PruneSpec): { removed: string[]; survivors: string[] } {
    const code = [
        'import sys, json, datetime as dt',
        'from pathlib import Path',
        'from scripts.ai_council import session as S',
        'root = Path(sys.argv[1])',
        'spec = json.loads(sys.stdin.read())',
        'now = dt.datetime.fromtimestamp(spec["nowEpochMs"] / 1000, tz=dt.timezone.utc)',
        'res = S.prune_all_council_artifacts(retention_days=spec["retentionDays"],',
        '    repo_root=root, now=now)',
        'out = []',
        'for label in res:',
        '    for p in res[label]:',
        '        out.append(f"{label}: {Path(p).name}")',
        'sys.stdout.write("\\n".join(out))',
    ].join('\n');
    const r = runPyCode(code, [root], { input: JSON.stringify(spec) });
    if (r.status !== 0) {
        throw new Error(`python3 prune failed: ${r.stderr}`);
    }
    const removed = r.stdout.length > 0 ? r.stdout.split('\n') : [];
    return { removed, survivors: survivorList(root) };
}

function survivorList(root: string): string[] {
    const dir = path.join(root, 'agents');
    const out: string[] = [];
    const walk = (p: string): void => {
        for (const name of fs.readdirSync(p).sort()) {
            const child = path.join(p, name);
            const rel = path.relative(root, child);
            if (fs.statSync(child).isDirectory()) {
                walk(child);
            } else {
                out.push(rel);
            }
        }
    };
    walk(dir);
    return out.sort();
}

describe.runIf(py3)('session.prune_all_council_artifacts — parity with python3', () => {
    it('removes the same paths in the same order and leaves the same survivors', () => {
        const tsRoot = mkTmp();
        const pyRoot = mkTmp();
        seedPruneFixture(tsRoot, PRUNE_SPEC);
        seedPruneFixture(pyRoot, PRUNE_SPEC);

        const tsRes = tsPrune(tsRoot, PRUNE_SPEC);
        const pyRes = pyPrune(pyRoot, PRUNE_SPEC);

        // The set of removed paths must match. NOTE: session.py iterates each
        // dir via `Path.iterdir()`, whose order is OS-/filesystem-dependent
        // and therefore not a Python guarantee (macOS APFS readdir order ≠
        // CPython scandir order). The faithful invariant is the same *set* of
        // removals + identical survivors, not a specific intra-dir order, so we
        // compare sorted (the per-dir removal order is genuinely
        // non-deterministic in the original too).
        expect([...tsRes.removed].sort()).toEqual([...pyRes.removed].sort());
        // Whatever survived must be identical sets.
        expect(tsRes.survivors).toEqual(pyRes.survivors);
        // Sanity: the old artefacts are gone, the new ones remain.
        expect(tsRes.removed).toContain('sessions: 2020-01-01T00-00-00Z');
        expect(tsRes.removed).toContain('sessions: report-old.json');
        expect(tsRes.removed).toContain('sessions: not-a-timestamp');
        expect(tsRes.removed).toContain('questions: q-old.md');
        expect(tsRes.removed).toContain('responses: r-old.json');
    });

    it('retention_days <= 0 disables pruning (no removals)', () => {
        const tsRoot = mkTmp();
        const pyRoot = mkTmp();
        const disabled: PruneSpec = { ...PRUNE_SPEC, retentionDays: 0 };
        seedPruneFixture(tsRoot, disabled);
        seedPruneFixture(pyRoot, disabled);
        const tsRes = tsPrune(tsRoot, disabled);
        const pyRes = pyPrune(pyRoot, disabled);
        expect(tsRes.removed).toEqual([]);
        expect(pyRes.removed).toEqual([]);
        expect(tsRes.survivors).toEqual(pyRes.survivors);
    });
});

// ── Unit-level behaviour (no python3 needed) ────────────────────────────────

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
