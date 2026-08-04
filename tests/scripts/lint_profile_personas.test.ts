// Tests for src/scripts/lint_profile_personas.ts (profile → persona join gate).
//
// Two layers:
//   1. The real tree passes — every defaults.personas id in the seed profiles
//      resolves to a persona file (run against the repo root resolved from
//      this file's location, never process.cwd()).
//   2. Synthetic trees in os.tmpdir() exercise the rule in both directions
//      (bogus id → finding with nearest-match hint; empty list → clean).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    known_persona_ids,
    nearest_match,
    scan_profiles,
} from '../../src/scripts/lint_profile_personas.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the real tree', () => {
    it('has zero findings and scans all seed profiles', () => {
        const { findings, scanned } = scan_profiles(REPO_ROOT);
        expect(findings).toEqual([]);
        // gate-coverage floor is 5; 6 seed profiles at baseline.
        expect(scanned).toBeGreaterThanOrEqual(5);
    });

    it('knows the seed persona ids, including advisors', () => {
        const known = known_persona_ids(REPO_ROOT);
        expect(known.has('qa')).toBe(true);
        expect(known.has('security-engineer')).toBe(true);
        expect(known.has('contrarian')).toBe(true); // advisors/
        expect(known.has('README')).toBe(false);
    });
});

describe('synthetic trees (tmp dir — never a tracked path)', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lpp-'));
        fs.mkdirSync(path.join(tmp, 'src', 'agent-src', 'profiles'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'src', 'agent-src', 'personas', 'advisors'), {
            recursive: true,
        });
        fs.writeFileSync(path.join(tmp, 'src', 'agent-src', 'personas', 'qa.md'), '# QA\n');
        fs.writeFileSync(
            path.join(tmp, 'src', 'agent-src', 'personas', 'advisors', 'contrarian.md'),
            '# Contrarian\n',
        );
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const write_profile = (name: string, personas: string): void => {
        fs.writeFileSync(
            path.join(tmp, 'src', 'agent-src', 'profiles', name),
            `profile:\n  id: ${name.replace('.yml', '')}\n  defaults:\n    personas:${personas}\n`,
        );
    };

    it('flags a bogus persona id with a nearest-match hint', () => {
        write_profile('dev.yml', '\n      - qs\n      - qa');
        const { findings, scanned } = scan_profiles(tmp);
        expect(scanned).toBe(1);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.id).toBe('qs');
        expect(findings[0]!.file).toBe(path.join('src', 'agent-src', 'profiles', 'dev.yml'));
        expect(findings[0]!.hint).toContain('qa');
    });

    it('resolves advisor ids', () => {
        write_profile('adv.yml', '\n      - contrarian');
        const { findings } = scan_profiles(tmp);
        expect(findings).toEqual([]);
    });

    it('empty defaults.personas produces no finding', () => {
        write_profile('empty.yml', ' []');
        const { findings, scanned } = scan_profiles(tmp);
        expect(scanned).toBe(1);
        expect(findings).toEqual([]);
    });

    it('a profile without a personas key produces no finding', () => {
        fs.writeFileSync(
            path.join(tmp, 'src', 'agent-src', 'profiles', 'bare.yml'),
            'profile:\n  id: bare\n',
        );
        const { findings, scanned } = scan_profiles(tmp);
        expect(scanned).toBe(1);
        expect(findings).toEqual([]);
    });
});

describe('nearest_match', () => {
    it('prefers containment, then edit distance', () => {
        const known = new Set(['security-engineer', 'qa', 'tech-writer']);
        expect(nearest_match('security', known)).toBe('security-engineer');
        expect(nearest_match('qs', known)).toBe('qa');
    });
});
