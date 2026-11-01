// Calls the MCP `memory_lookup` handler in a real tsx process and prints what
// the server would put on the wire (server.ts: JSON.stringify of the result).
import { ALLOWLIST } from '../../../src/scripts/mcp_server/tools.js';

const [root, rawArgs] = process.argv.slice(2);
const result = await ALLOWLIST['memory_lookup']!.handler(JSON.parse(rawArgs!), root!);
process.stdout.write(JSON.stringify(result));
