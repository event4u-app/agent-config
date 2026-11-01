/**
 * Phase 3 of `road-to-zero-ceremony-detection` — the npm `files` allowlist must
 * actually deliver the paths shipped code and shipped docs point at.
 *
 * The defect this pins: `src/config/agent-settings.template.yml` ships (it is
 * inside the allowlisted `src/config/`) and tells the user to copy the council
 * shape from `agents/templates/.ai-council.yml.example` — while `agents/` was
 * absent from the allowlist AND listed in `.npmignore`. So the instruction
 * pointed at a file npm never delivered, and `src/server/routes/wizard.ts`'s
 * seed-on-first-run read the same missing path.
 *
 * `files` takes precedence over `.npmignore`, which is why one allowlist entry
 * fixes both without touching the ignore file.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DEFAULT_TEMPLATE as GITATTRIBUTES_TEMPLATE } from '../../../src/scripts/sync_gitattributes.js';
import { DEFAULT_TEMPLATE as GITIGNORE_TEMPLATE } from '../../../src/scripts/_lib/gitignore_block.js';
import { template_path as wrapperTemplatePath } from '../../../src/scripts/_lib/cli_wrapper.js';

const REPO_ROOT = process.cwd();

interface PackageJson {
    readonly files?: readonly string[];
}

function packageFiles(): readonly string[] {
    const raw = fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8');
    return (JSON.parse(raw) as PackageJson).files ?? [];
}

/** Would `rel` be delivered by the allowlist? Prefix or exact match. */
function isShipped(rel: string, files: readonly string[]): boolean {
    return files.some((entry) => (entry.endsWith('/') ? rel.startsWith(entry) : rel === entry));
}

/** Paths that shipped code or shipped config instructs a consumer to read. */
const REQUIRED_SHIPPED_PATHS: readonly string[] = [
    // Pointed at by src/config/agent-settings.template.yml and seeded by
    // src/server/routes/wizard.ts (PACKAGE_AI_COUNCIL_REL).
    'agents/templates/.ai-council.yml.example',
    // The settings template itself — the pointer's source.
    'src/config/agent-settings.template.yml',
];

describe('npm files allowlist', () => {
    const files = packageFiles();

    it('is non-empty — an absent allowlist would ship the whole tree', () => {
        expect(files.length).toBeGreaterThan(0);
    });

    for (const rel of REQUIRED_SHIPPED_PATHS) {
        it(`delivers ${rel}`, () => {
            expect(fs.existsSync(path.join(REPO_ROOT, rel)), `${rel} missing from the repo`).toBe(
                true,
            );
            expect(isShipped(rel, files), `${rel} not covered by package.json files`).toBe(true);
        });
    }

    it('covers the council example the settings template points at', () => {
        const template = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml'),
            'utf-8',
        );
        // Extract the pointer from the shipped text rather than restating it, so
        // renaming the example in one place fails here instead of drifting.
        const m = /`(agents\/templates\/\.ai-council\.yml\.example)`/.exec(template);
        expect(m, 'settings template no longer names the council example').not.toBeNull();
        const pointed = m?.[1] as string;
        expect(fs.existsSync(path.join(REPO_ROOT, pointed))).toBe(true);
        expect(isShipped(pointed, files)).toBe(true);
    });

    // `init --project` (refresh --project) reads these templates at runtime from
    // the installed package. Taken from the readers' own exported constants, so
    // a moved template or a reader pointing outside `files` fails here instead
    // of on a consumer's machine.
    const runtimeTemplates: ReadonlyArray<readonly [string, string]> = [
        ['sync_gitattributes DEFAULT_TEMPLATE', GITATTRIBUTES_TEMPLATE],
        ['gitignore_block DEFAULT_TEMPLATE', GITIGNORE_TEMPLATE],
        ['cli_wrapper template_path()', wrapperTemplatePath()],
    ];
    for (const [label, abs] of runtimeTemplates) {
        it(`delivers the template ${label} reads at runtime`, () => {
            const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
            expect(fs.existsSync(abs), `${rel} missing from the repo`).toBe(true);
            expect(isShipped(rel, files), `${rel} not covered by package.json files`).toBe(true);
        });
    }

    it('covers the example path the wizard seeds the council config from', () => {
        const wizard = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'server', 'routes', 'wizard.ts'),
            'utf-8',
        );
        const m = /PACKAGE_AI_COUNCIL_REL\s*=\s*join\(([^)]*)\)/.exec(wizard);
        expect(m, 'wizard no longer defines PACKAGE_AI_COUNCIL_REL').not.toBeNull();
        const segments = (m?.[1] ?? '')
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter((s) => s.length > 0);
        const rel = segments.join('/');
        expect(fs.existsSync(path.join(REPO_ROOT, rel)), `${rel} missing`).toBe(true);
        expect(isShipped(rel, files), `${rel} not shipped — wizard seeding would fail`).toBe(true);
    });
});
