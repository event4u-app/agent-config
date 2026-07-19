// Tests for src/scripts/validate_flow_teams.ts — the flow `team:` demand-probe.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { checkFile, main } from '../../src/scripts/validate_flow_teams.js';

const tmp: string[] = [];
function write(yaml: string): string {
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'flowteam-')), 'f.yaml');
    fs.writeFileSync(p, yaml, 'utf-8');
    tmp.push(path.dirname(p));
    return p;
}
afterEach(() => { for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('validate_flow_teams — checkFile', () => {
    it('clean when a real team resolves', () => {
        const p = write('id: x\nteam:\n  personas: [production-validator, qa]\n  skills: [code-review]\n');
        expect(checkFile(p)).toEqual([]);
    });

    it('flags an unresolved persona id', () => {
        const p = write('id: x\nteam:\n  personas: [not-a-real-persona]\n');
        const v = checkFile(p);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toMatch(/persona 'not-a-real-persona' does not resolve/);
    });

    it('flags an unresolved skill slug', () => {
        const p = write('id: x\nteam:\n  skills: [not-a-real-skill]\n');
        expect(checkFile(p)[0]!.reason).toMatch(/skill 'not-a-real-skill' does not resolve/);
    });

    it('no `team:` block → nothing to check', () => {
        const p = write('id: x\ntitle: y\n');
        expect(checkFile(p)).toEqual([]);
    });
});

describe('validate_flow_teams — real repo (delivery.yaml annotated)', () => {
    it('the shipped flows pass (exit 0)', () => {
        expect(main(['--quiet'])).toBe(0);
    });
});
