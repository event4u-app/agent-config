/**
 * The three `check_estate_count` self-test cases that exercise `status: carrier`.
 *
 * They live outside that gate because it sits at the 1,500-line source ceiling
 * `check_source_size_budget` enforces, and because the doctrine that gate states
 * for an oversized file is a split rather than a raised baseline. The reasoning
 * behind the fixture shapes is in `carrier_status.ts` § Fixture design.
 */

import type { SelfTestCase } from './gate_self_test.js';

/** What the caller must supply: its own fixture harness and roadmap bodies. */
export interface EstateCaseDeps {
    fixture: (opts: {
        roadmaps: number;
        base?: string;
        before?: (dir: string) => void;
        after: (dir: string) => void;
    }) => number;
    write: (dir: string, rel: string, body: string) => void;
    remove: (dir: string, rel: string) => void;
    roadmap: (name: string, extra?: string) => string;
    CARRIER: string;
    DRAFT: string;
}

export function carrierEstateCases(d: EstateCaseDeps): SelfTestCase[] {
    const { fixture, write, remove, roadmap, CARRIER, DRAFT } = d;
    return [
        {
            name: 'deleting a carrier does not offset a new draft → reject',
            expect: 'reject',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) => write(dir, 'agents/roadmaps/road-to-carrier.md', CARRIER),
                    after: (dir) => {
                        remove(dir, 'agents/roadmaps/road-to-carrier.md');
                        write(dir, 'agents/roadmaps/road-to-new.md', DRAFT);
                    },
                }),
        },
        {
            // The control that proves the case above tests the STATUS rather
            // than the deletion: only the removed file's status differs.
            name: 'deleting an ordinary roadmap still offsets a new draft → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) => write(dir, 'agents/roadmaps/road-to-spare.md', roadmap('S')),
                    after: (dir) => {
                        remove(dir, 'agents/roadmaps/road-to-spare.md');
                        write(dir, 'agents/roadmaps/road-to-new.md', DRAFT);
                    },
                }),
        },
        {
            name: 'flipping a carrier back to an ordinary roadmap costs nothing → accept',
            expect: 'accept',
            run: () =>
                fixture({
                    roadmaps: 3,
                    base: 'main',
                    before: (dir) => write(dir, 'agents/roadmaps/road-to-2.md', CARRIER),
                    after: (dir) => write(dir, 'agents/roadmaps/road-to-2.md', roadmap('R2')),
                }),
        },
    ];
}
