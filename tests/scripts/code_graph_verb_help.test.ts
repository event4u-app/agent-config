import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const tsx = path.resolve('node_modules/.bin/tsx');
const cli = path.resolve('src/scripts/code_graph/cli.ts');

describe('code-graph <verb> --help', () => {
    for (const verb of ['map', 'build', 'refresh']) {
        it(`${verb} --help prints help and writes nothing`, () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-help-'));
            execFileSync('git', ['init', '-q'], { cwd: dir });
            const before = fs.readdirSync(dir).sort();
            const out = execFileSync(tsx, [cli, verb, '--help'], { cwd: dir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
            expect(out).toMatch(/^ {2}map +\S/m);
            expect(fs.readdirSync(dir).sort()).toEqual(before);
        }, 60_000);
    }
});
