// Tests for src/scripts/check_source_pointer_freshness.ts — the deterministic
// backstop for the doc-follows-code discipline (downstream-changes § Doc-Impact).
//
// Three layers:
//   1. Pure matcher — the retired-pointer regex + historical-marker suppression.
//   2. _scanFile against real temp fixtures written under the repo root (the
//      gate's actual file-scan path): a stale fixture must produce a hit, a
//      clean one must not, a marked-historical one must not.
//   3. CLI --selftest via spawn — exit 0, mirroring the in-script self-check.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    _scanFile,
    _selftest,
    HISTORICAL_MARKER,
    RETIRED_POINTER,
} from '../../src/scripts/check_source_pointer_freshness.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
// A temp fixture dir UNDER the repo root, so the ROOT-relative _scanFile resolves it.
const FIX_REL = 'tests/scripts/.tmp-pointer-freshness';
const FIX_ABS = join(REPO_ROOT, FIX_REL);

beforeAll(() => {
    mkdirSync(FIX_ABS, { recursive: true });
    writeFileSync(
        join(FIX_ABS, 'stale.md'),
        'The source of truth is `.agent-src.uncondensed/`. Edit there.\nsecond clean line.\n',
    );
    writeFileSync(
        join(FIX_ABS, 'monorepo.md'),
        'See `packages/core/.agent-src.uncondensed/templates/AGENTS.md`.\n',
    );
    writeFileSync(
        join(FIX_ABS, 'clean.md'),
        'The source of truth is `src/`. Edit there, then run `task sync`.\n',
    );
    writeFileSync(
        join(FIX_ABS, 'historical.md'),
        `Retired path \`.agent-src.uncondensed/\` ${HISTORICAL_MARKER}\n`,
    );
});

afterAll(() => {
    rmSync(FIX_ABS, { recursive: true, force: true });
});

describe('RETIRED_POINTER matcher', () => {
    it('matches the bare retired token', () => {
        expect(RETIRED_POINTER.test('edit `.agent-src.uncondensed/rules/x.md`')).toBe(true);
    });
    it('matches the monorepo-prefixed form', () => {
        expect(RETIRED_POINTER.test('packages/core/.agent-src.uncondensed/templates/AGENTS.md')).toBe(true);
    });
    it('does not match the current src/ pointer', () => {
        expect(RETIRED_POINTER.test('the source of truth is `src/`')).toBe(false);
    });
});

describe('_scanFile', () => {
    it('flags a stale source-of-truth pointer', () => {
        const hits = _scanFile(`${FIX_REL}/stale.md`);
        expect(hits.length).toBe(1);
        expect(hits[0]?.line).toBe(1);
    });
    it('flags the monorepo-prefixed pointer', () => {
        expect(_scanFile(`${FIX_REL}/monorepo.md`).length).toBe(1);
    });
    it('passes a clean file', () => {
        expect(_scanFile(`${FIX_REL}/clean.md`).length).toBe(0);
    });
    it('exempts a line marked historical', () => {
        expect(_scanFile(`${FIX_REL}/historical.md`).length).toBe(0);
    });
    it('reports a missing allowlisted file as a hit', () => {
        const hits = _scanFile(`${FIX_REL}/does-not-exist.md`);
        expect(hits.length).toBe(1);
        expect(hits[0]?.line).toBe(0);
    });
});

describe('_selftest', () => {
    it('passes in-process', () => {
        expect(_selftest()).toBe(0);
    });
    it('passes via the CLI --selftest and exits 0', () => {
        const res = spawnSync(
            'npx',
            ['tsx', 'src/scripts/check_source_pointer_freshness.ts', '--selftest'],
            { cwd: REPO_ROOT, encoding: 'utf-8' },
        );
        expect(res.status).toBe(0);
    });
});
