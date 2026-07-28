import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYamlLib, stringify as stringifyYamlLib } from 'yaml';

import {
    checkInvalidation,
    classifyBorrow,
    derivePolicyBuckets,
    detectSpdxFromManifestLicenseField,
    detectSpdxFromText,
    detectTargetLicense,
    expandSourceClassesToSpdxIds,
    mergeOverride,
    sourceClassOfSpdxId,
    SOURCE_CLASSES,
    type DetectionResult,
    type LicensePolicyDoc,
    type SourceClass,
} from '../../src/scripts/_lib/detect_target_license.js';
import { main, parseArgs, POLICY_FILENAME, serializeLicensePolicy } from '../../src/scripts/detect_target_license.js';
import { resolveDenyPolicy } from '../../src/scripts/lint_provenance.js';
import { load_schema, validate } from '../../src/scripts/validate_frontmatter.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(_HERE, '..', 'fixtures', 'license-detect');

function muteOutput(): void {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
}

function captureStdout(): { text: () => string } {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        chunks.push(String(chunk));
        return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    return { text: () => chunks.join('') };
}

afterEach(() => {
    vi.restoreAllMocks();
});

// ── the closed compatibility matrix (transcribed per the roadmap's 5 rows) ──

describe('derivePolicyBuckets — the S1.2 compatibility matrix', () => {
    it('permissive target: fully specified by the roadmap row, no gaps', () => {
        expect(derivePolicyBuckets('permissive')).toEqual({
            allow: ['permissive', 'public-domain'],
            conditional: ['weak-copyleft'],
            deny: ['gpl-2.0', 'gpl-3.0', 'agpl', 'sspl', 'unknown'],
        });
    });

    it('weak-copyleft target: public-domain is an unstated gap -> conditional (escalate), never guessed', () => {
        expect(derivePolicyBuckets('weak-copyleft')).toEqual({
            allow: ['permissive', 'weak-copyleft'],
            conditional: ['public-domain', 'gpl-2.0', 'gpl-3.0'],
            deny: ['agpl', 'sspl', 'unknown'],
        });
    });

    it('gpl-2.0 target: AGPL denied — the roadmap parenthetical "(for GPL-2.0)"', () => {
        expect(derivePolicyBuckets('gpl-2.0')).toEqual({
            allow: ['permissive', 'gpl-2.0', 'gpl-3.0'],
            conditional: ['public-domain', 'weak-copyleft'],
            deny: ['agpl', 'sspl', 'unknown'],
        });
    });

    it('gpl-3.0 target: AGPL allowed — the same qualifier scopes the denial to GPL-2.0 only', () => {
        expect(derivePolicyBuckets('gpl-3.0')).toEqual({
            allow: ['permissive', 'gpl-2.0', 'gpl-3.0', 'agpl'],
            conditional: ['public-domain', 'weak-copyleft'],
            deny: ['sspl', 'unknown'],
        });
    });

    it('agpl target: conditional column is "—" in the roadmap; unstated public-domain AND agpl-on-agpl still escalate', () => {
        // The roadmap's AGPL-row allow cell reads "permissive + GPL-family" — it never names AGPL
        // itself as a member of that allow set, so an AGPL-licensed source against an AGPL target
        // is an unstated gap too (folded into conditional, per the same never-guess discipline
        // applied everywhere else in this matrix, even though "AGPL borrowing AGPL" is intuitively
        // safe — flagged as a residual ambiguity worth a human decision, not silently special-cased).
        expect(derivePolicyBuckets('agpl')).toEqual({
            allow: ['permissive', 'weak-copyleft', 'gpl-2.0', 'gpl-3.0'],
            conditional: ['public-domain', 'agpl'],
            deny: ['sspl', 'unknown'],
        });
    });

    it('none-detected/proprietary target: "everything else" resolves to public-domain only', () => {
        expect(derivePolicyBuckets('none')).toEqual({
            allow: ['permissive'],
            conditional: ['public-domain'],
            deny: ['weak-copyleft', 'gpl-2.0', 'gpl-3.0', 'agpl', 'sspl', 'unknown'],
        });
    });

    it('sourceClassOfSpdxId is the exact reverse of expandSourceClassesToSpdxIds', () => {
        expect(sourceClassOfSpdxId('AGPL-3.0')).toBe('agpl');
        expect(sourceClassOfSpdxId('GPL-2.0')).toBe('gpl-2.0');
        expect(sourceClassOfSpdxId('MIT')).toBe('permissive');
        expect(sourceClassOfSpdxId('SSPL-1.0')).toBe('sspl');
    });

    it('unknown source is an absolute deny invariant across every target class', () => {
        for (const target of ['permissive', 'weak-copyleft', 'gpl-2.0', 'gpl-3.0', 'agpl', 'none'] as const) {
            expect(classifyBorrow(target, 'unknown')).toBe('deny');
        }
    });

    it('every derived bucket set is exhaustive over the closed SourceClass enum', () => {
        for (const target of ['permissive', 'weak-copyleft', 'gpl-2.0', 'gpl-3.0', 'agpl', 'none'] as const) {
            const buckets = derivePolicyBuckets(target);
            const all = [...buckets.allow, ...buckets.conditional, ...buckets.deny].sort();
            expect(all).toEqual([...SOURCE_CLASSES].sort());
        }
    });
});

