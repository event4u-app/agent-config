// road-to-a-control-that-matches-its-neighbours 3.6: no false done.
import { describe, expect, it } from 'vitest';

import { consistency_status } from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';

const SELECT_ADDED = [{ kind: 'ui', file: 'a.tsx', new_control_roles: ['select'] }];
const NOTHING_ADDED = [{ kind: 'ui', file: 'a.tsx', new_control_roles: [] }];
const RENDERED = { preview: { render_ok: true } };

describe('consistency_status', () => {
    it('no browser → static-pass or unverified, never pass', () => {
        expect(consistency_status({}, NOTHING_ADDED)).toBe('static-pass');
        expect(consistency_status({}, SELECT_ADDED)).toBe('unverified');
    });

    it('a rendered review with an added control not captured open is unverified', () => {
        expect(consistency_status({ ...RENDERED }, SELECT_ADDED)).toBe('unverified');
    });

    it('rendered and every added control captured open → pass', () => {
        expect(consistency_status({ ...RENDERED, consistency: { findings: [], open_state: { select: 'captured' } } }, SELECT_ADDED)).toBe(
            'pass',
        );
    });

    it('a standing finding is fail, whatever else was captured', () => {
        expect(
            consistency_status(
                { ...RENDERED, consistency: { findings: [{ rule: 'consistency-raw-control' }], open_state: { select: 'captured' } } },
                SELECT_ADDED,
            ),
        ).toBe('fail');
    });
});
