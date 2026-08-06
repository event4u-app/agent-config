/**
 * `review-findings.schema.json` — ONE findings shape, enforced.
 *
 * All six external reviewers of 9.18.1 converged on one ask: the R2 gate
 * hand-parses Markdown and carries `unbalanced-fence` / `malformed-row` as
 * first-class violation kinds, i.e. defect classes for its own parser. The
 * schema answers that by naming the shape that ALREADY exists on the JSON
 * track — `self_review_gate`'s `--findings-out` emission and the release-findings
 * ledger — rather than inventing a second one.
 *
 * Two spelling choices in the schema are load-bearing and are asserted here, not
 * just commented: the repo validates with its own Draft-07 SUBSET
 * (`validate_frontmatter.ts`), which enforces `enum` under `items` but silently
 * ignores `$ref` and `const`. So the item shape is inlined and the version pin is
 * a one-member `enum`. Written the obvious way, this schema would have validated
 * nothing at all — which is the failure mode the whole gate-hardening line of
 * work exists to catch.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { findingId } from '../../src/scripts/self_review_gate.js';
import { load_schema, validate } from '../../src/scripts/validate_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const LEDGER_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'release-findings');

const schema = (): Record<string, unknown> =>
    load_schema('review-findings') as unknown as Record<string, unknown>;

const errs = (data: unknown): string[] =>
    validate(data as never, schema() as never).map((e) => e.message);

describe('review-findings schema — the real artefacts of both tracks', () => {
    it('every committed release-findings ledger validates', () => {
        const files = fs
            .readdirSync(LEDGER_DIR)
            .filter((f) => f.endsWith('.json'))
            .sort();
        // Non-empty guard: a directory-walk assertion over zero files is the
        // clean-looking pass this repo's dead-scan-root sweep exists to reject.
        expect(files.length).toBeGreaterThan(0);
        for (const f of files) {
            const ledger = JSON.parse(fs.readFileSync(path.join(LEDGER_DIR, f), 'utf8'));
            expect(errs(ledger), `${f} must validate`).toEqual([]);
        }
    });

    it('the shape self_review_gate writes under --findings-out validates', () => {
        // Reproduces the writer at self_review_gate.ts (`schema_version: 1` plus
        // findings stamped with findingId), so the schema is checked against the
        // producer's real output shape rather than a hand-written lookalike.
        const finding = {
            severity: 'high' as const,
            kind: 'correctness' as const,
            title: 'a real finding title',
            detail: 'why it matters',
            file: 'src/scripts/x.ts',
        };
        const emitted = {
            schema_version: 1,
            findings: [{ finding_id: findingId(finding), ...finding }],
        };
        expect(errs(emitted)).toEqual([]);
        // And the id really is the 12-hex sha256 prefix the schema pins.
        const expected = createHash('sha256')
            .update(`${finding.kind}|${finding.title}|${finding.file}`)
            .digest('hex')
            .slice(0, 12);
        expect(emitted.findings[0]?.finding_id).toBe(expected);
    });

    it('an empty findings array is valid — an honest null is not a missing field', () => {
        expect(errs({ schema_version: 1, findings: [] })).toEqual([]);
    });
});

describe('review-findings schema — it actually rejects', () => {
    it('rejects an off-vocabulary severity, kind, and status', () => {
        expect(errs({ schema_version: 1, findings: [{ severity: 'urgent', kind: 'security', title: 'x' }] })).not.toEqual([]);
        expect(errs({ schema_version: 1, findings: [{ severity: 'high', kind: 'vibes', title: 'x' }] })).not.toEqual([]);
        // The hyphen spelling belongs to the MARKDOWN track's Status cell. The
        // two vocabularies are deliberately not unified — renaming either would
        // break committed artefacts — so the JSON track must reject the hyphen.
        expect(
            errs({ schema_version: 1, findings: [{ severity: 'high', kind: 'security', title: 'x', status: 'accepted-risk' }] }),
        ).not.toEqual([]);
        expect(
            errs({ schema_version: 1, findings: [{ severity: 'high', kind: 'security', title: 'x', status: 'accepted_risk' }] }),
        ).toEqual([]);
    });

    it('rejects a version other than 1, and a malformed finding_id', () => {
        expect(errs({ schema_version: 2, findings: [] })).not.toEqual([]);
        expect(
            errs({ schema_version: 1, findings: [{ severity: 'low', kind: 'style', title: 'x', finding_id: 'NOTHEX' }] }),
        ).not.toEqual([]);
    });

    it('rejects a finding missing any of the three required fields', () => {
        expect(errs({ schema_version: 1, findings: [{ kind: 'security', title: 'x' }] })).not.toEqual([]);
        expect(errs({ schema_version: 1, findings: [{ severity: 'low', title: 'x' }] })).not.toEqual([]);
        expect(errs({ schema_version: 1, findings: [{ severity: 'low', kind: 'style' }] })).not.toEqual([]);
    });

    it('rejects a document missing findings entirely', () => {
        expect(errs({ schema_version: 1 })).not.toEqual([]);
    });
});

describe('review-findings schema — the two subset-validator spellings', () => {
    it('the version pin is an enum, because const validates nothing here', () => {
        // Guards the exact regression: switching this back to `const: 1` would
        // leave the pin unenforced and every assertion above would still pass
        // except this one.
        const s = schema();
        const props = (s['properties'] ?? {}) as Record<string, Record<string, unknown>>;
        expect(props['schema_version']?.['enum']).toEqual([1]);
        expect(props['schema_version']?.['const']).toBeUndefined();
    });

    it('the item shape is inlined, because $ref resolves to nothing here', () => {
        const s = schema();
        expect(s['definitions']).toBeUndefined();
        const props = (s['properties'] ?? {}) as Record<string, Record<string, unknown>>;
        const items = props['findings']?.['items'] as Record<string, unknown> | undefined;
        expect(items?.['$ref']).toBeUndefined();
        expect(items?.['properties']).toBeDefined();
    });
});
