/**
 * Section renderers for the `explain last` Markdown projection.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/sections/__init__.py`
 * (ADR-200). Re-exports each section module under the same name so the
 * orchestrator (`render.ts`) calls them in fixed order, keeping the
 * Markdown output byte-deterministic for the same input `ExplainTrace`.
 *
 * `__init__.py` → `index.ts` per the migration convention.
 */
import * as assumptions from './assumptions.js';
import * as council from './council.js';
import * as halt from './halt.js';
import * as header from './header.js';
import * as inputs from './inputs.js';
import * as memory from './memory.js';
import * as pack from './pack.js';
import * as provider from './provider.js';
import * as route from './route.js';

export { assumptions, council, halt, header, inputs, memory, pack, provider, route };
