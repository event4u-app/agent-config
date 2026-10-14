/**
 * The settings-delta reading a cut performs
 * (road-to-a-release-that-reads-its-settings-delta).
 *
 * Every `it` title carries the step's own name, because the roadmap's
 * `verify:` lines select by `-t <name>` and a renamed title silently empties
 * the selection into a green run over zero tests.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    assert_major_migration_section,
    assert_scheduled_deprecations_clear,
} from '../../src/scripts/_lib/release_migration_gate.js';
import {
    assert_settings_surface_delta,
    belowMajorRefusalLines,
    classifySettingsDelta,
    isMajorBump,
    proofHolds,
    emitReleasedSurface,
    readReleasedSurface,
    refusalLines,
    serializeReleasedSurface,
    SETTINGS_SURFACE_FIXTURE,
    SETTINGS_SURFACE_FIXTURE_REL,
    type ReleasedSurface,
} from '../../src/scripts/_lib/release_settings_surface.js';
import { infer_bump } from '../../src/scripts/release.js';
import { REMOVED_KEYS } from '../../src/scripts/_lib/settings_removed_keys.js';
import {
    _resetRenameWarnings,
    applyRenamedKeys,
    RENAMED_KEYS,
    SETTINGS_REMOVAL_RULE,
} from '../../src/scripts/_lib/settings_renamed_keys.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HISTORY_FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'settings_removal_history.json');

interface Commitish {
    type: string;
    breaking: boolean;
}

type Classification = 'tombstoned' | 'renamed' | 'neither';

interface HistoryFixture {
    template_paths: string[];
    version_tags: number;
    consecutive_pairs: number;
    pairs_with_template: number;
    excluded_pairs: {
        count: number;
        by_bump: Record<string, number>;
        pairs: Array<{ from: string; to: string; bump: string; why: string }>;
    };
    tally: Record<string, number>;
    tally_at_tag: Record<string, number>;
    pairs: Array<{
        from: string;
        to: string;
        bump: string;
        tombstone_map_files_at_tag: string[];
        removed: Array<{
            key: string;
            classification: Classification;
            classification_at_tag: Classification;
        }>;
    }>;
}

function history(): HistoryFixture {
    return JSON.parse(fs.readFileSync(HISTORY_FIXTURE, 'utf8')) as HistoryFixture;
}

/** The live surface with one leaf deleted, and no tombstone written for it. */
function plantRemoval(base: ReleasedSurface, key: string, version: string): ReleasedSurface {
    const entries = { ...base.entries };
    expect(Object.keys(entries)).toContain(key);
    delete entries[key];
    return { ...base, version, entries };
}

/** A proof that holds: this file, naming a test title it contains. */
const PROOF = 'tests/scripts/release_settings_delta.test.ts::tombstoned-removal';

function capture(fn: (write: (line: string) => void) => void): string {
    const out: string[] = [];
    fn((line: string) => out.push(line));
    return out.join('');
}

