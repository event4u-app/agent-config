/**
 * `sync_agent_settings` over a settings file that already carries duplicate
 * mapping keys.
 *
 * A duplicate top-level key makes the whole document unreadable to a strict
 * parser, and `loadUser` was the first thing `main` did — so one such pair
 * exited 2 and took `task sync`, `task release-prepare` and every release with
 * it. The duplicates were written by `mergeIntoTemplate`'s non-idempotent flat
 * append (fixed, and pinned by tests/server/yamlIO.merge-idempotence.test.ts),
 * but that fix does nothing for the files it already corrupted. This is the
 * other half: an install that ran the wizard twice must be able to sync again
 * without a hand edit, because a release is the worst moment to find out.
 *
 * The invariant the repair must hold is VALUE-NEUTRALITY: a lenient reader
 * already resolved a duplicate run last-wins, so collapsing changes only
 * whether the file parses, never what it parses as.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { collapseDuplicateFlatKeys, main } from '../../src/scripts/sync_agent_settings.js';

const TEMPLATE = `rule_loading_tier: __RULE_LOADING_TIER__

personal:
  ide: ""
`;
const INI = `rule_loading_tier=minimal\n`;

let workspace = '';

function makeWorkspace(): string {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-dup-'));
    fs.mkdirSync(path.join(ws, 'config', 'profiles'), { recursive: true });
    fs.writeFileSync(path.join(ws, 'config', 'agent-settings.template.yml'), TEMPLATE, 'utf-8');
    fs.writeFileSync(path.join(ws, 'config', 'profiles', 'minimal.ini'), INI, 'utf-8');
    return ws;
}

function run(ws: string, extra: string[] = []): number {
    return main([
        '--path', path.join(ws, '.agent-settings.yml'),
        '--template', path.join(ws, 'config', 'agent-settings.template.yml'),
        '--profile-dir', path.join(ws, 'config', 'profiles'),
        '--quiet',
        ...extra,
    ]);
}

afterEach(() => {
    if (workspace !== '' && fs.existsSync(workspace)) {
        fs.rmSync(workspace, { recursive: true, force: true });
    }
});

/** The shape the old writer produced: the flat block appended twice. */
const CORRUPTED = [
    'rule_loading_tier: minimal',
    'personal:',
    '  ide: phpstorm',
    '',
    '# Wizard-added keys (no template entry)',
    'profile.id: developer',
    'cost.enforcement: advisory',
    '',
    '# Wizard-added keys (no template entry)',
    'profile.id: maintainer',
    'cost.enforcement: blocking',
    '',
].join('\n');