// ── SPDX detection from text ─────────────────────────────────────────────────

describe('detectSpdxFromText', () => {
    it('detects an explicit SPDX-License-Identifier tag over any body heuristic', () => {
        expect(detectSpdxFromText('SPDX-License-Identifier: Apache-2.0\n\nsome other text')).toBe('Apache-2.0');
    });

    it('detects AGPL-3.0, and never confuses it with plain GPL', () => {
        expect(detectSpdxFromText('GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3, 19 November 2007')).toBe('AGPL-3.0');
    });

    it('detects LGPL by version, and returns null when the version is unstated', () => {
        expect(detectSpdxFromText('GNU LESSER GENERAL PUBLIC LICENSE\nVersion 2.1, February 1999')).toBe('LGPL-2.1');
        expect(detectSpdxFromText('GNU LESSER GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007')).toBe('LGPL-3.0');
        expect(detectSpdxFromText('GNU LESSER GENERAL PUBLIC LICENSE\n(no version line)')).toBeNull();
    });

    it('distinguishes BSD-2-Clause from BSD-3-Clause by the "Neither the name" clause', () => {
        const twoClause = 'Redistributions of source code must retain the above copyright notice. Redistributions in binary form must reproduce it.';
        const threeClause = `${twoClause} Neither the name of the copyright holder nor the names of its contributors may be used to endorse.`;
        expect(detectSpdxFromText(twoClause)).toBe('BSD-2-Clause');
        expect(detectSpdxFromText(threeClause)).toBe('BSD-3-Clause');
    });

    it('returns null for unrecognizable text — never a guess', () => {
        expect(detectSpdxFromText('Some proprietary internal notice, all rights reserved.')).toBeNull();
    });
});

describe('detectSpdxFromManifestLicenseField', () => {
    it('resolves a plain SPDX-id string, case-insensitively', () => {
        expect(detectSpdxFromManifestLicenseField('MIT')).toBe('MIT');
        expect(detectSpdxFromManifestLicenseField('gpl-3.0')).toBe('GPL-3.0');
    });

    it('resolves the legacy npm { type, url } shape', () => {
        expect(detectSpdxFromManifestLicenseField({ type: 'ISC', url: 'https://example.com' })).toBe('ISC');
    });

    it('resolves an unambiguous array, refuses an ambiguous one', () => {
        expect(detectSpdxFromManifestLicenseField(['MIT', 'MIT'])).toBe('MIT');
        expect(detectSpdxFromManifestLicenseField(['MIT', 'GPL-3.0'])).toBeNull();
    });

    it('never resolves a compound SPDX expression — no branch-guessing', () => {
        expect(detectSpdxFromManifestLicenseField('(MIT OR Apache-2.0)')).toBeNull();
    });
});

// ── fixture-repo detection: one per target class + disagree + workspaces ───

