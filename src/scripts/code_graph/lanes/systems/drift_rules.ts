/**
 * Systems drift classes SY-1 … SY-5, as data for the one drift engine. All are
 * `advice`: a package reader cannot see dynamic loading or reflection, so
 * "unused" is a candidate and every message says what the reader looked at.
 * The flags are computed by the lane reader; each carries the second witness
 * in its `*_ref` attribute.
 */
import type { DriftRule } from '../../drift.js';

export const SYSTEMS_RULES: readonly DriftRule[] = [
    {
        id: 'SY-1',
        title: 'declared package with no use found',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'systems', kind: 'package', where: { unused: true } },
        counter: 'unused_ref',
        message: '{attr.name} is declared, and no import, script, CI step, tool config or framework discovery reaches it (dynamic loading is invisible here)',
        fix: 'run `code-graph remove-plan {attr.name}` and its tests before removing it',
    },
    {
        id: 'SY-2',
        title: 'package used but not declared',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'systems', kind: 'package', where: { undeclared_use: true } },
        counter: 'undeclared_ref',
        message: '{attr.name} is imported by production code, and only another package installs it',
        fix: 'declare {attr.name} in the manifest of the workspace that imports it',
    },
    {
        id: 'SY-3',
        title: 'development package in production code',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'systems', kind: 'package', where: { dev_in_prod: true } },
        counter: 'dev_in_prod_ref',
        message: '{attr.name} is a development dependency, and production code imports it',
    },
    {
        id: 'SY-4',
        title: 'runtime witnesses disagree',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'systems', kind: 'runtime', where: { disagrees: true } },
        counter: 'conflict',
        message: '{attr.name}: the declared range and a pinned version do not agree ({attr.values})',
    },
    {
        id: 'SY-5',
        title: 'one package in two majors across workspaces',
        tier: 'advice',
        match: 'fact',
        select: { lane: 'systems', kind: 'package', where: { multi_major: true } },
        counter: 'multi_major_refs',
        message: '{attr.name} is a direct dependency in two major versions inside one project',
    },
];
