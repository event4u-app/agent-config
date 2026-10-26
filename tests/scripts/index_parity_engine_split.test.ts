/**
 * The S0.2 index-parity oracle, run once per engine. Its fixture states no
 * engine, so a constrained foreign key counts as indexed there — on postgres it
 * is not, on MySQL it is. The three outcomes are pinned on one schema so the
 * oracle cannot certify the engine assumption silently again.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { analyze } from '../../src/scripts/_lib/persistence/detect_index_parity.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORACLE = path.resolve(HERE, '..', 'fixtures', 'persistence', 'index_parity', 'eloquent');
const tmp: string[] = [];

function withEngine(driver: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ip-engine-'));
    tmp.push(dir);
    fs.cpSync(ORACLE, dir, { recursive: true });
    if (driver !== null) {
        fs.mkdirSync(path.join(dir, 'config'));
        fs.writeFileSync(
            path.join(dir, 'config', 'database.php'),
            `<?php\nreturn ['default' => env('DB_CONNECTION', '${driver}'), 'connections' => ['${driver}' => ['driver' => '${driver}']]];\n`,
        );
    }
    return dir;
}

const fkFindings = (dir: string): number =>
    analyze(dir).findings.filter((f) => !f.waived && /posts\.user_id/.test(f.message)).length;

afterAll(() => {
    for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
});

describe('S0.2 oracle per engine', () => {
    it('postgres: the constrained FK has no index, so the query on it is a finding', () => {
        const dir = withEngine('pgsql');
        expect(fkFindings(dir)).toBeGreaterThan(0);
        expect(analyze(dir).engine_unverified).toBe(0);
        expect(analyze(dir).engines['default']).toBe('pgsql');
    });

    it('mysql: InnoDB indexes the constrained FK, so there is no finding', () => {
        const dir = withEngine('mysql');
        expect(fkFindings(dir)).toBe(0);
        expect(analyze(dir).engine_unverified).toBe(0);
    });

    it('unstated engine: no finding, but every such reference is counted', () => {
        const dir = withEngine(null);
        const open = (d: string) => analyze(d).findings.filter((f) => !f.waived).map((f) => `${f.file}:${f.line}`);
        const mysql = new Set(open(withEngine('mysql')));
        const onlyOnPostgres = open(withEngine('pgsql')).filter((k) => !mysql.has(k));
        expect(fkFindings(dir)).toBe(0);
        expect(onlyOnPostgres.length).toBeGreaterThan(0);
        expect(analyze(dir).engine_unverified).toBe(onlyOnPostgres.length);
        expect(analyze(dir).engines['default']).toBe('unknown');
    });
});
