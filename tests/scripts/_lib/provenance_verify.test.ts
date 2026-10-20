/**
 * Step 2.1's open half — the provenance gate ties the attestation to the OIDC
 * publish workflow instead of only noting that an attestation exists.
 *
 * The gate it replaces accepted any document whose `predicateType` started
 * with the SLSA provenance URL. That is satisfiable by an attestation produced
 * by ANY workflow in ANY repository, which is the property an attacker who can
 * publish from their own CI already has. The assertions below are therefore
 * written around the rejecting direction: a well-formed, correctly-typed SLSA
 * predicate naming the wrong workflow or the wrong repository must fail.
 */
import { describe, expect, it } from 'vitest';

import {
    EXPECTED_WORKFLOW_REF,
    attestation_workflow_ref,
    provenance_matches_publish,
} from '../../../src/scripts/_lib/provenance_verify.js';

/** An SLSA v1 bundle as npm serves it, trimmed to the fields the gate reads. */
function v1(workflowRef: string): unknown {
    return {
        attestations: [
            {
                predicateType: 'https://slsa.dev/provenance/v1',
                bundle: {
                    dsseEnvelope: {
                        payload: Buffer.from(
                            JSON.stringify({
                                predicateType: 'https://slsa.dev/provenance/v1',
                                predicate: {
                                    buildDefinition: {
                                        externalParameters: {
                                            workflow: {
                                                ref: 'refs/heads/main',
                                                repository: 'https://github.com/event4u-app/agent-config',
                                                path: workflowRef,
                                            },
                                        },
                                    },
                                },
                            }),
                        ).toString('base64'),
                    },
                },
            },
        ],
    };
}

describe('attestation_workflow_ref', () => {
    it('reads the workflow path out of an SLSA v1 dsse payload', () => {
        expect(attestation_workflow_ref(v1('.github/workflows/publish-npm.yml'))).toBe(
            '.github/workflows/publish-npm.yml',
        );
    });

    it('is null for a document with no attestations at all', () => {
        expect(attestation_workflow_ref({})).toBeNull();
    });

    it('is null when the payload is not decodable base64 JSON', () => {
        expect(
            attestation_workflow_ref({
                attestations: [{ bundle: { dsseEnvelope: { payload: 'not-base64-json' } } }],
            }),
        ).toBeNull();
    });
});

describe('provenance_matches_publish', () => {
    it('accepts the workflow this package actually publishes from', () => {
        expect(provenance_matches_publish(v1(EXPECTED_WORKFLOW_REF))).toBe(true);
    });

    it('REJECTS a valid SLSA predicate produced by a different workflow', () => {
        expect(provenance_matches_publish(v1('.github/workflows/attacker.yml'))).toBe(false);
    });

    it('REJECTS a valid SLSA predicate naming a different repository', () => {
        const doc = {
            attestations: [
                {
                    bundle: {
                        dsseEnvelope: {
                            payload: Buffer.from(
                                JSON.stringify({
                                    predicate: {
                                        buildDefinition: {
                                            externalParameters: {
                                                workflow: {
                                                    repository: 'https://github.com/someone-else/agent-config',
                                                    path: EXPECTED_WORKFLOW_REF,
                                                },
                                            },
                                        },
                                    },
                                }),
                            ).toString('base64'),
                        },
                    },
                },
            ],
        };
        expect(provenance_matches_publish(doc)).toBe(false);
    });

    it('REJECTS an absent attestation — presence is not optional', () => {
        expect(provenance_matches_publish({})).toBe(false);
    });
});
