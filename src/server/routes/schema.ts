/**
 * `GET /api/v1/schema` — JSON-Schema export of the wizard / settings forms.
 *
 * The SPA bundle does not ship Zod (council security-engineer mandate:
 * client and server cannot drift). Instead it fetches JSON-Schema once at
 * mount and feeds it to the form renderer. `zod-to-json-schema` does the
 * conversion in-process; the response is cached for the lifetime of the
 * server process because the schemas are compile-time constants.
 *
 * Returns the documented shape from `docs/contracts/settings-api.md`:
 *   {
 *     settings:    JSONSchema,
 *     userMd:      JSONSchema,
 *     generatedAt: ISO-8601 string,
 *   }
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { settingsSchema } from '../schemas/settings.js';
import { userIdentitySchema } from '../../shared/userMd/schema.js';

interface SchemaResponse {
    settings: ReturnType<typeof zodToJsonSchema>;
    /** JSON-Schema for the `.agent-user.yml` identity object. */
    userIdentity: ReturnType<typeof zodToJsonSchema>;
    generatedAt: string;
}

let cached: SchemaResponse | null = null;

function build(): SchemaResponse {
    if (cached !== null) return cached;
    cached = {
        settings: zodToJsonSchema(settingsSchema, { name: 'Settings', target: 'jsonSchema7' }),
        userIdentity: zodToJsonSchema(userIdentitySchema, { name: 'UserIdentity', target: 'jsonSchema7' }),
        generatedAt: new Date().toISOString(),
    };
    return cached;
}

/** Reset cache — test-only seam so vitest does not leak state across files. */
export function _resetSchemaCache(): void {
    cached = null;
}

export function schemaRoute(): FastifyPluginAsync {
    const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
        app.get('/api/v1/schema', async () => build());
    };
    return plugin;
}
