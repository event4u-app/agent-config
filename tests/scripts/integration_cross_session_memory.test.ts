// Cross-session memory integration test (memory/knowledge validation
// Phase 0-pre) — the mechanical "second brain" proof.
//
// Each "session" is a SEPARATE subprocess with cwd = a temp project; state
// persists only via the file substrate. Deterministic end-to-end:
//   session A  — learn: memory_signal writes intake JSONL
//   gate       — check_memory_proposal passes on pattern evidence (≥2 paths)
//   promote    — curated YAML lands (the file shape /memory promote writes)
//   fold       — fold_intake over the project is a clean no-op that never
//                touches the memory tree
//   session B  — memory_lookup (fresh process) recalls the curated fact
//
// No model-in-the-loop: council 2026-07-08 — substrate validation asserts
// file-state + retrieval output only.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT } from './_wave8g.js';

const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const tmp: string[] = [];
function mkProject(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-session-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

/** One "session": run a script as its own process inside the project. */
function session(project: string, script: string, args: string[]): SpawnSyncReturns<string> {
    return spawnSync(TSX_BIN, [path.join(REPO_ROOT, 'src', 'scripts', `${script}.ts`), ...args], {
        cwd: project,
        encoding: 'utf8',
    });
}

function readIntakeLines(project: string): Array<Record<string, unknown>> {
    const dir = path.join(project, 'agents', 'memory', 'intake');
    const out: Array<Record<string, unknown>> = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'))) {
        for (const line of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
            if (line.trim()) out.push(JSON.parse(line) as Record<string, unknown>);
        }
    }
    return out;
}

function snapshotTree(root: string): Map<string, string> {
    const snap = new Map<string, string>();
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(p);
            else snap.set(path.relative(root, p), fs.readFileSync(p, 'utf-8'));
        }
    };
    if (fs.existsSync(root)) walk(root);
    return snap;
}

const FACT = 'invoice total must equal the sum of line items';

describe('cross-session memory lifecycle — learn → promote → fold → recall', () => {
    it('a fact learned in session A is recalled by a fresh session B', () => {
        const project = mkProject();

        // ---- Session A: learn (two sightings on distinct paths → pattern) ----
        const sigA = session(project, 'memory_signal', [
            '--type', 'domain-invariants',
            '--path', 'app/Billing/Invoice.php',
            '--body', FACT,
        ]);
        expect(sigA.status).toBe(0);
        const sigB = session(project, 'memory_signal', [
            '--type', 'domain-invariants',
            '--path', 'app/Billing/CreditNote.php',
            '--body', FACT,
        ]);
        expect(sigB.status).toBe(0);

        const intake = readIntakeLines(project);
        expect(intake).toHaveLength(2);
        // The signal output satisfies the promote gate's required shape.
        for (const line of intake) {
            expect(line).toMatchObject({ entry_type: 'domain-invariants', body: FACT });
            expect(typeof line.id).toBe('string');
            expect(typeof line.path).toBe('string');
        }

        // ---- Promote gate: pattern evidence (2 sibling paths) passes ----
        const gate = session(project, 'check_memory_proposal', [
            '--intake-id', String(intake[0]!.id),
            '--format', 'json',
        ]);
        expect(gate.status).toBe(0);

        // ---- Promote: curated YAML lands (the shape /memory promote writes) ----
        const curatedDir = path.join(project, 'agents', 'memory', 'domain-invariants');
        fs.mkdirSync(curatedDir, { recursive: true });
        fs.writeFileSync(
            path.join(curatedDir, 'promoted-invoice-total.yml'),
            [
                'id: di-invoice-total',
                'status: active',
                'confidence: high',
                'source: ["agents/memory/intake"]',
                'owner: maintainer',
                `last_validated: ${TODAY_ISO}`,
                'review_after_days: 180',
                `rule: "${FACT}"`,
                'feature: "billing"',
                '',
            ].join('\n'),
            'utf-8',
        );

        // ---- Fold: never touches the memory tree (signals are not fold targets) ----
        const memoryBefore = snapshotTree(path.join(project, 'agents', 'memory'));
        const fold = session(project, 'fold_intake', ['--format', 'json']);
        expect(fold.status).toBe(0);
        expect(JSON.parse(fold.stdout).folds).toHaveLength(0);
        expect(snapshotTree(path.join(project, 'agents', 'memory'))).toEqual(memoryBefore);

        // ---- Session B: fresh process recalls the curated fact ----
        const recall = session(project, 'memory_lookup', [
            '--types', 'domain-invariants',
            '--key', 'billing',
            '--format', 'json',
        ]);
        expect(recall.status).toBe(0);
        const hits = (JSON.parse(recall.stdout) as { hits: Array<Record<string, unknown>> }).hits;
        const curated = hits.filter((h) => h.source === 'curated');
        expect(curated).toHaveLength(1);
        expect(curated[0]).toMatchObject({ id: 'di-invoice-total' });
        expect(JSON.stringify(curated[0])).toContain('sum of line items');
    });

    it('an unpromoted signal still surfaces from intake — at lower confidence than curated', () => {
        const project = mkProject();
        const sig = session(project, 'memory_signal', [
            '--type', 'historical-patterns',
            '--path', 'app/Queue/Worker.php',
            '--body', 'off-by-one in retry backoff window',
        ]);
        expect(sig.status).toBe(0);

        const recall = session(project, 'memory_lookup', [
            '--types', 'historical-patterns',
            '--key', 'worker',
            '--format', 'json',
        ]);
        expect(recall.status).toBe(0);
        const hits = (JSON.parse(recall.stdout) as { hits: Array<Record<string, unknown>> }).hits;
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatchObject({ source: 'intake' });
        expect(Number(hits[0]!.score)).toBeLessThan(0.9);
    });

    it('a single one-off signal does NOT pass the promote gate (no pattern, no future_decisions)', () => {
        const project = mkProject();
        session(project, 'memory_signal', [
            '--type', 'domain-invariants',
            '--path', 'app/Only/One.php',
            '--body', 'a fact seen exactly once',
        ]);
        const [line] = readIntakeLines(project);
        const gate = session(project, 'check_memory_proposal', ['--intake-id', String(line!.id)]);
        expect(gate.status).toBe(1);
        expect(gate.stdout + gate.stderr).toContain('weak pattern evidence');
    });
});
