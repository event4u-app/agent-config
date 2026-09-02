/**
 * The corpus manifest: what it pins, what it deliberately leaves out of the
 * digest, and the two ways a subject can differ.
 *
 * The interesting assertions are the negative ones. A digest that moved when
 * the node version moved would report a subject change on every upgrade and a
 * reader would stop believing it, so the explanatory fields are asserted to be
 * OUTSIDE the digest as firmly as the subject fields are asserted to be inside
 * it. Every fixture is a temporary tree; nothing here reads or writes the
 * repository it runs in.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    CorpusManifestError,
    captureManifest,
    captureProjectionDecision,
    captureUserScope,
    diffManifests,
    enumerateCorpus,
    parseManifest,
    scopeDedupEnabled,
    serialiseManifest,
    subjectDigest,
    subjectsEquivalent,
} from '../../src/scripts/_lib/corpus_manifest.js';
import { parseArgs } from '../../src/scripts/corpus_manifest.js';

const RULE = 'test-rule/v1';
const made: string[] = [];

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(d);
    return d;
}

/** A tree with a projected corpus directory and the projection source it came from. */
function fixture(files: Readonly<Record<string, string>>, source: Readonly<Record<string, string>> = {}): string {
    const root = tmp('corpus-manifest-');
    const rules = path.join(root, '.claude', 'rules');
    fs.mkdirSync(rules, { recursive: true });
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(rules, name), body);
    const src = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(src, { recursive: true });
    for (const [name, body] of Object.entries(source)) fs.writeFileSync(path.join(src, name), body);
    return root;
}

function home(files: Readonly<Record<string, string>>): string {
    const h = tmp('corpus-home-');
    const d = path.join(h, '.claude', 'rules');
    fs.mkdirSync(d, { recursive: true });
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(d, name), body);
    return h;
}

