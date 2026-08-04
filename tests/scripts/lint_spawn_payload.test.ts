// Tests for src/scripts/lint_spawn_payload.ts (road-to-lean-agent-init Phase 3).
//
// Layer 1 drives the pure `checkPayload`/`detectTier` helpers directly.
// Layer 2 builds a synthetic repo tree (tests/fixtures + golden-transcripts)
// under a tmp dir and runs `scanRepo`/`main` against it, so no test mutates
// the real repository. Layer 3 is the roadmap's 0-false-positives acceptance:
// a smoke run of `scanRepo` against the REAL golden-transcripts dir.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkPayload, detectTier, main, scanRepo } from '../../src/scripts/lint_spawn_payload.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('lint_spawn_payload — checkPayload / detectTier', () => {
    it('flags a knowledge_refs entry containing a newline', () => {
        const parsed = { task: 'x', knowledge_refs: ['a\nb'] };
        const findings = checkPayload({ file: 'f.json', line: 1, text: JSON.stringify(parsed), parsed });
        expect(findings.some((f) => f.rule === 'inline-ref-body')).toBe(true);
    });

    it('flags a knowledge_refs entry over 200 chars', () => {
        const longRef = 'x'.repeat(201);
        const parsed = { task: 'x', knowledge_refs: [longRef] };
        const findings = checkPayload({ file: 'f.json', line: 1, text: JSON.stringify(parsed), parsed });
        expect(findings.some((f) => f.rule === 'inline-ref-body')).toBe(true);
    });

    it('does not flag a short, single-line ref', () => {
        const parsed = { task: 'x', knowledge_refs: ['docs/foo.md'] };
        const findings = checkPayload({ file: 'f.json', line: 1, text: JSON.stringify(parsed), parsed });
        expect(findings.some((f) => f.rule === 'inline-ref-body')).toBe(false);
    });

    it('flags a payload with a fenced dump of more than 40 lines', () => {
        const text = Array.from({ length: 45 }, (_, i) => `line ${i}`).join('\n');
        const findings = checkPayload({ file: 'f.md', line: 1, text, parsed: null });
        expect(findings.some((f) => f.rule === 'uncut-file-dump')).toBe(true);
    });

    it('does not flag a payload with 40 lines or fewer', () => {
        const text = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
        const findings = checkPayload({ file: 'f.md', line: 1, text, parsed: null });
        expect(findings.some((f) => f.rule === 'uncut-file-dump')).toBe(false);
    });

    it('flags a payload over the lite cap when tier=lite', () => {
        const parsed = { task: 'x', tier: 'lite', knowledge_refs: [] };
        const text = JSON.stringify(parsed) + 'x'.repeat(9_000);
        const findings = checkPayload({ file: 'f.json', line: 1, text, parsed });
        expect(findings.some((f) => f.rule === 'over-cap')).toBe(true);
    });

    it('does not flag a payload under its tier cap', () => {
        const parsed = { task: 'x', tier: 'high', knowledge_refs: [] };
        const text = JSON.stringify(parsed);
        const findings = checkPayload({ file: 'f.json', line: 1, text, parsed });
        expect(findings.some((f) => f.rule === 'over-cap')).toBe(false);
    });

    it('a clean payload (short refs, short body, under cap) passes with no findings', () => {
        const parsed = { task: 'refactor the billing module', tier: 'medium', knowledge_refs: ['docs/billing.md', 'src/billing/Service.ts'] };
        const findings = checkPayload({ file: 'f.json', line: 1, text: JSON.stringify(parsed, null, 2), parsed });
        expect(findings).toEqual([]);
    });

    it('detectTier reads the tier field from parsed JSON', () => {
        expect(detectTier('{}', { tier: 'lite' })).toBe('lite');
    });

    it('detectTier falls back to a `tier: x` mention in raw text', () => {
        expect(detectTier('spawn brief, tier: medium, task: foo', null)).toBe('medium');
    });

    it('detectTier defaults to high (never guess down) when tier is absent', () => {
        expect(detectTier('no tier info here', null)).toBe('high');
    });
});

