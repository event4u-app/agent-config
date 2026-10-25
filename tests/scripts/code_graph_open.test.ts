import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openMap } from '../../src/scripts/code_graph/cli.js';
import { graphHome } from '../../src/scripts/code_graph/graph_home.js';

// `code-graph open` shows the map that is already drawn; it never redraws one.

let root: string;
beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-open-')));
    fs.mkdirSync(path.join(root, 'agents'));
});
afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
});

describe('code-graph open', () => {
    it('opens the drawn map where `map` writes it', async () => {
        const page = path.join(graphHome(root).mapDir, 'index.html');
        fs.mkdirSync(path.dirname(page), { recursive: true });
        fs.writeFileSync(page, '<!doctype html>');
        const opened: string[] = [];
        const rc = await openMap(['--root', root], async (p) => { opened.push(p); });
        expect(rc).toBe(0);
        expect(opened).toEqual([page]);
    });

    it('honours --out like `map` does', async () => {
        const out = path.join(root, 'elsewhere');
        fs.mkdirSync(out);
        fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html>');
        const opened: string[] = [];
        expect(await openMap(['--root', root, '--out', out], async (p) => { opened.push(p); })).toBe(0);
        expect(opened).toEqual([path.join(out, 'index.html')]);
    });

    it('without a drawn map: opens nothing, says how to draw one, exits 1', async () => {
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const opened: string[] = [];
        expect(await openMap(['--root', root], async (p) => { opened.push(p); })).toBe(1);
        expect(opened).toEqual([]);
        expect(err.mock.calls.map((c) => String(c[0])).join('')).toContain('agent-config code-graph map');
    });
});
