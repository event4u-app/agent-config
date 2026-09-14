import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    checkFile,
    declaresProducer,
    endsInClosure,
    listCommands,
} from '../../src/scripts/lint_roadmap_producers.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PRODUCER = '---\nname: x\nproduces_roadmap: true\n---\n\nRun `/challenge-me closure`.\n';
const NO_CLOSURE = '---\nname: x\nproduces_roadmap: true\n---\n\nHand the plan back.\n';

describe('lint_roadmap_producers — the declaration', () => {
    it('reads `produces_roadmap: true` only from the frontmatter', () => {
        expect(declaresProducer(PRODUCER)).toBe(true);
        // The same words in the BODY are prose about the key, not a declaration.
        expect(declaresProducer('---\nname: x\n---\n\nproduces_roadmap: true\n')).toBe(false);
    });

    it('a command without the key is not judged at all', () => {
        expect(checkFile('c.md', '---\nname: x\n---\n\nHand the plan back.\n')).toEqual([]);
    });
});

describe('lint_roadmap_producers — ending in closure', () => {
    it.each(['/challenge-me closure', 'meta/challenge-me/closure/command.md', 'closure_scan'])(
        'accepts the reference %s',
        (ref) => {
            expect(endsInClosure(`body\n${ref}\n`)).toBe(true);
        },
    );

    it('reds a declared producer that does not reference the pass', () => {
        const v = checkFile('c.md', NO_CLOSURE);
        expect(v).toHaveLength(1);
        expect(v[0]?.reason).toMatch(/does not end in the closure pass/);
    });

    it('the word "closure" alone is not a reference', () => {
        // A prose mention must not discharge the obligation — that is how a
        // reference gate silently becomes a keyword gate.
        expect(endsInClosure('We will think about closure later.\n')).toBe(false);
    });
});

describe('lint_roadmap_producers — the live tree', () => {
    const files = listCommands(path.join(REPO, 'src', 'domains'));
    const producers = files.filter((f) => declaresProducer(fs.readFileSync(f, 'utf-8')));

    it('finds the declared roadmap producers', () => {
        // The Linear derivation the plan also named does not exist as a command
        // in this tree, so the producer set is eight, not nine.
        expect(producers.length).toBe(8);
    });

    it('every declared producer ends in closure', () => {
        const bad = producers.flatMap((f) =>
            checkFile(path.relative(REPO, f), fs.readFileSync(f, 'utf-8')),
        );
        expect(bad).toEqual([]);
    });

    it('the producer set covers the named entrances', () => {
        const rel = producers.map((f) => path.relative(REPO, f));
        for (const name of [
            'roadmap/create',
            'roadmap/materialize',
            'feature/plan',
            'feature/roadmap',
            'implement-ticket',
            'jira-ticket',
            'analyze/inbox',
            'analyze/roadmap-repos',
        ]) {
            expect(rel.some((r) => r.includes(name))).toBe(true);
        }
    });
});
