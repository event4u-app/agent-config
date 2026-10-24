/**
 * The workflow tie read out of a verified provenance payload.
 *
 * Written around the rejecting direction: a well-formed, correctly-typed SLSA
 * payload naming the wrong workflow or the wrong repository must fail, because
 * any workflow in any repository with `id-token: write` can produce one.
 */
import { describe, expect, it } from 'vitest';

import { EXPECTED_REPOSITORY, EXPECTED_WORKFLOW_REF, payload_names_publish } from '../../../src/scripts/_lib/provenance_verify.js';

function payload(path: string, repository: string = EXPECTED_REPOSITORY): Record<string, unknown> {
    return {
        predicateType: 'https://slsa.dev/provenance/v1',
        predicate: { buildDefinition: { externalParameters: { workflow: { ref: 'refs/tags/1.0.0', repository, path } } } },
    };
}

describe('payload_names_publish', () => {
    it('accepts the workflow this package actually publishes from', () => {
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF))).toBe(true);
    });

    it('accepts the repository written with .git or a trailing slash', () => {
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, `${EXPECTED_REPOSITORY}.git`))).toBe(true);
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, `${EXPECTED_REPOSITORY}/`))).toBe(true);
    });

    it('REJECTS a payload produced by a different workflow', () => {
        expect(payload_names_publish(payload('.github/workflows/attacker.yml'))).toBe(false);
    });

    it('REJECTS a payload naming a different repository', () => {
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, 'https://github.com/someone-else/agent-config'))).toBe(false);
    });

    it('REJECTS an absent or empty payload — presence is not optional', () => {
        expect(payload_names_publish(null)).toBe(false);
        expect(payload_names_publish({})).toBe(false);
        expect(payload_names_publish(payload(EXPECTED_WORKFLOW_REF, ''))).toBe(false);
    });
});
