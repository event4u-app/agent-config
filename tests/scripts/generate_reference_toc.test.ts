import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MIN_LINES, main, withToc } from '../../src/scripts/generate_reference_toc.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'reftoc-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function longReference(headings: readonly string[]): string {
    const lines = ['# Title', '', 'Intro paragraph.', ''];
    for (const h of headings) {
        lines.push(`## ${h}`, '');
        for (let i = 0; i < Math.ceil(MIN_LINES / headings.length); i++) lines.push(`line ${i}`);
        lines.push('');
    }
    return lines.join('\n');
}

function write(rel: string, body: string): string {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

function quiet<T>(fn: () => T): T {
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (): boolean => true;
    try {
        return fn();
    } finally {
        process.stdout.write = orig;
    }
}

describe('generate_reference_toc', () => {
    it('toc-in-first-30-lines lists every H2 with a GitHub anchor', () => {
        const out = withToc(longReference(['First `step`', 'Second: the rest', 'First step']));
        const head = out.split('\n').slice(0, 30).join('\n');
        expect(head).toContain('[First step](#first-step)');
        expect(head).toContain('[Second: the rest](#second-the-rest)');
        expect(head).toContain('[First step](#first-step-1)');
    });

    it('is idempotent and ignores headings inside a fence', () => {
        const src = longReference(['A']) + '\n```md\n## Not a heading\n```\n';
        const once = withToc(src);
        expect(withToc(once)).toBe(once);
        expect(once).not.toContain('#not-a-heading');
    });

    it('leaves a short file untouched', () => {
        const short = '# T\n\n## A\n\ntext\n';
        expect(withToc(short)).toBe(short);
    });

    it('check-reports-drift exits 0 (warn-only) and names the file; write mode fixes it', () => {
        const file = write('src/skills/x/references/long.md', longReference(['One', 'Two']));
        const lines: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as { write: unknown }).write = (s: string): boolean => {
            lines.push(String(s));
            return true;
        };
        let rc: number;
        try {
            rc = main(['--check'], root);
        } finally {
            process.stdout.write = orig;
        }
        expect(rc).toBe(0);
        expect(lines.join('')).toContain('src/skills/x/references/long.md');
        expect(quiet(() => main([], root))).toBe(0);
        expect(fs.readFileSync(file, 'utf-8')).toContain('[Two](#two)');
        const after: string[] = [];
        (process.stdout as { write: unknown }).write = (s: string): boolean => {
            after.push(String(s));
            return true;
        };
        try {
            main(['--check'], root);
        } finally {
            process.stdout.write = orig;
        }
        expect(after.join('')).not.toContain('long.md');
    });
});