describe('release settings delta — control', () => {
    it('control: a planted removal is invisible to everything a cut read before this change', () => {
        // The removal is planted in the SURFACE, not in the tracked zod schema:
        // reaching this state by editing `settings.ts` would make the control
        // testable only through a tracked-file edit, and the thing under test
        // is the reading, not the schema.
        const released = readReleasedSurface();
        const key = 'quality.local_auto_run';
        const live = plantRemoval(released, key, '16.6.0');

        // (a) The bump derivation sees commit SUBJECTS only. A `feat:` subject
        //     over a settings removal proposes a minor, and would propose one
        //     whatever the surface did.
        const commits: Commitish[] = [{ type: 'feat', breaking: false }];
        expect(infer_bump(commits as never)).toBe('minor');

        // (b) Neither pre-existing assertion looks at settings. Both return
        //     without a word for a minor target, with the removal planted.
        expect(() =>
            assert_scheduled_deprecations_clear('16.6.0', () => ({ returncode: 0, stdout: '', stderr: '' }) as never),
        ).not.toThrow();
        expect(() => assert_major_migration_section('16.6.0', '## 16.6.0\n', { previewOnly: true })).not.toThrow();

        // (c) …and the removal is real: the new reading finds it, so (a) and
        //     (b) are silence about something present, not about nothing.
        const findings = classifySettingsDelta(released, live);
        expect(findings.untombstoned_removals).toEqual([key]);
    });

    it('history-fixture: the eleven tag pairs are frozen with a class per key', () => {
        const h = history();
        // The walk's own shape — a figure that moves silently is what the
        // fixture exists to pin.
        expect(h.pairs).toHaveLength(11);
        expect(h.pairs_with_template).toBe(197);
        expect(h.version_tags).toBe(217);

        const byBump: Record<string, { pairs: number; keys: number }> = {};
        let keys = 0;
        for (const p of h.pairs) {
            expect(p.removed.length).toBeGreaterThan(0);
            keys += p.removed.length;
            const slot = (byBump[p.bump] ??= { pairs: 0, keys: 0 });
            slot.pairs += 1;
            slot.keys += p.removed.length;
        }
        expect(keys).toBe(80);
        expect(byBump['minor']).toEqual({ pairs: 9, keys: 75 });
        expect(byBump['major']).toEqual({ pairs: 2, keys: 5 });
        expect(byBump['patch']).toBeUndefined();

        // Every class Phase 3 branches on is present, so 'refuses' below has
        // known inputs of each rather than a corpus that happens to be clean.
        expect(h.tally).toEqual({ tombstoned: 61, renamed: 1, neither: 18 });

        // The classification is a reading of the live maps, not a copied
        // literal: re-derive it here and require agreement key by key.
        for (const p of h.pairs) {
            for (const r of p.removed) {
                const expected = REMOVED_KEYS.has(r.key)
                    ? 'tombstoned'
                    : RENAMED_KEYS.has(r.key)
                      ? 'renamed'
                      : 'neither';
                expect(`${r.key}=${r.classification}`).toBe(`${r.key}=${expected}`);
            }
        }

        // The eighteen unannotated removals are all pre-9.x, and at each of
        // those tags NO tombstone map existed — so they are an era with no
        // mechanism, not an era that had one and skipped it.
        const unannotated = h.pairs.filter((p) => p.removed.some((r) => r.classification === 'neither'));
        expect(unannotated.map((p) => p.to)).toEqual(['1.12.0', '1.20.0', '2.13.0', '3.1.0', '5.7.0']);
        for (const p of unannotated) {
            expect(`${p.to}:${String(p.tombstone_map_files_at_tag.length)}`).toBe(`${p.to}:0`);
        }

        // Classifying past removals against TODAY's maps could in principle
        // credit a release with an entry added later. It does not here: the
        // at-tag reading agrees with the today reading on every key, which is
        // a measurement rather than a defence.
        expect(h.tally_at_tag).toEqual(h.tally);
        for (const p of h.pairs) {
            for (const r of p.removed) {
                expect(`${p.to}/${r.key}`).toBe(`${p.to}/${r.key}`);
                expect(r.classification_at_tag).toBe(r.classification);
            }
        }

        // The ASSERTION classifies the frozen history exactly as the fixture
        // marks it — not a second copy of the same predicate, but the function
        // the cut actually calls, fed each pair as a removal.
        const live = emitReleasedSurface('16.6.0');
        for (const p of h.pairs) {
            const keys = p.removed.map((r) => r.key);
            const before: ReleasedSurface = {
                ...live,
                version: p.from,
                entries: {
                    ...live.entries,
                    ...Object.fromEntries(keys.map((k) => [k, { type: 'string', default: '' }])),
                },
            };
            const after: ReleasedSurface = { ...live, version: p.to };
            const f = classifySettingsDelta(before, after);
            const got = new Map<string, Classification>();
            for (const k of f.untombstoned_removals) got.set(k, 'neither');
            for (const c of f.carried_removals) got.set(c.key, c.via === 'renamed' ? 'renamed' : 'tombstoned');
            for (const r of p.removed) {
                expect(`${p.to}/${r.key}=${String(got.get(r.key))}`).toBe(
                    `${p.to}/${r.key}=${r.classification}`,
                );
            }
            // Every removal of the pair is accounted for, none invented.
            expect(f.untombstoned_removals.length + f.carried_removals.length).toBe(keys.length);
        }

        // The pairs the walk could not read are a contiguous PREFIX of
        // history, before the template existed — and carry no major, so
        // dropping them cannot tilt the minor-versus-major split above.
        expect(h.consecutive_pairs).toBe(h.pairs_with_template + h.excluded_pairs.count);
        expect(h.excluded_pairs.count).toBe(19);
        expect(h.excluded_pairs.by_bump['major']).toBeUndefined();
        expect(h.excluded_pairs.pairs.map((e) => e.to).every((t) => t.startsWith('1.'))).toBe(true);
    });
});

