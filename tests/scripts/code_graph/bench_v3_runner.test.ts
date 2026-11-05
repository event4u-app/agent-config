import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readForeignGraph } from '../../../internal/bench/code-graph/foreign_reader.js';
import {
    type ArmAnswer,
    absentAnswer,
    checkRegisteredHashes,
    classSummary,
    grepArgsFor,
    parseRegisteredHashes,
    scoreAnswer,
    truthOf,
    verbFor,
    verifySubjectPin,
} from '../../../internal/bench/code-graph/run_bench_v3.js';

const tmpDirs: string[] = [];
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-v3-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

function registration(entries: Array<[string, string]>): string {
    return ['# reg', '', '## Hashes', '', '```', ...entries.map(([h, p]) => `${h}  ${p}`), '```', ''].join('\n');
}

const answer = (files: string[]): ArmAnswer => ({ status: 'ANSWERED', files: new Set(files), confidence: new Map(), raw: [] });

describe('registered-input hash gate', () => {
    it('parses every hash line of the registration', () => {
        const reg = registration([[sha('a'), 'x/a.yaml'], [sha('b'), 'x/b.md']]);
        expect(parseRegisteredHashes(reg)).toEqual([
            { sha256: sha('a'), path: 'x/a.yaml' },
            { sha256: sha('b'), path: 'x/b.md' },
        ]);
    });

    it('passes when every registered input matches', () => {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'x'));
        fs.writeFileSync(path.join(root, 'x/a.yaml'), 'a');
        expect(checkRegisteredHashes(root, registration([[sha('a'), 'x/a.yaml']]))).toEqual([]);
    });

    it('refuses on a changed input and names the file', () => {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'x'));
        fs.writeFileSync(path.join(root, 'x/a.yaml'), 'a');
        fs.writeFileSync(path.join(root, 'x/b.md'), 'edited');
        const problems = checkRegisteredHashes(root, registration([[sha('a'), 'x/a.yaml'], [sha('b'), 'x/b.md']]));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('x/b.md');
    });

    it('refuses on a missing input and on a registration carrying no hashes', () => {
        const root = tmp();
        expect(checkRegisteredHashes(root, registration([[sha('a'), 'x/gone.yaml']]))[0]).toContain('x/gone.yaml');
        expect(checkRegisteredHashes(root, '# reg without a hash block\n')).toHaveLength(1);
    });
});

describe('subject pin gate', () => {
    function repoWithCommit(): { dir: string; head: string } {
        const dir = tmp();
        const git = (...a: string[]): string => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf-8' }).trim();
        git('init', '-q');
        fs.writeFileSync(path.join(dir, 'f.php'), '<?php\n');
        git('add', 'f.php');
        git('commit', '-q', '-m', 'one');
        return { dir, head: git('rev-parse', 'HEAD') };
    }

    it('accepts a clone at its pin', () => {
        const { dir, head } = repoWithCommit();
        expect(verifySubjectPin(dir, head)).toBeNull();
    });

    it('refuses a clone that is not at its pin, naming both commits', () => {
        const { dir, head } = repoWithCommit();
        const pin = 'f'.repeat(40);
        const err = verifySubjectPin(dir, pin);
        expect(err).not.toBeNull();
        expect(err).toContain(pin);
        expect(err).toContain(head);
    });

    it('refuses a directory that is not a clone', () => {
        expect(verifySubjectPin(path.join(tmp(), 'nope'), 'f'.repeat(40))).not.toBeNull();
    });
});

describe('truth and scoring', () => {
    it('reads pending, expected-empty and a landed truth set', () => {
        expect(truthOf({ truth: 'pending-oracle' })).toEqual({ kind: 'pending' });
        expect(truthOf({ expected: 'empty' })).toEqual({ kind: 'expected-empty' });
        expect(truthOf({ truth: [{ path: 'a.php' }, 'b.php'] })).toEqual({ kind: 'set', files: ['a.php', 'b.php'] });
    });

    it('never scores a PENDING question, but keeps the raw answer', () => {
        const s = scoreAnswer(answer(['a.php']), { kind: 'pending' });
        expect(s.status).toBe('PENDING');
        expect(s.precision).toBeNull();
        expect(s.recall).toBeNull();
        expect(s.answered).toBe(1);
    });

    it('scores a landed truth set', () => {
        const s = scoreAnswer(answer(['a.php', 'c.php']), { kind: 'set', files: ['a.php', 'b.php'] });
        expect(s.status).toBe('SCORED');
        expect(s.precision).toBe(0.5);
        expect(s.recall).toBe(0.5);
    });

    it('scores an expected-empty item as clean or not-clean, never as recall', () => {
        expect(scoreAnswer(answer([]), { kind: 'expected-empty' }).status).toBe('CLEAN');
        const dirty = scoreAnswer(answer(['x.php']), { kind: 'expected-empty' });
        expect(dirty.status).toBe('NOT-CLEAN');
        expect(dirty.recall).toBeNull();
    });
});