describe('detectTargetLicense — per-class fixtures derive the expected policy', () => {
    it('permissive (MIT)', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'permissive'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBe('MIT');
        expect(d.targetClass).toBe('permissive');
        expect(d.licenseSha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('weak-copyleft (MPL-2.0)', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'weak-copyleft'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBe('MPL-2.0');
        expect(d.targetClass).toBe('weak-copyleft');
    });

    it('GPL (GPL-3.0) — the required "GPL" class fixture; AGPL lands in allow for this target', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'gpl'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBe('GPL-3.0');
        expect(d.targetClass).toBe('gpl-3.0');
        expect(derivePolicyBuckets(d.targetClass).allow).toContain('agpl');
    });

    it('GPL-2.0 (extra fixture) — proves the "(for GPL-2.0)" AGPL-deny qualifier', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'gpl-2'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBe('GPL-2.0');
        expect(d.targetClass).toBe('gpl-2.0');
        expect(derivePolicyBuckets(d.targetClass).deny).toContain('agpl');
    });

    it('AGPL (AGPL-3.0)', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'agpl'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBe('AGPL-3.0');
        expect(d.targetClass).toBe('agpl');
    });

    it('none-detected / no-license fixture warns and defaults to the strictest policy', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'none-detected'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBeNull();
        expect(d.targetClass).toBe('none');
        expect(d.licenseSha256).toBeNull();
        expect(d.warnings.length).toBeGreaterThan(0);
        expect(d.warnings.join(' ')).toMatch(/no discoverable license/);
    });

    it('disagree fixture (LICENSE=MIT, package.json=GPL-3.0) escalates — never auto-picks', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'disagree'));
        expect(d.escalate).toBe(true);
        expect(d.escalateReason).toMatch(/disagree/);
        expect(d.escalateReason).toMatch(/MIT/);
        expect(d.escalateReason).toMatch(/GPL-3\.0/);
    });

    it('workspaces-homogeneous: root + workspaces all MIT -> derives normally, scope is homogeneous-multi', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'workspaces-homogeneous'));
        expect(d.escalate).toBe(false);
        expect(d.spdxId).toBe('MIT');
        expect(d.workspaceScope).toBe('homogeneous-multi');
        expect(d.workspaceDirs.sort()).toEqual(['packages/a', 'packages/b']);
    });

    it('workspaces-heterogeneous: root Apache-2.0 + one workspace GPL-3.0 -> escalates, no policy derivable', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'workspaces-heterogeneous'));
        expect(d.escalate).toBe(true);
        expect(d.escalateReason).toMatch(/workspace license diverges/);
        expect(d.escalateReason).toMatch(/packages\/a/);
        expect(d.escalateReason).toMatch(/GPL-3\.0/);
        expect(d.escalateReason).toMatch(/Apache-2\.0/);
    });

    it('a repo with no declared workspaces reports scope "single"', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'permissive'));
        expect(d.workspaceScope).toBe('single');
        expect(d.workspaceDirs).toEqual([]);
    });
});

// ── invalidation: SHA mismatch -> re-derive; downgrade -> escalate ─────────

function fakeDetection(overrides: Partial<DetectionResult>): DetectionResult {
    return {
        spdxId: 'MIT',
        targetClass: 'permissive',
        detectionSource: 'license-file',
        licenseFilePath: 'LICENSE',
        licenseSha256: 'a'.repeat(64),
        escalate: false,
        escalateReason: null,
        warnings: [],
        workspaceScope: 'single',
        workspaceDirs: [],
        ...overrides,
    };
}

