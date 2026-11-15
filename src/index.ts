#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  const apiKey = process.env.ALLRATES_API_KEY;
  if (!apiKey) {
    // Not fatal: the bank catalog tools work offline, and request_trial_key can
    // fetch a key mid-session. Exiting would break the host's whole MCP config.
    console.error(
      [
        '',
        '  bank-exchange-rates-mcp: no ALLRATES_API_KEY set.',
        '  Working now: list_bank_countries, find_banks, request_trial_key.',
        '  For live bank rates, get a free key at https://allratestoday.com/register and add',
        '  "env": { "ALLRATES_API_KEY": "art_live_..." } to this server\'s MCP config.',
        '',
      ].join('\n'),
    );
  }
  const server = createServer({ apiKey, baseUrl: process.env.ALLRATES_BASE_URL });
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