describe('collapseDuplicateFlatKeys', () => {
    it('collapses a duplicate run last-wins and leaves the file strict-parseable', () => {
        expect(() => parseYaml(CORRUPTED, { uniqueKeys: true })).toThrow(/unique/i);

        const r = collapseDuplicateFlatKeys(CORRUPTED);
        expect(r.collapsed).toEqual(['profile.id', 'cost.enforcement']);
        expect(r.unsafe).toEqual([]);

        const doc = parseYaml(r.text, { uniqueKeys: true }) as Record<string, unknown>;
        expect(doc['profile.id']).toBe('maintainer');
        expect(doc['cost.enforcement']).toBe('blocking');
    });

    it('is value-neutral against the lenient last-wins read every reader saw', () => {
        const before = parseYaml(CORRUPTED, { version: '1.1', uniqueKeys: false });
        const after = parseYaml(collapseDuplicateFlatKeys(CORRUPTED).text, { version: '1.1' });
        expect(after).toEqual(before);
    });

    it('REFUSES a duplicated block key rather than deleting the loser children', () => {
        // Last-wins on a block key drops the other occurrence's children —
        // silent data loss, strictly worse than the parse error it would cure.
        const blocks = 'personal:\n  ide: phpstorm\npersonal:\n  autonomy: "on"\n';
        const r = collapseDuplicateFlatKeys(blocks);
        expect(r.collapsed).toEqual([]);
        expect(r.unsafe).toHaveLength(1);
        expect(r.unsafe[0]).toContain('personal');
        expect(r.text).toBe(blocks);
    });

    // Every shape whose value outlives its own line. The first classifier
    // called all of these "inline" because the text after the colon was
    // non-empty, and dropping the loser then
    // removed only its HEADER line: the body survived, stopped being that key's
    // value, and re-attached to whatever preceded it. That is not the parse
    // error being cured — it is silent corruption replacing it, and it broke
    // the value-neutrality this pass promises.
    it.each([
        [
            'block scalar',
            'a: |\n  text\nb: 1\na: |\n  other\n',
            // Old behaviour: `a` kept the FIRST body and `b` became "1 other".
        ],
        ['anchored block', 'd: &d\n  x: 1\nz: 0\nd: &e\n  y: 2\n'],
        ['multi-line flow collection', 'l: [\n  1,\n  2\n]\nm: 0\nl: [\n  3\n]\n'],
        ['folded scalar', 'a: >\n  one\nb: 1\na: >\n  two\n'],
    ])('REFUSES a duplicate whose value spans lines — %s', (_name, doc) => {
        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual([]);
        expect(r.unsafe).toHaveLength(1);
        expect(r.text).toBe(doc);
    });

    it('REFUSES a duplicate carrying an anchor, even on one line', () => {
        // The one span-case the continuation scan cannot see: `&a 1` fits on
        // its own line, so only the anchor check refuses it. Dropping the
        // loser would delete an anchor definition an alias elsewhere binds to,
        // which changes the parse of a line this pass never looked at.
        const doc = 'x: &a 1\ny: 0\nx: &b 2\n';
        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual([]);
        expect(r.unsafe).toHaveLength(1);
        expect(r.text).toBe(doc);
    });

    it('repairs a CRLF document and keeps its line endings', () => {
        // Splitting on `\n` alone leaves a trailing `\r` on every line, which
        // the key pattern never matches — so a CRLF file reported zero
        // duplicates and fell straight into the parse error this pass exists
        // to prevent. Silent, and indistinguishable from a healthy file.
        const doc = 'a: 1\r\nb: 2\r\na: 3\r\n';
        expect(() => parseYaml(doc, { uniqueKeys: true })).toThrow(/unique/i);

        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual(['a']);
        expect(r.text).toContain('\r\n');
        expect(r.text).not.toMatch(/[^\r]\n/);
        const parsed = parseYaml(r.text, { uniqueKeys: true }) as Record<string, unknown>;
        expect(parsed).toEqual({ a: 3, b: 2 });
    });

    it('does not read `a:b:` as the key `a` and delete the `a:b` entry', () => {
        // A mapping key ends at a colon followed by SPACE, which is YAML's own
        // plain-scalar rule. Stopping at the first colon saw two `a` heads
        // here, collapsed them, and dropped `a:b` — and the result parsed
        // cleanly, so nothing downstream could notice the loss. Silent
        // deletion is the exact failure the value-neutrality promise is about.
        const doc = 'a:b: 1\nx: 0\na: 2\n';
        const before = parseYaml(doc, { version: '1.1', uniqueKeys: false });

        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual([]);
        expect(r.text).toBe(doc);
        expect(parseYaml(r.text, { version: '1.1', uniqueKeys: false })).toEqual(before);
    });

    it('REFUSES a duplicate whose one-line value defines an anchor inside a flow collection', () => {
        // `[&x 1]` fits on its own line, so neither the continuation scan nor a
        // start-of-value anchor check sees it. Dropping it deletes the anchor
        // an alias on another line binds to, turning a duplicate-key error into
        // an unresolved-alias error — a different broken file, not a fixed one.
        const doc = 'a: [&x 1]\nb: *x\na: [2]\n';
        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual([]);
        expect(r.text).toBe(doc);
    });

    it('sees a duplicate on a line carrying a lone carriage return', () => {
        // `.` does not match `\r`, so the head pattern skipped such a line and
        // the duplicate stayed invisible — the parse error survived untouched.
        const doc = 'a: "x\ry"\nb: 2\na: 3\n';
        expect(() => parseYaml(doc, { uniqueKeys: true })).toThrow(/unique/i);

        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual(['a']);
        expect(() => parseYaml(r.text, { uniqueKeys: true })).not.toThrow();
    });

    it('keeps a mostly-LF file on LF even when one line ends CRLF', () => {
        // "any CRLF present" rewrote every line ending in the file — a
        // whole-file change on a pass that promises to touch only what it must.
        const doc = 'a: 1\r\nb: 2\na: 3\n';
        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual(['a']);
        expect(r.text).not.toContain('\r\n');
    });

    it('names the real reason for each refusal', () => {
        // One blanket "occurrences carry different children" was printed over
        // nulls, block scalars and anchors alike, sending the reader to look
        // for children that do not exist.
        expect(collapseDuplicateFlatKeys('k: # c\nb: 0\nk: # d\n').unsafe[0]).toMatch(/null value/);
        expect(collapseDuplicateFlatKeys('k: |\n  a\nb: 0\nk: |\n  c\n').unsafe[0]).toMatch(/block scalar/);
        expect(collapseDuplicateFlatKeys('k: &a 1\nb: 0\nk: &c 2\n').unsafe[0]).toMatch(/anchor/);
    });

    it('does not touch a multi-document stream', () => {
        // Two documents may legitimately carry the same key. The reader takes
        // a single document and rejects the file either way, so the only thing
        // collapsing could achieve here is merging two documents into one.
        const doc = 'a: 1\n---\na: 2\n';
        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual([]);
        expect(r.text).toBe(doc);
    });

    it('leaves a clean file byte-identical', () => {
        const clean = 'a: 1\nb:\n  c: 2\n';
        const r = collapseDuplicateFlatKeys(clean);
        expect(r.text).toBe(clean);
        expect(r.collapsed).toEqual([]);
        expect(r.unsafe).toEqual([]);
    });
});

