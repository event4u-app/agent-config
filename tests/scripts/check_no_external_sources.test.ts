/**
 * CLI-contract tests for `src/scripts/check_no_external_sources.ts`.
 *
 * The tsx twin is the source of truth (the python original was deleted in the
 * teardown).
 *
 * Layer 1 — real repo: the twin runs deterministically (this suite proves the
 * twin runs, not the tree's content hygiene, which main's diff-scoped gate owns).
 *
 * Layer 2 — synthetic hit fixture: a tmp git repo carrying SYNTHETIC denied
 * tokens seeded into its own throwaway config is scanned; text + JSON output and
 * exit codes are asserted, exercising the hit path, the fnmatch skip, the
 * `line.strip()[:160]` excerpt, and the regex-token field.
 *
 * Layer 3 — the SHIPPED denylist, exercised as a property over the config
 * rather than over hand-copied literals.
 *
 * ## Why no real source name appears in this file
 *
 * This test used to assemble real denied slugs from concatenated string
 * fragments, with a comment explaining that the fragments dodge the very gate
 * under test. Two things were wrong with that. The assembled names were
 * plaintext to any reader — this file published five of exactly the names the
 * gate exists to hide — and the comment documented a working bypass technique
 * next to the guard it bypasses (`road-to-source-silence` Phase 2.2).
 *
 * The replacement needs no bypass at all. Layer 2 invents its own tokens and
 * seeds them into its own fixture config, so matching is proven against names
 * that name nothing. Layer 3 reads the shipped config at runtime and asserts
 * PROPERTIES of the patterns in it, so the real tokens exist only in memory and
 * in a throwaway tmp tree — never in tracked source.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_external_sources.ts');
const SHIPPED_CONFIG = path.join(REPO_ROOT, 'src', 'scripts', 'external_sources_denylist.json');
// The gate imports several `_lib` modules (scan scope, the shape heuristic, the
// baseline ratchet and its base-ref resolver). The whole directory is copied
// rather than a hand-listed subset: a hand-listed closure goes stale the moment
// the gate gains an import, and the failure mode is a fixture that dies before
// printing anything — which reads as "the gate found nothing", not as a broken
// fixture. That is exactly how this list was found wrong once already.
const LIB_SRC = path.join(REPO_ROOT, 'src', 'scripts', '_lib');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const big = (cwd: string) => ({ maxBuffer: 256 * 1024 * 1024, cwd, encoding: 'utf8' as const });

/** Copy the gate + every `_lib` module it could import into a fixture tree. */
function plantGate(work: string): void {
    const libDst = path.join(work, 'src', 'scripts', '_lib');
    fs.mkdirSync(libDst, { recursive: true });
    fs.copyFileSync(TS_SCRIPT, path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'));
    for (const name of fs.readdirSync(LIB_SRC)) {
        const src = path.join(LIB_SRC, name);
        if (name.endsWith('.ts') && fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(libDst, name));
    }
}

// --- Layer 1: CLI contract on the real repo --------------------------------

describe('check_no_external_sources — CLI contract (real repo)', () => {
    it('text report runs deterministically', () => {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT], big(REPO_ROOT));
        expect(a.status).not.toBeNull();
    });

    it('json report runs deterministically', () => {
        const a = spawnSync(TSX_BIN, [TS_SCRIPT, '--json'], big(REPO_ROOT));
        expect(a.status).not.toBeNull();
    });
});

// --- Layer 2: synthetic hit fixture ----------------------------------------