afterEach(() => {
    while (made.length > 0) {
        const d = made.pop() as string;
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('enumerateCorpus', () => {
    it('takes the first N in byte order and records the rest as excluded', () => {
        const root = fixture({ 'c.md': 'c', 'a.md': 'a', 'b.md': 'b' });
        const { included, excluded } = enumerateCorpus(root, 2);
        expect(included).toEqual(['.claude/rules/a.md', '.claude/rules/b.md']);
        expect(excluded.map((e) => e.path)).toEqual(['.claude/rules/c.md']);
    });

    it('ignores files that are not markdown, because the rule says every *.md', () => {
        const root = fixture({ 'a.md': 'a', 'README.txt': 'x' });
        expect(enumerateCorpus(root, 5).included).toEqual(['.claude/rules/a.md']);
    });

    it('refuses a tree with no corpus directory rather than pinning an empty subject', () => {
        const root = tmp('corpus-empty-');
        expect(() => enumerateCorpus(root, 5)).toThrow(CorpusManifestError);
    });

    it('refuses an existing-but-EMPTY corpus directory, which is the reachable half', () => {
        // The directory survives a generation that emitted zero files. Left
        // accepted it yielded a well-formed manifest of nothing, and two such
        // captures compared SUBJECT EQUIVALENT: a successful pin of nothing.
        const root = fixture({});
        expect(() => enumerateCorpus(root, 5)).toThrow(CorpusManifestError);
        expect(() => enumerateCorpus(root, 5)).toThrow(/holds no \*\.md/);
    });

    it('refuses a corpus directory holding only non-markdown files', () => {
        const root = fixture({ 'README.txt': 'x' });
        expect(() => enumerateCorpus(root, 5)).toThrow(CorpusManifestError);
    });
});

describe('subjectDigest', () => {
    const entry = (p: string, sha: string) => ({
        path: p,
        sha256: sha,
        bytes: 1,
        provenance: 'dist/agent-src/rules/x.md',
        provenance_sha256: null,
    });

    it('changes when the bytes of a subject change', () => {
        expect(subjectDigest(RULE, [entry('a', 'aaa')])).not.toBe(subjectDigest(RULE, [entry('a', 'bbb')]));
    });

    it('changes when the enumeration rule changes, even with identical files', () => {
        expect(subjectDigest(RULE, [entry('a', 'aaa')])).not.toBe(
            subjectDigest('other-rule/v1', [entry('a', 'aaa')]),
        );
    });

    it('changes when the corpus order changes, because order decides which N are taken', () => {
        const a = entry('a', 'aaa');
        const b = entry('b', 'bbb');
        expect(subjectDigest(RULE, [a, b])).not.toBe(subjectDigest(RULE, [b, a]));
    });
});

describe('captureUserScope', () => {
    it('records a byte-identical twin as identical, and as causing a skip only when the dedup is ON', () => {
        // The defect this splits: with the dedup off — the state of every
        // settings layer this repository carries — the twin skips nothing, and
        // a manifest that recorded `causes_skip: true` asserted a skip the
        // generator does not perform.
        const root = fixture({ 'a.md': 'projected' }, { 'a.md': 'source bytes' });
        const h = home({ 'a.md': 'source bytes' });
        const off = captureUserScope(root, h, { dedupEnabled: false });
        expect(off).toHaveLength(1);
        expect(off[0]?.byte_identical).toBe(true);
        expect(off[0]?.causes_skip).toBe(false);
        const on = captureUserScope(root, h, { dedupEnabled: true });
        expect(on[0]?.byte_identical).toBe(true);
        expect(on[0]?.causes_skip).toBe(true);
    });

    it('records a differing twin as neither identical nor skipping, on either setting', () => {
        const root = fixture({ 'a.md': 'projected' }, { 'a.md': 'source bytes' });
        const h = home({ 'a.md': 'stale bytes' });
        for (const dedupEnabled of [false, true]) {
            const twin = captureUserScope(root, h, { dedupEnabled })[0];
            expect(twin?.byte_identical).toBe(false);
            expect(twin?.causes_skip).toBe(false);
        }
    });

    it('honours a caller-supplied rule population instead of the projection-source superset', () => {
        const root = fixture({ 'a.md': 'p' }, { 'a.md': 's', 'b.md': 's' });
        const h = home({ 'a.md': 's', 'b.md': 's' });
        expect(captureUserScope(root, h, { dedupEnabled: true }).map((t) => t.path)).toEqual([
            '.claude/rules/a.md',
            '.claude/rules/b.md',
        ]);
        expect(
            captureUserScope(root, h, { dedupEnabled: true, ruleNames: ['a.md'] }).map((t) => t.path),
        ).toEqual(['.claude/rules/a.md']);
    });

    it('reads the recorded scope_dedup string with the generator own truthy set', () => {
        expect(scopeDedupEnabled('absent:default-off')).toBe(false);
        expect(scopeDedupEnabled(null)).toBe(false);
        expect(scopeDedupEnabled('.agent-settings.yml:false')).toBe(false);
        for (const v of ['true', 'yes', 'on', '1', 'TRUE']) {
            expect(scopeDedupEnabled(`.agent-settings.yml:${v}`)).toBe(true);
        }
    });

    it('leaks no account name anywhere in a captured manifest, twin or global layer', () => {
        const root = fixture({ 'a.md': 'p' }, { 'a.md': 's' });
        const h = home({ 'a.md': 's' });
        const captured = captureUserScope(root, h, { dedupEnabled: false });
        expect(captured[0]?.path).toBe('.claude/rules/a.md');
        const m = captureManifest({
            repoRoot: root,
            userHome: h,
            limit: 1,
            enumerationRule: RULE,
            env: {},
        });
        expect(serialiseManifest(m)).not.toContain(h);
    });

    it('records the partition evidence, which is where the observed skips come from', () => {
        const root = fixture({ 'a.md': 'p' }, { 'a.md': 's' });
        const m = captureProjectionDecision(root, home({ 'a.md': 's' }));
        expect(m.tool_id).toBe('claude-code');
        expect(typeof m.layer_digest).toBe('string');
        expect(m.layer_digest.length).toBeGreaterThan(0);
    });

    it('leaves partition_active null rather than reading the operator machine', () => {
        // Every other field in the struct is a function of the (repoRoot,
        // userHome) pair. `partitionActive` reads os.homedir() and the install
        // lockfile, ignores userHome, and memoises — so calling it here recorded
        // the operator's real installed state under a temp tree's name, and the
        // second capture in one process reused the first verdict.
        const root = fixture({ 'a.md': 'p' }, { 'a.md': 's' });
        expect(captureProjectionDecision(root, home({ 'a.md': 's' })).partition_active).toBeNull();
        const m = captureManifest({
            repoRoot: root,
            userHome: home({}),
            limit: 1,
            enumerationRule: RULE,
            env: {},
        });
        expect(m.projection.partition_active).toBeNull();
    });

    it('records an injected partition verdict, and passes it the captured repo root', () => {
        const root = fixture({ 'a.md': 'p' }, { 'a.md': 's' });
        const seen: string[] = [];
        const decision = captureProjectionDecision(root, home({ 'a.md': 's' }), {
            partitionActive: (r) => {
                seen.push(r);
                return true;
            },
        });
        expect(decision.partition_active).toBe(true);
        expect(seen).toEqual([root]);
    });

    it('gives a different layer digest when the global layer holds different names', () => {
        const root = fixture({ 'a.md': 'p' }, { 'a.md': 's' });
        const one = captureProjectionDecision(root, home({ 'a.md': 's' }));
        const two = captureProjectionDecision(root, home({ 'a.md': 's', 'b.md': 's' }));
        expect(one.layer_digest).not.toBe(two.layer_digest);
    });

});

describe('captureManifest and diffManifests', () => {
    const opts = (repoRoot: string, userHome: string) => ({
        repoRoot,
        userHome,
        limit: 2,
        enumerationRule: RULE,
        env: {} as Record<string, string | undefined>,
    });

    it('captures the corpus, the excluded remainder and the produced inventory', () => {
        const root = fixture({ 'a.md': 'a', 'b.md': 'b', 'c.md': 'c' });
        const m = captureManifest(opts(root, home({})));
        expect(m.included.map((e) => e.path)).toEqual(['.claude/rules/a.md', '.claude/rules/b.md']);
        expect(m.excluded).toHaveLength(1);
        expect(m.produced).toHaveLength(3);
    });

    it('reports an equivalent subject when only an explanatory field differs', () => {
        const root = fixture({ 'a.md': 'a', 'b.md': 'b' });
        const first = captureManifest(opts(root, home({})));
        const second = { ...first, runtime: { node: 'v99.0.0', platform: 'aix', arch: 'ppc' } };
        expect(subjectsEquivalent(first, second)).toBe(true);
        expect(diffManifests(first, second)).toEqual([]);
    });

    it('reports a differing subject when one corpus file changed, and names that file', () => {
        const root = fixture({ 'a.md': 'a', 'b.md': 'b' });
        const before = captureManifest(opts(root, home({})));
        fs.writeFileSync(path.join(root, '.claude', 'rules', 'a.md'), 'a changed');
        const after = captureManifest(opts(root, home({})));
        expect(subjectsEquivalent(before, after)).toBe(false);
        expect(diffManifests(before, after).map((d) => d.field)).toContain('included:.claude/rules/a.md');
    });

    it('reports a differing subject when a new file sorts into the corpus and displaces one', () => {
        const root = fixture({ 'b.md': 'b', 'c.md': 'c' });
        const before = captureManifest(opts(root, home({})));
        fs.writeFileSync(path.join(root, '.claude', 'rules', 'a.md'), 'a');
        const after = captureManifest(opts(root, home({})));
        expect(subjectsEquivalent(before, after)).toBe(false);
        const fields = diffManifests(before, after).map((d) => d.field);
        expect(fields).toContain('included:.claude/rules/a.md');
        expect(fields).toContain('included:.claude/rules/c.md');
    });

    it('reports every difference rather than stopping at the first', () => {
        const root = fixture({ 'a.md': 'a', 'b.md': 'b' });
        const before = captureManifest(opts(root, home({})));
        fs.writeFileSync(path.join(root, '.claude', 'rules', 'a.md'), 'a2');
        fs.writeFileSync(path.join(root, '.claude', 'rules', 'b.md'), 'b2');
        const after = captureManifest(opts(root, home({})));
        const fields = diffManifests(before, after).map((d) => d.field);
        expect(fields).toContain('included:.claude/rules/a.md');
        expect(fields).toContain('included:.claude/rules/b.md');
    });

    it('surfaces a twin appearing even when the dedup is off and no skip changed', () => {
        // With the dedup off `user_scope.skipping` is empty on both captures,
        // so the byte-identity list is the only field that can see the new
        // twin. Before it existed the difference was invisible.
        const root = fixture({ 'a.md': 'a', 'b.md': 'b' }, { 'a.md': 'source' });
        const before = captureManifest(opts(root, home({})));
        const after = captureManifest(opts(root, home({ 'a.md': 'source' })));
        const fields = diffManifests(before, after).map((d) => d.field);
        expect(fields).toContain('user_scope.byte_identical');
        expect(before.user_scope.filter((t) => t.causes_skip)).toEqual([]);
        expect(after.user_scope.filter((t) => t.causes_skip)).toEqual([]);
    });

    it('diffs the generator configuration, the one field that disambiguates a skip', () => {
        const root = fixture({ 'a.md': 'a', 'b.md': 'b' });
        const before = captureManifest(opts(root, home({})));
        const after = {
            ...before,
            generator_config: { ...before.generator_config, 'projection.scope_dedup': 'x:true' },
        };
        expect(diffManifests(before, after).map((d) => d.field)).toContain(
            'generator_config:projection.scope_dedup',
        );
    });

    it('diffs the rule population the twin table was built over', () => {
        const root = fixture({ 'a.md': 'a', 'b.md': 'b' }, { 'a.md': 's' });
        const superset = captureManifest(opts(root, home({ 'a.md': 's' })));
        const supplied = captureManifest({ ...opts(root, home({ 'a.md': 's' })), ruleNames: ['a.md'] });
        expect(superset.user_scope_population).toBe('projection-source-superset');
        expect(supplied.user_scope_population).toBe('caller-supplied');
        expect(diffManifests(superset, supplied).map((d) => d.field)).toContain('user_scope_population');
    });
});

describe('parseManifest', () => {
    it('refuses a manifest of another version rather than comparing the fields that survived', () => {
        expect(() => parseManifest({ version: 'corpus-manifest-v0', included: [], subject_digest: 'x' })).toThrow(
            CorpusManifestError,
        );
    });

    it('refuses a non-object', () => {
        expect(() => parseManifest([])).toThrow(CorpusManifestError);
    });

    it('round-trips a captured manifest', () => {
        const root = fixture({ 'a.md': 'a' });
        const m = captureManifest({
            repoRoot: root,
            userHome: home({}),
            limit: 1,
            enumerationRule: RULE,
            env: {},
        });
        expect(parseManifest(JSON.parse(serialiseManifest(m))).subject_digest).toBe(m.subject_digest);
    });

    it('refuses a manifest whose stored digest does not match its own included list', () => {
        // Left unchecked the pin was adjudicated on a value its body need not
        // support, while the per-path rows printed beside the verdict described
        // a different subject.
        const root = fixture({ 'a.md': 'a' });
        const m = captureManifest({
            repoRoot: root,
            userHome: home({}),
            limit: 1,
            enumerationRule: RULE,
            env: {},
        });
        const tampered = JSON.parse(serialiseManifest(m)) as {
            included: { sha256: string }[];
        };
        (tampered.included[0] as { sha256: string }).sha256 = 'deadbeef';
        expect(() => parseManifest(tampered)).toThrow(CorpusManifestError);
        expect(() => parseManifest(tampered)).toThrow(/does not match the digest of its own/);
    });

    it('refuses a manifest whose enumeration rule was edited away from the digest', () => {
        const root = fixture({ 'a.md': 'a' });
        const m = captureManifest({
            repoRoot: root,
            userHome: home({}),
            limit: 1,
            enumerationRule: RULE,
            env: {},
        });
        const raw = JSON.parse(serialiseManifest(m)) as Record<string, unknown>;
        raw['enumeration_rule'] = 'other-rule/v1';
        expect(() => parseManifest(raw)).toThrow(CorpusManifestError);
        delete raw['enumeration_rule'];
        expect(() => parseManifest(raw)).toThrow(/missing enumeration_rule/);
    });

    it('refuses a pin of an empty subject, which would compare equivalent to any other', () => {
        expect(() =>
            parseManifest({
                version: 'corpus-manifest-v1',
                enumeration_rule: RULE,
                included: [],
                subject_digest: subjectDigest(RULE, []),
            }),
        ).toThrow(/empty subject/);
    });
});

describe('the verify CLI contract', () => {
    it('refuses --limit on verify rather than accepting a flag it cannot honour', () => {
        // Documented for verify and silently ignored by it: the re-capture used
        // the manifest own subject count, so an operator got no effect, no
        // warning, and a green result that had not honoured the flag.
        expect(parseArgs(['verify', '--manifest', 'p.json', '--limit', '3'])).toMatch(
            /verify does not take --limit/,
        );
    });

    it('still accepts --limit on capture, where the corpus size is the operator to choose', () => {
        expect(parseArgs(['capture', '--out', 'p.json', '--limit', '3'])).toEqual({
            verb: 'capture',
            out: 'p.json',
            limit: 3,
        });
    });
});