describe('sync_agent_settings over a corrupted file', () => {
    it('repairs, syncs and writes the repair to disk', () => {
        workspace = makeWorkspace();
        const target = path.join(workspace, '.agent-settings.yml');
        fs.writeFileSync(target, CORRUPTED, 'utf-8');

        // The pre-fix behaviour was exit 2 here, which is what killed the release.
        expect(run(workspace)).toBe(0);

        const written = fs.readFileSync(target, 'utf-8');
        // The collapse must REACH DISK. Comparing "did anything change" against
        // the repaired text instead of the raw file reports "already in sync"
        // and writes nothing, so the repair runs forever and fixes nothing.
        expect(() => parseYaml(written, { uniqueKeys: true })).not.toThrow();
        expect((written.match(/^profile\.id:/gm) ?? []).length).toBe(1);

        // Second run has nothing left to do.
        expect(run(workspace)).toBe(0);
        expect(fs.readFileSync(target, 'utf-8')).toBe(written);
    });

    it('exits 2 with a hand-merge instruction on a duplicated block key', () => {
        workspace = makeWorkspace();
        const target = path.join(workspace, '.agent-settings.yml');
        const blocks = 'rule_loading_tier: minimal\npersonal:\n  ide: phpstorm\npersonal:\n  user_name: x\n';
        fs.writeFileSync(target, blocks, 'utf-8');

        // Exit 2 alone proves nothing here — the bare parse failure this
        // change replaced also exits 2, so an exit-code-only assertion stays
        // green with the whole repair pass removed. The MESSAGE is what
        // separates a deliberate refusal from a crash.
        const stderr: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string | Uint8Array): boolean => {
            stderr.push(String(chunk));
            return true;
        }) as typeof process.stderr.write;
        let code: number;
        try {
            code = run(workspace);
        } finally {
            process.stderr.write = original;
        }

        expect(code).toBe(2);
        const said = stderr.join('');
        expect(said).toContain('duplicate mapping keys this tool will not collapse');
        expect(said).toContain('Merge them by hand');
        // Refusing means leaving the file alone, not half-repairing it.
        expect(fs.readFileSync(target, 'utf-8')).toBe(blocks);
    });
});

/**
 * The repair notice itself. A review found it unpinned: re-gating it on
 * `--quiet` left every other test green, and both callers that matter pass
 * `--quiet` — so a release could have rewritten the operator's settings file
 * with no trace at all and nothing would have failed.
 */
describe('the repair notice', () => {
    /** Run `main` capturing stderr, so the notice can be asserted on. */
    function runCapturing(ws: string, extra: string[] = []): { code: number; err: string } {
        const chunks: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string | Uint8Array): boolean => {
            chunks.push(String(chunk));
            return true;
        }) as typeof process.stderr.write;
        try {
            return { code: run(ws, extra), err: chunks.join('') };
        } finally {
            process.stderr.write = original;
        }
    }

    it('is printed even under --quiet, because both real callers are quiet', () => {
        workspace = makeWorkspace();
        fs.writeFileSync(path.join(workspace, '.agent-settings.yml'), CORRUPTED, 'utf-8');

        const { code, err } = runCapturing(workspace);
        expect(code).toBe(0);
        expect(err).toContain('collapsed 2 duplicate key(s)');
        expect(err).toContain('profile.id');
    });

    it.each([['--check', 2], ['--dry-run', 0]] as const)(
        'says "would collapse", not "collapsed", under %s — no write happens there',
        (flag, expected) => {
            workspace = makeWorkspace();
            const target = path.join(workspace, '.agent-settings.yml');
            fs.writeFileSync(target, CORRUPTED, 'utf-8');

            const { code, err } = runCapturing(workspace, [flag]);
            expect(code).toBe(expected);
            // The pre-release probe runs --dry-run, so the past tense here was
            // the first thing an operator saw on a release with a broken file.
            expect(err).toContain('would collapse');
            expect(err).not.toMatch(/: collapsed /);
            // And the claim matches reality: the file is untouched.
            expect(fs.readFileSync(target, 'utf-8')).toBe(CORRUPTED);
        },
    );
});

