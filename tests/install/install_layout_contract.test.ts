// Install-layout ABI conformance — the test `docs/contracts/install-layout.md`
// names as the thing that guards it.
//
// The contract calls itself "the frozen source the install-ABI conformance test
// guards against" and cited `tests/test_install_layout_contract.py`. That file
// shipped on 2026-06-17 with the golden fixture beside it and was deleted in the
// Python→TS migration (ADR-200) without being ported, so for months the contract
// advertised a guard that did not exist and `tests/fixtures/install_layout_v1.json`
// was read by nothing. A 2026-09-11 evaluation of the contract's beta window
// measured that; this is the port.
//
// Scope, stated as honestly as the original did:
//
//   - STRUCTURALLY locked, live-derived from source, so a source change trips
//     the test: the supported-tools set, per-tool project bridge markers,
//     user-scope anchor paths, global deploy sources, and the lockfile's
//     rendered field order plus its version constants.
//   - DOC-locked, pinned in the golden and cross-checked against the contract:
//     the claimed JSON-pointer keys. They are inline literals in `install.ts`
//     rather than one constant, so the test cannot read them from source
//     without a refactor the original deliberately excluded.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    GLOBAL_DEPLOY_SOURCES,
    PROJECT_BRIDGE_MARKERS,
    USER_SCOPE_PATHS,
    _VALID_TOOLS,
} from '../../src/scripts/install.js';
import { INSTALL_LAYOUT_VERSION } from '../../src/scripts/_lib/install_layout.js';
import { SCHEMA_VERSION, _render } from '../../src/scripts/_lib/installed_lock.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTRACT_DOC = path.join(ROOT, 'docs', 'contracts', 'install-layout.md');

/**
 * Claimed JSON-pointer keys (RFC-6901), doc-locked.
 *
 * Kept in sync with the pointer-key table in `install-layout.md`; the last test
 * below asserts each one appears there.
 */
const CLAIMED_POINTER_KEYS = [
    '/enabledPlugins/agent-config@event4u',
    '/enabledPlugins/agent-config@event4u-agent-config',
    '/hooks/sessionStart',
    '/hooks/sessionEnd',
    '/hooks/stop',
    '/hooks/beforeSubmitPrompt',
    '/hooks/postToolUse',
    '/hooks/post_setup_worktree',
    '/hooks/pre_user_prompt',
    '/hooks/post_cascade_response',
    '/marketplace/name',
    '/marketplace/plugins/0',
    '/chat/pluginLocations',
];

function goldenPath(): string {
    return path.join(ROOT, 'tests', 'fixtures', `install_layout_v${INSTALL_LAYOUT_VERSION}.json`);
}

/** The rendered global-lockfile field order — shape, never values. */
function lockfileFieldOrder(): string[] {
    return _render('0.0.0', ['claude-code'], '2026-01-01T00:00:00Z')
        .split('\n')
        .filter((l) => l !== '' && !/^[ \t-]/.test(l) && l.includes(':'))
        .map((l) => l.split(':', 1)[0]!.trim());
}

function sortedRecord<T>(o: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]!]));
}

/** The live install-layout ABI descriptor, derived from source constants. */
function buildLayoutDescriptor(): Record<string, unknown> {
    return {
        install_layout_version: INSTALL_LAYOUT_VERSION,
        valid_tools: [..._VALID_TOOLS].sort(),
        project_bridge_markers: sortedRecord(PROJECT_BRIDGE_MARKERS),
        user_scope_paths: sortedRecord(USER_SCOPE_PATHS),
        global_deploy_sources: Object.fromEntries(
            Object.keys(GLOBAL_DEPLOY_SOURCES)
                .sort()
                .map((k) => [k, GLOBAL_DEPLOY_SOURCES[k]!.map((t) => [...t])]),
        ),
        lockfile: { schema_version: SCHEMA_VERSION, field_order: lockfileFieldOrder() },
        claimed_pointer_keys: [...CLAIMED_POINTER_KEYS].sort(),
    };
}

describe('install-layout ABI conformance', () => {
    it('a golden snapshot exists for the current layout version', () => {
        expect(
            fs.existsSync(goldenPath()),
            `No golden fixture for install_layout_version=${INSTALL_LAYOUT_VERSION}. ` +
                'Bumping INSTALL_LAYOUT_VERSION requires adding the snapshot plus a ' +
                '### Breaking note in BREAKING_CHANGES.md.',
        ).toBe(true);
    });

    it('the live layout matches the frozen golden', () => {
        const golden = JSON.parse(fs.readFileSync(goldenPath(), 'utf-8')) as Record<string, unknown>;
        // Failure here means the install ABI changed without a version bump.
        // Either revert, or bump INSTALL_LAYOUT_VERSION, add a new golden and a
        // breaking deprecation-window note in BREAKING_CHANGES.md.
        expect(buildLayoutDescriptor()).toEqual(golden);
    });

    it('every claimed pointer key appears in the contract document', () => {
        const doc = fs.readFileSync(CONTRACT_DOC, 'utf-8');
        const missing = CLAIMED_POINTER_KEYS.filter((k) => !doc.includes(k.split('/').pop()!));
        expect(missing).toEqual([]);
    });

    it('the layout version is positive', () => {
        expect(INSTALL_LAYOUT_VERSION).toBeGreaterThanOrEqual(1);
    });

    // Sensitivity, because a snapshot test that has never been seen red proves
    // nothing: perturbing one field of the descriptor must fail the comparison.
    // Asserted against a copy so the real descriptor is untouched.
    it('a single changed field fails the comparison', () => {
        const golden = JSON.parse(fs.readFileSync(goldenPath(), 'utf-8')) as Record<string, unknown>;
        const perturbed = { ...buildLayoutDescriptor(), valid_tools: ['not-a-tool'] };
        expect(perturbed).not.toEqual(golden);
    });
});