describe('foreign arm ABSENT', () => {
    it('is reported ABSENT, never as zero', () => {
        const s = scoreAnswer(absentAnswer(), { kind: 'set', files: ['a.php'] });
        expect(s.status).toBe('ABSENT');
        expect(s.precision).toBeNull();
        expect(s.recall).toBeNull();
        expect(s.answered).toBeNull();
    });

    it('keeps an ABSENT arm out of every class aggregate', () => {
        const absent = scoreAnswer(absentAnswer(), { kind: 'set', files: ['a.php'] });
        const sum = classSummary([absent, absent]);
        expect(sum.status).toBe('ABSENT');
        expect(sum.recall).toBeNull();
        expect(sum.precision).toBeNull();
    });

    it('reports a class whose truth is pending as PENDING, not as a number', () => {
        const pend = scoreAnswer(answer(['a.php']), { kind: 'pending' });
        const sum = classSummary([pend]);
        expect(sum.status).toBe('PENDING');
        expect(sum.recall).toBeNull();
        expect(sum.pending).toBe(1);
    });
});

describe('grep two-probe arm arguments', () => {
    it('searches every static segment of a METHOD /uri route fixed-string', () => {
        const probes = grepArgsFor({ class: 'route-trace', probe: 'POST /api/webhooks/inbound/cloudflare/{token}', probe_to: 'Thread' });
        expect(probes).toEqual([
            { fixed: true, pattern: 'api' },
            { fixed: true, pattern: 'webhooks' },
            { fixed: true, pattern: 'inbound' },
            { fixed: true, pattern: 'cloudflare' },
            { fixed: false, pattern: '\\bThread\\b' },
        ]);
    });

    it('searches a named route fixed-string as written, and a symbol on word boundaries', () => {
        expect(grepArgsFor({ class: 'route-trace', probe: 'webhook.test', probe_to: 'httpOptions' })).toEqual([
            { fixed: true, pattern: 'webhook.test' },
            { fixed: false, pattern: '\\bhttpOptions\\b' },
        ]);
        expect(grepArgsFor({ class: 'precise-semantics', probe: 'remove' })).toEqual([{ fixed: false, pattern: '\\bremove\\b' }]);
    });
});

describe('foreign graph reader', () => {
    it('maps relation and confidence names onto the engine vocabulary', () => {
        const doc = {
            nodes: [
                { id: 'n1', label: 'Svc', kind: 'class', source_file: 'app/Svc.php' },
                { id: 'n2', label: 'Ctl', kind: 'class', source_file: 'app/Ctl.php' },
                { id: 'app/Other.php', label: 'Other.php', kind: 'file', source_file: 'app/Other.php' },
            ],
            links: [
                { source: 'n2', target: 'n1', relation: 'invokes', confidence: 'extracted' },
                { source: 'n2', target: 'n1', relation: 'extends', confidence: 'Inferred' },
                { source: 'app/Other.php', target: 'n1', relation: 'requires', confidence: 'AMBIGUOUS' },
                { source: 'n2', target: 'n1', relation: 'shares_data_with', confidence: 'EXTRACTED' },
                { source: 'n2', target: 'n1', relation: 'calls', confidence: 0.93 },
            ],
        };
        const r = readForeignGraph(doc);
        expect(r).not.toBeNull();
        const g = r!.graph;
        expect(g.edges.map((e) => [e.source, e.relation, e.target, e.confidence])).toEqual([
            ['app/Ctl.php#Ctl', 'calls', 'app/Svc.php#Svc', 'EXTRACTED'],
            ['app/Ctl.php#Ctl', 'inherits', 'app/Svc.php#Svc', 'INFERRED'],
            ['app/Other.php', 'imports', 'app/Svc.php#Svc', 'AMBIGUOUS'],
            ['app/Ctl.php#Ctl', 'calls', 'app/Svc.php#Svc', 'AMBIGUOUS'],
        ]);
        expect(r!.unmapped_relations).toEqual({ shares_data_with: 1 });
        expect(r!.unmapped_confidences).toEqual({ '0.93': 1 });
        expect(g.edges.every((e) => e.provider === 'foreign')).toBe(true);
        // Only a foreign EXTRACTED edge is accepted by the engine's walks; the rest stay guesses.
        expect(g.edges.map((e) => e.resolved_via)).toEqual(['compiler-index', 'foreign', 'foreign', 'foreign']);
    });

    it('returns null for a document that is not a graph', () => {
        expect(readForeignGraph({ hello: 'world' })).toBeNull();
    });
});

describe('native verb map (registration § Arms 2)', () => {
    it('routes each class to its registered verb', () => {
        expect(verbFor({ class: 'precise-semantics' })).toBe('affected+query');
        expect(verbFor({ class: 'route-trace', probe_to: 'Email' })).toBe('path');
        expect(verbFor({ class: 'negative-control', shape: 'path', probe_to: 'X' })).toBe('path');
        expect(verbFor({ class: 'negative-control', shape: 'symbol' })).toBe('affected+query');
        expect(verbFor({ class: 'model-table' })).toBe('query');
        expect(verbFor({ class: 'tests-for' })).toBe('tests-for');
        expect(verbFor({ class: 'change-impact' })).toBe('impact');
        expect(verbFor({ class: 'change-impact-xplane' })).toBe('impact');
    });
});
