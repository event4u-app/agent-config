import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE_DIR = 'tests/fixtures/fonts';
const TYPEFACE_EXT = /\.(ttf|otf|woff2?|ttc)$/i;

// A subset of the OSI-approved list: the identifiers an openly licensed
// typeface actually carries. Anything outside it is refused, not reviewed.
const OSI_FONT_SPDX: ReadonlySet<string> = new Set(['OFL-1.1', 'Apache-2.0', 'MIT', 'BSD-3-Clause']);

interface FixtureFamily {
    dir: string;
    file: string;
    spdx: string;
    license_file: string;
    sha256: string;
    decision: string;
}

/**
 * Set while the 2026-10-16 amendment that admitted these binaries is suspended
 * pending an owner decision. While `lifted_by` is null the binaries must be
 * ABSENT and only their pinned identity (upstream path + SHA-256) stays.
 */
interface Suspension {
    since: string;
    record: string;
    lifted_by: string | null;
}

interface FixtureManifest {
    admitted_by: string;
    suspended?: Suspension;
    families: FixtureFamily[];
}

/** Every reason the fixture set breaks its bound; empty when it holds. */
function boundFindings(root: string, manifest: FixtureManifest, trackedPaths: readonly string[]): string[] {
    const findings: string[] = [];
    if (!fs.existsSync(path.join(root, manifest.admitted_by))) {
        findings.push(`admitted_by names a record that does not exist: ${manifest.admitted_by}`);
    }
    const susp = manifest.suspended;
    if (susp !== undefined) {
        if (!fs.existsSync(path.join(root, susp.record))) {
            findings.push(`suspended.record names a record that does not exist: ${susp.record}`);
        }
        if (susp.lifted_by !== null && !fs.existsSync(path.join(root, susp.lifted_by))) {
            findings.push(`suspended.lifted_by names a record that does not exist: ${susp.lifted_by}`);
        }
    }
    const listed = new Set<string>();
    for (const fam of manifest.families) {
        const rel = `${FIXTURE_DIR}/${fam.dir}/${fam.file}`;
        listed.add(rel);
        if (!OSI_FONT_SPDX.has(fam.spdx)) {
            findings.push(`${fam.dir}: ${fam.spdx} is not an OSI-approved identifier this bound admits`);
        }
        if (fam.decision.trim() === '') findings.push(`${fam.dir}: no admitting decision recorded`);
        const licensePath = path.join(root, FIXTURE_DIR, fam.dir, fam.license_file);
        if (!fs.existsSync(licensePath)) findings.push(`${fam.dir}: license text ${fam.license_file} is missing`);
        const fontPath = path.join(root, rel);
        if (manifest.suspended !== undefined && manifest.suspended.lifted_by === null) {
            if (fs.existsSync(fontPath)) findings.push(`${fam.dir}: ${fam.file} is present while the amendment is suspended`);
            if (!/^[0-9a-f]{64}$/.test(fam.sha256)) findings.push(`${fam.dir}: no pinned SHA-256 to restore it by`);
            continue;
        }
        if (!fs.existsSync(fontPath)) {
            findings.push(`${fam.dir}: ${fam.file} is missing`);
            continue;
        }
        const digest = createHash('sha256').update(fs.readFileSync(fontPath)).digest('hex');
        if (digest !== fam.sha256) findings.push(`${fam.dir}: ${fam.file} does not match its recorded SHA-256`);
    }
    const held = susp !== undefined && susp.lifted_by === null;
    for (const p of trackedPaths) {
        if (!TYPEFACE_EXT.test(p)) continue;
        if (held) {
            findings.push(`typeface binary present while the amendment is suspended: ${p}`);
            continue;
        }
        if (!p.startsWith(`${FIXTURE_DIR}/`)) findings.push(`typeface binary outside the fixture set: ${p}`);
        else if (!listed.has(p)) findings.push(`typeface binary with no admitting entry: ${p}`);
    }
    return findings;
}

function run(cmd: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function readManifest(): FixtureManifest {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, FIXTURE_DIR, 'fixtures.json'), 'utf-8')) as FixtureManifest;
}

function onDiskTypefaces(): string[] {
    const tracked = run('git', ['ls-files', '--cached', '--others', '--exclude-standard']).stdout.split('\n');
    return tracked.filter((p) => TYPEFACE_EXT.test(p));
}

