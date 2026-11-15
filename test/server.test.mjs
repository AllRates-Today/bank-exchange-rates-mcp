import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../dist/server.js';

async function connect(opts) {
  const server = createServer(opts);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const fakeFetch = (handler, seen = []) => async (url, init = {}) => {
  seen.push({ url: String(url), init });
  const [status, body] = handler(String(url), init);
  return new Response(JSON.stringify(body), { status });
};
const data = (r) => JSON.parse(r.content[0].text);

test('lists all tools', async () => {
  const c = await connect({});
  const names = (await c.listTools()).tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['compare_bank_rates', 'find_banks', 'get_bank_rate_history', 'get_bank_rates', 'get_country_bank_rates', 'list_bank_countries', 'request_trial_key']);
});

test('catalog tools work without a key', async () => {
  const c = await connect({});
  const countries = data(await c.callTool({ name: 'list_bank_countries', arguments: {} }));
  assert.ok(countries.countries.length > 100 && countries.banks > 1000);
  const f = data(await c.callTool({ name: 'find_banks', arguments: { query: 'state bank of india' } }));
  assert.ok(f.matches.some((m) => m.country === 'in' && m.bank === 'sbi'));
  const sg = data(await c.callTool({ name: 'find_banks', arguments: { country: 'SG' } }));
  assert.ok(sg.matches.some((m) => m.bank === 'dbs'));
});

test('rate tools without a key explain how to get one', async () => {
  const c = await connect({});
  const r = await c.callTool({ name: 'get_bank_rates', arguments: { country: 'sg', bank: 'dbs', ccy: 'USD' } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /register/);
});

test('get_bank_rates and compare call the API with the key', async () => {
  const seen = [];
  const fetch = fakeFetch((url) => url.includes('/bank-rates/in?') || url.endsWith('/bank-rates/in')
    ? [200, { banks: [
        { bank: 'a', name: 'A', bank_updated_at: null, basis: null, rates: [{ ccy: 'USD', buy: 80, sell: 84 }] },
        { bank: 'b', name: 'B', bank_updated_at: null, basis: null, rates: [{ ccy: 'USD', buy: 81, sell: 83 }] }] }]
    : [200, { ccy: 'USD', buy: 1.2, sell: 1.3 }], seen);
  const c = await connect({ apiKey: 'k1', fetch });
  const r = data(await c.callTool({ name: 'get_bank_rates', arguments: { country: 'SG', bank: 'DBS', ccy: 'usd' } }));
  assert.equal(r.sell, 1.3);
  assert.match(seen[0].url, /\/api\/v1\/bank-rates\/sg\/dbs\?ccy=USD$/);
  assert.equal(seen[0].init.headers.Authorization, 'Bearer k1');
  const cmp = data(await c.callTool({ name: 'compare_bank_rates', arguments: { country: 'in', ccy: 'USD' } }));
  assert.deepEqual(cmp.banks.map((b) => b.bank), ['b', 'a']);
});

test('request_trial_key adopts the api_key for later calls', async () => {
  const seen = [];
  const fetch = fakeFetch((url) => url.endsWith('/api/agent/keys') ? [200, { api_key: 'art_live_trial', calls_included: 100 }] : [200, { ccy: 'USD' }], seen);
  const c = await connect({ fetch });
  const t = data(await c.callTool({ name: 'request_trial_key', arguments: {} }));
  assert.equal(t.adopted, true);
  await c.callTool({ name: 'get_bank_rates', arguments: { country: 'sg', bank: 'dbs', ccy: 'USD' } });
  assert.equal(seen[1].init.headers.Authorization, 'Bearer art_live_trial');
});
