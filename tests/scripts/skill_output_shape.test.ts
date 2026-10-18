import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

interface ShapeFile {
    criterion: string;
    default: string;
    first: string[];
    skills: Record<string, string>;
}

const D2 = [
    'deep-reading-analyst',
    'project-analysis-core',
    'project-analysis-hypothesis-driven',
    'project-analyzer',
    'repomix-packer',
    'universal-project-analysis',
];

function load(): ShapeFile {
    return JSON.parse(readFileSync(path.join(REPO_ROOT, 'src', 'config', 'skill-output-shape.json'), 'utf8')) as ShapeFile;
}

describe('skill-output-shape.json (road-to-skills-that-arrive-when-called 3.1)', () => {
    it('lists every authored skill exactly once — add a new skill here as report or standing', () => {
        const authored = readdirSync(path.join(REPO_ROOT, 'src', 'skills'))
            .filter((n) => existsSync(path.join(REPO_ROOT, 'src', 'skills', n, 'SKILL.md')))
            .sort();
        expect(Object.keys(load().skills).sort()).toEqual(authored);
    });

    it('puts every skill in exactly one of the two classes, and defaults to standing', () => {
        const f = load();
        for (const v of Object.values(f.skills)) expect(['report', 'standing']).toContain(v);
        expect(f.default).toBe('standing');
        expect(f.criterion.length).toBeGreaterThan(40);
    });

    it('classifies the six former `context: large` skills first, all as report', () => {
        const f = load();
        expect(f.first).toEqual(D2);
        for (const n of D2) expect(f.skills[n]).toBe('report');
    });
});
