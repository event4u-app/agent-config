// road-to-tells-a-near-miss-can-refute 5.3: a rewrite that moves a fact is a
// hard finding; a pure reword is clean.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { diffFacts } from '../../src/scripts/_lib/fact_diff.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BEFORE =
    'On March 3, 2026 the Payments Team cut checkout latency from 2.1 seconds to 310 ms, ' +
    'saving $12,400 a month. Details: https://example.com/postmortem and `retry_budget`.';

describe('diffFacts', () => {
    it('a pure reword is clean', () => {
        const after =
            'Checkout latency fell from 2.1 seconds to 310 ms on March 3, 2026, when the Payments Team ' +
            'shipped the change; it saves $12,400 a month. See https://example.com/postmortem and `retry_budget`.';
        expect(diffFacts(BEFORE, after)).toEqual({ lost: [], added: [] });
    });

    it('a dropped number is lost', () => {
        const after = BEFORE.replace(' from 2.1 seconds', '');
        expect(diffFacts(BEFORE, after).lost).toEqual([{ kind: 'number', value: '2.1' }]);
    });

    it('a changed date is lost and added', () => {
        const d = diffFacts(BEFORE, BEFORE.replace('March 3', 'March 5'));
        expect(d.lost).toEqual([{ kind: 'date', value: 'March 3, 2026' }]);
        expect(d.added).toEqual([{ kind: 'date', value: 'March 5, 2026' }]);
    });

    it('an added name is added', () => {
        const d = diffFacts(BEFORE, `${BEFORE} Jane Doe signed it off.`);
        expect(d.added).toEqual([{ kind: 'name', value: 'Jane Doe' }]);
        expect(d.lost).toEqual([]);
    });

    it('a moved currency amount is caught', () => {
        expect(diffFacts(BEFORE, BEFORE.replace('$12,400', '$14,200')).lost).toEqual([{ kind: 'currency', value: '$12,400' }]);
    });
});

describe('detect_ai_tells --baseline', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fact-diff-'));
    const run = (after: string) => {
        fs.writeFileSync(path.join(dir, 'before.md'), BEFORE);
        fs.writeFileSync(path.join(dir, 'after.md'), after);
        return spawnSync('npx', ['tsx', path.join(REPO, 'src/scripts/detect_ai_tells.ts'), '--baseline', path.join(dir, 'before.md'), path.join(dir, 'after.md')], {
            encoding: 'utf8',
            cwd: REPO,
        });
    };

    it('exits 1 and names the moved fact', () => {
        const r = run(BEFORE.replace('310 ms', '300 ms'));
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('lost number 310');
        expect(r.stdout).toContain('added number 300');
    }, 60_000);

    it('exits 0 on an unchanged fact set', () => {
        expect(run(BEFORE).status).toBe(0);
    }, 60_000);
});