describe('typeface fixtures stay inside their bound', () => {
    it('every fixture is admitted, OSI-licensed, licensed beside it and byte-identical to its record', () => {
        expect(boundFindings(REPO_ROOT, readManifest(), onDiskTypefaces())).toEqual([]);
    });

    it('refuses a family whose identifier is not OSI-approved', () => {
        const manifest = readManifest();
        const [first] = manifest.families;
        if (first === undefined) throw new Error('fixtures.json lists no family');
        const bad = { ...manifest, families: [{ ...first, spdx: 'LicenseRef-Proprietary' }] };
        expect(boundFindings(REPO_ROOT, bad, onDiskTypefaces()).join('\n')).toMatch(/not an OSI-approved identifier/);
    });

    it('refuses a typeface binary that no entry admits', () => {
        // Read as the bound applies once the suspension is lifted.
        const findings = boundFindings(REPO_ROOT, { ...readManifest(), suspended: undefined }, [
            ...onDiskTypefaces(),
            `${FIXTURE_DIR}/drive-by/DriveBy-Regular.otf`,
            'docs/media/Brand.woff2',
        ]);
        expect(findings).toContain(`typeface binary with no admitting entry: ${FIXTURE_DIR}/drive-by/DriveBy-Regular.otf`);
        expect(findings).toContain('typeface binary outside the fixture set: docs/media/Brand.woff2');
    });
});

describe('while the amendment is suspended the binaries stay out of the tree', () => {
    // The 2026-10-16 amendment narrowed an owner-reserved licensing lock; the
    // 2026-10-22 council split on whether it was the council's to take, which
    // escalates to the owner. Until an owner record lifts it, no typeface
    // binary may sit in the repository, and the pinned identity is what lets a
    // lift restore the exact files.
    it('the shipped manifest is suspended and names its record', () => {
        const m = readManifest();
        expect(m.suspended?.lifted_by).toBeNull();
        expect(fs.existsSync(path.join(REPO_ROOT, m.suspended?.record ?? '/nonexistent'))).toBe(true);
    });

    it('refuses a binary that reappears while suspended', () => {
        const findings = boundFindings(REPO_ROOT, readManifest(), [`${FIXTURE_DIR}/lato/Lato-Regular.ttf`]);
        expect(findings).toContain(`typeface binary present while the amendment is suspended: ${FIXTURE_DIR}/lato/Lato-Regular.ttf`);
    });
});

describe('no published artefact carries a typeface binary', () => {
    it('the produced npm tarball lists no typeface binary and no fixture path', () => {
        const r = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts']);
        expect(r.status, r.stderr).toBe(0);
        const packed = JSON.parse(r.stdout) as Array<{ files: Array<{ path: string }> }>;
        const paths = packed.flatMap((p) => p.files.map((f) => f.path));
        expect(paths.length).toBeGreaterThan(100);
        expect(paths.filter((p) => TYPEFACE_EXT.test(p) || p.startsWith(`${FIXTURE_DIR}/`))).toEqual([]);
    }, 180_000);

    it('the produced git archive (release and Packagist tarballs) leaves the fixtures out', () => {
        // No shell pipe: ubuntu's /bin/sh is dash, where `set -o pipefail` exits 2.
        const archive = spawnSync('git', ['archive', '--format=tar', '--worktree-attributes', 'HEAD'], {
            cwd: REPO_ROOT,
            maxBuffer: 1024 * 1024 * 1024,
        });
        expect(archive.status, archive.stderr?.toString()).toBe(0);
        const listing = spawnSync('tar', ['-t'], { input: archive.stdout, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
        expect(listing.status, listing.stderr).toBe(0);
        const entries = listing.stdout.split('\n').filter(Boolean);
        expect(entries.length).toBeGreaterThan(100);
        expect(entries.filter((p) => TYPEFACE_EXT.test(p) || p.startsWith(`${FIXTURE_DIR}/`))).toEqual([]);
    }, 180_000);

    it('every container build context excludes the fixtures', () => {
        const dockerignore = fs.readFileSync(path.join(REPO_ROOT, '.dockerignore'), 'utf-8').split('\n').map((l) => l.trim());
        expect(dockerignore).toContain(FIXTURE_DIR);
        const dockerfiles = run('git', ['ls-files']).stdout.split('\n').filter((p) => /(^|\/)(Dockerfile|Containerfile)[^/]*$/.test(p));
        expect(dockerfiles.length).toBeGreaterThan(0);
        for (const df of dockerfiles) {
            const copies = fs.readFileSync(path.join(REPO_ROOT, df), 'utf-8').split('\n').filter((l) => /^\s*(COPY|ADD)\b/.test(l));
            expect(copies.filter((l) => l.includes('tests/fixtures') || TYPEFACE_EXT.test(l.trim())), df).toEqual([]);
        }
    });
});
