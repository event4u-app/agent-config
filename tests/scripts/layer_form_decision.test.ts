// `layer_form_decision` — road-to-a-setup-that-decides-itself steps 3.1 and 3.4.
// The table test the step's verify line names: every condition failing ALONE
// yields `full` with its own reason, and a consequence-class or safety-floor
// rule is `full` under every input.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    BRAKES_REL,
    FORM_REASONS,
    decideLayerForm,
    deliveryObservedFor,
    gatherShippedEvidence,
    loadBrakes,
    ruleForm,
    shadowLayerFormCheck,
    type FormReason,
    type LayerFormInput,
} from '../../src/scripts/_lib/layer_form_decision.js';
import { readConsequenceClass } from '../../src/scripts/_lib/rule_consequence_class.js';
import { WIRING_CHECK_IDS, wiringRunners } from '../../src/scripts/_lib/runtime_wiring_checks.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Every condition holds. Each row below breaks exactly one of them. */
const ALL_HOLD: LayerFormInput = {
    host: 'claude-code',
    hostVersion: '2.1.268',
    packageVersion: '17.0.0',
    deliveryObserved: true,
    arrival: { hostVersion: '2.1.268', stubsLoaded: true, standingLawsLoaded: true },
    carrierProbe: 'pass',
    demoted: false,
    payloadVersion: '17.0.0',
    layerVersion: '17.0.0',
    brakes: [],
    userPin: false,
};

const SINGLE_FAILURES: ReadonlyArray<[FormReason, Partial<LayerFormInput>]> = [
    ['user-pin', { userPin: true }],
    ['release-brake', { brakes: [{ host: 'claude-code', host_version: '2.1.268', reason: 'fixture' }] }],
    ['host-not-thinnable', { host: 'windsurf' }],
    ['delivery-unobserved', { deliveryObserved: false }],
    ['no-arrival-record', { arrival: null }],
    ['arrival-host-version-mismatch', { arrival: { hostVersion: '2.1.267', stubsLoaded: true, standingLawsLoaded: true } }],
    ['arrival-stubs-missing', { arrival: { hostVersion: '2.1.268', stubsLoaded: false, standingLawsLoaded: true } }],
    ['arrival-standing-law-missing', { arrival: { hostVersion: '2.1.268', stubsLoaded: true, standingLawsLoaded: false } }],
    ['carrier-probe-not-passing', { carrierProbe: 'unknown' }],
    ['demoted', { demoted: true }],
    ['version-skew', { layerVersion: '16.9.0' }],
];

describe('decideLayerForm — 3.1', () => {
    it('thins only when every condition holds', () => {
        expect(decideLayerForm(ALL_HOLD)).toEqual({ form: 'thinned', reason: 'all-conditions-hold' });
    });

    it.each(SINGLE_FAILURES)('%s failing alone yields full with its own reason', (reason, patch) => {
        expect(decideLayerForm({ ...ALL_HOLD, ...patch })).toEqual({ form: 'full', reason });
    });

    it('covers every non-thinned reason code exactly once', () => {
        const covered = SINGLE_FAILURES.map(([r]) => r).sort();
        const expected = FORM_REASONS.filter((r) => r !== 'all-conditions-hold').sort();
        expect(covered).toEqual(expected);
    });

    it('a failed carrier probe is as full as an unknown one', () => {
        expect(decideLayerForm({ ...ALL_HOLD, carrierProbe: 'fail' }).form).toBe('full');
    });

    it('an unknown host version cannot match an arrival record', () => {
        expect(decideLayerForm({ ...ALL_HOLD, hostVersion: null })).toEqual({
            form: 'full',
            reason: 'arrival-host-version-mismatch',
        });
    });

    it('the shipped default — no arrival record, unknown probe — is full', () => {
        expect(decideLayerForm({ ...ALL_HOLD, arrival: null, carrierProbe: 'unknown' }).form).toBe('full');
    });
});