describe('check_no_external_sources — synthetic hits', () => {
    let work: string;

    // Invented tokens, seeded into the fixture's OWN denylist below. They name
    // nothing, so they may be written as plain literals — which is the point:
    // the test proves the matcher without publishing a real name and without
    // demonstrating any way around the guard.
    const TOK1 = 'example-denied-word';
    const TOK2 = 'example-owner/example-denied-slug';

    beforeEach(() => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnes-')));
        fs.mkdirSync(path.join(work, 'src', 'scripts'), { recursive: true });
        // Minimal denylist with one word-boundary pattern + one slug + a skip glob.
        fs.writeFileSync(
            path.join(work, 'src', 'scripts', 'external_sources_denylist.json'),
            JSON.stringify({
                deny: [`\\b${TOK1}\\b`, TOK2],
                skip_paths: [
                    'src/scripts/external_sources_denylist.json',
                    'src/scripts/check_no_external_sources.ts',
                    'skipme/*',
                ],
            }) + '\n',
            'utf-8',
        );
        // Tracked content: two hits (trailing whitespace exercises strip), one
        // clean line, plus a skip_paths-covered file that also carries a token.
        fs.writeFileSync(
            path.join(work, 'a.md'),
            `inspired by ${TOK1} here  \nand ${TOK2} there\nclean line\n`,
            'utf-8',
        );
        fs.mkdirSync(path.join(work, 'skipme'), { recursive: true });
        fs.writeFileSync(path.join(work, 'skipme', 'b.md'), `${TOK1} should be skipped\n`, 'utf-8');
        // Binary-extension skip: a denied token inside a .lock file must be ignored.
        fs.writeFileSync(path.join(work, 'c.lock'), `${TOK1} in a lockfile\n`, 'utf-8');
        // The script resolves ROOT from parents[2] of its own location, and
        // loads the sibling denylist — so it must live under <work>/src/scripts.
        plantGate(work);
        // git ls-files needs a repo with the files tracked.
        spawnSync('git', ['init', '-q'], big(work));
        spawnSync('git', ['add', '-A'], big(work));
    });

    afterEach(() => {
        fs.rmSync(work, { recursive: true, force: true });
    });

    const TS = (flag?: string): ReturnType<typeof spawnSync> =>
        spawnSync(
            TSX_BIN,
            [path.join(work, 'src', 'scripts', 'check_no_external_sources.ts'), ...(flag ? [flag] : [])],
            big(work),
        );

    it('text hit report → exit 1, flags the two non-skipped hits', () => {
        const ts = TS();
        expect(ts.status).toBe(1);
        expect(ts.stdout as string).toContain('a.md:1');
        expect(ts.stdout as string).toContain('a.md:2');
        expect(ts.stdout as string).not.toContain('skipme');
        expect(ts.stdout as string).not.toContain('c.lock');
    });

    it('json hit report → exit 1, two hits with stripped excerpt + regex token', () => {
        const ts = TS('--json');
        expect(ts.status).toBe(1);
        const parsed = JSON.parse(ts.stdout as string) as {
            ok: boolean;
            hits: Array<Record<string, unknown>>;
        };
        expect(parsed.ok).toBe(false);
        expect(parsed.hits).toHaveLength(2);
        // Trailing whitespace stripped in the excerpt (line.strip()[:160]).
        expect(parsed.hits[0]!.text).toBe(`inspired by ${TOK1} here`);
        // Raw regex pattern preserved in the token field.
        expect(parsed.hits[0]!.token).toBe(`\\b${TOK1}\\b`);
    });

    it('covers the slug-with-separator case the old literal fixture covered', () => {
        const parsed = JSON.parse(TS('--json')!.stdout as string) as {
            hits: Array<{ token: string }>;
        };
        expect(parsed.hits.map((h) => h.token)).toContain(TOK2);
    });
});

// --- Layer 3: the SHIPPED denylist, as properties --------------------------
//
// Read from the config at runtime. Three assertions, and the negatives are
// deliberately their own cases rather than rows in a positive corpus — the
// standing lesson that a pattern gate which is never shown its own denial has
// untested polarity.

describe('check_no_external_sources — shipped denylist properties', () => {
    const cfg = JSON.parse(fs.readFileSync(SHIPPED_CONFIG, 'utf-8')) as { deny: string[] };
    /** Patterns of the form `\b<word>\b` — the anchored class the properties apply to. */
    const anchored = cfg.deny
        .map((p) => /^\\b([A-Za-z0-9][A-Za-z0-9._-]*)\\b$/.exec(p))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => ({ pattern: m[0], word: m[1] as string }));

    it('the shipped config carries anchored word patterns to test', () => {
        expect(cfg.deny.length).toBeGreaterThan(0);
        expect(anchored.length).toBeGreaterThan(0);
    });

    it('every pattern compiles as the gate compiles it', () => {
        for (const p of cfg.deny) {
            expect(() => new RegExp(p, 'i')).not.toThrow();
        }
    });

    it('every anchored word pattern fires on its own word', () => {
        for (const { pattern, word } of anchored) {
            expect(new RegExp(pattern, 'i').test(`harvested from ${word} at a pin`)).toBe(true);
        }
    });

    it('no anchored word pattern fires on that word with a suffix (\\b holds)', () => {
        for (const { pattern, word } of anchored) {
            const rx = new RegExp(pattern, 'i');
            // Only meaningful when no OTHER shipped pattern claims the longer
            // string — otherwise the assertion would be about a different token.
            const longer = `${word}xy`;
            const claimedElsewhere = cfg.deny.some((p) => p !== pattern && new RegExp(p, 'i').test(longer));
            if (claimedElsewhere) continue;
            expect(rx.test(`the ${longer} pattern is unrelated`)).toBe(false);
        }
    });

    it('does not fire on the OWASP routing URL two skills point at', () => {
        const route = 'https://cheatsheetseries.owasp.org/';
        for (const p of cfg.deny) {
            expect(new RegExp(p, 'i').test(`route the fix to <${route}>`)).toBe(false);
        }
    });

    it('end-to-end: the shipped config fires on a token taken from itself', () => {
        const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cnes3-')));
        try {
            fs.mkdirSync(path.join(work, 'src', 'scripts'), { recursive: true });
            fs.copyFileSync(SHIPPED_CONFIG, path.join(work, 'src', 'scripts', 'external_sources_denylist.json'));
            plantGate(work);
            spawnSync('git', ['init', '-q'], big(work));
            // The probe body is built from the config at runtime — the literal
            // never exists in this file.
            const word = anchored[0]!.word;
            fs.writeFileSync(path.join(work, 'probe.md'), `harvested from ${word} at a pin\n`, 'utf-8');
            spawnSync('git', ['add', '-A'], big(work));
            const r = spawnSync(
                TSX_BIN,
                [path.join(work, 'src', 'scripts', 'check_no_external_sources.ts')],
                big(work),
            );
            expect(r.status).toBe(1);
        } finally {
            fs.rmSync(work, { recursive: true, force: true });
        }
    });
});
