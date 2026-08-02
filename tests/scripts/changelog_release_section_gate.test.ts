import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Adversarial fixture for the CHANGELOG release-section gate
 * (`release-validation.yml` → `changelog-entry` job → the inline `node -e`
 * program). Road-to-gates-that-can-fail Phase 6.1.
 *
 * The collision the gate got wrong on 9.9.0: an era split names the archived
 * era after the INCOMING version, so the file opens with
 * `# Era: pre-9.9.0 — archived` **before** the real `## [9.9.0](…)` section.
 * The gate located "the first heading line containing the version" with
 * `^(#+) `, anchored on the era banner, read its two-line blockquote as the
 * release body, found no `Tests:` footer and failed a correct section. The fix
 * requires `^(#{2,}) ` — release entries are level 2+, era banners are level 1.
 *
 * The gate has no importable module: it lives inline in the workflow. So this
 * test extracts the program CI actually runs out of the YAML and executes it,
 * rather than re-implementing it — a second copy would drift and prove nothing
 * about the shipped gate. Consequence, and the point: reverting the `^(#{2,})`
 * fix in the workflow turns `resolves the real release section …` red, because
 * the extraction picks up whatever pattern the workflow currently carries.
 *
 * The mutation is also asserted in-test (`#{2,}` → `#+` on the extracted
 * source) so the fixture's sensitivity to the fix is proven on every run, not
 * only when someone remembers to try the revert by hand.
 */

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'release-validation.yml');

/** The shell heredoc-free `node -e '<program>' "$version"` body, verbatim. */
function extractGateProgram(): string {
    const text = fs.readFileSync(WORKFLOW, 'utf-8');
    const open = text.indexOf("node -e '");
    if (open === -1) {
        throw new Error(`no inline \`node -e '…'\` program found in ${WORKFLOW}`);
    }
    const start = open + "node -e '".length;
    // A shell single-quoted string cannot contain a single quote, so the next
    // apostrophe is unambiguously the terminator.
    const end = text.indexOf("'", start);
    if (end === -1) {
        throw new Error(`unterminated inline program in ${WORKFLOW}`);
    }
    return text.slice(start, end);
}

const TMP_DIRS: string[] = [];

function runGate(program: string, changelog: string, version: string): { code: number; err: string; out: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-gate-'));
    TMP_DIRS.push(dir);
    fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog, 'utf-8');
    const res = spawnSync(process.execPath, ['-e', program, version], {
        cwd: dir,
        encoding: 'utf-8',
    });
    return { code: res.status ?? -1, err: res.stderr ?? '', out: res.stdout ?? '' };
}

afterAll(() => {
    for (const d of TMP_DIRS) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/**
 * The 9.9.0 shape: an era banner carrying the release version ahead of the
 * release heading, two version-bearing release headings, and — across the two
 * fixtures below — one section with the `Tests:` footer and one without.
 */
function fixture(opts: { readonly footerOn990: boolean }): string {
    return [
        '# Changelog',
        '',
        '## [Unreleased]',
        '',
        '# Era: pre-9.9.0 — archived',
        '',
        '> All entries before `9.9.0` live in',
        '> [`docs/archive/CHANGELOG-pre-9.9.0.md`](docs/archive/CHANGELOG-pre-9.9.0.md).',
        '',
        '# Era: 9.9.x — current',
        '',
        '> Started at `9.9.0`. Full entries live inline below.',
        '',
        '## [9.9.0](https://example/compare/9.8.0...9.9.0) (2026-07-29)',
        '',
        '### Features',
        '',
        '* **gates:** scope assertion on every gate ([abc1234](https://example))',
        '',
        ...(opts.footerOn990 ? ['Tests: 4212 (+31 since 9.8.0)', ''] : []),
        '## [9.8.0](https://example/compare/9.7.0...9.8.0) (2026-07-20)',
        '',
        '### Features',
        '',
        '* **release:** an older entry that never got a footer ([def5678](https://example))',
        '',
    ].join('\n');
}

const WITH_FOOTER = fixture({ footerOn990: true });
const WITHOUT_FOOTER = fixture({ footerOn990: false });

describe('CHANGELOG release-section gate — era-banner collision (Phase 6.1)', () => {
    const program = extractGateProgram();

    it('extracts the program CI runs — non-empty and carrying the heading anchor', () => {
        // Anti-zero-scope: an extraction that silently returned '' would make
        // every assertion below pass against nothing.
        expect(program.length).toBeGreaterThan(200);
        expect(program).toContain('CHANGELOG.md');
        expect(program).toContain('Tests:');
    });

    it('resolves the real release section past an era banner naming the same version', () => {
        const { code, out, err } = runGate(program, WITH_FOOTER, '9.9.0');
        expect(err).toBe('');
        expect(code).toBe(0);
        // Body of `## [9.9.0]`, not the era pointer's two-line blockquote.
        expect(out).toContain('CHANGELOG section for 9.9.0 has');
    });

    it('still fails a release section that genuinely has no Tests: footer', () => {
        const { code, err } = runGate(program, WITHOUT_FOOTER, '9.9.0');
        expect(code).toBe(1);
        expect(err).toContain('missing the `Tests: N (+M since PREV)` footer line');
    });

    it('MUTATION — reverting `^(#{2,})` to `^(#+)` anchors on the era banner and turns it red', () => {
        expect(program).toContain('#{2,}');
        const reverted = program.replace('#{2,}', '#+');
        expect(reverted).not.toBe(program);
        const { code, err } = runGate(reverted, WITH_FOOTER, '9.9.0');
        expect(code).toBe(1);
        // Exactly the 9.9.0 symptom: a correct section reported footer-less,
        // because the body read was the archive pointer's blockquote.
        expect(err).toContain('missing the `Tests: N (+M since PREV)` footer line');
    });

    it('documents the compare-link collision the fix does NOT cover (production-unreachable)', () => {
        // `## [9.9.0](https://example/compare/9.8.0...9.9.0)` contains `9.8.0`,
        // so asking the gate about 9.8.0 resolves to the 9.9.0 section and
        // reads ITS footer — 9.8.0's own footer-less section is never seen.
        // Unreachable on the release path: the gate is only ever asked about
        // the branch's own version, which is the topmost section, and no newer
        // heading exists to shadow it. Pinned so a future tightening is a
        // deliberate change rather than a surprise.
        const { code } = runGate(program, WITH_FOOTER, '9.8.0');
        expect(code).toBe(0);
    });
});