function fakePolicyDoc(overrides: Partial<LicensePolicyDoc>): LicensePolicyDoc {
    return {
        schema_version: 1,
        derived_from: 'MIT',
        detection: { source: 'license-file', license_sha256: 'a'.repeat(64) },
        target_class: 'permissive',
        workspace_scope: 'single',
        policy: derivePolicyBuckets('permissive'),
        deny: expandSourceClassesToSpdxIds(derivePolicyBuckets('permissive').deny),
        warnings: [],
        derived_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('checkInvalidation', () => {
    it('unchanged SHA -> unchanged, regardless of anything else', () => {
        const existing = fakePolicyDoc({});
        const fresh = fakeDetection({});
        expect(checkInvalidation(existing, fresh).action).toBe('unchanged');
    });

    it('SHA mismatch with the same target_class -> re-derive (refresh the recorded SHA)', () => {
        const existing = fakePolicyDoc({ detection: { source: 'license-file', license_sha256: 'a'.repeat(64) } });
        const fresh = fakeDetection({ licenseSha256: 'b'.repeat(64), targetClass: 'permissive' });
        expect(checkInvalidation(existing, fresh).action).toBe('re-derive');
    });

    it('SHA mismatch + a downgrade (weak-copyleft -> permissive) escalates', () => {
        // weak-copyleft denies agpl/sspl/unknown; permissive ALSO denies gpl/agpl/sspl/unknown —
        // no denied source becomes allowed, so this transition is NOT a downgrade.
        // permissive -> agpl target IS a downgrade: agpl's allow set includes gpl-2.0/gpl-3.0/weak-copyleft,
        // all of which permissive denies.
        const existing = fakePolicyDoc({
            target_class: 'permissive',
            detection: { source: 'license-file', license_sha256: 'a'.repeat(64) },
        });
        const fresh = fakeDetection({ licenseSha256: 'b'.repeat(64), targetClass: 'agpl' });
        const verdict = checkInvalidation(existing, fresh);
        expect(verdict.action).toBe('escalate');
        expect(verdict.reason).toMatch(/downgrade/);
    });

    it('SHA mismatch + a strictly-safe move (permissive -> weak-copyleft) re-derives', () => {
        // permissive's deny set is a superset of weak-copyleft's deny set restricted to what
        // weak-copyleft newly allows (weak-copyleft) — permissive already allowed permissive+PD,
        // and weak-copyleft's allow (permissive, weak-copyleft) does not include anything
        // permissive denied that isn't also still denied elsewhere; verified via the matrix directly.
        const existing = fakePolicyDoc({ target_class: 'weak-copyleft' });
        const fresh = fakeDetection({ licenseSha256: 'b'.repeat(64), targetClass: 'gpl-2.0' });
        // weak-copyleft denies agpl/sspl/unknown; gpl-2.0 allows permissive/gpl-2.0/gpl-3.0 — no overlap.
        expect(checkInvalidation(existing, fresh).action).toBe('re-derive');
    });

    it('derived_from: manual is never invalidated, even on a SHA + class change', () => {
        const existing = fakePolicyDoc({ derived_from: 'manual', target_class: 'agpl' });
        const fresh = fakeDetection({ licenseSha256: 'c'.repeat(64), targetClass: 'permissive' });
        expect(checkInvalidation(existing, fresh).action).toBe('unchanged');
    });
});

// ── override merge: tighten accepted, loosen rejected without manual ───────

describe('mergeOverride', () => {
    it('accepts a tightened override (existing denies a class the fresh derivation allows)', () => {
        const fresh = fakePolicyDoc({ target_class: 'gpl-3.0', policy: derivePolicyBuckets('gpl-3.0'), deny: [] });
        const tightened: ClassBucketsLike = {
            allow: fresh.policy.allow.filter((c) => c !== 'agpl'),
            conditional: fresh.policy.conditional,
            deny: [...fresh.policy.deny, 'agpl'],
        };
        const existing = fakePolicyDoc({ target_class: 'gpl-3.0', policy: tightened, deny: [] });
        const { doc, rejectedOverrides } = mergeOverride(existing, fresh);
        expect(rejectedOverrides).toEqual([]);
        expect(doc.policy.deny).toContain('agpl');
        expect(doc.policy.allow).not.toContain('agpl');
    });

    it('rejects a loosened override without derived_from: manual, reverting to the derived value', () => {
        const fresh = fakePolicyDoc({ target_class: 'permissive', policy: derivePolicyBuckets('permissive') });
        const loosened: ClassBucketsLike = {
            allow: [...fresh.policy.allow, 'agpl'], // permissive denies agpl — this is a loosen
            conditional: fresh.policy.conditional,
            deny: fresh.policy.deny.filter((c) => c !== 'agpl'),
        };
        const existing = fakePolicyDoc({ target_class: 'permissive', policy: loosened });
        const { doc, rejectedOverrides } = mergeOverride(existing, fresh);
        expect(rejectedOverrides.length).toBeGreaterThan(0);
        expect(rejectedOverrides.join(' ')).toMatch(/agpl/);
        expect(doc.policy.deny).toContain('agpl'); // reverted to the derived (denied) value
        expect(doc.policy.allow).not.toContain('agpl');
    });

    it('a manual file is returned unchanged, with zero rejections, no matter what fresh says', () => {
        const fresh = fakePolicyDoc({ target_class: 'permissive', policy: derivePolicyBuckets('permissive') });
        const existing = fakePolicyDoc({
            derived_from: 'manual',
            target_class: 'permissive',
            policy: { allow: [...SOURCE_CLASSES], conditional: [], deny: [] }, // wide-open, would be a loosen everywhere
        });
        const { doc, rejectedOverrides } = mergeOverride(existing, fresh);
        expect(rejectedOverrides).toEqual([]);
        expect(doc).toBe(existing);
    });
});

interface ClassBucketsLike {
    allow: SourceClass[];
    conditional: SourceClass[];
    deny: SourceClass[];
}

// ── schema validation ────────────────────────────────────────────────────────

describe('license-policy.yaml schema', () => {
    it('a freshly-derived permissive policy validates against license-policy.schema.json', () => {
        const d = detectTargetLicense(path.join(FIXTURES, 'permissive'));
        const doc = fakePolicyDoc({
            derived_from: d.spdxId ?? 'none-detected',
            target_class: d.targetClass,
            policy: derivePolicyBuckets(d.targetClass),
            deny: expandSourceClassesToSpdxIds(derivePolicyBuckets(d.targetClass).deny),
            detection: { source: d.detectionSource, license_sha256: d.licenseSha256 },
        });
        const schema = load_schema('license-policy');
        expect(validate(doc as unknown as never, schema)).toEqual([]);
    });

    it('round-trips through YAML serialize/parse without losing the schema-valid shape', () => {
        const doc = fakePolicyDoc({});
        const text = serializeLicensePolicy(doc);
        expect(text).toContain('derived_from: MIT');
        const schema = load_schema('license-policy');
        const parsed = JSON.parse(JSON.stringify(doc)); // same normalization the yaml round-trip performs
        expect(validate(parsed as unknown as never, schema)).toEqual([]);
    });
});

// ── interop: the emitted top-level `deny` array is what lint_provenance.ts reads ──

describe('interop with lint_provenance.ts resolveDenyPolicy()', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-detect-interop-'));
        fs.cpSync(path.join(FIXTURES, 'gpl'), tmpDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('a --write policy is read directly by resolveDenyPolicy() with no changes on that side', () => {
        muteOutput();
        const exit = main([tmpDir, '--write']);
        expect(exit).toBe(0);
        expect(fs.existsSync(path.join(tmpDir, POLICY_FILENAME))).toBe(true);

        const denyPolicy = resolveDenyPolicy(tmpDir);
        expect(denyPolicy.source).toBe('license-policy.yaml');
        // gpl-3.0 target denies sspl + unknown (concrete ids only) — AGPL-3.0 is allowed for this target.
        expect(denyPolicy.denyIds.has('SSPL-1.0')).toBe(true);
        expect(denyPolicy.denyIds.has('AGPL-3.0')).toBe(false);
    });
});

// ── CLI ──────────────────────────────────────────────────────────────────────

describe('CLI', () => {
    it('parseArgs: default repo path is ".", flags parsed independently of order', () => {
        expect(parseArgs([])).toEqual({ repoPath: '.', write: false, json: false, help: false });
        expect(parseArgs(['--write', '/tmp/repo', '--json'])).toEqual({
            repoPath: '/tmp/repo', write: true, json: true, help: false,
        });
    });

    it('--help exits 0 and prints usage', () => {
        const out = captureStdout();
        expect(main(['--help'])).toBe(0);
        expect(out.text()).toMatch(/usage: detect_target_license/);
    });

    it('a non-existent repo path exits 1', () => {
        muteOutput();
        expect(main([path.join(FIXTURES, 'does-not-exist')])).toBe(1);
    });

    it('dry run (no --write) on the disagree fixture exits 2 and writes nothing', () => {
        const out = captureStdout();
        expect(main([path.join(FIXTURES, 'disagree')])).toBe(2);
        expect(out.text()).toMatch(/ESCALATE/);
        expect(fs.existsSync(path.join(FIXTURES, 'disagree', POLICY_FILENAME))).toBe(false);
    });

    it('dry run on the heterogeneous-workspace fixture exits 2 and writes nothing', () => {
        const out = captureStdout();
        expect(main([path.join(FIXTURES, 'workspaces-heterogeneous')])).toBe(2);
        expect(out.text()).toMatch(/ESCALATE/);
        expect(fs.existsSync(path.join(FIXTURES, 'workspaces-heterogeneous', POLICY_FILENAME))).toBe(false);
    });

    it('dry run (no --write) on a clean fixture exits 0 and writes nothing', () => {
        muteOutput();
        expect(main([path.join(FIXTURES, 'permissive')])).toBe(0);
        expect(fs.existsSync(path.join(FIXTURES, 'permissive', POLICY_FILENAME))).toBe(false);
    });

    describe('--write end-to-end against a temp copy', () => {
        let tmpDir: string;

        beforeEach(() => {
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-detect-cli-'));
        });

        afterEach(() => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });

        it('writes a schema-valid license-policy.yaml for a clean permissive repo', () => {
            fs.cpSync(path.join(FIXTURES, 'permissive'), tmpDir, { recursive: true });
            muteOutput();
            expect(main([tmpDir, '--write'])).toBe(0);

            const written = fs.readFileSync(path.join(tmpDir, POLICY_FILENAME), 'utf8');
            const parsed = JSON.parse(JSON.stringify(parseYamlLib(written)));
            const schema = load_schema('license-policy');
            expect(validate(parsed, schema)).toEqual([]);
            expect(parsed.derived_from).toBe('MIT');
            expect(parsed.target_class).toBe('permissive');
        });

        it('a second --write with an unchanged LICENSE file is a no-op re-derive (still schema-valid)', () => {
            fs.cpSync(path.join(FIXTURES, 'permissive'), tmpDir, { recursive: true });
            muteOutput();
            expect(main([tmpDir, '--write'])).toBe(0);
            const out = captureStdout();
            expect(main([tmpDir, '--write'])).toBe(0);
            expect(out.text()).toMatch(/unchanged/);
        });

        it('rejects a hand-loosened override on the on-disk file (no derived_from: manual)', () => {
            fs.cpSync(path.join(FIXTURES, 'permissive'), tmpDir, { recursive: true });
            muteOutput();
            expect(main([tmpDir, '--write'])).toBe(0);

            const policyPath = path.join(tmpDir, POLICY_FILENAME);
            const doc = parseYamlLib(fs.readFileSync(policyPath, 'utf8')) as LicensePolicyDoc;
            doc.policy.allow.push('agpl'); // hand-loosen without derived_from: manual
            doc.policy.deny = doc.policy.deny.filter((c) => c !== 'agpl');
            fs.writeFileSync(policyPath, stringifyYamlLib(doc), 'utf8');

            const out = captureStdout();
            expect(main([tmpDir, '--write'])).toBe(0);
            expect(out.text()).toMatch(/rejected override/);
            const reWritten = parseYamlLib(fs.readFileSync(policyPath, 'utf8')) as LicensePolicyDoc;
            expect(reWritten.policy.allow).not.toContain('agpl');
            expect(reWritten.policy.deny).toContain('agpl');
        });

        it('a derived_from: manual file is never overwritten', () => {
            fs.cpSync(path.join(FIXTURES, 'permissive'), tmpDir, { recursive: true });
            const manualDoc = {
                schema_version: 1,
                derived_from: 'manual',
                detection: { source: 'manual', license_sha256: null },
                target_class: 'agpl',
                workspace_scope: 'single',
                policy: derivePolicyBuckets('agpl'),
                deny: expandSourceClassesToSpdxIds(derivePolicyBuckets('agpl').deny),
                warnings: [],
                derived_at: '2020-01-01T00:00:00.000Z',
            };
            fs.writeFileSync(path.join(tmpDir, POLICY_FILENAME), serializeLicensePolicy(manualDoc as unknown as LicensePolicyDoc), 'utf8');

            const out = captureStdout();
            expect(main([tmpDir, '--write'])).toBe(0);
            expect(out.text()).toMatch(/kept-manual/);
            const stillManual = parseYamlLib(fs.readFileSync(path.join(tmpDir, POLICY_FILENAME), 'utf8')) as LicensePolicyDoc;
            expect(stillManual.target_class).toBe('agpl');
            expect(stillManual.derived_at).toBe('2020-01-01T00:00:00.000Z');
        });

        it('escalates and writes nothing when a workspace license diverges', () => {
            fs.cpSync(path.join(FIXTURES, 'workspaces-heterogeneous'), tmpDir, { recursive: true });
            const out = captureStdout();
            expect(main([tmpDir, '--write'])).toBe(2);
            expect(out.text()).toMatch(/ESCALATE/);
            expect(fs.existsSync(path.join(tmpDir, POLICY_FILENAME))).toBe(false);
        });
    });
});
