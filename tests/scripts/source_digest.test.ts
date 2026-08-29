/**
 * Tests for `src/scripts/_lib/source_digest.ts` and the DORMANT keyed-digest
 * path in `check_no_external_sources` (`road-to-source-silence` Phase 1.1/1.2).
 *
 * ## The fixture key is not the production key and cannot become it
 *
 * Every digest below is computed with `FIXTURE_KEY`, a literal in this file.
 * The production key lives in a CI secret and a local `.env`; nothing here
 * reads it, and a digest computed with this key matches nothing computed with
 * that one — which is asserted, not assumed (`key sensitivity`).
 *
 * ## What is proven, and what is deliberately not
 *
 * Proven: the folding, the keying, the matcher, and — the load-bearing half —
 * the **no-key contract**. A missing key must never produce a silently green
 * gate; that is the specific failure the `where-the-key-lives` blocker named,
 * and every row of the mode table is asserted here including its two fatal ones.
 *
 * Not proven, because it is not built: that the cutover works end to end. The
 * digests ship empty and the plaintext gate stays in force. See the module
 * docstring of `source_digest.ts`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    candidateTokens,
    digest,
    DigestMatcher,
    digestMode,
    DIGEST_RE,
    EXIT_NO_KEY,
    KEY_ENV,
    normalise,
    STRICT_ENV,
} from '../../src/scripts/_lib/source_digest.js';
import { digestsFor } from '../../src/scripts/build_source_digests.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_external_sources.ts');

/** NOT a production key. Used only to prove the mechanism. */
const FIXTURE_KEY = 'fixture-key-not-the-production-one';
/** An invented source name. Names nothing real. */
const FIXTURE_SOURCE = 'example-owner/example-harvest-source';

describe('source_digest — folding', () => {
    it('folds every separator run to a single hyphen', () => {
        const forms = [
            'Example-Owner/Example-Harvest-Source',
            'example_owner.example_harvest_source',
            'EXAMPLE OWNER / EXAMPLE HARVEST SOURCE',
            'example--owner//example__harvest..source',
        ];
        const first = normalise(forms[0]!);
        for (const f of forms) expect(normalise(f)).toBe(first);
    });

    it('trims separator edges', () => {
        expect(normalise('--example-thing--')).toBe('example-thing');
    });
});

describe('source_digest — keying', () => {
    it('produces 64 lowercase hex characters', () => {
        expect(digest(FIXTURE_SOURCE, FIXTURE_KEY)).toMatch(DIGEST_RE);
    });

    it('is deterministic for one key', () => {
        expect(digest(FIXTURE_SOURCE, FIXTURE_KEY)).toBe(digest(FIXTURE_SOURCE, FIXTURE_KEY));
    });

    it('key sensitivity — a different key gives a different digest', () => {
        expect(digest(FIXTURE_SOURCE, FIXTURE_KEY)).not.toBe(digest(FIXTURE_SOURCE, `${FIXTURE_KEY}-other`));
    });

    it('refuses an empty key rather than producing an unsalted hash', () => {
        expect(() => digest(FIXTURE_SOURCE, '')).toThrow();
    });
});

describe('source_digest — tokenisation and matching', () => {
    it('produces the word, the slash-pair and the hyphen-pair', () => {
        const toks = candidateTokens('inspired by example-owner/example-repo here');
        expect(toks).toContain('example-owner');
        expect(toks).toContain('example-owner/example-repo');
    });

    it('matches a denied token in any punctuation form', () => {
        const m = new DigestMatcher([digest(FIXTURE_SOURCE, FIXTURE_KEY)], FIXTURE_KEY);
        expect(m.hits('we ported this from example-owner/example-harvest-source at a pin')).toHaveLength(1);
        expect(m.hits('see Example_Owner.Example_Harvest_Source for the original')).toHaveLength(1);
    });

    it('does not match an unrelated line', () => {
        const m = new DigestMatcher([digest(FIXTURE_SOURCE, FIXTURE_KEY)], FIXTURE_KEY);
        expect(m.hits('this line names nothing in the deny set')).toEqual([]);
    });

    it('does not match under the wrong key', () => {
        const m = new DigestMatcher([digest(FIXTURE_SOURCE, FIXTURE_KEY)], `${FIXTURE_KEY}-other`);
        expect(m.hits(`ported from ${FIXTURE_SOURCE}`)).toEqual([]);
    });
});

describe('source_digest — the no-key contract (Phase 1.2)', () => {
    const D = [digest(FIXTURE_SOURCE, FIXTURE_KEY)];

    it('no digests, no strict → dormant and silent (today’s shipped state)', () => {
        const v = digestMode({ digests: [], key: undefined, strict: false });
        expect(v.active).toBe(false);
        expect(v.message).toBe('');
    });

    it('no digests but strict → a message, because strict has nothing to enforce', () => {
        const v = digestMode({ digests: [], key: undefined, strict: true });
        expect(v.active).toBe(false);
        expect(v.message).not.toBe('');
    });

    it('digests present, key absent → LOUD, never silently green', () => {
        const v = digestMode({ digests: D, key: undefined, strict: false });
        expect(v.active).toBe(false);
        expect(v.keyMissing).toBe(true);
        expect(v.message).toContain('SKIPPED');
        expect(v.message).toContain(KEY_ENV);
    });

    it('digests present, key present → active, silent', () => {
        const v = digestMode({ digests: D, key: FIXTURE_KEY, strict: false });
        expect(v.active).toBe(true);
        expect(v.message).toBe('');
    });
});