describe('lint_spawn_payload — scanRepo / main over a synthetic tree', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-spawn-payload-'));
        fs.mkdirSync(path.join(tmp, 'tests', 'fixtures'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'tests', 'reasoning-layer-eval', 'golden-transcripts'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('finds a violation in a matching *spawn*.json fixture', () => {
        fs.writeFileSync(
            path.join(tmp, 'tests', 'fixtures', 'worker-spawn-brief.json'),
            JSON.stringify({ task: 'x', tier: 'lite', knowledge_refs: ['a\nb'] }),
        );
        const findings = scanRepo(tmp);
        expect(findings.some((f) => f.rule === 'inline-ref-body')).toBe(true);
    });

    it('ignores a JSON fixture whose name does not mention spawn', () => {
        fs.writeFileSync(
            path.join(tmp, 'tests', 'fixtures', 'unrelated.json'),
            JSON.stringify({ task: 'x', knowledge_refs: ['a\nb'] }),
        );
        expect(scanRepo(tmp)).toEqual([]);
    });

    it('finds a violation in a golden-transcript fenced JSON spawn payload', () => {
        const body = [
            '# Transcript',
            '',
            'The orchestrator decides to spawn a subagent with this task brief:',
            '',
            '```json',
            JSON.stringify({ task: 'refactor billing', knowledge_refs: ['x'.repeat(250)] }),
            '```',
            '',
        ].join('\n');
        fs.writeFileSync(path.join(tmp, 'tests', 'reasoning-layer-eval', 'golden-transcripts', 't1.md'), body);
        const findings = scanRepo(tmp);
        expect(findings.some((f) => f.rule === 'inline-ref-body')).toBe(true);
    });

    it('ignores a fenced JSON block with no spawn context and no task/knowledge_refs keys', () => {
        const body = ['# Transcript', '', '```json', JSON.stringify({ unrelated: 'x'.repeat(300) }), '```', ''].join('\n');
        fs.writeFileSync(path.join(tmp, 'tests', 'reasoning-layer-eval', 'golden-transcripts', 't2.md'), body);
        expect(scanRepo(tmp)).toEqual([]);
    });

    it('main() returns 0 by default even with findings (warn-only)', () => {
        fs.writeFileSync(
            path.join(tmp, 'tests', 'fixtures', 'x-spawn.json'),
            JSON.stringify({ task: 'x', tier: 'lite', knowledge_refs: ['a\nb'] }),
        );
        expect(main(['--quiet'], tmp)).toBe(0);
    });

    it('main(["--strict"]) returns 2 when findings are present', () => {
        fs.writeFileSync(
            path.join(tmp, 'tests', 'fixtures', 'x-spawn.json'),
            JSON.stringify({ task: 'x', tier: 'lite', knowledge_refs: ['a\nb'] }),
        );
        expect(main(['--strict', '--quiet'], tmp)).toBe(2);
    });

    it('main() returns 0 on a clean tree', () => {
        // One in-scope file so "clean" means "read something and found
        // nothing" — an empty tree is a dead scope, asserted below.
        fs.writeFileSync(path.join(tmp, 'tests', 'fixtures', 'unrelated.json'), '{}');
        expect(main(['--quiet'], tmp)).toBe(0);
    });

    it('main() fails on a tree with nothing to scan', () => {
        expect(main(['--quiet'], tmp)).toBe(2);
    });
});

describe('lint_spawn_payload — 0-false-positives acceptance (real repo)', () => {
    it('scanRepo over the real repo tree finds zero spawn-payload violations today', () => {
        const findings = scanRepo(REPO_ROOT);
        expect(findings).toEqual([]);
    });

    it('main() over the real repo tree exits 0', () => {
        expect(main(['--quiet'], REPO_ROOT)).toBe(0);
    });
});