describe('release settings delta — the released surface', () => {
    it('emit: the surface is derived, sorted, description-free and reproducible', () => {
        const a = emitReleasedSurface('9.9.9');
        const b = emitReleasedSurface('9.9.9');
        expect(serializeReleasedSurface(a)).toBe(serializeReleasedSurface(b));

        const keys = Object.keys(a.entries);
        expect(keys.length).toBeGreaterThan(50);
        expect(keys).toEqual([...keys].sort());
        for (const [k, e] of Object.entries(a.entries)) {
            expect(`${k}:${String('description' in e)}`).toBe(`${k}:false`);
            expect(e.type).toBeDefined();
        }

        expect(a.removedKeys).toEqual([...REMOVED_KEYS.keys()].sort());
        expect(a.renamedKeys).toEqual([...RENAMED_KEYS.entries()].sort((x, y) => x[0].localeCompare(y[0])));
        expect(a.version).toBe('9.9.9');
    });

    it('single-writer: the committed file is written by the cut and nothing else', () => {
        const committed = readReleasedSurface();
        // It is a real surface, not a stub: the live schema at the committed
        // version agrees with it key for key.
        expect(Object.keys(committed.entries).length).toBeGreaterThan(50);
        expect(serializeReleasedSurface(committed)).toBe(
            serializeReleasedSurface(emitReleasedSurface(committed.version)),
        );

        // Writer set, read from the source tree. The CALL shape and not the
        // bare name: prose elsewhere names the function, and a mention is not
        // a writer. `--untracked` so the module counts on the branch that
        // introduces it, where it is not yet in the index.
        const callers = execFileSync(
            'git',
            ['grep', '-l', '--untracked', '-e', 'writeReleasedSurface(', '--', 'src/'],
            { cwd: REPO_ROOT, encoding: 'utf8' },
        )
            .split('\n')
            .filter(Boolean)
            .sort();
        expect(callers).toEqual([
            'src/scripts/_lib/release_settings_surface.ts',
            'src/scripts/release.ts',
        ]);

        // History: every commit that MODIFIES the file also moves the package
        // version. The commit that ADDS it is excluded — the file has to
        // arrive before a cut can rewrite it, and that arrival is this change.
        let log: string;
        try {
            log = execFileSync(
                'git',
                ['log', '--format=%H', '--diff-filter=M', '--', SETTINGS_SURFACE_FIXTURE_REL],
                { cwd: REPO_ROOT, encoding: 'utf8' },
            );
        } catch {
            // No git history reachable (an exported tree, a shallow fetch that
            // does not reach the file). The writer-set assertion above still
            // holds; this half simply has nothing to read.
            return;
        }
        for (const sha of log.split('\n').filter(Boolean)) {
            const touched = execFileSync('git', ['show', '--name-only', '--format=', sha], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            })
                .split('\n')
                .filter(Boolean);
            expect(`${sha}:${String(touched.includes('package.json'))}`).toBe(`${sha}:true`);
        }
    });
});

