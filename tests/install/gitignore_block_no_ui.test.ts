// The managed `.gitignore` block on the headless install path
// (`road-to-a-rule-carrier-that-works-outside-the-repo` step 1.7).
//
// The block is normally installed by `refresh --project` / `sync:gitignore`,
// which the browser wizard reaches. A `--no-ui` install reaches neither, so a
// headless consumer got a package that writes dispatcher state under `agents/`
// beside a `.gitignore` that says nothing about it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { _write_gitignore_block } from '../../src/scripts/install.js';
import { SECTION_HEADER, template_entries, load_template, DEFAULT_TEMPLATE } from '../../src/scripts/_lib/gitignore_block.js';

const made: string[] = [];

function project(contents?: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-no-ui-'));
    made.push(root);
    fs.mkdirSync(path.join(root, '.git'));
    if (contents !== undefined) fs.writeFileSync(path.join(root, '.gitignore'), contents, 'utf-8');
    return root;
}

function read(root: string): string {
    return fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
}

afterEach(() => {
    while (made.length > 0) {
        const d = made.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('_write_gitignore_block — the headless install path', () => {
    it('writes the managed block into a project that has none', () => {
        const root = project('node_modules/\n');
        expect(_write_gitignore_block(root, false)).toBe(true);
        const text = read(root);
        expect(text).toContain(SECTION_HEADER);
        // The entry class the step exists for: dispatcher state under agents/.
        expect(text).toContain('/agents/runtime/');
        // And nothing the consumer already had is lost.
        expect(text).toContain('node_modules/');
    });

    it('is idempotent — a second call changes nothing and says so', () => {
        const root = project('');
        expect(_write_gitignore_block(root, false)).toBe(true);
        const first = read(root);
        expect(_write_gitignore_block(root, false)).toBe(false);
        expect(read(root)).toBe(first);
    });

    it('APPENDS the missing managed entries and keeps a consumer line inside the block', () => {
        // Append-only, never `replace`: a line a developer put inside the block
        // is theirs, and an installer that rewrote the block would eat it.
        const entries = template_entries(load_template(DEFAULT_TEMPLATE));
        const root = project(`${SECTION_HEADER}\n${entries[0] as string}\n/my-own-thing\n`);
        expect(_write_gitignore_block(root, false)).toBe(true);
        const text = read(root);
        expect(text).toContain('/my-own-thing');
        for (const e of entries) expect(text).toContain(e);
    });

    it('a dry run writes nothing', () => {
        const root = project('node_modules/\n');
        expect(_write_gitignore_block(root, true)).toBe(true);
        expect(read(root)).toBe('node_modules/\n');
    });

    it('a directory that is not a repository and has no .gitignore is left alone', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-no-repo-'));
        made.push(root);
        expect(_write_gitignore_block(root, false)).toBe(false);
        expect(fs.existsSync(path.join(root, '.gitignore'))).toBe(false);
    });
});
