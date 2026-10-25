// Synthetic fixture for agent_actions_detect — never executed.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const server = new McpServer({ name: 'support', version: '1.0.0' });

server.registerTool(
    'search_orders',
    {
        description: 'Search the signed-in customer orders',
        inputSchema: { query: z.string() },
        annotations: { readOnlyHint: true },
    },
    async ({ query }) => ({ content: [{ type: 'text', text: query }] }),
);

server.registerTool(
    'change_recovery_email',
    {
        description: 'Change the recovery e-mail of an account',
        inputSchema: { account: z.string(), new_email: z.string() },
    },
    async ({ account, new_email }) => ({ content: [{ type: 'text', text: `${account} ${new_email}` }] }),
);