describe('release settings delta — the assertion', () => {
    it('refuses: each of the four classes is named, and a clean surface is not', () => {
        const base = readReleasedSurface();
        const enumKey = Object.keys(base.entries).find((k) => (base.entries[k]?.enum ?? []).length > 1);
        expect(enumKey).toBeDefined();
        const typedKey = Object.keys(base.entries).find((k) => base.entries[k]?.type === 'boolean');
        expect(typedKey).toBeDefined();

        // (0) The identical surface refuses nothing — the control for the four
        //     branches below, without which a gate that always fires would pass
        //     every one of them.
        expect(refusalLines(classifySettingsDelta(base, { ...base, version: '16.6.0' }))).toEqual([]);

        // (1) removed, in neither map
        const removed = plantRemoval(base, 'quality.local_auto_run', '16.6.0');
        expect(refusalLines(classifySettingsDelta(base, removed))[0]).toContain('quality.local_auto_run');
        expect(classifySettingsDelta(base, removed).untombstoned_removals).toEqual(['quality.local_auto_run']);

        // (2) type changed
        const retyped: ReleasedSurface = {
            ...base,
            version: '16.6.0',
            entries: { ...base.entries, [typedKey as string]: { type: 'string', default: '' } },
        };
        expect(classifySettingsDelta(base, retyped).type_changed).toEqual([typedKey]);
        expect(refusalLines(classifySettingsDelta(base, retyped)).join('\n')).toContain('type changed');

        // (3) a vocabulary value removed
        const vocab = base.entries[enumKey as string] as ReleasedSurface['entries'][string];
        const narrowed: ReleasedSurface = {
            ...base,
            version: '16.6.0',
            entries: {
                ...base.entries,
                [enumKey as string]: { ...vocab, enum: (vocab.enum ?? []).slice(0, 1) },
            },
        };
        const lost = classifySettingsDelta(base, narrowed).enum_removed;
        expect(lost).toHaveLength(1);
        expect(lost[0]?.key).toBe(enumKey);
        expect(lost[0]?.values.length).toBeGreaterThan(0);

        // (4) a key added with no default
        const added: ReleasedSurface = {
            ...base,
            version: '16.6.0',
            entries: { ...base.entries, 'planted.no_default': { type: 'string' } },
        };
        expect(classifySettingsDelta(base, added).added_without_default).toEqual(['planted.no_default']);

        // A key added WITH a default is not a refusal — an existing install
        // keeps working and the default says what it now does.
        const benign: ReleasedSurface = {
            ...base,
            version: '16.6.0',
            entries: { ...base.entries, 'planted.with_default': { type: 'string', default: '' } },
        };
        expect(refusalLines(classifySettingsDelta(base, benign))).toEqual([]);

        // A tombstoned removal is CARRIED, not refused by this step — which
        // owner answer governs it is blocker `what-a-minor-may-remove`.
        const tombstoned = [...REMOVED_KEYS.keys()][0] as string;
        const carriedBase: ReleasedSurface = {
            ...base,
            entries: { ...base.entries, [tombstoned]: { type: 'boolean', default: false } },
        };
        const carried = classifySettingsDelta(carriedBase, { ...base, version: '16.6.0' });
        expect(carried.untombstoned_removals).toEqual([]);
        expect(carried.carried_removals.map((r) => r.key)).toContain(tombstoned);
    });

    it('control-flipped: the 1.1 removal now reports in dry-run and refuses a real cut', () => {
        const base = readReleasedSurface();
        const key = 'quality.local_auto_run';
        const live = plantRemoval(base, key, '16.6.0');
        const emit = (): ReleasedSurface => live;
        const read = (): ReleasedSurface => base;

        // Dry-run: reports, returns, exit code untouched.
        const preview = capture((write) => {
            const f = assert_settings_surface_delta('16.6.0', { previewOnly: true, emit, read, write });
            expect(f?.untombstoned_removals).toEqual([key]);
        });
        expect(preview).toContain(key);
        expect(preview).toContain('WOULD BE REFUSED');

        // Real cut: refuses, and names the key. `die` writes its sentence to
        // the process's own stderr and throws `SystemExitError`, whose message
        // is the exit code — so the sentence is read there, not off the error.
        let refused = false;
        const errLines: string[] = [];
        const origErr = process.stderr.write.bind(process.stderr);
        (process.stderr as { write: unknown }).write = (chunk: string): boolean => {
            errLines.push(String(chunk));
            return true;
        };
        let refusal = '';
        try {
            refusal = capture((write) => {
                try {
                    assert_settings_surface_delta('16.6.0', { emit, read, write });
                } catch {
                    refused = true;
                }
            });
        } finally {
            process.stderr.write = origErr;
        }
        expect(refused).toBe(true);
        expect(refusal).toContain(key);
        expect(errLines.join('')).toContain('refusing the 16.6.0 cut');

        // The same removal WITH a tombstone is not refused by 3.1. Below a
        // major it also needs the consumer-neutral proof 3.3 asks for — see
        // `tombstoned-removal` for the refusal without one.
        const annotated: ReleasedSurface = { ...live, removedKeys: [...live.removedKeys, key].sort() };
        capture((write) => {
            const f = assert_settings_surface_delta('16.6.0', {
                emit: () => annotated,
                read,
                write,
                proofs: new Map([[key, PROOF]]),
            });
            expect(f?.untombstoned_removals).toEqual([]);
            expect(f?.carried_removals.map((r) => r.key)).toContain(key);
        });
    });

    it('tombstoned-removal: below a major a carried removal needs a proof, at a major it does not', () => {
        const base = readReleasedSurface();
        const key = 'quality.local_auto_run';
        const live = plantRemoval(base, key, '16.6.0');
        const tombstoned: ReleasedSurface = { ...live, removedKeys: [...live.removedKeys, key].sort() };
        const f = classifySettingsDelta(base, tombstoned);
        expect(f.carried_removals.map((r) => r.key)).toEqual([key]);

        expect(isMajorBump('16.5.0', '16.6.0')).toBe(false);
        expect(isMajorBump('16.5.0', '17.0.0')).toBe(true);
        expect(isMajorBump('16.5.0', '17.0.0-next.1')).toBe(true);

        // Below a major, no proof: refused, and the key is named.
        const none = belowMajorRefusalLines(base, tombstoned, f, '16.6.0', new Map());
        expect(none).toHaveLength(1);
        expect(none[0]).toContain(key);
        // A proof naming a test the tree does not contain is no proof.
        expect(proofHolds('tests/scripts/consumer_matrix_settings_delta.test.ts::no such title anywhere')).toBe(false);
        expect(proofHolds('tests/scripts/missing.test.ts::tombstoned-removal')).toBe(false);
        expect(proofHolds('no-separator')).toBe(false);
        expect(belowMajorRefusalLines(base, tombstoned, f, '16.6.0', new Map([[key, 'x::y']]))).toHaveLength(1);
        // A proof that holds licenses the minor.
        expect(proofHolds(PROOF)).toBe(true);
        expect(belowMajorRefusalLines(base, tombstoned, f, '16.6.0', new Map([[key, PROOF]]))).toEqual([]);
        // At a major the same removal needs nothing more than its tombstone.
        expect(belowMajorRefusalLines(base, { ...tombstoned, version: '17.0.0' }, f, '17.0.0', new Map())).toEqual([]);

        // A rename is a removal too: carried, and below a major it needs a proof.
        const renamedTo = 'quality.local_auto_run_renamed';
        const renamed: ReleasedSurface = {
            ...live,
            entries: { ...live.entries, [renamedTo]: { type: 'boolean', default: true } },
            renamedKeys: [...live.renamedKeys, [key, renamedTo] as [string, string]],
        };
        const fr = classifySettingsDelta(base, renamed);
        expect(fr.carried_removals).toEqual([{ key, via: 'renamed', to: renamedTo }]);
        expect(belowMajorRefusalLines(base, renamed, fr, '16.6.0', new Map())[0]).toContain(key);

        // Dropping an alias is the removal it postponed: refused below a major.
        const alias = base.renamedKeys[0];
        expect(alias).toBeDefined();
        const aliasDropped: ReleasedSurface = { ...base, version: '16.6.0', renamedKeys: [] };
        const fd = classifySettingsDelta(base, aliasDropped);
        const dropLines = belowMajorRefusalLines(base, aliasDropped, fd, '16.6.0', new Map());
        expect(dropLines.join('\n')).toContain(`rename alias dropped below a major: ${alias?.[0]}`);
        expect(belowMajorRefusalLines(base, aliasDropped, fd, '17.0.0', new Map())).toEqual([]);

        // Through the assertion: dry-run reports, a real minor cut refuses.
        const preview = capture((write) => {
            assert_settings_surface_delta('16.6.0', {
                previewOnly: true,
                emit: () => tombstoned,
                read: () => base,
                write,
                proofs: new Map(),
            });
        });
        expect(preview).toContain('no consumer-neutral proof');
        expect(preview).toContain('WOULD BE REFUSED');
        const origErr = process.stderr.write.bind(process.stderr);
        const errLines: string[] = [];
        (process.stderr as { write: unknown }).write = (chunk: string): boolean => {
            errLines.push(String(chunk));
            return true;
        };
        let refused = false;
        try {
            capture((write) => {
                try {
                    assert_settings_surface_delta('16.6.0', {
                        emit: () => tombstoned,
                        read: () => base,
                        write,
                        proofs: new Map(),
                    });
                } catch {
                    refused = true;
                }
            });
        } finally {
            process.stderr.write = origErr;
        }
        expect(refused).toBe(true);
        expect(errLines.join('')).toContain(SETTINGS_REMOVAL_RULE);
    });

    it('wired: the planner calls the assertion where it calls the other two', () => {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/release.ts'), 'utf8');
        expect(src).toContain('assert_settings_surface_delta(target, { previewOnly: args.dry_run });');
        expect(src).toContain('writeReleasedSurface(plan.target);');
        // The committed file is on the release PR's allowlist, or the cut
        // writes a file its own shape step refuses.
        const shapeSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/check_release_pr_shape.ts'), 'utf8');
        expect(shapeSrc).toContain(SETTINGS_SURFACE_FIXTURE_REL);
    });

    it('the committed fixture sits where the module says it does', () => {
        expect(fs.existsSync(SETTINGS_SURFACE_FIXTURE)).toBe(true);
        expect(path.relative(REPO_ROOT, SETTINGS_SURFACE_FIXTURE).split(path.sep).join('/')).toBe(
            SETTINGS_SURFACE_FIXTURE_REL,
        );
    });
});

