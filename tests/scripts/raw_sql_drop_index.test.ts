/** R-A6(c'): DROP INDEX without CONCURRENTLY is advice on postgres and on an unknown dialect; the concurrent and MySQL forms stay silent. */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { scan_dir } from '../../src/scripts/_lib/persistence/adapter_raw_sql.js';

const tmp: string[] = [];
afterAll(() => {
    for (const d of tmp) fs.rmSync(d, { recursive: true, force: true });
});

function sql(text: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsdi-'));
    tmp.push(dir);
    fs.writeFileSync(path.join(dir, '001.sql'), text);
    return dir;
}

const dropIndex = (dir: string) => scan_dir(dir).findings.filter((f) => /DROP INDEX/.test(f.message));

describe('DROP INDEX on postgres', () => {
    it('fires as advice without CONCURRENTLY', () => {
        const f = dropIndex(sql('CREATE INDEX CONCURRENTLY a_idx ON a (x);\nDROP INDEX b_idx;\n'));
        expect(f).toHaveLength(1);
        expect(f[0]!.tier).toBe('advice');
        expect(f[0]!.line).toBe(2);
    });

    it('stays silent on DROP INDEX CONCURRENTLY', () => {
        expect(dropIndex(sql('CREATE INDEX CONCURRENTLY a_idx ON a (x);\nDROP INDEX CONCURRENTLY b_idx;\n'))).toEqual([]);
    });

    it('stays silent on the MySQL form, which names its table', () => {
        expect(dropIndex(sql('DROP INDEX b_idx ON a;\n'))).toEqual([]);
    });

    it('fires as dialect-unknown advice when nothing marks the file as postgres', () => {
        const f = dropIndex(sql('DROP INDEX b_idx;\n'));
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toMatch(/dialect unknown/);
    });
});
