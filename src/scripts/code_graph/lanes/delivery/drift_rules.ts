/**
 * Delivery drift classes DL-1 … DL-5, as data for `evaluateRules`. All are
 * `advice` until their precision on planted fixtures is recorded.
 *
 * DL-3 "protection reference" means a stated mechanism in the repository that
 * restricts when the environment is deployed: a manual gate, a branch
 * condition on the deploying job, a trigger limited to named branches with no
 * pull-request event, or a committed `.github/settings.yml` environment entry
 * with a protection key. Dynamic (per-branch review) environments are exempt.
 */
import type { DriftRule } from '../runtime/rules_eval.js';

export const DELIVERY_RULES: readonly DriftRule[] = [
    {
        id: 'DL-1',
        title: 'unpinned action',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'delivery', kind: 'action', where: { pinned: false, local: false } },
        context: 'context',
        message: '{attr.ref} in {other.name} is referenced by a movable tag, not a commit SHA',
    },
    {
        id: 'DL-2',
        title: 'write-all permissions',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'delivery', kind: 'job', where: { permissions: 'write-all' } },
        context: 'context',
        message: 'job {name} in {other.name} runs with write-all token permissions',
    },
    {
        id: 'DL-3',
        title: 'environment without protection reference',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'delivery', kind: 'environment', where: { protected: false } },
        context: 'context',
        message: 'environment {name} is deployed by {other.name} with no manual gate, branch restriction or protection entry',
    },
    {
        id: 'DL-4',
        title: 'deploy job without a needs-chain from tests',
        tier: 'advice',
        match: 'unreached',
        select: { lane: 'delivery', kind: 'job', where: { is_deploy: true } },
        via: ['needs'],
        target: { lane: 'delivery', kind: 'job', where: { is_test: true } },
        message: 'deploy job {name} in {other.name} does not wait on any test job',
    },
    {
        id: 'DL-5',
        title: 'paths filter excludes its own pipeline files',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'delivery', kind: 'trigger', where: { self_triggering: false } },
        context: 'context',
        message: 'the {attr.event} filter of {other.name} excludes its own pipeline files ({attr.excluded}); an edit to them never runs it',
    },
];