describe('ruleForm — never-thinned classes', () => {
    const cfg = readConsequenceClass(REPO_ROOT);
    const consequenceClass = new Set(Object.keys(cfg.members));
    const rulesDir = path.join(REPO_ROOT, 'src', 'rules');
    const safetyFloor = new Set(
        fs
            .readdirSync(rulesDir)
            .filter((f) => f.endsWith('.md'))
            .filter((f) => /^tier:\s*["']?safety-floor["']?\s*$/m.test(fs.readFileSync(path.join(rulesDir, f), 'utf-8')))
            .map((f) => f.replace(/\.md$/, '')),
    );

    it('the safety-floor tier is read from frontmatter and is not empty', () => {
        expect(safetyFloor.has('non-destructive-by-default')).toBe(true);
    });
    const never = { consequenceClass, safetyFloor };
    const inputs: LayerFormInput[] = [ALL_HOLD, ...SINGLE_FAILURES.map(([, p]) => ({ ...ALL_HOLD, ...p }))];

    it('the committed consequence class is not empty', () => {
        expect(consequenceClass.size).toBeGreaterThan(0);
    });

    it('every consequence-class and safety-floor rule is full under every input', () => {
        for (const input of inputs) {
            const layer = decideLayerForm(input);
            for (const id of [...consequenceClass, ...safetyFloor]) {
                expect(ruleForm(id, layer, never)).toBe('full');
            }
        }
    });

    it('an ordinary rule follows the layer', () => {
        expect(ruleForm('ordinary-rule', decideLayerForm(ALL_HOLD), never)).toBe('thinned');
    });
});

describe('release brake — 3.4', () => {
    it('a row for a fixture host version forces full', () => {
        const brakes = [{ host: 'claude-code', host_version: '9.9.9', reason: 'fixture' }];
        expect(decideLayerForm({ ...ALL_HOLD, hostVersion: '9.9.9', arrival: { ...ALL_HOLD.arrival!, hostVersion: '9.9.9' }, brakes }))
            .toEqual({ form: 'full', reason: 'release-brake' });
        expect(decideLayerForm({ ...ALL_HOLD, brakes }).form).toBe('thinned');
    });

    it('a row for a package version forces full', () => {
        const brakes = [{ host: 'claude-code', package_version: '17.0.0', reason: 'fixture' }];
        expect(decideLayerForm({ ...ALL_HOLD, brakes }).reason).toBe('release-brake');
    });

    it('a row for another host does not brake this one', () => {
        const brakes = [{ host: 'cursor', host_version: '2.1.268', reason: 'fixture' }];
        expect(decideLayerForm({ ...ALL_HOLD, brakes }).form).toBe('thinned');
    });

    it('the shipped table loads and is empty', () => {
        expect(loadBrakes(REPO_ROOT, '17.0.0')).toEqual([]);
    });

    it('an unreadable table holds the brake on for every thinnable host', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brakes-'));
        try {
            fs.mkdirSync(path.join(dir, path.dirname(BRAKES_REL)), { recursive: true });
            fs.writeFileSync(path.join(dir, BRAKES_REL), '{not json');
            const brakes = loadBrakes(dir, '17.0.0');
            expect(brakes.length).toBeGreaterThan(0);
            expect(decideLayerForm({ ...ALL_HOLD, brakes }).reason).toBe('release-brake');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('a row naming no version is malformed and holds the brake on', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brakes-'));
        try {
            fs.mkdirSync(path.join(dir, path.dirname(BRAKES_REL)), { recursive: true });
            fs.writeFileSync(path.join(dir, BRAKES_REL), JSON.stringify({ rows: [{ host: 'claude-code', reason: 'x' }] }));
            expect(decideLayerForm({ ...ALL_HOLD, brakes: loadBrakes(dir, '17.0.0') }).reason).toBe('release-brake');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('deliveryObservedFor', () => {
    it('reads the record under its own spelling of the first host', () => {
        expect(deliveryObservedFor({ claude: { state: 'observed-true' } } as never, 'claude-code')).toBe(true);
    });

    it('unobserved and absent hosts are not observed', () => {
        expect(deliveryObservedFor({ claude: { state: 'unobserved' } } as never, 'claude-code')).toBe(false);
        expect(deliveryObservedFor({}, 'cursor')).toBe(false);
    });
});

describe('shadow decision — 3.2', () => {
    function snapshot(dir: string): string[] {
        return fs
            .readdirSync(dir)
            .sort()
            .map((f) => `${f}:${fs.readFileSync(path.join(dir, f), 'utf-8')}`);
    }

    it('every condition holding prints would-be: thinned and leaves the layer on disk unchanged', () => {
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-home-'));
        try {
            const rules = path.join(home, '.claude', 'rules');
            fs.mkdirSync(rules, { recursive: true });
            fs.writeFileSync(path.join(rules, 'commit-policy.md'), 'full body');
            const before = snapshot(rules);
            const res = shadowLayerFormCheck((host) => ({ ...ALL_HOLD, host }));
            expect(res.message).toContain('claude-code would-be: thinned (all-conditions-hold)');
            expect(res.status).toBe('ok');
            expect(snapshot(rules)).toEqual(before);
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });

    it('the shipped evidence keeps every thinnable host full today', () => {
        const gather = gatherShippedEvidence(REPO_ROOT, '17.0.0');
        for (const host of ['claude-code', 'cursor', 'cline']) {
            expect(decideLayerForm(gather(host)).form).toBe('full');
        }
    });

    it('doctor carries the shadow record under its own id', () => {
        expect(WIRING_CHECK_IDS).toContain('layer-form');
        const runners = wiringRunners({ packageRoot: REPO_ROOT, projectRoot: REPO_ROOT, iterOverrides: () => [] });
        const res = runners['layer-form']!();
        expect(res.id).toBe('layer-form');
        expect(res.message).toContain('claude-code would-be: full');
        expect(res.message).not.toContain('would-be: thinned');
    });
});
