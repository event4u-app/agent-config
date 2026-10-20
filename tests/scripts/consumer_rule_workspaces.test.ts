import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    MAINTAINER_WORKSPACE,
    consumerRuleWorkspaces,
} from '../../src/scripts/_lib/scoped_projection.js';
import { ruleScopeFromSettings } from '../../src/install/rule_scope.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The list `projection.rule_workspaces` shipped as its template default on the
 * day ADR-292 step 4.6 removed it. The derived set must equal it exactly —
 * that equality is the step's "same rule set as today", and it is pinned
 * literally so a drift in either direction is visible rather than argued.
 */
const SHIPPED_DEFAULT = [
    'construction',
    'engineering',
    'finance',
    'founder',
    'gtm',
    'legal-review-prep',
    'ops',
    'product',
    'small-business',
];

const temps: string[] = [];
afterEach(() => {
    for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('the consumer workspace set is derived, not configured', () => {
    it('equals the list the removed key shipped as its default', () => {
        expect(consumerRuleWorkspaces(REPO)).toEqual(SHIPPED_DEFAULT);
    });

    it('never contains the maintainer workspace — the one id the derivation subtracts', () => {
        // The sensitive direction: this id IS in packs.yml, so its absence here
        // is a subtraction that happened rather than a vocabulary that never
        // had it. Shipping it would put this package's own rules into every
        // consumer install, which is the defect the key existed to prevent.
        const raw = fs.readFileSync(path.join(REPO, 'src', 'config', 'discovery', 'packs.yml'), 'utf8');
        expect(raw).toContain(MAINTAINER_WORKSPACE);
        expect(consumerRuleWorkspaces(REPO)).not.toContain(MAINTAINER_WORKSPACE);
    });

    it('a new workspace in the vocabulary reaches consumers without a settings edit', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-ws-'));
        temps.push(root);
        fs.mkdirSync(path.join(root, 'src', 'config', 'discovery'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'config', 'discovery', 'packs.yml'),
            '- id: pack-a\n  workspaces: [brand-new]\n- id: pack-b\n  workspaces: [agent-config-maintainer]\n',
        );
        expect(consumerRuleWorkspaces(root)).toEqual(['brand-new']);
    });

    it('is the inactive axis when the vocabulary cannot be read — more ships, never less', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-ws-empty-'));
        temps.push(root);
        expect(consumerRuleWorkspaces(root)).toEqual([]);
    });
});

describe('ruleScopeFromSettings no longer reads the key', () => {
    it('ignores a hand-written rule_workspaces and uses the derived set', () => {
        const scope = ruleScopeFromSettings({ projection: { rule_workspaces: ['engineering'] } }, REPO);
        // Before ADR-292 this read `['engineering']`.
        expect(scope.workspaces).toEqual(SHIPPED_DEFAULT);
    });

    it('derives the same set from settings that carry no projection block at all', () => {
        expect(ruleScopeFromSettings({}, REPO).workspaces).toEqual(SHIPPED_DEFAULT);
    });

    it('is the inactive axis with no package root — the axis cannot be derived there', () => {
        expect(ruleScopeFromSettings({ projection: { rule_workspaces: ['engineering'] } }).workspaces).toBeNull();
    });
});