describe('build_source_digests — derivation', () => {
    it('strips the regex word anchors the plaintext patterns carry', () => {
        const [a] = digestsFor(['\\bexample-thing\\b'], FIXTURE_KEY);
        expect(a).toBe(digest('example-thing', FIXTURE_KEY));
    });

    it('is sorted and deduplicated across punctuation variants', () => {
        const out = digestsFor(['example-thing', 'Example_Thing', 'other-thing'], FIXTURE_KEY);
        expect(out).toHaveLength(2);
        expect([...out].sort()).toEqual(out);
    });
});

describe('check_no_external_sources — digest path end to end (fixture key)', () => {
    const plant = (work: string, cfg: unknown): void => {
        fs.mkdirSync(path.join(work, 'src', 'scripts', '_lib'), { recursive: true });
        fs.writeFileSync(
            path.join(work, 'src', 'scripts', 'external_sources_denylist.json'),
            JSON.stringify(cfg) + '\n',
            'utf-8',
        );
        fs.copyFileSync(TS_SCRIPT, path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'));
        // The whole directory, not a hand-listed closure — see the note in
        // check_no_external_sources.test.ts: a stale list makes the fixture die
        // before printing, which reads as a clean run rather than a broken one.
        const libSrc = path.join(REPO_ROOT, 'src', 'scripts', '_lib');
        for (const name of fs.readdirSync(libSrc)) {
            const src = path.join(libSrc, name);
            if (name.endsWith('.ts') && fs.statSync(src).isFile()) {
                fs.copyFileSync(src, path.join(work, 'src', 'scripts', '_lib', name));
            }
        }
        spawnSync('git', ['init', '-q'], { cwd: work });
    };

    const run = (work: string, env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> =>
        spawnSync(TSX_BIN, [path.join(work, 'src', 'scripts', 'check_no_external_sources.ts')], {
            cwd: work,
            encoding: 'utf8',
            maxBuffer: 1 << 26,
            env: { ...process.env, ...env },
        });

    /** A config whose plaintext deny list can never fire, so only digests can. */
    const cfgWithDigests = {
        deny: ['\\bzzz-never-occurs-in-this-fixture-zzz\\b'],
        deny_digests: [digest(FIXTURE_SOURCE, FIXTURE_KEY)],
        skip_paths: ['src/scripts/*', 'src/scripts/_lib/*'],
    };

    it('with the key set, a digest-only token fails the gate', () => {
        const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnesd-')));
        try {
            plant(work, cfgWithDigests);
            fs.writeFileSync(path.join(work, 'a.md'), `ported from ${FIXTURE_SOURCE} at a pin\n`, 'utf-8');
            spawnSync('git', ['add', '-A'], { cwd: work });
            const r = run(work, { [KEY_ENV]: FIXTURE_KEY, [STRICT_ENV]: '' });
            expect(r.status).toBe(1);
            expect(r.stdout as string).toContain('a.md:1');
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
        }
    });

    it('without the key the run is LOUD on stderr — it does not pretend to have checked', () => {
        const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnesd-')));
        try {
            plant(work, cfgWithDigests);
            fs.writeFileSync(path.join(work, 'a.md'), `ported from ${FIXTURE_SOURCE} at a pin\n`, 'utf-8');
            spawnSync('git', ['add', '-A'], { cwd: work });
            const r = run(work, { [KEY_ENV]: '', [STRICT_ENV]: '' });
            expect(r.stderr as string).toContain('SKIPPED');
            expect(r.stderr as string).toContain(KEY_ENV);
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
        }
    });

    it('strict mode with no key exits 3, never 0', () => {
        const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnesd-')));
        try {
            plant(work, cfgWithDigests);
            fs.writeFileSync(path.join(work, 'a.md'), 'clean line\n', 'utf-8');
            spawnSync('git', ['add', '-A'], { cwd: work });
            const r = run(work, { [KEY_ENV]: '', [STRICT_ENV]: '1' });
            expect(r.status).toBe(EXIT_NO_KEY);
            expect(r.status).not.toBe(0);
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
        }
    });

    it('the SHIPPED config is dormant — deny_digests is empty and the plaintext deny array survives', () => {
        const shipped = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'external_sources_denylist.json'), 'utf-8'),
        ) as { deny: string[]; deny_digests?: string[] };
        expect(shipped.deny_digests).toEqual([]);
        expect(shipped.deny.length).toBeGreaterThan(0);
    });
});
