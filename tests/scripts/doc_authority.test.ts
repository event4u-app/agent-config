// road-to-tells-a-near-miss-can-refute 6.3: the register DESIGN.md / PRODUCT.md
// declare reaches the authority resolver and the T7 gate; an undeclared one
// does not.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { declaredRegister, readDocAuthority } from '../../src/scripts/_lib/doc_authority.js';
import { authoritySignals } from '../../src/scripts/_lib/design_sync_reconcile.js';
import { resolveUiAuthority } from '../../src/scripts/_lib/ui_authority.js';
import { contextFromText, scanFile } from '../../src/scripts/lint_design_slop.js';

const INTER = 'body { font-family: Inter, sans-serif; }';
const t7 = (designMd: string) => scanFile(INTER, 'app.css', contextFromText(designMd)).filter((f) => f.rule === 'slop-t7-default-fonts');

describe('declaredRegister', () => {
    it.each([
        ['---\nregister: product\n---\n# Design', 'product'],
        ['# Design\n\n## Register\n\nbrand — the impression is the product', 'brand'],
        ['# Design\n\nThis is a product register kind of app.', undefined],
        ['', undefined],
    ])('%j → %s', (text, want) => {
        expect(declaredRegister(text)).toBe(want);
    });
});

describe('T7 consumes the declared register', () => {
    it('a DESIGN.md declaring register: product lifts T7 on Inter', () => {
        expect(t7('---\nregister: product\n---\n')).toEqual([]);
    });

    it('an undeclared one does not', () => {
        expect(t7('# Design\n\nWe build a product.')).toHaveLength(1);
    });

    it('a declared brand register does not either', () => {
        expect(t7('## Register\n\nbrand')).toHaveLength(1);
    });
});

describe('the producer reaches resolveUiAuthority', () => {
    it('readDocAuthority → authoritySignals → register from design-md', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-authority-'));
        fs.writeFileSync(path.join(root, 'DESIGN.md'), '## Register\n\nbrand\n');
        const docs = readDocAuthority(root);
        expect(docs).toEqual({ design_md: { present: true, register: 'brand' }, product_md: { present: false } });
        const a = resolveUiAuthority(
            authoritySignals({
                referenceMaturity: 'finished-comp',
                incumbent: { coherent: false },
                locks: { palette: false, type_family: false },
                dispositions: {},
                tiers: [],
                owner: 'fe-design',
                docs,
            }),
        );
        expect(a.register).toBe('brand');
    });
});