/**
 * Council verdict, 2026-09-10: a repair pass must either fix the file or say
 * why it cannot. Silence over a key it skipped hands the operator the same
 * opaque "Map keys must be unique" the pass exists to remove, with no hint that
 * their key was the part being skipped.
 */
describe('keys the repair cannot model', () => {
    it.each([
        ['digit-leading', '2fa.on: 1\nb: 0\n2fa.on: 2\n', '2fa.on'],
        ['quoted', '"a:b": 1\nx: 0\n"a:b": 2\n', '"a:b"'],
    ])('reports a duplicated %s key instead of silently skipping it', (_n, doc, key) => {
        const r = collapseDuplicateFlatKeys(doc);
        expect(r.collapsed).toEqual([]);
        expect(r.unsafe).toHaveLength(1);
        expect(r.unsafe[0]).toContain(key);
        // Detection only — such a key is never rewritten.
        expect(r.text).toBe(doc);
    });

    it('stays silent when such a key appears only once', () => {
        expect(collapseDuplicateFlatKeys('2fa.on: 1\nb: 0\n').unsafe).toEqual([]);
    });
});

describe('--check distinguishes a repair from template drift', () => {
    function runCapturing(ws: string, extra: string[] = []): { code: number; err: string } {
        const chunks: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((chunk: string | Uint8Array): boolean => {
            chunks.push(String(chunk));
            return true;
        }) as typeof process.stderr.write;
        try {
            return { code: run(ws, extra), err: chunks.join('') };
        } finally {
            process.stderr.write = original;
        }
    }

    it('names the duplicate keys rather than calling a corrupt file "drift"', () => {
        workspace = makeWorkspace();
        const target = path.join(workspace, '.agent-settings.yml');
        // In sync with the template, so the ONLY difference is the collapse.
        fs.writeFileSync(target, 'rule_loading_tier: minimal\npersonal:\n  ide: ""\nk: 1\nk: 2\n', 'utf-8');

        const { code, err } = runCapturing(workspace, ['--check']);
        // Still 2 — the file needs a write either way, and a green --check over
        // a file the reader cannot parse would hide the breakage.
        expect(code).toBe(2);
        expect(err).toContain('duplicate keys need collapsing');
        expect(err).toContain('no template drift');
        expect(err).not.toMatch(/drift detected/);
    });

    it('still says "drift detected" when the template genuinely moved', () => {
        workspace = makeWorkspace();
        const target = path.join(workspace, '.agent-settings.yml');
        fs.writeFileSync(target, 'rule_loading_tier: minimal\n', 'utf-8');

        const { code, err } = runCapturing(workspace, ['--check']);
        expect(code).toBe(2);
        expect(err).toContain('drift detected');
    });
});

describe('the unparseable-input warning', () => {
    it('fires when the original was broken beyond its duplicate keys', () => {
        workspace = makeWorkspace();
        const target = path.join(workspace, '.agent-settings.yml');
        // An unterminated quote: the collapse can turn this into a document
        // that parses to structure no human wrote.
        fs.writeFileSync(target, 'rule_loading_tier: minimal\na: "x\nk: 1\nk: 2\n', 'utf-8');

        const chunks: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((c: string | Uint8Array): boolean => {
            chunks.push(String(c));
            return true;
        }) as typeof process.stderr.write;
        try {
            run(workspace, ['--dry-run']);
        } finally {
            process.stderr.write = original;
        }
        expect(chunks.join('')).toContain('syntax error beyond the duplicate keys');
    });

    it('stays silent on an input whose only problem was the duplicates', () => {
        workspace = makeWorkspace();
        fs.writeFileSync(path.join(workspace, '.agent-settings.yml'), CORRUPTED, 'utf-8');

        const chunks: string[] = [];
        const original = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((c: string | Uint8Array): boolean => {
            chunks.push(String(c));
            return true;
        }) as typeof process.stderr.write;
        try {
            run(workspace, ['--dry-run']);
        } finally {
            process.stderr.write = original;
        }
        expect(chunks.join('')).not.toContain('syntax error beyond');
    });
});