/**
 * The eight places the tree states when a settings key may be removed or
 * renamed (blocker `what-a-minor-may-remove`, enumerated 2026-10-14). The
 * sentence is written here as its own literal, so a reworded constant fails
 * this test exactly as a reworded document does.
 */
const RULE =
    'A settings key may be removed or renamed in a minor release only when no consumer project can ' +
    'rely on it — default-neutral and derivable, proven by a named test; any other removal or rename ' +
    "ships only in a major, and a renamed key's alias is dropped only in a major.";

const RULE_LOCATIONS = [
    'docs/releases.md',
    'src/scripts/_lib/settings_renamed_keys.ts',
    'src/scripts/_lib/settings_removed_keys.ts',
    'BREAKING_CHANGES.md',
    'CONTRIBUTING.md',
    'docs/contracts/CHANGELOG-conventions.md',
    'docs/decisions/ADR-037-cost-profile-untangle.md',
] as const;

/** Comment prefixes and line wrapping removed, so a wrapped sentence reads as one. */
function prose(file: string): string {
    return fs
        .readFileSync(path.join(REPO_ROOT, file), 'utf8')
        .replace(/^\s*(\*|\/\/)\s?/gm, '')
        .replace(/\s+/g, ' ');
}

describe('release settings delta — one rule', () => {
    it('three-sentences-agree: all eight locations state the owner rule in the same words', () => {
        expect(SETTINGS_REMOVAL_RULE).toBe(RULE);
        for (const file of RULE_LOCATIONS) {
            expect(prose(file), file).toContain(RULE);
            // The superseded retention sentences may not survive beside it.
            expect(prose(file), file).not.toMatch(/one minor after it lands|works for one minor/);
        }
        // Location eight: the warning a consumer is actually shown.
        _resetRenameWarnings();
        const [oldKey] = [...RENAMED_KEYS.keys()];
        expect(oldKey).toBeDefined();
        const layer: Record<string, unknown> = {};
        let cur = layer;
        const parts = (oldKey as string).split('.');
        for (const part of parts.slice(0, -1)) {
            cur[part] = {};
            cur = cur[part] as Record<string, unknown>;
        }
        cur[parts[parts.length - 1] as string] = true;
        const seen: string[] = [];
        const origErr = process.stderr.write.bind(process.stderr);
        (process.stderr as { write: unknown }).write = (chunk: string): boolean => {
            seen.push(String(chunk));
            return true;
        };
        try {
            applyRenamedKeys(layer);
        } finally {
            process.stderr.write = origErr;
            _resetRenameWarnings();
        }
        expect(seen.join('')).toContain(RULE);
        expect(seen.join('')).not.toContain('one minor');
    });
});
