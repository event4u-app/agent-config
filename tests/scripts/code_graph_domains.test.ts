import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { domainResolver } from '../../src/scripts/code_graph/domains.js';
import { buildMap } from '../../src/scripts/code_graph/map.js';
import type { MapModel } from '../../src/scripts/code_graph/map_model.js';

let root: string;
let model: MapModel;

const w = (rel: string, body: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
};
const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: root, stdio: 'ignore', env: { ...process.env, GIT_AUTHOR_NAME: 'Dev', GIT_AUTHOR_EMAIL: 'd@example.com', GIT_COMMITTER_NAME: 'Dev', GIT_COMMITTER_EMAIL: 'd@example.com' } });
};

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-domains-')));
    git('init', '-q', '-b', 'main');
    w('package.json', JSON.stringify({ name: 'shop', dependencies: { express: '^4.0.0' } }));
    w('src/Domains/Billing/invoice.js', 'export function listInvoices(req, res) { res.send([]); }\nexport function total() { return 1; }\n');
    w('src/Domains/Billing/tax.js', "import { total } from './invoice.js';\nexport const tax = () => total();\n");
    w('src/Domains/Shared/util.js', 'export const id = (x) => x;\n');
    w('src/Domains/Shared/more.js', "import { id } from './util.js';\nexport const two = () => id(2);\n");
    w('src/app.js', "import express from 'express';\nimport { listInvoices } from './Domains/Billing/invoice.js';\nconst app = express();\napp.get('/invoices', listInvoices);\nexport default app;\n");
    git('add', '.');
    git('commit', '-qm', 'BIL-7 billing (#3)');
    w('src/Domains/Orders/order.js', 'export const order = () => 1;\n');
    git('add', '.');
    git('commit', '-qm', 'orders (#4)');
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    model = (await buildMap(root, {})).model;
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('domains complete (7.1, H12)', () => {
    it('gives a route its handler’s domain', () => {
        expect(model.domains?.routes?.['GET /invoices']).toBe('Billing');
    });

    it('gives a ticket the domains its commits touched', () => {
        expect(model.domains?.tickets?.['BIL-7']).toEqual(['Billing']);
    });

    it('the pack resolver uses the map’s filters: no NOT_A_DOMAIN name, only a domain the map lists', () => {
        const resolve = domainResolver(path.join(root, 'agents', 'map'))!;
        expect(resolve('src/Domains/Billing/invoice.js')).toBe('Billing');
        expect(resolve('src/Domains/Shared/util.js')).toBeNull();
        expect(resolve('src/Domains/Ghost/x.js')).toBeNull();
    });
});
