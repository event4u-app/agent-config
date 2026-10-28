import fs from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { readSystems } from '../../src/scripts/code_graph/lanes/systems/index.js';
import { phpClassRefs, readComposerAutoload } from '../../src/scripts/code_graph/lanes/systems/php_autoload.js';
import { writeAuditPhpFixture } from './code_graph/audit_fixture.js';

const roots: string[] = [];
afterAll(() => {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

async function systems(withVendor: boolean) {
    const root = writeAuditPhpFixture({ withVendor });
    roots.push(root);
    const { graph } = await buildFromRepo(root, null, { lanes: false });
    const out = readSystems(root, { graph });
    const pkg = (name: string) => out.facts.find((f) => f.kind === 'package' && f.attrs['name'] === name);
    return { root, out, pkg };
}

describe('PHP use statements read as data (6.1, H10)', () => {
    it('resolves aliases, root-namespace names and fully qualified references', () => {
        const refs = phpClassRefs("<?php\nnamespace App;\nuse Dompdf;\nuse Acme\\Legacy\\Thing as T;\nuse Foo\\{Bar, Baz as Q};\n$x = new \\Parsedown();\n$y = \\Carbon\\Carbon::now();\n");
        expect(refs.map((r) => r.name)).toEqual(['Dompdf', 'Acme\\Legacy\\Thing', 'Foo\\Bar', 'Foo\\Baz', 'Parsedown', 'Carbon\\Carbon']);
    });

    it('maps classmap and PSR-4 entries to packages by install path', () => {
        const root = writeAuditPhpFixture();
        roots.push(root);
        const a = readComposerAutoload(root)!;
        expect(a.state).toBe('complete');
        expect(a.classOwner.get('Dompdf')).toBe('dompdf/dompdf');
        expect(a.classOwner.get('Parsedown')).toBe('erusev/parsedown');
        expect(a.namespaces.find(([ns]) => ns === 'Acme\\Legacy\\')?.[1]).toBe('acme/legacy');
        expect(a.namespaces.some(([ns]) => ns === 'App\\')).toBe(false);
    });
});

describe('offline PHP binding in the systems lane (6.1, H10)', () => {
    it('binds a classmap-only package, a root-namespace use and an aliased PSR-4 use', async () => {
        const { pkg } = await systems(true);
        for (const name of ['dompdf/dompdf', 'erusev/parsedown', 'acme/legacy']) {
            expect(pkg(name)?.attrs['used_by'], name).toBeGreaterThan(0);
            expect(pkg(name)?.attrs['unused'], name).toBeUndefined();
        }
        expect(pkg('acme/unused')?.attrs['unused']).toBe(true);
        expect(pkg('dompdf/dompdf')?.attrs['binding']).toBe('complete');
    }, 120_000);

    it('falls back to the lockfile PSR maps without vendor/ and says the binding is partial', async () => {
        const { out, pkg } = await systems(false);
        expect(pkg('acme/legacy')?.attrs['used_by']).toBeGreaterThan(0);
        expect(pkg('dompdf/dompdf')?.attrs['binding']).toBe('partial');
        expect(out.skipped.some((s) => /binding partial/.test(s.reason))).toBe(true);
    }, 120_000);
});
